import { useState, useRef } from 'react';
import { ragApi, type TemplateProfile } from '../api/rag';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type Tab = 'training' | 'templates' | 'generate';

export default function AIOfferLetterGenerator() {
  const [activeTab, setActiveTab] = useState<Tab>('training');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          AI Offer Letter Generator
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Train the AI with your offer letters, learn templates, and generate professional offers
        </p>
      </div>

      {/* Stats Overview */}
      <StatsOverview />

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'training' as Tab, label: 'Training Documents', icon: '📚' },
            { id: 'templates' as Tab, label: 'Template Profiles', icon: '📋' },
            { id: 'generate' as Tab, label: 'Generate Offer', icon: '✨' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'training' && <TrainingDocumentsTab />}
      {activeTab === 'templates' && <TemplateProfilesTab />}
      {activeTab === 'generate' && <GenerateOfferTab />}
    </div>
  );
}

function StatsOverview() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['rag-stats'],
    queryFn: ragApi.getStats,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
          {stats?.training?.completed || 0}
        </div>
        <div className="text-sm text-blue-700 dark:text-blue-300">Training Documents</div>
      </div>
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
          {(stats as any)?.learning?.patternsLearned || 0}
        </div>
        <div className="text-sm text-purple-700 dark:text-purple-300">Patterns Learned</div>
      </div>
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
          {(stats as any)?.learning?.salaryBenchmarks || 0}
        </div>
        <div className="text-sm text-green-700 dark:text-green-300">Salary Benchmarks</div>
      </div>
      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
        <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
          {stats?.resumes?.convertedToOffers || 0}
        </div>
        <div className="text-sm text-orange-700 dark:text-orange-300">Offers Generated</div>
      </div>
    </div>
  );
}

function TrainingDocumentsTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: ['rag-documents'],
    queryFn: ragApi.getDocuments,
    refetchInterval: 5000, // Poll for status updates
  });

  const uploadMutation = useMutation({
    mutationFn: ragApi.uploadTrainingDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rag-documents'] });
      queryClient.invalidateQueries({ queryKey: ['rag-stats'] });
      queryClient.invalidateQueries({ queryKey: ['template-profiles'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ragApi.deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rag-documents'] });
      queryClient.invalidateQueries({ queryKey: ['rag-stats'] });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadMutation.mutateAsync(file);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Upload Offer Letter Samples
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Upload PDF offer letters to train the AI. The system will extract templates, learn salary patterns, and identify formatting styles.
        </p>

        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="text-4xl mb-2">📄</div>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Drag and drop PDF files here, or
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Browse Files'}
          </button>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Training Documents ({documents?.length || 0})
        </h3>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        ) : documents?.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No training documents yet. Upload some offer letters to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {documents?.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">📄</div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {doc.original_name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {doc.chunk_count} chunks • {new Date(doc.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      doc.status === 'completed'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : doc.status === 'processing'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                        : doc.status === 'failed'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {doc.status}
                  </span>
                  <button
                    onClick={() => deleteMutation.mutate(doc.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Delete
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

function TemplateProfilesTab() {
  const [selectedProfile, setSelectedProfile] = useState<TemplateProfile | null>(null);
  const queryClient = useQueryClient();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['template-profiles'],
    queryFn: ragApi.getTemplateProfiles,
  });

  const setDefaultMutation = useMutation({
    mutationFn: ragApi.setDefaultTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-profiles'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ragApi.deleteTemplateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-profiles'] });
      setSelectedProfile(null);
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Profiles List */}
      <div className="col-span-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Learned Templates ({profiles?.length || 0})
        </h3>

        {profiles?.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No templates yet. Upload offer letters to learn templates.
          </div>
        ) : (
          <div className="space-y-2">
            {profiles?.map((profile) => (
              <button
                key={profile.id}
                onClick={() => setSelectedProfile(profile)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedProfile?.id === profile.id
                    ? 'bg-blue-100 dark:bg-blue-900 border border-blue-500'
                    : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {profile.profile_name}
                  </span>
                  {profile.is_default && (
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full">
                      Default
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {profile.tone_style} • {profile.usage_count} uses
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Profile Details */}
      <div className="col-span-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {selectedProfile ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {selectedProfile.profile_name}
              </h3>
              <div className="flex gap-2">
                {!selectedProfile.is_default && (
                  <button
                    onClick={() => setDefaultMutation.mutate(selectedProfile.id)}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Set as Default
                  </button>
                )}
                <button
                  onClick={() => deleteMutation.mutate(selectedProfile.id)}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-400">
              {selectedProfile.profile_description || 'No description available'}
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">Tone Style</div>
                <div className="font-medium text-gray-900 dark:text-white capitalize">
                  {selectedProfile.tone_style?.replace('_', ' ') || 'Not set'}
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">Usage Count</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {selectedProfile.usage_count} times
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">Has Salary Table</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {selectedProfile.has_salary_table ? 'Yes' : 'No'}
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">Has KRA Section</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {selectedProfile.has_kra_section ? 'Yes' : 'No'}
                </div>
              </div>
            </div>

            {selectedProfile.sections_order?.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Sections Order</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedProfile.sections_order.map((section, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                    >
                      {i + 1}. {section}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedProfile.common_phrases?.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Common Phrases</h4>
                <div className="space-y-1">
                  {selectedProfile.common_phrases.slice(0, 5).map((phrase, i) => (
                    <div
                      key={i}
                      className="text-sm text-gray-600 dark:text-gray-400 italic"
                    >
                      "{phrase}"
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Select a template profile to view details
          </div>
        )}
      </div>
    </div>
  );
}

function GenerateOfferTab() {
  const [step, setStep] = useState<'upload' | 'configure' | 'result'>('upload');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: templates } = useQuery({
    queryKey: ['template-profiles'],
    queryFn: ragApi.getTemplateProfiles,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResumeFile(file);
      setStep('configure');
      setError(null);
    }
  };

  const handleGenerate = async () => {
    if (!resumeFile) return;

    setGenerating(true);
    setError(null);

    try {
      const response = await ragApi.autoGenerateWithTemplate(resumeFile);
      setResult(response);
      setStep('result');
    } catch (err: any) {
      setError(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setResumeFile(null);
    setSelectedTemplateId(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {['upload', 'configure', 'result'].map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s
                  ? 'bg-blue-600 text-white'
                  : i < ['upload', 'configure', 'result'].indexOf(step)
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              }`}
            >
              {i + 1}
            </div>
            {i < 2 && (
              <div
                className={`w-20 h-1 mx-2 ${
                  i < ['upload', 'configure', 'result'].indexOf(step)
                    ? 'bg-green-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {step === 'upload' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          <div className="text-center">
            <div className="text-5xl mb-4">📄</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Upload Candidate Resume
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Upload a PDF resume to extract candidate information and generate an offer letter
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg"
            >
              Select Resume PDF
            </button>
          </div>
        </div>
      )}

      {step === 'configure' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Configure Generation
          </h3>

          <div className="space-y-6">
            {/* Resume Info */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="text-2xl">📄</div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {resumeFile?.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {(resumeFile?.size || 0) / 1024 > 1000
                      ? `${((resumeFile?.size || 0) / 1024 / 1024).toFixed(2)} MB`
                      : `${((resumeFile?.size || 0) / 1024).toFixed(2)} KB`}
                  </div>
                </div>
              </div>
            </div>

            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Template Profile (Optional - will auto-select if not chosen)
              </label>
              <select
                value={selectedTemplateId || ''}
                onChange={(e) => setSelectedTemplateId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Auto-select best matching template</option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.profile_name} ({t.tone_style}) {t.is_default ? '- Default' : ''}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Generating...
                  </>
                ) : (
                  <>Generate Offer Letter</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="space-y-6">
          {/* Success Banner */}
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="text-2xl">✅</div>
              <div>
                <div className="font-medium text-green-700 dark:text-green-300">
                  Offer Letter Generated Successfully!
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  Template used: {result.template_used?.name || 'Auto-selected'}
                </div>
              </div>
            </div>
          </div>

          {/* Candidate Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Extracted Candidate Info</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Name</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {result.resume?.candidate_name || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Designation</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {result.resume?.designation || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Experience</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {result.resume?.experience_years || 0} years
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Skills</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {result.resume?.skills?.slice(0, 3).join(', ') || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Offer Details */}
          {result.offer_letter?.offer_letter_data && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Generated Offer Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Designation</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {result.offer_letter.offer_letter_data.designation}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Annual CTC</div>
                  <div className="font-medium text-green-600 dark:text-green-400">
                    ₹{result.offer_letter.offer_letter_data.annual_ctc?.toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Joining Date</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {result.offer_letter.offer_letter_data.joining_date}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Working Location</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {result.offer_letter.offer_letter_data.working_location}
                  </div>
                </div>
              </div>

              {/* Salary Breakdown */}
              {result.offer_letter.offer_letter_data.salary_breakdown && (
                <div className="mt-4">
                  <h5 className="font-medium text-gray-900 dark:text-white mb-2">Salary Breakdown</h5>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-600">
                          <th className="text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300">Component</th>
                          <th className="text-right px-4 py-2 text-sm text-gray-700 dark:text-gray-300">Per Month</th>
                          <th className="text-right px-4 py-2 text-sm text-gray-700 dark:text-gray-300">Annual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.offer_letter.offer_letter_data.salary_breakdown.map((item: any, i: number) => (
                          <tr key={i} className="border-t border-gray-200 dark:border-gray-600">
                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{item.component}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-white text-right">
                              ₹{item.perMonth?.toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-white text-right">
                              ₹{item.annual?.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Generate Another
            </button>
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Edit & Save
              </button>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
