import { useState } from 'react';
import { useWorkflowPipeline, useWorkflowStats, useAdvanceCandidate } from '../../hooks/useRecruitmentWorkflow';
import { useVacancies } from '../../hooks/useRecruitment';
import { WORKFLOW_STAGES, getStageInfo } from '../../api/recruitmentWorkflow';
import OfferLetterModal from './OfferLetterModal';

// Stage colors mapping
const stageColors: Record<string, { bg: string; border: string; text: string }> = {
  gray: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-700' },
  blue: { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
  green: { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700' },
  red: { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700' },
  purple: { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700' },
  yellow: { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-700' },
  indigo: { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-700' },
};

// Main workflow stages for pipeline view (simplified)
const PIPELINE_STAGES = [
  { key: 'new', label: 'New', icon: '📥' },
  { key: 'screening', label: 'Screening', icon: '🔍' },
  { key: 'shortlisted', label: 'Shortlisted', icon: '✅' },
  { key: 'interview_scheduled', label: 'Interview', icon: '📅' },
  { key: 'interview_scored', label: 'Scored', icon: '📊' },
  { key: 'selected', label: 'Selected', icon: '🎯' },
  { key: 'ctc_discussion', label: 'CTC', icon: '💰' },
  { key: 'offer_sent', label: 'Offer Sent', icon: '📧' },
  { key: 'joined', label: 'Joined', icon: '🎉' },
];

export default function RecruitmentWorkflow() {
  const [selectedVacancy, setSelectedVacancy] = useState<number | undefined>(undefined);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ candidateId: number; fromStage: string } | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerCandidateId, setOfferCandidateId] = useState<number | null>(null);

  const { data: vacancies } = useVacancies();
  const { data: pipelineData, isLoading: pipelineLoading, refetch: refetchPipeline } = useWorkflowPipeline(selectedVacancy);
  const { data: stats } = useWorkflowStats(selectedVacancy, 30);
  const advanceCandidate = useAdvanceCandidate();

  const handleMoveCandidate = (candidateId: number, toStage: string, reason?: string) => {
    advanceCandidate.mutate({
      candidateId,
      data: { to_stage: toStage, reason }
    }, {
      onSuccess: () => {
        setShowMoveModal(false);
        setMoveTarget(null);
      }
    });
  };

  // Get count for a stage (including related stages)
  const getStageCount = (stageKey: string): number => {
    if (!pipelineData?.stage_counts) return 0;

    // Group related stages
    const stageGroups: Record<string, string[]> = {
      'new': ['new'],
      'screening': ['screening', 'screened'],
      'shortlisted': ['shortlisted'],
      'interview_scheduled': ['interview_scheduled', 'interview_completed'],
      'interview_scored': ['interview_scored'],
      'selected': ['selected'],
      'ctc_discussion': ['ctc_discussion', 'ctc_finalized'],
      'offer_sent': ['offer_generated', 'offer_sent', 'offer_accepted'],
      'joined': ['joined'],
    };

    const relatedStages = stageGroups[stageKey] || [stageKey];
    return pipelineData.stage_counts
      .filter(sc => relatedStages.includes(sc.stage))
      .reduce((sum, sc) => sum + sc.count, 0);
  };

  // Get candidates for a stage (including related stages)
  const getStageCandidates = (stageKey: string) => {
    if (!pipelineData?.pipeline) return [];

    const stageGroups: Record<string, string[]> = {
      'new': ['new'],
      'screening': ['screening', 'screened'],
      'shortlisted': ['shortlisted'],
      'interview_scheduled': ['interview_scheduled', 'interview_completed'],
      'interview_scored': ['interview_scored'],
      'selected': ['selected'],
      'ctc_discussion': ['ctc_discussion', 'ctc_finalized'],
      'offer_sent': ['offer_generated', 'offer_sent', 'offer_accepted'],
      'joined': ['joined'],
    };

    const relatedStages = stageGroups[stageKey] || [stageKey];
    return relatedStages.flatMap(stage => pipelineData.pipeline[stage] || []);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Recruitment Pipeline</h2>
          <p className="text-gray-600 dark:text-gray-400">Track candidates through the 9-step hiring workflow</p>
        </div>

        {/* Vacancy Filter */}
        <div className="flex items-center gap-4">
          <select
            value={selectedVacancy || ''}
            onChange={(e) => setSelectedVacancy(e.target.value ? Number(e.target.value) : undefined)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">All Vacancies</option>
            {vacancies?.map((v: any) => (
              <option key={v.id} value={v.id}>{v.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <StatCard label="Total" value={stats.total_candidates} color="blue" />
          <StatCard label="New" value={stats.new_count} color="gray" />
          <StatCard label="Screened" value={stats.screened_count} color="blue" />
          <StatCard label="Interviewing" value={stats.interviewing_count} color="purple" />
          <StatCard label="Selected" value={stats.selected_count} color="green" />
          <StatCard label="Offers" value={stats.offer_count} color="indigo" />
          <StatCard label="Joined" value={stats.joined_count} color="green" />
          <StatCard label="Rejected" value={stats.rejected_count} color="red" />
        </div>
      )}

      {/* Pipeline View */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 overflow-x-auto">
        {pipelineLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="flex gap-4 min-w-max">
            {PIPELINE_STAGES.map((stage, index) => {
              const count = getStageCount(stage.key);
              const candidates = getStageCandidates(stage.key);
              const stageInfo = getStageInfo(stage.key);
              const colors = stageColors[stageInfo.color] || stageColors.gray;

              return (
                <div key={stage.key} className="flex-shrink-0 w-64">
                  {/* Stage Header */}
                  <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg ${colors.bg} ${colors.border} border-b-0 border`}>
                    <div className="flex items-center gap-2">
                      <span>{stage.icon}</span>
                      <span className={`font-medium ${colors.text}`}>{stage.label}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${colors.bg} ${colors.text}`}>
                      {count}
                    </span>
                  </div>

                  {/* Stage Content */}
                  <div className={`border ${colors.border} border-t-0 rounded-b-lg p-2 min-h-[200px] max-h-[400px] overflow-y-auto bg-gray-50 dark:bg-gray-900`}>
                    {candidates.length === 0 ? (
                      <div className="text-center text-gray-400 py-8 text-sm">
                        No candidates
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {candidates.slice(0, 10).map((candidate) => (
                          <CandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            onMove={() => {
                              setMoveTarget({ candidateId: candidate.id, fromStage: candidate.workflow_stage });
                              setShowMoveModal(true);
                            }}
                            onGenerateOffer={() => {
                              setOfferCandidateId(candidate.id);
                              setShowOfferModal(true);
                            }}
                          />
                        ))}
                        {candidates.length > 10 && (
                          <div className="text-center text-gray-500 text-sm py-2">
                            +{candidates.length - 10} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Arrow between stages */}
                  {index < PIPELINE_STAGES.length - 1 && (
                    <div className="absolute top-1/2 -right-3 transform -translate-y-1/2 text-gray-300">
                      →
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rejected/Withdrawn Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Rejected / Withdrawn Candidates
        </h3>
        <div className="flex gap-4">
          {['rejected', 'withdrawn', 'offer_rejected'].map((stageKey) => {
            const candidates = pipelineData?.pipeline[stageKey] || [];
            const stageInfo = getStageInfo(stageKey);

            return (
              <div key={stageKey} className="flex-1">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  {stageInfo.label} ({candidates.length})
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {candidates.slice(0, 5).map((c) => (
                    <div key={c.id} className="text-sm text-gray-700 dark:text-gray-300 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                      {c.first_name} {c.last_name}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Move Modal */}
      {showMoveModal && moveTarget && (
        <MoveModal
          candidateId={moveTarget.candidateId}
          currentStage={moveTarget.fromStage}
          onMove={handleMoveCandidate}
          onClose={() => {
            setShowMoveModal(false);
            setMoveTarget(null);
          }}
          isLoading={advanceCandidate.isPending}
        />
      )}

      {/* Offer Letter Modal */}
      {showOfferModal && offerCandidateId && (
        <OfferLetterModal
          candidateId={offerCandidateId}
          onClose={() => {
            setShowOfferModal(false);
            setOfferCandidateId(null);
          }}
          onSuccess={() => {
            refetchPipeline();
          }}
        />
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    gray: 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300',
  };

  return (
    <div className={`p-3 rounded-lg ${colorMap[color] || colorMap.gray}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wide opacity-75">{label}</div>
    </div>
  );
}

// Stages where offer letter can be generated
const OFFER_ELIGIBLE_STAGES = ['selected', 'ctc_discussion', 'ctc_finalized'];

// Candidate Card Component
function CandidateCard({
  candidate,
  onMove,
  onGenerateOffer
}: {
  candidate: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    screening_score: number | null;
    final_interview_score: number | null;
    workflow_stage: string;
    vacancy_title?: string;
  };
  onMove: () => void;
  onGenerateOffer?: () => void;
}) {
  const canGenerateOffer = OFFER_ELIGIBLE_STAGES.includes(candidate.workflow_stage);

  return (
    <div
      className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
            {candidate.first_name} {candidate.last_name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {candidate.email}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canGenerateOffer && onGenerateOffer && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onGenerateOffer();
              }}
              className="p-1 text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
              title="Generate Offer Letter"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove();
            }}
            className="p-1 text-gray-400 hover:text-blue-600 rounded"
            title="Move to stage"
          >
            →
          </button>
        </div>
      </div>

      {/* Scores */}
      <div className="flex gap-2 mt-2">
        {candidate.screening_score !== null && (
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            candidate.screening_score >= 70 ? 'bg-green-100 text-green-700' :
            candidate.screening_score >= 40 ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            Screen: {candidate.screening_score}%
          </span>
        )}
        {candidate.final_interview_score !== null && (
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            candidate.final_interview_score >= 3.5 ? 'bg-green-100 text-green-700' :
            candidate.final_interview_score >= 2.5 ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            Interview: {candidate.final_interview_score.toFixed(1)}/5
          </span>
        )}
      </div>

      {candidate.vacancy_title && (
        <div className="text-xs text-gray-400 mt-1 truncate">
          {candidate.vacancy_title}
        </div>
      )}
    </div>
  );
}

// Move Modal Component
function MoveModal({
  candidateId,
  currentStage,
  onMove,
  onClose,
  isLoading
}: {
  candidateId: number;
  currentStage: string;
  onMove: (candidateId: number, toStage: string, reason?: string) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [selectedStage, setSelectedStage] = useState('');
  const [reason, setReason] = useState('');

  const currentStageInfo = getStageInfo(currentStage);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Move Candidate
        </h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Current Stage
          </label>
          <div className="text-gray-600 dark:text-gray-400">
            {currentStageInfo.label}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Move To
          </label>
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Select stage...</option>
            {WORKFLOW_STAGES.filter(s => s.key !== currentStage).map((stage) => (
              <option key={stage.key} value={stage.key}>
                {stage.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            rows={2}
            placeholder="Add a note..."
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={() => onMove(candidateId, selectedStage, reason || undefined)}
            disabled={!selectedStage || isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Moving...' : 'Move'}
          </button>
        </div>
      </div>
    </div>
  );
}
