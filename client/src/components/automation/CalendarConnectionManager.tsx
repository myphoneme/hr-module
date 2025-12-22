import { useState, useEffect } from 'react';
import {
  useCalendarConnections,
  useInterviewerAvailability,
  useCalendarMutations
} from '../../hooks/useAutomation';
import { calendarApi } from '../../api/automation';
import type { CalendarConnection, InterviewerAvailability } from '../../api/automation';

export function CalendarConnectionManager() {
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
  const [syncDaysAhead, setSyncDaysAhead] = useState(14);

  const { data: connections, isLoading } = useCalendarConnections();
  const { data: availability } = useInterviewerAvailability({
    available_only: true,
    date_from: new Date().toISOString().split('T')[0],
    date_to: new Date(Date.now() + syncDaysAhead * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  const { connectCalendar, disconnectCalendar, syncAvailability } = useCalendarMutations();

  const handleConnect = async () => {
    try {
      const response = await calendarApi.getAuthUrl();
      window.open(response.authUrl, '_blank', 'width=600,height=700');
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      alert('Failed to initiate Calendar connection');
    }
  };

  const handleDisconnect = (id: number) => {
    if (confirm('Are you sure you want to disconnect this Calendar account?')) {
      disconnectCalendar.mutate(id);
    }
  };

  const handleSync = (connectionId: number) => {
    syncAvailability.mutate({ connectionId, daysAhead: syncDaysAhead });
  };

  // Handle OAuth callback from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'calendar-oauth-callback' && event.data?.code) {
        connectCalendar.mutate(event.data.code);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [connectCalendar]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Management */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Google Calendar Integration
          </h3>
          <button
            onClick={handleConnect}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
            </svg>
            Connect Calendar
          </button>
        </div>

        {/* Connected Accounts */}
        {connections && connections.length > 0 ? (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-700 dark:text-gray-300">Connected Accounts</h4>
            {connections.map((connection: CalendarConnection) => (
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
                      {connection.calendar_id && (
                        <> · Calendar: {connection.calendar_id}</>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={syncDaysAhead}
                      onChange={(e) => setSyncDaysAhead(Number(e.target.value))}
                      className="px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-700 dark:border-gray-600"
                    >
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                    </select>
                    <button
                      onClick={() => handleSync(connection.id)}
                      disabled={syncAvailability.isPending}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {syncAvailability.isPending ? 'Syncing...' : 'Sync'}
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
        ) : (
          <p className="text-gray-500 dark:text-gray-400">
            No Calendar accounts connected. Click "Connect Calendar" to get started.
          </p>
        )}
      </div>

      {/* Availability Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Available Interview Slots
        </h3>

        {availability && availability.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Interviewer</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {availability.slice(0, 20).map((slot: InterviewerAvailability) => (
                  <tr key={slot.id} className="border-b dark:border-gray-700">
                    <td className="py-2 text-gray-900 dark:text-white">
                      {new Date(slot.slot_date).toLocaleDateString()}
                    </td>
                    <td className="py-2 text-gray-900 dark:text-white">
                      {slot.start_time} - {slot.end_time}
                    </td>
                    <td className="py-2 text-gray-900 dark:text-white">
                      {slot.interviewer_name}
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        slot.is_blocked
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      }`}>
                        {slot.is_blocked ? 'Blocked' : 'Available'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {availability.length > 20 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Showing 20 of {availability.length} slots
              </p>
            )}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">
            No available slots found. Connect a calendar and sync to see availability.
          </p>
        )}
      </div>
    </div>
  );
}

export default CalendarConnectionManager;
