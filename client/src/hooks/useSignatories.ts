import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { signatoriesApi } from '../api/signatories';
import type { CreateSignatoryInput, UpdateSignatoryInput } from '../types';

export const useSignatories = () => {
  return useQuery({
    queryKey: ['signatories'],
    queryFn: signatoriesApi.getAll,
  });
};

export const useSignatory = (id: number) => {
  return useQuery({
    queryKey: ['signatories', id],
    queryFn: () => signatoriesApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateSignatory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSignatoryInput) => signatoriesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signatories'] });
    },
  });
};

export const useUpdateSignatory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateSignatoryInput }) =>
      signatoriesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signatories'] });
    },
  });
};

export const useDeleteSignatory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => signatoriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signatories'] });
    },
  });
};
