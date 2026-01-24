import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import path from 'path';
import dotenv from 'dotenv';

import { initializeDatabase } from './db';
import { initializeSocket } from './socket';
import authRoutes from './routes/auth';
import sessionsRoutes from './routes/sessions';
import scoresRoutes from './routes/scores';
import participantsRoutes from './routes/participants';
import adminRoutes from './routes/admin';
import socialRoutes from './routes/social';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Initialize socket.io
initializeSocket(httpServer);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/scores', scoresRoutes);
app.use('/api/participants', participantsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/social', socialRoutes);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
const PORT = process.env.PORT || 3001;

initializeDatabase();

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready`);
});

export default app;
