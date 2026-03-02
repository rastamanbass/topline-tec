import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase';

interface CreateUserData {
  email: string;
  displayName: string;
  phone: string;
  company?: string;
  role?: string;
}

interface CreateUserResult {
  uid: string;
  clientId: string | null;
  temporaryPassword: string;
}

export const createBuyerUser = async (data: CreateUserData): Promise<CreateUserResult> => {
  const createUserAccount = httpsCallable<CreateUserData, CreateUserResult>(
    functions,
    'createUserAccount'
  );
  const result = await createUserAccount(data);
  return result.data;
};
