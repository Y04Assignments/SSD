import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import connectDB from './config/db.js';
import session from 'express-session';
import passport from './config/passport.js';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import chargingStationRoutes from './src/routes/chargingStationRoutes.js';
import reviewRoutes from './src/routes/reviewRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import sellRequestRoutes from './src/routes/sellRequestRoutes.js';
import productRoutes from './src/routes/productRoutes.js';
import authRoutes from './src/routes/auth.js';
import adminRoutes from './src/routes/adminRoutes.js';
import errorHandler from './middleware/errorHandler.js';

//DNS issue </3 (adeesha) - doesn't really affect anything
import { setServers } from 'node:dns/promises';
setServers(['1.1.1.1', '8.8.8.8']);

dotenv.config();

const app = express();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 300,  
  standardHeaders: true,    
  legacyHeaders: false,     
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// Connect to MongoDB (uses process.env.MONGODB_URI)
connectDB();

// Allow configuring production/frontend origins via ALLOWED_ORIGINS env var (comma-separated)
const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const origins = allowedOrigins.length ? allowedOrigins : defaultOrigins;

app.use(
  cors({
    origin: origins,
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser()); //Parses the cookie header on incoming requests into req.cookies object, so backend can read the httpOnly "token" cookie set at login

// Helmet sets a broad set of security headers with one call.
// The contentSecurityPolicy block below explicitly adds `frame-ancestors` and `form-action`, the two directives obtained
// from the ZAP scan flagged as missing a safe fallback 
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'frame-ancestors': ["'self'"], // only your own site may frame these pages (anti-clickjacking)
        'form-action': ["'self'"],     // forms on this site may only submit back to this site
      },
    },
  })
);

app.use('/api/', apiLimiter); // Apply rate limiting to all API routes

const sessionSecret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
if (!sessionSecret && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: SESSION_SECRET or JWT_SECRET environment variable is required in production');
}

// In non-production, generate an ephemeral random secret if not provided in environment
const devSecret = sessionSecret || crypto.randomBytes(32).toString('hex');

app.use(
  session({
    secret: devSecret,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to SolarCharge Finder API' });
});

app.use('/api/stations', chargingStationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sell-request', sellRequestRoutes);
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// centralized error handler
app.use(errorHandler);

export default app;
