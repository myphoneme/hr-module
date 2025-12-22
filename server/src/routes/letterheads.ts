import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Types
interface Letterhead {
  id: number;
  name: string;
  description: string | null;
  header_image: string | null;
  footer_image: string | null;
  logo_image: string | null;
  company_name: string | null;
  company_address: string | null;
  company_contact: string | null;
  company_email: string | null;
  company_website: string | null;
  company_cin: string | null;
  company_gstin: string | null;
  is_default: number;
  uploaded_by: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

interface LetterheadWithUser extends Letterhead {
  uploader_name: string;
  uploader_email: string;
}

// Configure upload directory
const letterheadUploadDir = path.join(process.cwd(), 'uploads', 'letterheads');

// Create directory if it doesn't exist
if (!fs.existsSync(letterheadUploadDir)) {
  fs.mkdirSync(letterheadUploadDir, { recursive: true });
}

// Configure multer for letterhead image uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, letterheadUploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `letterhead-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
    }
  }
});

// Utility function to convert image file to base64 data URL
function imageToBase64(filePath: string): string | null {
  if (!filePath) return null;

  const fullPath = path.join(letterheadUploadDir, filePath);
  if (!fs.existsSync(fullPath)) return null;

  try {
    const fileBuffer = fs.readFileSync(fullPath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png'
      : ext === '.gif' ? 'image/gif'
      : ext === '.webp' ? 'image/webp'
      : 'image/jpeg';
    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
}

// GET all letterheads
router.get('/', authenticateToken, (_req: Request, res: Response): void => {
  try {
    const letterheads = db.prepare(`
      SELECT l.*, u.name as uploader_name, u.email as uploader_email
      FROM letterheads l
      JOIN users u ON l.uploaded_by = u.id
      WHERE l.isActive = 1
      ORDER BY l.is_default DESC, l.createdAt DESC
    `).all() as LetterheadWithUser[];

    res.json(letterheads.map(l => ({
      ...l,
      isActive: Boolean(l.isActive),
      is_default: Boolean(l.is_default),
    })));
  } catch (error) {
    console.error('Error fetching letterheads:', error);
    res.status(500).json({ error: 'Failed to fetch letterheads' });
  }
});

// GET single letterhead by ID
router.get('/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const letterhead = db.prepare(`
      SELECT l.*, u.name as uploader_name, u.email as uploader_email
      FROM letterheads l
      JOIN users u ON l.uploaded_by = u.id
      WHERE l.id = ? AND l.isActive = 1
    `).get(id) as LetterheadWithUser | undefined;

    if (!letterhead) {
      res.status(404).json({ error: 'Letterhead not found' });
      return;
    }

    res.json({
      ...letterhead,
      isActive: Boolean(letterhead.isActive),
      is_default: Boolean(letterhead.is_default),
    });
  } catch (error) {
    console.error('Error fetching letterhead:', error);
    res.status(500).json({ error: 'Failed to fetch letterhead' });
  }
});

// GET letterhead with images as base64 (for PDF generation)
router.get('/:id/with-images', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const letterhead = db.prepare(`
      SELECT * FROM letterheads WHERE id = ? AND isActive = 1
    `).get(id) as Letterhead | undefined;

    if (!letterhead) {
      res.status(404).json({ error: 'Letterhead not found' });
      return;
    }

    // Convert images to base64 for direct use in PDFs
    res.json({
      ...letterhead,
      isActive: Boolean(letterhead.isActive),
      is_default: Boolean(letterhead.is_default),
      header_image_base64: imageToBase64(letterhead.header_image || ''),
      footer_image_base64: imageToBase64(letterhead.footer_image || ''),
      logo_image_base64: imageToBase64(letterhead.logo_image || ''),
    });
  } catch (error) {
    console.error('Error fetching letterhead with images:', error);
    res.status(500).json({ error: 'Failed to fetch letterhead' });
  }
});

// GET default letterhead
router.get('/default/active', authenticateToken, (_req: Request, res: Response): void => {
  try {
    const letterhead = db.prepare(`
      SELECT * FROM letterheads WHERE is_default = 1 AND isActive = 1
    `).get() as Letterhead | undefined;

    if (!letterhead) {
      res.json(null);
      return;
    }

    res.json({
      ...letterhead,
      isActive: Boolean(letterhead.isActive),
      is_default: Boolean(letterhead.is_default),
      header_image_base64: imageToBase64(letterhead.header_image || ''),
      footer_image_base64: imageToBase64(letterhead.footer_image || ''),
      logo_image_base64: imageToBase64(letterhead.logo_image || ''),
    });
  } catch (error) {
    console.error('Error fetching default letterhead:', error);
    res.status(500).json({ error: 'Failed to fetch default letterhead' });
  }
});

// CREATE letterhead (admin only)
router.post('/', authenticateToken, requireAdmin, upload.fields([
  { name: 'header_image', maxCount: 1 },
  { name: 'footer_image', maxCount: 1 },
  { name: 'logo_image', maxCount: 1 },
]), (req: Request, res: Response): void => {
  try {
    const userId = req.user!.userId;
    const {
      name,
      description,
      company_name,
      company_address,
      company_contact,
      company_email,
      company_website,
      company_cin,
      company_gstin,
      is_default,
    } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const headerImage = files?.header_image?.[0]?.filename || null;
    const footerImage = files?.footer_image?.[0]?.filename || null;
    const logoImage = files?.logo_image?.[0]?.filename || null;

    // If setting as default, unset any existing default
    if (is_default === 'true' || is_default === true) {
      db.prepare(`UPDATE letterheads SET is_default = 0 WHERE is_default = 1`).run();
    }

    const result = db.prepare(`
      INSERT INTO letterheads (
        name, description, header_image, footer_image, logo_image,
        company_name, company_address, company_contact, company_email,
        company_website, company_cin, company_gstin, is_default, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      description || null,
      headerImage,
      footerImage,
      logoImage,
      company_name || null,
      company_address || null,
      company_contact || null,
      company_email || null,
      company_website || null,
      company_cin || null,
      company_gstin || null,
      is_default === 'true' || is_default === true ? 1 : 0,
      userId
    );

    const letterhead = db.prepare(`
      SELECT l.*, u.name as uploader_name, u.email as uploader_email
      FROM letterheads l
      JOIN users u ON l.uploaded_by = u.id
      WHERE l.id = ?
    `).get(result.lastInsertRowid) as LetterheadWithUser;

    res.status(201).json({
      ...letterhead,
      isActive: Boolean(letterhead.isActive),
      is_default: Boolean(letterhead.is_default),
    });
  } catch (error: any) {
    console.error('Error creating letterhead:', error);
    res.status(500).json({ error: 'Failed to create letterhead', details: error.message });
  }
});

