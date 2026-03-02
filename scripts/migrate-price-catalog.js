/**
 * Migra entradas fragmentadas de price_catalog.
 * Entradas como "ang-iphone-14-128gb" → "apple-iphone-14-128gb"
 * Si ya existe el destino, promedia los precios.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const app = initializeApp({ apiKey:'AIzaSyBgAt0AO5iBb_Ah5Vd0GaUwdazyeJ0MCg8', authDomain:'inventario-a6aa3.firebaseapp.com', projectId:'inventario-a6aa3' });
await signInWithEmailAndPassword(getAuth(app), 'danielabrego95@gmail.com', 'Loquito420');
const db = getFirestore(app);

const CODES = ['wny','xt','zk','hec','trad','lz','inq','rub','ang','ange','ws','eb','trade','orca','rec','b','xtra','rb','he','oh','offe','jes'];

const snap = await getDocs(collection(db,'price_catalog'));
console.log(`Total entradas: ${snap.size}`);

let migrated=0, merged=0, skipped=0, errors=0;

for (const d of snap.docs) {
  const id   = d.id.toLowerCase();
  const data = d.data();

  // Detectar si el id empieza con un código de proveedor
  const matchingCode = CODES.find(c => id.startsWith(c+'-') || id.startsWith(c+'_'));
  if (!matchingCode) { skipped++; continue; }

  // Construir nuevo id reemplazando el código por "apple"
  const newId = 'apple' + id.slice(matchingCode.length);

  if (newId === id) { skipped++; continue; }

  try {
    const existingDoc = await getDoc(doc(db,'price_catalog',newId));

    if (existingDoc.exists()) {
      // Merge: promediar averagePrice
      const existData = existingDoc.data();
      const avgPrice  = Math.round((data.averagePrice + existData.averagePrice) / 2);
      const lastUpdated = (data.lastUpdated?.toMillis?.() ?? 0) > (existData.lastUpdated?.toMillis?.() ?? 0)
        ? data.lastUpdated : existData.lastUpdated;

      await setDoc(doc(db,'price_catalog',newId), {
        ...existData,
        averagePrice: avgPrice,
        lastUpdated,
        brand: 'Apple',
      });
      await deleteDoc(doc(db,'price_catalog',d.id));
      merged++;
      console.log(`  MERGE: ${d.id} → ${newId} (avg $${avgPrice})`);
    } else {
      // Copy con nueva clave
      await setDoc(doc(db,'price_catalog',newId), { ...data, brand: 'Apple' });
      await deleteDoc(doc(db,'price_catalog',d.id));
      migrated++;
      console.log(`  MIGR : ${d.id} → ${newId}`);
    }
  } catch(e) {
    console.error(`  ERR  : ${d.id} → ${e.message.slice(0,60)}`);
    errors++;
  }
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Migradas (rename): ${migrated}`);
console.log(`Mergeadas (dup):   ${merged}`);
console.log(`Skipped (ok):      ${skipped}`);
console.log(`Errores:           ${errors}`);
console.log(`${'='.repeat(50)}\n`);
process.exit(errors > 0 ? 1 : 0);
