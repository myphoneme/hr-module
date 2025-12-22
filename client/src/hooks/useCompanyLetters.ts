import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companyLettersApi } from '../api/companyLetters';
import type { CreateCompanyLetterInput, UpdateCompanyLetterInput } from '../types';

export const useCompanyLetters = () => {
  return useQuery({
    queryKey: ['company-letters'],
    queryFn: companyLettersApi.getAll,
  });
};

export const useCompanyLetter = (id: number) => {
  return useQuery({
    queryKey: ['company-letters', id],
    queryFn: () => companyLettersApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateCompanyLetter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCompanyLetterInput) => companyLettersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-letters'] });
    },
  });
};

export const useUpdateCompanyLetter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCompanyLetterInput }) =>
      companyLettersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-letters'] });
    },
  });
};

export const useDeleteCompanyLetter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => companyLettersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-letters'] });
    },
  });
};

export const useAddSignatory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      letterId,
      signatoryId,
      order,
    }: {
      letterId: number;
      signatoryId: number;
      order: number;
    }) => companyLettersApi.addSignatory(letterId, signatoryId, order),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['company-letters'] });
      queryClient.invalidateQueries({ queryKey: ['company-letters', variables.letterId] });
    },
  });
};

export const useRemoveSignatory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ letterId, signatoryId }: { letterId: number; signatoryId: number }) =>
      companyLettersApi.removeSignatory(letterId, signatoryId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['company-letters'] });
      queryClient.invalidateQueries({ queryKey: ['company-letters', variables.letterId] });
    },
  });
};
