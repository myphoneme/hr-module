import { api } from './client';
import type { VendorWithDetails, CreateVendorInput, UpdateVendorInput } from '../types';

export const vendorsApi = {
  getAll: () => api.get<VendorWithDetails[]>('/vendors'),

  getById: (id: number) => api.get<VendorWithDetails>(`/vendors/${id}`),

  create: (data: CreateVendorInput) => api.post<VendorWithDetails>('/vendors', data),

  update: (id: number, data: UpdateVendorInput) =>
    api.put<VendorWithDetails>(`/vendors/${id}`, data),

  delete: (id: number) => api.delete(`/vendors/${id}`),
};
