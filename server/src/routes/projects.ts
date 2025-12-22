import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import type { Project, ProjectWithDetails, CreateProjectInput, UpdateProjectInput } from '../types';

const router = Router();

// Get all projects
router.get('/', authenticateToken, (_req: Request, res: Response): void => {
  try {
    const projects = db.prepare(`
      SELECT
        p.*,
        b.branch_name,
        c.name as company_name,
        u.name as assigned_to_name
      FROM projects p
      JOIN branches b ON p.branch_id = b.id
      JOIN companies c ON b.company_id = c.id
      LEFT JOIN users u ON p.assigned_to = u.id
      ORDER BY p.createdAt DESC
    `).all() as ProjectWithDetails[];

    res.json(projects.map(p => ({
      ...p,
      isActive: Boolean(p.isActive)
    })));
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
router.get('/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const project = db.prepare(`
      SELECT
        p.*,
        b.branch_name,
        c.name as company_name,
        u.name as assigned_to_name
      FROM projects p
      JOIN branches b ON p.branch_id = b.id
      JOIN companies c ON b.company_id = c.id
      LEFT JOIN users u ON p.assigned_to = u.id
      WHERE p.id = ?
    `).get(id) as ProjectWithDetails | undefined;

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({
      ...project,
      isActive: Boolean(project.isActive)
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create project (admin only)
router.post('/', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { name, branch_id, assigned_to, start_date, end_date }: CreateProjectInput = req.body;

    if (!name || !branch_id) {
      res.status(400).json({ error: 'Name and branch are required' });
      return;
    }

    // Verify branch exists
    const branch = db.prepare('SELECT id FROM branches WHERE id = ?').get(branch_id);
    if (!branch) {
      res.status(404).json({ error: 'Branch not found' });
      return;
    }

    const result = db.prepare(`
      INSERT INTO projects (name, branch_id, assigned_to, start_date, end_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, branch_id, assigned_to || null, start_date || null, end_date || null);

    const newProject = db.prepare(`
      SELECT
        p.*,
        b.branch_name,
        c.name as company_name,
        u.name as assigned_to_name
      FROM projects p
      JOIN branches b ON p.branch_id = b.id
      JOIN companies c ON b.company_id = c.id
      LEFT JOIN users u ON p.assigned_to = u.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid) as ProjectWithDetails;

    res.status(201).json({
      ...newProject,
      isActive: Boolean(newProject.isActive)
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Bulk create projects (for upload)
router.post('/bulk', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { projects }: { projects: CreateProjectInput[] } = req.body;

    if (!projects || !Array.isArray(projects) || projects.length === 0) {
      res.status(400).json({ error: 'Projects array is required' });
      return;
    }

    const insertStmt = db.prepare(`
      INSERT INTO projects (name, branch_id, assigned_to, start_date, end_date)
      VALUES (?, ?, ?, ?, ?)
    `);

    let successCount = 0;
    const errors: string[] = [];

    for (const project of projects) {
      try {
        if (!project.name || !project.branch_id) {
          errors.push(`Missing name or branch for project: ${project.name || 'unnamed'}`);
          continue;
        }
        insertStmt.run(
          project.name,
          project.branch_id,
          project.assigned_to || null,
          project.start_date || null,
          project.end_date || null
        );
        successCount++;
      } catch (err) {
        errors.push(`Failed to insert: ${project.name}`);
      }
    }

    res.json({
      message: `Successfully imported ${successCount} projects`,
      successCount,
      errorCount: errors.length,
      errors: errors.slice(0, 10) // Return first 10 errors
    });
  } catch (error) {
    console.error('Error bulk creating projects:', error);
    res.status(500).json({ error: 'Failed to import projects' });
  }
});

// Update project (admin only)
router.put('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const updates: UpdateProjectInput = req.body;

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.branch_id !== undefined) {
      fields.push('branch_id = ?');
      values.push(updates.branch_id);
    }
    if (updates.assigned_to !== undefined) {
      fields.push('assigned_to = ?');
      values.push(updates.assigned_to || null);
    }
    if (updates.start_date !== undefined) {
      fields.push('start_date = ?');
      values.push(updates.start_date || null);
    }
    if (updates.end_date !== undefined) {
      fields.push('end_date = ?');
      values.push(updates.end_date || null);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
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

    db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updatedProject = db.prepare(`
      SELECT
        p.*,
        b.branch_name,
        c.name as company_name,
        u.name as assigned_to_name
      FROM projects p
      JOIN branches b ON p.branch_id = b.id
      JOIN companies c ON b.company_id = c.id
      LEFT JOIN users u ON p.assigned_to = u.id
      WHERE p.id = ?
    `).get(id) as ProjectWithDetails;

    res.json({
      ...updatedProject,
      isActive: Boolean(updatedProject.isActive)
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project (admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    db.prepare('DELETE FROM projects WHERE id = ?').run(id);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
