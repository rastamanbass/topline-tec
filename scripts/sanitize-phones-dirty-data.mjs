// Sanitize phones — reglas CONFIRMADAS por Daniel (2026-04-27):
// - KRA / kra / KRAN → supplierCode "KRA" (KRAN se mergea)
// - ANG / RUB / PA / LOLO / CESFL en marca → mover a supplierCode
// - REC variants ("Iphone REC", "REC IPHONE A", etc) → supplierCode "REC", marca "Apple"
// - TRAD variants ("trad color rosado") → supplierCode "TRAD"
// - CESFL pegado en modelo → extraer y mover a supplierCode
// - RQM5006653 en supplierCode → limpiar (es nº invoice del Excel)
// - Apple con modelo Samsung (Galaxy/SXX) → marca = Samsung
// - "Desconocida" en marca → SE QUEDA (placeholder válido)
// - "prueba/Prueba/Pruena" en marca → flagged for DELETE (manual confirm)
// DRY-RUN por defecto. Aplicar con --apply

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const DRY_RUN = !process.argv.includes('--apply');

// Lista canonica final (sincronizada con src/lib/internalCodes.ts)
const SUPPLIER_CODES = new Set([
  'WNY', 'REC', 'ZK', 'HEC', 'TRAD', 'XT', 'B', 'RUB', 'ANG', 'ANGE',
  'XTRA', 'WS', 'EB', 'LZ', 'TRADE', 'ORCA', 'INQ', 'JES', 'RB', 'HE',
  'OH', 'OFFE', 'KRA', 'TPM', 'PA', 'LOLO', 'CESFL',
]);

// Marcas reales que no son codigos
const REAL_BRANDS = new Set([
  'APPLE', 'SAMSUNG', 'XIAOMI', 'GOOGLE', 'PIXEL', 'MOTOROLA', 'MOTO',
  'ONEPLUS', 'REDMI', 'POCO', 'LG', 'SONY', 'HTC', 'HUAWEI', 'OPPO',
  'VIVO', 'REALME', 'NOKIA', 'ZTE', 'TCL', 'BLU', 'IPHONE',
]);

const inferBrandFromModel = (modelo) => {
  if (!modelo) return 'Desconocida';
  const m = modelo.toUpperCase();
  if (m.includes('IPHONE') || m.includes('IPAD')) return 'Apple';
  if (m.includes('GALAXY') || /\bS\d{2}\b/.test(m) || /\bA\d{2}\b/.test(m) || m.includes('NOTE')) return 'Samsung';
  if (m.includes('PIXEL')) return 'Google';
  if (m.includes('ONEPLUS')) return 'OnePlus';
  if (m.includes('MOTOROLA') || m.includes('MOTO')) return 'Motorola';
  if (/^\d{2}\s/.test(m.trim())) return 'Apple'; // "13 pro max" → iPhone
  return 'Desconocida';
};

// Detecta supplier code en cualquier parte del string marca
// Maneja casos: "KRA", "kra", "KRAN" (mergea a KRA), "Iphone REC", "REC IPHONE A", "trad color rosado"
const extractSupplierFromMarca = (marca) => {
  if (!marca) return null;
  const trimmed = marca.trim();
  const upper = trimmed.toUpperCase();

  // Caso especial: KRAN → KRA
  if (upper === 'KRAN') return 'KRA';

  // Marca completa es codigo
  if (SUPPLIER_CODES.has(upper)) return upper;

  // Primera palabra es codigo
  const firstWord = upper.split(/\s+/)[0];
  if (SUPPLIER_CODES.has(firstWord)) return firstWord;
  if (firstWord === 'KRAN') return 'KRA';

  // "Iphone REC" / "REC Iphone" — buscar codigo en palabras
  for (const word of upper.split(/\s+/)) {
    if (SUPPLIER_CODES.has(word)) return word;
    if (word === 'KRAN') return 'KRA';
  }

  return null;
};

// Detecta CESFL pegado al final del modelo: "s22 ultra 512gbcesfl" → "CESFL"
const extractSupplierFromModelo = (modelo) => {
  if (!modelo) return null;
  const m = modelo.toUpperCase();
  if (/CESFL\b/i.test(m)) return 'CESFL';
  return null;
};

