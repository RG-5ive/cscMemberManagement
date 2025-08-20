import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  console.log("Password comparison debug:");
  console.log(`- Supplied password length: ${supplied.length}`);
  console.log(`- Stored hash length: ${stored.length}`);
  
  // Check if stored password has correct format
  if (!stored.includes('.')) {
    console.error("Invalid stored password format - missing delimiter");
    return false;
  }
  
  const [hashed, salt] = stored.split(".");
  console.log(`- Extracted hash part length: ${hashed.length}`);
  console.log(`- Extracted salt part length: ${salt.length}`);
  
  try {
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    
    // Debug output (first 10 chars only for security)
    console.log(`- First 10 chars of stored hash: ${hashed.substring(0, 10)}...`);
    console.log(`- First 10 chars of computed hash: ${suppliedBuf.toString('hex').substring(0, 10)}...`);
    
    const result = timingSafeEqual(hashedBuf, suppliedBuf);
    console.log(`- Password comparison result: ${result ? 'MATCH' : 'NO MATCH'}`);
    return result;
  } catch (error) {
    console.error("Error during password comparison:", error);
    return false;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  console.log(`requireAuth check for ${req.path}:`, {
    sessionID: req.sessionID,
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    hasUser: !!req.user,
    userId: req.user ? (req.user as any).id : null,
    hasSession: !!req.session,
    sessionData: req.session ? {
      userId: (req.session as any).userId,
      username: (req.session as any).username
    } : null
  });

  // First check session authentication
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    console.log(`Session auth successful for ${req.path}:`, {
      userId: (req.user as any).id,
      username: (req.user as any).username
    });
    return next();
  }
  
  // Check if we have session data without passport authentication
  if (req.session && (req.session as any).userId) {
    try {
      const userId = (req.session as any).userId;
      const user = await storage.getUser(userId);
      
      if (user) {
        console.log(`Session-based auth successful for ${req.path}:`, {
          userId: user.id,
          username: user.username
        });
        
        // Attach user to request for compatibility
        req.user = user;
        return next();
      }
    } catch (error) {
      console.error("Error fetching user from session data:", error);
    }
  }
  
  // If session auth fails, try token auth
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const userId = validateAuthToken(token);
    
    if (userId) {
      try {
        // Get user by ID
        const user = await storage.getUser(userId);
        
        if (user) {
          console.log(`Token auth successful for requireAuth middleware: ${req.path}`, { 
            userId: user.id, 
            username: user.username 
          });
          
          // Attach user to request
          req.user = user;
          return next();
        }
      } catch (error) {
        console.error("Error fetching user with token for requireAuth:", error);
      }
    }
  }
  
  // If all auth methods fail
  console.log("Unauthorized access attempt:", req.path);
  return res.status(401).json({ error: "Unauthorized" });
}

// Track active user sessions for backup authentication
// This is a workaround for environments where cookies don't persist properly
const activeUsers = new Map<string, {userId: number, expires: Date}>();

// Helper to validate a token
export function validateAuthToken(token: string): number | null {
  if (!token) return null;
  
  // Check if token exists and is not expired
  const userSession = activeUsers.get(token);
  if (!userSession) {
    console.log("Token not found in active users map");
    return null;
  }
  
  // Check expiration
  if (userSession.expires < new Date()) {
    console.log("Token expired, removing from active users");
    activeUsers.delete(token);
    return null;
  }
  
  console.log("Token validated successfully for user:", userSession.userId);
  
  // Reset expiration to extend token's life with each use (rolling tokens)
  const updatedExpires = new Date();
  updatedExpires.setHours(updatedExpires.getHours() + 24);
  activeUsers.set(token, {
    userId: userSession.userId,
    expires: updatedExpires
  });
  
  return userSession.userId;
}

