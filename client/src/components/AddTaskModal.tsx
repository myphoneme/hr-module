import { useState, useEffect, useRef } from 'react';
import { useCreateTodo } from '../hooks/useTodos';
import { useActiveUsers } from '../hooks/useUsers';
import { useAuth } from '../contexts/AuthContext';
import { formatEstimatedTime, getEstimatedTime } from '../utils/time';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddTaskModal({ isOpen, onClose }: AddTaskModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState('');

  const titleInputRef = useRef<HTMLInputElement>(null);
  const createTodo = useCreateTodo();
  const { data: users, isLoading: usersLoading } = useActiveUsers();

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setAssigneeId('');
      setPriority('medium');
      setDueDate('');
      // Focus title input when modal opens
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !description || !assigneeId) {
      return;
    }

    createTodo.mutate(
      {
        title,
        description,
        assigneeId: Number(assigneeId),
        priority,
        dueDate: dueDate || undefined,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const selectedUser = users?.find((u) => u.id === assigneeId);
  const estimatedTime = formatEstimatedTime(getEstimatedTime(priority));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <TaskIcon className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Create Task</h2>
                <p className="text-xs text-gray-500">Add a new task to your workflow</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-5">
              {/* Title Input - Smart */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What needs to be done?
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-lg"
                  placeholder="e.g., Review quarterly report"
                  required
                />
              </div>

              {/* Description with Auto-expand */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add more details
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all resize-none"
                  placeholder="Describe the task, add context, or include any relevant information..."
                  rows={3}
                  required
                />
              </div>

              {/* Assignee Selection - Visual */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign to
                </label>
                {usersLoading ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <LoadingSpinner className="w-4 h-4" />
                    Loading team members...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {users?.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setAssigneeId(u.id)}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          assigneeId === u.id
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            assigneeId === u.id
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {getInitials(u.name)}
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${assigneeId === u.id ? 'text-orange-700' : 'text-gray-900'}`}>
                            {u.name}
                            {u.id === user?.id && <span className="text-xs text-gray-400 ml-1">(you)</span>}
                          </p>
                        </div>
                        {assigneeId === u.id && (
                          <CheckCircleIcon className="w-5 h-5 text-orange-500 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority Selection - Visual */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority & Timeline
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setPriority('low')}
                    className={`p-3 rounded-xl border-2 transition-all text-center ${
                      priority === 'low'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${priority === 'low' ? 'bg-blue-500' : 'bg-blue-300'}`} />
                    <p className={`font-medium ${priority === 'low' ? 'text-blue-700' : 'text-gray-700'}`}>Low</p>
                    <p className="text-xs text-gray-500 mt-0.5">~2 hours</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPriority('medium')}
                    className={`p-3 rounded-xl border-2 transition-all text-center ${
                      priority === 'medium'
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-gray-200 hover:border-yellow-300'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${priority === 'medium' ? 'bg-yellow-500' : 'bg-yellow-300'}`} />
                    <p className={`font-medium ${priority === 'medium' ? 'text-yellow-700' : 'text-gray-700'}`}>Medium</p>
                    <p className="text-xs text-gray-500 mt-0.5">~1 hour</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPriority('high')}
                    className={`p-3 rounded-xl border-2 transition-all text-center ${
                      priority === 'high'
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-red-300'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${priority === 'high' ? 'bg-red-500' : 'bg-red-300'}`} />
                    <p className={`font-medium ${priority === 'high' ? 'text-red-700' : 'text-gray-700'}`}>High</p>
                    <p className="text-xs text-gray-500 mt-0.5">~30 mins</p>
                  </button>
                </div>
              </div>

              {/* Due Date/Deadline */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="datetime-local"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                    />
                  </div>
                  {dueDate && (
                    <button
                      type="button"
                      onClick={() => setDueDate('')}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Clear deadline"
                    >
                      <CloseIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Set a deadline to track task progress more accurately
                </p>
              </div>

              {/* Preview Card */}
              {title && assigneeId && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Preview</p>
                  <div className="flex items-start gap-3">
                    <div className={`w-1 h-12 rounded-full ${
                      priority === 'high' ? 'bg-red-500' : priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{title}</h4>
                      <p className="text-sm text-gray-500 line-clamp-1">{description || 'No description'}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-[8px] text-white font-medium">
                          {selectedUser ? getInitials(selectedUser.name) : '?'}
                        </div>
                        <span>{selectedUser?.name || 'Select assignee'}</span>
                        <span>•</span>
                        {dueDate ? (
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            Due: {new Date(dueDate).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </span>
                        ) : (
                          <span>Est. {estimatedTime}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createTodo.isPending || !title || !description || !assigneeId}
                className="px-6 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {createTodo.isPending ? (
                  <>
                    <LoadingSpinner className="w-4 h-4" />
                    Creating...
                  </>
                ) : (
                  <>
                    <PlusIcon className="w-4 h-4" />
                    Add Task
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Icon Components
function TaskIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function CloseIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckCircleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}

function PlusIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function LoadingSpinner({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function CalendarIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
