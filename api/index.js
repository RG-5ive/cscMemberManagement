// Vercel serverless function - JWT-based authentication
import express from 'express';
import pg from 'pg';
import crypto from 'crypto';
import { promisify } from 'util';

const { Pool } = pg;
const scryptAsync = promisify(crypto.scrypt);

// Simple JWT implementation without external dependencies
function createJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJWT(token, secret) {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
    
    // Check expiration
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

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

// JWT authentication middleware
const authenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    req.user = null;
    return next();
  }
  
  const payload = verifyJWT(token, process.env.SESSION_SECRET || 'your-secret-key');
  
  if (!payload) {
    req.user = null;
    return next();
  }
  
  try {
    // Get fresh user data from database
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [payload.userId]);
    req.user = result.rows[0] || null;
  } catch (error) {
    req.user = null;
  }
  
  next();
};

app.use(authenticateJWT);

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

// Helper function to create auth token
function createAuthToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };
  
  return createJWT(payload, process.env.SESSION_SECRET || 'your-secret-key');
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
    user: req.user ? formatUserResponse(req.user) : null 
  });
});

// Helper function for login
async function handleLogin(email, password, usernameField = 'email') {
  try {
    const query = usernameField === 'email' 
      ? 'SELECT * FROM users WHERE email = $1'
      : 'SELECT * FROM users WHERE username = $1';
    
    const result = await pool.query(query, [email]);
    const user = result.rows[0];
    
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    
    const isValid = await comparePasswords(password, user.password);
    if (!isValid) {
      return { success: false, message: 'Invalid password' };
    }
    
    const token = createAuthToken(user);
    
    return { 
      success: true, 
      user: formatUserResponse(user),
      token 
    };
  } catch (error) {
    return { success: false, message: 'Login error', error: error.message };
  }
}

// Member login (email-based)
app.post('/api/member/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  
  const result = await handleLogin(email, password, 'email');
  
  if (!result.success) {
    return res.status(401).json({ message: result.message, error: result.error });
  }
  
  res.json({
    message: 'Login successful',
    user: result.user,
    authToken: result.token
  });
});

// General login (username-based for chairs/admins)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  
  const result = await handleLogin(username, password, 'username');
  
  if (!result.success) {
    return res.status(401).json({ message: result.message, error: result.error });
  }
  
  res.json({
    message: 'Login successful',
    user: result.user,
    authToken: result.token
  });
});

// Admin login (username-based)
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  
  const result = await handleLogin(username, password, 'username');
  
  if (!result.success) {
    return res.status(401).json({ message: result.message, error: result.error });
  }
  
  // Check if user has admin role
  if (result.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
  
  res.json({
    message: 'Login successful',
    user: result.user,
    authToken: result.token
  });
});

app.post('/api/logout', (req, res) => {
  // With JWT, logout is handled client-side by removing the token
  res.json({ message: 'Logged out successfully' });
});

// Default handler
export default function handler(req, res) {
  return app(req, res);
} 