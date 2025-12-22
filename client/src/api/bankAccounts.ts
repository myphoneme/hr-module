import { api } from './client';
import type { BankAccountWithBranch, BankAccount, CreateBankAccountInput, UpdateBankAccountInput, BankAccountType } from '../types';

export const bankAccountsApi = {
  getAll: () => api.get<BankAccountWithBranch[]>('/bank-accounts'),

  getByType: (type: BankAccountType) => api.get<BankAccountWithBranch[]>(`/bank-accounts/type/${type}`),

  getByBranch: (branchId: number) => api.get<BankAccount[]>(`/bank-accounts/branch/${branchId}`),

  getById: (id: number) => api.get<BankAccountWithBranch>(`/bank-accounts/${id}`),

  create: (data: CreateBankAccountInput) => api.post<BankAccountWithBranch>('/bank-accounts', data),

  update: (id: number, data: UpdateBankAccountInput) =>
    api.put<BankAccountWithBranch>(`/bank-accounts/${id}`, data),

  delete: (id: number) => api.delete(`/bank-accounts/${id}`),
};
