import { collection, writeBatch, doc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { v4 as uuidv4 } from 'uuid';

const BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'Motorola'];
const MODELS = {
    Apple: ['iPhone 13', 'iPhone 13 Pro', 'iPhone 14', 'iPhone 14 Pro Max', 'iPhone 15', 'iPhone 15 Pro'],
    Samsung: ['Galaxy S23', 'Galaxy S23 Ultra', 'Galaxy S24', 'Galaxy A54', 'Galaxy Z Flip5'],
    Xiaomi: ['Redmi Note 12', 'POCO X5 Pro', 'Xiaomi 13T'],
    Motorola: ['Moto G84', 'Edge 40 Neo']
};

const RANDOM_PRICES = [200, 350, 500, 750, 900, 1100, 1250];

export const seedDatabase = async () => {
    const batch = writeBatch(db);
    const count = 50; // Generate 50 phones

    for (let i = 0; i < count; i++) {
        const brand = BRANDS[Math.floor(Math.random() * BRANDS.length)];
        // @ts-expect-error - Dynamic brand key access
        const model = MODELS[brand][Math.floor(Math.random() * MODELS[brand].length)];
        const price = RANDOM_PRICES[Math.floor(Math.random() * RANDOM_PRICES.length)];

        const id = uuidv4();
        const phoneRef = doc(db, 'phones', id);

        batch.set(phoneRef, {
            imei: `35${Math.floor(Math.random() * 1000000000000)}`,
            marca: brand,
            modelo: model,
            precioVenta: price,
            costo: price * 0.8, // 20% margin
            estado: 'En Stock (Disponible para Venta)',
            condition: ['New', 'Open Box', 'Grade A', 'Grade B', 'Grade C'][Math.floor(Math.random() * 5)],
            lote: 'Lote-Demo-2026',
            fechaIngreso: new Date(),
            updatedAt: new Date(),
            specs: {
                storage: '128GB',
                ram: '8GB',
                color: ['Black', 'White', 'Blue', 'Gold'][Math.floor(Math.random() * 4)]
            }
        });
    }

    await batch.commit();
    console.log(`Seeded ${count} phones!`);
};

export const randomizeConditions = async () => {
    const phonesRef = collection(db, 'phones');
    const snapshot = await getDocs(phonesRef);
    const batch = writeBatch(db);

    let count = 0;
    snapshot.docs.forEach((doc) => {
        const randomCondition = ['New', 'Open Box', 'Grade A', 'Grade B', 'Grade C'][Math.floor(Math.random() * 5)];
        batch.update(doc.ref, { condition: randomCondition });
        count++;
    });

    await batch.commit();
    console.log(`Updated ${count} phones with random conditions!`);
};