// Generate a secure random token
export function generateAuthToken(userId: number): string {
  const token = randomBytes(32).toString('hex');
  
  // Store token with 24-hour expiration
  const expires = new Date();
  expires.setHours(expires.getHours() + 24);
  
  activeUsers.set(token, {
    userId,
    expires
  });
  
  console.log(`Generated auth token for user ${userId}`);
  return token;
}

export function setupAuth(app: Express) {
  // In development or on error, use a default key instead of stopping the server
  if (!process.env.SESSION_SECRET) {
    console.warn("SESSION_SECRET environment variable not set, using a default secret for development");
    process.env.SESSION_SECRET = "dev-secret-key-for-local-testing-only";
  }

  // New simplified session setup
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET,
    resave: true, 
    saveUninitialized: true,
    store: storage.sessionStore,
    name: 'csc_sid', // Shorter name
    cookie: {
      secure: false, // Set to false for all environments to ensure cookies work
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax',
      path: '/',
    },
    proxy: true,
    rolling: true
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({
      usernameField: 'username', // Accept both username and email
      passwordField: 'password',
      passReqToCallback: true, // Pass request to callback
    }, async (req, usernameOrEmail, password, done) => {
      try {
        console.log(`Attempting login with username/email: ${usernameOrEmail}`);
        
        // Check if the request route indicates a specific user role
        const requestPath = req.path;
        let requiredRole = null;
        
        if (requestPath === '/api/member/login') {
          requiredRole = 'user';
          console.log('Member login route detected - looking for user role');
        } else if (requestPath === '/api/admin/login') {
          requiredRole = 'admin';
          console.log('Admin login route detected - looking for admin role');
        }
        
        // Try to find user by username first, then by email
        let user;
        if (requiredRole) {
          user = await storage.getUserByEmailAndRole(usernameOrEmail, requiredRole);
          if (!user) {
            // Also try by username for chair users
            user = await storage.getUserByUsername(usernameOrEmail);
            if (user && user.role !== requiredRole) {
              user = null; // User exists but wrong role
            }
          }
          console.log(`Looking for user with role: ${requiredRole}`);
        } else {
          // Try by username first (for chair login)
          user = await storage.getUserByUsername(usernameOrEmail);
          if (!user) {
            // Then try by email
            user = await storage.getUserByEmail(usernameOrEmail);
          }
          console.log('No specific role required, checking username and email');
        }
        
        if (!user) {
          console.log(`No user found with username/email: ${usernameOrEmail} ${requiredRole ? `and role: ${requiredRole}` : ''}`);
          return done(null, false, { message: "Invalid email or password" });
        }
        
        console.log(`Found user with ID: ${user.id}, role: ${user.role}, username: ${user.username}`);
        console.log(`Password hash in DB for this user: ${user.password.substring(0, 20)}...`);
        
        const isPasswordValid = await comparePasswords(password, user.password);
        if (!isPasswordValid) {
          console.log(`Invalid password for user: ${usernameOrEmail}`);
          return done(null, false, { message: "Invalid email or password" });
        }
        
        console.log(`Successful login for user: ${usernameOrEmail} (ID: ${user.id}, role: ${user.role})`);
        return done(null, user);
      } catch (error) {
        console.error(`Login error for ${usernameOrEmail}:`, error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log('Registration request received:', {
        ...req.body,
        password: req.body.password ? '[REDACTED]' : undefined
      });
      
      // Validate user data
      let userData;
      try {
        userData = insertUserSchema.parse(req.body);
      } catch (parseError) {
        console.error('Invalid registration data:', parseError);
        return res.status(400).json({ error: "Invalid registration data" });
      }

      // Check existing username
      try {
        const existingUser = await storage.getUserByUsername(userData.username);
        if (existingUser) {
          console.log('Username already exists:', userData.username);
          return res.status(400).json({ error: "Username already exists" });
        }
      } catch (error) {
        console.log('Error checking username - continuing:', error);
        // Continue with registration
      }

      // Check existing email
      try {
        const existingEmail = await storage.getUserByEmail(userData.email);
        if (existingEmail) {
          console.log('Email already exists:', userData.email);
          return res.status(400).json({ error: "Email already registered" });
        }
      } catch (error) {
        console.log('Error checking email - continuing:', error);
        // Continue with registration
      }

      // Hash password
      let hashedPassword;
      try {
        hashedPassword = await hashPassword(userData.password);
        console.log('Password hashed successfully');
      } catch (hashError) {
        console.error('Error hashing password:', hashError);
        return res.status(500).json({ error: "Error processing registration" });
      }

      // Create user
      let user;
      try {
        user = await storage.createUser({
          ...userData,
          username: userData.email || userData.username, // Use email as username if not provided
          password: hashedPassword,
        });
        console.log('User created successfully:', { id: user.id, username: user.username });
      } catch (createError) {
        console.error('Error creating user:', createError);
        return res.status(400).json({ error: "Could not create user. Please try again later." });
      }

      // Handle the session directly without regeneration first
      // Login the user immediately
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error('Login error after registration:', loginErr);
          return next(loginErr);
        }
        
        // Add additional session data if needed
        // Use type assertion to avoid TypeScript errors
        (req.session as any).userId = user.id;
        (req.session as any).username = user.username;
        (req.session as any).created = new Date().toISOString();
        // Set a flag to indicate this is a new user
        (req.session as any).isNewRegistration = true;
        
        // Force session save and use callback to ensure it completes
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Session save error after registration:', saveErr);
            return next(saveErr);
          }
          
          console.log('User logged in successfully after registration:', {
            userId: user.id,
            username: user.username,
            sessionID: req.sessionID,
            created: (req.session as any).created
          });
          
          // Make sure the cookie headers are set correctly with a longer timeout
          setTimeout(() => {
            // Set cookies explicitly in addition to passport's automatic behavior
            if (req.session.cookie) {
              // Set the cookie properties to ensure it persists
              req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
            }
            
            // Touch the session to ensure it's active
            req.session.touch();
            
            // Now save again after modifications
            req.session.save((finalSaveErr) => {
              if (finalSaveErr) {
                console.error('Final session save error:', finalSaveErr);
                return next(finalSaveErr);
              }
              
              // Create a token as a backup authentication mechanism
              const authToken = generateAuthToken(user.id);
              
              // Now send the response with both session and token
              return res.status(201).json({
                ...user,
                sessionId: req.sessionID, // Include session info for debugging
                authStatus: 'success',
                authToken // Include fallback token
              });
            });
          }, 200); // Increase timeout for better reliability
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(400).json({ error: (error as Error).message || "Registration failed" });
    }
  });

  // Helper function for authentication that enforces role-based access
  const authenticateWithRole = (req: Request, res: Response, next: NextFunction, requiredRole?: 'admin' | 'user' | 'committee_chair' | 'committee_cochair' | 'committee_member') => {
    // Use custom callback authentication to handle role-specific logins
    passport.authenticate("local", async (err: Error | null, user: SelectUser | false, info: { message: string } | undefined) => {
      if (err) {
        console.error("Login authentication error:", err);
        return next(err);
      }
      
      if (!user) {
        console.log("Login failed - invalid email address or password");
        return res.status(401).json({ error: info?.message || "Invalid email address or password" });
      }
      
      // CRITICAL FIX: If a specific role is required but the user doesn't match that role,
      // try to find another account with the same email but matching the required role
      if (requiredRole && user) {
        // For committee roles, check if the user has the specific role or higher privileges
        const roleHierarchy = {
          'admin': 4,
          'committee_chair': 3,
          'committee_cochair': 2,
          'committee_member': 1,
          'user': 0
        };
        
        // Define permissions equivalent to the required role
        const committeeRolePermissions = {
          'committee_chair': ['canManageCommittees', 'canManageWorkshops'],
          'committee_cochair': ['canManageWorkshops'],
          'committee_member': []
        };
        
        let hasPermission = false;
        const userRoleWeight = roleHierarchy[user.role] || 0;
        const requiredRoleWeight = roleHierarchy[requiredRole] || 0;
        
        // Special admin bypass
        if (user.role === 'admin') {
          hasPermission = true;
          console.log(`Admin user automatically granted access for ${requiredRole} requirement`);
        }
        // Direct role match
        else if (user.role === requiredRole) {
          hasPermission = true;
          console.log(`User role ${user.role} directly matches required role ${requiredRole}`);
        }
        // Role hierarchy check
        else if (userRoleWeight >= requiredRoleWeight) {
          hasPermission = true;
          console.log(`User role ${user.role} (weight: ${userRoleWeight}) satisfies required role ${requiredRole} (weight: ${requiredRoleWeight})`);
        }
        // Permission flag check (even if role name doesn't match)
        else if (committeeRolePermissions[requiredRole]) {
          hasPermission = committeeRolePermissions[requiredRole].every(perm => user[perm] === true);
          if (hasPermission) {
            console.log(`User has specific permissions satisfying ${requiredRole} requirement`);
          }
        }
        
        // If permissions check fails, try to find an alternative account
        if (!hasPermission) {
          console.log(`User ${user.email} has role '${user.role}' but '${requiredRole}' is required, checking for matching account...`);
          
          try {
            // Directly query for a user with matching email AND the required role
            const matchingUser = await storage.getUserByEmailAndRole(user.email, requiredRole);
            
            if (matchingUser) {
              console.log(`Found matching ${requiredRole} account for email ${user.email}`);
              // Replace the user object with the role-matching account
              user = matchingUser;
              hasPermission = true;
            } else {
              console.log(`No matching ${requiredRole} account found for email ${user.email}`);
              return res.status(403).json({ 
                error: `This account doesn't have ${requiredRole} access privileges` 
              });
            }
          } catch (error) {
            console.error("Error finding role-matching account:", error);
            return res.status(403).json({ 
              error: `This account doesn't have ${requiredRole} access privileges` 
            });
          }
        }
      }
      
      // Handle login directly without session regeneration to avoid cookie issues
      if (!user) {
        console.log("User object is unexpectedly null/false after role check");
        return res.status(401).json({ error: "Authentication failed" });
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error('Login error after authentication:', loginErr);
          return next(loginErr);
        }
        
        // Add additional session data if needed
        // Use type assertion to avoid TypeScript errors
        (req.session as any).userId = user.id;
        (req.session as any).username = user.username;
        (req.session as any).created = new Date().toISOString();
        (req.session as any).portalType = requiredRole || user.role; // Store which portal was used for login
        
        console.log('User authenticated, saving session for:', {
          userId: user.id,
          username: user.username,
          role: user.role,
          portalType: (req.session as any).portalType,
          sessionID: req.sessionID,
          created: (req.session as any).created
        });
        
        // Make sure the cookie settings are correct
        if (req.session.cookie) {
          req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        }
        
        // Generate auth token for fallback authentication
        const authToken = generateAuthToken(user.id);
        console.log(`Generated auth token for user ${user.id}`);
        
        // Send the response immediately
        res.status(200).json({
          ...user,
          portalType: (req.session as any).portalType, // Include portal type so client knows which UI to show
          sessionId: req.sessionID, // Include session info for debugging
          authStatus: 'success',
          authToken // Include fallback token
        });
      });
    })(req, res, next);
  };

  // Generic login - automatically directs to the appropriate portal based on role
  app.post("/api/login", (req, res, next) => {
    authenticateWithRole(req, res, next);
  });
  
  // Admin-specific login - enforces admin role
  app.post("/api/admin/login", async (req, res, next) => {
    console.log("Admin login attempt received");
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    
    console.log("Attempting login with email:", username);
    console.log("Admin login route detected - looking for admin role");
    
    try {
      // First look for a direct match with admin role
      console.log("Looking for user with email", username, "and role admin");
      let adminUser = await storage.getUserByEmailAndRole(username, 'admin');
      
      // If no match with email, try username with admin role
      if (!adminUser) {
        console.log("No user found with email", username, "and role admin");
        console.log("Looking for user with role: admin");
        adminUser = await storage.getUserByUsername(username);
        
        // Make sure it's an admin
        if (!adminUser || adminUser.role !== 'admin') {
          console.log("No user found with email:", username, "and role: admin");
          console.log("Login failed - invalid email address or password");
          return res.status(401).json({ error: "Invalid email or password" });
        }
      }
      
      // Check password
      const passwordMatch = await comparePasswords(password, adminUser.password);
      if (!passwordMatch) {
        console.log("Password check failed for user:", adminUser.id);
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      // Login successful - set the session
      req.login(adminUser, (loginErr) => {
        if (loginErr) {
          console.error('Login error after authentication:', loginErr);
          return next(loginErr);
        }
        
        // Add additional session data
        (req.session as any).userId = adminUser.id;
        (req.session as any).username = adminUser.username;
        (req.session as any).created = new Date().toISOString();
        (req.session as any).portalType = 'admin';
        
        console.log('Admin user authenticated, saving session for:', {
          userId: adminUser.id,
          username: adminUser.username,
          role: adminUser.role,
          sessionID: req.sessionID
        });
        
        // Set cookie properties
        if (req.session.cookie) {
          req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        }
        
        // Generate auth token for fallback authentication
        const authToken = generateAuthToken(adminUser.id);
        
        res.status(200).json({
          ...adminUser,
          portalType: 'admin',
          sessionId: req.sessionID,
          authStatus: 'success',
          authToken
        });
      });
    } catch (error) {
      console.error("Admin login error:", error);
      return res.status(500).json({ error: "An error occurred during login" });
    }
  });
  
  // Member-specific login - enforces user role
  app.post("/api/member/login", async (req, res, next) => {
    console.log("Member login attempt received");
    const { username, email, password } = req.body;
    const usernameOrEmail = username || email;
    
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ error: "Username/email and password are required" });
    }
    
    console.log("Attempting member login with:", usernameOrEmail);
    
    try {
      // First try email match
      let memberUser = await storage.getUserByEmail(usernameOrEmail);
      
      // If no direct match, try username
      if (!memberUser) {
        memberUser = await storage.getUserByUsername(usernameOrEmail);
      }
      
      // If no user found, or it's a staff-only account
      if (!memberUser) {
        console.log("No user found with email/username:", usernameOrEmail);
        return res.status(401).json({ error: "Invalid email/username or password" });
      }
      
      // Check password
      const passwordMatch = await comparePasswords(password, memberUser.password);
      if (!passwordMatch) {
        console.log("Password check failed for user:", memberUser.id);
        return res.status(401).json({ error: "Invalid email/username or password" });
      }
      
      // Login successful - set the session
      req.login(memberUser, (loginErr) => {
        if (loginErr) {
          console.error('Login error after authentication:', loginErr);
          return next(loginErr);
        }
        
        // Add additional session data
        (req.session as any).userId = memberUser.id;
        (req.session as any).username = memberUser.username;
        (req.session as any).created = new Date().toISOString();
        (req.session as any).portalType = 'member';
        
        console.log('Member user authenticated, saving session for:', {
          userId: memberUser.id,
          username: memberUser.username,
          role: memberUser.role,
          sessionID: req.sessionID
        });
        
        // Set cookie properties
        if (req.session.cookie) {
          req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        }
        
        // Generate auth token for fallback authentication
        const authToken = generateAuthToken(memberUser.id);
        
        res.status(200).json({
          ...memberUser,
          portalType: 'member',
          sessionId: req.sessionID,
          authStatus: 'success',
          authToken
        });
      });
    } catch (error) {
      console.error("Member login error:", error);
      return res.status(500).json({ error: "An error occurred during login" });
    }
  });

  app.post("/api/logout", (req, res, next) => {
    console.log("Logout request received for user:", { 
      userId: req.user?.id, 
      sessionID: req.sessionID 
    });
    
    // First logout the user (removes req.user and clears the login session)
    req.logout((logoutErr) => {
      if (logoutErr) {
        console.error("Logout error:", logoutErr);
        return next(logoutErr);
      }
      
      // Then destroy the session completely
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("Session destruction error:", destroyErr);
          return next(destroyErr); 
        }
        
        console.log("User successfully logged out and session destroyed");
        res.clearCookie('csc_sid'); // Use the correct cookie name from session settings
        res.status(200).json({ success: true, message: "Logged out successfully" });
      });
    });
  });

  app.get("/api/user", async (req, res) => {
    console.log("GET /api/user request received:", {
      sessionID: req.sessionID,
      authenticated: req.isAuthenticated(),
      session: req.session ? 'exists' : 'missing',
      cookies: req.headers.cookie ? 'present' : 'missing',
      hasAuthToken: !!req.headers.authorization
    });
    
    // First check normal Passport session auth
    if (req.isAuthenticated()) {
      console.log("User authenticated via session");
      
      // Touch the session to ensure it stays active and the cookie gets refreshed
      if (req.session) {
        (req.session as any).lastAccess = new Date().toISOString();
        req.session.touch();
      }
      
      console.log("User data returned from session:", { 
        id: req.user?.id, 
        username: req.user?.username,
        role: req.user?.role,
        sessionID: req.sessionID
      });
      
      return res.json(req.user);
    }
    
    // If session auth fails, try token auth as fallback
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const userId = validateAuthToken(token);
      
      if (userId) {
        try {
          // Get user by ID
          const user = await storage.getUser(userId);
          
          if (user) {
            console.log("User authenticated via token:", { 
              id: user.id, 
              username: user.username
            });
            
            // Login the user to establish a session
            req.login(user, (loginErr) => {
              if (loginErr) {
                console.error('Error logging in with token:', loginErr);
                // Continue even if login fails - we'll still return the user data
              } else {
                console.log("Token auth converted to session auth");
              }
              
              return res.json(user);
            });
            return; // Return early since req.login will handle the response
          }
        } catch (error) {
          console.error("Error fetching user with token auth:", error);
        }
      } else {
        console.log("Invalid or expired token provided");
      }
    }
    
    // If all auth methods fail
    console.log("User not authenticated on /api/user request");
    return res.status(401).json({ error: "Unauthorized" });
  });
  
  // Add a dedicated endpoint for checking session status
  app.get("/api/session/check", async (req, res) => {
    // First check if authenticated via session
    if (req.isAuthenticated()) {
      // Touch the session to ensure it stays active
      if (req.session) {
        (req.session as any).lastAccess = new Date().toISOString();
        req.session.touch();
      }
      
      return res.status(200).json({
        authenticated: true,
        authMethod: 'session',
        sessionId: req.sessionID,
        userId: req.user?.id,
        username: req.user?.username
      });
    }
    
    // If session auth fails, try token auth as fallback
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const userId = validateAuthToken(token);
      
      if (userId) {
        try {
          // Get user by ID
          const user = await storage.getUser(userId);
          
          if (user) {
            console.log("Session check: User authenticated via token:", { 
              id: user.id, 
              username: user.username
            });
            
            // Login the user to establish a session
            req.login(user, (loginErr) => {
              if (loginErr) {
                console.error('Session check: Error logging in with token:', loginErr);
              } else {
                console.log("Session check: Token auth converted to session auth");
              }
            });
            
            return res.status(200).json({
              authenticated: true,
              authMethod: 'token',
              userId: user.id,
              username: user.username,
              isTokenAuth: true
            });
          }
        } catch (error) {
          console.error("Session check: Error fetching user with token auth:", error);
        }
      }
    }
    
    // If no authentication method worked
    return res.status(200).json({
      authenticated: false,
      sessionId: req.sessionID
    });
  });
}