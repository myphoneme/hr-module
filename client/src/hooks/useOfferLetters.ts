import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { offerLettersApi } from '../api/offerLetters';
import type { CreateOfferLetterInput, UpdateOfferLetterInput } from '../types';

export const useOfferLetters = () => {
  const queryClient = useQueryClient();

  const offerLettersQuery = useQuery({
    queryKey: ['offerLetters'],
    queryFn: offerLettersApi.getAll,
  });

  const createOfferLetterMutation = useMutation({
    mutationFn: offerLettersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerLetters'] });
    },
  });

  const updateOfferLetterMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateOfferLetterInput }) =>
      offerLettersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerLetters'] });
    },
  });

  const deleteOfferLetterMutation = useMutation({
    mutationFn: offerLettersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerLetters'] });
    },
  });

  const generateOfferLetterMutation = useMutation({
    mutationFn: offerLettersApi.generate,
  });

  return {
    offerLetters: offerLettersQuery.data || [],
    isLoading: offerLettersQuery.isLoading,
    error: offerLettersQuery.error,
    createOfferLetter: (data: CreateOfferLetterInput) => createOfferLetterMutation.mutateAsync(data),
    updateOfferLetter: (id: number, data: UpdateOfferLetterInput) =>
      updateOfferLetterMutation.mutateAsync({ id, data }),
    deleteOfferLetter: (id: number) => deleteOfferLetterMutation.mutateAsync(id),
    generateOfferLetter: (id: number) => generateOfferLetterMutation.mutateAsync(id),
    isCreating: createOfferLetterMutation.isPending,
    isUpdating: updateOfferLetterMutation.isPending,
    isDeleting: deleteOfferLetterMutation.isPending,
    isGenerating: generateOfferLetterMutation.isPending,
    generatedContent: generateOfferLetterMutation.data,
  };
};
