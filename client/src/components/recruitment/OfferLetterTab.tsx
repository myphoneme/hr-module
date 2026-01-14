import { useState, useEffect, useRef } from 'react';
import { useCandidates, useUpdateCandidate } from '../../hooks/useRecruitment';
import { useSignatories } from '../../hooks/useSignatories';
import { useLetterheads } from '../../hooks/useLetterheads';
import { useOfferLetters } from '../../hooks/useOfferLetters';
import { useRAG } from '../../hooks/useRAG';
import { useMockRecruitment } from '../../contexts/MockRecruitmentContext';
import type { Signatory, SalaryComponent, OfferLetterWithSignatory } from '../../types';

export default function OfferLetterTab() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLetter, setEditingLetter] = useState<OfferLetterWithSignatory | null>(null);
  const [viewingLetter, setViewingLetter] = useState<OfferLetterWithSignatory | null>(null);
  const [selectedCandidateForOffer, setSelectedCandidateForOffer] = useState<number | null>(null);
  const [emailingLetter, setEmailingLetter] = useState<OfferLetterWithSignatory | null>(null);

  // Fetch data
  const { data: signatories } = useSignatories();
  const { letterheads } = useLetterheads();
  const { offerLetters, isLoading: lettersLoading, deleteOfferLetter, updateOfferLetter, isDeleting, isUpdating } = useOfferLetters();

  // Fetch selected candidates (those who passed interview)
  const { data: selectedCandidates, isLoading: candidatesLoading } = useCandidates({ status: 'selected' });
  const { mockCandidates } = useMockRecruitment();

  // Get mock selected candidates
  const mockSelectedCandidates = mockCandidates.filter(c => c.status === 'selected');

  // Combine API and mock candidates
  const allSelectedCandidates = [
    ...(selectedCandidates || []),
    ...mockSelectedCandidates.map(c => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone,
      vacancy_title: c.vacancy_title,
      experience_years: c.experience_years,
      current_designation: c.current_designation,
      expected_salary: c.expected_salary,
      screening_score: c.screening_score,
      city: c.location, // MockCandidate uses 'location'
      isMock: true,
    })),
  ];

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

      {/* Selected Candidates Section - Table Format */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Selected Candidates ({allSelectedCandidates?.length || 0})
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Candidates who passed interview - ready for offer letter
              </p>
            </div>
          </div>
          {allSelectedCandidates?.length > 0 && (
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
              {allSelectedCandidates.length} pending offer{allSelectedCandidates.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {candidatesLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          </div>
        ) : allSelectedCandidates && allSelectedCandidates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Candidate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Experience</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Expected CTC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {allSelectedCandidates.map((candidate: any) => (
                  <tr key={`${candidate.isMock ? 'mock-' : ''}${candidate.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{candidate.first_name} {candidate.last_name}</p>
                        <p className="text-sm text-gray-500">{candidate.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{candidate.vacancy_title || candidate.current_designation || 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{candidate.experience_years || 0} yrs</td>
                    <td className="px-4 py-3 text-blue-600 dark:text-blue-400 font-medium">
                      {candidate.expected_salary ? `${(candidate.expected_salary / 100000).toFixed(1)} LPA` : 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      {candidate.screening_score ? (
                        <span className={`font-medium ${candidate.screening_score >= 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                          {candidate.screening_score}%
                        </span>
                      ) : 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 text-xs rounded-full font-medium">
                        Selected
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSelectedCandidateForOffer(candidate.id);
                          setShowCreateModal(true);
                        }}
                        className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-1.5 font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Create Offer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Selected Candidates</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Candidates who pass the interview will appear here for offer letter generation.
            </p>
          </div>
        )}
      </div>

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
                          onClick={() => setEmailingLetter(letter)}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded"
                          title="Send Email"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
          onClose={() => {
            setShowCreateModal(false);
            setSelectedCandidateForOffer(null);
          }}
          signatories={signatories || []}
          letterheads={letterheads || []}
          preSelectedCandidateId={selectedCandidateForOffer}
        />
      )}

      {/* View Modal */}
      {viewingLetter && (
        <ViewOfferLetterModal
          letter={viewingLetter}
          onClose={() => setViewingLetter(null)}
          onDownload={() => handleDownload(viewingLetter)}
          letterheads={letterheads || []}
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

      {/* Send Email Modal */}
      {emailingLetter && (
        <SendEmailModal
          letter={emailingLetter}
          onClose={() => setEmailingLetter(null)}
        />
      )}
    </div>
  );
}

// Chat-based Offer Letter Creation Modal
function CreateOfferLetterModal({
  onClose,
  signatories,
  letterheads,
  preSelectedCandidateId,
}: {
  onClose: () => void;
  signatories: Signatory[];
  letterheads: any[];
  preSelectedCandidateId?: number | null;
}) {
  const { data: apiCandidates } = useCandidates({ status: 'selected' });
  const { mockCandidates, updateMockCandidate } = useMockRecruitment();
  const { createOfferLetter } = useOfferLetters();
  const { learnedPatterns } = useRAG();
  const updateCandidateMutation = useUpdateCandidate();

  // Get selected candidates
  const mockSelectedCandidates = mockCandidates.filter(c => c.status === 'selected');
  const allSelectedCandidates = [
    ...(apiCandidates || []),
    ...mockSelectedCandidates.map(c => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone,
      vacancy_id: c.vacancy_id,
      vacancy_title: c.vacancy_title,
      experience_years: c.experience_years,
      current_designation: c.current_designation,
      current_company: c.current_company,
      city: c.location,
      expected_salary: c.expected_salary,
      current_salary: c.current_salary,
      skills: c.skills,
      isMock: true,
    })),
  ];

  // Find the selected candidate
  const selectedCandidate = allSelectedCandidates?.find(c => c.id === preSelectedCandidateId);

  // Chat state - input -> confirm -> signatory -> director -> kra -> generating -> done
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'assistant' | 'user'; content: string }>>([]);
  const [userInput, setUserInput] = useState('');
  const [chatStep, setChatStep] = useState<'input' | 'confirm' | 'signatory' | 'director' | 'kra' | 'generating' | 'done'>('input');
  const [newKraItem, setNewKraItem] = useState('');
  const [extractedData, setExtractedData] = useState<{ ctc: number | null; joiningDate: string | null }>({
    ctc: null,
    joiningDate: null,
  });
  const [kraDetails, setKraDetails] = useState<string[]>([]);
  const [selectedHrSignatory, setSelectedHrSignatory] = useState<any>(null);
  const [selectedDirectorSignatory, setSelectedDirectorSignatory] = useState<any>(null);
  const [vacancyLocation, setVacancyLocation] = useState<string>('');
  const [candidateVacancyId, setCandidateVacancyId] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch candidate's vacancy details when modal opens (KRA will be added manually)
  useEffect(() => {
    const fetchCandidateVacancy = async () => {
      if (!selectedCandidate) return;

      // Fetch vacancy details for non-mock candidates
      if (!(selectedCandidate as any).isMock) {
        try {
          const response = await fetch(`http://localhost:3001/api/offer-letters/candidate-vacancy/${selectedCandidate.id}`, {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            if (data.vacancy_location) {
              setVacancyLocation(data.vacancy_location);
            }
            if (data.vacancy_id) {
              setCandidateVacancyId(data.vacancy_id);
            }
          }
        } catch (error) {
          console.error('Error fetching candidate vacancy:', error);
        }
      }
    };

    fetchCandidateVacancy();
  }, [selectedCandidate]);

  // Get signatories
  const hrSignatory = signatories?.[0];
  const directorSignatory = signatories?.find((s: Signatory) =>
    s.position.toLowerCase().includes('director') ||
    s.position.toLowerCase().includes('ceo') ||
    s.position.toLowerCase().includes('managing')
  );
  const defaultLetterhead = letterheads?.find((l: any) => l.is_default) || letterheads?.[0];

  // Initialize chat with greeting
  useEffect(() => {
    if (selectedCandidate && chatMessages.length === 0) {
      const expectedCtc = selectedCandidate.expected_salary
        ? `${(selectedCandidate.expected_salary / 100000).toFixed(1)} LPA`
        : 'not specified';

      const locationInfo = vacancyLocation ? `\nLocation (from JD): ${vacancyLocation}` : '';

      setChatMessages([{
        role: 'assistant',
        content: `Creating offer letter for **${selectedCandidate.first_name} ${selectedCandidate.last_name}**\n\nPosition: ${selectedCandidate.vacancy_title || selectedCandidate.current_designation || 'N/A'}${locationInfo}\nExpected CTC: ${expectedCtc}\n\nPlease enter **CTC and Joining Date** together:\n(e.g., "5 LPA, 15 Jan 2025" or "500000, 01/02/2025")`
      }]);
    }
  }, [selectedCandidate, vacancyLocation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Parse CTC from natural language
  const parseCTC = (input: string): number | null => {
    const cleanInput = input.toLowerCase().trim();

    // Match patterns like "5 lpa", "5lpa", "5 lakhs", "500000", "5,00,000"
    const lpaMatch = cleanInput.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|l)/);
    if (lpaMatch) {
      return parseFloat(lpaMatch[1]) * 100000;
    }

    // Plain number (could be full amount or lakhs)
    const numericValue = cleanInput.replace(/[,\s]/g, '');
    const num = parseFloat(numericValue);
    if (!isNaN(num)) {
      // If less than 1000, assume it's in lakhs
      return num < 1000 ? num * 100000 : num;
    }

    return null;
  };

  // Parse date from natural language
  const parseJoiningDate = (input: string): string | null => {
    const cleanInput = input.toLowerCase().trim();

    const monthMap: Record<string, string> = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
      'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };

    // Try DD MMM format
    const monthMatch = cleanInput.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{2,4})?/i);
    if (monthMatch) {
      const day = monthMatch[1].padStart(2, '0');
      const month = monthMap[monthMatch[2].toLowerCase().substring(0, 3)];
      let year = monthMatch[3] || new Date().getFullYear().toString();
      if (year.length === 2) year = '20' + year;
      return `${year}-${month}-${day}`;
    }

    // Try DD/MM/YYYY format
    const slashMatch = cleanInput.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (slashMatch) {
      const day = slashMatch[1].padStart(2, '0');
      const month = slashMatch[2].padStart(2, '0');
      let year = slashMatch[3];
      if (year.length === 2) year = '20' + year;
      return `${year}-${month}-${day}`;
    }

    // Try YYYY-MM-DD format
    const isoMatch = cleanInput.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    }

    return null;
  };

  // Handle user input - parse both CTC and joining date together
  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    const userMessage = userInput.trim();
    setUserInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    if (chatStep === 'input') {
      // Try to extract both CTC and date from the message
      const ctc = parseCTC(userMessage);
      const joiningDate = parseJoiningDate(userMessage);

      if (ctc && ctc > 0 && joiningDate) {
        // Both found - go to confirm
        const dateObj = new Date(joiningDate);
        const formattedDate = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

        setExtractedData({ ctc, joiningDate });
        setChatStep('confirm');
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `**Summary:**\n- Candidate: ${selectedCandidate?.first_name} ${selectedCandidate?.last_name}\n- Position: ${selectedCandidate?.vacancy_title || 'N/A'}\n- CTC: **₹${ctc.toLocaleString()}** (${(ctc / 100000).toFixed(1)} LPA)\n- Joining Date: **${formattedDate}**\n\nType **"yes"** to generate offer letter, or **"edit"** to change:`
        }]);
      } else if (ctc && ctc > 0) {
        // Only CTC found
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `CTC: **₹${ctc.toLocaleString()}** (${(ctc / 100000).toFixed(1)} LPA)\n\nCouldn't find joining date. Please include date:\n(e.g., "5 LPA, 15 Jan 2025")`
        }]);
      } else if (joiningDate) {
        // Only date found
        const dateObj = new Date(joiningDate);
        const formattedDate = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `Date: **${formattedDate}**\n\nCouldn't find CTC. Please include amount:\n(e.g., "5 LPA, 15 Jan 2025")`
        }]);
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `Please enter both CTC and joining date:\n(e.g., "5 LPA, 15 Jan 2025" or "500000, 01/02/2025")`
        }]);
      }
    } else if (chatStep === 'confirm') {
      const confirm = userMessage.toLowerCase();
      if (confirm === 'yes' || confirm === 'confirm' || confirm === 'ok' || confirm === 'y') {
        // Move to signatory selection step
        setChatStep('signatory');
        const signatoryList = signatories?.map((s: any, idx: number) =>
          `${idx + 1}. ${s.name} - ${s.position}`
        ).join('\n') || 'No signatories available';

        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `**Select HR Signatory:**\n\n${signatoryList}\n\nEnter the number to select HR signatory:`
        }]);
      } else if (confirm === 'edit' || confirm === 'no' || confirm === 'restart') {
        setChatStep('input');
        setExtractedData({ ctc: null, joiningDate: null });
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `Let's start over.\n\nPlease enter **CTC and Joining Date** together:\n(e.g., "5 LPA, 15 Jan 2025")`
        }]);
      } else {
        // User might be trying to provide new values
        const ctc = parseCTC(confirm);
        const joiningDate = parseJoiningDate(confirm);
        if (ctc || joiningDate) {
          // User is providing new values, go back to input
          setChatStep('input');
          handleSendMessage();
        } else {
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: `Type **"yes"** to generate, or **"edit"** to change.`
          }]);
        }
      }
    } else if (chatStep === 'signatory') {
      // HR signatory selection
      const selection = parseInt(userMessage.trim());
      if (!isNaN(selection) && selection >= 1 && selection <= (signatories?.length || 0)) {
        const selected = signatories?.[selection - 1];
        setSelectedHrSignatory(selected);
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `✓ HR Signatory: **${selected.name}** (${selected.position})`
        }]);

        // Move to KRA manual entry step
        setChatStep('kra');
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `**Add Key Responsibility Areas (KRA)**\n\nPlease add KRA items for this designation. Different designations require different KRAs.\n\nUse the form below to add each KRA item. When done, click **"Generate Offer Letter"**.`
        }]);
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `Please enter a valid number (1-${signatories?.length || 0}) to select HR signatory.`
        }]);
      }
    }
  };

  // Generate offer letter with optional KRA
  const generateOfferLetterWithKRA = async (kra: string[]) => {
    await generateOfferLetter(kra);
  };

  // Generate offer letter
  const generateOfferLetter = async (kra?: string[]) => {
    if (!extractedData.ctc || !extractedData.joiningDate || !selectedCandidate) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Missing required data. Please provide both CTC and joining date.'
      }]);
      setChatStep('input');
      return;
    }

    try {
      const candidateName = `${selectedCandidate.first_name} ${selectedCandidate.last_name}`.trim();
      const candidateData = selectedCandidate as any;
      const addressParts = [candidateData?.address, candidateData?.city, candidateData?.state, candidateData?.pincode].filter(Boolean);
      const candidateAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Address not provided';
      const designation = selectedCandidate.vacancy_title || selectedCandidate.current_designation || 'Software Engineer';

      // Use vacancy location from JD, or fall back to default
      const workingLocation = vacancyLocation ||
        learnedPatterns?.companyDefaults?.working_location ||
        'Phoneme Solutions Pvt Ltd, Advant Navis Business Park, B-614 Sector 142, Noida-201307';

      const today = new Date().toISOString().split('T')[0];
      const offerValidTill = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Calculate salary breakdown
      const annualCTC = extractedData.ctc;
      const basicPercent = 40;
      const hraPercent = 20;
      const specialPercent = 25;
      const otherPercent = 15;

      const salaryBreakdown: SalaryComponent[] = [
        { component: 'Basic Salary', perMonth: Math.round((annualCTC * basicPercent / 100) / 12), annual: Math.round(annualCTC * basicPercent / 100) },
        { component: 'HRA', perMonth: Math.round((annualCTC * hraPercent / 100) / 12), annual: Math.round(annualCTC * hraPercent / 100) },
        { component: 'Special Allowance', perMonth: Math.round((annualCTC * specialPercent / 100) / 12), annual: Math.round(annualCTC * specialPercent / 100) },
        { component: 'Other Allowances', perMonth: Math.round((annualCTC * otherPercent / 100) / 12), annual: Math.round(annualCTC * otherPercent / 100) },
      ];

      // Use selected signatories or defaults
      const hrSig = selectedHrSignatory || hrSignatory;
      const dirSig = selectedDirectorSignatory || directorSignatory;

      // Debug: Log KRA data being sent
      const kraData = kra && kra.length > 0 ? kra.map(k => ({ responsibility: k })) : undefined;
      console.log('=== Client: Creating Offer Letter ===');
      console.log('kra parameter:', kra);
      console.log('kra length:', kra?.length);
      console.log('kra_details being sent:', kraData);
      console.log('=== End Client Debug ===');

      await createOfferLetter({
        candidate_name: candidateName,
        candidate_address: candidateAddress,
        designation: designation,
        joining_date: extractedData.joiningDate,
        letter_date: today,
        annual_ctc: annualCTC,
        offer_valid_till: offerValidTill,
        working_location: workingLocation,
        hr_manager_name: hrSig?.name || 'HR Manager',
        hr_manager_title: hrSig?.position || 'Manager-Human Resource',
        template_type: 'long',
        salary_breakdown: salaryBreakdown,
        signatory_id: hrSig?.id,
        secondary_signatory_id: null,
        letterhead_id: defaultLetterhead?.id,
        kra_details: kraData,
      });

      // Update candidate status to 'offer_sent' so they don't appear in selected candidates
      if ((selectedCandidate as any)?.isMock) {
        // Update mock candidate status
        updateMockCandidate(selectedCandidate.id, { status: 'offer_sent' });
      } else {
        // Update real candidate status via API
        updateCandidateMutation.mutate({
          id: selectedCandidate.id,
          candidate: { status: 'offer_sent' }
        });
      }

      setChatStep('done');
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Offer letter generated successfully!\n\nYou can now view, edit, or download it from the Created Offer Letters section below.`
      }]);
    } catch (err: any) {
      setChatStep('confirm');
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to generate offer letter'}. Please try again by typing "yes".`
      }]);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!selectedCandidate) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <p className="text-red-500">Candidate not found</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 rounded">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full flex flex-col" style={{ height: '600px' }}>
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex justify-between items-center bg-green-50 dark:bg-green-900/20 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Create Offer Letter</h2>
              <p className="text-xs text-gray-500">{selectedCandidate.first_name} {selectedCandidate.last_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">&times;</button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-green-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
              }`}>
                <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{
                  __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')
                }} />
              </div>
            </div>
          ))}
          {chatStep === 'generating' && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Generating...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800 rounded-b-lg">
          {chatStep === 'done' ? (
            <button
              onClick={onClose}
              className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Done
            </button>
          ) : chatStep === 'kra' ? (
            <div className="space-y-3">
              {/* KRA List */}
              {kraDetails.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1.5">
                  {kraDetails.map((kra, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-gray-50 dark:bg-gray-700 rounded px-2 py-1.5 text-sm">
                      <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{idx + 1}.</span>
                      <span className="flex-1 text-gray-800 dark:text-gray-200">{kra}</span>
                      <button
                        onClick={() => {
                          setKraDetails(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="text-red-500 hover:text-red-700 flex-shrink-0"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* Add KRA Input */}
              <div className="flex gap-2 items-end">
                <textarea
                  value={newKraItem}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.includes('\n')) {
                      const newKras = value.split('\n').map(k => k.trim()).filter(k => k);
                      if (newKras.length > 0) {
                        setKraDetails(prev => [...prev, ...newKras]);
                        setNewKraItem('');
                      }
                    } else {
                      setNewKraItem(value);
                    }
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && newKraItem.trim()) {
                      e.preventDefault();
                      setKraDetails(prev => [...prev, newKraItem.trim()]);
                      setNewKraItem('');
                    }
                  }}
                  placeholder="Enter a KRA item and press Enter (Shift+Enter for new line)"
                  rows={2}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>
              {/* Generate Button */}
              <button
                onClick={async () => {
                  setChatStep('generating');
                  const kraCount = kraDetails.length;
                  setChatMessages(prev => [...prev, {
                    role: 'assistant',
                    content: kraCount > 0
                      ? `Generating offer letter with ${kraCount} KRA${kraCount > 1 ? 's' : ''} in Annexure-B...`
                      : `Generating offer letter without KRAs...`
                  }]);
                  await generateOfferLetterWithKRA(kraDetails);
                }}
                className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generate Offer Letter {kraDetails.length > 0 && `(${kraDetails.length} KRA${kraDetails.length > 1 ? 's' : ''})`}
              </button>
            </div>
          ) : (
            <div className="flex gap-2 items-end">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  chatStep === 'input' ? 'e.g., 5 LPA, 15 Jan 2025...' :
                  chatStep === 'signatory' ? 'Enter number to select HR signatory...' :
                  chatStep === 'director' ? 'Enter number or skip...' :
                  'Type yes to confirm...'
                }
                disabled={chatStep === 'generating'}
                rows={2}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={chatStep === 'generating' || !userInput.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 h-10"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// View Modal Component - PDF-like Preview with Letterhead (Matching actual offer letter format)
function ViewOfferLetterModal({
  letter,
  onClose,
  onDownload,
  letterheads,
}: {
  letter: OfferLetterWithSignatory;
  onClose: () => void;
  onDownload: () => void;
  letterheads: any[];
}) {
  const [headerImageError, setHeaderImageError] = useState(false);
  const [footerImageError, setFooterImageError] = useState(false);

  // Parse salary breakdown if it's a string
  const salaryBreakdown = typeof letter.salary_breakdown === 'string'
    ? JSON.parse(letter.salary_breakdown)
    : letter.salary_breakdown || [];

  // Get the letterhead for this offer letter
  const letterhead = letterheads?.find((l: any) => l.id === letter.letterhead_id) ||
    letterheads?.find((l: any) => l.is_default) ||
    letterheads?.[0];

  // Format date for display (short format like 6-Dec-25)
  const formatDateShort = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleDateString('en-IN', { month: 'short' });
    const year = date.getFullYear().toString().slice(-2);
    return `${day}-${month}-${year}`;
  };

  // Format date for display (long format)
  const formatDateLong = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleDateString('en-IN', { month: 'short' });
    const year = date.getFullYear();
    return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
  };

  // Get ordinal suffix for date
  const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  // Convert number to words (Indian format - Lakh, Thousand)
  const numberToWords = (num: number): string => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (num === 0) return 'Zero';

    const convertLakh = (n: number): string => {
      if (n >= 100000) {
        const lakhs = Math.floor(n / 100000);
        const remainder = n % 100000;
        return `${convertThousand(lakhs)} Lakh${remainder > 0 ? ' ' + convertLakh(remainder) : ''}`;
      }
      return convertThousand(n);
    };

    const convertThousand = (n: number): string => {
      if (n >= 1000) {
        const thousands = Math.floor(n / 1000);
        const remainder = n % 1000;
        return `${convertHundred(thousands)} Thousand${remainder > 0 ? ' ' + convertHundred(remainder) : ''}`;
      }
      return convertHundred(n);
    };

    const convertHundred = (n: number): string => {
      if (n >= 100) {
        const hundreds = Math.floor(n / 100);
        const remainder = n % 100;
        return `${ones[hundreds]} Hundred${remainder > 0 ? ' ' + convertTens(remainder) : ''}`;
      }
      return convertTens(n);
    };

    const convertTens = (n: number): string => {
      if (n < 20) return ones[n];
      const ten = Math.floor(n / 10);
      const one = n % 10;
      return tens[ten] + (one > 0 ? '-' + ones[one] : '');
    };

    return convertLakh(num);
  };

  // API base URL for images
  const API_BASE = 'http://localhost:3001';

  // Generate reference number
  const currentYear = new Date().getFullYear();
  const nextYear = (currentYear + 1).toString().slice(-2);
  const refNumber = `HR/Offer/${currentYear.toString().slice(-2)}-${nextYear}/${String(letter.id).padStart(6, '0')}`;

  // Get candidate first name for salutation
  const firstName = letter.candidate_name?.split(' ')[0] || letter.candidate_name;

  // Check if we should show image or fallback
  const showHeaderImage = letterhead?.header_image && !headerImageError;
  const showFooterImage = letterhead?.footer_image && !footerImageError;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-100 rounded-lg shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col">
        {/* Header toolbar */}
        <div className="flex-shrink-0 bg-gray-800 text-white px-4 py-2 rounded-t-lg flex justify-between items-center">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm-3 9v6H8v-6h2zm4 6h-2v-4h2v4zm4 0h-2v-2h2v2z"/>
            </svg>
            <span className="text-sm font-medium">Offer Letter - {letter.candidate_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              letter.status === 'approved' ? 'bg-green-600' :
              letter.status === 'sent' ? 'bg-blue-600' :
              'bg-yellow-600'
            }`}>
              {letter.status?.toUpperCase() || 'DRAFT'}
            </span>
            <button onClick={onDownload} className="p-1.5 hover:bg-gray-700 rounded" title="Download PDF">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-700 rounded">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* PDF-like document preview */}
        <div className="flex-1 overflow-y-auto p-6 flex justify-center bg-gray-500">
          <div className="bg-white shadow-xl w-full max-w-[210mm]" style={{ fontFamily: 'Times New Roman, serif' }}>
            {/* Letterhead Header - Use uploaded header image or show default PHONEME header */}
            {showHeaderImage ? (
              <div className="w-full">
                <img
                  src={`${API_BASE}${letterhead.header_image}`}
                  alt="Company Header"
                  className="w-full h-auto object-contain"
                  onError={() => setHeaderImageError(true)}
                />
              </div>
            ) : (
              <div className="px-8 py-5 border-b-4" style={{ borderColor: '#E65100' }}>
                <h1 className="text-4xl font-bold tracking-wider" style={{ color: '#E65100', fontFamily: 'Arial Black, sans-serif' }}>
                  PHONEME
                </h1>
              </div>
            )}

            {/* Letter Content */}
            <div className="px-10 py-6 text-gray-800 text-[13px] leading-relaxed">
              {/* Title */}
              <h2 className="text-center font-bold text-lg mb-4" style={{ color: '#E65100' }}>
                OFFER CUM APPOINTMENT LETTER
              </h2>

              {/* Reference and Date */}
              <div className="flex justify-between mb-6">
                <p className="font-bold">{refNumber}</p>
                <p className="font-bold">{formatDateShort(letter.letter_date || letter.createdAt)}</p>
              </div>

              {/* Salutation */}
              <p className="mb-4">Dear {firstName},</p>

              {/* Opening Paragraph */}
              <p className="mb-4 text-justify">
                On behalf of <strong>Phoneme Solutions Pvt. Ltd.</strong> Based on your applications, interviews &
                discussions we have had, we are pleased to offer you the position of <strong>{letter.designation}</strong> at
                our office in {letter.working_location || '703-7th Floor Narain Manzil, Barakhamba Road, Connaught Place, New Delhi-110001, India'}.
                You will be reporting to the concerned Manager at the designated office. Your employment with us shall be
                governed by the following terms and conditions. This offer will be valid till the Date of Joining <strong>{formatDateLong(letter.joining_date)}</strong>.
              </p>

              {/* Section 1: Commencement of Appointment */}
              <p className="font-bold mb-3" style={{ color: '#E65100' }}>1.{'\u00A0\u00A0\u00A0\u00A0'}COMMENCEMENT OF APPOINTMENT:</p>

              <p className="mb-4 text-justify">
                Your appointment is effective from the date of joining which shall be not later than <strong>{formatDateLong(letter.joining_date)}</strong>.
                On the date of your joining, you are required to handover previous companies relieving
                letter & conduct certificate, before signing the hardcopy of this offer letter in order to complete
                the onboarding process headquartered at Phoneme Solutions Pvt. Ltd. {letter.working_location || 'Advant Navis Business Park, B-614 Sector 142, Noida-201307'}.
                Please note that if at any point in time, the Company is of the opinion that the documents provided are false or your
                background verification is not satisfactory, your employment may be terminated with immediate effect.
              </p>

              <p className="mb-4 text-justify">
                During your period of employment, your Annual CTC will be <strong style={{ color: '#E65100' }}>Rs. {letter.annual_ctc?.toLocaleString('en-IN')}/- ({numberToWords(letter.annual_ctc || 0)} only) Per Annum</strong>.
                For detailed breakup please refer to Annexure A.
              </p>

              <p className="mb-4 text-sm italic">
                Note: - "Subject to Deduction of contributions, charges and taxes at source as per the
                Laws/Acts of Government of India, as may be applicable from time to time".
              </p>

              <p className="mb-4 text-justify">
                Your employment is subject to the terms and conditions set forth in this offer letter and the
                rules and regulations as set out in the Company's HR policy guidelines:
              </p>

              {/* Bullet Points with Arrow Markers */}
              <div className="ml-4 mb-4">
                <p className="mb-3 text-justify flex">
                  <span className="mr-2" style={{ color: '#E65100' }}>➤</span>
                  <span>
                    Pre-employment and ongoing screening: The Company shall conduct in its sole
                    discretion, background and reference checks and verify your salary and employment
                    history. Your initial and ongoing employment is conditional on the Company being
                    satisfied that the results of the background check are compatible with the inherent
                    requirements of your position in the Company. If in the opinion of the Company, any
                    of your background checks, reference checks, employment history or visas etc. are not
                    satisfactory, then the Company may choose not to commence your employment, or
                    where you have already started, may terminate your employment immediately, with no
                    liability to pay compensation to you for such termination.
                  </span>
                </p>

                <p className="mb-3 text-justify flex">
                  <span className="mr-2" style={{ color: '#E65100' }}>➤</span>
                  <span>
                    Termination shall be as per the terms of this agreement and the requirements of
                    applicable law.
                  </span>
                </p>

                <p className="mb-3 text-justify flex">
                  <span className="mr-2" style={{ color: '#E65100' }}>➤</span>
                  <span>
                    Confidentiality: During your employment, you will have access to confidential information
                    relating to the Company's business. You agree to maintain strict confidentiality of such
                    information both during and after your employment.
                  </span>
                </p>

                <p className="mb-3 text-justify flex">
                  <span className="mr-2" style={{ color: '#E65100' }}>➤</span>
                  <span>
                    Notice Period: Either party may terminate this employment by providing one month's
                    written notice or payment in lieu thereof, unless terminated for cause.
                  </span>
                </p>
              </div>

              {/* Section 2: Salary Breakup - Annexure A */}
              <p className="font-bold mb-3 mt-6" style={{ color: '#E65100' }}>ANNEXURE A - SALARY BREAKUP</p>

              <div className="border border-gray-400 mb-6 overflow-hidden">
                <table className="w-full text-sm">
                  <thead style={{ backgroundColor: '#E65100' }} className="text-white">
                    <tr>
                      <th className="py-2 px-4 text-left border-r border-orange-400">Component</th>
                      <th className="py-2 px-4 text-right border-r border-orange-400">Per Month (₹)</th>
                      <th className="py-2 px-4 text-right">Per Annum (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryBreakdown.map((item: SalaryComponent, index: number) => (
                      <tr key={index} className="border-b border-gray-300">
                        <td className="py-2 px-4 border-r border-gray-300">{item.component}</td>
                        <td className="py-2 px-4 text-right border-r border-gray-300">{item.perMonth?.toLocaleString('en-IN')}</td>
                        <td className="py-2 px-4 text-right">{item.annual?.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                    <tr className="font-bold" style={{ backgroundColor: '#FFF3E0' }}>
                      <td className="py-2 px-4 border-r border-gray-300">Total CTC</td>
                      <td className="py-2 px-4 text-right border-r border-gray-300">{Math.round((letter.annual_ctc || 0) / 12).toLocaleString('en-IN')}</td>
                      <td className="py-2 px-4 text-right" style={{ color: '#E65100' }}>{letter.annual_ctc?.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Closing */}
              <p className="mb-4 text-justify">
                We look forward to you joining our team and contributing to our organization's success.
                Please sign and return a copy of this letter as your acceptance of this offer.
              </p>

              <p className="mb-6">Warm Regards,</p>

              {/* Signatures */}
              <div className="flex justify-between mt-8">
                <div>
                  <p className="font-bold">{letter.signatory_name || letter.hr_manager_name || 'HR Manager'}</p>
                  <p className="text-sm text-gray-600">{letter.signatory_position || letter.hr_manager_title || 'Manager - Human Resource'}</p>
                  <p className="text-sm text-gray-600">Phoneme Solutions Pvt. Ltd.</p>
                </div>
                {letter.secondary_signatory_name && (
                  <div className="text-right">
                    <p className="font-bold">{letter.secondary_signatory_name}</p>
                    <p className="text-sm text-gray-600">{letter.secondary_signatory_position}</p>
                    <p className="text-sm text-gray-600">Phoneme Solutions Pvt. Ltd.</p>
                  </div>
                )}
              </div>

              {/* Acceptance Section */}
              <div className="mt-10 pt-4 border-t-2 border-dashed border-gray-400">
                <p className="font-bold mb-4" style={{ color: '#E65100' }}>ACCEPTANCE OF OFFER</p>
                <p className="mb-4 text-sm">
                  I, <strong>{letter.candidate_name}</strong>, hereby accept the terms and conditions of employment
                  as stated in this offer letter.
                </p>
                <div className="flex justify-between mt-6">
                  <div>
                    <p className="text-sm">Signature: _______________________</p>
                  </div>
                  <div>
                    <p className="text-sm">Date: _______________________</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Letterhead Footer - Use uploaded footer image or show default PHONEME footer */}
            {showFooterImage ? (
              <div className="w-full">
                <img
                  src={`${API_BASE}${letterhead.footer_image}`}
                  alt="Company Footer"
                  className="w-full h-auto object-contain"
                  onError={() => setFooterImageError(true)}
                />
              </div>
            ) : (
              <div className="px-4 py-2 text-[10px]" style={{ backgroundColor: '#E65100', color: 'white' }}>
                <p className="text-center leading-relaxed">
                  <strong>Phoneme Solutions Pvt. Ltd.</strong> Advant Navis Business Park, B-614 Sector 142, Noida -201307
                  {' '}CIN: U74999DL2015PTC275921 GST: 07AAHCP9748G1ZX
                </p>
                <p className="text-center">
                  Reg.Off: 1/22, 2nd Floor, Asaf Ali Road, New Delhi-110001 | info@myphoneme.com |{' '}
                  <span className="underline">http://www.myphoneme.com</span>
                </p>
              </div>
            )}
          </div>
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
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'draft' | 'approved' | 'sent' }))}
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

