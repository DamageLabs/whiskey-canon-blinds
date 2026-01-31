import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, schema } from '../db/index.js';
import { eq, desc } from 'drizzle-orm';
import { AuthRequest, authenticateUser } from '../middleware/auth.js';
import { validateLength, INPUT_LIMITS } from '../utils/validation.js';
import { logger } from '../utils/logger.js';

const router = Router();

// All template routes require authentication
router.use(authenticateUser);

// Get all templates for the current user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const templates = await db.query.sessionTemplates.findMany({
      where: eq(schema.sessionTemplates.userId, req.userId!),
      orderBy: [desc(schema.sessionTemplates.updatedAt)],
    });

    // Parse whiskeys JSON for each template
    const parsedTemplates = templates.map((t) => ({
      ...t,
      whiskeys: JSON.parse(t.whiskeys),
    }));

    return res.json(parsedTemplates);
  } catch (error) {
    logger.error('Get templates error:', error);
    return res.status(500).json({ error: 'Failed to get templates' });
  }
});

// Get a single template by ID
router.get('/:templateId', async (req: AuthRequest, res: Response) => {
  try {
    const templateId = req.params.templateId as string;

    const template = await db.query.sessionTemplates.findFirst({
      where: eq(schema.sessionTemplates.id, templateId),
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Only allow owner to view their templates
    if (template.userId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json({
      ...template,
      whiskeys: JSON.parse(template.whiskeys),
    });
  } catch (error) {
    logger.error('Get template error:', error);
    return res.status(500).json({ error: 'Failed to get template' });
  }
});

// Create a new template
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, theme, customTheme, proofMin, proofMax, maxParticipants, whiskeys } = req.body;

    if (!name || !theme) {
      return res.status(400).json({ error: 'Name and theme are required' });
    }

    // Validate name length
    const nameLengthCheck = validateLength(name, INPUT_LIMITS.SESSION_NAME, 'Template name');
    if (!nameLengthCheck.valid) {
      return res.status(400).json({ error: nameLengthCheck.error });
    }

    if (!whiskeys || !Array.isArray(whiskeys) || whiskeys.length === 0) {
      return res.status(400).json({ error: 'At least one whiskey is required' });
    }

    if (whiskeys.length > 6) {
      return res.status(400).json({ error: 'Maximum 6 whiskeys allowed' });
    }

    const templateId = uuidv4();
    const now = new Date();

    await db.insert(schema.sessionTemplates).values({
      id: templateId,
      userId: req.userId!,
      name,
      theme,
      customTheme,
      proofMin,
      proofMax,
      maxParticipants,
      whiskeys: JSON.stringify(whiskeys),
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return res.status(201).json({
      id: templateId,
      name,
      theme,
      customTheme,
      proofMin,
      proofMax,
      maxParticipants,
      whiskeys,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    logger.error('Create template error:', error);
    return res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update a template
router.put('/:templateId', async (req: AuthRequest, res: Response) => {
  try {
    const templateId = req.params.templateId as string;
    const { name, theme, customTheme, proofMin, proofMax, maxParticipants, whiskeys } = req.body;

    const template = await db.query.sessionTemplates.findFirst({
      where: eq(schema.sessionTemplates.id, templateId),
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate name if provided
    if (name) {
      const nameLengthCheck = validateLength(name, INPUT_LIMITS.SESSION_NAME, 'Template name');
      if (!nameLengthCheck.valid) {
        return res.status(400).json({ error: nameLengthCheck.error });
      }
    }

    if (whiskeys && whiskeys.length > 6) {
      return res.status(400).json({ error: 'Maximum 6 whiskeys allowed' });
    }

    const now = new Date();
    const updates: Partial<schema.SessionTemplate> = { updatedAt: now };

    if (name !== undefined) updates.name = name;
    if (theme !== undefined) updates.theme = theme;
    if (customTheme !== undefined) updates.customTheme = customTheme;
    if (proofMin !== undefined) updates.proofMin = proofMin;
    if (proofMax !== undefined) updates.proofMax = proofMax;
    if (maxParticipants !== undefined) updates.maxParticipants = maxParticipants;
    if (whiskeys !== undefined) updates.whiskeys = JSON.stringify(whiskeys);

    await db.update(schema.sessionTemplates)
      .set(updates)
      .where(eq(schema.sessionTemplates.id, templateId));

    const updatedTemplate = await db.query.sessionTemplates.findFirst({
      where: eq(schema.sessionTemplates.id, templateId),
    });

    return res.json({
      ...updatedTemplate,
      whiskeys: JSON.parse(updatedTemplate!.whiskeys),
    });
  } catch (error) {
    logger.error('Update template error:', error);
    return res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete a template
router.delete('/:templateId', async (req: AuthRequest, res: Response) => {
  try {
    const templateId = req.params.templateId as string;

    const template = await db.query.sessionTemplates.findFirst({
      where: eq(schema.sessionTemplates.id, templateId),
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.delete(schema.sessionTemplates)
      .where(eq(schema.sessionTemplates.id, templateId));

    return res.json({ message: 'Template deleted' });
  } catch (error) {
    logger.error('Delete template error:', error);
    return res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Increment usage count (called when a session is created from a template)
router.post('/:templateId/use', async (req: AuthRequest, res: Response) => {
  try {
    const templateId = req.params.templateId as string;

    const template = await db.query.sessionTemplates.findFirst({
      where: eq(schema.sessionTemplates.id, templateId),
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.update(schema.sessionTemplates)
      .set({
        usageCount: template.usageCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.sessionTemplates.id, templateId));

    return res.json({ message: 'Usage count incremented' });
  } catch (error) {
    logger.error('Increment template usage error:', error);
    return res.status(500).json({ error: 'Failed to increment usage count' });
  }
});

export default router;
