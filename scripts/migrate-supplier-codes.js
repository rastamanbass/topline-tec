/**
 * migrate-supplier-codes.js
 *
 * Migración de la colección `phones` en Firestore:
 *   - Si phones.marca es un código interno de proveedor (WNY, XT, HEC, etc.)
 *     → mover a supplierCode, poner "Apple" en marca
 *   - Si phones.marca es null/undefined
 *     → supplierCode = null, marca = "Desconocida"
 *   - Otros (marcas reales: Apple, Samsung, etc.)
 *     → supplierCode = null, marca sin cambio
 *
 * USO:
 *   cd /Users/danielabrego/Projects/topline-tec
 *   node scripts/migrate-supplier-codes.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc, deleteField } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey:     'AIzaSyBgAt0AO5iBb_Ah5Vd0GaUwdazyeJ0MCg8',
  authDomain: 'inventario-a6aa3.firebaseapp.com',
  projectId:  'inventario-a6aa3',
};

const EMAIL    = 'danielabrego95@gmail.com';
const PASSWORD = 'Loquito420';

const INTERNAL_CODES = new Set([
  'WNY', 'XT', 'ZK', 'HEC', 'TRAD', 'LZ', 'INQ', 'RUB',
  'ANG', 'ANGE', 'WS', 'EB', 'TRADE', 'ORCA', 'REC', 'B',
  'XTRA', 'RB', 'HE', 'OH', 'OFFE', 'JES',
]);

const BATCH_SIZE = 499;

function classifyDoc(data) {
  const marcaRaw = data.marca;
  if (marcaRaw == null || marcaRaw === '') {
    return { marca: 'Desconocida', supplierCode: null };
  }
  const upper = marcaRaw.trim().toUpperCase();
  if (INTERNAL_CODES.has(upper)) {
    return { marca: 'Apple', supplierCode: upper };
  }
  return { marca: marcaRaw, supplierCode: null };
}

async function migrate() {
  console.log('='.repeat(60));
  console.log('  Top Line Tec — Migración supplierCode → phones');
  console.log('='.repeat(60));

  const app  = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  console.log(`\n[Auth] Iniciando sesión como ${EMAIL}...`);
  await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
  console.log('[Auth] OK\n');

  console.log('[Read] Leyendo colección phones...');
  const snapshot  = await getDocs(collection(db, 'phones'));
  const totalDocs = snapshot.size;
  console.log(`[Read] ${totalDocs} documentos encontrados\n`);

  const toUpdate      = [];
  const supplierTally = {};
  let countInternal = 0, countReal = 0, countUnknown = 0;

  snapshot.forEach((docSnap) => {
    const classified = classifyDoc(docSnap.data());
    toUpdate.push({ ref: doc(db, 'phones', docSnap.id), ...classified });
    if (classified.supplierCode) {
      countInternal++;
      supplierTally[classified.supplierCode] = (supplierTally[classified.supplierCode] || 0) + 1;
    } else if (classified.marca === 'Desconocida') {
      countUnknown++;
    } else {
      countReal++;
    }
  });

  console.log('[Classify]');
  console.log(`  Códigos de proveedor → supplierCode : ${countInternal}`);
  console.log(`  Marcas reales (sin cambio)          : ${countReal}`);
  console.log(`  Sin marca → Desconocida             : ${countUnknown}`);
  console.log(`  TOTAL                               : ${totalDocs}\n`);

  const totalBatches = Math.ceil(toUpdate.length / BATCH_SIZE);
  console.log(`[Write] ${toUpdate.length} docs en ${totalBatches} batch(es)...\n`);

  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_SIZE;
    const end   = Math.min(start + BATCH_SIZE, toUpdate.length);
    const chunk = toUpdate.slice(start, end);
    const batch = writeBatch(db);
    chunk.forEach(({ ref, marca, supplierCode }) => batch.update(ref, { marca, supplierCode }));
    await batch.commit();
    console.log(`  Batch ${i + 1}/${totalBatches} ✓ (${chunk.length} docs | acumulado: ${end}/${toUpdate.length})`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('  MIGRACIÓN COMPLETADA ✓');
  console.log('='.repeat(60));
  console.log(`\n  ${countInternal} códigos de proveedor migrados a supplierCode`);
  console.log(`  ${countReal} marcas reales sin cambio`);

  if (countInternal > 0) {
    console.log('\nDesglose por proveedor:');
    Object.entries(supplierTally)
      .sort(([, a], [, b]) => b - a)
      .forEach(([code, count]) => console.log(`  ${code.padEnd(8)}: ${count}`));
  }
  console.log('');
}

// ROLLBACK — des-comentar solo si necesitas revertir:
//
// async function rollback() {
//   const app = initializeApp(firebaseConfig);
//   await signInWithEmailAndPassword(getAuth(app), EMAIL, PASSWORD);
//   const db  = getFirestore(app);
//   const snap = await getDocs(collection(db, 'phones'));
//   const toRevert = [];
//   snap.forEach((d) => {
//     const data = d.data();
//     if (data.supplierCode && data.marca === 'Apple') {
//       toRevert.push({ ref: doc(db, 'phones', d.id), marca: data.supplierCode });
//     }
//   });
//   console.log(`Revirtiendo ${toRevert.length} docs...`);
//   const batches = Math.ceil(toRevert.length / BATCH_SIZE);
//   for (let i = 0; i < batches; i++) {
//     const chunk = toRevert.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
//     const batch = writeBatch(db);
//     chunk.forEach(({ ref, marca }) => batch.update(ref, { marca, supplierCode: deleteField() }));
//     await batch.commit();
//   }
//   console.log('Rollback completado.');
// }

migrate().catch((err) => { console.error('\n[ERROR]', err); process.exit(1); });
