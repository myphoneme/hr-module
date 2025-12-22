import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionNatureApi } from '../api/transactionNature';
import type { CreateTransactionNatureInput, UpdateTransactionNatureInput } from '../types';

export const useTransactionNatures = () => {
  return useQuery({
    queryKey: ['transaction-natures'],
    queryFn: transactionNatureApi.getAll,
  });
};

export const useTransactionNature = (id: number) => {
  return useQuery({
    queryKey: ['transaction-natures', id],
    queryFn: () => transactionNatureApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateTransactionNature = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTransactionNatureInput) => transactionNatureApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-natures'] });
    },
  });
};

export const useUpdateTransactionNature = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTransactionNatureInput }) =>
      transactionNatureApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-natures'] });
    },
  });
};

export const useDeleteTransactionNature = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => transactionNatureApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-natures'] });
    },
  });
};
