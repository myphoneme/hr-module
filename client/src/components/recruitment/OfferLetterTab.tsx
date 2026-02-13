import { useState } from 'react';
import OfferLetterManager from '../OfferLetterManager';
import { useOfferLetters } from '../../hooks/useOfferLetters';
import { useCandidates } from '../../hooks/useRecruitment'; // Import useCandidates
import type { OfferLetterWithSignatory } from '../../types';
import type { Candidate } from '../../api/recruitment';
import { API_BASE_URL } from '../../config/api';

export default function OfferLetterTab() {
  const [view, setView] = useState<'list' | 'manager'>('list');
  const [selectedCandidateIdForManager, setSelectedCandidateIdForManager] = useState<number | null>(null);

  const { offerLetters, isLoading: lettersLoading, deleteOfferLetter } = useOfferLetters();
  const { data: selectedCandidates, isLoading: candidatesLoading } = useCandidates({ status: 'selected' }); // Fetch selected candidates
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this offer letter?')) return;
    try {
      await deleteOfferLetter(id);
    } catch (err: any) {
      setError(err.message || 'Failed to delete offer letter');
    }
  };

  const handleDownload = (letter: OfferLetterWithSignatory) => {
    window.open(`${API_BASE_URL}/offer-letters/${letter.id}/pdf`, '_blank');
  };

  if (view === 'manager') {
    return (
      <OfferLetterManager
        onBack={() => {
          setView('list');
          setSelectedCandidateIdForManager(null);
        }}
        preSelectedCandidateId={selectedCandidateIdForManager}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Offer Letters</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create and manage offer letters.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedCandidateIdForManager(null); // Clear selection when opening generic manager
            setView('manager');
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New Offer Letter
        </button>
      </div>

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
                Selected Candidates ({selectedCandidates?.length || 0})
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Candidates who passed interview - ready for offer letter
              </p>
            </div>
          </div>
          {selectedCandidates && selectedCandidates.length > 0 && (
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
              {selectedCandidates.length} pending offer{selectedCandidates.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {candidatesLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          </div>
        ) : selectedCandidates && selectedCandidates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Candidate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Experience</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Expected CTC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {selectedCandidates.map((candidate: Candidate) => (
                  <tr key={candidate.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
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
                      <button
                        onClick={() => {
                          setSelectedCandidateIdForManager(candidate.id);
                          setView('manager');
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
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
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
            <p>No offer letters created yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}