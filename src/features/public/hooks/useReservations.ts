import { useState, useEffect } from 'react';
import { reservationService, getSessionId } from '../services/reservationService';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context';

export function useReservations() {
  const { user } = useAuth(); // Get authenticated user
  const [sessionId, setSessionId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null); // PhoneID being processed

  useEffect(() => {
    if (user) {
      setSessionId(user.uid);
    } else {
      setSessionId(getSessionId());
    }
  }, [user]);

  const toggleReservation = async (phoneId: string, isCurrentlyReservedByMe: boolean) => {
    if (isProcessing) return;
    setIsProcessing(phoneId);

    try {
      if (isCurrentlyReservedByMe) {
        // Release
        await reservationService.releasePhone(phoneId, sessionId);
        toast.success('Liberado');
      } else {
        // Reserve
        await reservationService.reservePhone(phoneId, sessionId);
        toast.success('¡Apartado!');
      }
    } catch (error: unknown) {
      toast.error((error as Error).message || 'Error al procesar reserva');
    } finally {
      setIsProcessing(null);
    }
  };

  return {
    sessionId,
    isProcessing,
    toggleReservation,
  };
}
