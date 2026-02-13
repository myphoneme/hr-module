import { useState, useEffect } from 'react';
import { useOfferLetters } from '../hooks/useOfferLetters';
import { useSignatories } from '../hooks/useSignatories';
import { useLetterheads } from '../hooks/useLetterheads';
import { useCandidates } from '../hooks/useRecruitment';
import type { OfferLetterWithSignatory, CreateOfferLetterInput, SalaryComponent, KRADetail } from '../types';
import type { Candidate } from '../api/recruitment'; // Import Candidate from recruitment API
import { API_BASE_URL } from '../config/api';

// Helper function to format date for input fields (YYYY-MM-DD)
const formatDateForInput = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
};

// Helper function to calculate salary breakdown (replicated from server for client-side preview)
const generateSalaryBreakdown = (annualCtc: number): SalaryComponent[] => {
  const basicPercent = 40;
  const hraPercent = 20;
  const specialPercent = 25;
  const otherPercent = 15;

  const calculateComponent = (percent: number) => {
    const annual = Math.round(annualCtc * percent / 100);
    const perMonth = Math.round(annual / 12);
    return { perMonth, annual };
  };

  return [
    { component: 'Basic Salary', ...calculateComponent(basicPercent) },
    { component: 'HRA', ...calculateComponent(hraPercent) },
    { component: 'Special Allowance', ...calculateComponent(specialPercent) },
    { component: 'Other Allowances', ...calculateComponent(otherPercent) },
  ];
};

interface OfferLetterManagerProps {
  onBack?: () => void;
  preSelectedCandidateId?: number | null; // Add this prop
}

type ViewMode = 'list' | 'create' | 'edit';

// Define a local type for the formData state in the component
interface OfferLetterFormData extends Omit<CreateOfferLetterInput, 'kra_details' | 'joining_bonus' | 'project_details'> {
    kra_details: string; // KRA details are managed as a single string for the textarea
    joining_bonus?: number; // Ensure it's number or undefined
    project_details?: string; // Add project_details to the form data
}

