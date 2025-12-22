import { Fragment, useState } from 'react';
import {
  useAutomationStatus,
  usePendingActions,
  useGmailConnections,
  useCalendarConnections,
  usePendingDraftsCount
} from '../../hooks/useAutomation';
import { GmailConnectionManager } from './GmailConnectionManager';
import { CalendarConnectionManager } from './CalendarConnectionManager';
import { PendingActionsPanel } from './PendingActionsPanel';
import { EmailDraftsList } from './EmailDraftsList';

interface AutomationDashboardProps {
  onNavigateToCandidate?: (candidateId: number) => void;
}

export function AutomationDashboard({ onNavigateToCandidate }: AutomationDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'gmail' | 'calendar' | 'drafts' | 'actions'>('overview');

  const { data: statusData, isLoading: statusLoading } = useAutomationStatus();
  const { data: pendingActions } = usePendingActions({ limit: 10 });
  const { data: gmailConnections } = useGmailConnections();
  const { data: calendarConnections } = useCalendarConnections();
  const { data: pendingDraftsCount } = usePendingDraftsCount();

  const status = statusData?.status;
  const config = statusData?.config;

  const tabs = [
    { id: 'overview', label: 'Overview', count: null },
    { id: 'gmail', label: 'Gmail', count: gmailConnections?.length || 0 },
    { id: 'calendar', label: 'Calendar', count: calendarConnections?.length || 0 },
    { id: 'drafts', label: 'Email Drafts', count: pendingDraftsCount || 0 },
    { id: 'actions', label: 'Pending Actions', count: status?.pending_hr_actions || 0 }
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          status={status}
          config={config}
          isLoading={statusLoading}
          pendingActions={pendingActions || []}
          onNavigateToCandidate={onNavigateToCandidate}
        />
      )}

      {activeTab === 'gmail' && (
        <GmailConnectionManager />
      )}

      {activeTab === 'calendar' && (
        <CalendarConnectionManager />
      )}

      {activeTab === 'drafts' && (
        <EmailDraftsList />
      )}

      {activeTab === 'actions' && (
        <PendingActionsPanel onNavigateToCandidate={onNavigateToCandidate} />
      )}
    </div>
  );
}

// Overview Tab Component
function OverviewTab({
  status,
  config,
  isLoading,
  pendingActions,
  onNavigateToCandidate
}: {
  status: any;
  config: any;
  isLoading: boolean;
  pendingActions: any[];
  onNavigateToCandidate?: (candidateId: number) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const stats = [
    { label: 'Total Candidates', value: status?.total_candidates || 0, color: 'blue' },
    { label: 'Automated', value: status?.automated_candidates || 0, color: 'green' },
    { label: 'Pending Actions', value: status?.pending_hr_actions || 0, color: 'yellow' },
    { label: 'Today Applications', value: status?.today_applications || 0, color: 'purple' },
    { label: 'Today Shortlisted', value: status?.today_shortlisted || 0, color: 'emerald' },
    { label: 'Today Rejected', value: status?.today_rejected || 0, color: 'red' },
    { label: 'Pending Interviews', value: status?.pending_interviews || 0, color: 'indigo' },
    { label: 'Pending Offers', value: status?.pending_offers || 0, color: 'orange' }
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    yellow: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    purple: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    orange: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`p-4 rounded-lg ${colorMap[stat.color]}`}
          >
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-sm opacity-80">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Workflow Pipeline */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Recruitment Pipeline
        </h3>
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {[
            { label: 'Applications', count: status?.today_applications || 0 },
            { label: 'Screening', count: 0 },
            { label: 'Shortlisted', count: status?.today_shortlisted || 0 },
            { label: 'Interview', count: status?.pending_interviews || 0 },
            { label: 'Selected', count: 0 },
            { label: 'Offer', count: status?.pending_offers || 0 },
            { label: 'Joined', count: 0 }
          ].map((stage, index, arr) => (
            <Fragment key={stage.label}>
              <div className="flex flex-col items-center min-w-[80px]">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold">
                  {stage.count}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                  {stage.label}
                </span>
              </div>
              {index < arr.length - 1 && (
                <div className="flex-1 h-0.5 bg-gray-200 dark:bg-gray-700 mx-2 min-w-[20px]" />
              )}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Configuration */}
      {config && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Automation Thresholds
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Auto Reject:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">&lt; {config.AUTO_REJECT_THRESHOLD}%</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">HR Review:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">{config.AUTO_REJECT_THRESHOLD}-{config.HR_REVIEW_THRESHOLD}%</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Auto Shortlist:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">&ge; {config.AUTO_SHORTLIST_THRESHOLD}%</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Interview Pass:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">&ge; {config.INTERVIEW_PASS_SCORE}/5</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Pending Actions */}
      {pendingActions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Recent Pending Actions
          </h3>
          <div className="space-y-3">
            {pendingActions.slice(0, 5).map((action) => (
              <div
                key={action.id}
                className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                onClick={() => onNavigateToCandidate?.(action.candidate_id)}
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {action.candidate_name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {action.hr_prompt}
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(action.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AutomationDashboard;
