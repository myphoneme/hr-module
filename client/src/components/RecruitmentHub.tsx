import { useState } from 'react';
import {
  useRecruitmentStats,
  useVacancies,
  useCandidates,
  useInterviews,
} from '../hooks/useRecruitment';
import { VacancyManager } from './recruitment/VacancyManager';
import { CandidateManager } from './recruitment/CandidateManager';
import { InterviewManager } from './recruitment/InterviewManager';
import ResumeScreening from './recruitment/ResumeScreening';
import OfferLetterTab from './recruitment/OfferLetterTab';
import { GmailConnectionManager } from './automation/GmailConnectionManager';
import { SignatoryManager } from './SignatoryManager';
import LetterheadManager from './LetterheadManager';


type TabType = 'dashboard' | 'vacancies' | 'resume-screening' | 'candidates' | 'interviews' | 'offer-letters' | 'settings' | 'signatories' | 'letterheads';

interface RecruitmentHubProps {
  onBack?: () => void;
}

export function RecruitmentHub({ onBack }: RecruitmentHubProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const [showRightScroll, setShowRightScroll] = useState(false);

  const { data: stats, isLoading: statsLoading } = useRecruitmentStats();
  const { data: candidates } = useCandidates({ status: undefined });
  const { data: interviews } = useInterviews({ status: 'scheduled' });

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: '📊', count: null },
    { id: 'vacancies' as TabType, label: 'Vacancies', icon: '💼', count: null },
    { id: 'resume-screening' as TabType, label: 'Resume Screening', icon: '📄', count: null },
    { id: 'candidates' as TabType, label: 'Candidates', icon: '👥', count: candidates?.length || null },
    { id: 'interviews' as TabType, label: 'Interviews', icon: '🗓️', count: interviews?.length || null },
    { id: 'offer-letters' as TabType, label: 'Offer Letters', icon: '📝', count: null },
    { id: 'settings' as TabType, label: 'Settings', icon: '⚙️', count: null },
    { id: 'signatories' as TabType, label: 'Signatories', icon: '✍️', count: null },
    { id: 'letterheads' as TabType, label: 'Letterheads', icon: '📜', count: null },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Recruitment Hub
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              AI-Assisted HR Module for Complete Hiring Workflow
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.count !== null && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'dashboard' && (
          <DashboardView stats={stats} isLoading={statsLoading} />
        )}
        {activeTab === 'vacancies' && <VacancyManager />}
        {activeTab === 'resume-screening' && <ResumeScreening />}
        {activeTab === 'candidates' && <CandidateManager />}
        {activeTab === 'interviews' && <InterviewManager />}
        {activeTab === 'offer-letters' && <OfferLetterTab />}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Gmail Integration
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Connect your Gmail account to send automated emails to candidates and head reviewers.
              </p>
              <GmailConnectionManager />
            </div>
          </div>
        )}
        {activeTab === 'signatories' && <SignatoryManager />}
        {activeTab === 'letterheads' && <LetterheadManager />}
      </div>
    </div>
  );
}

