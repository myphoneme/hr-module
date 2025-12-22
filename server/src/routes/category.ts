import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import type { Category, CategoryWithDetails, CreateCategoryInput, UpdateCategoryInput } from '../types';

const router = Router();

// Get all categories with category group and transaction nature names
router.get('/', authenticateToken, (_req: Request, res: Response): void => {
  try {
    const categories = db.prepare(`
      SELECT
        c.*,
        cg.name as category_group_name,
        cg.transaction_nature_id,
        tn.name as transaction_nature_name
      FROM category c
      JOIN category_group cg ON c.category_group_id = cg.id
      JOIN transaction_nature tn ON cg.transaction_nature_id = tn.id
      ORDER BY tn.name ASC, cg.name ASC, c.name ASC
    `).all() as CategoryWithDetails[];

    res.json(categories.map(c => ({
      ...c,
      isActive: Boolean(c.isActive)
    })));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get single category
router.get('/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const category = db.prepare(`
      SELECT
        c.*,
        cg.name as category_group_name,
        cg.transaction_nature_id,
        tn.name as transaction_nature_name
      FROM category c
      JOIN category_group cg ON c.category_group_id = cg.id
      JOIN transaction_nature tn ON cg.transaction_nature_id = tn.id
      WHERE c.id = ?
    `).get(id) as CategoryWithDetails | undefined;

    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    res.json({
      ...category,
      isActive: Boolean(category.isActive)
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// Create category (admin only)
router.post('/', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const input: CreateCategoryInput = req.body;

    if (!input.name || !input.name.trim()) {
      res.status(400).json({ error: 'Category name is required' });
      return;
    }

    if (!input.category_group_id) {
      res.status(400).json({ error: 'Category group is required' });
      return;
    }

    // Verify category group exists
    const categoryGroup = db.prepare('SELECT id FROM category_group WHERE id = ?')
      .get(input.category_group_id);
    if (!categoryGroup) {
      res.status(404).json({ error: 'Category group not found' });
      return;
    }

    // Check if combination already exists
    const existing = db.prepare(
      'SELECT id FROM category WHERE category_group_id = ? AND name = ?'
    ).get(input.category_group_id, input.name.trim());
    if (existing) {
      res.status(400).json({ error: 'Category with this name already exists for this category group' });
      return;
    }

    const result = db.prepare(`
      INSERT INTO category (category_group_id, name)
      VALUES (?, ?)
    `).run(input.category_group_id, input.name.trim());

    const newCategory = db.prepare(`
      SELECT
        c.*,
        cg.name as category_group_name,
        cg.transaction_nature_id,
        tn.name as transaction_nature_name
      FROM category c
      JOIN category_group cg ON c.category_group_id = cg.id
      JOIN transaction_nature tn ON cg.transaction_nature_id = tn.id
      WHERE c.id = ?
    `).get(result.lastInsertRowid) as CategoryWithDetails;

    res.status(201).json({
      ...newCategory,
      isActive: Boolean(newCategory.isActive)
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category (admin only)
router.put('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const updates: UpdateCategoryInput = req.body;

    const category = db.prepare('SELECT * FROM category WHERE id = ?').get(id) as Category | undefined;
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const fields: string[] = [];
    const values: (string | number)[] = [];

    if (updates.category_group_id !== undefined) {
      // Verify category group exists
      const categoryGroup = db.prepare('SELECT id FROM category_group WHERE id = ?')
        .get(updates.category_group_id);
      if (!categoryGroup) {
        res.status(404).json({ error: 'Category group not found' });
        return;
      }
      fields.push('category_group_id = ?');
      values.push(updates.category_group_id);
    }

    if (updates.name !== undefined) {
      if (!updates.name.trim()) {
        res.status(400).json({ error: 'Category name cannot be empty' });
        return;
      }
      // Check if combination already exists (excluding current record)
      const cgId = updates.category_group_id || category.category_group_id;
      const existing = db.prepare(
        'SELECT id FROM category WHERE category_group_id = ? AND name = ? AND id != ?'
      ).get(cgId, updates.name.trim(), id);
      if (existing) {
        res.status(400).json({ error: 'Category with this name already exists for this category group' });
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

    db.prepare(`UPDATE category SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updatedCategory = db.prepare(`
      SELECT
        c.*,
        cg.name as category_group_name,
        cg.transaction_nature_id,
        tn.name as transaction_nature_name
      FROM category c
      JOIN category_group cg ON c.category_group_id = cg.id
      JOIN transaction_nature tn ON cg.transaction_nature_id = tn.id
      WHERE c.id = ?
    `).get(id) as CategoryWithDetails;

    res.json({
      ...updatedCategory,
      isActive: Boolean(updatedCategory.isActive)
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category (admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const category = db.prepare('SELECT * FROM category WHERE id = ?').get(id);
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    db.prepare('DELETE FROM category WHERE id = ?').run(id);

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
