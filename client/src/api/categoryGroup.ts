import { api } from './client';
import type { CategoryGroupWithTransactionNature, CreateCategoryGroupInput, UpdateCategoryGroupInput } from '../types';

export const categoryGroupApi = {
  getAll: () => api.get<CategoryGroupWithTransactionNature[]>('/category-group'),

  getById: (id: number) => api.get<CategoryGroupWithTransactionNature>(`/category-group/${id}`),

  create: (data: CreateCategoryGroupInput) => api.post<CategoryGroupWithTransactionNature>('/category-group', data),

  update: (id: number, data: UpdateCategoryGroupInput) =>
    api.put<CategoryGroupWithTransactionNature>(`/category-group/${id}`, data),

  delete: (id: number) => api.delete(`/category-group/${id}`),
};
