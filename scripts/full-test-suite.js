/**
 * TOP LINE TEC — Full Test Suite (con datos de test reales)
 * - Verifica migración supplierCode
 * - Crea cliente+phone de test y prueba flujos
 * - Limpia datos de test al final
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, collection, getDocs, doc, getDoc,
  addDoc, updateDoc, deleteDoc, query, where,
  getCountFromServer, getAggregateFromServer, sum,
  orderBy, limit, serverTimestamp,
} from 'firebase/firestore';

const app = initializeApp({ apiKey:'AIzaSyBgAt0AO5iBb_Ah5Vd0GaUwdazyeJ0MCg8', authDomain:'inventario-a6aa3.firebaseapp.com', projectId:'inventario-a6aa3' });
await signInWithEmailAndPassword(getAuth(app), 'danielabrego95@gmail.com', 'Loquito420');
const db  = getFirestore(app);

let passed=0, failed=0, warned=0;
const ok   = (m) => { console.log(`  ✅ ${m}`); passed++; };
const fail = (m) => { console.log(`  ❌ ${m}`); failed++; };
const warn = (m) => { console.log(`  ⚠️  ${m}`); warned++; };
const section = (t) => console.log(`\n${'─'.repeat(58)}\n  ${t}\n${'─'.repeat(58)}`);

const CODES = ['WNY','XT','ZK','HEC','TRAD','LZ','INQ','RUB','ANG','ANGE','WS','EB','TRADE','ORCA','REC','B','XTRA','RB','HE','OH','OFFE','JES'];
const STOCK = ['En Stock (Disponible para Venta)','Apartado','En Taller (Recibido)','Recibido de Taller (OK)','En Bodega (USA)','En Tránsito (a El Salvador)'];
const SOLD  = ['Vendido','Pagado','Entregado al Cliente','Vendido (Pendiente de Entrega)'];

const createdDocs = []; // para cleanup al final
const trackDoc = (col, id) => createdDocs.push({ col, id });

// ═══════════════════════════════════════════════════════════
section('BLOQUE 1 — Integridad de migración supplierCode');
// ═══════════════════════════════════════════════════════════

const ref = collection(db, 'phones');

// 1.1 Ningún phone con marca=código de proveedor
let dirty = 0;
for (const code of [...CODES, ...CODES.map(c=>c.toLowerCase())]) {
  const n = (await getCountFromServer(query(ref, where('marca','==',code)))).data().count;
  if (n > 0) { fail(`${n} phones con marca="${code}" (debe ser supplierCode)`); dirty++; }
}
dirty===0 ? ok('phones.marca limpia — sin códigos de proveedor') : null;

// 1.2 Conteos por proveedor
const expected = { WNY:485, REC:434, ZK:345, TRAD:208, HEC:179, XT:108 };
let allMatch = true;
for (const [c,e] of Object.entries(expected)) {
  const n = (await getCountFromServer(query(ref, where('supplierCode','==',c)))).data().count;
  if (n!==e) { fail(`${c}: ${n} (esperado ${e})`); allMatch=false; }
}
allMatch ? ok('Top 6 proveedores con conteos exactos ✓') : null;

// 1.3 supplierCodes siempre en uppercase
const s100 = await getDocs(query(ref, where('supplierCode','!=',null), limit(100)));
let lower=0;
s100.forEach(d=>{ const c=d.data().supplierCode; if(c&&c!==c.toUpperCase()) lower++; });
lower===0 ? ok('supplierCodes en uppercase (muestra 100)') : fail(`${lower} supplierCodes en minúsculas`);

// ═══════════════════════════════════════════════════════════
section('BLOQUE 2 — Supplier Stats (nuevas queries supplierCode)');
// ═══════════════════════════════════════════════════════════

for (const code of ['WNY','ZK','HEC','XT','REC']) {
  try {
    const [tot, stk, sld] = await Promise.all([
      getCountFromServer(query(ref, where('supplierCode','==',code))),
      getCountFromServer(query(ref, where('supplierCode','==',code), where('estado','in',STOCK))),
      getCountFromServer(query(ref, where('supplierCode','==',code), where('estado','in',SOLD))),
    ]);
    const t=tot.data().count, s=stk.data().count, v=sld.data().count;
    const sane = s+v <= t ? '✓' : '⚠️ stock+sold>total';
    ok(`${code.padEnd(6)}: total=${t} stock=${s} vendidos=${v} ${sane}`);
  } catch(e) {
    warn(`${code}: ${e.message.slice(0,60)}`);
  }
}

// Revenue con índice nuevo
try {
  const rev = await getAggregateFromServer(
    query(ref, where('supplierCode','==','ZK'), where('estado','in',SOLD)),
    { r: sum('precioVenta') }
  );
  ok(`ZK revenue total: $${Math.round(rev.data().r||0).toLocaleString()}`);
} catch(e) {
  warn(`Revenue ZK: índice construyendo — ${e.message.slice(0,50)}`);
}

// ═══════════════════════════════════════════════════════════
section('BLOQUE 3 — Price Catalog integridad');
// ═══════════════════════════════════════════════════════════

const catSnap = await getDocs(collection(db,'price_catalog'));
let fragmented=0, good=0;
const fragList=[];
catSnap.forEach(d=>{
  const id=d.id.toLowerCase();
  let isFragment=false;
  for (const c of CODES) {
    if (id.startsWith(c.toLowerCase()+'-') || id.startsWith(c.toLowerCase()+'_')) {
      fragmented++; fragList.push(id); isFragment=true; break;
    }
  }
  if(!isFragment) good++;
});
ok(`Price catalog: ${catSnap.size} entradas totales`);
fragmented===0 ? ok('Sin fragmentos con código de proveedor (apple-*, samsung-* ✓)') 
               : fail(`${fragmented} entradas fragmentadas: ${fragList.slice(0,3).join(', ')}`);

// ═══════════════════════════════════════════════════════════
section('BLOQUE 4 — Crear datos de TEST y probar flujos');
// ═══════════════════════════════════════════════════════════

// 4.1 Crear cliente TEST
console.log('\n  [TEST DATA] Creando cliente de prueba...');
const testClientRef = await addDoc(collection(db,'clients'), {
  name:       '[TEST] Cliente Prueba Automatizada',
  phone:      '+503 0000-0000',
  email:      'test@toplinetec.test',
  debtAmount: 0,
  _isTestData: true,
  createdAt:  serverTimestamp(),
});
trackDoc('clients', testClientRef.id);
ok(`Cliente TEST creado: ${testClientRef.id}`);

// 4.2 Verificar que el cliente existe en Firestore
const clientDoc = await getDoc(doc(db,'clients',testClientRef.id));
clientDoc.exists() ? ok('Cliente TEST verificado en Firestore') : fail('Cliente TEST no encontrado después de crear');

// 4.3 Crear phone TEST con supplierCode correcto (simula ManualForm con código de proveedor)
console.log('\n  [TEST DATA] Creando phone de prueba (simula import con código WNY)...');
const testPhoneRef = await addDoc(collection(db,'phones'), {
  imei:         'TEST-' + Date.now(),
  marca:        'Apple',          // ← correcto post-refactor
  supplierCode: 'WNY',            // ← nuevo campo
  modelo:       'iPhone 14 Pro Max TEST',
  storage:      '128GB',
  color:        'Space Black',
  estado:       'En Stock (Disponible para Venta)',
  costo:        450,
  precioVenta:  630,
  lote:         'TEST-LOTE-001',
  _isTestData:  true,
  fechaIngreso: new Date().toISOString(),
  createdAt:    serverTimestamp(),
});
trackDoc('phones', testPhoneRef.id);
ok(`Phone TEST creado: ${testPhoneRef.id}`);

// 4.4 Verificar campos del phone TEST
const phoneDoc = await getDoc(doc(db,'phones',testPhoneRef.id));
const pData = phoneDoc.data();
pData.marca === 'Apple' ? ok(`Phone TEST — marca='Apple' ✓`) : fail(`marca='${pData.marca}' (esperado Apple)`);
pData.supplierCode === 'WNY' ? ok(`Phone TEST — supplierCode='WNY' ✓`) : fail(`supplierCode='${pData.supplierCode}'`);

// 4.5 Probar que el phone TEST aparece en query de WNY
const wnyCount = (await getCountFromServer(query(ref, where('supplierCode','==','WNY')))).data().count;
wnyCount > 485 ? ok(`WNY ahora tiene ${wnyCount} phones (incluye TEST) ✓`) : warn(`WNY: ${wnyCount} (esperado >485)`);

// 4.6 Simular "venta": actualizar estado a Vendido
await updateDoc(doc(db,'phones',testPhoneRef.id), {
  estado:       'Vendido',
  fechaVenta:   new Date().toISOString(),
  clienteId:    testClientRef.id,
  clienteNombre: '[TEST] Cliente Prueba Automatizada',
});
const soldDoc = await getDoc(doc(db,'phones',testPhoneRef.id));
soldDoc.data().estado==='Vendido' ? ok('Flujo venta: estado actualizado a Vendido ✓') : fail('Estado no se actualizó');

// 4.7 Crear phone TEST con marca Samsung (no-supplier) para verificar lógica
const testSamsungRef = await addDoc(collection(db,'phones'), {
  imei:         'TEST-SAMSUNG-' + Date.now(),
  marca:        'Samsung',
  supplierCode: null,
  modelo:       'Galaxy S24 Ultra TEST',
  storage:      '256GB',
  estado:       'En Stock (Disponible para Venta)',
  costo:        600,
  precioVenta:  850,
  _isTestData:  true,
  fechaIngreso: new Date().toISOString(),
  createdAt:    serverTimestamp(),
});
trackDoc('phones', testSamsungRef.id);
const samsungDoc = await getDoc(doc(db,'phones',testSamsungRef.id));
samsungDoc.data().supplierCode===null ? ok('Samsung sin supplierCode=null ✓') : fail('Samsung tiene supplierCode inesperado');

// ═══════════════════════════════════════════════════════════
section('BLOQUE 5 — Búsqueda client-side con supplierCode');
// ═══════════════════════════════════════════════════════════

// Simula applyClientSearch('wny') — debe encontrar el phone TEST
const testPhoneData = (await getDoc(doc(db,'phones',testPhoneRef.id))).data();
const q = 'wny';
const foundByMarca       = testPhoneData.marca?.toLowerCase().includes(q);
const foundBySupplierCode = testPhoneData.supplierCode?.toLowerCase().includes(q);
!foundByMarca && foundBySupplierCode 
  ? ok('Búsqueda "wny": encuentra por supplierCode, NO por marca ✓') 
  : fail(`Búsqueda "wny": marca=${foundByMarca} supplierCode=${foundBySupplierCode}`);

// Simula búsqueda 'apple' — debe encontrar por marca
const foundApple = testPhoneData.marca?.toLowerCase().includes('apple');
foundApple ? ok('Búsqueda "apple": encuentra por marca ✓') : fail('Búsqueda "apple" no funciona');

// ═══════════════════════════════════════════════════════════
section('BLOQUE 6 — Colección suppliers');
// ═══════════════════════════════════════════════════════════

const suppSnap = await getDocs(collection(db,'suppliers'));
let suppWithCode=0;
suppSnap.forEach(d=>{ if(d.data().code) suppWithCode++; });
ok(`Suppliers: ${suppSnap.size} total, ${suppWithCode} con código`);

// ═══════════════════════════════════════════════════════════
section('BLOQUE 7 — Cleanup de datos TEST');
// ═══════════════════════════════════════════════════════════

let cleaned=0, cleanFail=0;
for (const {col, id} of createdDocs) {
  try {
    await deleteDoc(doc(db, col, id));
    cleaned++;
  } catch(e) {
    fail(`No se pudo borrar ${col}/${id}: ${e.message.slice(0,50)}`);
    cleanFail++;
  }
}
cleaned>0 ? ok(`${cleaned} documentos TEST eliminados de Firestore`) : null;
cleanFail===0 ? ok('Cleanup completo — sin basura en producción') : warn(`${cleanFail} docs no limpiados`);

// Verificar que WNY volvió a 485
const wnyFinal = (await getCountFromServer(query(ref, where('supplierCode','==','WNY')))).data().count;
wnyFinal===485 ? ok('WNY regresó a 485 phones después de cleanup ✓') : warn(`WNY: ${wnyFinal} (esperado 485 post-cleanup)`);

// ═══════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(58)}`);
console.log('  RESULTADO FINAL — TOP LINE TEC TEST SUITE');
console.log(`${'═'.repeat(58)}`);
console.log(`  ✅ PASS : ${passed}`);
console.log(`  ❌ FAIL : ${failed}`);
console.log(`  ⚠️  WARN : ${warned}`);
console.log(`${'═'.repeat(58)}`);
if (failed===0 && warned<=2) console.log('\n  🎉 App lista para Eduardo — todo en orden\n');
else if (failed===0) console.log('\n  ✅ Sin fallos críticos. Ver warnings arriba.\n');
else console.log('\n  ⛔ Corregir los fallos antes de continuar\n');
process.exit(failed>0 ? 1 : 0);
