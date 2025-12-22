import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import type {
  EmailTemplate,
  EmailTemplateWithCreator,
  CreateEmailTemplateInput,
  UpdateEmailTemplateInput,
  EmailType
} from '../types';

const router = Router();
router.use(authenticateToken);

// List all email templates
router.get('/', (req: Request, res: Response): void => {
  try {
    const { email_type, is_default } = req.query;

    let query = `
      SELECT et.*, u.name as creator_name, u.email as creator_email
      FROM email_templates et
      JOIN users u ON et.created_by = u.id
      WHERE et.isActive = 1
    `;

    const params: any[] = [];

    if (email_type) {
      query += ' AND et.email_type = ?';
      params.push(email_type);
    }

    if (is_default !== undefined) {
      query += ' AND et.is_default = ?';
      params.push(is_default === 'true' ? 1 : 0);
    }

    query += ' ORDER BY et.email_type, et.is_default DESC, et.name';

    const templates = db.prepare(query).all(...params) as EmailTemplateWithCreator[];

    res.json(templates.map(t => ({
      ...t,
      is_default: Boolean(t.is_default),
      isActive: Boolean(t.isActive),
      variables: t.variables ? JSON.parse(t.variables) : []
    })));
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get single template
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const template = db.prepare(`
      SELECT et.*, u.name as creator_name, u.email as creator_email
      FROM email_templates et
      JOIN users u ON et.created_by = u.id
      WHERE et.id = ?
    `).get(id) as EmailTemplateWithCreator | undefined;

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    res.json({
      ...template,
      is_default: Boolean(template.is_default),
      isActive: Boolean(template.isActive),
      variables: template.variables ? JSON.parse(template.variables) : []
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create template
router.post('/', requireAdmin, (req: Request, res: Response): void => {
  try {
    const {
      name,
      email_type,
      subject_template,
      body_template,
      variables,
      is_default
    } = req.body as CreateEmailTemplateInput;
    const userId = req.user!.userId;

    if (!name || !email_type || !subject_template || !body_template) {
      res.status(400).json({ error: 'name, email_type, subject_template, and body_template are required' });
      return;
    }

    // If setting as default, unset other defaults for this type
    if (is_default) {
      db.prepare(`
        UPDATE email_templates SET is_default = 0 WHERE email_type = ?
      `).run(email_type);
    }

    const result = db.prepare(`
      INSERT INTO email_templates (name, email_type, subject_template, body_template, variables, is_default, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      email_type,
      subject_template,
      body_template,
      variables ? JSON.stringify(variables) : null,
      is_default ? 1 : 0,
      userId
    );

    const template = db.prepare(`
      SELECT et.*, u.name as creator_name, u.email as creator_email
      FROM email_templates et
      JOIN users u ON et.created_by = u.id
      WHERE et.id = ?
    `).get(result.lastInsertRowid) as EmailTemplateWithCreator;

    res.status(201).json({
      ...template,
      is_default: Boolean(template.is_default),
      isActive: Boolean(template.isActive),
      variables: template.variables ? JSON.parse(template.variables) : []
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update template
router.put('/:id', requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const updates = req.body as UpdateEmailTemplateInput;

    const existing = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(id) as EmailTemplate | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // If setting as default, unset other defaults for this type
    if (updates.is_default) {
      db.prepare(`
        UPDATE email_templates SET is_default = 0 WHERE email_type = ? AND id != ?
      `).run(existing.email_type, id);
    }

    // Build dynamic update
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.email_type !== undefined) {
      fields.push('email_type = ?');
      values.push(updates.email_type);
    }
    if (updates.subject_template !== undefined) {
      fields.push('subject_template = ?');
      values.push(updates.subject_template);
    }
    if (updates.body_template !== undefined) {
      fields.push('body_template = ?');
      values.push(updates.body_template);
    }
    if (updates.variables !== undefined) {
      fields.push('variables = ?');
      values.push(JSON.stringify(updates.variables));
    }
    if (updates.is_default !== undefined) {
      fields.push('is_default = ?');
      values.push(updates.is_default ? 1 : 0);
    }
    if (updates.isActive !== undefined) {
      fields.push('isActive = ?');
      values.push(updates.isActive ? 1 : 0);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    fields.push("updatedAt = datetime('now')");
    values.push(id);

    db.prepare(`
      UPDATE email_templates SET ${fields.join(', ')} WHERE id = ?
    `).run(...values);

    const template = db.prepare(`
      SELECT et.*, u.name as creator_name, u.email as creator_email
      FROM email_templates et
      JOIN users u ON et.created_by = u.id
      WHERE et.id = ?
    `).get(id) as EmailTemplateWithCreator;

    res.json({
      ...template,
      is_default: Boolean(template.is_default),
      isActive: Boolean(template.isActive),
      variables: template.variables ? JSON.parse(template.variables) : []
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete template
router.delete('/:id', requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(id) as EmailTemplate | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // Soft delete
    db.prepare(`
      UPDATE email_templates SET isActive = 0, updatedAt = datetime('now') WHERE id = ?
    `).run(id);

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Preview template with variables
router.post('/:id/preview', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { variables } = req.body as { variables: Record<string, string> };

    const template = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(id) as EmailTemplate | undefined;

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    let subject = template.subject_template;
    let body = template.body_template;

    // Replace variables
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, value);
        body = body.replace(regex, value);
      }
    }

    // Handle conditional blocks (simple implementation)
    body = body.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, variable, content) => {
      return variables && variables[variable] ? content : '';
    });

    res.json({
      subject,
      body,
      variables_used: Object.keys(variables || {}),
      missing_variables: extractVariables(template.body_template).filter(v => !variables || !variables[v])
    });
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({ error: 'Failed to preview template' });
  }
});

// Get default template for email type
router.get('/default/:type', (req: Request, res: Response): void => {
  try {
    const { type } = req.params;

    const template = db.prepare(`
      SELECT et.*, u.name as creator_name, u.email as creator_email
      FROM email_templates et
      JOIN users u ON et.created_by = u.id
      WHERE et.email_type = ? AND et.is_default = 1 AND et.isActive = 1
    `).get(type) as EmailTemplateWithCreator | undefined;

    if (!template) {
      res.status(404).json({ error: `No default template found for type: ${type}` });
      return;
    }

    res.json({
      ...template,
      is_default: Boolean(template.is_default),
      isActive: Boolean(template.isActive),
      variables: template.variables ? JSON.parse(template.variables) : []
    });
  } catch (error) {
    console.error('Error fetching default template:', error);
    res.status(500).json({ error: 'Failed to fetch default template' });
  }
});

// Helper function to extract variables from template
function extractVariables(template: string): string[] {
  const regex = /{{(\w+)}}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  return variables;
}

export default router;
