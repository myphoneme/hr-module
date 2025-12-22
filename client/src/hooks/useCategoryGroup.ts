import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoryGroupApi } from '../api/categoryGroup';
import type { CreateCategoryGroupInput, UpdateCategoryGroupInput } from '../types';

export const useCategoryGroups = () => {
  return useQuery({
    queryKey: ['category-groups'],
    queryFn: categoryGroupApi.getAll,
  });
};

export const useCategoryGroup = (id: number) => {
  return useQuery({
    queryKey: ['category-groups', id],
    queryFn: () => categoryGroupApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateCategoryGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCategoryGroupInput) => categoryGroupApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-groups'] });
    },
  });
};

export const useUpdateCategoryGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCategoryGroupInput }) =>
      categoryGroupApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-groups'] });
    },
  });
};

export const useDeleteCategoryGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => categoryGroupApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-groups'] });
    },
  });
};
