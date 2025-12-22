import { api } from './client';
import type { EmployeeWithBranch, CreateEmployeeInput, UpdateEmployeeInput } from '../types';

// Helper to convert input to FormData for file uploads
const createFormData = (data: CreateEmployeeInput | UpdateEmployeeInput): FormData => {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (value instanceof File) {
        formData.append(key, value);
      } else {
        formData.append(key, String(value));
      }
    }
  });

  return formData;
};

export const employeesApi = {
  getAll: () => api.get<EmployeeWithBranch[]>('/employees'),

  getById: (id: number) => api.get<EmployeeWithBranch>(`/employees/${id}`),

  create: async (data: CreateEmployeeInput): Promise<EmployeeWithBranch> => {
    const formData = createFormData(data);
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/employees`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create employee');
    }

    return response.json();
  },

  update: async (id: number, data: UpdateEmployeeInput): Promise<EmployeeWithBranch> => {
    const formData = createFormData(data);
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/employees/${id}`, {
      method: 'PUT',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update employee');
    }

    return response.json();
  },

  delete: (id: number) => api.delete(`/employees/${id}`),

  getFileUrl: (filename: string) =>
    `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/employees/files/${filename}`,
};
