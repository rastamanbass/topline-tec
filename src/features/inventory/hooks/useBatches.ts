import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBatches, createBatch, deleteBatch } from '../services/batchService';
import toast from 'react-hot-toast';

export function useBatches() {
  const queryClient = useQueryClient();

  const {
    data: batches = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['batches'],
    queryFn: getBatches,
  });

  const addBatch = useMutation({
    mutationFn: createBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast.success('Lote creado exitosamente');
    },
    onError: (error) => {
      console.error('Error creating batch:', error);
      toast.error('Error al crear el lote');
    },
  });

  const removeBatch = useMutation({
    mutationFn: deleteBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast.success('Lote eliminado');
    },
    onError: (error) => {
      console.error('Error deleting batch:', error);
      toast.error('Error al eliminar el lote');
    },
  });

  return {
    batches,
    isLoading,
    error,
    addBatch,
    removeBatch,
  };
}
