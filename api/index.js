import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { connectDB } = require('../server/db');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.'
});
app.use('/api/auth/login', authLimiter);

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Routes (CJS modules from server/)
app.use('/api/auth', require('../server/routes/auth'));
app.use('/api/patients', require('../server/routes/patients'));
app.use('/api/tests', require('../server/routes/tests'));
app.use('/api/reports', require('../server/routes/reports'));
app.use('/api/dashboard', require('../server/routes/dashboard'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Vercel serverless handler
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }
  
  const connection = await connectDB();
  cachedDb = connection;
  return connection;
}

export default async function handler(req, res) {
  await connectToDatabase();
  return app(req, res);
}
