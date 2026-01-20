import type { Notification } from '../types';
import { API_BASE_URL } from '../config/api';

export const notificationsApi = {
  getAll: async (): Promise<Notification[]> => {
    const res = await fetch(`${API_BASE_URL}/notifications`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return res.json();
  },

  getUnreadCount: async (): Promise<number> => {
    const res = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to get unread count');
    const data = await res.json();
    return data.count;
  },

  markAsRead: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'PUT',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to mark as read');
  },

  markAllAsRead: async (): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'PUT',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to mark all as read');
  },

  delete: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete notification');
  },
};