// Email Signature interface
interface EmailSignature {
  senderName: string;
  senderTitle: string;
  companyName: string;
  address: string;
  phone: string;
  mobile: string;
  website: string;
}

// Send Email Modal Component
function SendEmailModal({
  letter,
  onClose,
}: {
  letter: OfferLetterWithSignatory;
  onClose: () => void;
}) {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showSignatureEditor, setShowSignatureEditor] = useState(false);
  const [gmailConnections, setGmailConnections] = useState<any[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<number | null>(null);

  // Default signature matching the image provided
  const [signature, setSignature] = useState<EmailSignature>({
    senderName: 'Deepika',
    senderTitle: 'Manager-Human Resource',
    companyName: 'Phoneme Solutions Pvt Ltd.',
    address: 'Advant Business Tower\nOffice- 614, Tower-B, Sector 142, Tower 1,\nNoida-201307',
    phone: '+91 1204761617',
    mobile: '+91 7494957279',
    website: 'http://www.myphoneme.com',
  });

  // Fetch Gmail connections on mount
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/gmail/connections', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setGmailConnections(data);
          if (data.length > 0) {
            setSelectedConnection(data[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching Gmail connections:', err);
      }
    };

    const fetchSavedSignature = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/offer-letters/email-signature', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.senderName) {
            setSignature(data);
          }
        }
      } catch (err) {
        console.error('Error fetching saved signature:', err);
      }
    };

    fetchConnections();
    fetchSavedSignature();
  }, []);

  const handleSendEmail = async () => {
    if (!selectedConnection) {
      setError('Please select a Gmail account to send from');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:3001/api/offer-letters/${letter.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          gmail_connection_id: selectedConnection,
          email_signature: signature,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send email');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const saveSignature = async () => {
    try {
      await fetch('http://localhost:3001/api/offer-letters/email-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ signature }),
      });
      setShowSignatureEditor(false);
    } catch (err) {
      console.error('Error saving signature:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center bg-purple-50 dark:bg-purple-900/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Send Offer Letter via Email</h2>
              <p className="text-sm text-gray-500">{letter.candidate_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Success Message */}
          {success && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Offer letter sent successfully!
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">&times;</button>
            </div>
          )}

          {!success && (
            <>
              {/* Email Preview Info */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">Email will be sent to:</p>
                    <p className="text-blue-600 dark:text-blue-300">{letter.candidate_name}</p>
                    <p className="mt-2 font-medium">Subject:</p>
                    <p className="text-blue-600 dark:text-blue-300">Offer Letter - {letter.designation} Position at Phoneme Solutions</p>
                  </div>
                </div>
              </div>

              {/* Gmail Connection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Send From (Gmail Account) *
                </label>
                {gmailConnections.length > 0 ? (
                  <select
                    value={selectedConnection || ''}
                    onChange={(e) => setSelectedConnection(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {gmailConnections.map((conn: any) => (
                      <option key={conn.id} value={conn.id}>{conn.email}</option>
                    ))}
                  </select>
                ) : (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-700 dark:text-yellow-300 text-sm">
                    No Gmail accounts connected. Please connect a Gmail account in the Email Applications section first.
                  </div>
                )}
              </div>

              {/* Email Signature Preview */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email Signature
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSignatureEditor(!showSignatureEditor)}
                    className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400"
                  >
                    {showSignatureEditor ? 'Hide Editor' : 'Edit Signature'}
                  </button>
                </div>

                {/* Signature Editor */}
                {showSignatureEditor && (
                  <div className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3 bg-gray-50 dark:bg-gray-900">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Sender Name</label>
                        <input
                          type="text"
                          value={signature.senderName}
                          onChange={(e) => setSignature(prev => ({ ...prev, senderName: e.target.value }))}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Title</label>
                        <input
                          type="text"
                          value={signature.senderTitle}
                          onChange={(e) => setSignature(prev => ({ ...prev, senderTitle: e.target.value }))}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Company Name</label>
                      <input
                        type="text"
                        value={signature.companyName}
                        onChange={(e) => setSignature(prev => ({ ...prev, companyName: e.target.value }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Address</label>
                      <textarea
                        value={signature.address}
                        onChange={(e) => setSignature(prev => ({ ...prev, address: e.target.value }))}
                        rows={3}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Phone</label>
                        <input
                          type="text"
                          value={signature.phone}
                          onChange={(e) => setSignature(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Mobile</label>
                        <input
                          type="text"
                          value={signature.mobile}
                          onChange={(e) => setSignature(prev => ({ ...prev, mobile: e.target.value }))}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Website</label>
                      <input
                        type="text"
                        value={signature.website}
                        onChange={(e) => setSignature(prev => ({ ...prev, website: e.target.value }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={saveSignature}
                      className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                    >
                      Save Signature
                    </button>
                  </div>
                )}

                {/* Signature Preview */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-[#E65100] font-bold m-0">Regards</p>
                    <p className="text-[#E65100] font-bold my-1">{signature.senderName}</p>
                    <p className="text-[#E65100] font-bold my-1">{signature.senderTitle}</p>
                    <div className="my-4">
                      {/* PHONEME Logo Image */}
                      <img
                        src="data:image/jpeg;base64,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"
                        alt="PHONEME"
                        className="h-8"
                      />
                    </div>
                    <p className="my-1 text-sm font-semibold text-gray-800 dark:text-gray-200">{signature.companyName}</p>
                    <p className="my-1 text-sm font-semibold text-gray-800 dark:text-gray-200 whitespace-pre-line">{signature.address}</p>
                    <p className="my-1 text-sm font-semibold text-gray-800 dark:text-gray-200">T : {signature.phone}</p>
                    <p className="my-1 text-sm font-semibold text-gray-800 dark:text-gray-200">M: {signature.mobile}</p>
                    <p className="my-1 text-sm font-semibold">
                      W: <a href={signature.website} className="text-blue-600 hover:underline">{signature.website}</a>
                    </p>
                  </div>
                </div>
              </div>

              {/* Attachment Preview */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm-3 9v6H8v-6h2zm4 6h-2v-4h2v4zm4 0h-2v-2h2v2z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Offer_Letter_{letter.candidate_name.replace(/\s+/g, '_')}.pdf
                  </p>
                  <p className="text-xs text-gray-500">PDF Attachment</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={isSending || !selectedConnection}
                  className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send Email
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
