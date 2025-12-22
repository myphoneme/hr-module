import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import type { Signatory, CreateSignatoryInput, UpdateSignatoryInput } from '../types';

const router = Router();

// Configure multer for signature and stamp image uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'signatures');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const prefix = file.fieldname === 'stamp' ? 'stamp' : 'signature';
    cb(null, prefix + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPG, and JPEG image files are allowed'));
    }
  }
});

// Helper to transform signatory to camelCase for client
const transformSignatory = (s: any) => ({
  id: s.id,
  name: s.name,
  position: s.position,
  signatureImage: s.signature_image,
  stampImage: s.stamp_image,
  email: s.email,
  phone: s.phone,
  department: s.department,
  displayOrder: s.display_order,
  isActive: Boolean(s.isActive),
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
});

// Get all signatories
router.get('/', authenticateToken, requireAdmin, (_req: Request, res: Response): void => {
  try {
    const signatories = db.prepare(`
      SELECT *
      FROM signatories
      WHERE isActive = 1
      ORDER BY display_order ASC, name ASC
    `).all();

    res.json(signatories.map(transformSignatory));
  } catch (error) {
    console.error('Error fetching signatories:', error);
    res.status(500).json({ error: 'Failed to fetch signatories' });
  }
});

// Get single signatory
router.get('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const signatory = db.prepare('SELECT * FROM signatories WHERE id = ?').get(id);

    if (!signatory) {
      res.status(404).json({ error: 'Signatory not found' });
      return;
    }

    res.json(transformSignatory(signatory));
  } catch (error) {
    console.error('Error fetching signatory:', error);
    res.status(500).json({ error: 'Failed to fetch signatory' });
  }
});

// Create signatory
router.post('/', authenticateToken, requireAdmin, upload.fields([
  { name: 'signature', maxCount: 1 },
  { name: 'stamp', maxCount: 1 }
]), (req: Request, res: Response): void => {
  try {
    const { name, position, email, phone, department, display_order } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const signature_image = files?.signature?.[0]?.filename || null;
    const stamp_image = files?.stamp?.[0]?.filename || null;

    if (!name || !position) {
      res.status(400).json({ error: 'Name and position are required' });
      return;
    }

    const result = db.prepare(`
      INSERT INTO signatories (name, position, signature_image, stamp_image, email, phone, department, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      position,
      signature_image,
      stamp_image,
      email || null,
      phone || null,
      department || null,
      display_order ? parseInt(display_order) : 0
    );

    const signatory = db.prepare('SELECT * FROM signatories WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(transformSignatory(signatory));
  } catch (error) {
    console.error('Error creating signatory:', error);
    res.status(500).json({ error: 'Failed to create signatory' });
  }
});

// Update signatory
router.put('/:id', authenticateToken, requireAdmin, upload.fields([
  { name: 'signature', maxCount: 1 },
  { name: 'stamp', maxCount: 1 }
]), (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const input: UpdateSignatoryInput = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    console.log('Update signatory request:', { id, input, files: Object.keys(files || {}) });

    // Check if signatory exists
    const existing = db.prepare('SELECT * FROM signatories WHERE id = ?').get(id) as Signatory | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Signatory not found' });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.position !== undefined) {
      updates.push('position = ?');
      values.push(input.position);
    }
    if (input.email !== undefined) {
      updates.push('email = ?');
      values.push(input.email || null);
    }
    if (input.phone !== undefined) {
      updates.push('phone = ?');
      values.push(input.phone || null);
    }
    if (input.department !== undefined) {
      updates.push('department = ?');
      values.push(input.department || null);
    }
    if (input.display_order !== undefined) {
      updates.push('display_order = ?');
      values.push(input.display_order);
    }
    if (input.isActive !== undefined) {
      updates.push('isActive = ?');
      values.push(input.isActive ? 1 : 0);
    }

    // Handle signature image upload
    if (files?.signature?.[0]) {
      updates.push('signature_image = ?');
      values.push(files.signature[0].filename);

      // Delete old signature image if it exists
      if (existing.signature_image) {
        const oldPath = path.join(uploadDir, existing.signature_image);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    }

    // Handle stamp image upload
    if (files?.stamp?.[0]) {
      updates.push('stamp_image = ?');
      values.push(files.stamp[0].filename);

      // Delete old stamp image if it exists
      if (existing.stamp_image) {
        const oldPath = path.join(uploadDir, existing.stamp_image);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updates.push("updatedAt = datetime('now')");

    const sql = `UPDATE signatories SET ${updates.join(', ')} WHERE id = ?`;
    console.log('SQL:', sql);
    console.log('Values:', [...values, id]);

    db.prepare(sql).run(...values, id);

    const updated = db.prepare('SELECT * FROM signatories WHERE id = ?').get(id);
    console.log('Updated signatory:', updated);

    res.json(transformSignatory(updated));
  } catch (error: any) {
    console.error('Error updating signatory:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    res.status(500).json({ error: 'Failed to update signatory', details: error?.message });
  }
});

// Delete signatory (soft delete)
router.delete('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    // Check if signatory exists
    const existing = db.prepare('SELECT * FROM signatories WHERE id = ?').get(id) as Signatory | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Signatory not found' });
      return;
    }

    // Check if signatory is used in any letters
    const usage = db.prepare(`
      SELECT COUNT(*) as count
      FROM letter_signatories
      WHERE signatory_id = ?
    `).get(id) as { count: number };

    if (usage.count > 0) {
      res.status(400).json({
        error: 'Cannot delete signatory that is used in company letters. Please remove from letters first.'
      });
      return;
    }

    // Soft delete
    db.prepare('UPDATE signatories SET isActive = 0, updatedAt = datetime("now") WHERE id = ?').run(id);

    res.json({ message: 'Signatory deleted successfully' });
  } catch (error) {
    console.error('Error deleting signatory:', error);
    res.status(500).json({ error: 'Failed to delete signatory' });
  }
});

// Serve signature images
router.get('/files/:filename', (req: Request, res: Response): void => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

export default router;
