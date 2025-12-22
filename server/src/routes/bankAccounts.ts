import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import type { BankAccount, BankAccountWithBranch, CreateBankAccountInput, UpdateBankAccountInput, BankAccountType } from '../types';

const router = Router();

// Get all bank accounts with branch info
router.get('/', authenticateToken, (_req: Request, res: Response): void => {
  try {
    const accounts = db.prepare(`
      SELECT
        ba.*,
        b.branch_name,
        c.name as company_name
      FROM bank_accounts ba
      JOIN branches b ON ba.branch_id = b.id
      JOIN companies c ON b.company_id = c.id
      ORDER BY c.name ASC, b.branch_name ASC, ba.account_type ASC
    `).all() as BankAccountWithBranch[];

    res.json(accounts.map(a => ({
      ...a,
      isActive: Boolean(a.isActive)
    })));
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    res.status(500).json({ error: 'Failed to fetch bank accounts' });
  }
});

// Get bank accounts by type
router.get('/type/:type', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { type } = req.params;
    const validTypes: BankAccountType[] = ['savings', 'current', 'credit_card', 'fd', 'loan'];

    if (!validTypes.includes(type as BankAccountType)) {
      res.status(400).json({ error: 'Invalid account type' });
      return;
    }

    const accounts = db.prepare(`
      SELECT
        ba.*,
        b.branch_name,
        c.name as company_name
      FROM bank_accounts ba
      JOIN branches b ON ba.branch_id = b.id
      JOIN companies c ON b.company_id = c.id
      WHERE ba.account_type = ?
      ORDER BY c.name ASC, b.branch_name ASC
    `).all(type) as BankAccountWithBranch[];

    res.json(accounts.map(a => ({
      ...a,
      isActive: Boolean(a.isActive)
    })));
  } catch (error) {
    console.error('Error fetching bank accounts by type:', error);
    res.status(500).json({ error: 'Failed to fetch bank accounts' });
  }
});

// Get bank accounts by branch
router.get('/branch/:branchId', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { branchId } = req.params;

    const accounts = db.prepare(`
      SELECT * FROM bank_accounts
      WHERE branch_id = ?
      ORDER BY account_type ASC, account_name ASC
    `).all(branchId) as BankAccount[];

    res.json(accounts.map(a => ({
      ...a,
      isActive: Boolean(a.isActive)
    })));
  } catch (error) {
    console.error('Error fetching bank accounts by branch:', error);
    res.status(500).json({ error: 'Failed to fetch bank accounts' });
  }
});

// Get single bank account
router.get('/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const account = db.prepare(`
      SELECT
        ba.*,
        b.branch_name,
        c.name as company_name
      FROM bank_accounts ba
      JOIN branches b ON ba.branch_id = b.id
      JOIN companies c ON b.company_id = c.id
      WHERE ba.id = ?
    `).get(id) as BankAccountWithBranch | undefined;

    if (!account) {
      res.status(404).json({ error: 'Bank account not found' });
      return;
    }

    res.json({
      ...account,
      isActive: Boolean(account.isActive)
    });
  } catch (error) {
    console.error('Error fetching bank account:', error);
    res.status(500).json({ error: 'Failed to fetch bank account' });
  }
});

// Create bank account (admin only)
router.post('/', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const data: CreateBankAccountInput = req.body;

    if (!data.branch_id || !data.account_type || !data.account_name || !data.account_number) {
      res.status(400).json({ error: 'Branch, account type, name, and number are required' });
      return;
    }

    // Verify branch exists
    const branch = db.prepare('SELECT id FROM branches WHERE id = ?').get(data.branch_id);
    if (!branch) {
      res.status(404).json({ error: 'Branch not found' });
      return;
    }

    const result = db.prepare(`
      INSERT INTO bank_accounts (
        branch_id, account_type, account_name, alias, account_number,
        institution_name, ifsc_code, swift_code, bank_address, bank_city,
        cc_credit_limit, cc_monthly_interest, cc_issue_date, cc_expiry_date, cc_cvv, cc_due_date,
        fd_yearly_interest, fd_amount, fd_maturity_amount, fd_tenure_months, fd_start_date, fd_maturity_date,
        loan_monthly_interest, loan_amount, loan_tenure_months, loan_first_emi_date, loan_monthly_emi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.branch_id, data.account_type, data.account_name, data.alias || null, data.account_number,
      data.institution_name || null, data.ifsc_code || null, data.swift_code || null, data.bank_address || null, data.bank_city || null,
      data.cc_credit_limit || null, data.cc_monthly_interest || null, data.cc_issue_date || null, data.cc_expiry_date || null, data.cc_cvv || null, data.cc_due_date || null,
      data.fd_yearly_interest || null, data.fd_amount || null, data.fd_maturity_amount || null, data.fd_tenure_months || null, data.fd_start_date || null, data.fd_maturity_date || null,
      data.loan_monthly_interest || null, data.loan_amount || null, data.loan_tenure_months || null, data.loan_first_emi_date || null, data.loan_monthly_emi || null
    );

    const newAccount = db.prepare(`
      SELECT
        ba.*,
        b.branch_name,
        c.name as company_name
      FROM bank_accounts ba
      JOIN branches b ON ba.branch_id = b.id
      JOIN companies c ON b.company_id = c.id
      WHERE ba.id = ?
    `).get(result.lastInsertRowid) as BankAccountWithBranch;

    res.status(201).json({
      ...newAccount,
      isActive: Boolean(newAccount.isActive)
    });
  } catch (error) {
    console.error('Error creating bank account:', error);
    res.status(500).json({ error: 'Failed to create bank account' });
  }
});

