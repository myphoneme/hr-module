import { useState, useEffect } from 'react';
import { useCandidates } from '../../hooks/useRecruitment';
import { useSignatories } from '../../hooks/useSignatories';
import { useLetterheads } from '../../hooks/useLetterheads';
import { useOfferLetters } from '../../hooks/useOfferLetters';
import { useRAG } from '../../hooks/useRAG';
import { useMockRecruitment } from '../../contexts/MockRecruitmentContext';
import { ragApi } from '../../api/rag';
import { useQuery } from '@tanstack/react-query';
import type { Signatory, SalaryComponent, OfferLetterWithSignatory } from '../../types';

export default function OfferLetterTab() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLetter, setEditingLetter] = useState<OfferLetterWithSignatory | null>(null);
  const [viewingLetter, setViewingLetter] = useState<OfferLetterWithSignatory | null>(null);

  // Fetch data
  const { data: signatories } = useSignatories();
  const { data: letterheads } = useLetterheads();
  const { offerLetters, isLoading: lettersLoading, deleteOfferLetter, updateOfferLetter, isDeleting, isUpdating } = useOfferLetters();

  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this offer letter?')) return;
    try {
      await deleteOfferLetter(id);
    } catch (err: any) {
      setError(err.message || 'Failed to delete offer letter');
    }
  };

  const handleDownload = async (letter: OfferLetterWithSignatory) => {
    try {
      const response = await fetch(`http://localhost:3001/api/offer-letters/${letter.id}/pdf`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Offer_Letter_${letter.candidate_name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Failed to download PDF');
    }
  };

  const handleUpdateLetter = async (data: any) => {
    if (!editingLetter) return;
    try {
      await updateOfferLetter(editingLetter.id, data);
      setEditingLetter(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update offer letter');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Offer Letters</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create and manage offer letters using RAG-powered templates from HR documents
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create Offer Letter
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

      {/* Offer Letters List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Created Offer Letters ({offerLetters?.length || 0})
          </h3>
        </div>

        {lettersLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : offerLetters && offerLetters.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Candidate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Designation</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">CTC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Joining Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {offerLetters.map((letter: OfferLetterWithSignatory) => (
                  <tr key={letter.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{letter.candidate_name}</p>
                        <p className="text-sm text-gray-500">{letter.working_location}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{letter.designation}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">₹{letter.annual_ctc?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{letter.joining_date}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        letter.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        letter.status === 'sent' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {letter.status || 'draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewingLetter(letter)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                          title="View"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setEditingLetter(letter)}
                          className="p-1.5 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDownload(letter)}
                          className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                          title="Download PDF"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(letter.id)}
                          disabled={isDeleting}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded disabled:opacity-50"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Offer Letters Yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Click the button above to create your first offer letter.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Create Offer Letter
            </button>
          </div>
        )}
      </div>

      {/* Create Offer Letter Modal */}
      {showCreateModal && (
        <CreateOfferLetterModal
          onClose={() => setShowCreateModal(false)}
          signatories={signatories || []}
          letterheads={letterheads || []}
        />
      )}

      {/* View Modal */}
      {viewingLetter && (
        <ViewOfferLetterModal
          letter={viewingLetter}
          onClose={() => setViewingLetter(null)}
          onDownload={() => handleDownload(viewingLetter)}
        />
      )}

      {/* Edit Modal */}
      {editingLetter && (
        <EditOfferLetterModal
          letter={editingLetter}
          onClose={() => setEditingLetter(null)}
          onSave={handleUpdateLetter}
          isUpdating={isUpdating}
        />
      )}
    </div>
  );
}

// Create Offer Letter Modal with RAG Integration
function CreateOfferLetterModal({
  onClose,
  signatories,
  letterheads,
}: {
  onClose: () => void;
  signatories: Signatory[];
  letterheads: any[];
}) {
  const { data: apiCandidates, isLoading: candidatesLoading } = useCandidates({ status: 'selected' });
  const { mockCandidates } = useMockRecruitment();
  const { createOfferLetter, isCreating } = useOfferLetters();
  const { learnedPatterns, isLoadingLearnedPatterns } = useRAG();

  // Fetch template profiles from RAG (learned from uploaded offer letters)
  const { data: templateProfiles, isLoading: templatesLoading } = useQuery({
    queryKey: ['template-profiles'],
    queryFn: ragApi.getTemplateProfiles,
  });

  // Get selected candidates from mock data (those who passed interview)
  const mockSelectedCandidates = mockCandidates.filter(c => c.status === 'selected');

  // Combine API candidates and mock candidates - ONLY candidates who passed interviews
  const allSelectedCandidates = [
    ...(apiCandidates || []),
    ...mockSelectedCandidates.map(c => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone,
      vacancy_title: c.vacancy_title,
      experience_years: c.experience_years,
      current_designation: c.current_designation,
      current_company: c.current_company,
      city: c.location,
      address: c.address,
      expected_salary: c.expected_salary,
      current_salary: c.current_salary,
      skills: c.skills,
      isMock: true,
    })),
  ];

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const [formData, setFormData] = useState({
    candidate_id: '',
    annual_ctc: '',
    joining_date: '',
    signatory_id: '',
    letterhead_id: '',
    working_location: '',
  });

  // Get selected template profile
  const selectedTemplate = templateProfiles?.find(t => t.id === Number(selectedTemplateId));
  const defaultTemplate = templateProfiles?.find(t => t.is_default) || templateProfiles?.[0];

  // Get selected candidate details
  const selectedCandidate = allSelectedCandidates?.find(c => c.id === Number(formData.candidate_id));

  // Get director signatory (mandatory)
  const directorSignatory = signatories?.find((s: Signatory) =>
    s.position.toLowerCase().includes('director') ||
    s.position.toLowerCase().includes('ceo') ||
    s.position.toLowerCase().includes('managing')
  );

  // Get default/active letterhead
  const defaultLetterhead = letterheads?.find((l: any) => l.is_default) || letterheads?.[0];


  // Set default letterhead on initial load
  const defaultLetterheadId = defaultLetterhead?.id;
  useEffect(() => {
    if (defaultLetterheadId && !formData.letterhead_id) {
      setFormData(prev => ({ ...prev, letterhead_id: String(defaultLetterheadId) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultLetterheadId]);

  // Handle candidate selection change - auto-fill CTC from expected salary
  const handleCandidateChange = (candidateId: string) => {
    const candidate = allSelectedCandidates?.find((c: any) => c.id === Number(candidateId));
    // Get working location from vacancy/JD or use default company location
    const workingLocation = (candidate as any)?.vacancy_location ||
      (candidate as any)?.jd_location ||
      learnedPatterns?.companyDefaults?.working_location ||
      'Phoneme Solutions Pvt Ltd, Advant Navis Business Park, B-614 Sector 142, Noida-201307';

    setFormData(prev => ({
      ...prev,
      candidate_id: candidateId,
      annual_ctc: candidate?.expected_salary ? String(candidate.expected_salary) : prev.annual_ctc,
      working_location: workingLocation,
    }));
  };

  const today = new Date().toISOString().split('T')[0];

  const getOfferValidTill = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  };

  // Calculate salary breakdown using learned patterns or defaults
  const calculateSalaryBreakdown = (annualCTC: number): SalaryComponent[] => {
    const basicPercent = learnedPatterns?.salaryBenchmarks?.[0]?.basic_percentage || 40;
    const hraPercent = learnedPatterns?.salaryBenchmarks?.[0]?.hra_percentage || 20;
    const specialPercent = 25;
    const otherPercent = 100 - basicPercent - hraPercent - specialPercent;

    const basic = Math.round(annualCTC * (basicPercent / 100));
    const hra = Math.round(annualCTC * (hraPercent / 100));
    const special = Math.round(annualCTC * (specialPercent / 100));
    const other = Math.round(annualCTC * (otherPercent / 100));

    return [
      { component: 'Basic Salary', perMonth: Math.round(basic / 12), annual: basic },
      { component: 'House Rent Allowance (HRA)', perMonth: Math.round(hra / 12), annual: hra },
      { component: 'Special Allowance', perMonth: Math.round(special / 12), annual: special },
      { component: 'Other Allowances', perMonth: Math.round(other / 12), annual: other },
    ];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!formData.candidate_id) {
      setError('Please select a candidate who passed the interview');
      return;
    }
    if (!formData.annual_ctc || !formData.joining_date || !formData.signatory_id) {
      setError('Please fill all required fields (CTC, joining date, and HR signatory)');
      return;
    }
    if (!directorSignatory) {
      setError('Director signatory is required. Please add a Director in HR Documents first.');
      return;
    }

    try {
      setGeneratingContent(true);

      const selectedSignatory = signatories?.find((s: Signatory) => s.id === Number(formData.signatory_id));
      const annualCTC = Number(formData.annual_ctc);
      const salaryBreakdown = calculateSalaryBreakdown(annualCTC);

      // Get candidate data from interview pipeline
      const candidateName = `${selectedCandidate?.first_name || ''} ${selectedCandidate?.last_name || ''}`.trim();

      // Build address from candidate data
      const addressParts = [
        selectedCandidate?.address,
        selectedCandidate?.city,
        selectedCandidate?.state,
        selectedCandidate?.pincode
      ].filter(Boolean);
      const candidateAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Address not provided';

      // Use vacancy title as designation (from job they applied for)
      const designation = selectedCandidate?.vacancy_title || selectedCandidate?.current_designation || 'Software Engineer';

      // Working location from form or vacancy/JD or RAG learned defaults
      const workingLocation = formData.working_location ||
        (selectedCandidate as any)?.vacancy_location ||
        (selectedCandidate as any)?.jd_location ||
        learnedPatterns?.companyDefaults?.working_location ||
        'Phoneme Solutions Pvt Ltd, Advant Navis Business Park, B-614 Sector 142, Noida-201307';

      // Use RAG learned patterns for HR info
      const hrManagerName = selectedSignatory?.name || learnedPatterns?.companyDefaults?.hr_manager_name || 'HR Manager';
      const hrManagerTitle = selectedSignatory?.position || learnedPatterns?.companyDefaults?.hr_manager_title || 'HR';

      // Use selected template profile (learned from uploaded offer letters) or auto-select default
      const templateToUse = selectedTemplate || defaultTemplate;

      // Parse template's full_structure if it's a string
      let templateStructure: any = null;
      if (templateToUse?.full_structure) {
        try {
          templateStructure = typeof templateToUse.full_structure === 'string'
            ? JSON.parse(templateToUse.full_structure)
            : templateToUse.full_structure;
        } catch (e) {
          console.warn('Failed to parse template structure:', e);
        }
      }

      await createOfferLetter({
        candidate_name: candidateName,
        candidate_address: candidateAddress,
        designation: designation,
        joining_date: formData.joining_date,
        letter_date: today,
        annual_ctc: annualCTC,
        offer_valid_till: getOfferValidTill(),
        working_location: workingLocation,
        hr_manager_name: hrManagerName,
        hr_manager_title: hrManagerTitle,
        template_type: templateStructure?.designation_suitability?.template_length || 'long',
        salary_breakdown: salaryBreakdown,
        signatory_id: Number(formData.signatory_id),
        secondary_signatory_id: directorSignatory.id,
        letterhead_id: formData.letterhead_id ? Number(formData.letterhead_id) : undefined,
        template_profile_id: templateToUse?.id, // Use template from uploaded offer letters in HR Docs
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to generate offer letter');
    } finally {
      setGeneratingContent(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </span>
              Create RAG Offer Letter
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Generate offer letter using AI-learned patterns from HR documents</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        <div className="p-6">
          {/* Success Message */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Offer letter created successfully!</span>
              </div>
              {(selectedTemplate || defaultTemplate) && (
                <p className="text-sm mt-1">
                  Using template: <span className="font-medium">{(selectedTemplate || defaultTemplate)?.profile_name}</span>
                  {' '}({(selectedTemplate || defaultTemplate)?.tone_style})
                </p>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* RAG Info Banner with Template Selection */}
          <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-800 dark:text-purple-200">AI-Powered RAG Generation</p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                  {templatesLoading ? 'Loading templates...' :
                    templateProfiles?.length ?
                    `${templateProfiles.length} template profiles learned from your offer letters` :
                    'Upload offer letter samples in HR Docs to learn templates'}
                </p>
              </div>
            </div>

            {/* Template Profile Selection */}
            {templateProfiles && templateProfiles.length > 0 && (
              <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
                <label className="block text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
                  Select Template Format (from uploaded offer letters)
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">Auto-select best matching template</option>
                  {templateProfiles.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.profile_name} ({t.tone_style}) {t.is_default ? '- Default' : ''} - {t.usage_count} uses
                    </option>
                  ))}
                </select>

                {/* Selected Template Info */}
                {(selectedTemplate || defaultTemplate) && (
                  <div className="mt-2 p-2 bg-purple-100 dark:bg-purple-800/30 rounded text-xs">
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-0.5 bg-purple-200 dark:bg-purple-700 rounded text-purple-800 dark:text-purple-200">
                        {(selectedTemplate || defaultTemplate)?.tone_style?.replace('_', ' ')}
                      </span>
                      {(selectedTemplate || defaultTemplate)?.has_salary_table && (
                        <span className="px-2 py-0.5 bg-green-200 dark:bg-green-700 rounded text-green-800 dark:text-green-200">
                          Salary Table
                        </span>
                      )}
                      {(selectedTemplate || defaultTemplate)?.has_kra_section && (
                        <span className="px-2 py-0.5 bg-blue-200 dark:bg-blue-700 rounded text-blue-800 dark:text-blue-200">
                          KRA Section
                        </span>
                      )}
                      <span className="text-purple-600 dark:text-purple-400">
                        Sections: {(selectedTemplate || defaultTemplate)?.sections_order?.slice(0, 4).join(', ')}...
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Learned Patterns Info */}
            {learnedPatterns?.salaryBenchmarks && learnedPatterns.salaryBenchmarks.length > 0 && (
              <div className="mt-2 text-xs text-purple-600 dark:text-purple-400">
                {learnedPatterns.salaryBenchmarks.length} salary benchmarks learned from existing offers
              </div>
            )}
          </div>

          {/* Letterhead Selection */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              Company Letterhead (Header & Footer from HR Docs)
            </label>
            {letterheads && letterheads.length > 0 ? (
              <select
                value={formData.letterhead_id}
                onChange={(e) => setFormData(prev => ({ ...prev, letterhead_id: e.target.value }))}
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                {letterheads.map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {l.name || l.company_name} {l.is_default ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-blue-600 dark:text-blue-400">No letterheads configured. Add one in HR Documents.</p>
            )}
          </div>

          {/* Director Warning */}
          {!directorSignatory && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-300">
              <strong>Warning:</strong> No Director/CEO signatory found. Please add one in HR Documents.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Candidate Selection - From Interview Pipeline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Candidate (Interview Passed) *
              </label>
              {candidatesLoading ? (
                <div className="flex justify-center py-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                </div>
              ) : allSelectedCandidates && allSelectedCandidates.length > 0 ? (
                <select
                  required
                  value={formData.candidate_id}
                  onChange={(e) => handleCandidateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">-- Select Candidate --</option>
                  {allSelectedCandidates.map((c: any) => (
                    <option key={`${c.isMock ? 'mock-' : ''}${c.id}`} value={c.id}>
                      {c.first_name} {c.last_name} - {c.vacancy_title || 'N/A'} {c.isMock ? '(Interview Passed)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-center text-yellow-700 dark:text-yellow-300 text-sm">
                  No candidates have passed interviews yet. Complete interview process first.
                </div>
              )}
            </div>

            {/* Selected Candidate Info */}
            {selectedCandidate && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {selectedCandidate.first_name} {selectedCandidate.last_name}
                  </h4>
                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 text-xs rounded-full">
                    Interview Passed
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Email:</span> <span className="text-gray-900 dark:text-white">{selectedCandidate.email}</span></div>
                  <div><span className="text-gray-500">Phone:</span> <span className="text-gray-900 dark:text-white">{selectedCandidate.phone || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Position:</span> <span className="text-gray-900 dark:text-white font-medium">{selectedCandidate.vacancy_title || selectedCandidate.current_designation || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Experience:</span> <span className="text-gray-900 dark:text-white">{selectedCandidate.experience_years || 0} years</span></div>
                  {selectedCandidate.current_salary && (
                    <div><span className="text-gray-500">Current CTC:</span> <span className="text-gray-900 dark:text-white">{(selectedCandidate.current_salary / 100000).toFixed(1)} LPA</span></div>
                  )}
                  {selectedCandidate.expected_salary && (
                    <div><span className="text-gray-500">Expected CTC:</span> <span className="text-blue-600 dark:text-blue-400 font-medium">{(selectedCandidate.expected_salary / 100000).toFixed(1)} LPA</span></div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* CTC */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Annual CTC (₹) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.annual_ctc}
                  onChange={(e) => setFormData(prev => ({ ...prev, annual_ctc: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., 600000"
                />
              </div>

              {/* Joining Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Joining Date *</label>
                <input
                  type="date"
                  required
                  value={formData.joining_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, joining_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* HR Signatory */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">HR Signatory *</label>
              <select
                required
                value={formData.signatory_id}
                onChange={(e) => setFormData(prev => ({ ...prev, signatory_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">-- Select HR Signatory --</option>
                {signatories?.map((s: Signatory) => (
                  <option key={s.id} value={s.id}>{s.name} - {s.position}</option>
                ))}
              </select>
            </div>

            {/* Director Signatory Info */}
            {directorSignatory && (
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Director Signatory (Mandatory - Auto-selected)</p>
                <p className="font-medium text-gray-900 dark:text-white">{directorSignatory.name} - {directorSignatory.position}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || generatingContent || !allSelectedCandidates?.length || !directorSignatory || success}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCreating || generatingContent ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {generatingContent ? 'Generating with RAG...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Create with RAG
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// View Modal Component
function ViewOfferLetterModal({
  letter,
  onClose,
  onDownload,
}: {
  letter: OfferLetterWithSignatory;
  onClose: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Offer Letter Details</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Candidate Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Name:</span> <span className="ml-2 font-medium text-gray-900 dark:text-white">{letter.candidate_name}</span></div>
              <div><span className="text-gray-500">Designation:</span> <span className="ml-2 text-gray-900 dark:text-white">{letter.designation}</span></div>
              <div><span className="text-gray-500">Annual CTC:</span> <span className="ml-2 text-green-600 font-bold">₹{letter.annual_ctc?.toLocaleString()}</span></div>
              <div><span className="text-gray-500">Joining Date:</span> <span className="ml-2 text-gray-900 dark:text-white">{letter.joining_date}</span></div>
              <div><span className="text-gray-500">Location:</span> <span className="ml-2 text-gray-900 dark:text-white">{letter.working_location}</span></div>
              <div><span className="text-gray-500">Valid Till:</span> <span className="ml-2 text-gray-900 dark:text-white">{letter.offer_valid_till}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">HR Signatory</p>
              <p className="font-medium text-gray-900 dark:text-white">{letter.signatory_name || letter.hr_manager_name}</p>
              <p className="text-sm text-gray-500">{letter.signatory_position || letter.hr_manager_title}</p>
            </div>
            {letter.secondary_signatory_name && (
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Director</p>
                <p className="font-medium text-gray-900 dark:text-white">{letter.secondary_signatory_name}</p>
                <p className="text-sm text-gray-500">{letter.secondary_signatory_position}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Status:</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              letter.status === 'approved' ? 'bg-green-100 text-green-800' :
              letter.status === 'sent' ? 'bg-blue-100 text-blue-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {letter.status || 'draft'}
            </span>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            Close
          </button>
          <button onClick={onDownload} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// Edit Modal Component
function EditOfferLetterModal({
  letter,
  onClose,
  onSave,
  isUpdating,
}: {
  letter: OfferLetterWithSignatory;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  isUpdating: boolean;
}) {
  const [formData, setFormData] = useState({
    designation: letter.designation || '',
    annual_ctc: letter.annual_ctc || 0,
    joining_date: letter.joining_date || '',
    working_location: letter.working_location || '',
    status: letter.status || 'draft',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      ...formData,
      annual_ctc: Number(formData.annual_ctc),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Offer Letter</h2>
            <p className="text-sm text-gray-500">{letter.candidate_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Designation</label>
            <input
              type="text"
              value={formData.designation}
              onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Annual CTC (₹)</label>
            <input
              type="number"
              value={formData.annual_ctc}
              onChange={(e) => setFormData(prev => ({ ...prev, annual_ctc: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Joining Date</label>
            <input
              type="date"
              value={formData.joining_date}
              onChange={(e) => setFormData(prev => ({ ...prev, joining_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="sent">Sent</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUpdating ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Saving...</>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
