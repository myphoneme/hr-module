import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import type { User, UserResponse, CreateUserInput, UpdateUserInput } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get all users (any authenticated user can view users for assignment)
router.get('/', (req: Request, res: Response): void => {
  const users = db.prepare(`
    SELECT id, email, name, role, isActive, createdAt, updatedAt
    FROM users
    ORDER BY name ASC
  `).all() as UserResponse[];

  res.json(users);
});

// Get active users only (for dropdowns)
router.get('/active', (req: Request, res: Response): void => {
  const users = db.prepare(`
    SELECT id, email, name, role
    FROM users
    WHERE isActive = 1
    ORDER BY name ASC
  `).all();

  res.json(users);
});

// Get single user
router.get('/:id', (req: Request, res: Response): void => {
  const user = db.prepare(`
    SELECT id, email, name, role, isActive, createdAt, updatedAt
    FROM users
    WHERE id = ?
  `).get(req.params.id) as UserResponse | undefined;

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
});

// Create user (admin only)
router.post('/', requireAdmin, (req: Request, res: Response): void => {
  const { email, password, name, role }: CreateUserInput = req.body;

  if (!email || !password || !name || !role) {
    res.status(400).json({ error: 'Email, password, name, and role are required' });
    return;
  }

  // Validate email domain
  const allowedDomainsSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('allowed_domains') as { value: string } | undefined;
  if (allowedDomainsSetting) {
    const allowedDomains: string[] = JSON.parse(allowedDomainsSetting.value);
    const emailDomain = email.split('@')[1]?.toLowerCase();

    if (allowedDomains.length > 0 && !allowedDomains.includes(emailDomain)) {
      res.status(400).json({ error: `Email domain must be one of: ${allowedDomains.join(', ')}` });
      return;
    }
  }

  // Check if email exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    res.status(400).json({ error: 'Email already exists' });
    return;
  }

  const hashedPassword = bcrypt.hashSync(password, 12);

  const result = db.prepare(`
    INSERT INTO users (email, password, name, role)
    VALUES (?, ?, ?, ?)
  `).run(email.toLowerCase(), hashedPassword, name, role);

  const user = db.prepare(`
    SELECT id, email, name, role, isActive, createdAt, updatedAt
    FROM users
    WHERE id = ?
  `).get(result.lastInsertRowid) as UserResponse;

  res.status(201).json(user);
});

// Update user (admin only)
router.put('/:id', requireAdmin, (req: Request, res: Response): void => {
  const { email, password, name, role, isActive }: UpdateUserInput = req.body;
  const userId = parseInt(req.params.id);

  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
  if (!existing) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Prevent deactivating yourself
  if (isActive === false && userId === req.user!.userId) {
    res.status(400).json({ error: 'Cannot deactivate your own account' });
    return;
  }

  // Prevent removing your own admin role
  if (role === 'user' && userId === req.user!.userId) {
    res.status(400).json({ error: 'Cannot remove your own admin role' });
    return;
  }

  // Validate email domain if email is being changed
  if (email && email !== existing.email) {
    const allowedDomainsSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('allowed_domains') as { value: string } | undefined;
    if (allowedDomainsSetting) {
      const allowedDomains: string[] = JSON.parse(allowedDomainsSetting.value);
      const emailDomain = email.split('@')[1]?.toLowerCase();

      if (allowedDomains.length > 0 && !allowedDomains.includes(emailDomain)) {
        res.status(400).json({ error: `Email domain must be one of: ${allowedDomains.join(', ')}` });
        return;
      }
    }

    // Check if new email exists
    const emailExists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase(), userId);
    if (emailExists) {
      res.status(400).json({ error: 'Email already exists' });
      return;
    }
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (email !== undefined) {
    updates.push('email = ?');
    values.push(email.toLowerCase());
  }
  if (password !== undefined) {
    updates.push('password = ?');
    values.push(bcrypt.hashSync(password, 12));
  }
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (role !== undefined) {
    updates.push('role = ?');
    values.push(role);
  }
  if (isActive !== undefined) {
    updates.push('isActive = ?');
    values.push(isActive ? 1 : 0);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  updates.push("updatedAt = datetime('now')");
  values.push(userId);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const user = db.prepare(`
    SELECT id, email, name, role, isActive, createdAt, updatedAt
    FROM users
    WHERE id = ?
  `).get(userId) as UserResponse;

  res.json(user);
});

// Delete user (admin only)
router.delete('/:id', requireAdmin, (req: Request, res: Response): void => {
  const userId = parseInt(req.params.id);

  // Prevent deleting yourself
  if (userId === req.user!.userId) {
    res.status(400).json({ error: 'Cannot delete your own account' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!existing) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Check if user has any todos
  const hasTodos = db.prepare('SELECT id FROM todos WHERE assignerId = ? OR assigneeId = ?').get(userId, userId);
  if (hasTodos) {
    res.status(400).json({ error: 'Cannot delete user with assigned tasks. Deactivate instead.' });
    return;
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  res.status(204).send();
});

export default router;
