import express from 'express';
import session from 'express-session';
import pg from 'pg';
import connectPgSimple from 'connect-pg-simple';

const { Pool } = pg;
const PgSession = connectPgSimple(session);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true }
});

// Express app setup
const app = express();
app.use(express.json());

// Session configuration
app.use(session({
  store: new PgSession({
    pool: pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'test-secret-key',
  resave: false,
  saveUninitialized: true, // Force session creation
  cookie: { 
    secure: true,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

// Test session endpoint
app.get('/api/test-session', (req, res) => {
  try {
    // Try to set a session value
    req.session.testValue = 'Hello from session!';
    req.session.timestamp = new Date().toISOString();
    
    res.json({
      success: true,
      message: 'Session test',
      sessionId: req.sessionID,
      sessionData: req.session,
      hasSessionStore: !!req.session.store,
      storeType: req.session.store?.constructor?.name || 'unknown'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Default handler
export default function handler(req, res) {
  return app(req, res);
} 