import { useState } from 'react';
import {
  useEmailDrafts,
  useEmailDraftMutations,
  useGmailConnections
} from '../../hooks/useAutomation';
import type { EmailDraft, EmailType } from '../../api/automation';

export function EmailDraftsList() {
  const [selectedDraft, setSelectedDraft] = useState<EmailDraft | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('draft');
  const [filterType, setFilterType] = useState<EmailType | ''>('');

  const { data: drafts, isLoading } = useEmailDrafts({
    status: filterStatus || undefined,
    email_type: filterType || undefined,
    limit: 50
  });
  const { data: gmailConnections } = useGmailConnections();
  const { approveDraft, rejectDraft, updateDraft } = useEmailDraftMutations();

  const handleSelectDraft = (draft: EmailDraft) => {
    setSelectedDraft(draft);
    setEditedSubject(draft.subject);
    setEditedBody(draft.body_html);
  };

  const handleUpdate = () => {
    if (!selectedDraft) return;
    updateDraft.mutate(
      { id: selectedDraft.id, data: { subject: editedSubject, body_html: editedBody } },
      {
        onSuccess: () => {
          setSelectedDraft({
            ...selectedDraft,
            subject: editedSubject,
            body_html: editedBody
          });
        }
      }
    );
  };

  const handleApprove = (draftId: number) => {
    const gmailConnectionId = gmailConnections?.[0]?.id;
    if (!gmailConnectionId) {
      alert('Please connect a Gmail account first to send emails');
      return;
    }
    if (confirm('Are you sure you want to approve and send this email?')) {
      approveDraft.mutate(
        { id: draftId, gmailConnectionId },
        {
          onSuccess: () => {
            setSelectedDraft(null);
          }
        }
      );
    }
  };

  const handleReject = (draftId: number) => {
    const reason = prompt('Please provide a reason for rejection (optional):');
    rejectDraft.mutate(
      { id: draftId, reason: reason || undefined },
      {
        onSuccess: () => {
          setSelectedDraft(null);
        }
      }
    );
  };

  const getTypeLabel = (type: EmailType): string => {
    const labels: Record<EmailType, string> = {
      interview_invite: 'Interview Invite',
      rejection: 'Rejection',
      offer: 'Offer Letter',
      follow_up: 'Follow Up',
      custom: 'Custom'
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: EmailType): string => {
    const colors: Record<EmailType, string> = {
      interview_invite: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      rejection: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      offer: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      follow_up: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      custom: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    };
    return colors[type] || colors.custom;
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      sent: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    };
    return colors[status] || colors.draft;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-300px)] min-h-[500px]">
      {/* Drafts List */}
      <div className="w-1/3 flex flex-col">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border rounded bg-white dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">All Status</option>
              <option value="draft">Pending</option>
              <option value="approved">Approved</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as EmailType | '')}
              className="flex-1 px-3 py-2 text-sm border rounded bg-white dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">All Types</option>
              <option value="interview_invite">Interview</option>
              <option value="rejection">Rejection</option>
              <option value="offer">Offer</option>
              <option value="follow_up">Follow Up</option>
            </select>
          </div>
        </div>

        {/* Draft List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow flex-1 overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Email Drafts ({drafts?.length || 0})
            </h3>
          </div>
          <div className="overflow-y-auto h-full">
            {drafts && drafts.length > 0 ? (
              <div className="divide-y dark:divide-gray-700">
                {drafts.map((draft: EmailDraft) => (
                  <div
                    key={draft.id}
                    onClick={() => handleSelectDraft(draft)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      selectedDraft?.id === draft.id
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs ${getTypeColor(draft.email_type)}`}>
                        {getTypeLabel(draft.email_type)}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(draft.status)}`}>
                        {draft.status}
                      </span>
                    </div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {draft.candidate_name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {draft.subject}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {new Date(draft.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No drafts found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Draft Preview/Edit */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow flex flex-col overflow-hidden">
        {selectedDraft ? (
          <>
            {/* Header */}
            <div className="p-4 border-b dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${getTypeColor(selectedDraft.email_type)}`}>
                    {getTypeLabel(selectedDraft.email_type)}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(selectedDraft.status)}`}>
                    {selectedDraft.status}
                  </span>
                </div>
                {selectedDraft.status === 'draft' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(selectedDraft.id)}
                      disabled={approveDraft.isPending}
                      className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {approveDraft.isPending ? 'Sending...' : 'Approve & Send'}
                    </button>
                    <button
                      onClick={() => handleReject(selectedDraft.id)}
                      disabled={rejectDraft.isPending}
                      className="px-4 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex">
                  <span className="text-gray-500 dark:text-gray-400 w-16">To:</span>
                  <span className="text-gray-900 dark:text-white">
                    {selectedDraft.recipient_name || selectedDraft.recipient_email}
                    {selectedDraft.recipient_name && (
                      <span className="text-gray-500 dark:text-gray-400 ml-1">
                        &lt;{selectedDraft.recipient_email}&gt;
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex">
                  <span className="text-gray-500 dark:text-gray-400 w-16">From:</span>
                  <span className="text-gray-900 dark:text-white">{selectedDraft.creator_name}</span>
                </div>
              </div>
            </div>

            {/* Subject */}
            <div className="p-4 border-b dark:border-gray-700">
              {selectedDraft.status === 'draft' ? (
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 font-medium"
                  placeholder="Subject"
                />
              ) : (
                <div className="font-medium text-gray-900 dark:text-white">
                  {selectedDraft.subject}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {selectedDraft.status === 'draft' ? (
                <textarea
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  className="w-full h-full min-h-[200px] px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 resize-none"
                  placeholder="Email body..."
                />
              ) : (
                <div
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedDraft.body_html }}
                />
              )}
            </div>

            {/* Footer Actions */}
            {selectedDraft.status === 'draft' && (
              <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditedSubject(selectedDraft.subject);
                    setEditedBody(selectedDraft.body_html);
                  }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Reset Changes
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={updateDraft.isPending || (editedSubject === selectedDraft.subject && editedBody === selectedDraft.body_html)}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateDraft.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <p className="mt-4">Select an email draft to preview</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmailDraftsList;
