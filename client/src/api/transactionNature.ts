import { api } from './client';
import type { TransactionNature, CreateTransactionNatureInput, UpdateTransactionNatureInput } from '../types';

export const transactionNatureApi = {
  getAll: () => api.get<TransactionNature[]>('/transaction-nature'),

  getById: (id: number) => api.get<TransactionNature>(`/transaction-nature/${id}`),

  create: (data: CreateTransactionNatureInput) => api.post<TransactionNature>('/transaction-nature', data),

  update: (id: number, data: UpdateTransactionNatureInput) =>
    api.put<TransactionNature>(`/transaction-nature/${id}`, data),

  delete: (id: number) => api.delete(`/transaction-nature/${id}`),
};
