import { useState } from 'react';
import { useInterviews, useSubmitInterviewScore } from '../../hooks/useRecruitment';
import { useSubmitAIScore, useCandidateAIScores, useSelectionThresholds, useAdvanceCandidate } from '../../hooks/useRecruitmentWorkflow';
import { AI_RECOMMENDATIONS } from '../../api/recruitmentWorkflow';
import type { AIInterviewScore } from '../../api/recruitmentWorkflow';
import type { InterviewScoreResult } from '../../api/recruitment';
import OfferLetterModal from './OfferLetterModal';

export default function AIInterviewScoring() {
  const [selectedInterview, setSelectedInterview] = useState<number | null>(null);
  const [selectedCandidateForScores, setSelectedCandidateForScores] = useState<number | null>(null);
  const [scoringMode, setScoringMode] = useState<'direct' | 'ai'>('direct'); // Default to direct scoring

  const { data: interviews, isLoading: interviewsLoading } = useInterviews({ status: 'completed' });

  // Filter interviews that need scoring (completed but no AI score yet)
  const interviewsToScore = interviews?.filter((i: any) => i.status === 'completed') || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AI Interview Scoring</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {scoringMode === 'direct'
              ? 'Enter scores (1-5) for auto selection/rejection'
              : 'Submit HR feedback and get AI-powered evaluation scores'
            }
          </p>
        </div>
        {/* Scoring Mode Toggle */}
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setScoringMode('direct')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              scoringMode === 'direct'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Direct Scoring
          </button>
          <button
            onClick={() => setScoringMode('ai')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              scoringMode === 'ai'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            AI Analysis
          </button>
        </div>
      </div>

      {/* Auto-scoring info banner */}
      {scoringMode === 'direct' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-300">Automated Selection Process</p>
              <p className="text-blue-600 dark:text-blue-400 mt-1">
                Enter scores (1-5) for each criterion. Average score ≥ 3.5 = <span className="text-green-600 font-medium">Auto-Selected</span>,
                &lt; 2.5 = <span className="text-red-600 font-medium">Auto-Rejected</span>.
                Selected candidates will get offer letter option automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interviews List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Completed Interviews
          </h3>

          {interviewsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : interviewsToScore.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No completed interviews awaiting scoring
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {interviewsToScore.map((interview: any) => (
                <InterviewCard
                  key={interview.id}
                  interview={interview}
                  isSelected={selectedInterview === interview.id}
                  onSelect={() => {
                    setSelectedInterview(interview.id);
                    setSelectedCandidateForScores(interview.candidate_id);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Scoring Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          {selectedInterview ? (
            scoringMode === 'direct' ? (
              <DirectScoringForm
                interviewId={selectedInterview}
                interview={interviewsToScore.find((i: any) => i.id === selectedInterview)}
                onSuccess={() => setSelectedInterview(null)}
              />
            ) : (
              <ScoringForm
                interviewId={selectedInterview}
                interview={interviewsToScore.find((i: any) => i.id === selectedInterview)}
                onSuccess={() => setSelectedInterview(null)}
              />
            )
          ) : (
            <div className="text-center text-gray-500 py-16">
              Select an interview to submit feedback and get {scoringMode === 'direct' ? 'auto-selection decision' : 'AI score'}
            </div>
          )}
        </div>
      </div>

      {/* Previous Scores for Selected Candidate */}
      {selectedCandidateForScores && (
        <CandidateScoresPanel candidateId={selectedCandidateForScores} />
      )}
    </div>
  );
}

// Interview Card Component
function InterviewCard({
  interview,
  isSelected,
  onSelect
}: {
  interview: any;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {interview.candidate_first_name} {interview.candidate_last_name}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {interview.vacancy_title}
          </div>
        </div>
        <span className={`px-2 py-1 text-xs rounded ${
          interview.interview_type === 'technical' ? 'bg-purple-100 text-purple-700' :
          interview.interview_type === 'hr' ? 'bg-blue-100 text-blue-700' :
          interview.interview_type === 'managerial' ? 'bg-orange-100 text-orange-700' :
          'bg-green-100 text-green-700'
        }`}>
          {interview.interview_type} - Round {interview.round_number}
        </span>
      </div>

      <div className="mt-2 flex gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span>{new Date(interview.scheduled_date).toLocaleDateString()}</span>
        <span>{interview.interviewer_name}</span>
      </div>

      {interview.rating && (
        <div className="mt-2 text-sm">
          <span className="text-gray-600 dark:text-gray-400">Current Rating: </span>
          <span className={`font-medium ${
            interview.rating >= 4 ? 'text-green-600' :
            interview.rating >= 3 ? 'text-yellow-600' :
            'text-red-600'
          }`}>
            {interview.rating}/5
          </span>
        </div>
      )}
    </div>
  );
}

// Direct Scoring Form Component (Automated Workflow)
function DirectScoringForm({
  interviewId,
  interview,
  onSuccess
}: {
  interviewId: number;
  interview: any;
  onSuccess: () => void;
}) {
  const submitScore = useSubmitInterviewScore();

  const [scores, setScores] = useState({
    technical_skills: 3,
    communication: 3,
    problem_solving: 3,
    cultural_fit: 3,
    overall_performance: 3,
  });
  const [feedback, setFeedback] = useState('');
  const [result, setResult] = useState<InterviewScoreResult | null>(null);

  const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / 5;

  const handleSubmit = () => {
    submitScore.mutate({
      interviewId,
      scores: {
        ...scores,
        feedback,
      }
    }, {
      onSuccess: (data) => {
        setResult(data);
        // Offer letter is now auto-generated on the backend for selected candidates
      }
    });
  };

  const ScoreInput = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${
              value === score
                ? score >= 4 ? 'bg-green-500 text-white' :
                  score >= 3 ? 'bg-yellow-500 text-white' :
                  'bg-red-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Score Interview (1-5)
        </h3>
        <div className={`text-2xl font-bold ${
          avgScore >= 3.5 ? 'text-green-600' :
          avgScore >= 2.5 ? 'text-yellow-600' :
          'text-red-600'
        }`}>
          Avg: {avgScore.toFixed(1)}
        </div>
      </div>

      {/* Candidate Info */}
      {interview && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Candidate</div>
          <div className="font-medium text-gray-900 dark:text-white">
            {interview.candidate_first_name} {interview.candidate_last_name}
          </div>
          <div className="text-sm text-gray-500">{interview.vacancy_title}</div>
        </div>
      )}

      {!result ? (
        <>
          {/* Score Inputs */}
          <div className="space-y-4">
            <ScoreInput
              label="Technical Skills"
              value={scores.technical_skills}
              onChange={(v) => setScores(prev => ({ ...prev, technical_skills: v }))}
            />
            <ScoreInput
              label="Communication"
              value={scores.communication}
              onChange={(v) => setScores(prev => ({ ...prev, communication: v }))}
            />
            <ScoreInput
              label="Problem Solving"
              value={scores.problem_solving}
              onChange={(v) => setScores(prev => ({ ...prev, problem_solving: v }))}
            />
            <ScoreInput
              label="Cultural Fit"
              value={scores.cultural_fit}
              onChange={(v) => setScores(prev => ({ ...prev, cultural_fit: v }))}
            />
            <ScoreInput
              label="Overall Performance"
              value={scores.overall_performance}
              onChange={(v) => setScores(prev => ({ ...prev, overall_performance: v }))}
            />
          </div>

          {/* Feedback */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Additional Notes (Optional)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={2}
              placeholder="Any additional comments..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Preview Decision */}
          <div className={`p-4 rounded-lg border-2 ${
            avgScore >= 3.5
              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
              : avgScore >= 2.5
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
              : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
          }`}>
            <div className="text-sm font-medium">
              {avgScore >= 3.5 ? (
                <span className="text-green-700 dark:text-green-300">→ Will be AUTO-SELECTED (score ≥ 3.5)</span>
              ) : avgScore >= 2.5 ? (
                <span className="text-yellow-700 dark:text-yellow-300">→ Requires manual review (2.5 ≤ score &lt; 3.5)</span>
              ) : (
                <span className="text-red-700 dark:text-red-300">→ Will be AUTO-REJECTED (score &lt; 2.5)</span>
              )}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitScore.isPending}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {submitScore.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Processing...
              </span>
            ) : (
              'Submit Scores & Get Decision'
            )}
          </button>
        </>
      ) : (
        /* Result Display - Fully Automated */
        <DirectScoreResult
          result={result}
          onClose={() => {
            setResult(null);
            setScores({ technical_skills: 3, communication: 3, problem_solving: 3, cultural_fit: 3, overall_performance: 3 });
            setFeedback('');
            onSuccess();
          }}
        />
      )}
    </div>
  );
}

// Direct Score Result Component
function DirectScoreResult({
  result,
  onClose
}: {
  result: InterviewScoreResult;
  onClose: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Decision Banner */}
      <div className={`p-6 rounded-lg border-2 text-center ${
        result.decision === 'selected'
          ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
          : result.decision === 'rejected'
          ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
          : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
      }`}>
        <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
          result.decision === 'selected' ? 'bg-green-500' :
          result.decision === 'rejected' ? 'bg-red-500' :
          'bg-yellow-500'
        }`}>
          {result.decision === 'selected' ? (
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : result.decision === 'rejected' ? (
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        <div className={`text-2xl font-bold mb-2 ${
          result.decision === 'selected' ? 'text-green-700 dark:text-green-300' :
          result.decision === 'rejected' ? 'text-red-700 dark:text-red-300' :
          'text-yellow-700 dark:text-yellow-300'
        }`}>
          {result.decision === 'selected' ? 'CANDIDATE SELECTED' :
           result.decision === 'rejected' ? 'CANDIDATE REJECTED' :
           'MANUAL REVIEW REQUIRED'}
        </div>

        <div className="text-lg text-gray-700 dark:text-gray-300 mb-2">
          {result.candidate_name}
        </div>

        <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          {result.average_score.toFixed(1)}<span className="text-lg font-normal text-gray-500">/5</span>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          {result.decision_reason}
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-5 gap-2">
        {Object.entries(result.scores).map(([key, value]) => (
          <div key={key} className="text-center">
            <div className={`text-lg font-bold ${
              value >= 4 ? 'text-green-600' :
              value >= 3 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {value}
            </div>
            <div className="text-xs text-gray-500 capitalize">
              {key.replace(/_/g, ' ')}
            </div>
          </div>
        ))}
      </div>

      {/* Auto-Generated Offer Letter Section */}
      {result.decision === 'selected' && (
        <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-300 dark:border-green-700">
          {result.offer_letter_generated ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-bold text-lg">Offer Letter Auto-Generated!</span>
              </div>
              <p className="text-sm text-green-600 dark:text-green-400">
                Offer letter ID: #{result.offer_letter_id} - Ready for review and sending
              </p>
              <div className="flex gap-2 mt-2">
                <a
                  href={`/offer-letters?id=${result.offer_letter_id}`}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-center flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View Offer Letter
                </a>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">Offer letter generation pending - check Offer Letters section</span>
            </div>
          )}
        </div>
      )}

      {/* Rejected Status */}
      {result.decision === 'rejected' && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-300 dark:border-red-700">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="font-medium">Candidate automatically rejected based on interview score</span>
          </div>
        </div>
      )}

      {/* Workflow Summary */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Automated Actions Completed:</h4>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Interview scores recorded
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Average score calculated: {result.average_score.toFixed(2)}/5
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Candidate status updated: {result.decision.toUpperCase()}
          </li>
          {result.decision === 'selected' && result.offer_letter_generated && (
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Offer letter auto-generated (RAG-based)
            </li>
          )}
        </ul>
      </div>

      <button
        onClick={onClose}
        className="w-full px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        Score Another Interview
      </button>
    </div>
  );
}

