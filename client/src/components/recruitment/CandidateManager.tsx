import { useState, useEffect } from 'react';
import { useVacancies, useCandidates, useUpdateCandidate, useDeleteCandidate, useScheduleInterview, useSendInterestEmail, useUpdateInterestDetails, useInterviews, useUpdateInterview, useSendHeadReview, useSendInterviewInvite } from '../../hooks/useRecruitment';
import type { Candidate, Interview, ReviewerEmail } from '../../api/recruitment';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../api/client';
import { gmailApi } from '../../api/automation';
import { CLIENT_BASE_URL } from '../../config/api';

interface EditingCell {
  candidateId: number;
  field: 'current_salary' | 'expected_salary' | 'notice_period' | 'is_interested' | 'interview_availability';
}

interface GmailConnection {
  id: number;
  email: string;
  is_active: number;
}

export function CandidateManager() {
  const [vacancyFilter, setVacancyFilter] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [scheduleModal, setScheduleModal] = useState<Candidate | null>(null);
  const [sendEmailModal, setSendEmailModal] = useState<Candidate | null>(null);
  const [sendHeadReviewModal, setSendHeadReviewModal] = useState(false);
  const [selectedCandidatesForReview, setSelectedCandidatesForReview] = useState<Set<number>>(new Set());
  const [gmailConnections, setGmailConnections] = useState<GmailConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [sendInterviewInviteModal, setSendInterviewInviteModal] = useState<{ candidate: Candidate; interview: Interview } | null>(null);

  const { user } = useAuth();
  const { data: vacancies } = useVacancies();
  const { data: allInterviews = [], refetch: refetchInterviews } = useInterviews();
  const scheduleInterviewMutation = useScheduleInterview();
  const sendInterestEmailMutation = useSendInterestEmail();
  const updateInterestDetailsMutation = useUpdateInterestDetails();
  const updateInterviewMutation = useUpdateInterview();
  const sendHeadReviewMutation = useSendHeadReview();
  const sendInterviewInviteMutation = useSendInterviewInvite();

  // Use real API for candidates
  const { data: candidates = [], isLoading: _isLoading, refetch } = useCandidates({
    vacancy_id: vacancyFilter,
    status: statusFilter || undefined,
  });
  const updateCandidateMutation = useUpdateCandidate();
  const deleteCandidateMutation = useDeleteCandidate();

  // Filter candidates (additional client-side filtering if needed)
  const filteredCandidates = candidates.filter((c: Candidate) => {
    if (vacancyFilter && c.vacancy_id !== vacancyFilter) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    return true;
  });

  // Get vacancy details for skill columns
  const selectedVacancy = vacancies?.find((v: any) => v.id === vacancyFilter);
  const requiredSkills = selectedVacancy?.skills_required
    ? selectedVacancy.skills_required.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  // Debug: Log vacancy and skills info
  console.log('CandidateManager Debug:', {
    vacancyFilter,
    selectedVacancy: selectedVacancy ? { id: selectedVacancy.id, title: selectedVacancy.title, skills_required: selectedVacancy.skills_required } : null,
    requiredSkills,
    totalVacancies: vacancies?.length
  });

  const handleStartEdit = (candidateId: number, field: EditingCell['field'], currentValue: any) => {
    setEditingCell({ candidateId, field });
    if (field === 'current_salary' || field === 'expected_salary') {
      setEditValue(currentValue ? String(currentValue / 100000) : '');
    } else {
      setEditValue(currentValue || '');
    }
  };

  const handleSaveEdit = () => {
    if (!editingCell) return;

    const { candidateId, field } = editingCell;
    let value: any = editValue;

    if (field === 'current_salary' || field === 'expected_salary') {
      value = editValue ? parseFloat(editValue) * 100000 : undefined;
    }

    updateCandidateMutation.mutate({ id: candidateId, candidate: { [field]: value } });
    setEditingCell(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleDeleteCandidate = (id: number) => {
    deleteCandidateMutation.mutate(id);
    setDeleteConfirm(null);
  };

  // Refresh Gmail connections
  const refreshGmailConnections = async () => {
    try {
      const connections = await api.get<GmailConnection[]>('/gmail/connections');
      console.log('Gmail connections refreshed:', connections);
      setGmailConnections(connections.filter(c => !!c.is_active));
    } catch (error) {
      console.error('Error refreshing Gmail connections:', error);
    }
  };

  // Listen for Gmail OAuth callback at component level (persists across modal open/close)
  useEffect(() => {
    const handleGmailOAuthCallback = async (event: MessageEvent) => {
      console.log('Message event received:', event.data);
      if (event.data?.type === 'gmail-oauth-callback' && event.data?.code) {
        console.log('Gmail OAuth callback received with code');
        try {
          const result = await gmailApi.handleCallback(event.data.code);
          console.log('Gmail connection saved successfully:', result);
          alert('Gmail account connected successfully!');
          // Refresh connections
          await refreshGmailConnections();
        } catch (error: any) {
          console.error('Failed to save Gmail connection:', error);
          const errorMsg = typeof error === 'object'
            ? (error.error || error.message || JSON.stringify(error))
            : String(error);
          alert(`Failed to connect Gmail: ${errorMsg}`);
        }
      }
    };

    window.addEventListener('message', handleGmailOAuthCallback);
    console.log('Gmail OAuth callback listener registered');
    return () => {
      window.removeEventListener('message', handleGmailOAuthCallback);
      console.log('Gmail OAuth callback listener removed');
    };
  }, []);

  // Handle opening send email modal
  const handleOpenSendEmailModal = async (candidate: Candidate) => {
    setSendEmailModal(candidate);
    setLoadingConnections(true);
    try {
      const connections = await api.get<GmailConnection[]>('/gmail/connections');
      console.log('Gmail connections fetched:', connections);
      setGmailConnections(connections.filter(c => !!c.is_active));
    } catch (error) {
      console.error('Error fetching Gmail connections:', error);
      setGmailConnections([]);
    } finally {
      setLoadingConnections(false);
    }
  };

  // Handle opening send interview invite modal
  const handleOpenSendInterviewInviteModal = async (candidate: Candidate, interview: Interview) => {
    setSendInterviewInviteModal({ candidate, interview });
    setLoadingConnections(true);
    try {
      const connections = await api.get<GmailConnection[]>('/gmail/connections');
      console.log('Gmail connections fetched for interview invite:', connections);
      setGmailConnections(connections.filter(c => !!c.is_active));
    } catch (error) {
      console.error('Error fetching Gmail connections:', error);
      setGmailConnections([]);
    } finally {
      setLoadingConnections(false);
    }
  };

  // Handle sending interest email
  const handleSendInterestEmail = (candidateId: number, gmailConnectionId: number) => {
    sendInterestEmailMutation.mutate(
      { candidateId, gmailConnectionId },
      {
        onSuccess: (result) => {
          alert(`Email sent successfully!\n${result.note}`);
          setSendEmailModal(null);
          refetch();
        },
        onError: (error: any) => {
          alert(`Failed to send email: ${error.message || 'Unknown error'}`);
        }
      }
    );
  };

  // Get email status badge
  const getEmailStatusBadge = (candidate: Candidate) => {
    if (!candidate.interest_email_sent_date && !candidate.form_response_date) {
      return <span className="text-xs text-gray-400">Not sent</span>;
    }
    if (candidate.interest_email_sent_date && !candidate.form_response_date) {
      // Email sent but no response yet
      const sentDate = new Date(candidate.interest_email_sent_date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short'
      });
      return (
        <div className="flex flex-col items-center">
          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
            Mail Sent
          </span>
          <span className="text-xs text-gray-400 mt-0.5">{sentDate}</span>
        </div>
      );
    }
    if (candidate.form_response_date) {
      if (candidate.is_interested === 'yes') {
        return (
          <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 font-medium">
            Interested
          </span>
        );
      }
      return (
        <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 font-medium">
          Not Interested
        </span>
      );
    }
    return null;
  };

  // Parse skill experience data for a candidate
  const getSkillExperience = (candidate: Candidate, skill: string): string => {
    try {
      const skillData = candidate.skill_experience_data;
      if (!skillData) return '-';

      const data = typeof skillData === 'string' ? JSON.parse(skillData) : skillData;
      if (!data || Object.keys(data).length === 0) return '-';

      // Try exact match first, then case-insensitive match
      let value = data[skill];
      if (value === undefined) {
        // Try case-insensitive search
        const skillLower = skill.toLowerCase();
        for (const key of Object.keys(data)) {
          if (key.toLowerCase() === skillLower || key.toLowerCase().includes(skillLower) || skillLower.includes(key.toLowerCase())) {
            value = data[key];
            break;
          }
        }
      }

      if (value === undefined || value === null || value === '') return '-';
      if (value === 'No' || value === 'no' || value === 0) return 'No';
      if (typeof value === 'number') return `${value} yrs`;
      if (typeof value === 'string' && !isNaN(parseFloat(value))) return `${value} yrs`;
      return String(value);
    } catch (err) {
      console.error('Error parsing skill_experience_data:', err, candidate.skill_experience_data);
      return '-';
    }
  };

  // Format experience years to "Xy Zm" format (e.g., 1.25 -> "1y 3m")
  const formatExperience = (years: number | undefined): string => {
    if (!years || years === 0) return '0';
    const fullYears = Math.floor(years);
    const months = Math.round((years - fullYears) * 12);

    if (fullYears === 0) {
      return `${months}m`;
    } else if (months === 0) {
      return `${fullYears}y`;
    } else {
      return `${fullYears}y ${months}m`;
    }
  };

  // Get interview for a candidate
  const getCandidateInterview = (candidateId: number): Interview | undefined => {
    return allInterviews.find((i: Interview) => i.candidate_id === candidateId);
  };

  // Check if interview time is pending (needs HR to set)
  const isInterviewTimePending = (interview: Interview | undefined): boolean => {
    if (!interview) return false;
    return !!(interview.scheduled_time === '00:00' || interview.notes?.includes('TIME_PENDING'));
  };

  // Format interview date/time display
  const formatInterviewDateTime = (interview: Interview | undefined): string => {
    if (!interview) return '-';
    const date = new Date(interview.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    if (isInterviewTimePending(interview)) {
      return `${date} (Set time)`;
    }
    return `${date} ${interview.scheduled_time}`;
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      new: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', label: 'New' },
      screening: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', label: 'Screening' },
      shortlisted: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', label: 'Shortlisted' },
      interview_scheduled: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', label: 'Interview Scheduled' },
      interviewed: { color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200', label: 'Interviewed' },
      selected: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', label: 'Selected' },
      offer_sent: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200', label: 'Offer Sent' },
      rejected: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', label: 'Rejected' },
    };
    const config = statusConfig[status] || statusConfig.new;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>{config.label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Candidates Screening Table
          </h2>
          <select
            value={vacancyFilter || ''}
            onChange={(e) => setVacancyFilter(e.target.value ? Number(e.target.value) : undefined)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Vacancies</option>
            {vacancies?.map((v: any) => (
              <option key={v.id} value={v.id}>{v.title}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="screening">Screening</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="interview_scheduled">Interview Scheduled</option>
            <option value="interviewed">Interviewed</option>
            <option value="selected">Selected</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {filteredCandidates.length} candidates
          </span>
          {/* Show Head Review button when there are candidates who filled the form */}
          {filteredCandidates.some((c: Candidate) => c.form_response_date) && (
            <button
              onClick={async () => {
                // Fetch Gmail connections first
                try {
                  const connections = await api.get<GmailConnection[]>('/gmail/connections');
                  setGmailConnections(connections.filter(c => !!c.is_active));
                } catch (error) {
                  console.error('Error fetching Gmail connections:', error);
                }
                // Auto-select candidates who filled the form and are interested
                const formFilledCandidates = filteredCandidates
                  .filter((c: Candidate) => c.form_response_date && c.is_interested === 'yes')
                  .map((c: Candidate) => c.id);
                setSelectedCandidatesForReview(new Set(formFilledCandidates));
                setSendHeadReviewModal(true);
              }}
              className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Send for Head Review
            </button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      {vacancyFilter && requiredSkills.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Skills from JD:</strong> {requiredSkills.join(', ')}
          </p>
        </div>
      )}
      {vacancyFilter && requiredSkills.length === 0 && selectedVacancy && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            <strong>Note:</strong> No skills defined for vacancy "{selectedVacancy.title}". Add skills in the JD to see skill-wise experience columns.
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Candidate?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this candidate? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCandidate(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Candidate Modal */}
      {editingCandidate && (
        <EditCandidateModal
          candidate={editingCandidate}
          interview={getCandidateInterview(editingCandidate.id)}
          onClose={() => setEditingCandidate(null)}
          onSave={(updates, interviewUpdates) => {
            const candidateId = editingCandidate.id;

            // Close modal first to give immediate feedback
            setEditingCandidate(null);

            // Save candidate data
            updateCandidateMutation.mutate(
              { id: candidateId, candidate: updates },
              {
                onSuccess: () => {
                  // Refetch candidates after candidate update
                  refetch();
                  // Also refetch interviews in case status changed
                  refetchInterviews();
                }
              }
            );

            // Save interview data if provided
            if (interviewUpdates) {
              console.log('Updating interview:', interviewUpdates);
              updateInterviewMutation.mutate(
                { id: interviewUpdates.interviewId, updates: interviewUpdates.data },
                {
                  onSuccess: () => {
                    console.log('Interview update success, refetching...');
                    refetch(); // Refetch candidates
                    refetchInterviews(); // Refetch interviews for column update
                  },
                  onError: (error) => {
                    console.error('Interview update failed:', error);
                    alert('Failed to update interview. Please try again.');
                  }
                }
              );
            }
          }}
        />
      )}

      {/* Schedule Interview Modal */}
      {scheduleModal && (
        <ScheduleInterviewModal
          candidate={scheduleModal}
          onClose={() => setScheduleModal(null)}
          onSchedule={(interview) => {
            // Call the real API to schedule interview
            scheduleInterviewMutation.mutate({
              candidate_id: interview.candidate_id,
              vacancy_id: interview.vacancy_id,
              round_number: interview.round_number || 1,
              interview_type: interview.interview_type,
              scheduled_date: interview.scheduled_date,
              scheduled_time: interview.scheduled_time,
              duration_minutes: interview.duration_minutes,
              interviewer_id: user?.id || 1, // Use current user as interviewer
              location: interview.location,
              meeting_link: interview.meeting_link,
            }, {
              onSuccess: () => {
                // Update candidate status to interview_scheduled
                updateCandidateMutation.mutate({
                  id: interview.candidate_id,
                  candidate: { status: 'interview_scheduled' }
                });
                setScheduleModal(null);
              },
              onError: (error) => {
                console.error('Failed to schedule interview:', error);
                alert('Failed to schedule interview. Please try again.');
              }
            });
          }}
        />
      )}

      {/* Send Interest Email Modal */}
      {sendEmailModal && (
        <SendInterestEmailModal
          candidate={sendEmailModal}
          gmailConnections={gmailConnections}
          loadingConnections={loadingConnections}
          isSending={sendInterestEmailMutation.isPending}
          onClose={() => setSendEmailModal(null)}
          onSend={handleSendInterestEmail}
          onRefreshConnections={async () => {
            try {
              const connections = await api.get<GmailConnection[]>('/gmail/connections');
              console.log('Gmail connections refreshed:', connections);
              setGmailConnections(connections.filter(c => !!c.is_active));
            } catch (error) {
              console.error('Error refreshing Gmail connections:', error);
            }
          }}
        />
      )}

      {/* Send Head Review Modal */}
      {sendHeadReviewModal && (
        <SendHeadReviewModal
          allCandidates={filteredCandidates.filter((c: Candidate) => c.form_response_date)}
          vacancyTitle={selectedVacancy?.title || filteredCandidates.find((c: Candidate) => c.form_response_date)?.vacancy_title || ''}
          selectedCandidates={selectedCandidatesForReview}
          onToggleCandidate={(id) => {
            setSelectedCandidatesForReview(prev => {
              const newSet = new Set(prev);
              if (newSet.has(id)) {
                newSet.delete(id);
              } else {
                newSet.add(id);
              }
              return newSet;
            });
          }}
          isSending={sendHeadReviewMutation.isPending}
          onClose={() => {
            setSendHeadReviewModal(false);
            setSelectedCandidatesForReview(new Set());
          }}
          onSend={(reviewerEmails, gmailConnectionId) => {
            // Get vacancy_id from selected candidates
            const selectedCandidatesList = filteredCandidates.filter((c: Candidate) => selectedCandidatesForReview.has(c.id));
            const vacancyId = vacancyFilter || selectedCandidatesList[0]?.vacancy_id;

            if (!vacancyId) {
              alert('Please select candidates from a specific vacancy');
              return;
            }

            sendHeadReviewMutation.mutate({
              vacancy_id: vacancyId,
              candidate_ids: Array.from(selectedCandidatesForReview),
              reviewer_emails: reviewerEmails,
              gmail_connection_id: gmailConnectionId
            }, {
              onSuccess: (result: any) => {
                // Check if any emails failed and show review links


                let message = result.message;

                // Show review links if emails weren't sent
                if (result.results?.some((r: any) => r.token)) {
                  const links = result.results
                    .filter((r: any) => r.token)
                    .map((r: any) => `\n${r.email}: ${CLIENT_BASE_URL}/head-review/${r.token}`)
                    .join('');
                  message += '\n\nReview Links (share manually):' + links;
                }

                alert(message);
                setSendHeadReviewModal(false);
                setSelectedCandidatesForReview(new Set());
                refetch();
              },
              onError: (error: any) => {
                alert(`Failed to send: ${error.message || 'Unknown error'}`);
              }
            });
          }}
        />
      )}

      {/* Send Interview Invite Modal */}
      {sendInterviewInviteModal && (
        <SendInterviewInviteModal
          candidate={sendInterviewInviteModal.candidate}
          interview={sendInterviewInviteModal.interview}
          vacancyTitle={selectedVacancy?.title || sendInterviewInviteModal.candidate.vacancy_title || ''}
          gmailConnections={gmailConnections}
          loadingConnections={loadingConnections}
          isSending={sendInterviewInviteMutation.isPending}
          onClose={() => setSendInterviewInviteModal(null)}
          onConnectGmail={async () => {
            try {
              const response = await gmailApi.getAuthUrl();
              const authUrl = response.authUrl;
              console.log('Gmail Auth URL:', authUrl);
              const width = 600;
              const height = 600;
              const left = window.screenX + (window.outerWidth - width) / 2;
              const top = window.screenY + (window.outerHeight - height) / 2;
              window.open(authUrl, 'Gmail OAuth', `width=${width},height=${height},left=${left},top=${top}`);
            } catch (error) {
              console.error('Error getting Gmail auth URL:', error);
              alert('Failed to start Gmail connection. Please try again.');
            }
          }}
          onSend={(gmailConnectionId, additionalInterviewers, customMessage, isOnline, locationOrLink) => {
            sendInterviewInviteMutation.mutate({
              interview_id: sendInterviewInviteModal.interview.id,
              gmail_connection_id: gmailConnectionId,
              additional_interviewers: additionalInterviewers,
              custom_message: customMessage,
              is_online: isOnline,
              location_or_link: locationOrLink
            }, {
              onSuccess: (result: any) => {
                const sentToList = [result.sent_to];
                if (result.cc_sent_to && result.cc_sent_to.length > 0) {
                  sentToList.push(...result.cc_sent_to);
                }
                alert(`Interview invitation sent successfully!\n\nSent to:\n${sentToList.join('\n')}\n\nRound: ${result.interview_details.round}\nDate: ${result.interview_details.date}\nTime: ${result.interview_details.time}`);
                setSendInterviewInviteModal(null);
                refetch();
                refetchInterviews();
              },
              onError: (error: any) => {
                alert(`Failed to send invitation: ${error.message || 'Unknown error'}`);
              }
            });
          }}
        />
      )}

      {/* Screening Table */}
      {filteredCandidates.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-100 dark:bg-gray-900">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    S.No
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Date
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap min-w-[180px]">
                    Candidate Name
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Mobile No.
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Email Status
                  </th>
                  {/* Dynamic skill columns from JD */}
                  {requiredSkills.slice(0, 5).map((skill: string) => (
                    <th
                      key={skill}
                      className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap"
                    >
                      Exp. in {skill}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Total Exp.
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Current CTC
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Expected CTC
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Notice Period
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Interested
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Candidate Availability
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Head Review
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Interview Date/Time
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Location
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCandidates.map((candidate, index) => (
                  <tr key={candidate.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    {/* S.No */}
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-white text-center border-r border-gray-200 dark:border-gray-700">
                      {index + 1}
                    </td>
                    {/* Date */}
                    <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap border-r border-gray-200 dark:border-gray-700">
                      {candidate.screening_date || candidate.createdAt?.split('T')[0] || '-'}
                    </td>
                    {/* Candidate Name */}
                    <td className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">
                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                        {candidate.first_name} {candidate.last_name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{candidate.email}</div>
                      <div className="text-xs text-gray-400">{candidate.current_company}</div>
                    </td>
                    {/* Mobile No. */}
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                      {candidate.phone || '-'}
                    </td>
                    {/* Status */}
                    <td className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">
                      {getStatusBadge(candidate.status)}
                    </td>
                    {/* Email Status */}
                    <td className="px-3 py-3 text-center border-r border-gray-200 dark:border-gray-700">
                      {getEmailStatusBadge(candidate)}
                    </td>
                    {/* Dynamic skill experience columns */}
                    {requiredSkills.slice(0, 5).map((skill: string) => (
                      <td
                        key={skill}
                        className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 text-center border-r border-gray-200 dark:border-gray-700"
                      >
                        {getSkillExperience(candidate, skill)}
                      </td>
                    ))}
                    {/* Total Years of Work Exp */}
                    <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 text-center border-r border-gray-200 dark:border-gray-700">
                      {formatExperience(candidate.experience_years)}
                    </td>
                    {/* Editable Current CTC */}
                    <td className="px-3 py-3 text-sm border-r border-gray-200 dark:border-gray-700">
                      {editingCell?.candidateId === candidate.id && editingCell?.field === 'current_salary' ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={handleSaveEdit}
                          autoFocus
                          className="w-20 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="LPA"
                        />
                      ) : (
                        <div
                          className="cursor-pointer text-center hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded"
                          onClick={() => handleStartEdit(candidate.id, 'current_salary', candidate.current_salary)}
                          title="Click to edit"
                        >
                          {candidate.current_salary
                            ? `${(candidate.current_salary / 100000).toFixed(1)} LPA`
                            : <span className="text-gray-400">&nbsp;</span>
                          }
                        </div>
                      )}
                    </td>
                    {/* Editable Expected CTC */}
                    <td className="px-3 py-3 text-sm border-r border-gray-200 dark:border-gray-700">
                      {editingCell?.candidateId === candidate.id && editingCell?.field === 'expected_salary' ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={handleSaveEdit}
                          autoFocus
                          className="w-20 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="LPA"
                        />
                      ) : (
                        <div
                          className="cursor-pointer text-center hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded"
                          onClick={() => handleStartEdit(candidate.id, 'expected_salary', candidate.expected_salary)}
                          title="Click to edit"
                        >
                          {candidate.expected_salary
                            ? `${(candidate.expected_salary / 100000).toFixed(1)} LPA`
                            : <span className="text-gray-400">&nbsp;</span>
                          }
                        </div>
                      )}
                    </td>
                    {/* Editable Notice Period */}
                    <td className="px-3 py-3 text-sm border-r border-gray-200 dark:border-gray-700">
                      {editingCell?.candidateId === candidate.id && editingCell?.field === 'notice_period' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={handleSaveEdit}
                          autoFocus
                          className="w-24 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="e.g. 30 days"
                        />
                      ) : (
                        <div
                          className="cursor-pointer text-center hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded"
                          onClick={() => handleStartEdit(candidate.id, 'notice_period', candidate.notice_period)}
                          title="Click to edit"
                        >
                          {candidate.notice_period || <span className="text-gray-400">&nbsp;</span>}
                        </div>
                      )}
                    </td>
                    {/* Editable Interested */}
                    <td className="px-3 py-3 text-sm border-r border-gray-200 dark:border-gray-700">
                      {editingCell?.candidateId === candidate.id && editingCell?.field === 'is_interested' ? (
                        <select
                          value={editValue}
                          onChange={(e) => {
                            setEditValue(e.target.value);
                            // Auto-save on selection
                            updateInterestDetailsMutation.mutate(
                              { candidateId: candidate.id, details: { is_interested: e.target.value as 'yes' | 'no' | 'pending' } },
                              { onSuccess: () => { setEditingCell(null); refetch(); } }
                            );
                          }}
                          onBlur={() => setEditingCell(null)}
                          autoFocus
                          className="w-24 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        >
                          <option value="">-</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                          <option value="pending">Pending</option>
                        </select>
                      ) : (
                        <div
                          className="cursor-pointer text-center hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded"
                          onClick={() => {
                            setEditingCell({ candidateId: candidate.id, field: 'is_interested' });
                            setEditValue(candidate.is_interested || '');
                          }}
                          title="Click to edit"
                        >
                          {candidate.is_interested === 'yes' ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Yes</span>
                          ) : candidate.is_interested === 'no' ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">No</span>
                          ) : candidate.is_interested === 'pending' ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">Pending</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      )}
                    </td>
                    {/* Candidate Availability (from form response) */}
                    <td className="px-3 py-3 text-sm text-center border-r border-gray-200 dark:border-gray-700">
                      {candidate.interview_availability === 'tomorrow' ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          Tomorrow
                        </span>
                      ) : candidate.preferred_interview_date ? (
                        <div className="text-xs">
                          <div className="text-gray-700 dark:text-gray-300">{candidate.preferred_interview_date.split('T')[0]}</div>
                          {candidate.preferred_interview_date.includes('T') && (
                            <div className="text-gray-500">{candidate.preferred_interview_date.split('T')[1]}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    {/* Head Review Status */}
                    <td className="px-3 py-3 text-sm text-center border-r border-gray-200 dark:border-gray-700">
                      {candidate.head_review_approved === 1 ? (
                        <div>
                          <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            Approved
                          </span>
                          {candidate.head_review_date && (
                            <div className="text-xs text-gray-500 mt-1">
                              {candidate.head_review_date.split('T')[0]}
                            </div>
                          )}
                        </div>
                      ) : candidate.head_review_approved === 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                          Not Selected
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    {/* Interview Date/Time (Read-only - edit via Edit modal) */}
                    <td className="px-3 py-3 text-sm border-r border-gray-200 dark:border-gray-700">
                      {(() => {
                        const interview = getCandidateInterview(candidate.id);
                        const isPending = isInterviewTimePending(interview);

                        if (!interview) {
                          return <span className="text-gray-400 text-center block">-</span>;
                        }

                        return (
                          <div
                            className={`text-center px-2 py-1 rounded ${
                              isPending
                                ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}
                            title={isPending ? 'Set time in Edit modal' : `${interview.scheduled_date} ${interview.scheduled_time}`}
                          >
                            <span className={isPending ? 'font-medium' : ''}>
                              {formatInterviewDateTime(interview)}
                            </span>
                            {isPending && (
                              <span className="block text-xs text-orange-600 dark:text-orange-400">⚠ Set time</span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    {/* Location */}
                    <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 text-center border-r border-gray-200 dark:border-gray-700">
                      {candidate.city || '-'}
                    </td>
                    {/* Actions */}
                    <td className="px-3 py-3 text-sm">
                      <div className="flex items-center justify-center gap-1">
                        {/* Send Interest Email - only for shortlisted candidates without email sent */}
                        {(candidate.status === 'shortlisted' || candidate.status === 'screening') && !candidate.interest_email_sent_date && (
                          <button
                            onClick={() => handleOpenSendEmailModal(candidate)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded"
                            title="Send Interest Email"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                        {/* Schedule Interview - only for shortlisted */}
                        {(candidate.status === 'shortlisted' || candidate.status === 'screening') && (
                          <button
                            onClick={() => setScheduleModal(candidate)}
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                            title="Schedule Interview"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                        {/* Send Interview Invite - for candidates with interview_scheduled status or having an interview */}
                        {(() => {
                          const interview = getCandidateInterview(candidate.id);
                          // Show button if candidate has an interview OR has interview_scheduled/interviewed status
                          if (interview || candidate.status === 'interview_scheduled' || candidate.status === 'interviewed') {
                            return (
                              <button
                                onClick={() => {
                                  if (interview) {
                                    handleOpenSendInterviewInviteModal(candidate, interview);
                                  } else {
                                    alert('No interview scheduled for this candidate. Please schedule an interview first.');
                                  }
                                }}
                                className="p-1.5 text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded"
                                title="Send Interview Invitation Email"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
                                </svg>
                              </button>
                            );
                          }
                          return null;
                        })()}
                        {/* Edit */}
                        <button
                          onClick={() => setEditingCandidate(candidate)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => setDeleteConfirm(candidate.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            No candidates found. Import candidates from Naukri tab.
          </p>
        </div>
      )}
    </div>
  );
}

// Edit Candidate Modal
function EditCandidateModal({
  candidate,
  interview,
  onClose,
  onSave,
}: {
  candidate: Candidate;
  interview?: Interview;
  onClose: () => void;
  onSave: (
    updates: Partial<Candidate>,
    interviewUpdates?: { interviewId: number; data: { scheduled_date?: string; scheduled_time?: string } }
  ) => void;
}) {
  const [formData, setFormData] = useState({
    experience_years: candidate.experience_years || '',
    current_salary: candidate.current_salary ? candidate.current_salary / 100000 : '',
    expected_salary: candidate.expected_salary ? candidate.expected_salary / 100000 : '',
    notice_period: candidate.notice_period || '',
    status: candidate.status,
    interview_date: interview?.scheduled_date || '',
    interview_time: interview?.scheduled_time === '00:00' ? '' : (interview?.scheduled_time || ''),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Prepare candidate updates
    const candidateUpdates = {
      experience_years: formData.experience_years ? Number(formData.experience_years) : undefined,
      current_salary: formData.current_salary ? Number(formData.current_salary) * 100000 : undefined,
      expected_salary: formData.expected_salary ? Number(formData.expected_salary) * 100000 : undefined,
      notice_period: formData.notice_period || undefined,
      status: formData.status as Candidate['status'],
    };

    // Prepare interview updates if changed
    let interviewUpdates: { interviewId: number; data: { scheduled_date?: string; scheduled_time?: string } } | undefined;

    if (interview) {
      // Normalize dates for comparison (handle both ISO and date-only formats)
      const originalDate = interview.scheduled_date?.split('T')[0] || '';
      const originalTime = interview.scheduled_time === '00:00' ? '' : (interview.scheduled_time || '');

      const newDate = formData.interview_date || '';
      const newTime = formData.interview_time || '';

      const dateChanged = newDate !== originalDate;
      const timeChanged = newTime !== originalTime;

      console.log('Interview change detection:', {
        originalDate, newDate, dateChanged,
        originalTime, newTime, timeChanged
      });

      if (dateChanged || timeChanged) {
        const data: { scheduled_date?: string; scheduled_time?: string } = {};
        // Always send both date and time to ensure consistency
        if (newDate) {
          data.scheduled_date = newDate;
        }
        if (newTime) {
          data.scheduled_time = newTime;
        }
        interviewUpdates = { interviewId: interview.id, data };
        console.log('Interview updates to send:', interviewUpdates);
      }
    }

    // Save both together
    onSave(candidateUpdates, interviewUpdates);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit Candidate: {candidate.first_name} {candidate.last_name}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-2xl">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Read-only info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input type="text" value={candidate.email} disabled className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
              <input type="text" value={candidate.phone} disabled className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Company</label>
              <input type="text" value={candidate.current_company} disabled className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Experience (Years) <span className="text-blue-500">*HR</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.experience_years}
                onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g. 1.25"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Skills</label>
            <input type="text" value={candidate.skills} disabled className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500" />
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Editable fields */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Current CTC (LPA) <span className="text-blue-500">*HR</span>
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.current_salary}
                onChange={(e) => setFormData({ ...formData, current_salary: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g. 12.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expected CTC (LPA) <span className="text-blue-500">*HR</span>
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.expected_salary}
                onChange={(e) => setFormData({ ...formData, expected_salary: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g. 15.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notice Period <span className="text-blue-500">*HR</span>
              </label>
              <input
                type="text"
                value={formData.notice_period}
                onChange={(e) => setFormData({ ...formData, notice_period: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g. 30 days"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Candidate['status'] })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="new">New</option>
              <option value="screening">Screening</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="interview_scheduled">Interview Scheduled</option>
              <option value="interviewed">Interviewed</option>
              <option value="selected">Selected</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Interview Date/Time Section */}
          {interview && (
            <>
              <hr className="border-gray-200 dark:border-gray-700" />
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Interview Schedule
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Interview Date
                    </label>
                    <input
                      type="date"
                      value={formData.interview_date}
                      onChange={(e) => setFormData({ ...formData, interview_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Interview Time
                    </label>
                    <input
                      type="time"
                      value={formData.interview_time}
                      onChange={(e) => setFormData({ ...formData, interview_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                {interview.scheduled_time === '00:00' && (
                  <p className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                    ⚠ Interview time is pending - please set a time
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Schedule Interview Modal
function ScheduleInterviewModal({
  candidate,
  onClose,
  onSchedule,
}: {
  candidate: Candidate;
  onClose: () => void;
  onSchedule: (interview: any) => void;
}) {
  const [formData, setFormData] = useState({
    interview_type: 'technical' as 'technical' | 'hr' | 'managerial' | 'final',
    scheduled_date: '',
    scheduled_time: '10:00',
    duration_minutes: 60,
    location: 'Online',
    meeting_link: '',
    interviewer_name: '',
  });
  const [timeError, setTimeError] = useState<string>('');

  // Get minimum time for today
  const getMinTimeForToday = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = Math.ceil(now.getMinutes() / 15) * 15; // Round up to next 15 min
    if (minutes >= 60) {
      return `${(parseInt(hours) + 1).toString().padStart(2, '0')}:00`;
    }
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  // Check if time is valid for selected date
  const isTimeValid = (date: string, time: string): boolean => {
    const today = new Date().toISOString().split('T')[0];
    if (date === today) {
      const now = new Date();
      const [hours, minutes] = time.split(':').map(Number);
      const selectedTime = new Date();
      selectedTime.setHours(hours, minutes, 0, 0);
      return selectedTime > now;
    }
    return true;
  };

  // Handle date change
  const handleDateChange = (newDate: string) => {
    setFormData({ ...formData, scheduled_date: newDate });
    // Validate current time against new date
    if (!isTimeValid(newDate, formData.scheduled_time)) {
      const minTime = getMinTimeForToday();
      setFormData(prev => ({ ...prev, scheduled_date: newDate, scheduled_time: minTime }));
      setTimeError('Time updated to next available slot');
      setTimeout(() => setTimeError(''), 3000);
    } else {
      setTimeError('');
    }
  };

  // Handle time change
  const handleTimeChange = (newTime: string) => {
    if (!isTimeValid(formData.scheduled_date, newTime)) {
      setTimeError('Cannot select a time that has already passed');
      return;
    }
    setTimeError('');
    setFormData({ ...formData, scheduled_time: newTime });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.scheduled_date || !formData.interviewer_name) {
      alert('Please fill all required fields');
      return;
    }

    // Final validation for past time
    if (!isTimeValid(formData.scheduled_date, formData.scheduled_time)) {
      setTimeError('Cannot schedule interview for a time that has already passed');
      return;
    }

    onSchedule({
      candidate_id: candidate.id,
      vacancy_id: candidate.vacancy_id,
      vacancy_title: candidate.vacancy_title,
      candidate_name: `${candidate.first_name} ${candidate.last_name}`,
      candidate_email: candidate.email,
      candidate_phone: candidate.phone,
      interview_type: formData.interview_type,
      round_number: 1,
      scheduled_date: formData.scheduled_date,
      scheduled_time: formData.scheduled_time,
      duration_minutes: formData.duration_minutes,
      location: formData.location,
      meeting_link: formData.meeting_link || undefined,
      interviewer_name: formData.interviewer_name,
      status: 'scheduled' as const,
      experience_years: candidate.experience_years,
      skills: candidate.skills,
      current_salary: candidate.current_salary,
      expected_salary: candidate.expected_salary,
      notice_period: candidate.notice_period,
      current_location: candidate.city || '',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Schedule Interview
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-2xl">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Candidate Info */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {candidate.first_name} {candidate.last_name}
            </h3>
            <p className="text-sm text-gray-500">{candidate.vacancy_title}</p>
            <p className="text-sm text-gray-500">{candidate.experience_years} years exp. | {candidate.city}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Interview Type *
              </label>
              <select
                value={formData.interview_type}
                onChange={(e) => setFormData({ ...formData, interview_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="technical">Technical</option>
                <option value="hr">HR</option>
                <option value="managerial">Managerial</option>
                <option value="final">Final</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duration (mins)
              </label>
              <select
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value={30}>30 mins</option>
                <option value={45}>45 mins</option>
                <option value={60}>60 mins</option>
                <option value={90}>90 mins</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => handleDateChange(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Time *
              </label>
              <input
                type="time"
                value={formData.scheduled_time}
                onChange={(e) => handleTimeChange(e.target.value)}
                min={formData.scheduled_date === new Date().toISOString().split('T')[0] ? getMinTimeForToday() : undefined}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  timeError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                required
              />
            </div>
          </div>
          {timeError && (
            <p className="text-sm text-red-600 dark:text-red-400 -mt-2">{timeError}</p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Interviewer Name *
            </label>
            <input
              type="text"
              value={formData.interviewer_name}
              onChange={(e) => setFormData({ ...formData, interviewer_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter interviewer name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Online / Office"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Meeting Link
              </label>
              <input
                type="url"
                value={formData.meeting_link}
                onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="https://meet.google.com/..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Schedule Interview
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Send Interest Email Modal
function SendInterestEmailModal({
  candidate,
  gmailConnections,
  loadingConnections,
  isSending,
  onClose,
  onSend,
  onRefreshConnections,
}: {
  candidate: Candidate;
  gmailConnections: GmailConnection[];
  loadingConnections: boolean;
  isSending: boolean;
  onClose: () => void;
  onSend: (candidateId: number, gmailConnectionId: number) => void;
  onRefreshConnections: () => void;
}) {
  const [selectedConnection, setSelectedConnection] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Handle Gmail OAuth connect
  const handleConnectGmail = async () => {
    try {
      setIsConnecting(true);
      const response = await gmailApi.getAuthUrl();
      // Open popup - OAuth callback is handled by parent component
      window.open(response.authUrl, '_blank', 'width=500,height=600');
    } catch (error) {
      console.error('Failed to initiate Gmail connection:', error);
      alert('Failed to initiate Gmail connection. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Auto-select first connection when connections change
  useEffect(() => {
    if (gmailConnections.length > 0 && !selectedConnection) {
      setSelectedConnection(gmailConnections[0].id);
    }
  }, [gmailConnections, selectedConnection]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Send Interest Email
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-2xl">
            &times;
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Candidate Info */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Sending to Candidate:</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {candidate.first_name} {candidate.last_name}
            </p>
            <p className="text-sm text-gray-500">{candidate.email}</p>
          </div>

          {/* Gmail Connection Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Send From Gmail Account:
            </label>
            {loadingConnections ? (
              <div className="flex items-center justify-center py-4">
                <svg className="animate-spin h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="ml-2 text-gray-600 dark:text-gray-400">Loading connections...</span>
              </div>
            ) : gmailConnections.length === 0 ? (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                  No Gmail account connected. Connect your HR email to send interest emails.
                </p>
                <button
                  onClick={handleConnectGmail}
                  disabled={isConnecting}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isConnecting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Connect Gmail Account
                    </>
                  )}
                </button>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 text-center">
                  Use: aksa.kurian@myphoneme.com
                </p>
                <button
                  onClick={onRefreshConnections}
                  className="w-full mt-2 text-sm text-blue-600 hover:underline"
                >
                  Refresh connections
                </button>
              </div>
            ) : (
              <select
                value={selectedConnection || ''}
                onChange={(e) => setSelectedConnection(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Gmail Account</option>
                {gmailConnections.map((conn) => (
                  <option key={conn.id} value={conn.id}>{conn.email}</option>
                ))}
              </select>
            )}
          </div>

          {/* Email Content Preview */}
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
            <p className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-1">Email Will Include:</p>
            <ul className="text-sm text-purple-700 dark:text-purple-300 list-disc list-inside space-y-1">
              <li>Interest in the role (Yes/No)</li>
              <li>Current CTC (in LPA)</li>
              <li>Expected CTC (in LPA)</li>
              <li>Notice Period</li>
              <li>Interview Availability</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedConnection && onSend(candidate.id, selectedConnection)}
            disabled={!selectedConnection || isSending}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSending ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send Email
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Send Head Review Modal
function SendHeadReviewModal({
  allCandidates,
  vacancyTitle,
  selectedCandidates,
  onToggleCandidate,
  isSending,
  onClose,
  onSend,
}: {

  allCandidates: Candidate[];

  vacancyTitle: string;
  selectedCandidates: Set<number>;
  onToggleCandidate: (id: number) => void;
  isSending: boolean;
  onClose: () => void;
  onSend: (reviewerEmails: ReviewerEmail[], gmailConnectionId?: number) => void;
}) {
  const [reviewerEmails, setReviewerEmails] = useState<ReviewerEmail[]>([{ email: '', name: '' }]);
  const [gmailConnections, setGmailConnections] = useState<GmailConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<number | null>(null);
  const [loadingConnections, setLoadingConnections] = useState(true);

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const connections = await api.get<GmailConnection[]>('/gmail/connections');
        const activeConnections = connections.filter(c => !!c.is_active);
        setGmailConnections(activeConnections);
        if (activeConnections.length > 0) {
          setSelectedConnection(activeConnections[0].id);
        }
      } catch (error) {
        console.error('Error fetching Gmail connections:', error);
      } finally {
        setLoadingConnections(false);
      }
    };
    fetchConnections();
  }, []);

  const addReviewer = () => {
    setReviewerEmails([...reviewerEmails, { email: '', name: '' }]);
  };

  const removeReviewer = (index: number) => {
    if (reviewerEmails.length > 1) {
      setReviewerEmails(reviewerEmails.filter((_, i) => i !== index));
    }
  };

  const updateReviewer = (index: number, field: 'email' | 'name', value: string) => {
    const updated = [...reviewerEmails];
    updated[index][field] = value;
    setReviewerEmails(updated);
  };

  const handleSend = () => {
    const validEmails = reviewerEmails.filter(r => r.email.trim() !== '');
    if (validEmails.length === 0) {
      alert('Please enter at least one reviewer email');
      return;
    }
    if (selectedCandidates.size === 0) {
      alert('Please select at least one candidate');
      return;
    }
    onSend(validEmails, selectedConnection || undefined);
  };

  const formatSalary = (salary: number | undefined) => {
    if (!salary) return '-';
    return `${(salary / 100000).toFixed(1)} LPA`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Send Candidates for Head Review
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Position: {vacancyTitle}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-2xl">
            &times;
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          {/* Candidate Selection */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Select Candidates ({selectedCandidates.size} selected)
            </h3>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Select</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Candidate</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Experience</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Current CTC</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Expected CTC</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Notice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {allCandidates.map((candidate) => (
                    <tr
                      key={candidate.id}
                      className={`${selectedCandidates.has(candidate.id) ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}
                    >
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedCandidates.has(candidate.id)}
                          onChange={() => onToggleCandidate(candidate.id)}
                          className="h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900 dark:text-white text-sm">
                          {candidate.first_name} {candidate.last_name}
                        </div>
                        <div className="text-xs text-gray-500">{candidate.email}</div>
                      </td>
                      <td className="px-4 py-2 text-center text-sm text-gray-700 dark:text-gray-300">
                        {candidate.experience_years ? `${candidate.experience_years} yrs` : '-'}
                      </td>
                      <td className="px-4 py-2 text-center text-sm text-gray-700 dark:text-gray-300">
                        {formatSalary(candidate.current_salary)}
                      </td>
                      <td className="px-4 py-2 text-center text-sm text-gray-700 dark:text-gray-300">
                        {formatSalary(candidate.expected_salary)}
                      </td>
                      <td className="px-4 py-2 text-center text-sm text-gray-700 dark:text-gray-300">
                        {candidate.notice_period || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reviewer Emails */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Head Person / Reviewer Emails
              </h3>
              <button
                type="button"
                onClick={addReviewer}
                className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Reviewer
              </button>
            </div>
            <div className="space-y-3">
              {reviewerEmails.map((reviewer, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <input
                      type="email"
                      value={reviewer.email}
                      onChange={(e) => updateReviewer(index, 'email', e.target.value)}
                      placeholder="Email address *"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={reviewer.name}
                      onChange={(e) => updateReviewer(index, 'name', e.target.value)}
                      placeholder="Name (optional)"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  {reviewerEmails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeReviewer(index)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Gmail Connection */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Send From Gmail Account (Optional)
            </h3>
            {loadingConnections ? (
              <div className="flex items-center gap-2 text-gray-500">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </div>
            ) : gmailConnections.length === 0 ? (
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                No Gmail connected. Email will not be sent automatically, but review links will be generated.
              </p>
            ) : (
              <select
                value={selectedConnection || ''}
                onChange={(e) => setSelectedConnection(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Don't send email (generate links only)</option>
                {gmailConnections.map((conn) => (
                  <option key={conn.id} value={conn.id}>{conn.email}</option>
                ))}
              </select>
            )}
          </div>

          {/* Info */}
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              <strong>What happens:</strong> Each reviewer will receive an email with a unique link to review the selected candidates.
              They can select/deselect candidates for interview and provide their availability time.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <span className="text-sm text-gray-500">
            {selectedCandidates.size} candidate(s) | {reviewerEmails.filter(r => r.email.trim()).length} reviewer(s)
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || selectedCandidates.size === 0 || !reviewerEmails.some(r => r.email.trim())}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSending ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send for Review
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Send Interview Invite Modal
function SendInterviewInviteModal({
  candidate,
  interview,
  vacancyTitle,
  gmailConnections,
  loadingConnections,
  isSending,
  onClose,
  onSend,
  onConnectGmail,
}: {
  candidate: Candidate;
  interview: Interview;
  vacancyTitle: string;
  gmailConnections: { id: number; email: string }[];
  loadingConnections: boolean;
  isSending: boolean;
  onClose: () => void;
  onSend: (gmailConnectionId: number, additionalInterviewers: { name: string; email: string }[], customMessage: string, isOnline: boolean, locationOrLink: string) => void;
  onConnectGmail: () => void;
}) {
  const [selectedConnection, setSelectedConnection] = useState<number | null>(
    gmailConnections.length > 0 ? gmailConnections[0].id : null
  );
  const [additionalInterviewers, setAdditionalInterviewers] = useState<{ name: string; email: string }[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const [isOnline, setIsOnline] = useState(Boolean(interview.meeting_link));
  const [location, setLocation] = useState(interview.location || '');
  const [meetingLink, setMeetingLink] = useState(interview.meeting_link || '');

  // Update selectedConnection when gmailConnections loads
  useEffect(() => {
    if (gmailConnections.length > 0 && !selectedConnection) {
      setSelectedConnection(gmailConnections[0].id);
    }
  }, [gmailConnections]);

  // Format interview type
  const interviewTypeLabels: Record<string, string> = {
    hr: 'HR Round',
    technical: 'Technical Round',
    managerial: 'Managerial Round',
    final: 'Final Round'
  };
  const roundName = interviewTypeLabels[interview.interview_type] || interview.interview_type;

  const addInterviewer = () => {
    setAdditionalInterviewers([...additionalInterviewers, { name: '', email: '' }]);
  };

  const updateInterviewer = (index: number, field: 'name' | 'email', value: string) => {
    const updated = [...additionalInterviewers];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalInterviewers(updated);
  };

  const removeInterviewer = (index: number) => {
    setAdditionalInterviewers(additionalInterviewers.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    if (!selectedConnection) {
      alert('Please select a Gmail account to send from');
      return;
    }

    // Filter out empty interviewers
    const interviewerList = additionalInterviewers.filter(i => i.name.trim() && i.email.trim());

    // Require at least one interviewer
    if (interviewerList.length === 0) {
      alert('Please add at least one interviewer with name and email');
      return;
    }

    // Validate all interviewers have both name and email
    const invalidInterviewers = additionalInterviewers.filter(i =>
      (i.name.trim() && !i.email.trim()) || (!i.name.trim() && i.email.trim())
    );
    if (invalidInterviewers.length > 0) {
      alert('Please provide both name and email for all interviewers');
      return;
    }

    onSend(selectedConnection, interviewerList, customMessage, isOnline, isOnline ? meetingLink : location);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Send Interview Invitation
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Send interview details to {candidate.first_name} {candidate.last_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Interview Details Summary */}
          <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-cyan-800 dark:text-cyan-200 mb-3">Interview Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Candidate:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {candidate.first_name} {candidate.last_name}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Email:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{candidate.email}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Position:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">{vacancyTitle || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Round:</span>
                <span className="ml-2 font-medium text-cyan-700 dark:text-cyan-300">{roundName} (Round {interview.round_number})</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Date:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">{interview.scheduled_date}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Time:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">{interview.scheduled_time || 'TBD'}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{interview.duration_minutes || 60} minutes</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Interviewer:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{interview.interviewer_name || 'TBD'}</span>
              </div>
            </div>
          </div>

          {/* Interview Mode */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Interview Mode</h3>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="interviewMode"
                  checked={!isOnline}
                  onChange={() => setIsOnline(false)}
                  className="text-cyan-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">In-Person</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="interviewMode"
                  checked={isOnline}
                  onChange={() => setIsOnline(true)}
                  className="text-cyan-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Online</span>
              </label>
            </div>

            {isOnline ? (
              <input
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="Enter meeting link (Zoom, Teams, Google Meet, etc.)"
                className="mt-3 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            ) : (
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter venue/address"
                className="mt-3 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            )}
          </div>

          {/* Interviewers */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Interviewer(s) <span className="text-red-500">*</span>
              </h3>
              <button
                type="button"
                onClick={addInterviewer}
                className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Interviewer
              </button>
            </div>
            {additionalInterviewers.length === 0 ? (
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                Please add at least one interviewer who will conduct the interview.
              </p>
            ) : (
              <div className="space-y-3">
                {additionalInterviewers.map((interviewer, index) => (
                  <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={interviewer.name}
                        onChange={(e) => updateInterviewer(index, 'name', e.target.value)}
                        placeholder="Name *"
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                      <input
                        type="email"
                        value={interviewer.email}
                        onChange={(e) => updateInterviewer(index, 'email', e.target.value)}
                        placeholder="Email *"
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeInterviewer(index)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Interviewers will be CC'd on the invitation email sent to the candidate.
            </p>
          </div>

          {/* Custom Message */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Additional Message (Optional)
            </h3>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add any additional instructions or information for the candidate..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>

          {/* Gmail Connection */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Send From Gmail Account
            </h3>
            {loadingConnections ? (
              <div className="flex items-center gap-2 text-gray-500">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading Gmail accounts...
              </div>
            ) : gmailConnections.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  No Gmail connected. Connect your Gmail to send emails.
                </p>
                <button
                  type="button"
                  onClick={onConnectGmail}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                  </svg>
                  Connect Gmail
                </button>
              </div>
            ) : (
              <select
                value={selectedConnection || ''}
                onChange={(e) => setSelectedConnection(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {gmailConnections.map((conn) => (
                  <option key={conn.id} value={conn.id}>{conn.email}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || !selectedConnection}
            className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isSending ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send Invitation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