// Dashboard Component
function DashboardView({ stats, isLoading }: { stats: any; isLoading: boolean }) {
  const { data: recentCandidates } = useCandidates({ status: undefined });
  const { data: upcomingInterviews } = useInterviews({ status: 'scheduled' });
  const { data: openVacancies } = useVacancies({ status: 'open' });

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Open Vacancies',
      value: stats?.vacancies?.open || 0,
      total: stats?.vacancies?.total || 0,
      icon: '💼',
      color: 'bg-blue-500',
    },
    {
      title: 'Total Candidates',
      value: stats?.candidates?.total || 0,
      subtitle: `${stats?.candidates?.new || 0} new`,
      icon: '👥',
      color: 'bg-green-500',
    },
    {
      title: 'Interviews Today',
      value: stats?.interviews?.today || 0,
      subtitle: `${stats?.interviews?.upcoming || 0} upcoming`,
      icon: '🗓️',
      color: 'bg-purple-500',
    },
    {
      title: 'Selected',
      value: stats?.candidates?.selected || 0,
      subtitle: `${stats?.candidates?.offer_sent || 0} offers sent`,
      icon: '✅',
      color: 'bg-emerald-500',
    },
    {
      title: 'Shortlisted',
      value: stats?.candidates?.shortlisted || 0,
      icon: '📋',
      color: 'bg-yellow-500',
    },
    {
      title: 'HR Documents',
      value: stats?.hr_documents || 0,
      subtitle: 'for RAG',
      icon: '📁',
      color: 'bg-indigo-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">{stat.icon}</span>
              <span className={`${stat.color} text-white text-xs px-2 py-1 rounded-full`}>
                {stat.total !== undefined ? `/${stat.total}` : ''}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{stat.title}</p>
              {stat.subtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-500">{stat.subtitle}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Workflow Pipeline */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recruitment Pipeline
        </h3>
        <div className="flex items-center justify-between overflow-x-auto pb-4">
          {[
            { stage: 'New', count: stats?.candidates?.new || 0, color: 'bg-gray-500' },
            { stage: 'Screening', count: 0, color: 'bg-blue-500' },
            { stage: 'Shortlisted', count: stats?.candidates?.shortlisted || 0, color: 'bg-yellow-500' },
            { stage: 'Interview', count: stats?.candidates?.interviewing || 0, color: 'bg-purple-500' },
            { stage: 'Selected', count: stats?.candidates?.selected || 0, color: 'bg-green-500' },
            { stage: 'Offer Sent', count: stats?.candidates?.offer_sent || 0, color: 'bg-emerald-500' },
            { stage: 'Joined', count: stats?.candidates?.joined || 0, color: 'bg-teal-500' },
          ].map((stage, index, arr) => (
            <div key={stage.stage} className="flex items-center">
              <div className="flex flex-col items-center min-w-[100px]">
                <div className={`${stage.color} text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg`}>
                  {stage.count}
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center">
                  {stage.stage}
                </span>
              </div>
              {index < arr.length - 1 && (
                <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-600 mx-2"></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open Vacancies */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Open Vacancies
          </h3>
          {openVacancies && openVacancies.length > 0 ? (
            <div className="space-y-3">
              {openVacancies.slice(0, 5).map((vacancy: any) => (
                <div
                  key={vacancy.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{vacancy.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {vacancy.department || 'No Department'} • {vacancy.candidate_count || 0} applicants
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    vacancy.priority === 'urgent' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    vacancy.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
                  }`}>
                    {vacancy.priority}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No open vacancies. Create one to start hiring!
            </p>
          )}
        </div>

        {/* Upcoming Interviews */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Upcoming Interviews
          </h3>
          {upcomingInterviews && upcomingInterviews.length > 0 ? (
            <div className="space-y-3">
              {upcomingInterviews.slice(0, 5).map((interview: any) => (
                <div
                  key={interview.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {interview.first_name} {interview.last_name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {interview.vacancy_title || 'General'} • {interview.interview_type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {interview.scheduled_date}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {interview.scheduled_time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No upcoming interviews scheduled.
            </p>
          )}
        </div>
      </div>

      {/* Recent Candidates */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Candidates
        </h3>
        {recentCandidates && recentCandidates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Experience</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {recentCandidates.slice(0, 5).map((candidate: any) => (
                  <tr key={candidate.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {candidate.first_name} {candidate.last_name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{candidate.email}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {candidate.vacancy_title || 'General'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {candidate.experience_years || 0} years
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <CandidateStatusBadge status={candidate.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(candidate.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No candidates yet. Add candidates or create vacancies to receive applications.
          </p>
        )}
      </div>
    </div>
  );
}

// Status Badge Component
function CandidateStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { color: string; label: string }> = {
    new: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', label: 'New' },
    screening: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', label: 'Screening' },
    shortlisted: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', label: 'Shortlisted' },
    interview_scheduled: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', label: 'Interview Scheduled' },
    interviewed: { color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200', label: 'Interviewed' },
    selected: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', label: 'Selected' },
    offer_sent: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200', label: 'Offer Sent' },
    offer_accepted: { color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200', label: 'Offer Accepted' },
    joined: { color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200', label: 'Joined' },
    rejected: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', label: 'Rejected' },
    withdrawn: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', label: 'Withdrawn' },
    on_hold: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200', label: 'On Hold' },
  };

  const config = statusConfig[status] || statusConfig.new;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

export { CandidateStatusBadge };
