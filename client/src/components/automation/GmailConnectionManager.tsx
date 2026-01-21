import { useState, useEffect } from 'react';
import {
  useGmailStatus,
  useGmailConnections,
  useGmailSyncHistory,
  useEmailApplications,
  useGmailMutations
} from '../../hooks/useAutomation';
import { gmailApi } from '../../api/automation';
import type { GmailConnection, GmailSyncHistory, EmailApplication } from '../../api/automation';

export function GmailConnectionManager() {
  const [showApplications, setShowApplications] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);

  const { data: status, isLoading: statusLoading } = useGmailStatus();
  const { data: connections, isLoading: connectionsLoading } = useGmailConnections();
  const { data: syncHistory } = useGmailSyncHistory(selectedConnectionId || undefined);
  const { data: applications } = useEmailApplications(showApplications ? { limit: 20 } : undefined);

  const { connectGmail, disconnectGmail, triggerSync } = useGmailMutations();

  const handleConnect = async () => {
    try {
      const response = await gmailApi.getAuthUrl();
      window.open(response.authUrl, '_blank', 'width=600,height=700');
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      alert('Failed to initiate Gmail connection');
    }
  };

  const handleDisconnect = (id: number) => {
    if (confirm('Are you sure you want to disconnect this Gmail account?')) {
      disconnectGmail.mutate(id);
    }
  };

  const handleSync = (connectionId: number, syncType: 'full' | 'incremental') => {
    triggerSync.mutate({ connectionId, syncType });
  };

  // Handle OAuth callback from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      if (event.data?.type === 'gmail-oauth-success') {
        // The backend has handled the token exchange, just refetch the data
        window.location.reload();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (statusLoading || connectionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Gmail Integration
          </h3>
          {status?.configured && (
            <button
              onClick={handleConnect}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
              </svg>
              Connect Gmail
            </button>
          )}
        </div>

        {!status?.configured && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-700 dark:text-yellow-300">
            <p className="font-medium">Gmail OAuth not configured</p>
            <p className="text-sm mt-1">{status?.message}</p>
          </div>
        )}

        {/* Connected Accounts */}
        {connections && connections.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-700 dark:text-gray-300">Connected Accounts</h4>
            {connections.map((connection: GmailConnection) => (
              <div
                key={connection.id}
                className={`p-4 border rounded-lg ${
                  selectedConnectionId === connection.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="cursor-pointer"
                    onClick={() => setSelectedConnectionId(
                      selectedConnectionId === connection.id ? null : connection.id
                    )}
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      {connection.email}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Connected by {connection.user_name}
                      {connection.last_sync_at && (
                        <> · Last sync: {new Date(connection.last_sync_at).toLocaleString()}</>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSync(connection.id, 'incremental')}
                      disabled={triggerSync.isPending}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {triggerSync.isPending ? 'Syncing...' : 'Sync'}
                    </button>
                    <button
                      onClick={() => handleSync(connection.id, 'full')}
                      disabled={triggerSync.isPending}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Full Sync
                    </button>
                    <button
                      onClick={() => handleDisconnect(connection.id)}
                      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {connections && connections.length === 0 && status?.configured && (
          <p className="text-gray-500 dark:text-gray-400">
            No Gmail accounts connected. Click "Connect Gmail" to get started.
          </p>
        )}
      </div>

      {/* Sync History */}
      {selectedConnectionId && syncHistory && syncHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Sync History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                  <th className="pb-2">Started</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Emails</th>
                  <th className="pb-2">Resumes</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {syncHistory.map((sync: GmailSyncHistory) => (
                  <tr key={sync.id} className="border-b dark:border-gray-700">
                    <td className="py-2 text-gray-900 dark:text-white">
                      {new Date(sync.started_at).toLocaleString()}
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        sync.sync_type === 'full'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {sync.sync_type}
                      </span>
                    </td>
                    <td className="py-2 text-gray-900 dark:text-white">{sync.emails_fetched}</td>
                    <td className="py-2 text-gray-900 dark:text-white">{sync.resumes_extracted}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        sync.status === 'completed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : sync.status === 'failed'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}>
                        {sync.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Applications Toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Email Applications
          </h3>
          <button
            onClick={() => setShowApplications(!showApplications)}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            {showApplications ? 'Hide' : 'Show'} Applications
          </button>
        </div>

        {showApplications && applications && (
          <div className="space-y-3">
            {applications.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No applications yet. Sync your Gmail to fetch applications.</p>
            ) : (
              applications.map((app: EmailApplication) => (
                <div
                  key={app.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {app.sender_name || app.sender_email}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {app.subject}
                      </div>
                      {app.resume_filename && (
                        <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                          📎 {app.resume_filename}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        app.status === 'processed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : app.status === 'new'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {app.status}
                      </span>
                      {app.ai_match_score !== null && (
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          app.ai_match_score >= 70
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : app.ai_match_score >= 40
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          Score: {app.ai_match_score}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default GmailConnectionManager;