// Scoring Form Component
function ScoringForm({
  interviewId,
  interview,
  onSuccess
}: {
  interviewId: number;
  interview: any;
  onSuccess: () => void;
}) {
  const submitAIScore = useSubmitAIScore();
  const { data: thresholds } = useSelectionThresholds(interview?.vacancy_id);

  const [formData, setFormData] = useState({
    hr_feedback: '',
    strengths: '',
    weaknesses: '',
    technical_notes: '',
    communication_notes: ''
  });

  const [aiResult, setAiResult] = useState<{
    ai_score: AIInterviewScore;
    meets_threshold: boolean;
    threshold: number;
    recommendation: string;
  } | null>(null);

  const handleSubmit = () => {
    if (!formData.hr_feedback.trim()) {
      alert('Please provide feedback');
      return;
    }

    submitAIScore.mutate({
      interviewId,
      data: formData
    }, {
      onSuccess: (data) => {
        setAiResult(data);
      }
    });
  };

  const threshold = thresholds?.[0]?.min_interview_score || 3.5;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Submit Interview Feedback
        </h3>
        <span className="text-sm text-gray-500">
          Threshold: {threshold}/5
        </span>
      </div>

      {/* Candidate Info */}
      {interview && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Candidate</div>
          <div className="font-medium text-gray-900 dark:text-white">
            {interview.candidate_first_name} {interview.candidate_last_name}
          </div>
          <div className="text-sm text-gray-500">{interview.vacancy_title}</div>
        </div>
      )}

      {!aiResult ? (
        <>
          {/* Feedback Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Overall Feedback *
              </label>
              <textarea
                value={formData.hr_feedback}
                onChange={(e) => setFormData(prev => ({ ...prev, hr_feedback: e.target.value }))}
                rows={4}
                placeholder="Provide detailed feedback about the candidate's performance..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Strengths
                </label>
                <textarea
                  value={formData.strengths}
                  onChange={(e) => setFormData(prev => ({ ...prev, strengths: e.target.value }))}
                  rows={2}
                  placeholder="Key strengths observed..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Weaknesses
                </label>
                <textarea
                  value={formData.weaknesses}
                  onChange={(e) => setFormData(prev => ({ ...prev, weaknesses: e.target.value }))}
                  rows={2}
                  placeholder="Areas of concern..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Technical Notes
                </label>
                <textarea
                  value={formData.technical_notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, technical_notes: e.target.value }))}
                  rows={2}
                  placeholder="Technical assessment..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Communication Notes
                </label>
                <textarea
                  value={formData.communication_notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, communication_notes: e.target.value }))}
                  rows={2}
                  placeholder="Communication skills..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitAIScore.isPending || !formData.hr_feedback.trim()}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {submitAIScore.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Analyzing with AI...
              </span>
            ) : (
              'Submit & Get AI Score'
            )}
          </button>
        </>
      ) : (
        /* AI Result Display */
        <AIScoreResult
          result={aiResult}
          candidateId={interview?.candidate_id}
          onClose={() => {
            setAiResult(null);
            setFormData({ hr_feedback: '', strengths: '', weaknesses: '', technical_notes: '', communication_notes: '' });
            onSuccess();
          }}
        />
      )}
    </div>
  );
}

