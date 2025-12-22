import { api } from './client';
import type { Branch, BranchWithCompany, CreateBranchInput, UpdateBranchInput } from '../types';

export const branchesApi = {
  getAll: () => api.get<BranchWithCompany[]>('/branches'),

  getByCompany: (companyId: number) => api.get<Branch[]>(`/branches/company/${companyId}`),

  getById: (id: number) => api.get<BranchWithCompany>(`/branches/${id}`),

  create: (data: CreateBranchInput) => api.post<BranchWithCompany>('/branches', data),

  update: (id: number, data: UpdateBranchInput) =>
    api.put<BranchWithCompany>(`/branches/${id}`, data),

  delete: (id: number) => api.delete(`/branches/${id}`),
};