const cleanModeloFromCode = (modelo, code) => {
  if (!code) return modelo;
  const re = new RegExp(`\\s*${code}\\b`, 'gi');
  return modelo.replace(re, '').replace(/\s+/g, ' ').trim();
};

// "prueba/Prueba/Pruena" detector
const isTestData = (marca, modelo) => {
  const blob = `${marca || ''} ${modelo || ''}`.toLowerCase();
  return /\b(prueba|pruena)\b/.test(blob);
};

const app = initializeApp({
  apiKey: 'AIzaSyBgAt0AO5iBb_Ah5Vd0GaUwdazyeJ0MCg8',
  authDomain: 'inventario-a6aa3.firebaseapp.com',
  projectId: 'inventario-a6aa3',
});
const cred = await signInWithEmailAndPassword(
  getAuth(app),
  'danielabrego95@gmail.com',
  'Loquito420'
);
const db = getFirestore(app);
const userEmail = cred.user.email || 'sanitize-script';

const snap = await getDocs(collection(db, 'phones'));
const issues = [];
const testDataFound = [];

snap.forEach((d) => {
  const x = d.data();
  const marca = (x.marca || '').toString().trim();
  const modelo = (x.modelo || '').toString().trim();
  const existingSupplier = (x.supplierCode || '').toString().trim();
  const fixes = {};

  // Detectar test data primero (no procesar, solo flag)
  if (isTestData(marca, modelo)) {
    testDataFound.push({ id: d.id, imei: x.imei, marca, modelo, lote: x.lote, estado: x.estado });
    return;
  }

  // 1. Limpiar RQM5006653 del supplierCode (es nº invoice, no proveedor)
  if (existingSupplier && /^RQM\d+/i.test(existingSupplier)) {
    fixes.supplierCode = null;
  }

  // 2. Detectar supplier code en marca y mover
  const codeFromMarca = extractSupplierFromMarca(marca);
  if (codeFromMarca) {
    const supplierToSet = existingSupplier && SUPPLIER_CODES.has(existingSupplier.toUpperCase())
      ? existingSupplier.toUpperCase()
      : codeFromMarca;
    fixes.supplierCode = supplierToSet;
    fixes.marca = inferBrandFromModel(modelo);
  }

  // 3. Detectar CESFL en modelo y mover (independiente de marca)
  const codeFromModelo = extractSupplierFromModelo(modelo);
  if (codeFromModelo) {
    fixes.supplierCode = fixes.supplierCode || codeFromModelo;
    fixes.modelo = cleanModeloFromCode(modelo, 'CESFL');
  }

  // 4. KRAN → KRA en supplierCode existente (normalizar)
  if (existingSupplier && existingSupplier.toUpperCase() === 'KRAN') {
    fixes.supplierCode = 'KRA';
  }

  // 5. Apple con modelo Samsung → corregir marca
  if (/^apple$/i.test(marca) && /\b(s2[12345]|galaxy|note|fold|flip)\b/i.test(modelo) && !fixes.marca) {
    fixes.marca = 'Samsung';
  }

  // 6. Capitalizar typos de marca real (solo si DIFFERS)
  if (/^iphone$/i.test(marca) && marca !== 'Apple' && !fixes.marca) {
    fixes.marca = 'Apple';
  }
  if (/^apple$/i.test(marca) && marca !== 'Apple' && !fixes.marca) {
    fixes.marca = 'Apple';
  }
  if (/^samsung$/i.test(marca) && marca !== 'Samsung' && !fixes.marca) {
    fixes.marca = 'Samsung';
  }

  // Eliminar fixes que son no-ops (mismo valor que actual)
  if (fixes.marca === marca) delete fixes.marca;
  if (fixes.supplierCode === existingSupplier) delete fixes.supplierCode;
  if (fixes.modelo === modelo) delete fixes.modelo;

  if (Object.keys(fixes).length > 0) {
    issues.push({
      id: d.id,
      imei: x.imei,
      lote: x.lote,
      current: { marca, modelo, supplierCode: existingSupplier },
      fixes,
    });
  }
});

console.log(`\nTotal phones revisados: ${snap.size}`);
console.log(`Cambios propuestos: ${issues.length}`);
console.log(`Test data encontrada (NO se modifica, manual decide): ${testDataFound.length}\n`);

