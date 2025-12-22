import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bankAccountsApi } from '../api/bankAccounts';
import type { CreateBankAccountInput, UpdateBankAccountInput, BankAccountType } from '../types';

export const useBankAccounts = () => {
  return useQuery({
    queryKey: ['bankAccounts'],
    queryFn: bankAccountsApi.getAll,
  });
};

export const useBankAccountsByType = (type: BankAccountType) => {
  return useQuery({
    queryKey: ['bankAccounts', 'type', type],
    queryFn: () => bankAccountsApi.getByType(type),
  });
};

export const useBankAccountsByBranch = (branchId: number) => {
  return useQuery({
    queryKey: ['bankAccounts', 'branch', branchId],
    queryFn: () => bankAccountsApi.getByBranch(branchId),
    enabled: !!branchId,
  });
};

export const useBankAccount = (id: number) => {
  return useQuery({
    queryKey: ['bankAccounts', id],
    queryFn: () => bankAccountsApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateBankAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBankAccountInput) => bankAccountsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
    },
  });
};

export const useUpdateBankAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateBankAccountInput }) =>
      bankAccountsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
    },
  });
};

export const useDeleteBankAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => bankAccountsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
    },
  });
};