// AI Score Result Component
function AIScoreResult({
  result,
  candidateId,
  onClose
}: {
  result: {
    ai_score: AIInterviewScore;
    meets_threshold: boolean;
    threshold: number;
    recommendation: string;
  };
  candidateId: number;
  onClose: () => void;
}) {
  const score = result.ai_score;
  const recInfo = AI_RECOMMENDATIONS[result.recommendation as keyof typeof AI_RECOMMENDATIONS];
  const advanceCandidate = useAdvanceCandidate();
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [decisionMade, setDecisionMade] = useState<'selected' | 'rejected' | null>(null);

  const handleSelectCandidate = () => {
    advanceCandidate.mutate({
      candidateId,
      data: {
        to_stage: 'selected',
        reason: `AI Score: ${score.final_ai_score?.toFixed(1)}/5 - ${recInfo?.label || result.recommendation}`
      }
    }, {
      onSuccess: () => {
        setDecisionMade('selected');
      }
    });
  };

  const handleRejectCandidate = () => {
    advanceCandidate.mutate({
      candidateId,
      data: {
        to_stage: 'rejected',
        reason: `AI Score: ${score.final_ai_score?.toFixed(1)}/5 - Below threshold (${result.threshold}/5)`
      }
    }, {
      onSuccess: () => {
        setDecisionMade('rejected');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Selection Decision Banner */}
      <div className={`p-4 rounded-lg border-2 ${
        result.meets_threshold
          ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
          : 'bg-red-50 dark:bg-red-900/20 border-red-500'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              result.meets_threshold ? 'bg-green-500' : 'bg-red-500'
            }`}>
              {result.meets_threshold ? (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div>
              <div className={`text-xl font-bold ${
                result.meets_threshold ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
              }`}>
                {result.meets_threshold ? 'CANDIDATE SELECTED' : 'CANDIDATE REJECTED'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                AI Score: {score.final_ai_score?.toFixed(1)}/5 | Threshold: {result.threshold}/5
              </div>
            </div>
          </div>
          <div className={`text-3xl font-bold ${
            result.meets_threshold ? 'text-green-600' : 'text-red-600'
          }`}>
            {score.final_ai_score?.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {!decisionMade && (
        <div className={`p-4 rounded-lg ${
          result.meets_threshold ? 'bg-green-50 dark:bg-green-900/10' : 'bg-red-50 dark:bg-red-900/10'
        }`}>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Take Action</h4>
          <div className="flex gap-3">
            {result.meets_threshold ? (
              <>
                <button
                  onClick={handleSelectCandidate}
                  disabled={advanceCandidate.isPending}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {advanceCandidate.isPending ? 'Processing...' : 'Confirm Selection'}
                </button>
                <button
                  onClick={handleRejectCandidate}
                  disabled={advanceCandidate.isPending}
                  className="px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Override & Reject
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleRejectCandidate}
                  disabled={advanceCandidate.isPending}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {advanceCandidate.isPending ? 'Processing...' : 'Confirm Rejection'}
                </button>
                <button
                  onClick={handleSelectCandidate}
                  disabled={advanceCandidate.isPending}
                  className="px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Override & Select
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Decision Made - Next Steps */}
      {decisionMade === 'selected' && (
        <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-300 dark:border-green-700">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium text-green-700 dark:text-green-300">Candidate marked as Selected!</span>
          </div>
          <p className="text-sm text-green-600 dark:text-green-400 mb-3">
            Next step: Generate offer letter for this candidate
          </p>
          <button
            onClick={() => setShowOfferModal(true)}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Generate Offer Letter
          </button>
        </div>
      )}

      {decisionMade === 'rejected' && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-300 dark:border-red-700">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="font-medium text-red-700 dark:text-red-300">Candidate marked as Rejected</span>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            The candidate has been moved to the rejected stage.
          </p>
        </div>
      )}

      {/* AI Recommendation */}
      <div className="text-center text-sm text-gray-600 dark:text-gray-400">
        AI Recommendation: <span className={`font-medium ${
          recInfo?.color === 'green' ? 'text-green-600' :
          recInfo?.color === 'yellow' ? 'text-yellow-600' :
          'text-red-600'
        }`}>{recInfo?.label || result.recommendation}</span>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScoreCard
          label="Technical Skills"
          score={score.technical_skills_score}
          reasoning={score.technical_skills_reasoning}
        />
        <ScoreCard
          label="Communication"
          score={score.communication_score}
          reasoning={score.communication_reasoning}
        />
        <ScoreCard
          label="Problem Solving"
          score={score.problem_solving_score}
          reasoning={score.problem_solving_reasoning}
        />
        <ScoreCard
          label="Cultural Fit"
          score={score.cultural_fit_score}
          reasoning={score.cultural_fit_reasoning}
        />
        <ScoreCard
          label="Overall Performance"
          score={score.overall_performance_score}
          reasoning={score.overall_performance_reasoning}
          className="md:col-span-2"
        />
      </div>

      {/* Detailed Analysis */}
      {score.detailed_analysis && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Detailed Analysis</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">{score.detailed_analysis}</p>
        </div>
      )}

      {/* Key Strengths & Areas for Development */}
      <div className="grid grid-cols-2 gap-4">
        {score.key_strengths && (
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Key Strengths</h4>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              {(typeof score.key_strengths === 'string' ? JSON.parse(score.key_strengths) : score.key_strengths).map((s: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-green-600">+</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {score.areas_for_development && (
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Areas for Development</h4>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              {(typeof score.areas_for_development === 'string' ? JSON.parse(score.areas_for_development) : score.areas_for_development).map((a: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-yellow-600">!</span> {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button
        onClick={onClose}
        className="w-full px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        Score Another Interview
      </button>

      {/* Offer Letter Modal */}
      {showOfferModal && (
        <OfferLetterModal
          candidateId={candidateId}
          onClose={() => setShowOfferModal(false)}
          onSuccess={() => {
            setShowOfferModal(false);
          }}
        />
      )}
    </div>
  );
}

// Score Card Component
function ScoreCard({
  label,
  score,
  reasoning,
  className = ''
}: {
  label: string;
  score: number | null;
  reasoning: string | null;
  className?: string;
}) {
  if (score === null) return null;

  const getColor = (s: number) => {
    if (s >= 4) return 'text-green-600 bg-green-100 dark:bg-green-900/20';
    if (s >= 3) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
    return 'text-red-600 bg-red-100 dark:bg-red-900/20';
  };

  return (
    <div className={`p-4 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className={`px-2 py-1 rounded text-sm font-bold ${getColor(score)}`}>
          {score.toFixed(1)}
        </span>
      </div>
      {reasoning && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{reasoning}</p>
      )}
    </div>
  );
}

// Candidate Scores Panel
function CandidateScoresPanel({ candidateId }: { candidateId: number }) {
  const { data: scores, isLoading } = useCandidateAIScores(candidateId);

  if (isLoading) return null;
  if (!scores || scores.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Previous AI Scores for This Candidate
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-4 text-sm font-medium text-gray-500">Date</th>
              <th className="text-left py-2 px-4 text-sm font-medium text-gray-500">Type</th>
              <th className="text-left py-2 px-4 text-sm font-medium text-gray-500">Round</th>
              <th className="text-center py-2 px-4 text-sm font-medium text-gray-500">Technical</th>
              <th className="text-center py-2 px-4 text-sm font-medium text-gray-500">Communication</th>
              <th className="text-center py-2 px-4 text-sm font-medium text-gray-500">Problem Solving</th>
              <th className="text-center py-2 px-4 text-sm font-medium text-gray-500">Cultural Fit</th>
              <th className="text-center py-2 px-4 text-sm font-medium text-gray-500">Overall</th>
              <th className="text-center py-2 px-4 text-sm font-medium text-gray-500">Final Score</th>
              <th className="text-left py-2 px-4 text-sm font-medium text-gray-500">Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((score) => {
              const recInfo = AI_RECOMMENDATIONS[score.ai_recommendation as keyof typeof AI_RECOMMENDATIONS];
              return (
                <tr key={score.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 px-4 text-sm text-gray-700 dark:text-gray-300">
                    {new Date(score.scored_at).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-4 text-sm text-gray-700 dark:text-gray-300">
                    {score.interview_type}
                  </td>
                  <td className="py-2 px-4 text-sm text-gray-700 dark:text-gray-300">
                    {score.round_number}
                  </td>
                  <td className="py-2 px-4 text-center">
                    <ScoreBadge score={score.technical_skills_score} />
                  </td>
                  <td className="py-2 px-4 text-center">
                    <ScoreBadge score={score.communication_score} />
                  </td>
                  <td className="py-2 px-4 text-center">
                    <ScoreBadge score={score.problem_solving_score} />
                  </td>
                  <td className="py-2 px-4 text-center">
                    <ScoreBadge score={score.cultural_fit_score} />
                  </td>
                  <td className="py-2 px-4 text-center">
                    <ScoreBadge score={score.overall_performance_score} />
                  </td>
                  <td className="py-2 px-4 text-center">
                    <span className={`font-bold ${
                      (score.final_ai_score || 0) >= 3.5 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {score.final_ai_score?.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2 px-4">
                    <span className={`px-2 py-1 text-xs rounded ${
                      recInfo?.color === 'green' ? 'bg-green-100 text-green-700' :
                      recInfo?.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {recInfo?.label || score.ai_recommendation}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400">-</span>;

  const color = score >= 4 ? 'text-green-600' : score >= 3 ? 'text-yellow-600' : 'text-red-600';

  return <span className={`font-medium ${color}`}>{score.toFixed(1)}</span>;
}
