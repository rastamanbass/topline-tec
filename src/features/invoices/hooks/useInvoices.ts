import { useQuery } from '@tanstack/react-query';
import { getInvoice } from '../../../services/firebase/invoiceService';

export function useInvoice(invoiceId: string | null) {
  return useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => (invoiceId ? getInvoice(invoiceId) : null),
    enabled: !!invoiceId,
  });
}
