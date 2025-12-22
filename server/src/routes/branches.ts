import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import type { Branch, BranchWithCompany, CreateBranchInput, UpdateBranchInput } from '../types';

const router = Router();

// Get all branches with company info
router.get('/', authenticateToken, (_req: Request, res: Response): void => {
  try {
    const branches = db.prepare(`
      SELECT
        b.*,
        c.name as company_name,
        c.pan_no as company_pan_no
      FROM branches b
      JOIN companies c ON b.company_id = c.id
      ORDER BY c.name ASC, b.is_head_office DESC, b.branch_name ASC
    `).all() as BranchWithCompany[];

    res.json(branches.map(b => ({
      ...b,
      is_head_office: Boolean(b.is_head_office),
      isActive: Boolean(b.isActive)
    })));
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

// Get branches by company
router.get('/company/:companyId', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { companyId } = req.params;

    const branches = db.prepare(`
      SELECT * FROM branches
      WHERE company_id = ?
      ORDER BY is_head_office DESC, branch_name ASC
    `).all(companyId) as Branch[];

    res.json(branches.map(b => ({
      ...b,
      is_head_office: Boolean(b.is_head_office),
      isActive: Boolean(b.isActive)
    })));
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

// Get single branch
router.get('/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const branch = db.prepare(`
      SELECT
        b.*,
        c.name as company_name,
        c.pan_no as company_pan_no
      FROM branches b
      JOIN companies c ON b.company_id = c.id
      WHERE b.id = ?
    `).get(id) as BranchWithCompany | undefined;

    if (!branch) {
      res.status(404).json({ error: 'Branch not found' });
      return;
    }

    res.json({
      ...branch,
      is_head_office: Boolean(branch.is_head_office),
      isActive: Boolean(branch.isActive)
    });
  } catch (error) {
    console.error('Error fetching branch:', error);
    res.status(500).json({ error: 'Failed to fetch branch' });
  }
});

// Create branch (admin only)
router.post('/', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const {
      company_id,
      branch_name,
      address,
      city,
      state_name,
      pin_code,
      gstin,
      is_head_office
    }: CreateBranchInput = req.body;

    // Validate required fields
    if (!company_id || !branch_name || !address || !city || !state_name || !pin_code || !gstin) {
      res.status(400).json({ error: 'All branch fields are required' });
      return;
    }

    // Check if company exists
    const company = db.prepare('SELECT id FROM companies WHERE id = ?').get(company_id);
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    // Check if GSTIN already exists
    const existingBranch = db.prepare('SELECT id FROM branches WHERE gstin = ?').get(gstin);
    if (existingBranch) {
      res.status(409).json({ error: 'A branch with this GSTIN already exists' });
      return;
    }

    // If setting as head office, unset any existing head office for this company
    if (is_head_office) {
      db.prepare('UPDATE branches SET is_head_office = 0 WHERE company_id = ?').run(company_id);
    }

    const result = db.prepare(`
      INSERT INTO branches (company_id, branch_name, address, city, state_name, pin_code, gstin, is_head_office)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(company_id, branch_name, address, city, state_name, pin_code, gstin, is_head_office ? 1 : 0);

    const newBranch = db.prepare(`
      SELECT
        b.*,
        c.name as company_name,
        c.pan_no as company_pan_no
      FROM branches b
      JOIN companies c ON b.company_id = c.id
      WHERE b.id = ?
    `).get(result.lastInsertRowid) as BranchWithCompany;

    res.status(201).json({
      ...newBranch,
      is_head_office: Boolean(newBranch.is_head_office),
      isActive: Boolean(newBranch.isActive)
    });
  } catch (error) {
    console.error('Error creating branch:', error);
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// Update branch (admin only)
router.put('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const updates: UpdateBranchInput = req.body;

    const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(id) as Branch | undefined;
    if (!branch) {
      res.status(404).json({ error: 'Branch not found' });
      return;
    }

    // Check if new GSTIN conflicts with another branch
    if (updates.gstin && updates.gstin !== branch.gstin) {
      const existingBranch = db.prepare('SELECT id FROM branches WHERE gstin = ? AND id != ?').get(updates.gstin, id);
      if (existingBranch) {
        res.status(409).json({ error: 'A branch with this GSTIN already exists' });
        return;
      }
    }

    // If setting as head office, unset any existing head office for this company
    if (updates.is_head_office) {
      db.prepare('UPDATE branches SET is_head_office = 0 WHERE company_id = ? AND id != ?').run(branch.company_id, id);
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.branch_name !== undefined) {
      fields.push('branch_name = ?');
      values.push(updates.branch_name);
    }
    if (updates.address !== undefined) {
      fields.push('address = ?');
      values.push(updates.address);
    }
    if (updates.city !== undefined) {
      fields.push('city = ?');
      values.push(updates.city);
    }
    if (updates.state_name !== undefined) {
      fields.push('state_name = ?');
      values.push(updates.state_name);
    }
    if (updates.pin_code !== undefined) {
      fields.push('pin_code = ?');
      values.push(updates.pin_code);
    }
    if (updates.gstin !== undefined) {
      fields.push('gstin = ?');
      values.push(updates.gstin);
    }
    if (updates.is_head_office !== undefined) {
      fields.push('is_head_office = ?');
      values.push(updates.is_head_office ? 1 : 0);
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

    db.prepare(`UPDATE branches SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updatedBranch = db.prepare(`
      SELECT
        b.*,
        c.name as company_name,
        c.pan_no as company_pan_no
      FROM branches b
      JOIN companies c ON b.company_id = c.id
      WHERE b.id = ?
    `).get(id) as BranchWithCompany;

    res.json({
      ...updatedBranch,
      is_head_office: Boolean(updatedBranch.is_head_office),
      isActive: Boolean(updatedBranch.isActive)
    });
  } catch (error) {
    console.error('Error updating branch:', error);
    res.status(500).json({ error: 'Failed to update branch' });
  }
});

// Delete branch (admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(id);
    if (!branch) {
      res.status(404).json({ error: 'Branch not found' });
      return;
    }

    db.prepare('DELETE FROM branches WHERE id = ?').run(id);

    res.json({ message: 'Branch deleted successfully' });
  } catch (error) {
    console.error('Error deleting branch:', error);
    res.status(500).json({ error: 'Failed to delete branch' });
  }
});

export default router;
