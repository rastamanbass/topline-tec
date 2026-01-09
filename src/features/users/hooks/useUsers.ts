import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    collection,
    getDocs,
    doc,
    deleteDoc,
    setDoc,
    query,
    where,
    orderBy,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { User, UserRole } from '../../../context/AuthContext';
import toast from 'react-hot-toast';

export function useUsers() {
    return useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const snapshot = await getDocs(collection(db, 'users'));
            return snapshot.docs.map((doc) => ({
                uid: doc.id,
                ...doc.data(),
                // Map Firestore fields to User interface
                email: doc.data().email || '',
                displayName: doc.data().name || '',
                role: doc.data().role,
            })) as User[];
        },
    });
}

export function useBuyerUsers() {
    return useQuery({
        queryKey: ['buyerUsers'],
        queryFn: async () => {
            const q = query(
                collection(db, 'users'),
                where('role', '==', 'comprador'),
                orderBy('email', 'asc')
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data(),
                email: doc.data().email || '',
                displayName: doc.data().name || doc.data().displayName || '',
                role: doc.data().role,
                clientId: doc.data().clientId,
                isActive: doc.data().isActive !== false,
            })) as User[];
        },
    });
}

export function useUpdateUserRole() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ uid, role }: { uid: string; role: UserRole }) => {
            const userRef = doc(db, 'users', uid);
            // We use setDoc with merge: true to ensure document exists if it was just created in Auth but not Firestore
            await setDoc(userRef, { role }, { merge: true });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Rol de usuario actualizado');
        },
        onError: (error: Error) => {
            console.error('Update role error:', error);
            toast.error('Error al actualizar rol');
        },
    });
}

// Note: Deleting a user from Firestore does not delete them from Firebase Auth (requires Admin SDK).
// This hook only removes their data record.
export function useDeleteUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (uid: string) => {
            await deleteDoc(doc(db, 'users', uid));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Usuario eliminado de la base de datos');
        },
    });
}
