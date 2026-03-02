import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, getCountFromServer } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const app = initializeApp({ apiKey:'AIzaSyBgAt0AO5iBb_Ah5Vd0GaUwdazyeJ0MCg8', authDomain:'inventario-a6aa3.firebaseapp.com', projectId:'inventario-a6aa3' });
await signInWithEmailAndPassword(getAuth(app), 'danielabrego95@gmail.com', 'Loquito420');
const db = getFirestore(app);
const ref = collection(db, 'phones');

let pass = 0, fail = 0;
const ok = (msg) => { console.log(`  ✓ ${msg}`); pass++; };
const ko = (msg) => { console.log(`  ✗ ${msg}`); fail++; };

// TEST 1: phones.marca no debe contener ningún código de proveedor
console.log('\n── TEST 1: phones.marca limpia (sin códigos de proveedor) ──');
const CODES = ['WNY','XT','ZK','HEC','TRAD','LZ','INQ','RUB','ANG','ANGE','WS','EB','TRADE','ORCA','REC','B','XTRA','RB','HE','OH','OFFE','JES','wny','xt','hec','trad','zk'];
let dirty = 0;
for (const code of CODES) {
  const n = (await getCountFromServer(query(ref, where('marca','==',code)))).data().count;
  if (n > 0) { ko(`${n} phones aún con marca="${code}"`); dirty++; }
}
if (dirty === 0) ok('Ningún phone tiene marca = código de proveedor');

// TEST 2: supplierCode='WNY' debe tener 485 phones
console.log('\n── TEST 2: WNY migrado correctamente ──');
const wny = (await getCountFromServer(query(ref, where('supplierCode','==','WNY')))).data().count;
const wnyApple = (await getCountFromServer(query(ref, where('supplierCode','==','WNY'), where('marca','==','Apple')))).data().count;
wny === 485 ? ok(`WNY: ${wny} phones con supplierCode`) : ko(`WNY: ${wny} phones (esperado 485)`);
wnyApple === 485 ? ok(`WNY: todos tienen marca='Apple'`) : ko(`WNY: solo ${wnyApple}/485 con marca='Apple'`);

// TEST 3: REC, ZK, HEC
console.log('\n── TEST 3: Otros proveedores ──');
for (const [code, expected] of [['REC',434],['ZK',345],['HEC',179],['XT',108]]) {
  const n = (await getCountFromServer(query(ref, where('supplierCode','==',code)))).data().count;
  n === expected ? ok(`${code}: ${n} phones`) : ko(`${code}: ${n} phones (esperado ${expected})`);
}

// TEST 4: Índice compuesto supplierCode+estado (para Supplier Stats)
console.log('\n── TEST 4: Índice supplierCode+estado ──');
try {
  const n = (await getCountFromServer(query(ref, where('supplierCode','==','WNY'), where('estado','in',['En Stock (Disponible para Venta)','Apartado','En Taller (Recibido)'])))).data().count;
  ok(`supplierCode+estado funciona — WNY en stock/taller: ${n}`);
} catch(e) {
  ko(`Índice aún construyendo: ${e.message.slice(0,80)}`);
}

// TEST 5: Totales globales
console.log('\n── TEST 5: Totales de migración ──');
const snap = await getDocs(ref);
let withCode=0, realBrand=0;
snap.forEach(d => { const c = d.data(); if (c.supplierCode) withCode++; else realBrand++; });
withCode === 1957 ? ok(`1957 phones con supplierCode`) : ko(`${withCode} con supplierCode (esperado 1957)`);
console.log(`  Info: ${realBrand} phones con marca real (Apple/Samsung/etc. sin código de proveedor)`);

console.log(`\n${'='.repeat(50)}`);
console.log(`  ${pass} PASS  |  ${fail} FAIL`);
console.log('='.repeat(50));
process.exit(fail > 0 ? 1 : 0);