// Update bank account (admin only)
router.put('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const updates: UpdateBankAccountInput = req.body;

    const account = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(id);
    if (!account) {
      res.status(404).json({ error: 'Bank account not found' });
      return;
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const fieldMap: Record<string, string> = {
      branch_id: 'branch_id',
      account_type: 'account_type',
      account_name: 'account_name',
      alias: 'alias',
      account_number: 'account_number',
      institution_name: 'institution_name',
      ifsc_code: 'ifsc_code',
      swift_code: 'swift_code',
      bank_address: 'bank_address',
      bank_city: 'bank_city',
      cc_credit_limit: 'cc_credit_limit',
      cc_monthly_interest: 'cc_monthly_interest',
      cc_issue_date: 'cc_issue_date',
      cc_expiry_date: 'cc_expiry_date',
      cc_cvv: 'cc_cvv',
      cc_due_date: 'cc_due_date',
      fd_yearly_interest: 'fd_yearly_interest',
      fd_amount: 'fd_amount',
      fd_maturity_amount: 'fd_maturity_amount',
      fd_tenure_months: 'fd_tenure_months',
      fd_start_date: 'fd_start_date',
      fd_maturity_date: 'fd_maturity_date',
      loan_monthly_interest: 'loan_monthly_interest',
      loan_amount: 'loan_amount',
      loan_tenure_months: 'loan_tenure_months',
      loan_first_emi_date: 'loan_first_emi_date',
      loan_monthly_emi: 'loan_monthly_emi',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if ((updates as any)[key] !== undefined) {
        fields.push(`${dbField} = ?`);
        values.push((updates as any)[key] ?? null);
      }
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

    db.prepare(`UPDATE bank_accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updatedAccount = db.prepare(`
      SELECT
        ba.*,
        b.branch_name,
        c.name as company_name
      FROM bank_accounts ba
      JOIN branches b ON ba.branch_id = b.id
      JOIN companies c ON b.company_id = c.id
      WHERE ba.id = ?
    `).get(id) as BankAccountWithBranch;

    res.json({
      ...updatedAccount,
      isActive: Boolean(updatedAccount.isActive)
    });
  } catch (error) {
    console.error('Error updating bank account:', error);
    res.status(500).json({ error: 'Failed to update bank account' });
  }
});

// Delete bank account (admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const account = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(id);
    if (!account) {
      res.status(404).json({ error: 'Bank account not found' });
      return;
    }

    db.prepare('DELETE FROM bank_accounts WHERE id = ?').run(id);

    res.json({ message: 'Bank account deleted successfully' });
  } catch (error) {
    console.error('Error deleting bank account:', error);
    res.status(500).json({ error: 'Failed to delete bank account' });
  }
});

export default router;
