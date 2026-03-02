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
 *
 * IMPORTANTE: Leer el rollback al final antes de ejecutar en producción.
 */

// ES Module version — run as: node scripts/migrate-supplier-codes.cjs
// (renamed .cjs so Node treats it as CommonJS in an ESM project)
// But we need ESM imports — use dynamic import workaround or run via tsx
// Actually: just use the .js file with proper ESM imports instead.
// This file is kept as backup. See migrate-supplier-codes.js for the runnable version.

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

const firebaseConfig = {
  apiKey:      'AIzaSyBgAt0AO5iBb_Ah5Vd0GaUwdazyeJ0MCg8',
  authDomain:  'inventario-a6aa3.firebaseapp.com',
  projectId:   'inventario-a6aa3',
};

const EMAIL    = 'danielabrego95@gmail.com';
const PASSWORD = 'Loquito420';

/** Todos los códigos internos de proveedor (Eduardo) */
const INTERNAL_CODES = new Set([
  'WNY', 'XT', 'ZK', 'HEC', 'TRAD', 'LZ', 'INQ', 'RUB',
  'ANG', 'ANGE', 'WS', 'EB', 'TRADE', 'ORCA', 'REC', 'B',
  'XTRA', 'RB', 'HE', 'OH', 'OFFE', 'JES',
]);

/** Límite seguro por batch (Firestore acepta máximo 500 operaciones) */
const BATCH_SIZE = 499;

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function isInternalCode(marca) {
  return INTERNAL_CODES.has((marca || '').trim().toUpperCase());
}

function classifyDoc(data) {
  const marcaRaw = data.marca;

  if (marcaRaw == null || marcaRaw === '') {
    // Sin marca → marcar como Desconocida
    return { marca: 'Desconocida', supplierCode: null };
  }

  const upper = marcaRaw.trim().toUpperCase();

  if (INTERNAL_CODES.has(upper)) {
    // Código interno → preservarlo en supplierCode, forzar Apple
    return { marca: 'Apple', supplierCode: upper };
  }

  // Marca real ya establecida (Apple, Samsung, Motorola, etc.)
  return { marca: marcaRaw, supplierCode: null };
}

// ---------------------------------------------------------------------------
// MIGRACIÓN PRINCIPAL
// ---------------------------------------------------------------------------

