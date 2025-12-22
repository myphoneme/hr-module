import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import type {
  CompanyLetter,
  CompanyLetterWithDetails,
  CreateCompanyLetterInput,
  UpdateCompanyLetterInput,
  SignatoryWithOrder
} from '../types';

const router = Router();

// Helper function to convert image file to base64 data URL
function getImageAsBase64(filename: string | null | undefined, folder: string): string | null {
  if (!filename) return null;

  try {
    const filePath = path.join(process.cwd(), 'uploads', folder, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return null;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');

    // Determine MIME type from extension
    const ext = path.extname(filename).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Error reading image file ${filename}:`, error);
    return null;
  }
}

// Helper function to transform signatory with base64 images
function transformSignatoryWithBase64(s: any): any {
  return {
    id: s.id,
    name: s.name,
    position: s.position,
    signatureImage: getImageAsBase64(s.signature_image, 'signatures'),
    stampImage: getImageAsBase64(s.stamp_image, 'stamps'),
    email: s.email,
    phone: s.phone,
    department: s.department,
    displayOrder: s.display_order,
    signatureOrder: s.signature_order,
    isActive: Boolean(s.isActive)
  };
}

// Get all company letters
router.get('/', authenticateToken, requireAdmin, (_req: Request, res: Response): void => {
  try {
    const letters = db.prepare(`
      SELECT
        cl.*,
        u.name as creator_name,
        u.email as creator_email
      FROM company_letters cl
      JOIN users u ON cl.created_by = u.id
      WHERE cl.isActive = 1
      ORDER BY cl.createdAt DESC
    `).all() as CompanyLetterWithDetails[];

    // For each letter, fetch its signatories
    const lettersWithSignatories = letters.map(letter => {
      const signatories = db.prepare(`
        SELECT
          s.*,
          ls.signature_order
        FROM signatories s
        JOIN letter_signatories ls ON s.id = ls.signatory_id
        WHERE ls.letter_id = ?
        ORDER BY ls.signature_order ASC
      `).all(letter.id) as SignatoryWithOrder[];

      return {
        ...letter,
        isActive: Boolean(letter.isActive),
        signatories: signatories.map(s => transformSignatoryWithBase64(s))
      };
    });

    res.json(lettersWithSignatories);
  } catch (error) {
    console.error('Error fetching company letters:', error);
    res.status(500).json({ error: 'Failed to fetch company letters' });
  }
});

// Get single company letter
router.get('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const letter = db.prepare(`
      SELECT
        cl.*,
        u.name as creator_name,
        u.email as creator_email
      FROM company_letters cl
      JOIN users u ON cl.created_by = u.id
      WHERE cl.id = ?
    `).get(id) as CompanyLetterWithDetails | undefined;

    if (!letter) {
      res.status(404).json({ error: 'Company letter not found' });
      return;
    }

    // Fetch signatories for this letter
    const signatories = db.prepare(`
      SELECT
        s.*,
        ls.signature_order
      FROM signatories s
      JOIN letter_signatories ls ON s.id = ls.signatory_id
      WHERE ls.letter_id = ?
      ORDER BY ls.signature_order ASC
    `).all(id) as SignatoryWithOrder[];

    res.json({
      ...letter,
      isActive: Boolean(letter.isActive),
      signatories: signatories.map(s => transformSignatoryWithBase64(s))
    });
  } catch (error) {
    console.error('Error fetching company letter:', error);
    res.status(500).json({ error: 'Failed to fetch company letter' });
  }
});

// Create company letter
router.post('/', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const input: CreateCompanyLetterInput = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!input.recipient_name || !input.recipient_address || !input.subject || !input.letter_date || !input.body) {
      res.status(400).json({ error: 'Required fields: recipient_name, recipient_address, subject, letter_date, body' });
      return;
    }

    const result = db.prepare(`
      INSERT INTO company_letters (
        letter_number,
        recipient_name,
        recipient_address,
        recipient_city,
        recipient_state,
        recipient_pincode,
        subject,
        letter_date,
        greeting,
        body,
        closing,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.letter_number || null,
      input.recipient_name,
      input.recipient_address,
      input.recipient_city || null,
      input.recipient_state || null,
      input.recipient_pincode || null,
      input.subject,
      input.letter_date,
      input.greeting || 'Dear Sir/Madam',
      input.body,
      input.closing || 'Warm Regards',
      userId
    );

    const letterId = result.lastInsertRowid;

    // Add signatories if provided
    if (input.signatory_ids && input.signatory_ids.length > 0) {
      const insertSignatory = db.prepare(`
        INSERT INTO letter_signatories (letter_id, signatory_id, signature_order)
        VALUES (?, ?, ?)
      `);
      input.signatory_ids.forEach((signatoryId, index) => {
        insertSignatory.run(letterId, signatoryId, index + 1);
      });
    }

    const letter = db.prepare(`
      SELECT
        cl.*,
        u.name as creator_name,
        u.email as creator_email
      FROM company_letters cl
      JOIN users u ON cl.created_by = u.id
      WHERE cl.id = ?
    `).get(letterId) as CompanyLetterWithDetails;

    // Fetch signatories
    const signatories = db.prepare(`
      SELECT
        s.*,
        ls.signature_order
      FROM signatories s
      JOIN letter_signatories ls ON s.id = ls.signatory_id
      WHERE ls.letter_id = ?
      ORDER BY ls.signature_order ASC
    `).all(letterId) as any[];

    res.status(201).json({
      ...letter,
      isActive: Boolean(letter.isActive),
      signatories: signatories.map(s => transformSignatoryWithBase64(s))
    });
  } catch (error) {
    console.error('Error creating company letter:', error);
    res.status(500).json({ error: 'Failed to create company letter' });
  }
});

