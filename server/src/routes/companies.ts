import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import type { Company, CompanyWithBranches, Branch, CreateCompanyInput, UpdateCompanyInput } from '../types';

const router = Router();

// Get all companies with their branches
router.get('/', authenticateToken, (_req: Request, res: Response): void => {
  try {
    const companies = db.prepare(`
      SELECT * FROM companies ORDER BY name ASC
    `).all() as Company[];

    const companiesWithBranches: CompanyWithBranches[] = companies.map(company => {
      const branches = db.prepare(`
        SELECT * FROM branches WHERE company_id = ? ORDER BY is_head_office DESC, branch_name ASC
      `).all(company.id) as Branch[];

      return {
        ...company,
        isActive: Boolean(company.isActive),
        branches: branches.map(b => ({
          ...b,
          is_head_office: Boolean(b.is_head_office),
          isActive: Boolean(b.isActive)
        }))
      };
    });

    res.json(companiesWithBranches);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get single company with branches
router.get('/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const company = db.prepare(`
      SELECT * FROM companies WHERE id = ?
    `).get(id) as Company | undefined;

    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const branches = db.prepare(`
      SELECT * FROM branches WHERE company_id = ? ORDER BY is_head_office DESC, branch_name ASC
    `).all(id) as Branch[];

    const companyWithBranches: CompanyWithBranches = {
      ...company,
      isActive: Boolean(company.isActive),
      branches: branches.map(b => ({
        ...b,
        is_head_office: Boolean(b.is_head_office),
        isActive: Boolean(b.isActive)
      }))
    };

    res.json(companyWithBranches);
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Create company (admin only)
router.post('/', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { name, pan_no, logo }: CreateCompanyInput = req.body;

    if (!name || !pan_no) {
      res.status(400).json({ error: 'Company name and PAN number are required' });
      return;
    }

    // Check if PAN already exists
    const existingCompany = db.prepare('SELECT id FROM companies WHERE pan_no = ?').get(pan_no);
    if (existingCompany) {
      res.status(409).json({ error: 'A company with this PAN number already exists' });
      return;
    }

    const result = db.prepare(`
      INSERT INTO companies (name, pan_no, logo)
      VALUES (?, ?, ?)
    `).run(name, pan_no, logo || null);

    const newCompany = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid) as Company;

    res.status(201).json({
      ...newCompany,
      isActive: Boolean(newCompany.isActive),
      branches: []
    });
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// Update company (admin only)
router.put('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const updates: UpdateCompanyInput = req.body;

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as Company | undefined;
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    // Check if new PAN conflicts with another company
    if (updates.pan_no && updates.pan_no !== company.pan_no) {
      const existingCompany = db.prepare('SELECT id FROM companies WHERE pan_no = ? AND id != ?').get(updates.pan_no, id);
      if (existingCompany) {
        res.status(409).json({ error: 'A company with this PAN number already exists' });
        return;
      }
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.pan_no !== undefined) {
      fields.push('pan_no = ?');
      values.push(updates.pan_no);
    }
    if (updates.logo !== undefined) {
      fields.push('logo = ?');
      values.push(updates.logo);
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

    db.prepare(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updatedCompany = db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as Company;
    const branches = db.prepare('SELECT * FROM branches WHERE company_id = ?').all(id) as Branch[];

    res.json({
      ...updatedCompany,
      isActive: Boolean(updatedCompany.isActive),
      branches: branches.map(b => ({
        ...b,
        is_head_office: Boolean(b.is_head_office),
        isActive: Boolean(b.isActive)
      }))
    });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// Delete company (admin only) - will cascade delete branches
router.delete('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    db.prepare('DELETE FROM companies WHERE id = ?').run(id);

    res.json({ message: 'Company and all its branches deleted successfully' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

export default router;
