import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getLetterheads,
  getLetterhead,
  getLetterheadWithImages,
  getDefaultLetterhead,
  createLetterhead,
  updateLetterhead,
  deleteLetterhead,
  setDefaultLetterhead,
  type Letterhead,
  type LetterheadWithImages,
  type CreateLetterheadInput,
  type UpdateLetterheadInput,
} from '../api/letterheads';

const LETTERHEADS_KEY = ['letterheads'];

export function useLetterheads() {
  const queryClient = useQueryClient();

  // Get all letterheads
  const {
    data: letterheads = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: LETTERHEADS_KEY,
    queryFn: getLetterheads,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createLetterhead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LETTERHEADS_KEY });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateLetterheadInput }) =>
      updateLetterhead(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LETTERHEADS_KEY });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteLetterhead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LETTERHEADS_KEY });
    },
  });

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: setDefaultLetterhead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LETTERHEADS_KEY });
    },
  });

  return {
    letterheads,
    isLoading,
    error,
    refetch,
    createLetterhead: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateLetterhead: (id: number, input: UpdateLetterheadInput) =>
      updateMutation.mutateAsync({ id, input }),
    isUpdating: updateMutation.isPending,
    deleteLetterhead: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    setDefaultLetterhead: setDefaultMutation.mutateAsync,
    isSettingDefault: setDefaultMutation.isPending,
  };
}

// Hook for getting a single letterhead
export function useLetterhead(id: number | null) {
  return useQuery({
    queryKey: [...LETTERHEADS_KEY, id],
    queryFn: () => getLetterhead(id!),
    enabled: id !== null,
  });
}

// Hook for getting letterhead with base64 images (for PDF)
export function useLetterheadWithImages(id: number | null) {
  return useQuery({
    queryKey: [...LETTERHEADS_KEY, id, 'images'],
    queryFn: () => getLetterheadWithImages(id!),
    enabled: id !== null,
  });
}

// Hook for getting the default letterhead
export function useDefaultLetterhead() {
  return useQuery({
    queryKey: [...LETTERHEADS_KEY, 'default'],
    queryFn: getDefaultLetterhead,
  });
}
