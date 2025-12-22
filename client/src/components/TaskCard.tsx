import { useState } from 'react';
import type { Todo } from '../types';
import { useUpdateTodo, useDeleteTodo } from '../hooks/useTodos';
import { useActiveUsers } from '../hooks/useUsers';
import { useAuth } from '../contexts/AuthContext';
import { Comments } from './Comments';
import {
  timeAgo,
  getEstimatedTime,
  calculateProgress,
  isDelayed,
  getDelayTime,
  getRemainingTime,
  isDelayedByDeadline,
  getDelayFromDeadline,
  getRemainingToDeadline,
  calculateProgressToDeadline,
  formatDeadline,
} from '../utils/time';

interface TaskCardProps {
  todo: Todo;
}

export function TaskCard({ todo }: TaskCardProps) {
  const { user, isAdmin } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description);
  const [assigneeId, setAssigneeId] = useState(todo.assigneeId);
  const [priority, setPriority] = useState(todo.priority);

  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const { data: users } = useActiveUsers();

  const isOwner = user?.id === todo.assignerId;
  const isAssignee = user?.id === todo.assigneeId;
  const canEdit = isAdmin || isOwner || isAssignee;
  const canDelete = isAdmin || isOwner;

  // Use deadline-based calculations if dueDate is set, otherwise fall back to estimated time
  const estimatedTime = getEstimatedTime(todo.priority);
  const hasDeadline = !!todo.dueDate;

  const progress = hasDeadline
    ? calculateProgressToDeadline(todo.createdAt, todo.dueDate!)
    : calculateProgress(todo.createdAt, estimatedTime);

  const delayed = hasDeadline
    ? isDelayedByDeadline(todo.dueDate, todo.completed)
    : isDelayed(todo.createdAt, estimatedTime, todo.completed);

  const handleToggleComplete = () => {
    if (!canEdit) return;
    updateTodo.mutate({
      id: todo.id,
      data: { completed: !todo.completed },
    });
  };

  const handleToggleFavorite = () => {
    updateTodo.mutate({
      id: todo.id,
      data: { isFavorite: !todo.isFavorite },
    });
  };

  const handleSave = () => {
    updateTodo.mutate(
      {
        id: todo.id,
        data: { title, description, assigneeId, priority },
      },
      {
        onSuccess: () => setIsEditing(false),
      }
    );
  };

  const handleCancel = () => {
    setTitle(todo.title);
    setDescription(todo.description);
    setAssigneeId(todo.assigneeId);
    setPriority(todo.priority);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this task?')) {
      deleteTodo.mutate(todo.id);
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

  const priorityColors = {
    high: 'bg-red-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500',
  };

  // Edit Mode
  if (isEditing) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        <div className="space-y-4">
          {isAdmin && !isOwner && (
            <div className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded inline-block">
              Editing as Admin
            </div>
          )}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium"
            placeholder="Task title"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            rows={2}
            placeholder="Task description"
          />
          <div className="grid grid-cols-2 gap-4">
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  // View Mode - New Design
  return (
    <div
      className={`bg-white rounded-lg border transition-all ${
        todo.completed ? 'border-gray-200 bg-gray-50/50' : 'border-gray-200 hover:shadow-md'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex">
        {/* Priority Bar */}
        <div className={`w-1 rounded-l-lg ${priorityColors[todo.priority]}`} />

        {/* Main Content */}
        <div className="flex-1 p-4">
          <div className="flex items-start gap-3">
            {/* Checkbox */}
            <button
              onClick={handleToggleComplete}
              disabled={!canEdit}
              className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                todo.completed
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-gray-300 hover:border-orange-400'
              } ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {todo.completed && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
              {/* Title Row */}
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  className={`font-semibold ${
                    todo.completed ? 'line-through text-gray-400' : 'text-gray-900'
                  }`}
                >
                  {todo.title}
                </h3>

                {/* Status Badge */}
                {todo.completed ? (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                    COMPLETED
                  </span>
                ) : delayed ? (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                    DELAYED
                  </span>
                ) : todo.isFavorite ? (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                    STARRED
                  </span>
                ) : null}
              </div>

              {/* Description */}
              <p className={`text-sm mt-0.5 ${todo.completed ? 'text-gray-400' : 'text-gray-500'}`}>
                {todo.description}
              </p>

              {/* Meta Row - Icons and Info */}
              <div className="flex items-center gap-4 mt-3 text-xs">
                {/* Created By - shows last action time (updatedAt) */}
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600"
                    title={todo.assignerName}
                  >
                    {getInitials(todo.assignerName)}
                  </div>
                  <span className="text-gray-500">
                    {timeAgo(todo.updatedAt || todo.createdAt)}
                  </span>
                </div>

                {/* Arrow */}
                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>

                {/* Assigned To */}
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-medium text-white"
                    title={todo.assigneeName}
                  >
                    {getInitials(todo.assigneeName)}
                  </div>
                  <span className="text-gray-600 font-medium">
                    {todo.assigneeName.split(' ')[0]}
                  </span>
                </div>

                {/* Divider */}
                <div className="w-px h-4 bg-gray-200" />

                {/* Progress/Time - based on deadline or estimated time */}
                {!todo.completed && (
                  <div className="flex items-center gap-2">
                    {delayed ? (
                      <span className="text-red-600 font-medium flex items-center gap-1">
                        <ClockIcon className="w-3.5 h-3.5" />
                        Delayed by {hasDeadline ? getDelayFromDeadline(todo.dueDate!) : getDelayTime(todo.createdAt, estimatedTime)}
                      </span>
                    ) : hasDeadline ? (
                      <>
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              progress > 80 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-gray-500">
                          {getRemainingToDeadline(todo.dueDate!)}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              progress > 80 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-gray-500">
                          {getRemainingTime(todo.createdAt, estimatedTime)}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {todo.completed && (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    Done
                  </span>
                )}

                {/* Show deadline if set */}
                {hasDeadline && !todo.completed && (
                  <>
                    <div className="w-px h-4 bg-gray-200" />
                    <span className="text-gray-400 flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      Due: {formatDeadline(todo.dueDate!)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Right Side - Actions */}
            <div className="flex items-center gap-1 ml-2">
              {/* Progress Number */}
              {!todo.completed && (
                <span
                  className={`px-2 py-1 text-xs font-bold rounded ${
                    delayed ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {progress}%
                </span>
              )}

              {/* Action Buttons - Show on Hover */}
              <div
                className={`flex items-center gap-1 transition-opacity ${
                  isHovered ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {/* Favorite */}
                <button
                  onClick={handleToggleFavorite}
                  className={`p-1.5 rounded-lg transition-colors ${
                    todo.isFavorite
                      ? 'text-orange-500 bg-orange-50'
                      : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'
                  }`}
                  title="Toggle favorite"
                >
                  <StarIcon filled={todo.isFavorite} className="w-4 h-4" />
                </button>

                {canEdit && (
                  <>
                    {/* Complete */}
                    <button
                      onClick={handleToggleComplete}
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title={todo.completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      <CheckIcon className="w-4 h-4" />
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit task"
                    >
                      <EditIcon className="w-4 h-4" />
                    </button>
                  </>
                )}

                {canDelete && (
                  <button
                    onClick={handleDelete}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete task"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Comments Toggle */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={() => setShowComments(!showComments)}
              className="text-xs text-gray-500 hover:text-orange-500 flex items-center gap-1"
            >
              <CommentIcon className="w-3.5 h-3.5" />
              {showComments ? 'Hide comments' : 'Comments'}
            </button>

            {showComments && (
              <div className="mt-3">
                <Comments todoId={todo.id} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Icon Components
function ClockIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckCircleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function StarIcon({ className = 'w-4 h-4', filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function CheckIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function EditIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TrashIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function CommentIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function CalendarIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
