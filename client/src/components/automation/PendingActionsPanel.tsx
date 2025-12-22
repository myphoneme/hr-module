import { useState } from 'react';
import {
  usePendingActions,
  useAutomationMutations
} from '../../hooks/useAutomation';
import type { PendingAction, WorkflowStep } from '../../api/automation';

interface PendingActionsPanelProps {
  onNavigateToCandidate?: (candidateId: number) => void;
}

export function PendingActionsPanel({ onNavigateToCandidate }: PendingActionsPanelProps) {
  const [selectedAction, setSelectedAction] = useState<PendingAction | null>(null);
  const [resolution, setResolution] = useState('');
  const [notes, setNotes] = useState('');

  const { data: pendingActions, isLoading } = usePendingActions({ limit: 50 });
  const { completeAction, advanceWorkflow } = useAutomationMutations();

  const handleComplete = (logId: number) => {
    if (!resolution.trim()) {
      alert('Please enter a resolution');
      return;
    }
    completeAction.mutate(
      { logId, resolution, notes },
      {
        onSuccess: () => {
          setSelectedAction(null);
          setResolution('');
          setNotes('');
        }
      }
    );
  };

  const handleQuickAction = (action: PendingAction, targetStep: WorkflowStep, actionTaken: string) => {
    advanceWorkflow.mutate({
      candidateId: action.candidate_id,
      targetStep,
      actionTaken
    });
  };

  const getStepLabel = (step: WorkflowStep): string => {
    const labels: Record<WorkflowStep, string> = {
      new_application: 'New Application',
      ai_screening: 'AI Screening',
      hr_review_required: 'HR Review Required',
      shortlisted: 'Shortlisted',
      rejected: 'Rejected',
      schedule_interview: 'Schedule Interview',
      interview_scheduled: 'Interview Scheduled',
      interview_completed: 'Interview Completed',
      selected: 'Selected',
      ctc_discussion: 'CTC Discussion',
      ctc_finalized: 'CTC Finalized',
      generate_offer_letter: 'Generate Offer Letter',
      offer_sent: 'Offer Sent',
      offer_accepted: 'Offer Accepted',
      offer_rejected: 'Offer Rejected',
      joined: 'Joined'
    };
    return labels[step] || step;
  };

  const getStepColor = (step: WorkflowStep): string => {
    const colors: Partial<Record<WorkflowStep, string>> = {
      hr_review_required: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      schedule_interview: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      interview_completed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      ctc_discussion: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      generate_offer_letter: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    };
    return colors[step] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  const getQuickActions = (action: PendingAction): { label: string; step: WorkflowStep; action: string }[] => {
    const stepActions: Partial<Record<WorkflowStep, { label: string; step: WorkflowStep; action: string }[]>> = {
      hr_review_required: [
        { label: 'Shortlist', step: 'shortlisted', action: 'HR approved for shortlist' },
        { label: 'Reject', step: 'rejected', action: 'HR rejected application' }
      ],
      schedule_interview: [
        { label: 'Mark Scheduled', step: 'interview_scheduled', action: 'Interview scheduled' }
      ],
      ctc_discussion: [
        { label: 'Finalize CTC', step: 'ctc_finalized', action: 'CTC discussion completed' }
      ],
      generate_offer_letter: [
        { label: 'Generate Offer', step: 'offer_sent', action: 'Offer letter generated' }
      ]
    };
    return stepActions[action.workflow_step] || [];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pending HR Actions
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {pendingActions?.length || 0} actions requiring your attention
            </p>
          </div>
        </div>
      </div>

      {/* Actions List */}
      {pendingActions && pendingActions.length > 0 ? (
        <div className="space-y-4">
          {pendingActions.map((action: PendingAction) => (
            <div
              key={action.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 ${
                selectedAction?.id === action.id
                  ? 'border-blue-500'
                  : 'border-yellow-400'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className="font-medium text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                      onClick={() => onNavigateToCandidate?.(action.candidate_id)}
                    >
                      {action.candidate_name}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getStepColor(action.workflow_step)}`}>
                      {getStepLabel(action.workflow_step)}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {action.hr_prompt}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>{action.candidate_email}</span>
                    {action.vacancy_title && (
                      <span>· {action.vacancy_title}</span>
                    )}
                    <span>· {new Date(action.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {/* Quick Action Buttons */}
                  {getQuickActions(action).map((qa) => (
                    <button
                      key={qa.step}
                      onClick={() => handleQuickAction(action, qa.step, qa.action)}
                      disabled={advanceWorkflow.isPending}
                      className={`px-3 py-1.5 text-sm rounded disabled:opacity-50 ${
                        qa.step === 'rejected'
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {qa.label}
                    </button>
                  ))}

                  {/* Expand/Collapse */}
                  <button
                    onClick={() => setSelectedAction(
                      selectedAction?.id === action.id ? null : action
                    )}
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    {selectedAction?.id === action.id ? 'Close' : 'Details'}
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedAction?.id === action.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Resolution
                      </label>
                      <select
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                      >
                        <option value="">Select resolution...</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="deferred">Deferred</option>
                        <option value="needs_more_info">Needs More Info</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Notes
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Optional notes..."
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => handleComplete(action.id)}
                      disabled={completeAction.isPending || !resolution}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {completeAction.isPending ? 'Saving...' : 'Complete Action'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            All caught up!
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            No pending actions at the moment. The automation system is handling candidates smoothly.
          </p>
        </div>
      )}
    </div>
  );
}

export default PendingActionsPanel;
