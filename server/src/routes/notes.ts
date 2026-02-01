import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { eq, and, sql, like, desc, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/notes - List user's notes with filters
router.get('/', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const search = req.query.search as string;
    const category = req.query.category as string;
    const tag = req.query.tag as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(schema.tastingNotesLibrary.userId, userId)];

    if (search) {
      const searchCondition = or(
        like(schema.tastingNotesLibrary.whiskeyName, `%${search}%`),
        like(schema.tastingNotesLibrary.distillery, `%${search}%`),
        like(schema.tastingNotesLibrary.noseNotes, `%${search}%`),
        like(schema.tastingNotesLibrary.palateNotes, `%${search}%`),
        like(schema.tastingNotesLibrary.finishNotes, `%${search}%`),
        like(schema.tastingNotesLibrary.generalNotes, `%${search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (category) {
      conditions.push(eq(schema.tastingNotesLibrary.category, category));
    }

    // If tag filter, we need to join with tags table

    if (tag) {
      const noteIdsWithTag = await db.select({ noteId: schema.tastingNoteTags.noteId })
        .from(schema.tastingNoteTags)
        .where(eq(schema.tastingNoteTags.tag, tag));

      const noteIds = noteIdsWithTag.map(n => n.noteId);
      if (noteIds.length === 0) {
        return res.json({
          notes: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      }

      conditions.push(sql`${schema.tastingNotesLibrary.id} IN (${sql.join(noteIds.map(id => sql`${id}`), sql`, `)})`);
    }

    const notes = await db.query.tastingNotesLibrary.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.tastingNotesLibrary.updatedAt)],
      limit,
      offset,
    });

    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(schema.tastingNotesLibrary)
      .where(and(...conditions));

    const total = totalResult[0]?.count || 0;

    // Get tags for each note
    const notesWithTags = await Promise.all(
      notes.map(async (note) => {
        const tags = await db.query.tastingNoteTags.findMany({
          where: eq(schema.tastingNoteTags.noteId, note.id),
        });
        return {
          ...note,
          tags: tags.map(t => t.tag),
        };
      })
    );

    res.json({
      notes: notesWithTags,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// GET /api/notes/tags - Get user's tag cloud
router.get('/tags', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const tags = await db.select({
      tag: schema.tastingNoteTags.tag,
      count: sql<number>`count(*)`,
    })
      .from(schema.tastingNoteTags)
      .innerJoin(schema.tastingNotesLibrary, eq(schema.tastingNoteTags.noteId, schema.tastingNotesLibrary.id))
      .where(eq(schema.tastingNotesLibrary.userId, userId))
      .groupBy(schema.tastingNoteTags.tag)
      .orderBy(desc(sql`count(*)`));

    res.json({ tags });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// GET /api/notes/:id - Get single note
router.get('/:id', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const noteId = req.params.id as string;
    const note = await db.query.tastingNotesLibrary.findFirst({
      where: and(
        eq(schema.tastingNotesLibrary.id, noteId),
        eq(schema.tastingNotesLibrary.userId, userId)
      ),
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const tags = await db.query.tastingNoteTags.findMany({
      where: eq(schema.tastingNoteTags.noteId, note.id),
    });

    res.json({
      ...note,
      tags: tags.map(t => t.tag),
    });
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

// POST /api/notes - Create note
router.post('/', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      whiskeyName,
      distillery,
      category,
      age,
      proof,
      noseNotes,
      palateNotes,
      finishNotes,
      generalNotes,
      rating,
      isPublic,
      tags,
    } = req.body;

    if (!whiskeyName) {
      return res.status(400).json({ error: 'Whiskey name is required' });
    }

    const now = new Date();
    const noteId = uuidv4();

    await db.insert(schema.tastingNotesLibrary).values({
      id: noteId,
      userId,
      whiskeyName,
      distillery,
      category,
      age,
      proof,
      noseNotes,
      palateNotes,
      finishNotes,
      generalNotes,
      rating,
      isPublic: isPublic || false,
      tags: tags ? JSON.stringify(tags) : null,
      createdAt: now,
      updatedAt: now,
    });

    // Add tags
    if (tags && Array.isArray(tags)) {
      for (const tag of tags) {
        await db.insert(schema.tastingNoteTags).values({
          id: uuidv4(),
          noteId,
          tag,
          createdAt: now,
        });
      }
    }

    const note = await db.query.tastingNotesLibrary.findFirst({
      where: eq(schema.tastingNotesLibrary.id, noteId),
    });

    res.status(201).json({
      ...note,
      tags: tags || [],
    });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// POST /api/notes/import/:scoreId - Import from session score
router.post('/import/:scoreId', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const scoreId = req.params.scoreId as string;

    // Get the score
    const score = await db.query.scores.findFirst({
      where: eq(schema.scores.id, scoreId),
    });

    if (!score) {
      return res.status(404).json({ error: 'Score not found' });
    }

    // Get the whiskey
    const whiskey = await db.query.whiskeys.findFirst({
      where: eq(schema.whiskeys.id, score.whiskeyId),
    });

    if (!whiskey) {
      return res.status(404).json({ error: 'Whiskey not found' });
    }

    // Get the participant to verify ownership
    const participant = await db.query.participants.findFirst({
      where: eq(schema.participants.id, score.participantId),
    });

    if (!participant || participant.userId !== userId) {
      return res.status(403).json({ error: 'You can only import your own scores' });
    }

    // Check if already imported
    const existing = await db.query.tastingNotesLibrary.findFirst({
      where: eq(schema.tastingNotesLibrary.sourceScoreId, score.id),
    });

    if (existing) {
      return res.status(400).json({ error: 'This score has already been imported' });
    }

    const now = new Date();
    const noteId = uuidv4();

    await db.insert(schema.tastingNotesLibrary).values({
      id: noteId,
      userId,
      whiskeyName: whiskey.name,
      distillery: whiskey.distillery,
      category: null,
      age: whiskey.age,
      proof: whiskey.proof,
      noseNotes: score.noseNotes,
      palateNotes: score.palateNotes,
      finishNotes: score.finishNotes,
      generalNotes: score.generalNotes,
      rating: score.totalScore,
      sourceScoreId: score.id,
      sourceSessionId: score.sessionId,
      isPublic: score.isPublic,
      createdAt: now,
      updatedAt: now,
    });

    const note = await db.query.tastingNotesLibrary.findFirst({
      where: eq(schema.tastingNotesLibrary.id, noteId),
    });

    res.status(201).json({
      ...note,
      tags: [],
    });
  } catch (error) {
    console.error('Error importing score:', error);
    res.status(500).json({ error: 'Failed to import score' });
  }
});

// PUT /api/notes/:id - Update note
router.put('/:id', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const noteId = req.params.id as string;

    const note = await db.query.tastingNotesLibrary.findFirst({
      where: and(
        eq(schema.tastingNotesLibrary.id, noteId),
        eq(schema.tastingNotesLibrary.userId, userId)
      ),
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const {
      whiskeyName,
      distillery,
      category,
      age,
      proof,
      noseNotes,
      palateNotes,
      finishNotes,
      generalNotes,
      rating,
      isPublic,
      tags,
    } = req.body;

    await db.update(schema.tastingNotesLibrary)
      .set({
        whiskeyName: whiskeyName ?? note.whiskeyName,
        distillery: distillery ?? note.distillery,
        category: category ?? note.category,
        age: age ?? note.age,
        proof: proof ?? note.proof,
        noseNotes: noseNotes ?? note.noseNotes,
        palateNotes: palateNotes ?? note.palateNotes,
        finishNotes: finishNotes ?? note.finishNotes,
        generalNotes: generalNotes ?? note.generalNotes,
        rating: rating ?? note.rating,
        isPublic: isPublic ?? note.isPublic,
        tags: tags ? JSON.stringify(tags) : note.tags,
        updatedAt: new Date(),
      })
      .where(eq(schema.tastingNotesLibrary.id, noteId));

    // Update tags if provided
    if (tags && Array.isArray(tags)) {
      // Delete existing tags
      await db.delete(schema.tastingNoteTags)
        .where(eq(schema.tastingNoteTags.noteId, note.id));

      // Add new tags
      const now = new Date();
      for (const tag of tags) {
        await db.insert(schema.tastingNoteTags).values({
          id: uuidv4(),
          noteId: note.id,
          tag,
          createdAt: now,
        });
      }
    }

    const updatedNote = await db.query.tastingNotesLibrary.findFirst({
      where: eq(schema.tastingNotesLibrary.id, noteId),
    });

    const updatedTags = await db.query.tastingNoteTags.findMany({
      where: eq(schema.tastingNoteTags.noteId, note.id),
    });

    res.json({
      ...updatedNote,
      tags: updatedTags.map(t => t.tag),
    });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// DELETE /api/notes/:id - Delete note
router.delete('/:id', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const noteId = req.params.id as string;

    const note = await db.query.tastingNotesLibrary.findFirst({
      where: and(
        eq(schema.tastingNotesLibrary.id, noteId),
        eq(schema.tastingNotesLibrary.userId, userId)
      ),
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Delete tags first (cascade should handle this, but be explicit)
    await db.delete(schema.tastingNoteTags)
      .where(eq(schema.tastingNoteTags.noteId, note.id));

    await db.delete(schema.tastingNotesLibrary)
      .where(eq(schema.tastingNotesLibrary.id, noteId));

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;
