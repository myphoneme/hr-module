import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import type { TransactionNature, CreateTransactionNatureInput, UpdateTransactionNatureInput } from '../types';

const router = Router();

// Get all transaction natures
router.get('/', authenticateToken, (_req: Request, res: Response): void => {
  try {
    const transactionNatures = db.prepare(`
      SELECT * FROM transaction_nature
      ORDER BY name ASC
    `).all() as TransactionNature[];

    res.json(transactionNatures.map(tn => ({
      ...tn,
      isActive: Boolean(tn.isActive)
    })));
  } catch (error) {
    console.error('Error fetching transaction natures:', error);
    res.status(500).json({ error: 'Failed to fetch transaction natures' });
  }
});

// Get single transaction nature
router.get('/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const transactionNature = db.prepare(`
      SELECT * FROM transaction_nature WHERE id = ?
    `).get(id) as TransactionNature | undefined;

    if (!transactionNature) {
      res.status(404).json({ error: 'Transaction nature not found' });
      return;
    }

    res.json({
      ...transactionNature,
      isActive: Boolean(transactionNature.isActive)
    });
  } catch (error) {
    console.error('Error fetching transaction nature:', error);
    res.status(500).json({ error: 'Failed to fetch transaction nature' });
  }
});

// Create transaction nature (admin only)
router.post('/', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const input: CreateTransactionNatureInput = req.body;

    if (!input.name || !input.name.trim()) {
      res.status(400).json({ error: 'Transaction nature name is required' });
      return;
    }

    // Check if name already exists
    const existing = db.prepare('SELECT id FROM transaction_nature WHERE name = ?').get(input.name.trim());
    if (existing) {
      res.status(400).json({ error: 'Transaction nature with this name already exists' });
      return;
    }

    const result = db.prepare(`
      INSERT INTO transaction_nature (name)
      VALUES (?)
    `).run(input.name.trim());

    const newTransactionNature = db.prepare(`
      SELECT * FROM transaction_nature WHERE id = ?
    `).get(result.lastInsertRowid) as TransactionNature;

    res.status(201).json({
      ...newTransactionNature,
      isActive: Boolean(newTransactionNature.isActive)
    });
  } catch (error) {
    console.error('Error creating transaction nature:', error);
    res.status(500).json({ error: 'Failed to create transaction nature' });
  }
});

// Update transaction nature (admin only)
router.put('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const updates: UpdateTransactionNatureInput = req.body;

    const transactionNature = db.prepare('SELECT * FROM transaction_nature WHERE id = ?').get(id);
    if (!transactionNature) {
      res.status(404).json({ error: 'Transaction nature not found' });
      return;
    }

    const fields: string[] = [];
    const values: (string | number)[] = [];

    if (updates.name !== undefined) {
      if (!updates.name.trim()) {
        res.status(400).json({ error: 'Transaction nature name cannot be empty' });
        return;
      }
      // Check if name already exists (excluding current record)
      const existing = db.prepare('SELECT id FROM transaction_nature WHERE name = ? AND id != ?')
        .get(updates.name.trim(), id);
      if (existing) {
        res.status(400).json({ error: 'Transaction nature with this name already exists' });
        return;
      }
      fields.push('name = ?');
      values.push(updates.name.trim());
    }

    if (updates.isActive !== undefined) {
      fields.push('isActive = ?');
      values.push(updates.isActive ? 1 : 0);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    fields.push("updatedAt = datetime('now')");
    values.push(Number(id));

    db.prepare(`UPDATE transaction_nature SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updatedTransactionNature = db.prepare(`
      SELECT * FROM transaction_nature WHERE id = ?
    `).get(id) as TransactionNature;

    res.json({
      ...updatedTransactionNature,
      isActive: Boolean(updatedTransactionNature.isActive)
    });
  } catch (error) {
    console.error('Error updating transaction nature:', error);
    res.status(500).json({ error: 'Failed to update transaction nature' });
  }
});

// Delete transaction nature (admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const transactionNature = db.prepare('SELECT * FROM transaction_nature WHERE id = ?').get(id);
    if (!transactionNature) {
      res.status(404).json({ error: 'Transaction nature not found' });
      return;
    }

    db.prepare('DELETE FROM transaction_nature WHERE id = ?').run(id);

    res.json({ message: 'Transaction nature deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction nature:', error);
    res.status(500).json({ error: 'Failed to delete transaction nature' });
  }
});

export default router;
