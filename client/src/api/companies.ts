import { api } from './client';
import type { CompanyWithBranches, CreateCompanyInput, UpdateCompanyInput } from '../types';

export const companiesApi = {
  getAll: () => api.get<CompanyWithBranches[]>('/companies'),

  getById: (id: number) => api.get<CompanyWithBranches>(`/companies/${id}`),

  create: (data: CreateCompanyInput) => api.post<CompanyWithBranches>('/companies', data),

  update: (id: number, data: UpdateCompanyInput) =>
    api.put<CompanyWithBranches>(`/companies/${id}`, data),

  delete: (id: number) => api.delete(`/companies/${id}`),
};
