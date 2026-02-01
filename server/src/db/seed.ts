import { db, schema, initializeDatabase } from './index.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// Helper to hash passwords
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Helper to generate random date within range
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper to pick random item from array
function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper to generate invite code
function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function seed() {
  console.log('Initializing database tables...');
  initializeDatabase();

  console.log('Starting database seed...');
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ============================================
  // USERS
  // ============================================
  console.log('Creating users...');
  const passwordHash = await hashPassword('password123');

  const usersData = [
    {
      id: uuidv4(),
      email: 'admin@example.com',
      passwordHash,
      displayName: 'Admin User',
      bio: 'Platform administrator and whiskey enthusiast',
      favoriteCategory: 'bourbon',
      experienceLevel: 'expert',
      role: 'admin',
      isProfilePublic: true,
      emailVerified: true,
    },
    {
      id: uuidv4(),
      email: 'john@example.com',
      passwordHash,
      displayName: 'John Bourbon',
      bio: 'Kentucky bourbon lover. Nothing beats a good wheated bourbon.',
      favoriteCategory: 'bourbon',
      experienceLevel: 'advanced',
      role: 'user',
      isProfilePublic: true,
      emailVerified: true,
    },
    {
      id: uuidv4(),
      email: 'sarah@example.com',
      passwordHash,
      displayName: 'Sarah Scotch',
      bio: 'Islay enthusiast. The peatier, the better!',
      favoriteCategory: 'scotch',
      experienceLevel: 'expert',
      role: 'user',
      isProfilePublic: true,
      emailVerified: true,
    },
    {
      id: uuidv4(),
      email: 'mike@example.com',
      passwordHash,
      displayName: 'Mike Rye',
      bio: 'Rye whiskey connoisseur. Love that spicy kick.',
      favoriteCategory: 'rye',
      experienceLevel: 'intermediate',
      role: 'user',
      isProfilePublic: true,
      emailVerified: true,
    },
    {
      id: uuidv4(),
      email: 'emma@example.com',
      passwordHash,
      displayName: 'Emma Explorer',
      bio: 'New to whiskey, excited to learn!',
      favoriteCategory: 'irish',
      experienceLevel: 'beginner',
      role: 'user',
      isProfilePublic: true,
      emailVerified: true,
    },
    {
      id: uuidv4(),
      email: 'david@example.com',
      passwordHash,
      displayName: 'David Dram',
      bio: 'Japanese whisky aficionado. Precision and balance.',
      favoriteCategory: 'japanese',
      experienceLevel: 'advanced',
      role: 'user',
      isProfilePublic: true,
      emailVerified: true,
    },
    {
      id: uuidv4(),
      email: 'lisa@example.com',
      passwordHash,
      displayName: 'Lisa Lowland',
      bio: 'Speyside lover. Smooth and fruity is my style.',
      favoriteCategory: 'scotch',
      experienceLevel: 'intermediate',
      role: 'user',
      isProfilePublic: true,
      emailVerified: true,
    },
    {
      id: uuidv4(),
      email: 'tom@example.com',
      passwordHash,
      displayName: 'Tom Taster',
      bio: 'Blind tasting champion. Trust your palate!',
      favoriteCategory: 'bourbon',
      experienceLevel: 'expert',
      role: 'user',
      isProfilePublic: true,
      emailVerified: true,
    },
  ];

  for (const user of usersData) {
    await db.insert(schema.users).values({
      ...user,
      createdAt: randomDate(oneMonthAgo, now),
    });
  }

  const users = await db.query.users.findMany();
  console.log(`Created ${users.length} users`);

  // ============================================
  // FOLLOWS (Social connections)
  // ============================================
  console.log('Creating follow relationships...');
  const followPairs = [
    [0, 1], [0, 2], [0, 3], // Admin follows John, Sarah, Mike
    [1, 0], [1, 2], [1, 3], [1, 4], // John follows Admin, Sarah, Mike, Emma
    [2, 0], [2, 1], [2, 5], [2, 6], // Sarah follows Admin, John, David, Lisa
    [3, 1], [3, 2], [3, 7], // Mike follows John, Sarah, Tom
    [4, 1], [4, 2], [4, 3], // Emma follows John, Sarah, Mike
    [5, 2], [5, 6], [5, 7], // David follows Sarah, Lisa, Tom
    [6, 2], [6, 5], // Lisa follows Sarah, David
    [7, 1], [7, 3], [7, 5], // Tom follows John, Mike, David
  ];

  for (const [followerIdx, followingIdx] of followPairs) {
    await db.insert(schema.follows).values({
      id: uuidv4(),
      followerId: users[followerIdx].id,
      followingId: users[followingIdx].id,
      createdAt: randomDate(oneMonthAgo, now),
    });
  }
  console.log(`Created ${followPairs.length} follow relationships`);

  // ============================================
  // SESSIONS with WHISKEYS
  // ============================================
  console.log('Creating sessions and whiskeys...');

  const sessionsData = [
    {
      name: 'Kentucky Bourbon Showdown',
      theme: 'bourbon',
      moderatorIdx: 1, // John
      status: 'completed',
      whiskeys: [
        { name: 'Buffalo Trace', distillery: 'Buffalo Trace', proof: 90, age: null, region: 'Kentucky' },
        { name: "Maker's Mark", distillery: "Maker's Mark", proof: 90, age: null, region: 'Kentucky' },
        { name: 'Woodford Reserve', distillery: 'Woodford Reserve', proof: 90.4, age: null, region: 'Kentucky' },
        { name: 'Wild Turkey 101', distillery: 'Wild Turkey', proof: 101, age: null, region: 'Kentucky' },
      ],
    },
    {
      name: 'Islay Peat Fest',
      theme: 'scotch',
      moderatorIdx: 2, // Sarah
      status: 'completed',
      whiskeys: [
        { name: 'Laphroaig 10', distillery: 'Laphroaig', proof: 86, age: 10, region: 'Islay' },
        { name: 'Ardbeg 10', distillery: 'Ardbeg', proof: 92, age: 10, region: 'Islay' },
        { name: 'Lagavulin 16', distillery: 'Lagavulin', proof: 86, age: 16, region: 'Islay' },
      ],
    },
    {
      name: 'Rye Revolution',
      theme: 'rye',
      moderatorIdx: 3, // Mike
      status: 'completed',
      whiskeys: [
        { name: 'Rittenhouse Rye', distillery: 'Heaven Hill', proof: 100, age: null, region: 'Kentucky' },
        { name: 'Sazerac Rye', distillery: 'Buffalo Trace', proof: 90, age: 6, region: 'Kentucky' },
        { name: 'WhistlePig 10', distillery: 'WhistlePig', proof: 100, age: 10, region: 'Vermont' },
        { name: 'High West Double Rye', distillery: 'High West', proof: 92, age: null, region: 'Utah' },
      ],
    },
    {
      name: 'World Whisky Tour',
      theme: 'other',
      customTheme: 'International Selection',
      moderatorIdx: 5, // David
      status: 'completed',
      whiskeys: [
        { name: 'Hibiki Harmony', distillery: 'Suntory', proof: 86, age: null, region: 'Japan' },
        { name: 'Redbreast 12', distillery: 'Midleton', proof: 80, age: 12, region: 'Ireland' },
        { name: 'Lot 40', distillery: 'Hiram Walker', proof: 86, age: null, region: 'Canada' },
      ],
    },
    {
      name: 'Beginner Friendly Tasting',
      theme: 'bourbon',
      moderatorIdx: 7, // Tom
      status: 'completed',
      whiskeys: [
        { name: 'Evan Williams Black', distillery: 'Heaven Hill', proof: 86, age: null, region: 'Kentucky' },
        { name: 'Jim Beam White', distillery: 'Jim Beam', proof: 80, age: 4, region: 'Kentucky' },
        { name: 'Four Roses Yellow', distillery: 'Four Roses', proof: 80, age: null, region: 'Kentucky' },
      ],
    },
    {
      name: 'High Proof Challenge',
      theme: 'bourbon',
      moderatorIdx: 1, // John
      status: 'waiting',
      scheduledFuture: true,
      whiskeys: [
        { name: 'Bookers', distillery: 'Jim Beam', proof: 125, age: 6, region: 'Kentucky' },
        { name: 'Stagg Jr', distillery: 'Buffalo Trace', proof: 130, age: null, region: 'Kentucky' },
        { name: 'Elijah Craig Barrel Proof', distillery: 'Heaven Hill', proof: 120, age: 12, region: 'Kentucky' },
      ],
    },
  ];

  const createdSessions: Array<{ id: string; moderatorId: string }> = [];

  for (const sessionData of sessionsData) {
    const sessionId = uuidv4();
    const moderatorId = users[sessionData.moderatorIdx].id;
    const scheduledAt = sessionData.scheduledFuture
      ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      : randomDate(oneMonthAgo, oneWeekAgo);

    await db.insert(schema.sessions).values({
      id: sessionId,
      name: sessionData.name,
      theme: sessionData.theme,
      customTheme: sessionData.customTheme || null,
      scheduledAt,
      status: sessionData.status,
      moderatorId,
      currentWhiskeyIndex: sessionData.status === 'completed' ? sessionData.whiskeys.length - 1 : 0,
      currentPhase: sessionData.status === 'completed' ? 'score' : 'pour',
      inviteCode: generateInviteCode(),
      maxParticipants: 10,
      createdAt: new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000),
      updatedAt: scheduledAt,
    });

    // Add whiskeys
    for (let i = 0; i < sessionData.whiskeys.length; i++) {
      const w = sessionData.whiskeys[i];
      await db.insert(schema.whiskeys).values({
        id: uuidv4(),
        sessionId,
        displayNumber: i + 1,
        name: w.name,
        distillery: w.distillery,
        age: w.age,
        proof: w.proof,
        region: w.region,
        pourSize: '1oz',
      });
    }

    createdSessions.push({ id: sessionId, moderatorId });
  }
  console.log(`Created ${createdSessions.length} sessions with whiskeys`);

  // ============================================
  // PARTICIPANTS and SCORES for completed sessions
  // ============================================
  console.log('Creating participants and scores...');

  const completedSessions = await db.query.sessions.findMany({
    where: (sessions, { eq }) => eq(sessions.status, 'completed'),
  });

  for (const session of completedSessions) {
    const sessionWhiskeys = await db.query.whiskeys.findMany({
      where: (whiskeys, { eq }) => eq(whiskeys.sessionId, session.id),
    });

    // Add 3-5 random participants (including moderator)
    const participantCount = 3 + Math.floor(Math.random() * 3);
    const shuffledUsers = [...users].sort(() => Math.random() - 0.5);
    const sessionParticipants = shuffledUsers.slice(0, participantCount);

    // Make sure moderator is included
    const moderator = users.find(u => u.id === session.moderatorId);
    if (moderator && !sessionParticipants.find(p => p.id === moderator.id)) {
      sessionParticipants[0] = moderator;
    }

    for (const user of sessionParticipants) {
      const participantId = uuidv4();

      await db.insert(schema.participants).values({
        id: participantId,
        sessionId: session.id,
        userId: user.id,
        displayName: user.displayName,
        joinedAt: session.scheduledAt,
        status: 'completed',
        isReady: true,
        currentWhiskeyIndex: sessionWhiskeys.length - 1,
      });

      // Create scores for each whiskey
      for (const whiskey of sessionWhiskeys) {
        const nose = 5 + Math.floor(Math.random() * 6); // 5-10
        const palate = 5 + Math.floor(Math.random() * 6);
        const finish = 5 + Math.floor(Math.random() * 6);
        const overall = 5 + Math.floor(Math.random() * 6);
        const totalScore = (nose + palate + finish + overall) / 4;

        const noseDescriptors = ['vanilla', 'caramel', 'oak', 'honey', 'cherry', 'apple', 'peat', 'smoke', 'citrus', 'floral'];
        const palateDescriptors = ['smooth', 'spicy', 'sweet', 'rich', 'complex', 'balanced', 'bold', 'mellow'];
        const finishDescriptors = ['long', 'medium', 'short', 'warming', 'lingering', 'clean', 'oaky', 'sweet'];

        await db.insert(schema.scores).values({
          id: uuidv4(),
          sessionId: session.id,
          whiskeyId: whiskey.id,
          participantId,
          nose,
          palate,
          finish,
          overall,
          totalScore,
          noseNotes: `Notes of ${randomPick(noseDescriptors)} and ${randomPick(noseDescriptors)}`,
          palateNotes: `${randomPick(palateDescriptors)} with hints of ${randomPick(noseDescriptors)}`,
          finishNotes: `${randomPick(finishDescriptors)} finish with ${randomPick(finishDescriptors)} character`,
          generalNotes: Math.random() > 0.5 ? 'Would definitely try again!' : null,
          identityGuess: Math.random() > 0.7 ? whiskey.name : null,
          isPublic: Math.random() > 0.5,
          lockedAt: session.scheduledAt,
        });
      }
    }
  }
  console.log('Created participants and scores');

  // ============================================
  // TASTING NOTES LIBRARY
  // ============================================
  console.log('Creating tasting notes library entries...');

  const tastingNotes = [
    { userId: users[1].id, whiskeyName: 'Blanton\'s Original', distillery: 'Buffalo Trace', category: 'bourbon', proof: 93, age: null },
    { userId: users[1].id, whiskeyName: 'Eagle Rare 10', distillery: 'Buffalo Trace', category: 'bourbon', proof: 90, age: 10 },
    { userId: users[2].id, whiskeyName: 'Talisker 10', distillery: 'Talisker', category: 'scotch', proof: 91.6, age: 10 },
    { userId: users[2].id, whiskeyName: 'Oban 14', distillery: 'Oban', category: 'scotch', proof: 86, age: 14 },
    { userId: users[3].id, whiskeyName: 'Michter\'s Rye', distillery: 'Michter\'s', category: 'rye', proof: 84.8, age: null },
    { userId: users[5].id, whiskeyName: 'Yamazaki 12', distillery: 'Suntory', category: 'japanese', proof: 86, age: 12 },
    { userId: users[6].id, whiskeyName: 'Glenlivet 12', distillery: 'Glenlivet', category: 'scotch', proof: 80, age: 12 },
    { userId: users[7].id, whiskeyName: 'Weller Special Reserve', distillery: 'Buffalo Trace', category: 'bourbon', proof: 90, age: null },
  ];

  const noteTags = ['favorite', 'gift-worthy', 'daily-drinker', 'special-occasion', 'value', 'premium', 'rare'];

  for (const note of tastingNotes) {
    const noteId = uuidv4();
    await db.insert(schema.tastingNotesLibrary).values({
      id: noteId,
      userId: note.userId,
      whiskeyName: note.whiskeyName,
      distillery: note.distillery,
      category: note.category,
      age: note.age,
      proof: note.proof,
      noseNotes: 'Rich and inviting aromas',
      palateNotes: 'Well balanced and flavorful',
      finishNotes: 'Satisfying and memorable',
      generalNotes: 'A solid choice for any occasion',
      rating: 7 + Math.random() * 3,
      isPublic: Math.random() > 0.3,
      createdAt: randomDate(oneMonthAgo, now),
      updatedAt: now,
    });

    // Add 1-3 random tags
    const tagCount = 1 + Math.floor(Math.random() * 3);
    const shuffledTags = [...noteTags].sort(() => Math.random() - 0.5);
    for (let i = 0; i < tagCount; i++) {
      await db.insert(schema.tastingNoteTags).values({
        id: uuidv4(),
        noteId,
        tag: shuffledTags[i],
        createdAt: now,
      });
    }
  }
  console.log(`Created ${tastingNotes.length} tasting notes`);

  // ============================================
  // CONVERSATIONS and MESSAGES
  // ============================================
  console.log('Creating conversations and messages...');

  // Create conversations between mutual follows
  const conversationPairs = [
    [0, 1], // Admin & John
    [1, 2], // John & Sarah
    [2, 5], // Sarah & David
  ];

  for (const [idx1, idx2] of conversationPairs) {
    const user1 = users[idx1];
    const user2 = users[idx2];
    const participantIds = JSON.stringify([user1.id, user2.id].sort());
    const convId = uuidv4();

    const messageHistory = [
      { sender: idx1, content: 'Hey! Loved your tasting notes on that Lagavulin.' },
      { sender: idx2, content: 'Thanks! It\'s one of my all-time favorites.' },
      { sender: idx1, content: 'We should do a blind tasting together sometime.' },
      { sender: idx2, content: 'Absolutely! I\'m free next weekend.' },
    ];

    let lastMessageAt = randomDate(oneWeekAgo, now);

    await db.insert(schema.conversations).values({
      id: convId,
      participantIds,
      lastMessageAt,
      createdAt: randomDate(oneMonthAgo, oneWeekAgo),
    });

    for (const msg of messageHistory) {
      const msgTime = new Date(lastMessageAt.getTime() + Math.random() * 60 * 60 * 1000);
      await db.insert(schema.messages).values({
        id: uuidv4(),
        conversationId: convId,
        senderId: users[msg.sender].id,
        content: msg.content,
        readAt: msg.sender === idx2 ? null : msgTime,
        createdAt: msgTime,
      });
      lastMessageAt = msgTime;
    }

    // Update last message time
    await db.update(schema.conversations)
      .set({ lastMessageAt })
      .where(eq(schema.conversations.id, convId));
  }
  console.log(`Created ${conversationPairs.length} conversations with messages`);

  // ============================================
  // USER ACHIEVEMENTS
  // ============================================
  console.log('Awarding achievements to users...');

  const achievements = await db.query.achievementDefinitions.findMany();

  // Give some achievements to active users
  const achievementAwards = [
    { userIdx: 1, achievementNames: ['First Steps', 'Getting Started', 'Social Butterfly'] },
    { userIdx: 2, achievementNames: ['First Steps', 'Getting Started', 'Whiskey Explorer', 'Social Butterfly', 'Popular'] },
    { userIdx: 3, achievementNames: ['First Steps', 'Getting Started'] },
    { userIdx: 5, achievementNames: ['First Steps', 'Getting Started', 'Whiskey Explorer'] },
    { userIdx: 7, achievementNames: ['First Steps', 'Getting Started', 'Whiskey Explorer', 'Dedicated Taster', 'Social Butterfly'] },
  ];

  for (const award of achievementAwards) {
    const user = users[award.userIdx];
    for (const achievementName of award.achievementNames) {
      const achievement = achievements.find(a => a.name === achievementName);
      if (achievement) {
        await db.insert(schema.userAchievements).values({
          id: uuidv4(),
          useri: user.id,
          achievementId: achievement.id,
          earnedAt: randomDate(oneMonthAgo, now),
          notified: Math.random() > 0.3,
        });
      }
    }
  }
  console.log('Awarded achievements');

  // ============================================
  // NOTIFICATION PREFERENCES
  // ============================================
  console.log('Setting up notification preferences...');

  for (const user of users) {
    await db.insert(schema.notificationPreferences).values({
      id: uuidv4(),
      userId: user.id,
      sessionInvites: true,
      sessionStarting: true,
      sessionReveal: true,
      newFollowers: true,
      achievements: true,
      directMessages: true,
      updatedAt: now,
    });
  }
  console.log('Created notification preferences');

  // ============================================
  // COMMENTS
  // ============================================
  console.log('Creating comments on whiskeys...');

  const participants = await db.query.participants.findMany();
  const allWhiskeys = await db.query.whiskeys.findMany();

  // Add some comments to whiskeys in completed sessions
  const commentTexts = [
    'This one really surprised me!',
    'Classic flavor profile, very reliable.',
    'Not my favorite, but I can see the appeal.',
    'Would love to try the cask strength version.',
    'Perfect for an old fashioned!',
    'The finish is what makes this special.',
  ];

  let commentCount = 0;
  for (const whiskey of allWhiskeys.slice(0, 8)) {
    const sessionParticipants = participants.filter(p => p.sessionId === whiskey.sessionId);
    if (sessionParticipants.length > 0) {
      const participant = randomPick(sessionParticipants);
      await db.insert(schema.comments).values({
        id: uuidv4(),
        sessionId: whiskey.sessionId,
        whiskeyId: whiskey.id,
        participantId: participant.id,
        content: randomPick(commentTexts),
        createdAt: now,
        updatedAt: now,
      });
      commentCount++;
    }
  }
  console.log(`Created ${commentCount} comments`);

  // ============================================
  // EXTENDED ANALYTICS DATA
  // ============================================
  console.log('Creating extended analytics data (90 days of sessions)...');

  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Whiskey pool for random selection
  const whiskeyPool = [
    { name: 'Elijah Craig Small Batch', distillery: 'Heaven Hill', proof: 94, age: null, region: 'Kentucky' },
    { name: 'Four Roses Single Barrel', distillery: 'Four Roses', proof: 100, age: null, region: 'Kentucky' },
    { name: 'Old Forester 1920', distillery: 'Brown-Forman', proof: 115, age: null, region: 'Kentucky' },
    { name: 'Russell\'s Reserve 10', distillery: 'Wild Turkey', proof: 90, age: 10, region: 'Kentucky' },
    { name: 'Knob Creek 9', distillery: 'Jim Beam', proof: 100, age: 9, region: 'Kentucky' },
    { name: 'Glenfiddich 12', distillery: 'Glenfiddich', proof: 80, age: 12, region: 'Speyside' },
    { name: 'Macallan 12 Sherry', distillery: 'Macallan', proof: 86, age: 12, region: 'Speyside' },
    { name: 'Highland Park 12', distillery: 'Highland Park', proof: 86, age: 12, region: 'Highland' },
    { name: 'Bunnahabhain 12', distillery: 'Bunnahabhain', proof: 92.6, age: 12, region: 'Islay' },
    { name: 'Balvenie 14 Caribbean Cask', distillery: 'Balvenie', proof: 86, age: 14, region: 'Speyside' },
    { name: 'Pikesville Rye', distillery: 'Heaven Hill', proof: 110, age: 6, region: 'Kentucky' },
    { name: 'Old Overholt Rye', distillery: 'Jim Beam', proof: 80, age: null, region: 'Kentucky' },
    { name: 'Bulleit Rye', distillery: 'Diageo', proof: 90, age: null, region: 'Kentucky' },
    { name: 'Nikka From The Barrel', distillery: 'Nikka', proof: 102.4, age: null, region: 'Japan' },
    { name: 'Hakushu 12', distillery: 'Suntory', proof: 86, age: 12, region: 'Japan' },
    { name: 'Jameson Black Barrel', distillery: 'Midleton', proof: 80, age: null, region: 'Ireland' },
    { name: 'Green Spot', distillery: 'Midleton', proof: 80, age: null, region: 'Ireland' },
    { name: 'Powers John\'s Lane', distillery: 'Midleton', proof: 92, age: 12, region: 'Ireland' },
    { name: 'Angel\'s Envy', distillery: 'Angel\'s Envy', proof: 86.6, age: null, region: 'Kentucky' },
    { name: 'Michter\'s Small Batch', distillery: 'Michter\'s', proof: 91.4, age: null, region: 'Kentucky' },
  ];

  const sessionThemes = [
    { theme: 'bourbon', name: 'Bourbon Night' },
    { theme: 'scotch', name: 'Scotch Exploration' },
    { theme: 'rye', name: 'Rye Tasting' },
    { theme: 'irish', name: 'Irish Whiskey Evening' },
    { theme: 'japanese', name: 'Japanese Whisky' },
    { theme: 'other', name: 'World Whisky Tour' },
  ];

  // Create 15 additional sessions spread over 90 days
  const additionalSessionCount = 15;
  let analyticsSessionCount = 0;

  for (let i = 0; i < additionalSessionCount; i++) {
    // Spread sessions across 90 days
    const dayOffset = Math.floor((i / additionalSessionCount) * 85) + Math.floor(Math.random() * 5);
    const sessionDate = new Date(ninetyDaysAgo.getTime() + dayOffset * 24 * 60 * 60 * 1000);

    const themeInfo = randomPick(sessionThemes);
    const sessionId = uuidv4();
    const moderatorIdx = 1 + Math.floor(Math.random() * 7); // Random moderator (not admin)
    const moderatorId = users[moderatorIdx].id;

    await db.insert(schema.sessions).values({
      id: sessionId,
      name: `${themeInfo.name} #${i + 10}`,
      theme: themeInfo.theme,
      scheduledAt: sessionDate,
      status: 'completed',
      moderatorId,
      currentWhiskeyIndex: 2,
      currentPhase: 'score',
      inviteCode: generateInviteCode(),
      maxParticipants: 8,
      createdAt: new Date(sessionDate.getTime() - 24 * 60 * 60 * 1000),
      updatedAt: sessionDate,
    });

    // Add 3-4 whiskeys to each session
    const whiskeyCount = 3 + Math.floor(Math.random() * 2);
    const sessionWhiskeyIds: string[] = [];
    const shuffledWhiskeys = [...whiskeyPool].sort(() => Math.random() - 0.5);

    for (let w = 0; w < whiskeyCount; w++) {
      const whiskey = shuffledWhiskeys[w];
      const whiskeyId = uuidv4();
      sessionWhiskeyIds.push(whiskeyId);

      await db.insert(schema.whiskeys).values({
        id: whiskeyId,
        sessionId,
        displayNumber: w + 1,
        name: whiskey.name,
        distillery: whiskey.distillery,
        age: whiskey.age,
        proof: whiskey.proof,
        region: whiskey.region,
        pourSize: '1oz',
      });
    }

    // Add 3-6 participants including moderator
    const participantCount = 3 + Math.floor(Math.random() * 4);
    const shuffledUserIndices = [moderatorIdx, ...Array.from({ length: 7 }, (_, i) => i + 1).filter(i => i !== moderatorIdx)].sort(() => Math.random() - 0.5);
    const participantIndices = shuffledUserIndices.slice(0, participantCount);

    // Ensure moderator is included
    if (!participantIndices.includes(moderatorIdx)) {
      participantIndices[0] = moderatorIdx;
    }

    for (const userIdx of participantIndices) {
      const user = users[userIdx];
      const participantId = uuidv4();

      await db.insert(schema.participants).values({
        id: participantId,
        sessionId,
        userId: user.id,
        displayName: user.displayName,
        joinedAt: sessionDate,
        status: 'completed',
        isReady: true,
        currentWhiskeyIndex: whiskeyCount - 1,
      });

      // Create scores for each whiskey with some variation
      // Add a user tendency: some users score higher, some lower
      const userBias = (userIdx % 3) - 1; // -1, 0, or 1

      for (const whiskeyId of sessionWhiskeyIds) {
        // Base scores with some randomness and user bias
        const baseScore = 6 + Math.random() * 3 + userBias * 0.5;
        const nose = Math.min(10, Math.max(1, Math.round(baseScore + (Math.random() - 0.5) * 2)));
        const palate = Math.min(10, Math.max(1, Math.round(baseScore + (Math.random() - 0.5) * 2)));
        const finish = Math.min(10, Math.max(1, Math.round(baseScore + (Math.random() - 0.5) * 2)));
        const overall = Math.min(10, Math.max(1, Math.round(baseScore + (Math.random() - 0.5) * 2)));
        const totalScore = (nose + palate + finish + overall) / 4;

        const noseDescriptors = ['vanilla', 'caramel', 'oak', 'honey', 'cherry', 'apple', 'peat', 'smoke', 'citrus', 'floral', 'spice', 'leather'];
        const palateDescriptors = ['smooth', 'spicy', 'sweet', 'rich', 'complex', 'balanced', 'bold', 'mellow', 'creamy', 'oaky'];
        const finishDescriptors = ['long', 'medium', 'short', 'warming', 'lingering', 'clean', 'oaky', 'sweet', 'spicy', 'dry'];

        await db.insert(schema.scores).values({
          id: uuidv4(),
          sessionId,
          whiskeyId,
          participantId,
          nose,
          palate,
          finish,
          overall,
          totalScore,
          noseNotes: `${randomPick(noseDescriptors)}, ${randomPick(noseDescriptors)}, hints of ${randomPick(noseDescriptors)}`,
          palateNotes: `${randomPick(palateDescriptors)} with ${randomPick(noseDescriptors)} and ${randomPick(palateDescriptors)} character`,
          finishNotes: `${randomPick(finishDescriptors)} finish, ${randomPick(finishDescriptors)} with ${randomPick(finishDescriptors)} notes`,
          generalNotes: Math.random() > 0.6 ? randomPick([
            'Excellent value for the price',
            'Would buy again',
            'Great for cocktails',
            'Best neat or with a few drops of water',
            'Impressive complexity',
            'A bit disappointing given the hype',
            'Perfect after-dinner sipper',
            'One of my new favorites',
          ]) : null,
          identityGuess: Math.random() > 0.8 ? whiskeyPool.find(w => sessionWhiskeyIds.includes(whiskeyId))?.name : null,
          isPublic: Math.random() > 0.4,
          lockedAt: sessionDate,
        });
      }
    }

    analyticsSessionCount++;
  }

  console.log(`Created ${analyticsSessionCount} additional sessions for analytics`);

  // Update the session's currentWhiskeyIndex
  const allSessions = await db.query.sessions.findMany({
    where: eq(schema.sessions.status, 'completed'),
  });

  for (const session of allSessions) {
    const whiskeysInSession = await db.query.whiskeys.findMany({
      where: eq(schema.whiskeys.sessionId, session.id),
    });
    if (whiskeysInSession.length > 0) {
      await db.update(schema.sessions)
        .set({ currentWhiskeyIndex: whiskeysInSession.length - 1 })
        .where(eq(schema.sessions.id, session.id));
    }
  }

  console.log('\n========================================');
  console.log('Seed completed successfully!');
  console.log('========================================');
  console.log('\nTest accounts (password: password123):');
  console.log('  - admin@example.com (Admin)');
  console.log('  - john@example.com (John Bourbon)');
  console.log('  - sarah@example.com (Sarah Scotch)');
  console.log('  - mike@example.com (Mike Rye)');
  console.log('  - emma@example.com (Emma Explorer)');
  console.log('  - david@example.com (David Dram)');
  console.log('  - lisa@example.com (Lisa Lowland)');
  console.log('  - tom@example.com (Tom Taster)');
  console.log('========================================\n');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