// UPDATE letterhead (admin only)
router.put('/:id', authenticateToken, requireAdmin, upload.fields([
  { name: 'header_image', maxCount: 1 },
  { name: 'footer_image', maxCount: 1 },
  { name: 'logo_image', maxCount: 1 },
]), (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      company_name,
      company_address,
      company_contact,
      company_email,
      company_website,
      company_cin,
      company_gstin,
      is_default,
    } = req.body;

    const existing = db.prepare('SELECT * FROM letterheads WHERE id = ? AND isActive = 1').get(id) as Letterhead | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Letterhead not found' });
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const headerImage = files?.header_image?.[0]?.filename || existing.header_image;
    const footerImage = files?.footer_image?.[0]?.filename || existing.footer_image;
    const logoImage = files?.logo_image?.[0]?.filename || existing.logo_image;

    // If setting as default, unset any existing default
    if (is_default === 'true' || is_default === true) {
      db.prepare(`UPDATE letterheads SET is_default = 0 WHERE is_default = 1 AND id != ?`).run(id);
    }

    db.prepare(`
      UPDATE letterheads SET
        name = ?,
        description = ?,
        header_image = ?,
        footer_image = ?,
        logo_image = ?,
        company_name = ?,
        company_address = ?,
        company_contact = ?,
        company_email = ?,
        company_website = ?,
        company_cin = ?,
        company_gstin = ?,
        is_default = ?,
        updatedAt = datetime('now')
      WHERE id = ?
    `).run(
      name || existing.name,
      description !== undefined ? description : existing.description,
      headerImage,
      footerImage,
      logoImage,
      company_name !== undefined ? company_name : existing.company_name,
      company_address !== undefined ? company_address : existing.company_address,
      company_contact !== undefined ? company_contact : existing.company_contact,
      company_email !== undefined ? company_email : existing.company_email,
      company_website !== undefined ? company_website : existing.company_website,
      company_cin !== undefined ? company_cin : existing.company_cin,
      company_gstin !== undefined ? company_gstin : existing.company_gstin,
      is_default === 'true' || is_default === true ? 1 : 0,
      id
    );

    const letterhead = db.prepare(`
      SELECT l.*, u.name as uploader_name, u.email as uploader_email
      FROM letterheads l
      JOIN users u ON l.uploaded_by = u.id
      WHERE l.id = ?
    `).get(id) as LetterheadWithUser;

    res.json({
      ...letterhead,
      isActive: Boolean(letterhead.isActive),
      is_default: Boolean(letterhead.is_default),
    });
  } catch (error: any) {
    console.error('Error updating letterhead:', error);
    res.status(500).json({ error: 'Failed to update letterhead', details: error.message });
  }
});

// DELETE letterhead (admin only) - soft delete
router.delete('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM letterheads WHERE id = ?').get(id) as Letterhead | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Letterhead not found' });
      return;
    }

    db.prepare(`UPDATE letterheads SET isActive = 0, updatedAt = datetime('now') WHERE id = ?`).run(id);

    res.json({ message: 'Letterhead deleted successfully' });
  } catch (error) {
    console.error('Error deleting letterhead:', error);
    res.status(500).json({ error: 'Failed to delete letterhead' });
  }
});

// SET as default letterhead (admin only)
router.post('/:id/set-default', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM letterheads WHERE id = ? AND isActive = 1').get(id) as Letterhead | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Letterhead not found' });
      return;
    }

    // Unset all defaults
    db.prepare(`UPDATE letterheads SET is_default = 0`).run();

    // Set this one as default
    db.prepare(`UPDATE letterheads SET is_default = 1, updatedAt = datetime('now') WHERE id = ?`).run(id);

    res.json({ message: 'Letterhead set as default successfully' });
  } catch (error) {
    console.error('Error setting default letterhead:', error);
    res.status(500).json({ error: 'Failed to set default letterhead' });
  }
});

export default router;