// Update company letter
router.put('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const input: UpdateCompanyLetterInput = req.body;

    // Check if letter exists
    const existing = db.prepare('SELECT * FROM company_letters WHERE id = ?').get(id) as CompanyLetter | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Company letter not found' });
      return;
    }

    // Cannot edit finalized or sent letters
    if (existing.status !== 'draft' && input.status === undefined) {
      res.status(400).json({ error: 'Cannot edit finalized or sent letters' });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (input.letter_number !== undefined) {
      updates.push('letter_number = ?');
      values.push(input.letter_number || null);
    }
    if (input.recipient_name !== undefined) {
      updates.push('recipient_name = ?');
      values.push(input.recipient_name);
    }
    if (input.recipient_address !== undefined) {
      updates.push('recipient_address = ?');
      values.push(input.recipient_address);
    }
    if (input.recipient_city !== undefined) {
      updates.push('recipient_city = ?');
      values.push(input.recipient_city || null);
    }
    if (input.recipient_state !== undefined) {
      updates.push('recipient_state = ?');
      values.push(input.recipient_state || null);
    }
    if (input.recipient_pincode !== undefined) {
      updates.push('recipient_pincode = ?');
      values.push(input.recipient_pincode || null);
    }
    if (input.subject !== undefined) {
      updates.push('subject = ?');
      values.push(input.subject);
    }
    if (input.letter_date !== undefined) {
      updates.push('letter_date = ?');
      values.push(input.letter_date);
    }
    if (input.greeting !== undefined) {
      updates.push('greeting = ?');
      values.push(input.greeting);
    }
    if (input.body !== undefined) {
      updates.push('body = ?');
      values.push(input.body);
    }
    if (input.closing !== undefined) {
      updates.push('closing = ?');
      values.push(input.closing);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      values.push(input.status);
    }
    if (input.isActive !== undefined) {
      updates.push('isActive = ?');
      values.push(input.isActive ? 1 : 0);
    }

    // Handle signatory_ids update separately
    if (input.signatory_ids !== undefined) {
      // Delete existing signatories for this letter
      db.prepare('DELETE FROM letter_signatories WHERE letter_id = ?').run(id);

      // Add new signatories
      if (input.signatory_ids.length > 0) {
        const insertSignatory = db.prepare(`
          INSERT INTO letter_signatories (letter_id, signatory_id, signature_order)
          VALUES (?, ?, ?)
        `);
        input.signatory_ids.forEach((signatoryId, index) => {
          insertSignatory.run(id, signatoryId, index + 1);
        });
      }
    }

    if (updates.length === 0 && input.signatory_ids === undefined) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    if (updates.length > 0) {
      updates.push("updatedAt = datetime('now')");
      values.push(id);

      db.prepare(`
        UPDATE company_letters
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...values);
    }

    const updated = db.prepare(`
      SELECT
        cl.*,
        u.name as creator_name,
        u.email as creator_email
      FROM company_letters cl
      JOIN users u ON cl.created_by = u.id
      WHERE cl.id = ?
    `).get(id) as CompanyLetterWithDetails;

    // Fetch signatories
    const signatories = db.prepare(`
      SELECT
        s.*,
        ls.signature_order
      FROM signatories s
      JOIN letter_signatories ls ON s.id = ls.signatory_id
      WHERE ls.letter_id = ?
      ORDER BY ls.signature_order ASC
    `).all(id) as SignatoryWithOrder[];

    res.json({
      ...updated,
      isActive: Boolean(updated.isActive),
      signatories: signatories.map(s => transformSignatoryWithBase64(s))
    });
  } catch (error) {
    console.error('Error updating company letter:', error);
    res.status(500).json({ error: 'Failed to update company letter' });
  }
});

// Delete company letter (soft delete)
router.delete('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    // Check if letter exists
    const existing = db.prepare('SELECT * FROM company_letters WHERE id = ?').get(id) as CompanyLetter | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Company letter not found' });
      return;
    }

    // Soft delete
    db.prepare("UPDATE company_letters SET isActive = 0, updatedAt = datetime('now') WHERE id = ?").run(id);

    res.json({ message: 'Company letter deleted successfully' });
  } catch (error) {
    console.error('Error deleting company letter:', error);
    res.status(500).json({ error: 'Failed to delete company letter' });
  }
});

// Add signatory to letter
router.post('/:id/signatories', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { signatoryId, order } = req.body;

    if (!signatoryId) {
      res.status(400).json({ error: 'signatoryId is required' });
      return;
    }

    // Check if letter exists
    const letter = db.prepare('SELECT * FROM company_letters WHERE id = ?').get(id) as CompanyLetter | undefined;
    if (!letter) {
      res.status(404).json({ error: 'Company letter not found' });
      return;
    }

    // Check if signatory exists
    const signatory = db.prepare('SELECT * FROM signatories WHERE id = ?').get(signatoryId);
    if (!signatory) {
      res.status(404).json({ error: 'Signatory not found' });
      return;
    }

    // Check if already added
    const existing = db.prepare('SELECT * FROM letter_signatories WHERE letter_id = ? AND signatory_id = ?').get(id, signatoryId);
    if (existing) {
      res.status(400).json({ error: 'Signatory already added to this letter' });
      return;
    }

    // Add signatory
    db.prepare(`
      INSERT INTO letter_signatories (letter_id, signatory_id, signature_order)
      VALUES (?, ?, ?)
    `).run(id, signatoryId, order || 1);

    res.status(201).json({ message: 'Signatory added successfully' });
  } catch (error) {
    console.error('Error adding signatory:', error);
    res.status(500).json({ error: 'Failed to add signatory' });
  }
});

// Remove signatory from letter
router.delete('/:id/signatories/:signatoryId', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id, signatoryId } = req.params;

    // Check if association exists
    const existing = db.prepare('SELECT * FROM letter_signatories WHERE letter_id = ? AND signatory_id = ?').get(id, signatoryId);
    if (!existing) {
      res.status(404).json({ error: 'Signatory not found in this letter' });
      return;
    }

    // Remove signatory
    db.prepare('DELETE FROM letter_signatories WHERE letter_id = ? AND signatory_id = ?').run(id, signatoryId);

    res.json({ message: 'Signatory removed successfully' });
  } catch (error) {
    console.error('Error removing signatory:', error);
    res.status(500).json({ error: 'Failed to remove signatory' });
  }
});

export default router;
