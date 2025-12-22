import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import type { CategoryGroup, CategoryGroupWithTransactionNature, CreateCategoryGroupInput, UpdateCategoryGroupInput } from '../types';

const router = Router();

// Get all category groups with transaction nature names
router.get('/', authenticateToken, (_req: Request, res: Response): void => {
  try {
    const categoryGroups = db.prepare(`
      SELECT
        cg.*,
        tn.name as transaction_nature_name
      FROM category_group cg
      JOIN transaction_nature tn ON cg.transaction_nature_id = tn.id
      ORDER BY tn.name ASC, cg.name ASC
    `).all() as CategoryGroupWithTransactionNature[];

    res.json(categoryGroups.map(cg => ({
      ...cg,
      isActive: Boolean(cg.isActive)
    })));
  } catch (error) {
    console.error('Error fetching category groups:', error);
    res.status(500).json({ error: 'Failed to fetch category groups' });
  }
});

// Get single category group
router.get('/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const categoryGroup = db.prepare(`
      SELECT
        cg.*,
        tn.name as transaction_nature_name
      FROM category_group cg
      JOIN transaction_nature tn ON cg.transaction_nature_id = tn.id
      WHERE cg.id = ?
    `).get(id) as CategoryGroupWithTransactionNature | undefined;

    if (!categoryGroup) {
      res.status(404).json({ error: 'Category group not found' });
      return;
    }

    res.json({
      ...categoryGroup,
      isActive: Boolean(categoryGroup.isActive)
    });
  } catch (error) {
    console.error('Error fetching category group:', error);
    res.status(500).json({ error: 'Failed to fetch category group' });
  }
});

// Create category group (admin only)
router.post('/', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const input: CreateCategoryGroupInput = req.body;

    if (!input.name || !input.name.trim()) {
      res.status(400).json({ error: 'Category group name is required' });
      return;
    }

    if (!input.transaction_nature_id) {
      res.status(400).json({ error: 'Transaction nature is required' });
      return;
    }

    // Verify transaction nature exists
    const transactionNature = db.prepare('SELECT id FROM transaction_nature WHERE id = ?')
      .get(input.transaction_nature_id);
    if (!transactionNature) {
      res.status(404).json({ error: 'Transaction nature not found' });
      return;
    }

    // Check if combination already exists
    const existing = db.prepare(
      'SELECT id FROM category_group WHERE transaction_nature_id = ? AND name = ?'
    ).get(input.transaction_nature_id, input.name.trim());
    if (existing) {
      res.status(400).json({ error: 'Category group with this name already exists for this transaction nature' });
      return;
    }

    const result = db.prepare(`
      INSERT INTO category_group (transaction_nature_id, name)
      VALUES (?, ?)
    `).run(input.transaction_nature_id, input.name.trim());

    const newCategoryGroup = db.prepare(`
      SELECT
        cg.*,
        tn.name as transaction_nature_name
      FROM category_group cg
      JOIN transaction_nature tn ON cg.transaction_nature_id = tn.id
      WHERE cg.id = ?
    `).get(result.lastInsertRowid) as CategoryGroupWithTransactionNature;

    res.status(201).json({
      ...newCategoryGroup,
      isActive: Boolean(newCategoryGroup.isActive)
    });
  } catch (error) {
    console.error('Error creating category group:', error);
    res.status(500).json({ error: 'Failed to create category group' });
  }
});

// Update category group (admin only)
router.put('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const updates: UpdateCategoryGroupInput = req.body;

    const categoryGroup = db.prepare('SELECT * FROM category_group WHERE id = ?').get(id) as CategoryGroup | undefined;
    if (!categoryGroup) {
      res.status(404).json({ error: 'Category group not found' });
      return;
    }

    const fields: string[] = [];
    const values: (string | number)[] = [];

    if (updates.transaction_nature_id !== undefined) {
      // Verify transaction nature exists
      const transactionNature = db.prepare('SELECT id FROM transaction_nature WHERE id = ?')
        .get(updates.transaction_nature_id);
      if (!transactionNature) {
        res.status(404).json({ error: 'Transaction nature not found' });
        return;
      }
      fields.push('transaction_nature_id = ?');
      values.push(updates.transaction_nature_id);
    }

    if (updates.name !== undefined) {
      if (!updates.name.trim()) {
        res.status(400).json({ error: 'Category group name cannot be empty' });
        return;
      }
      // Check if combination already exists (excluding current record)
      const tnId = updates.transaction_nature_id || categoryGroup.transaction_nature_id;
      const existing = db.prepare(
        'SELECT id FROM category_group WHERE transaction_nature_id = ? AND name = ? AND id != ?'
      ).get(tnId, updates.name.trim(), id);
      if (existing) {
        res.status(400).json({ error: 'Category group with this name already exists for this transaction nature' });
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

    db.prepare(`UPDATE category_group SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updatedCategoryGroup = db.prepare(`
      SELECT
        cg.*,
        tn.name as transaction_nature_name
      FROM category_group cg
      JOIN transaction_nature tn ON cg.transaction_nature_id = tn.id
      WHERE cg.id = ?
    `).get(id) as CategoryGroupWithTransactionNature;

    res.json({
      ...updatedCategoryGroup,
      isActive: Boolean(updatedCategoryGroup.isActive)
    });
  } catch (error) {
    console.error('Error updating category group:', error);
    res.status(500).json({ error: 'Failed to update category group' });
  }
});

// Delete category group (admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const categoryGroup = db.prepare('SELECT * FROM category_group WHERE id = ?').get(id);
    if (!categoryGroup) {
      res.status(404).json({ error: 'Category group not found' });
      return;
    }

    db.prepare('DELETE FROM category_group WHERE id = ?').run(id);

    res.json({ message: 'Category group deleted successfully' });
  } catch (error) {
    console.error('Error deleting category group:', error);
    res.status(500).json({ error: 'Failed to delete category group' });
  }
});

export default router;
