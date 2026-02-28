import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { v4 as uuidv4 } from 'uuid';

export const createBuyerUser = async (data: {
  email: string;
  displayName: string;
  phone: string;
  company?: string;
}) => {
  try {
    // Generar UID temporal (en producción, Firebase Auth lo generaría)
    const uid = uuidv4();

    // 1. Crear Client primero
    const clientRef = await addDoc(collection(db, 'clients'), {
      name: data.displayName,
      email: data.email,
      phone: data.phone,
      company: data.company || null,
      creditAmount: 0,
      debtAmount: 0,
      isWorkshopAccount: false,
      userId: uid,
      isActive: true,
      createdAt: serverTimestamp(),
    });

    // 2. Crear User profile
    await setDoc(doc(db, 'users', uid), {
      uid,
      email: data.email,
      displayName: data.displayName,
      role: 'comprador',
      clientId: clientRef.id,
      isActive: true,
      createdAt: serverTimestamp(),
    });

    return {
      uid,
      clientId: clientRef.id,
      temporaryPassword: 'TopLine2024!', // Contraseña temporal fija por ahora
    };
  } catch (error: unknown) {
    console.error('Error creating buyer user:', error);
    throw new Error((error as Error).message || 'Error al crear usuario');
  }
};
