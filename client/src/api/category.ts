import { api } from './client';
import type { CategoryWithDetails, CreateCategoryInput, UpdateCategoryInput } from '../types';

export const categoryApi = {
  getAll: () => api.get<CategoryWithDetails[]>('/category'),

  getById: (id: number) => api.get<CategoryWithDetails>(`/category/${id}`),

  create: (data: CreateCategoryInput) => api.post<CategoryWithDetails>('/category', data),

  update: (id: number, data: UpdateCategoryInput) =>
    api.put<CategoryWithDetails>(`/category/${id}`, data),

  delete: (id: number) => api.delete(`/category/${id}`),
};
