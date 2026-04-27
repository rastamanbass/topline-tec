/**
 * seed-internal-codes.mjs
 *
 * Siembra la coleccion Firestore `internal_codes` con los codigos hardcoded
 * de HARDCODED_CODES (src/lib/internalCodes.ts). Idempotente (merge:true).
 *
 * USO:
 *   # Dry run (default — solo imprime que haria)
 *   node scripts/seed-internal-codes.mjs
 *
 *   # Aplicar cambios reales en Firestore
 *   node scripts/seed-internal-codes.mjs --apply
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

// ── Config ────────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: 'AIzaSyBgAt0AO5iBb_Ah5Vd0GaUwdazyeJ0MCg8',
  authDomain: 'inventario-a6aa3.firebaseapp.com',
  projectId: 'inventario-a6aa3',
};

const AUTH_EMAIL = 'danielabrego95@gmail.com';
const AUTH_PASSWORD = 'Loquito420';

// Mantener sincronizado con src/lib/internalCodes.ts (HARDCODED_CODES).
const HARDCODED_CODES = [
  'WNY', 'REC', 'ZK', 'HEC', 'TRAD', 'XT', 'B', 'RUB', 'ANG', 'ANGE',
  'XTRA', 'WS', 'EB', 'LZ', 'TRADE', 'ORCA', 'INQ', 'JES', 'RB', 'HE',
  'OH', 'OFFE', 'KRA', 'TPM', 'PA', 'LOLO', 'CESFL',
];

// ── Main ──────────────────────────────────────────────────────────────────────

const APPLY = process.argv.includes('--apply');

console.log('='.repeat(60));
console.log('  Top Line Tec — Seed internal_codes');
console.log('='.repeat(60));
console.log(`Mode: ${APPLY ? 'APPLY (writing to Firestore)' : 'DRY-RUN'}`);
console.log(`Codes to seed: ${HARDCODED_CODES.length}`);
console.log();

if (!APPLY) {
  console.log('[DRY-RUN] Would write the following docs to internal_codes/:');
  HARDCODED_CODES.forEach((code) => {
    console.log(
      `  internal_codes/${code.padEnd(8)} { code: '${code}', addedBy: 'system', addedAt: <serverTimestamp>, notes: 'Hardcoded baseline' }`
    );
  });
  console.log();
  console.log('Re-run with --apply to actually write.');
  process.exit(0);
}

// Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log(`[Auth] Signing in as ${AUTH_EMAIL}...`);
await signInWithEmailAndPassword(auth, AUTH_EMAIL, AUTH_PASSWORD);
console.log('[Auth] OK');
console.log();

console.log('[Write] Seeding internal_codes...');
let written = 0;
for (const code of HARDCODED_CODES) {
  const ref = doc(db, 'internal_codes', code);
  await setDoc(
    ref,
    {
      code,
      addedBy: 'system',
      addedAt: serverTimestamp(),
      notes: 'Hardcoded baseline',
    },
    { merge: true }
  );
  written++;
  console.log(`  ${written}/${HARDCODED_CODES.length}  ${code}`);
}

console.log();
console.log('='.repeat(60));
console.log(`  DONE — ${written} codigos seeded`);
console.log('='.repeat(60));
process.exit(0);
