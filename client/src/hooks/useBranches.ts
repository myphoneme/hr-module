import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { branchesApi } from '../api/branches';
import type { CreateBranchInput, UpdateBranchInput } from '../types';

export const useBranches = () => {
  return useQuery({
    queryKey: ['branches'],
    queryFn: branchesApi.getAll,
  });
};

export const useBranchesByCompany = (companyId: number) => {
  return useQuery({
    queryKey: ['branches', 'company', companyId],
    queryFn: () => branchesApi.getByCompany(companyId),
    enabled: !!companyId,
  });
};

export const useBranch = (id: number) => {
  return useQuery({
    queryKey: ['branches', id],
    queryFn: () => branchesApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBranchInput) => branchesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
};

export const useUpdateBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateBranchInput }) =>
      branchesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
};

export const useDeleteBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => branchesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
};
