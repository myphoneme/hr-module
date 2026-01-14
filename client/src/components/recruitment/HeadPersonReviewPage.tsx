import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface CandidateForReview {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  vacancy_title: string;
  experience_years: number;
  current_salary: number;
  expected_salary: number;
  notice_period: string;
  skills: string;
  current_company: string;
  is_interested: string;
  interview_availability: string;
  city: string;
}

interface ReviewInfo {
  vacancy_title: string;
  department: string;
  candidates: CandidateForReview[];
  reviewer_email: string;
  reviewer_name: string;
}

interface CandidateSelection {
  candidateId: number;
  selected: boolean;
  interviewTime: string;
}

export function HeadPersonReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [reviewInfo, setReviewInfo] = useState<ReviewInfo | null>(null);

  // Selections state
  const [selections, setSelections] = useState<Map<number, CandidateSelection>>(new Map());
  const [sameTimeForAll, setSameTimeForAll] = useState(true);
  const [commonInterviewTime, setCommonInterviewTime] = useState('');
  const [commonInterviewDate, setCommonInterviewDate] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (token) {
      fetchReviewInfo();
    }
  }, [token]);

  const fetchReviewInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/recruitment/head-review/${token}`);
      const data = await response.json();

      if (data.already_submitted) {
        setAlreadySubmitted(true);
        setSuccess(data.message);
      } else if (data.reviewInfo) {
        setReviewInfo(data.reviewInfo);
        // Initialize selections - all selected by default
        const initialSelections = new Map<number, CandidateSelection>();
        data.reviewInfo.candidates.forEach((c: CandidateForReview) => {
          initialSelections.set(c.id, {
            candidateId: c.id,
            selected: true,
            interviewTime: ''
          });
        });
        setSelections(initialSelections);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load page. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const toggleCandidateSelection = (candidateId: number) => {
    setSelections(prev => {
      const newSelections = new Map(prev);
      const current = newSelections.get(candidateId);
      if (current) {
        newSelections.set(candidateId, { ...current, selected: !current.selected });
      }
      return newSelections;
    });
  };

  const setCandidateInterviewTime = (candidateId: number, date: string, time: string) => {
    setSelections(prev => {
      const newSelections = new Map(prev);
      const current = newSelections.get(candidateId);
      if (current) {
        newSelections.set(candidateId, { ...current, interviewTime: `${date}T${time}` });
      }
      return newSelections;
    });
  };

  const selectAll = () => {
    setSelections(prev => {
      const newSelections = new Map(prev);
      newSelections.forEach((value, key) => {
        newSelections.set(key, { ...value, selected: true });
      });
      return newSelections;
    });
  };

  const deselectAll = () => {
    setSelections(prev => {
      const newSelections = new Map(prev);
      newSelections.forEach((value, key) => {
        newSelections.set(key, { ...value, selected: false });
      });
      return newSelections;
    });
  };

  const getSelectedCount = () => {
    let count = 0;
    selections.forEach(s => { if (s.selected) count++; });
    return count;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate interview date is provided
    if (sameTimeForAll && !commonInterviewDate) {
      setError('Please select an interview date for the candidates');
      return;
    }

    const selectedCandidates: any[] = [];
    let missingDates = false;

    selections.forEach((selection, candidateId) => {
      if (selection.selected) {
        const interviewDateTime = sameTimeForAll
          ? `${commonInterviewDate}T${commonInterviewTime || '10:00'}`
          : selection.interviewTime;

        // Check if individual dates are provided when not using same time
        if (!sameTimeForAll && !selection.interviewTime) {
          missingDates = true;
        }

        selectedCandidates.push({
          candidateId,
          interviewDateTime
        });
      }
    });

    if (selectedCandidates.length === 0) {
      setError('Please select at least one candidate for interview');
      return;
    }

    if (!sameTimeForAll && missingDates) {
      setError('Please set interview date/time for all selected candidates');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`http://localhost:3001/api/recruitment/head-review/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedCandidates,
          remarks,
          sameTimeForAll,
          commonInterviewDate,
          commonInterviewTime
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        setAlreadySubmitted(true);
      } else {
        setError(data.error || 'Failed to submit response');
      }
    } catch (err) {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatSalary = (salary: number) => {
    if (!salary) return '-';
    return `${(salary / 100000).toFixed(1)} LPA`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading candidates for review...</p>
        </div>
      </div>
    );
  }

  if (error && !reviewInfo) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Invalid or Expired</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (alreadySubmitted || success) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600">{success || 'Your selections have been recorded.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-xl p-6 text-white">
          <h1 className="text-2xl font-bold">Phoneme Solutions Pvt. Ltd.</h1>
          <p className="text-purple-100 mt-1">Candidate Review & Interview Scheduling</p>
        </div>

        {/* Review Card */}
        <div className="bg-white rounded-b-xl shadow-lg p-6">
          {/* Reviewer Info */}
          <div className="bg-purple-50 rounded-lg p-4 mb-6">
            <p className="text-gray-600">Hello,</p>
            <p className="text-lg font-semibold text-gray-900">
              {reviewInfo?.reviewer_name || reviewInfo?.reviewer_email}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Position: <span className="font-medium text-gray-700">{reviewInfo?.vacancy_title}</span>
            </p>
            {reviewInfo?.department && (
              <p className="text-sm text-gray-500">
                Department: <span className="font-medium text-gray-700">{reviewInfo.department}</span>
              </p>
            )}
            <p className="text-sm text-purple-600 mt-2">
              Please review the candidates below and select those you want to interview.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Selection Actions */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                >
                  Deselect All
                </button>
              </div>
              <span className="text-sm text-gray-600">
                {getSelectedCount()} of {reviewInfo?.candidates.length} selected
              </span>
            </div>

            {/* Candidates Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Select</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Candidate</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Contact</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Experience</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Current CTC</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Expected CTC</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Notice Period</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Interest</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Skills</th>
                    {!sameTimeForAll && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Interview Time</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reviewInfo?.candidates.map((candidate) => {
                    const selection = selections.get(candidate.id);
                    return (
                      <tr
                        key={candidate.id}
                        className={`${selection?.selected ? 'bg-green-50' : 'bg-gray-50 opacity-60'} hover:bg-gray-100 transition-colors`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selection?.selected || false}
                            onChange={() => toggleCandidateSelection(candidate.id)}
                            className="h-5 w-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {candidate.first_name} {candidate.last_name}
                          </div>
                          <div className="text-xs text-gray-500">{candidate.current_company}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-600">{candidate.email}</div>
                          <div className="text-sm text-gray-500">{candidate.phone}</div>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-700">
                          {candidate.experience_years ? `${candidate.experience_years} yrs` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-700">
                          {formatSalary(candidate.current_salary)}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-700">
                          {formatSalary(candidate.expected_salary)}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-700">
                          {candidate.notice_period || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {candidate.is_interested === 'yes' ? (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Yes</span>
                          ) : candidate.is_interested === 'no' ? (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">No</span>
                          ) : (
                            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-600 max-w-[200px] truncate" title={candidate.skills}>
                            {candidate.skills || '-'}
                          </div>
                        </td>
                        {!sameTimeForAll && (
                          <td className="px-4 py-3">
                            {selection?.selected && (
                              <div className="flex gap-2">
                                <input
                                  type="date"
                                  min={new Date().toISOString().split('T')[0]}
                                  onChange={(e) => {
                                    const time = selection.interviewTime?.split('T')[1] || '';
                                    setCandidateInterviewTime(candidate.id, e.target.value, time);
                                  }}
                                  className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-purple-500 focus:border-purple-500"
                                />
                                <input
                                  type="time"
                                  onChange={(e) => {
                                    const date = selection.interviewTime?.split('T')[0] || '';
                                    setCandidateInterviewTime(candidate.id, date, e.target.value);
                                  }}
                                  className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-purple-500 focus:border-purple-500"
                                />
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Interview Time Settings */}
            <div className="bg-indigo-50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-indigo-900 mb-3">Interview Availability</h3>

              <div className="space-y-3">
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${
                  sameTimeForAll ? 'border-indigo-500 bg-indigo-100' : 'border-gray-200 bg-white'
                }`}>
                  <input
                    type="radio"
                    name="timeOption"
                    checked={sameTimeForAll}
                    onChange={() => setSameTimeForAll(true)}
                    className="text-indigo-600"
                  />
                  <span className="text-gray-700">Same interview time for all selected candidates</span>
                </label>

                {sameTimeForAll && (
                  <div className="ml-8 flex gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={commonInterviewDate}
                        onChange={(e) => setCommonInterviewDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        required
                        className={`px-3 py-2 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 ${
                          !commonInterviewDate ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Time (default: 10:00 AM)</label>
                      <input
                        type="time"
                        value={commonInterviewTime}
                        onChange={(e) => setCommonInterviewTime(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}

                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${
                  !sameTimeForAll ? 'border-indigo-500 bg-indigo-100' : 'border-gray-200 bg-white'
                }`}>
                  <input
                    type="radio"
                    name="timeOption"
                    checked={!sameTimeForAll}
                    onChange={() => setSameTimeForAll(false)}
                    className="text-indigo-600"
                  />
                  <span className="text-gray-700">Set different interview time for each candidate</span>
                </label>

                {!sameTimeForAll && (
                  <p className="ml-8 text-sm text-gray-500">
                    Use the "Interview Time" column in the table above to set individual times.
                  </p>
                )}
              </div>
            </div>

            {/* Remarks */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Remarks (Optional)
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Any additional comments or instructions..."
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || getSelectedCount() === 0}
              className={`w-full py-3 px-6 rounded-lg font-medium text-white transition-all ${
                submitting || getSelectedCount() === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
              }`}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </span>
              ) : (
                `Submit Selection (${getSelectedCount()} candidates)`
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            This is a secure link. Your selections will be recorded and the HR team will be notified.
          </p>
        </div>
      </div>
    </div>
  );
}
