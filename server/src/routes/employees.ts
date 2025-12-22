import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import type { Employee, EmployeeWithBranch, CreateEmployeeInput, UpdateEmployeeInput } from '../types';

const router = Router();

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'employees');

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
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept images and PDFs
    if (file.fieldname === 'image') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for image field'));
      }
    } else if (file.fieldname === 'document') {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only PDF and image files are allowed for document field'));
      }
    } else {
      cb(null, true);
    }
  }
});

// Get all employees
router.get('/', authenticateToken, (_req: Request, res: Response): void => {
  try {
    const employees = db.prepare(`
      SELECT
        e.*,
        b.branch_name,
        c.name as company_name
      FROM employees e
      JOIN branches b ON e.branch_id = b.id
      JOIN companies c ON b.company_id = c.id
      ORDER BY e.employee_name ASC
    `).all() as EmployeeWithBranch[];

    res.json(employees.map(e => ({
      ...e,
      isActive: Boolean(e.isActive)
    })));
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get single employee
router.get('/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const employee = db.prepare(`
      SELECT
        e.*,
        b.branch_name,
        c.name as company_name
      FROM employees e
      JOIN branches b ON e.branch_id = b.id
      JOIN companies c ON b.company_id = c.id
      WHERE e.id = ?
    `).get(id) as EmployeeWithBranch | undefined;

    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    res.json({
      ...employee,
      isActive: Boolean(employee.isActive)
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// Create employee (admin only)
router.post('/', authenticateToken, requireAdmin, upload.fields([
  { name: 'document', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]), (req: Request, res: Response): void => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const input: CreateEmployeeInput = req.body;

    // Parse numeric fields
    if (input.monthly_rent) {
      input.monthly_rent = Number(input.monthly_rent);
    }
    if (input.monthly_ctc) {
      input.monthly_ctc = Number(input.monthly_ctc);
    }

    if (!input.employee_name || !input.father_name || !input.branch_id ||
        !input.date_of_joining || !input.date_of_birth || !input.designation ||
        !input.mobile_number || !input.email) {
      res.status(400).json({ error: 'Required fields are missing' });
      return;
    }

    // Verify branch exists
    const branch = db.prepare('SELECT id FROM branches WHERE id = ?').get(input.branch_id);
    if (!branch) {
      res.status(404).json({ error: 'Branch not found' });
      return;
    }

    // Handle file uploads
    const documentPath = files?.document?.[0]?.filename || null;
    const imagePath = files?.image?.[0]?.filename || null;

    const result = db.prepare(`
      INSERT INTO employees (
        branch_id, employee_name, father_name, date_of_joining, date_of_birth,
        designation, mobile_number, email, personal_email, aadhar_no, pan_no,
        address, city_type, event, event_date, monthly_rent, monthly_ctc,
        document_path, image_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.branch_id,
      input.employee_name,
      input.father_name,
      input.date_of_joining,
      input.date_of_birth,
      input.designation,
      input.mobile_number,
      input.email,
      input.personal_email || null,
      input.aadhar_no || null,
      input.pan_no || null,
      input.address || null,
      input.city_type || null,
      input.event || null,
      input.event_date || null,
      input.monthly_rent || null,
      input.monthly_ctc || null,
      documentPath,
      imagePath
    );

    const newEmployee = db.prepare(`
      SELECT
        e.*,
        b.branch_name,
        c.name as company_name
      FROM employees e
      JOIN branches b ON e.branch_id = b.id
      JOIN companies c ON b.company_id = c.id
      WHERE e.id = ?
    `).get(result.lastInsertRowid) as EmployeeWithBranch;

    res.status(201).json({
      ...newEmployee,
      isActive: Boolean(newEmployee.isActive)
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// Update employee (admin only)
router.put('/:id', authenticateToken, requireAdmin, upload.fields([
  { name: 'document', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]), (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const updates: UpdateEmployeeInput = req.body;

    // Parse numeric fields
    if (updates.monthly_rent) {
      updates.monthly_rent = Number(updates.monthly_rent);
    }
    if (updates.monthly_ctc) {
      updates.monthly_ctc = Number(updates.monthly_ctc);
    }

    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as Employee | undefined;
    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    // Handle all updateable fields
    if (updates.branch_id !== undefined) {
      fields.push('branch_id = ?');
      values.push(updates.branch_id);
    }
    if (updates.employee_name !== undefined) {
      fields.push('employee_name = ?');
      values.push(updates.employee_name);
    }
    if (updates.father_name !== undefined) {
      fields.push('father_name = ?');
      values.push(updates.father_name);
    }
    if (updates.date_of_joining !== undefined) {
      fields.push('date_of_joining = ?');
      values.push(updates.date_of_joining);
    }
    if (updates.date_of_birth !== undefined) {
      fields.push('date_of_birth = ?');
      values.push(updates.date_of_birth);
    }
    if (updates.designation !== undefined) {
      fields.push('designation = ?');
      values.push(updates.designation);
    }
    if (updates.mobile_number !== undefined) {
      fields.push('mobile_number = ?');
      values.push(updates.mobile_number);
    }
    if (updates.email !== undefined) {
      fields.push('email = ?');
      values.push(updates.email);
    }
    if (updates.personal_email !== undefined) {
      fields.push('personal_email = ?');
      values.push(updates.personal_email || null);
    }
    if (updates.aadhar_no !== undefined) {
      fields.push('aadhar_no = ?');
      values.push(updates.aadhar_no || null);
    }
    if (updates.pan_no !== undefined) {
      fields.push('pan_no = ?');
      values.push(updates.pan_no || null);
    }
    if (updates.address !== undefined) {
      fields.push('address = ?');
      values.push(updates.address || null);
    }
    if (updates.city_type !== undefined) {
      fields.push('city_type = ?');
      values.push(updates.city_type || null);
    }
    if (updates.event !== undefined) {
      fields.push('event = ?');
      values.push(updates.event || null);
    }
    if (updates.event_date !== undefined) {
      fields.push('event_date = ?');
      values.push(updates.event_date || null);
    }
    if (updates.monthly_rent !== undefined) {
      fields.push('monthly_rent = ?');
      values.push(updates.monthly_rent || null);
    }
    if (updates.monthly_ctc !== undefined) {
      fields.push('monthly_ctc = ?');
      values.push(updates.monthly_ctc || null);
    }
    if (updates.isActive !== undefined) {
      fields.push('isActive = ?');
      values.push(updates.isActive ? 1 : 0);
    }

    // Handle file uploads
    if (files?.document?.[0]) {
      // Delete old document if exists
      if (employee.document_path) {
        const oldDocPath = path.join(uploadDir, employee.document_path);
        if (fs.existsSync(oldDocPath)) {
          fs.unlinkSync(oldDocPath);
        }
      }
      fields.push('document_path = ?');
      values.push(files.document[0].filename);
    }

    if (files?.image?.[0]) {
      // Delete old image if exists
      if (employee.image_path) {
        const oldImgPath = path.join(uploadDir, employee.image_path);
        if (fs.existsSync(oldImgPath)) {
          fs.unlinkSync(oldImgPath);
        }
      }
      fields.push('image_path = ?');
      values.push(files.image[0].filename);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    fields.push("updatedAt = datetime('now')");
    values.push(Number(id));

    db.prepare(`UPDATE employees SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updatedEmployee = db.prepare(`
      SELECT
        e.*,
        b.branch_name,
        c.name as company_name
      FROM employees e
      JOIN branches b ON e.branch_id = b.id
      JOIN companies c ON b.company_id = c.id
      WHERE e.id = ?
    `).get(id) as EmployeeWithBranch;

    res.json({
      ...updatedEmployee,
      isActive: Boolean(updatedEmployee.isActive)
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// Delete employee (admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as Employee | undefined;
    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    // Delete associated files
    if (employee.document_path) {
      const docPath = path.join(uploadDir, employee.document_path);
      if (fs.existsSync(docPath)) {
        fs.unlinkSync(docPath);
      }
    }

    if (employee.image_path) {
      const imgPath = path.join(uploadDir, employee.image_path);
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    }

    db.prepare('DELETE FROM employees WHERE id = ?').run(id);

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

// Serve uploaded files
router.get('/files/:filename', authenticateToken, (req: Request, res: Response): void => {
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
