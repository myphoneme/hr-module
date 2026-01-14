import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ragApi, type PromptGenerateRequest } from '../api/rag';
import type { RAGGenerateRequest } from '../types';

export const useRAG = () => {
  const queryClient = useQueryClient();

  // Training documents queries and mutations
  const documentsQuery = useQuery({
    queryKey: ['ragDocuments'],
    queryFn: ragApi.getDocuments,
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: ragApi.uploadTrainingDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ragDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['ragStats'] });
      queryClient.invalidateQueries({ queryKey: ['ragLearnedPatterns'] });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: ragApi.deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ragDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['ragStats'] });
      queryClient.invalidateQueries({ queryKey: ['ragLearnedPatterns'] });
    },
  });

  // Resume queries and mutations
  const resumesQuery = useQuery({
    queryKey: ['ragResumes'],
    queryFn: ragApi.getResumes,
  });

  const uploadResumeMutation = useMutation({
    mutationFn: ragApi.uploadResume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ragResumes'] });
      queryClient.invalidateQueries({ queryKey: ['ragStats'] });
    },
  });

  const deleteResumeMutation = useMutation({
    mutationFn: ragApi.deleteResume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ragResumes'] });
      queryClient.invalidateQueries({ queryKey: ['ragStats'] });
    },
  });

  // Generation mutation
  const generateMutation = useMutation({
    mutationFn: ragApi.generateOfferLetter,
  });

  // Quick generate mutation - one-click upload and generate
  const quickGenerateMutation = useMutation({
    mutationFn: ragApi.quickGenerate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ragResumes'] });
      queryClient.invalidateQueries({ queryKey: ['ragStats'] });
    },
  });

  // Prompt-based generation mutation
  const promptGenerateMutation = useMutation({
    mutationFn: ragApi.promptGenerate,
  });

  // Generate with template mutation
  const generateWithTemplateMutation = useMutation({
    mutationFn: ragApi.generateWithTemplate,
  });

  // Extract offer letter mutation
  const extractOfferLetterMutation = useMutation({
    mutationFn: ragApi.extractOfferLetter,
  });

  // Stats query
  const statsQuery = useQuery({
    queryKey: ['ragStats'],
    queryFn: ragApi.getStats,
  });

  // Learned patterns query
  const learnedPatternsQuery = useQuery({
    queryKey: ['ragLearnedPatterns'],
    queryFn: ragApi.getLearnedPatterns,
  });

  // Refetch document status (for polling processing documents)
  const refetchDocument = async (id: number) => {
    const document = await ragApi.getDocument(id);
    queryClient.setQueryData(['ragDocuments'], (old: any) => {
      if (!old) return old;
      return old.map((d: any) => (d.id === id ? document : d));
    });
    return document;
  };

  return {
    // Documents
    documents: documentsQuery.data || [],
    isLoadingDocuments: documentsQuery.isLoading,
    documentsError: documentsQuery.error,
    uploadDocument: (file: File) => uploadDocumentMutation.mutateAsync(file),
    deleteDocument: (id: number) => deleteDocumentMutation.mutateAsync(id),
    isUploadingDocument: uploadDocumentMutation.isPending,
    isDeletingDocument: deleteDocumentMutation.isPending,
    refetchDocuments: documentsQuery.refetch,
    refetchDocument,

    // Resumes
    resumes: resumesQuery.data || [],
    isLoadingResumes: resumesQuery.isLoading,
    resumesError: resumesQuery.error,
    uploadResume: (file: File) => uploadResumeMutation.mutateAsync(file),
    deleteResume: (id: number) => deleteResumeMutation.mutateAsync(id),
    isUploadingResume: uploadResumeMutation.isPending,
    isDeletingResume: deleteResumeMutation.isPending,
    refetchResumes: resumesQuery.refetch,

    // Generation
    generateOfferLetter: (request: RAGGenerateRequest) => generateMutation.mutateAsync(request),
    isGenerating: generateMutation.isPending,
    generatedData: generateMutation.data,
    generationError: generateMutation.error,
    resetGeneration: generateMutation.reset,

    // Quick Generate (one-click)
    quickGenerate: (file: File) => quickGenerateMutation.mutateAsync(file),
    isQuickGenerating: quickGenerateMutation.isPending,
    quickGeneratedData: quickGenerateMutation.data,
    quickGenerationError: quickGenerateMutation.error,
    resetQuickGeneration: quickGenerateMutation.reset,

    // Prompt Generate (HR describes in plain English)
    promptGenerate: (request: PromptGenerateRequest) => promptGenerateMutation.mutateAsync(request),
    isPromptGenerating: promptGenerateMutation.isPending,
    promptGeneratedData: promptGenerateMutation.data,
    promptGenerationError: promptGenerateMutation.error,
    resetPromptGeneration: promptGenerateMutation.reset,

    // Generate with Template
    generateWithTemplate: (request: any) => generateWithTemplateMutation.mutateAsync(request),
    isGeneratingWithTemplate: generateWithTemplateMutation.isPending,
    generatedWithTemplateData: generateWithTemplateMutation.data,
    generateWithTemplateError: generateWithTemplateMutation.error,
    resetGenerateWithTemplate: generateWithTemplateMutation.reset,

    // Extract Offer Letter
    extractOfferLetter: (file: File) => extractOfferLetterMutation.mutateAsync(file),
    isExtracting: extractOfferLetterMutation.isPending,
    extractedData: extractOfferLetterMutation.data,
    extractionError: extractOfferLetterMutation.error,
    resetExtraction: extractOfferLetterMutation.reset,

    // Learned Patterns
    learnedPatterns: learnedPatternsQuery.data,
    isLoadingLearnedPatterns: learnedPatternsQuery.isLoading,
    refetchLearnedPatterns: learnedPatternsQuery.refetch,

    // Stats
    stats: statsQuery.data,
    isLoadingStats: statsQuery.isLoading,
    refetchStats: statsQuery.refetch,
  };
};

// Hook for getting a single resume with details
export const useResumeDetails = (id: number | null) => {
  return useQuery({
    queryKey: ['ragResume', id],
    queryFn: () => (id ? ragApi.getResume(id) : Promise.resolve(null)),
    enabled: !!id,
  });
};