export default function OfferLetterManager({ onBack, preSelectedCandidateId }: OfferLetterManagerProps = {}) {
  const {
    offerLetters,
    isLoading,
    createOfferLetter,
    updateOfferLetter,
    deleteOfferLetter,
    isCreating,
    isUpdating,
  } = useOfferLetters();

  const { data: signatories } = useSignatories();
  const { letterheads } = useLetterheads();
  const { data: candidates } = useCandidates({ status: 'selected' });

  const [currentView, setCurrentView] = useState<ViewMode>('list');
  const [editingLetterId, setEditingLetterId] = useState<number | null>(null);
  const [formData, setFormData] = useState<OfferLetterFormData | null>(null); // Use the new local type
  const [error, setError] = useState<string | null>(null);

  // Effect to populate form when editing an existing letter
  useEffect(() => {
    if (editingLetterId !== null) {
      const letterToEdit = offerLetters.find(ol => ol.id === editingLetterId);
      if (letterToEdit) {
        let salaryBreakdown: SalaryComponent[] = [];
        if (typeof letterToEdit.salary_breakdown === 'string') {
          try {
            salaryBreakdown = JSON.parse(letterToEdit.salary_breakdown) as SalaryComponent[];
          } catch {
            salaryBreakdown = [];
          }
        } else if (Array.isArray(letterToEdit.salary_breakdown)) {
          salaryBreakdown = letterToEdit.salary_breakdown as unknown as SalaryComponent[];
        }
        
        let kraDetails: KRADetail[] = [];
        if (typeof letterToEdit.kra_details === 'string') {
          try {
            kraDetails = JSON.parse(letterToEdit.kra_details) as KRADetail[];
          } catch {
            kraDetails = [];
          }
        } else if (Array.isArray(letterToEdit.kra_details)) {
          kraDetails = letterToEdit.kra_details as unknown as KRADetail[];
        }

        setFormData({
          candidate_name: letterToEdit.candidate_name,
          candidate_address: letterToEdit.candidate_address,
          designation: letterToEdit.designation,
          project_details: letterToEdit.project_details || '', // Added project_details
          joining_date: formatDateForInput(letterToEdit.joining_date),
          annual_ctc: letterToEdit.annual_ctc,
          salary_breakdown: salaryBreakdown,
          kra_details: kraDetails.map(k => k.responsibility).join('\n'), // Convert to string for textarea
          joining_bonus: letterToEdit.joining_bonus || undefined, // Changed null to undefined for consistency with type
          offer_valid_till: formatDateForInput(letterToEdit.offer_valid_till),
          letter_date: formatDateForInput(letterToEdit.letter_date || letterToEdit.createdAt),
          hr_manager_name: letterToEdit.hr_manager_name,
          hr_manager_title: letterToEdit.hr_manager_title,
          working_location: letterToEdit.working_location,
          signatory_id: letterToEdit.signatory_id,
          secondary_signatory_id: letterToEdit.secondary_signatory_id,
          letterhead_id: letterToEdit.letterhead_id,
        });
        setCurrentView('edit');
      }
    }
  }, [editingLetterId, offerLetters]);

  // Effect to handle preSelectedCandidateId for creating new letters
  useEffect(() => {
    if (preSelectedCandidateId && candidates && currentView === 'list') {
      const candidate = candidates.find(c => c.id === preSelectedCandidateId);
      if (candidate) {
        initializeFormData(candidate);
        setCurrentView('create');
      }
    }
  }, [preSelectedCandidateId, candidates, currentView]);

  // Effect to update salary breakdown when annual_ctc changes in formData
  useEffect(() => {
    if (formData && formData.annual_ctc !== undefined) {
      const newSalaryBreakdown = generateSalaryBreakdown(formData.annual_ctc);
      setFormData(prev => prev ? { ...prev, salary_breakdown: newSalaryBreakdown } : null);
    }
  }, [formData?.annual_ctc]);

  const initializeFormData = (candidate?: Candidate) => {
    const defaultLetterhead = letterheads?.find(lh => lh.is_default) || letterheads?.[0];
    const defaultSignatory = signatories?.[0];

    setFormData({
      candidate_name: candidate ? `${candidate.first_name} ${candidate.last_name}` : '',
      candidate_address: candidate?.city || '', // Simplified for now
      designation: candidate?.vacancy_title || candidate?.current_designation || '',
      project_details: candidate?.vacancy_title || '', // Added, using vacancy_title as a placeholder
      joining_date: '',
      annual_ctc: candidate?.expected_salary || 0,
      salary_breakdown: generateSalaryBreakdown(candidate?.expected_salary || 0),
      kra_details: '',
      joining_bonus: undefined, // Changed from null
      offer_valid_till: '',
      letter_date: formatDateForInput(new Date().toISOString()),
      hr_manager_name: defaultSignatory?.name || '',
      hr_manager_title: defaultSignatory?.position || '',
      working_location: candidate?.city || '', // Simplified for now
      signatory_id: defaultSignatory?.id,
      secondary_signatory_id: undefined,
      letterhead_id: defaultLetterhead?.id,
    });
    setEditingLetterId(null);
    setCurrentView('create');
  };


  const handleCreateNew = () => {
    initializeFormData(); // Initialize with defaults (no candidate pre-selected)
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    setError(null); // Clear previous errors

    // Basic validation
    if (!formData.candidate_name || !formData.designation || !formData.joining_date || formData.annual_ctc === undefined || formData.annual_ctc <= 0) {
      setError('Please fill all required fields (Candidate Name, Designation, Joining Date, Annual CTC)');
      return;
    }

    // Convert KRA string to array of objects
    const kraArray = formData.kra_details
      ? formData.kra_details.split('\n').filter((line: string) => line.trim() !== '').map((line: string) => ({ responsibility: line.trim() })) // Added type for line
      : [];
    
    // Ensure signatory details are up-to-date
    const selectedSignatory = signatories?.find(s => s.id === formData.signatory_id);
    const selectedSecondarySignatory = signatories?.find(s => s.id === formData.secondary_signatory_id);

    const dataToSubmit: CreateOfferLetterInput = {
      ...formData,
      annual_ctc: Number(formData.annual_ctc),
      kra_details: kraArray, // kra_details is now KRADetail[]
      project_details: formData.project_details, // Added project_details
      hr_manager_name: selectedSignatory?.name || '',
      hr_manager_title: selectedSignatory?.position || '',
      secondary_signatory_id: selectedSecondarySignatory?.id,
      salary_breakdown: generateSalaryBreakdown(Number(formData.annual_ctc)), // Recalculate to ensure consistency
    };

    try {
      if (editingLetterId) {
        await updateOfferLetter(editingLetterId, dataToSubmit);
      } else {
        await createOfferLetter(dataToSubmit);
      }
      setCurrentView('list');
      setEditingLetterId(null);
      setFormData(null);
    } catch (err: any) {
      console.error('Error saving offer letter:', err);
      setError(err.message || 'Failed to save offer letter');
    }
  };

  const handleDownload = (id: number) => {
    window.open(`${API_BASE_URL}/offer-letters/${id}/pdf`, '_blank');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this offer letter?')) return;
    try {
      await deleteOfferLetter(id);
    } catch (err: any) {
      setError(err.message || 'Failed to delete offer letter');
    }
  };

  const handleEdit = (id: number) => {
    setEditingLetterId(id);
  };

  const handleCancel = () => {
    setCurrentView('list');
    setEditingLetterId(null);
    setFormData(null);
  };

  const updateField = (field: keyof OfferLetterFormData, value: any) => { // Use OfferLetterFormData here
    if (!formData) return;
    setFormData(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleCandidateSelect = (candidateId: number) => {
    const candidate = candidates?.find(c => c.id === candidateId);
    if (candidate) {
      setFormData(prev => prev ? {
        ...prev,
        candidate_name: `${candidate.first_name} ${candidate.last_name}`,
        candidate_address: candidate.city || '', // Assuming city for address
        designation: candidate.vacancy_title || candidate.current_designation || '',
        project_details: candidate.vacancy_title || '', // Assuming vacancy_title for project details
        annual_ctc: candidate.expected_salary || 0,
        working_location: candidate.city || '', // Assuming city for working location
        salary_breakdown: generateSalaryBreakdown(candidate.expected_salary || 0),
      } : null);
    }
  };

  // Render Section
  if (currentView === 'create' || currentView === 'edit') {
    if (!formData) return null; // Should not happen if logic is correct

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{editingLetterId ? 'Edit Offer Letter' : 'Create New Offer Letter'}</h1>
            <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
          </div>

          {error && (
            <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            {/* Candidate Selection */}
            {currentView === 'create' && (
              <div>
                <label htmlFor="candidate-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Candidate (to pre-fill details)</label>
                <select
                  id="candidate-select"
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                  value={preSelectedCandidateId || ''} // Use preSelectedCandidateId here
                  onChange={(e) => handleCandidateSelect(Number(e.target.value))}
                >
                  <option value="">-- Select Candidate --</option>
                  {candidates?.map(candidate => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.first_name} {candidate.last_name} ({candidate.vacancy_title || candidate.current_designation})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Main Form Fields */}
            <div>
              <label htmlFor="candidate_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Candidate Name</label>
              <input type="text" id="candidate_name" value={formData.candidate_name} onChange={(e) => updateField('candidate_name', e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" required />
            </div>
            <div>
              <label htmlFor="candidate_address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Candidate Address</label>
              <textarea id="candidate_address" value={formData.candidate_address} onChange={(e) => updateField('candidate_address', e.target.value)} rows={3} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"></textarea>
            </div>
            <div>
              <label htmlFor="designation" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Designation</label>
              <input type="text" id="designation" value={formData.designation} onChange={(e) => updateField('designation', e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" required />
            </div>
            <div>
              <label htmlFor="project_details" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Project Details</label>
              <input type="text" id="project_details" value={formData.project_details || ''} onChange={(e) => updateField('project_details', e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="joining_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Joining Date</label>
                <input type="date" id="joining_date" value={formData.joining_date} onChange={(e) => updateField('joining_date', e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" required />
              </div>
              <div>
                <label htmlFor="annual_ctc" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Annual CTC (₹)</label>
                <input type="number" id="annual_ctc" value={formData.annual_ctc} onChange={(e) => updateField('annual_ctc', Number(e.target.value))} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" required min="0" />
              </div>
            </div>
            <div>
              <label htmlFor="working_location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Working Location</label>
              <input type="text" id="working_location" value={formData.working_location || ''} onChange={(e) => updateField('working_location', e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" />
            </div>

            {/* Salary Breakdown Preview */}
            {formData.annual_ctc > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Salary Breakdown Preview (Annexure A)</h3>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-100 dark:bg-gray-600">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Component</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Per Month (₹)</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Per Annum (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {formData.salary_breakdown?.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{item.component}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-right">{item.perMonth?.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-right">{item.annual?.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-gray-200 dark:bg-gray-600">
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">Total CTC</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">{(Number(formData.annual_ctc) / 12).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">{Number(formData.annual_ctc).toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* KRA Details */}
            <div>
              <label htmlFor="kra_details" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Key Responsibility Areas (KRA - one per line)</label>
              <textarea id="kra_details" value={formData.kra_details} onChange={(e) => updateField('kra_details', e.target.value)} rows={5} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" placeholder="Enter each KRA on a new line"></textarea>
            </div>

            {/* Signatories & Letterhead */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="signatory_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">HR Signatory</label>
                <select id="signatory_id" value={formData.signatory_id || ''} onChange={(e) => updateField('signatory_id', Number(e.target.value))} className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" required>
                  <option value="">-- Select HR Signatory --</option>
                  {signatories?.map(s => <option key={s.id} value={s.id}>{s.name} - {s.position}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="secondary_signatory_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Secondary Signatory (Optional)</label>
                <select id="secondary_signatory_id" value={formData.secondary_signatory_id || ''} onChange={(e) => updateField('secondary_signatory_id', Number(e.target.value))} className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200">
                  <option value="">-- None --</option>
                  {signatories?.map(s => <option key={s.id} value={s.id}>{s.name} - {s.position}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="letterhead_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Letterhead</label>
              <select id="letterhead_id" value={formData.letterhead_id || ''} onChange={(e) => updateField('letterhead_id', Number(e.target.value))} className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200">
                <option value="">-- Default / No Letterhead --</option>
                {letterheads?.map(lh => <option key={lh.id} value={lh.id}>{lh.name} {lh.is_default && '(Default)'}</option>)}
              </select>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={handleCancel} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50" disabled={isCreating || isUpdating}>
                {(isCreating || isUpdating) ? 'Saving...' : 'Save Offer Letter'}
              </button>
              {editingLetterId && (
                <button type="button" onClick={() => handleDownload(editingLetterId)} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Preview/Download PDF</button>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Offer Letters</h1>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
          )}
          <button onClick={handleCreateNew} className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-md">
            Create New Offer Letter
          </button>
        </div>

        {error && (
            <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
              {error}
            </div>
          )}

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Candidate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Designation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">CTC</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Joining Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {offerLetters.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No offer letters created yet.</td>
                  </tr>
                ) : (
                  offerLetters.map((letter) => (
                    <tr key={letter.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{letter.candidate_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{letter.designation}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">₹{letter.annual_ctc.toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{letter.joining_date}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          letter.status === 'approved' ? 'bg-green-100 text-green-800' :
                          letter.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {letter.status || 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleEdit(letter.id)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 mr-3">Edit</button>
                        <button onClick={() => handleDownload(letter.id)} className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-200 mr-3">Download PDF</button>
                        <button onClick={() => handleDelete(letter.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
