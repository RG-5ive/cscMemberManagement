// Vercel serverless function - simplified approach
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import pg from 'pg';
import crypto from 'crypto';
import { promisify } from 'util';

const { Pool } = pg;
const scryptAsync = promisify(crypto.scrypt);

// Hash password function
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

// Compare password function
async function comparePasswords(password, hash) {
  try {
    const [hashedPassword, salt] = hash.split('.');
    const buf = await scryptAsync(password, salt, 64);
    return buf.toString('hex') === hashedPassword;
  } catch {
    return false;
  }
}

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true }
});

// Express app setup
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session configuration - using memory store for testing
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true, // Force session creation for testing
  cookie: { 
    secure: true, // Always use secure cookies in production (HTTPS)
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Allow same-site requests for proper functionality
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport configuration for member login (email)
passport.use('member', new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user) {
      return done(null, false, { message: 'User not found' });
    }
    
    const isValid = await comparePasswords(password, user.password);
    if (!isValid) {
      return done(null, false, { message: 'Invalid password' });
    }
    
    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

// Passport configuration for admin/chair login (username)
passport.use('admin', new LocalStrategy({
  usernameField: 'username',
  passwordField: 'password'
}, async (username, password, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    
    if (!user) {
      return done(null, false, { message: 'User not found' });
    }
    
    const isValid = await comparePasswords(password, user.password);
    if (!isValid) {
      return done(null, false, { message: 'Invalid password' });
    }
    
    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (error) {
    done(error);
  }
});

// Helper function to format user response
function formatUserResponse(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    firstName: user.first_name,
    lastName: user.last_name,
    memberLevel: user.member_level,
    hasCompletedOnboarding: user.has_completed_onboarding
  };
}

// Routes
app.get('/api/user', (req, res) => {
  if (req.user) {
    res.json(formatUserResponse(req.user));
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

app.get('/api/session/check', (req, res) => {
  res.json({ 
    authenticated: !!req.user,
    user: req.user ? formatUserResponse(req.user) : null,
    sessionId: req.sessionID,
    hasSession: !!req.session
  });
});

// Member login (email-based)
app.post('/api/member/login', (req, res, next) => {
  passport.authenticate('member', (err, user, info) => {
    if (err) {
      return res.status(500).json({ message: 'Login error', error: err.message });
    }
    if (!user) {
      return res.status(401).json({ message: info?.message || 'Login failed' });
    }
    
    req.logIn(user, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Session error', error: err.message });
      }
      
      // Force session save
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
        }
        
        res.json({ 
          message: 'Login successful',
          user: formatUserResponse(user),
          sessionId: req.sessionID
        });
      });
    });
  })(req, res, next);
});

// General login (username-based for chairs/admins)
app.post('/api/login', (req, res, next) => {
  passport.authenticate('admin', (err, user, info) => {
    if (err) {
      return res.status(500).json({ message: 'Login error', error: err.message });
    }
    if (!user) {
      return res.status(401).json({ message: info?.message || 'Login failed' });
    }
    
    req.logIn(user, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Session error', error: err.message });
      }
      
      // Force session save
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
        }
        
        res.json(formatUserResponse(user));
      });
    });
  })(req, res, next);
});

// Admin login (username-based)
app.post('/api/admin/login', (req, res, next) => {
  passport.authenticate('admin', (err, user, info) => {
    if (err) {
      return res.status(500).json({ message: 'Login error', error: err.message });
    }
    if (!user) {
      return res.status(401).json({ message: info?.message || 'Login failed' });
    }
    
    // Check if user has admin role
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
    
    req.logIn(user, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Session error', error: err.message });
      }
      
      // Force session save
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
        }
        
        res.json(formatUserResponse(user));
      });
    });
  })(req, res, next);
});

app.post('/api/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout error' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Default handler
export default function handler(req, res) {
  return app(req, res);
} 