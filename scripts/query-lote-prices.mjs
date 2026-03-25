import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyBgAt0AO5iBb_Ah5Vd0GaUwdazyeJ0MCg8',
  authDomain: 'inventario-a6aa3.firebaseapp.com',
  projectId: 'inventario-a6aa3'
});

const auth = getAuth(app);
const db = getFirestore(app);

const creds = await signInWithEmailAndPassword(auth, 'danielabrego95@gmail.com', 'Loquito420');
const q = query(collection(db, 'phones'), where('lote', '==', 'ENVIO 2 MARZO AMERIJET'));
const snap = await getDocs(q);

const phones = [];
snap.forEach(doc => {
  const d = doc.data();
  phones.push({
    modelo: d.modelo || '',
    marca: d.marca || '',
    storage: d.storage || '',
    precioVenta: d.precioVenta || 0,
    costo: d.costo || 0,
    condition: d.condition || ''
  });
});

// Group by model+storage
const groups = {};
phones.forEach(p => {
  const key = `${p.marca} ${p.modelo} ${p.storage}`;
  if (!groups[key]) {
    groups[key] = { count: 0, precioVenta: p.precioVenta, costo: p.costo, condition: p.condition };
  }
  groups[key].count++;
});

console.log('Total phones:', phones.length);
console.log('---');
Object.keys(groups).sort().forEach(k => {
  const g = groups[k];
  console.log(`${k} | Qty: ${g.count} | PrecioVenta: $${g.precioVenta} | Costo: $${g.costo} | Cond: ${g.condition}`);
});

process.exit(0);