async function migrate() {
  console.log('='.repeat(60));
  console.log('  Top Line Tec — Migración supplierCode → phones');
  console.log('='.repeat(60));

  // 1. Inicializar Firebase
  const app  = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  // 2. Autenticar
  console.log(`\n[Auth] Iniciando sesión como ${EMAIL}...`);
  await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
  console.log('[Auth] Sesión iniciada correctamente.\n');

  // 3. Leer toda la colección phones
  console.log('[Read] Leyendo colección phones...');
  const phonesRef  = collection(db, 'phones');
  const snapshot   = await getDocs(phonesRef);
  const totalDocs  = snapshot.size;

  console.log(`[Read] Total documentos encontrados: ${totalDocs}\n`);

  // 4. Clasificar cada documento
  const toUpdate = [];   // { id, ref, marca, supplierCode }
  const supplierTally = {};  // { 'WNY': 485, 'ZK': 345, ... }
  let countInternal  = 0;
  let countReal      = 0;
  let countUnknown   = 0;

  snapshot.forEach((docSnap) => {
    const data      = docSnap.data();
    const classified = classifyDoc(data);

    toUpdate.push({
      ref:          doc(db, 'phones', docSnap.id),
      marca:        classified.marca,
      supplierCode: classified.supplierCode,
    });

    if (classified.supplierCode !== null) {
      countInternal++;
      supplierTally[classified.supplierCode] =
        (supplierTally[classified.supplierCode] || 0) + 1;
    } else if (classified.marca === 'Desconocida') {
      countUnknown++;
    } else {
      countReal++;
    }
  });

  console.log('[Classify] Resultados:');
  console.log(`  Códigos internos de proveedor : ${countInternal}`);
  console.log(`  Marcas reales (sin cambio)    : ${countReal}`);
  console.log(`  Sin marca → Desconocida       : ${countUnknown}`);
  console.log(`  TOTAL                         : ${totalDocs}\n`);

  // 5. Escribir en batches de BATCH_SIZE
  const totalBatches = Math.ceil(toUpdate.length / BATCH_SIZE);
  console.log(`[Write] Escribiendo ${toUpdate.length} documentos en ${totalBatches} batch(es) de ${BATCH_SIZE}...\n`);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const start = batchIdx * BATCH_SIZE;
    const end   = Math.min(start + BATCH_SIZE, toUpdate.length);
    const chunk = toUpdate.slice(start, end);

    const batch = writeBatch(db);

    chunk.forEach(({ ref, marca, supplierCode }) => {
      batch.update(ref, { marca, supplierCode });
    });

    await batch.commit();

    console.log(
      `  Batch ${batchIdx + 1}/${totalBatches} committed ` +
      `(${chunk.length} docs | acumulado: ${end}/${toUpdate.length})`
    );
  }

  // 6. Resumen final
  console.log('\n' + '='.repeat(60));
  console.log('  MIGRACIÓN COMPLETADA');
  console.log('='.repeat(60));
  console.log(`\nTotal documentos actualizados : ${toUpdate.length}`);
  console.log(`  → Con supplierCode            : ${countInternal}`);
  console.log(`  → marca real (supplierCode=null): ${countReal}`);
  console.log(`  → Desconocida (supplierCode=null): ${countUnknown}`);

  if (countInternal > 0) {
    console.log('\nDesglose por código de proveedor:');
    const sorted = Object.entries(supplierTally).sort(([, a], [, b]) => b - a);
    sorted.forEach(([code, count]) => {
      console.log(`  ${code.padEnd(8)}: ${count}`);
    });
  }

  console.log('\nMigración finalizada sin errores.\n');
}

// ---------------------------------------------------------------------------
// ROLLBACK (comentado — ejecutar solo si es necesario revertir)
// ---------------------------------------------------------------------------
//
// async function rollback() {
//   console.log('[Rollback] Iniciando reversión...');
//
//   const app  = initializeApp(firebaseConfig);
//   const auth = getAuth(app);
//   const db   = getFirestore(app);
//
//   await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
//
//   const snapshot = await getDocs(collection(db, 'phones'));
//   const toRevert = [];
//
//   snapshot.forEach((docSnap) => {
//     const data = docSnap.data();
//     // Solo revertir los que fueron migrados (tienen supplierCode y marca='Apple')
//     if (data.supplierCode && data.marca === 'Apple') {
//       toRevert.push({
//         ref:          doc(db, 'phones', docSnap.id),
//         // Restaurar el código como marca original
//         marca:        data.supplierCode,
//         supplierCode: require('./node_modules/firebase/firestore').deleteField(),
//       });
//     }
//   });
//
//   console.log(`[Rollback] Documentos a revertir: ${toRevert.length}`);
//   const totalBatches = Math.ceil(toRevert.length / BATCH_SIZE);
//
//   for (let i = 0; i < totalBatches; i++) {
//     const chunk = toRevert.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
//     const batch = writeBatch(db);
//     chunk.forEach(({ ref, marca, supplierCode }) => {
//       batch.update(ref, { marca, supplierCode });
//     });
//     await batch.commit();
//     console.log(`  Rollback batch ${i + 1}/${totalBatches} committed (${chunk.length} docs)`);
//   }
//
//   console.log('[Rollback] Reversión completada.\n');
// }

// ---------------------------------------------------------------------------
// ENTRY POINT
// ---------------------------------------------------------------------------

migrate().catch((err) => {
  console.error('\n[ERROR FATAL]', err);
  process.exit(1);
});
