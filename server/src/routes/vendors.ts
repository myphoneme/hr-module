import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import type { Vendor, VendorWithDetails, CreateVendorInput, UpdateVendorInput } from '../types';

const router = Router();

// Get all vendors
router.get('/', authenticateToken, (_req: Request, res: Response): void => {
  try {
    const vendors = db.prepare(`
      SELECT
        v.*,
        b.branch_name,
        c.name as company_name,
        p.name as project_name,
        ba.account_name as company_bank_account_name
      FROM vendors v
      JOIN branches b ON v.branch_id = b.id
      JOIN companies c ON b.company_id = c.id
      LEFT JOIN projects p ON v.project_id = p.id
      LEFT JOIN bank_accounts ba ON v.company_bank_account_id = ba.id
      ORDER BY v.vendor_name ASC
    `).all() as VendorWithDetails[];

    res.json(vendors.map(v => ({
      ...v,
      isActive: Boolean(v.isActive)
    })));
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// Get single vendor
router.get('/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const vendor = db.prepare(`
      SELECT
        v.*,
        b.branch_name,
        c.name as company_name,
        p.name as project_name,
        ba.account_name as company_bank_account_name
      FROM vendors v
      JOIN branches b ON v.branch_id = b.id
      JOIN companies c ON b.company_id = c.id
      LEFT JOIN projects p ON v.project_id = p.id
      LEFT JOIN bank_accounts ba ON v.company_bank_account_id = ba.id
      WHERE v.id = ?
    `).get(id) as VendorWithDetails | undefined;

    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    res.json({
      ...vendor,
      isActive: Boolean(vendor.isActive)
    });
  } catch (error) {
    console.error('Error fetching vendor:', error);
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
});

// Create vendor (admin only)
router.post('/', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const input: CreateVendorInput = req.body;

    if (!input.vendor_name || !input.branch_id || !input.party_type) {
      res.status(400).json({ error: 'Vendor name, branch, and party type are required' });
      return;
    }

    // Verify branch exists
    const branch = db.prepare('SELECT id FROM branches WHERE id = ?').get(input.branch_id);
    if (!branch) {
      res.status(404).json({ error: 'Branch not found' });
      return;
    }

    const result = db.prepare(`
      INSERT INTO vendors (
        vendor_name, vendor_legal_name, gstin, pan, email, mobile_no,
        address, city, state, pincode, party_type, opening_date, opening_balance,
        msme_certificate, beneficiary_name, bank_account_type, account_number,
        ifsc_code, branch_id, project_id, category, company_bank_account_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.vendor_name,
      input.vendor_legal_name || null,
      input.gstin || null,
      input.pan || null,
      input.email || null,
      input.mobile_no || null,
      input.address || null,
      input.city || null,
      input.state || null,
      input.pincode || null,
      input.party_type,
      input.opening_date || null,
      input.opening_balance || 0,
      input.msme_certificate || null,
      input.beneficiary_name || null,
      input.bank_account_type || null,
      input.account_number || null,
      input.ifsc_code || null,
      input.branch_id,
      input.project_id || null,
      input.category || null,
      input.company_bank_account_id || null
    );

    const newVendor = db.prepare(`
      SELECT
        v.*,
        b.branch_name,
        c.name as company_name,
        p.name as project_name,
        ba.account_name as company_bank_account_name
      FROM vendors v
      JOIN branches b ON v.branch_id = b.id
      JOIN companies c ON b.company_id = c.id
      LEFT JOIN projects p ON v.project_id = p.id
      LEFT JOIN bank_accounts ba ON v.company_bank_account_id = ba.id
      WHERE v.id = ?
    `).get(result.lastInsertRowid) as VendorWithDetails;

    res.status(201).json({
      ...newVendor,
      isActive: Boolean(newVendor.isActive)
    });
  } catch (error) {
    console.error('Error creating vendor:', error);
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

// Update vendor (admin only)
router.put('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const updates: UpdateVendorInput = req.body;

    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(id);
    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.vendor_name !== undefined) {
      fields.push('vendor_name = ?');
      values.push(updates.vendor_name);
    }
    if (updates.vendor_legal_name !== undefined) {
      fields.push('vendor_legal_name = ?');
      values.push(updates.vendor_legal_name || null);
    }
    if (updates.gstin !== undefined) {
      fields.push('gstin = ?');
      values.push(updates.gstin || null);
    }
    if (updates.pan !== undefined) {
      fields.push('pan = ?');
      values.push(updates.pan || null);
    }
    if (updates.email !== undefined) {
      fields.push('email = ?');
      values.push(updates.email || null);
    }
    if (updates.mobile_no !== undefined) {
      fields.push('mobile_no = ?');
      values.push(updates.mobile_no || null);
    }
    if (updates.address !== undefined) {
      fields.push('address = ?');
      values.push(updates.address || null);
    }
    if (updates.city !== undefined) {
      fields.push('city = ?');
      values.push(updates.city || null);
    }
    if (updates.state !== undefined) {
      fields.push('state = ?');
      values.push(updates.state || null);
    }
    if (updates.pincode !== undefined) {
      fields.push('pincode = ?');
      values.push(updates.pincode || null);
    }
    if (updates.party_type !== undefined) {
      fields.push('party_type = ?');
      values.push(updates.party_type);
    }
    if (updates.opening_date !== undefined) {
      fields.push('opening_date = ?');
      values.push(updates.opening_date || null);
    }
    if (updates.opening_balance !== undefined) {
      fields.push('opening_balance = ?');
      values.push(updates.opening_balance);
    }
    if (updates.msme_certificate !== undefined) {
      fields.push('msme_certificate = ?');
      values.push(updates.msme_certificate || null);
    }
    if (updates.beneficiary_name !== undefined) {
      fields.push('beneficiary_name = ?');
      values.push(updates.beneficiary_name || null);
    }
    if (updates.bank_account_type !== undefined) {
      fields.push('bank_account_type = ?');
      values.push(updates.bank_account_type || null);
    }
    if (updates.account_number !== undefined) {
      fields.push('account_number = ?');
      values.push(updates.account_number || null);
    }
    if (updates.ifsc_code !== undefined) {
      fields.push('ifsc_code = ?');
      values.push(updates.ifsc_code || null);
    }
    if (updates.branch_id !== undefined) {
      fields.push('branch_id = ?');
      values.push(updates.branch_id);
    }
    if (updates.project_id !== undefined) {
      fields.push('project_id = ?');
      values.push(updates.project_id || null);
    }
    if (updates.category !== undefined) {
      fields.push('category = ?');
      values.push(updates.category || null);
    }
    if (updates.company_bank_account_id !== undefined) {
      fields.push('company_bank_account_id = ?');
      values.push(updates.company_bank_account_id || null);
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

    db.prepare(`UPDATE vendors SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updatedVendor = db.prepare(`
      SELECT
        v.*,
        b.branch_name,
        c.name as company_name,
        p.name as project_name,
        ba.account_name as company_bank_account_name
      FROM vendors v
      JOIN branches b ON v.branch_id = b.id
      JOIN companies c ON b.company_id = c.id
      LEFT JOIN projects p ON v.project_id = p.id
      LEFT JOIN bank_accounts ba ON v.company_bank_account_id = ba.id
      WHERE v.id = ?
    `).get(id) as VendorWithDetails;

    res.json({
      ...updatedVendor,
      isActive: Boolean(updatedVendor.isActive)
    });
  } catch (error) {
    console.error('Error updating vendor:', error);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

// Delete vendor (admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(id);
    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    db.prepare('DELETE FROM vendors WHERE id = ?').run(id);

    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

export default router;
