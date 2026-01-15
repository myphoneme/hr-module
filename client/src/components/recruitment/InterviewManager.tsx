import { useState } from 'react';
import {
  useInterviews,
  useCandidates,
  useSubmitInterviewFeedback,
  useUpdateCandidate,
  useDeleteInterview,
  type Interview,
  type Candidate,
} from '../../hooks/useRecruitment';

export function InterviewManager() {
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Use real API hooks
  const { data: interviews = [], isLoading: interviewsLoading, refetch } = useInterviews({
    status: statusFilter || undefined,
  });
  const { data: candidates = [] } = useCandidates();
  const submitFeedbackMutation = useSubmitInterviewFeedback();
  const updateCandidateMutation = useUpdateCandidate();
  const deleteInterviewMutation = useDeleteInterview();


  // Filter interviews (already filtered by API, but can add more client-side filtering)
  const filteredInterviews = interviews;

  // Get pending interview candidates (shortlisted but not scheduled)
  const pendingCandidates = candidates.filter(
    (c: Candidate) => c.status === 'shortlisted' || c.status === 'screening'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Interviews
          </h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="text-sm text-gray-500">
          {interviewsLoading ? 'Loading...' : `${filteredInterviews.length} interview(s)`}
        </div>
      </div>

      {/* Pending Interview Banner */}
      {pendingCandidates.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-orange-100 dark:bg-orange-800 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600 dark:text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-orange-800 dark:text-orange-200">
                {pendingCandidates.length} Candidate(s) Pending Interview
              </p>
              <p className="text-sm text-orange-600 dark:text-orange-400">
                Go to Candidates tab to schedule interviews for shortlisted candidates
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {pendingCandidates.slice(0, 5).map((c: Candidate) => (
              <span
                key={c.id}
                className="px-3 py-1 bg-white dark:bg-gray-800 rounded-full text-sm text-gray-700 dark:text-gray-300 border border-orange-200 dark:border-orange-700"
              >
                {c.first_name} {c.last_name}
              </span>
            ))}
            {pendingCandidates.length > 5 && (
              <span className="px-3 py-1 text-sm text-orange-600 dark:text-orange-400">
                +{pendingCandidates.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Interview?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this interview? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteInterviewMutation.mutate(deleteConfirm, {
                    onSuccess: () => {
                      setDeleteConfirm(null);
                      refetch();
                    }
                  });
                }}
                disabled={deleteInterviewMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteInterviewMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interview Detail Modal */}
      {selectedInterview && (
        <InterviewDetailModal
          interview={selectedInterview}
          onClose={() => setSelectedInterview(null)}
          onSubmitScore={(scores: { technical: number; communication: number; problemSolving: number; culturalFit: number; overall: number }, notes: string) => {
            const avgScore = (scores.technical + scores.communication + scores.problemSolving + scores.culturalFit + scores.overall) / 5;
            const decision = avgScore >= 3 ? 'selected' : 'rejected';

            submitFeedbackMutation.mutate({
              id: selectedInterview.id,
              feedback: {
                score: avgScore,
                notes: notes,
                ai_decision: decision,
              }
            }, {
              onSuccess: () => {
                // Update candidate status
                updateCandidateMutation.mutate({
                  id: selectedInterview.candidate_id,
                  candidate: { status: decision }
                });
                setSelectedInterview(null);
                refetch();
              }
            });
          }}
          onDelete={() => {
            setDeleteConfirm(selectedInterview.id);
            setSelectedInterview(null);
          }}
        />
      )}

      {/* Interview List */}
      {filteredInterviews.length > 0 ? (
        <div className="space-y-4">
          {groupInterviewsByDate(filteredInterviews).map(({ date, interviews: dateInterviews }) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                {formatDate(date)}
              </h3>
              <div className="space-y-2">
                {dateInterviews.map((interview) => (
                  <InterviewCard
                    key={interview.id}
                    interview={interview}
                    onClick={() => setSelectedInterview(interview)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            {interviewsLoading ? 'Loading interviews...' : 'No interviews scheduled. Go to Candidates tab to schedule interviews.'}
          </p>
        </div>
      )}
    </div>
  );
}

function groupInterviewsByDate(interviews: Interview[]) {
  const groups: Record<string, Interview[]> = {};
  interviews.forEach((interview) => {
    const date = interview.scheduled_date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(interview);
  });
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, interviews]) => ({ date, interviews }));
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
}

// Interview Card
function InterviewCard({ interview, onClick }: { interview: Interview; onClick: () => void }) {
  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    confirmed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    rescheduled: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    no_show: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  };

  const typeIcons: Record<string, string> = {
    hr: '👤',
    technical: '💻',
    managerial: '📊',
    final: '🎯',
  };

  // Build candidate name from interview data
  const candidateName = interview.first_name
    ? `${interview.first_name} ${interview.last_name || ''}`.trim()
    : 'Unknown Candidate';

  const isCompleted = interview.status === 'completed';
  const isSelected = interview.recommendation === 'strong_hire' || interview.recommendation === 'hire' || interview.recommendation === 'selected';

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-gray-800 rounded-lg shadow border p-4 cursor-pointer hover:shadow-md transition-shadow ${
        isCompleted
          ? isSelected
            ? 'border-green-300 dark:border-green-700'
            : 'border-red-300 dark:border-red-700'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="text-2xl">{typeIcons[interview.interview_type] || '📅'}</div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">
              {candidateName}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {interview.vacancy_title || 'Position'} - Round {interview.round_number}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Interviewer: {interview.interviewer_name || 'TBD'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-medium text-gray-900 dark:text-white">{interview.scheduled_time}</p>
          <p className="text-sm text-gray-500">{interview.duration_minutes} min</p>
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[interview.status] || statusColors.scheduled}`}>
            {interview.status}
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span className="capitalize">{interview.interview_type} Interview</span>
        {interview.location && <span>📍 {interview.location}</span>}
      </div>

      {/* Score and Result Display */}
      {isCompleted && (
        <div className={`mt-3 p-2 rounded-lg ${
          isSelected ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{isSelected ? '✅' : '❌'}</span>
              <span className={`font-semibold ${isSelected ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                {isSelected ? 'Selected' : 'Rejected'}
              </span>
            </div>
            {interview.rating && (
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">Score:</span>
                <span className={`font-bold text-lg ${
                  interview.rating >= 3 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {interview.rating}/5
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {interview.recommendation && !isCompleted && (
        <div className="mt-2 text-sm">
          <span className="text-gray-500">Recommendation: </span>
          <span className={`font-medium ${
            interview.recommendation.includes('hire') && !interview.recommendation.includes('no')
              ? 'text-green-600' : 'text-red-600'
          }`}>
            {interview.recommendation.replace('_', ' ')}
          </span>
        </div>
      )}
    </div>
  );
}

// Interview Detail Modal with Scoring
function InterviewDetailModal({
  interview,
  onClose,
  onSubmitScore,
  onDelete,
}: {
  interview: Interview;
  onClose: () => void;
  onSubmitScore: (scores: { technical: number; communication: number; problemSolving: number; culturalFit: number; overall: number }, notes: string) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const existingScore = interview.rating || 3;
  const [scores, setScores] = useState({
    technical: existingScore,
    communication: existingScore,
    problemSolving: existingScore,
    culturalFit: existingScore,
    overall: existingScore,
  });
  const [notes, setNotes] = useState(interview.feedback || '');

  const avgScore = Math.round(
    (scores.technical + scores.communication + scores.problemSolving + scores.culturalFit + scores.overall) / 5 * 10
  ) / 10;

  const candidateName = interview.first_name
    ? `${interview.first_name} ${interview.last_name || ''}`.trim()
    : 'Unknown Candidate';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Interview Details
            </h2>
            <p className="text-sm text-gray-500">{candidateName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onDelete}
              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
              title="Delete Interview"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-2xl">
              &times;
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Interview Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Position:</span>
                <p className="text-gray-900 dark:text-white">{interview.vacancy_title || 'N/A'}</p>
              </div>
              <div>
                <span className="text-gray-500">Type:</span>
                <p className="text-gray-900 dark:text-white capitalize">{interview.interview_type} - Round {interview.round_number}</p>
              </div>
              <div>
                <span className="text-gray-500">Date:</span>
                <p className="text-gray-900 dark:text-white">{interview.scheduled_date}</p>
              </div>
              <div>
                <span className="text-gray-500">Time:</span>
                <p className="text-gray-900 dark:text-white">{interview.scheduled_time} ({interview.duration_minutes} min)</p>
              </div>
              <div>
                <span className="text-gray-500">Interviewer:</span>
                <p className="text-gray-900 dark:text-white">{interview.interviewer_name || 'TBD'}</p>
              </div>
              <div>
                <span className="text-gray-500">Location:</span>
                <p className="text-gray-900 dark:text-white">{interview.location || 'N/A'}</p>
              </div>
            </div>
            {interview.meeting_link && (
              <div className="mt-3">
                <a
                  href={interview.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  Join Meeting
                </a>
              </div>
            )}
          </div>

          {/* Completed Interview Result */}
          {interview.status === 'completed' && !isEditing ? (
            <div className={`rounded-lg p-6 ${
              interview.recommendation === 'strong_hire' || interview.recommendation === 'hire' || interview.recommendation === 'selected'
                ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
            }`}>
              <div className="text-center">
                <div className="text-4xl mb-2">
                  {interview.recommendation === 'strong_hire' || interview.recommendation === 'hire' || interview.recommendation === 'selected' ? '✅' : '❌'}
                </div>
                <h3 className={`text-xl font-bold ${
                  interview.recommendation === 'strong_hire' || interview.recommendation === 'hire' || interview.recommendation === 'selected'
                    ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                }`}>
                  {interview.recommendation === 'strong_hire' || interview.recommendation === 'hire' || interview.recommendation === 'selected' ? 'Selected' : 'Rejected'}
                </h3>
                {interview.rating && (
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Interview Score: <span className="font-bold text-2xl">{interview.rating}/5</span>
                  </p>
                )}
                {interview.feedback && (
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                    Notes: {interview.feedback}
                  </p>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Score
                </button>
              </div>
            </div>
          ) : (interview.status !== 'completed' || isEditing) && (
            /* Scoring Section for Scheduled Interviews */
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 dark:text-white">Interview Scoring</h3>

              <div className="grid grid-cols-2 gap-3">
                <ScoreItem label="Technical Skills" value={scores.technical} onChange={(v) => setScores({ ...scores, technical: v })} icon="💻" />
                <ScoreItem label="Communication" value={scores.communication} onChange={(v) => setScores({ ...scores, communication: v })} icon="💬" />
                <ScoreItem label="Problem Solving" value={scores.problemSolving} onChange={(v) => setScores({ ...scores, problemSolving: v })} icon="🧩" />
                <ScoreItem label="Cultural Fit" value={scores.culturalFit} onChange={(v) => setScores({ ...scores, culturalFit: v })} icon="🤝" />
              </div>

              <ScoreItem label="Overall Performance" value={scores.overall} onChange={(v) => setScores({ ...scores, overall: v })} icon="⭐" />

              {/* Average & Decision */}
              <div className={`rounded-lg p-4 text-center ${
                avgScore >= 3
                  ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700'
                  : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700'
              }`}>
                <div className="flex items-center justify-center gap-6">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Avg Score</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgScore}/5</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Decision</p>
                    <p className={`text-xl font-bold ${avgScore >= 3 ? 'text-green-600' : 'text-red-600'}`}>
                      {avgScore >= 3 ? 'Selected' : 'Rejected'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Any notes about the interview..."
                />
              </div>

              <div className="flex gap-3">
                {isEditing && (
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => onSubmitScore(scores, notes)}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  {isEditing ? 'Update Score' : 'Submit Score & Complete Interview'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} // Added missing closing brace for InterviewDetailModal

// Score Item Component
function ScoreItem({
  label,
  value,
  onChange,
  icon,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  icon: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      <div className="flex justify-between gap-1">
        {[1, 2, 3, 4, 5].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => onChange(num)}
            className={`w-8 h-8 rounded text-sm font-bold transition-all ${
              value === num
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );
}