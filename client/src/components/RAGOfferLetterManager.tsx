import { useState, useEffect } from 'react';
import { useRAG, useResumeDetails } from '../hooks/useRAG';
import { useOfferLetters } from '../hooks/useOfferLetters';
import { useSignatories } from '../hooks/useSignatories';
import type { RAGDocument, ResumeExtraction, RAGGenerateRequest, CreateOfferLetterInput, Signatory } from '../types';
import type { QuickGenerateResponse, LearnedPattern, SalaryBenchmark } from '../api/rag';

type TabType = 'quick' | 'training' | 'generate' | 'patterns';

interface RAGOfferLetterManagerProps {
  onBack?: () => void;
}

export default function RAGOfferLetterManager({ onBack }: RAGOfferLetterManagerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('quick');
  const {
    documents,
    isLoadingDocuments,
    uploadDocument,
    deleteDocument,
    isUploadingDocument,
    refetchDocuments,
    resumes,
    isLoadingResumes,
    uploadResume,
    deleteResume,
    isUploadingResume,
    generateOfferLetter,
    isGenerating,
    generatedData,
    resetGeneration,
    quickGenerate,
    isQuickGenerating,
    quickGeneratedData,
    resetQuickGeneration,
    learnedPatterns,
    isLoadingLearnedPatterns,
    stats,
    isLoadingStats,
    refetchStats,
  } = useRAG();

  const { createOfferLetter, isCreating } = useOfferLetters();
  const { signatories } = useSignatories();

  // Polling for processing documents
  useEffect(() => {
    const processingDocs = documents.filter(d => d.status === 'processing' || d.status === 'pending');
    if (processingDocs.length > 0) {
      const interval = setInterval(() => {
        refetchDocuments();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [documents, refetchDocuments]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Offer Letter Generator</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Generate offer letters from resumes using AI</p>
              </div>
            </div>

            {/* Stats */}
            {stats && (
              <div className="flex gap-3 text-sm">
                <div className="bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg">
                  <span className="text-blue-700 dark:text-blue-300 font-medium">{stats.training.completed}</span>
                  <span className="text-blue-600 dark:text-blue-400"> Docs</span>
                </div>
                <div className="bg-green-50 dark:bg-green-900/30 px-3 py-2 rounded-lg">
                  <span className="text-green-700 dark:text-green-300 font-medium">{(stats as any).learning?.patternsLearned || 0}</span>
                  <span className="text-green-600 dark:text-green-400"> Patterns</span>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/30 px-3 py-2 rounded-lg">
                  <span className="text-purple-700 dark:text-purple-300 font-medium">{(stats as any).learning?.salaryBenchmarks || 0}</span>
                  <span className="text-purple-600 dark:text-purple-400"> Benchmarks</span>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('quick')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === 'quick'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Quick Generate
            </button>
            <button
              onClick={() => setActiveTab('training')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === 'training'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Training Documents
            </button>
            <button
              onClick={() => setActiveTab('patterns')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === 'patterns'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Learned Patterns
            </button>
            <button
              onClick={() => setActiveTab('generate')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === 'generate'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Advanced Generate
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'quick' && (
          <QuickGeneratePanel
            onQuickGenerate={quickGenerate}
            isGenerating={isQuickGenerating}
            generatedData={quickGeneratedData}
            onReset={resetQuickGeneration}
            onCreateOfferLetter={createOfferLetter}
            isCreating={isCreating}
            trainingDocsCount={stats?.training.completed || 0}
          />
        )}

        {activeTab === 'training' && (
          <TrainingPanel
            documents={documents}
            isLoading={isLoadingDocuments}
            onUpload={uploadDocument}
            onDelete={deleteDocument}
            isUploading={isUploadingDocument}
          />
        )}

        {activeTab === 'patterns' && (
          <PatternsPanel
            learnedPatterns={learnedPatterns}
            isLoading={isLoadingLearnedPatterns}
          />
        )}

        {activeTab === 'generate' && (
          <GeneratePanel
            resumes={resumes}
            isLoadingResumes={isLoadingResumes}
            onUploadResume={uploadResume}
            onDeleteResume={deleteResume}
            isUploadingResume={isUploadingResume}
            signatories={signatories || []}
            onGenerate={generateOfferLetter}
            isGenerating={isGenerating}
            generatedData={generatedData}
            onResetGeneration={resetGeneration}
            onCreateOfferLetter={createOfferLetter}
            isCreatingOfferLetter={isCreating}
            trainingDocsCount={stats?.training.completed || 0}
          />
        )}
      </div>
    </div>
  );
}

// Quick Generate Panel - Chat-style prompt to generate offer letter
interface QuickGeneratePanelProps {
  onQuickGenerate: (file: File) => Promise<QuickGenerateResponse>;
  isGenerating: boolean;
  generatedData: QuickGenerateResponse | undefined;
  onReset: () => void;
  onCreateOfferLetter: (data: CreateOfferLetterInput) => Promise<any>;
  isCreating: boolean;
  trainingDocsCount: number;
}

interface SalaryBreakdownItem {
  component: string;
  perMonth: number;
  annual: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function QuickGeneratePanel({
  onQuickGenerate,
  isGenerating,
  generatedData,
  onReset,
  onCreateOfferLetter,
  isCreating,
  trainingDocsCount,
}: QuickGeneratePanelProps) {
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<CreateOfferLetterInput | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Welcome! I'm your AI Offer Letter Generator.

**How to use:**
Tell me the candidate details in plain English

**Example prompts:**
- "Rahul Sharma, Software Developer, 6 LPA, joining 15th Jan 2025"
- "Priya Singh as Marketing Manager, salary 8 lakhs per annum, DOJ 1st Feb"
- "Create offer for Amit Kumar, HR Executive, CTC 4.5 LPA, joining 20th January"

I'll generate a professional offer letter using our company template automatically.`
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize edited data when generation completes
  useEffect(() => {
    if (generatedData?.offer_letter?.offer_letter_data) {
      setEditedData({ ...generatedData.offer_letter.offer_letter_data });
      setIsEditing(false);
    }
  }, [generatedData]);

  // Parse prompt to extract candidate details
  const parsePrompt = (text: string): { candidateName?: string; designation?: string; salary?: number; joiningDate?: string; missing: string[] } => {
    const missing: string[] = [];
    let candidateName: string | undefined;
    let designation: string | undefined;
    let salary: number | undefined;
    let joiningDate: string | undefined;

    // Extract candidate name (look for patterns like "for John Doe", "candidate: John", etc.)
    const namePatterns = [
      /(?:for|candidate[:\s]+|name[:\s]+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+),/i,
    ];
    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        candidateName = match[1].trim();
        break;
      }
    }

    // Extract designation
    const designationPatterns = [
      /(?:designation[:\s]+|as\s+(?:a\s+)?|position[:\s]+)([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:,|\s+salary|\s+ctc|\s+joining|\s+\d|$)/i,
      /(?:Software\s+Developer|Senior\s+Developer|Frontend\s+Developer|Backend\s+Developer|Full\s+Stack\s+Developer|DevOps\s+Engineer|Data\s+Scientist|Data\s+Analyst|Product\s+Manager|Project\s+Manager|HR\s+Executive|HR\s+Manager|Marketing\s+Manager|Sales\s+Executive|Business\s+Analyst|QA\s+Engineer|Test\s+Engineer|UI\/UX\s+Designer|Graphic\s+Designer|Content\s+Writer|Technical\s+Writer|System\s+Administrator|Network\s+Engineer|Cloud\s+Engineer|Machine\s+Learning\s+Engineer|AI\s+Engineer|Intern|Trainee)/i,
    ];
    for (const pattern of designationPatterns) {
      const match = text.match(pattern);
      if (match) {
        designation = match[1] ? match[1].trim() : match[0].trim();
        break;
      }
    }

    // Extract salary (LPA, lakhs, per annum)
    const salaryPatterns = [
      /(?:salary[:\s]+|ctc[:\s]+)?(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?\s*(?:per\s*annum)?|l\.?p\.?a\.?)/i,
      /(?:salary[:\s]+|ctc[:\s]+)(?:rs\.?\s*)?(\d+(?:,\d+)*)/i,
    ];
    for (const pattern of salaryPatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseFloat(match[1].replace(/,/g, ''));
        // If value is small, assume it's in lakhs
        salary = value < 100 ? value * 100000 : value;
        break;
      }
    }

    // Extract joining date
    const datePatterns = [
      /(?:joining[:\s]+|join(?:ing)?\s+(?:on\s+)?|doj[:\s]+|date\s+of\s+joining[:\s]+)(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(?:\d{4})?)/i,
      /(?:joining[:\s]+|join(?:ing)?\s+(?:on\s+)?|doj[:\s]+)(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /(?:joining[:\s]+|join(?:ing)?\s+)(?:next\s+)?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i,
    ];
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        joiningDate = match[1].trim();
        break;
      }
    }

    // Check what's missing
    if (!candidateName) missing.push('Candidate Name');
    if (!designation) missing.push('Designation');
    if (!salary) missing.push('Salary (CTC)');
    if (!joiningDate) missing.push('Date of Joining');

    return { candidateName, designation, salary, joiningDate, missing };
  };

  const handleSubmitPrompt = async () => {
    if (!prompt.trim()) return;

    const userMessage = prompt.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setPrompt('');
    setIsProcessing(true);

    // Parse the prompt
    const parsed = parsePrompt(userMessage);

    if (parsed.missing.length > 0) {
      // Ask for missing information
      const missingText = parsed.missing.join(', ');
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Please provide the following missing details: **${missingText}**

Example: "Rahul Sharma, Software Developer, 6 LPA, joining 15th January 2025"`
      }]);
      setIsProcessing(false);
      return;
    }

    // All required fields present - generate offer letter
    try {
      // Create offer letter data
      const today = new Date();
      const offerValidDate = new Date(today);
      offerValidDate.setDate(today.getDate() + 7);

      const offerLetterData: CreateOfferLetterInput = {
        candidate_name: parsed.candidateName!,
        candidate_address: 'Address to be updated',
        designation: parsed.designation!,
        joining_date: parsed.joiningDate!,
        annual_ctc: parsed.salary!,
        offer_valid_till: offerValidDate.toISOString().split('T')[0],
        working_location: 'Noida',
        hr_manager_name: 'HR Manager',
        hr_manager_title: 'Manager-Human Resource',
        template_type: 'long',
        salary_breakdown: generateSalaryBreakdown(parsed.salary!),
      };

      setEditedData(offerLetterData);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Offer letter generated for **${parsed.candidateName}** as **${parsed.designation}** with CTC **₹${(parsed.salary!/100000).toFixed(1)} LPA**, joining on **${parsed.joiningDate}**.

You can review and edit the details below, then click "Create Offer Letter" to finalize.`
      }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error generating offer letter: ${err.message}`
      }]);
    }
    setIsProcessing(false);
  };

  // Generate standard salary breakdown from annual CTC
  const generateSalaryBreakdown = (annualCtc: number): SalaryBreakdownItem[] => {
    const monthly = Math.round(annualCtc / 12);
    const basic = Math.round(monthly * 0.40);
    const hra = Math.round(basic * 0.50);
    const conveyance = 1600;
    const medical = 1250;
    const special = monthly - basic - hra - conveyance - medical;

    return [
      { component: 'Basic Salary', perMonth: basic, annual: basic * 12 },
      { component: 'HRA', perMonth: hra, annual: hra * 12 },
      { component: 'Conveyance Allowance', perMonth: conveyance, annual: conveyance * 12 },
      { component: 'Medical Allowance', perMonth: medical, annual: medical * 12 },
      { component: 'Special Allowance', perMonth: special, annual: special * 12 },
    ];
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitPrompt();
    }
  };

  const handleCreateOffer = async () => {
    if (!editedData) return;
    try {
      await onCreateOfferLetter(editedData);
      alert('Offer letter created successfully!');
      onReset();
      setEditedData(null);
    } catch (err: any) {
      alert(`Failed to create: ${err.message}`);
    }
  };

  const updateField = (field: keyof CreateOfferLetterInput, value: any) => {
    if (!editedData) return;
    setEditedData({ ...editedData, [field]: value });
  };

  const updateSalaryComponent = (index: number, field: 'perMonth' | 'annual', value: number) => {
    if (!editedData || !editedData.salary_breakdown) return;
    const newBreakdown = [...editedData.salary_breakdown];
    newBreakdown[index] = { ...newBreakdown[index], [field]: value };

    // Auto-calculate the other field
    if (field === 'perMonth') {
      newBreakdown[index].annual = value * 12;
    } else {
      newBreakdown[index].perMonth = Math.round(value / 12);
    }

    // Recalculate total CTC
    const totalAnnual = newBreakdown.reduce((sum, item) => sum + (item.annual || 0), 0);
    setEditedData({ ...editedData, salary_breakdown: newBreakdown, annual_ctc: totalAnnual });
  };

  const addSalaryComponent = () => {
    if (!editedData) return;
    const newBreakdown = [...(editedData.salary_breakdown || []), { component: 'New Component', perMonth: 0, annual: 0 }];
    setEditedData({ ...editedData, salary_breakdown: newBreakdown });
  };

  const removeSalaryComponent = (index: number) => {
    if (!editedData || !editedData.salary_breakdown) return;
    const newBreakdown = editedData.salary_breakdown.filter((_, i) => i !== index);
    const totalAnnual = newBreakdown.reduce((sum, item) => sum + (item.annual || 0), 0);
    setEditedData({ ...editedData, salary_breakdown: newBreakdown, annual_ctc: totalAnnual });
  };

  // Show the file-based generated data if available (from file upload flow)
  if (generatedData?.success && editedData) {
    return (
      <div className="space-y-6">
        {/* Header with Edit Toggle */}
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
              {isEditing ? 'Edit Offer Letter Details' : 'Offer Letter Generated!'}
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300">
              {isEditing ? 'Modify the details below before creating the offer letter.' : 'Review and edit if needed, then create the offer letter.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-4 py-2 rounded-lg font-medium ${
                isEditing
                  ? 'bg-blue-600 text-white'
                  : 'text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800'
              }`}
            >
              {isEditing ? 'Done Editing' : 'Edit Details'}
            </button>
            <button
              onClick={() => { onReset(); setEditedData(null); }}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Start Over
            </button>
          </div>
        </div>

        {/* Main Edit Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Candidate & Basic Info */}
          <div className="space-y-6">
            {/* Candidate Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Candidate Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Candidate Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.candidate_name || ''}
                      onChange={(e) => updateField('candidate_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  ) : (
                    <p className="font-medium text-gray-900 dark:text-white">{editedData.candidate_name || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Candidate Address</label>
                  {isEditing ? (
                    <textarea
                      value={editedData.candidate_address || ''}
                      onChange={(e) => updateField('candidate_address', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  ) : (
                    <p className="text-gray-700 dark:text-gray-300">{editedData.candidate_address || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Designation</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.designation || ''}
                      onChange={(e) => updateField('designation', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  ) : (
                    <p className="font-medium text-gray-900 dark:text-white">{editedData.designation || 'N/A'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Job Details */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Job Details
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Joining Date</label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editedData.joining_date || ''}
                        onChange={(e) => updateField('joining_date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    ) : (
                      <p className="font-medium text-gray-900 dark:text-white">{editedData.joining_date || 'N/A'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Offer Valid Till</label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editedData.offer_valid_till || ''}
                        onChange={(e) => updateField('offer_valid_till', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    ) : (
                      <p className="font-medium text-gray-900 dark:text-white">{editedData.offer_valid_till || 'N/A'}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Working Location</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.working_location || ''}
                      onChange={(e) => updateField('working_location', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  ) : (
                    <p className="font-medium text-gray-900 dark:text-white">{editedData.working_location || 'N/A'}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">HR Manager Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedData.hr_manager_name || ''}
                        onChange={(e) => updateField('hr_manager_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    ) : (
                      <p className="font-medium text-gray-900 dark:text-white">{editedData.hr_manager_name || 'N/A'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">HR Manager Title</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedData.hr_manager_title || ''}
                        onChange={(e) => updateField('hr_manager_title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    ) : (
                      <p className="font-medium text-gray-900 dark:text-white">{editedData.hr_manager_title || 'N/A'}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Salary & CTC */}
          <div className="space-y-6">
            {/* Salary Breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Salary Breakdown
                </h3>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Annual CTC</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ₹{editedData.annual_ctc?.toLocaleString() || 0}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {editedData.salary_breakdown?.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          value={item.component}
                          onChange={(e) => {
                            const newBreakdown = [...(editedData.salary_breakdown || [])];
                            newBreakdown[index] = { ...newBreakdown[index], component: e.target.value };
                            setEditedData({ ...editedData, salary_breakdown: newBreakdown });
                          }}
                          className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-sm"
                          placeholder="Component name"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">₹</span>
                          <input
                            type="number"
                            value={item.perMonth || 0}
                            onChange={(e) => updateSalaryComponent(index, 'perMonth', parseInt(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-sm text-right"
                          />
                          <span className="text-xs text-gray-500">/mo</span>
                        </div>
                        <button
                          onClick={() => removeSalaryComponent(index)}
                          className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-gray-700 dark:text-gray-300">{item.component}</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          ₹{item.perMonth?.toLocaleString()}/mo
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          (₹{item.annual?.toLocaleString()}/yr)
                        </span>
                      </>
                    )}
                  </div>
                ))}

                {isEditing && (
                  <button
                    onClick={addSalaryComponent}
                    className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-green-500 hover:text-green-500 transition-colors"
                  >
                    + Add Salary Component
                  </button>
                )}
              </div>

              {/* Joining Bonus */}
              <div className="mt-4 pt-4 border-t dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Joining Bonus</label>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">₹</span>
                      <input
                        type="number"
                        value={editedData.joining_bonus || 0}
                        onChange={(e) => updateField('joining_bonus', parseInt(e.target.value) || 0)}
                        className="w-32 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-right"
                      />
                    </div>
                  ) : (
                    <span className="font-medium text-gray-900 dark:text-white">
                      {editedData.joining_bonus ? `₹${editedData.joining_bonus.toLocaleString()}` : 'None'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Confidence Scores */}
            {generatedData.offer_letter.confidence_scores && !isEditing && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">AI Confidence</h3>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(generatedData.offer_letter.confidence_scores).map(([key, value]) => (
                    <div key={key} className="text-center">
                      <div className={`text-lg font-bold ${
                        (value as number) >= 70 ? 'text-green-500' :
                        (value as number) >= 50 ? 'text-yellow-500' : 'text-red-500'
                      }`}>
                        {value}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{key}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          {isEditing && (
            <button
              onClick={() => {
                if (generatedData?.offer_letter?.offer_letter_data) {
                  setEditedData({ ...generatedData.offer_letter.offer_letter_data });
                }
              }}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Reset to Original
            </button>
          )}
          <button
            onClick={handleCreateOffer}
            disabled={isCreating}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-lg disabled:opacity-50 flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Create Offer Letter
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Chat Interface */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border dark:border-gray-700 overflow-hidden">
        {/* Chat Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            AI Offer Letter Generator
          </h3>
          <p className="text-orange-100 text-sm mt-1">Type candidate details to generate offer letter</p>
        </div>

        {/* Chat Messages */}
        <div className="h-80 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
          {chatMessages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-orange-500 text-white rounded-br-md'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border dark:border-gray-700 rounded-bl-md shadow-sm'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{
                  __html: msg.content
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\n/g, '<br/>')
                }} />
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3 border dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex gap-3">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type candidate details: Name, Designation, Salary, Date of Joining..."
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              disabled={isProcessing}
            />
            <button
              onClick={handleSubmitPrompt}
              disabled={isProcessing || !prompt.trim()}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
            >
              {isProcessing ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Generated Offer Letter Form */}
      {editedData && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border dark:border-gray-700 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Offer Letter Details
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`px-4 py-2 rounded-lg font-medium text-sm ${
                  isEditing
                    ? 'bg-blue-600 text-white'
                    : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
              >
                {isEditing ? 'Done Editing' : 'Edit'}
              </button>
              <button
                onClick={() => { setEditedData(null); setChatMessages([chatMessages[0]]); }}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Candidate Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Candidate Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.candidate_name || ''}
                    onChange={(e) => updateField('candidate_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                ) : (
                  <p className="font-medium text-gray-900 dark:text-white">{editedData.candidate_name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Designation</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.designation || ''}
                    onChange={(e) => updateField('designation', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                ) : (
                  <p className="font-medium text-gray-900 dark:text-white">{editedData.designation}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Joining Date</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.joining_date || ''}
                    onChange={(e) => updateField('joining_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                ) : (
                  <p className="font-medium text-gray-900 dark:text-white">{editedData.joining_date}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Annual CTC</label>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  ₹{editedData.annual_ctc?.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Salary Breakdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Salary Breakdown</label>
              <div className="space-y-2 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                {editedData.salary_breakdown?.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">{item.component}</span>
                    <span className="font-medium text-gray-900 dark:text-white">₹{item.perMonth?.toLocaleString()}/mo</span>
                  </div>
                ))}
                <div className="border-t dark:border-gray-600 pt-2 mt-2 flex justify-between font-bold">
                  <span className="text-gray-700 dark:text-gray-200">Total</span>
                  <span className="text-green-600 dark:text-green-400">₹{Math.round((editedData.annual_ctc || 0) / 12).toLocaleString()}/mo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Create Button */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleCreateOffer}
              disabled={isCreating}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-xl shadow-lg transition-colors flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Create Offer Letter
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Patterns Panel - View learned patterns
interface PatternsPanelProps {
  learnedPatterns: {
    patterns: LearnedPattern[];
    companyDefaults: Record<string, string>;
    salaryBenchmarks: SalaryBenchmark[];
  } | undefined;
  isLoading: boolean;
}

function PatternsPanel({ learnedPatterns, isLoading }: PatternsPanelProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!learnedPatterns) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No patterns learned yet. Upload training documents to start learning.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Defaults */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Learned Company Defaults
        </h3>
        {Object.keys(learnedPatterns.companyDefaults).length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No defaults learned yet</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(learnedPatterns.companyDefaults).map(([key, value]) => (
              <div key={key} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                <p className="font-medium text-gray-900 dark:text-white text-sm mt-1 truncate" title={value}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Salary Benchmarks */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Salary Benchmarks
        </h3>
        {learnedPatterns.salaryBenchmarks.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No salary benchmarks learned yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                  <th className="pb-2 font-medium">Designation</th>
                  <th className="pb-2 font-medium">Min CTC</th>
                  <th className="pb-2 font-medium">Max CTC</th>
                  <th className="pb-2 font-medium">Avg CTC</th>
                  <th className="pb-2 font-medium">Samples</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {learnedPatterns.salaryBenchmarks.map((b) => (
                  <tr key={b.id} className="text-gray-900 dark:text-white">
                    <td className="py-2 font-medium">{b.designation}</td>
                    <td className="py-2">₹{b.annual_ctc_min?.toLocaleString() || '-'}</td>
                    <td className="py-2">₹{b.annual_ctc_max?.toLocaleString() || '-'}</td>
                    <td className="py-2 text-green-600 dark:text-green-400">₹{b.annual_ctc_avg?.toLocaleString() || '-'}</td>
                    <td className="py-2">{b.sample_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Learned Patterns List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Extracted Patterns ({learnedPatterns.patterns.length})
        </h3>
        {learnedPatterns.patterns.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No patterns extracted yet</p>
        ) : (
          <div className="space-y-3">
            {learnedPatterns.patterns.map((p) => (
              <div key={p.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">{p.document_name}</span>
                    {p.designation_found && (
                      <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded">
                        {p.designation_found}
                      </span>
                    )}
                  </div>
                  {p.annual_ctc_found && (
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      ₹{p.annual_ctc_found.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {p.company_name && <span>Company: {p.company_name}</span>}
                  {p.working_location && <span>Location: {p.working_location}</span>}
                  {p.probation_period && <span>Probation: {p.probation_period}</span>}
                  {p.template_style && <span>Style: {p.template_style}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Training Panel Component
interface TrainingPanelProps {
  documents: RAGDocument[];
  isLoading: boolean;
  onUpload: (file: File) => Promise<RAGDocument>;
  onDelete: (id: number) => Promise<void>;
  isUploading: boolean;
}

function TrainingPanel({ documents, isLoading, onUpload, onDelete, isUploading }: TrainingPanelProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.type === 'application/pdf') {
        try {
          await onUpload(file);
        } catch (error: any) {
          alert(`Failed to upload ${file.name}: ${error.message}`);
        }
      } else {
        alert(`${file.name} is not a PDF file`);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusBadge = (status: RAGDocument['status']) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Completed</span>;
      case 'processing':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full animate-pulse">Processing...</span>;
      case 'pending':
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">Pending</span>;
      case 'failed':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">Failed</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Uploading and processing...</p>
          </div>
        ) : (
          <>
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mt-4 text-lg font-medium text-gray-900">Upload Offer Letter PDFs for Training</p>
            <p className="mt-2 text-sm text-gray-500">Drag and drop PDF files here, or click to select</p>
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
              id="training-upload"
            />
            <label
              htmlFor="training-upload"
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
            >
              Select Files
            </label>
          </>
        )}
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b">
          <h3 className="text-lg font-medium">Training Documents ({documents.length})</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No training documents uploaded yet. Upload offer letter PDFs to train the AI.
          </div>
        ) : (
          <div className="divide-y">
            {documents.map((doc) => (
              <div key={doc.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <svg className="h-8 w-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM9.998 14.768H8.895v3.274h-.917v-3.274H6.893v-.77h3.105v.77zm2.725 3.274l-.365-1.145H10.89l-.375 1.145h-.917l1.453-4.043h.917l1.456 4.043h-.901zm1.515-3.274v.77h1.136v2.504h.916v-2.504h1.138v-.77h-3.19z"/>
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">{doc.original_name}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{formatBytes(doc.file_size)}</span>
                      {doc.chunk_count > 0 && <span>{doc.chunk_count} chunks</span>}
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(doc.status)}
                  {doc.status === 'failed' && doc.error_message && (
                    <span className="text-xs text-red-600" title={doc.error_message}>Error</span>
                  )}
                  <button
                    onClick={() => onDelete(doc.id)}
                    className="text-red-600 hover:text-red-800"
                    title="Delete"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Generate Panel Component
interface GeneratePanelProps {
  resumes: ResumeExtraction[];
  isLoadingResumes: boolean;
  onUploadResume: (file: File) => Promise<ResumeExtraction>;
  onDeleteResume: (id: number) => Promise<void>;
  isUploadingResume: boolean;
  signatories: Signatory[];
  onGenerate: (request: RAGGenerateRequest) => Promise<any>;
  isGenerating: boolean;
  generatedData: any;
  onResetGeneration: () => void;
  onCreateOfferLetter: (data: CreateOfferLetterInput) => Promise<any>;
  isCreatingOfferLetter: boolean;
  trainingDocsCount: number;
}

function GeneratePanel({
  resumes,
  isLoadingResumes,
  onUploadResume,
  onDeleteResume,
  isUploadingResume,
  signatories,
  onGenerate,
  isGenerating,
  generatedData,
  onResetGeneration,
  onCreateOfferLetter,
  isCreatingOfferLetter,
  trainingDocsCount,
}: GeneratePanelProps) {
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  const [config, setConfig] = useState<RAGGenerateRequest>({
    resume_id: 0,
    template_type: 'long',
    hr_manager_name: 'HR Manager',
    hr_manager_title: 'Manager-Human Resource',
    working_location: 'Noida',
    offer_valid_days: 7,
  });
  const [showPreview, setShowPreview] = useState(false);

  const { data: selectedResume } = useResumeDetails(selectedResumeId);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.type === 'application/pdf') {
      try {
        const result = await onUploadResume(file);
        setSelectedResumeId(result.id);
      } catch (error: any) {
        alert(`Failed to upload resume: ${error.message}`);
      }
    } else {
      alert('Please upload a PDF file');
    }
  };

  const handleGenerate = async () => {
    if (!selectedResumeId) {
      alert('Please select a resume first');
      return;
    }
    if (trainingDocsCount === 0) {
      alert('Please upload training documents first (go to Training Documents tab)');
      return;
    }
    try {
      await onGenerate({
        ...config,
        resume_id: selectedResumeId,
      });
      setShowPreview(true);
    } catch (error: any) {
      alert(`Generation failed: ${error.message}`);
    }
  };

  const handleCreateOfferLetter = async () => {
    if (!generatedData?.offer_letter_data) return;
    try {
      await onCreateOfferLetter(generatedData.offer_letter_data);
      alert('Offer letter created successfully! You can find it in the Offer Letters section.');
      onResetGeneration();
      setShowPreview(false);
      setSelectedResumeId(null);
    } catch (error: any) {
      alert(`Failed to create offer letter: ${error.message}`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Resume Selection */}
      <div className="space-y-6">
        {/* Upload Resume */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-4">Upload Resume</h3>
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            {isUploadingResume ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                <p className="text-gray-600">Extracting resume data...</p>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                  id="resume-upload"
                />
                <label
                  htmlFor="resume-upload"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 cursor-pointer"
                >
                  Upload Resume PDF
                </label>
              </>
            )}
          </div>
        </div>

        {/* Resume List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b">
            <h3 className="text-lg font-medium">Uploaded Resumes ({resumes.length})</h3>
          </div>
          {isLoadingResumes ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : resumes.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No resumes uploaded yet</div>
          ) : (
            <div className="divide-y max-h-96 overflow-y-auto">
              {resumes.map((resume) => (
                <div
                  key={resume.id}
                  onClick={() => setSelectedResumeId(resume.id)}
                  className={`px-4 py-3 cursor-pointer transition-colors ${
                    selectedResumeId === resume.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">
                        {resume.candidate_name || resume.original_name}
                      </p>
                      <p className="text-sm text-gray-500">{resume.designation || 'Designation not found'}</p>
                      <p className="text-xs text-gray-400">{new Date(resume.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteResume(resume.id); }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Resume Preview */}
        {selectedResume && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-medium mb-4">Resume Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-gray-500">Name:</label>
                <p className="font-medium">{selectedResume.candidate_name || 'N/A'}</p>
              </div>
              <div>
                <label className="text-gray-500">Email:</label>
                <p className="font-medium">{selectedResume.candidate_email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-gray-500">Phone:</label>
                <p className="font-medium">{selectedResume.candidate_phone || 'N/A'}</p>
              </div>
              <div>
                <label className="text-gray-500">Designation:</label>
                <p className="font-medium">{selectedResume.designation || 'N/A'}</p>
              </div>
              <div>
                <label className="text-gray-500">Experience:</label>
                <p className="font-medium">{selectedResume.experience_years ? `${selectedResume.experience_years} years` : 'N/A'}</p>
              </div>
              <div>
                <label className="text-gray-500">Skills:</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(selectedResume.skills || []).slice(0, 10).map((skill, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                      {skill}
                    </span>
                  ))}
                  {(selectedResume.skills || []).length > 10 && (
                    <span className="px-2 py-0.5 text-gray-500 text-xs">
                      +{selectedResume.skills.length - 10} more
                    </span>
                  )}
                </div>
              </div>
              {selectedResume.expected_salary && (
                <div>
                  <label className="text-gray-500">Expected Salary:</label>
                  <p className="font-medium">₹{selectedResume.expected_salary.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Column - Generation Config & Preview */}
      <div className="space-y-6">
        {/* Generation Config */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-4">Generation Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Type</label>
              <select
                value={config.template_type}
                onChange={(e) => setConfig({ ...config, template_type: e.target.value as any })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="long">Long Form (Detailed)</option>
                <option value="short">Short Form (Concise)</option>
                <option value="internship">Internship</option>
                <option value="extension">Contract Extension</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HR Manager Name</label>
              <input
                type="text"
                value={config.hr_manager_name}
                onChange={(e) => setConfig({ ...config, hr_manager_name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HR Manager Title</label>
              <input
                type="text"
                value={config.hr_manager_title}
                onChange={(e) => setConfig({ ...config, hr_manager_title: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Working Location</label>
              <input
                type="text"
                value={config.working_location}
                onChange={(e) => setConfig({ ...config, working_location: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Signatory</label>
              <select
                value={config.signatory_id || ''}
                onChange={(e) => setConfig({ ...config, signatory_id: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">-- No Signatory --</option>
                {signatories.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} - {s.position}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Signatory</label>
              <select
                value={config.secondary_signatory_id || ''}
                onChange={(e) => setConfig({ ...config, secondary_signatory_id: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">-- No Secondary Signatory --</option>
                {signatories.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} - {s.position}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Offer Valid Days</label>
              <input
                type="number"
                value={config.offer_valid_days}
                onChange={(e) => setConfig({ ...config, offer_valid_days: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min={1}
                max={30}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={!selectedResumeId || isGenerating || trainingDocsCount === 0}
              className="w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </span>
              ) : trainingDocsCount === 0 ? (
                'Upload Training Docs First'
              ) : !selectedResumeId ? (
                'Select a Resume'
              ) : (
                'Generate Offer Letter'
              )}
            </button>
          </div>
        </div>

        {/* Generated Preview */}
        {showPreview && generatedData && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Generated Offer Letter</h3>
              <button
                onClick={() => { setShowPreview(false); onResetGeneration(); }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {generatedData.success ? (
              <div className="space-y-4">
                {/* Confidence Scores */}
                {generatedData.confidence_scores && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">Confidence Scores</p>
                    <div className="grid grid-cols-5 gap-2 text-center text-xs">
                      {Object.entries(generatedData.confidence_scores).map(([key, value]) => (
                        <div key={key}>
                          <div className={`font-bold ${(value as number) >= 70 ? 'text-green-600' : (value as number) >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {value}%
                          </div>
                          <div className="text-gray-500 capitalize">{key}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {generatedData.suggestions && generatedData.suggestions.length > 0 && (
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800 mb-1">Suggestions</p>
                    <ul className="text-xs text-yellow-700 list-disc list-inside">
                      {generatedData.suggestions.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Preview Data */}
                {generatedData.offer_letter_data && (
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-gray-500">Candidate:</span>
                        <p className="font-medium">{generatedData.offer_letter_data.candidate_name}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Designation:</span>
                        <p className="font-medium">{generatedData.offer_letter_data.designation}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Annual CTC:</span>
                        <p className="font-medium">₹{generatedData.offer_letter_data.annual_ctc?.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Joining Date:</span>
                        <p className="font-medium">{generatedData.offer_letter_data.joining_date}</p>
                      </div>
                    </div>

                    {/* Salary Breakdown */}
                    {generatedData.offer_letter_data.salary_breakdown && (
                      <div className="mt-3">
                        <p className="text-gray-500 mb-1">Salary Breakdown:</p>
                        <div className="bg-gray-50 rounded-lg p-2 text-xs">
                          {generatedData.offer_letter_data.salary_breakdown.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between py-1">
                              <span>{item.component}</span>
                              <span className="font-medium">₹{item.perMonth?.toLocaleString()}/mo</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleCreateOfferLetter}
                  disabled={isCreatingOfferLetter}
                  className="w-full bg-green-600 text-white py-3 rounded-md font-medium hover:bg-green-700 disabled:bg-gray-400"
                >
                  {isCreatingOfferLetter ? 'Creating...' : 'Create Offer Letter'}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-red-50 rounded-lg text-red-700">
                <p className="font-medium">Generation Failed</p>
                <p className="text-sm">{generatedData.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