// Stats
const byKind = new Map();
issues.forEach((i) => {
  let kind = 'otro';
  if (i.fixes.supplierCode === null) kind = 'limpiar RQM*';
  else if (i.fixes.supplierCode && i.fixes.marca) kind = 'mover code marca→supplierCode';
  else if (i.fixes.supplierCode && i.fixes.modelo) kind = 'extraer CESFL del modelo';
  else if (i.fixes.supplierCode && !i.fixes.marca) kind = 'normalizar supplierCode';
  else if (i.fixes.marca === 'Samsung') kind = 'apple→samsung (typo)';
  else if (i.fixes.marca === 'Apple') kind = 'normalizar marca Apple';
  byKind.set(kind, (byKind.get(kind) || 0) + 1);
});
console.log('Distribución:');
for (const [k, v] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(35)} ${v}`);

console.log('\n=== Sample (primeros 15) ===');
issues.slice(0, 15).forEach((i) => {
  console.log(`  IMEI ${i.imei}`);
  console.log(`    antes:   marca="${i.current.marca}" supplier="${i.current.supplierCode || '—'}" modelo="${i.current.modelo}"`);
  const newMarca = 'marca' in i.fixes ? i.fixes.marca : i.current.marca;
  const newSup = 'supplierCode' in i.fixes ? (i.fixes.supplierCode || '—') : (i.current.supplierCode || '—');
  const newModelo = 'modelo' in i.fixes ? i.fixes.modelo : i.current.modelo;
  console.log(`    despues: marca="${newMarca}" supplier="${newSup}" modelo="${newModelo}"`);
});

if (testDataFound.length > 0) {
  console.log(`\n=== Test data (${testDataFound.length} phones) — REQUIERE DECISION MANUAL ===`);
  testDataFound.slice(0, 10).forEach((t) => {
    console.log(`  ${t.imei}  marca="${t.marca}" modelo="${t.modelo}" lote="${t.lote || '—'}" estado="${t.estado}"`);
  });
  console.log(`  Usar --delete-test para borrar estos. Por defecto NO se tocan.`);
}

if (DRY_RUN) {
  console.log('\nDRY-RUN. Para aplicar: node scripts/sanitize-phones-dirty-data.mjs --apply');
  process.exit(0);
}

// APPLY — uno por uno para identificar fallos individuales
import { updateDoc } from 'firebase/firestore';
let written = 0;
let failed = 0;
const failures = [];
for (const item of issues) {
  const update = { updatedAt: serverTimestamp() };
  if ('marca' in item.fixes) update.marca = item.fixes.marca;
  if ('supplierCode' in item.fixes) update.supplierCode = item.fixes.supplierCode;
  if ('modelo' in item.fixes) update.modelo = item.fixes.modelo;
  update.statusHistory = arrayUnion({
    newStatus: 'data-sanitized',
    date: new Date(),
    user: userEmail,
    details: `Sanitized: ${JSON.stringify(item.current)} → ${JSON.stringify(item.fixes)}`,
  });
  try {
    await updateDoc(doc(db, 'phones', item.id), update);
    written++;
    if (written % 50 === 0) console.log(`  ${written}/${issues.length} OK`);
  } catch (e) {
    failed++;
    failures.push({ id: item.id, imei: item.imei, current: item.current, fixes: item.fixes, error: e.code || e.message });
  }
}
console.log(`\nDONE. ${written} updated, ${failed} failed.`);
if (failures.length > 0) {
  console.log('\n=== Failures ===');
  failures.slice(0, 10).forEach(f => console.log(`  ${f.imei} | ${f.error} | fixes=${JSON.stringify(f.fixes)}`));
}

if (process.argv.includes('--delete-test') && testDataFound.length > 0) {
  console.log(`\nDeleting ${testDataFound.length} test phones...`);
  for (let i = 0; i < testDataFound.length; i += 400) {
    const slice = testDataFound.slice(i, i + 400);
    const batch = writeBatch(db);
    slice.forEach((t) => batch.delete(doc(db, 'phones', t.id)));
    await batch.commit();
  }
  console.log('Test phones eliminados.');
}

console.log(`\nDONE. ${written} phones actualizados.`);
if (testDataFound.length > 0 && !process.argv.includes('--delete-test')) {
  console.log(`${testDataFound.length} test phones NO eliminados (use --delete-test).`);
}
process.exit(0);
