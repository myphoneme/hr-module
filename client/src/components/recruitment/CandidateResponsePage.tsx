import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';

interface CandidateInfo {
  first_name: string;
  last_name: string;
  email: string;
  vacancy_title: string;
  department: string;
  location: string;
}

export function CandidateResponsePage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [candidate, setCandidate] = useState<CandidateInfo | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    is_interested: '',
    current_ctc: '',
    expected_ctc: '',
    notice_period: '',
    interview_availability: 'tomorrow',
    preferred_interview_date: '',
    preferred_interview_time: ''
  });

  useEffect(() => {
    if (token) {
      fetchCandidateInfo();
    }
  }, [token]);

  const fetchCandidateInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/recruitment/candidate-response/${token}`);
      const data = await response.json();

      if (data.already_submitted) {
        setAlreadySubmitted(true);
        setSuccess(data.message);
      } else if (data.candidate) {
        setCandidate(data.candidate);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load page. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.is_interested) {
      setError('Please indicate if you are interested in this position');
      return;
    }

    if (formData.is_interested === 'yes') {
      if (!formData.current_ctc || !formData.expected_ctc || !formData.notice_period) {
        setError('Please fill all required fields');
        return;
      }
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/recruitment/candidate-response/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !candidate) {
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
          <p className="text-gray-600">{success || 'Your response has been recorded.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-xl p-6 text-white">
          <h1 className="text-2xl font-bold">Phoneme Solutions Pvt. Ltd.</h1>
          <p className="text-blue-100 mt-1">Candidate Interest Confirmation</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-b-xl shadow-lg p-6">
          {/* Candidate Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-gray-600">Hello,</p>
            <p className="text-lg font-semibold text-gray-900">
              {candidate?.first_name} {candidate?.last_name}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Position: <span className="font-medium text-gray-700">{candidate?.vacancy_title || 'Open Position'}</span>
            </p>
            {candidate?.department && (
              <p className="text-sm text-gray-500">
                Department: <span className="font-medium text-gray-700">{candidate.department}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Interest Question */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Are you interested in this position? <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <label className={`flex-1 cursor-pointer border-2 rounded-lg p-4 text-center transition-all ${
                  formData.is_interested === 'yes'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="is_interested"
                    value="yes"
                    checked={formData.is_interested === 'yes'}
                    onChange={(e) => setFormData({ ...formData, is_interested: e.target.value })}
                    className="sr-only"
                  />
                  <span className="text-lg font-medium">Yes, I'm Interested</span>
                </label>
                <label className={`flex-1 cursor-pointer border-2 rounded-lg p-4 text-center transition-all ${
                  formData.is_interested === 'no'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="is_interested"
                    value="no"
                    checked={formData.is_interested === 'no'}
                    onChange={(e) => setFormData({ ...formData, is_interested: e.target.value })}
                    className="sr-only"
                  />
                  <span className="text-lg font-medium">No, Thanks</span>
                </label>
              </div>
            </div>

            {/* Show additional fields only if interested */}
            {formData.is_interested === 'yes' && (
              <>
                {/* CTC Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current CTC (LPA) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.current_ctc}
                      onChange={(e) => setFormData({ ...formData, current_ctc: e.target.value })}
                      placeholder="e.g., 8.5"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expected CTC (LPA) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.expected_ctc}
                      onChange={(e) => setFormData({ ...formData, expected_ctc: e.target.value })}
                      placeholder="e.g., 12"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Notice Period */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notice Period <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.notice_period}
                    onChange={(e) => setFormData({ ...formData, notice_period: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select notice period</option>
                    <option value="Immediate">Immediate</option>
                    <option value="15 days">15 days</option>
                    <option value="30 days">30 days</option>
                    <option value="60 days">60 days</option>
                    <option value="90 days">90 days</option>
                  </select>
                </div>

                {/* Interview Availability */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interview Availability
                  </label>
                  <div className="space-y-3">
                    <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${
                      formData.interview_availability === 'tomorrow'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200'
                    }`}>
                      <input
                        type="radio"
                        name="interview_availability"
                        value="tomorrow"
                        checked={formData.interview_availability === 'tomorrow'}
                        onChange={(e) => setFormData({ ...formData, interview_availability: e.target.value })}
                        className="text-blue-600"
                      />
                      <span>Available Tomorrow</span>
                    </label>
                    <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${
                      formData.interview_availability === 'preferred_date'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200'
                    }`}>
                      <input
                        type="radio"
                        name="interview_availability"
                        value="preferred_date"
                        checked={formData.interview_availability === 'preferred_date'}
                        onChange={(e) => setFormData({ ...formData, interview_availability: e.target.value })}
                        className="text-blue-600"
                      />
                      <span>I prefer a specific date/time</span>
                    </label>
                  </div>

                  {formData.interview_availability === 'preferred_date' && (
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Preferred Date</label>
                        <input
                          type="date"
                          value={formData.preferred_interview_date}
                          onChange={(e) => setFormData({ ...formData, preferred_interview_date: e.target.value })}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Preferred Time</label>
                        <input
                          type="time"
                          value={formData.preferred_interview_time}
                          onChange={(e) => setFormData({ ...formData, preferred_interview_time: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !formData.is_interested}
              className={`w-full py-3 px-6 rounded-lg font-medium text-white transition-all ${
                submitting || !formData.is_interested
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
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
                'Submit Response'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            This is a secure link meant only for you. Please do not share it with others.
          </p>
        </div>
      </div>
    </div>
  );
}
