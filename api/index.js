// Vercel serverless function wrapper for Express app
const express = require('express');
const { createServer } = require('http');

let app;

// Initialize the Express app (only once)
async function getApp() {
  if (app) return app;
  
  // Import your server setup
  const { registerRoutes } = require('../dist/routes.js');
  const { initializeMailService } = require('../dist/mail-service.js');
  
  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        console.log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
      }
    });
    
    next();
  });

  // Initialize mail service
  try {
    await initializeMailService();
  } catch (error) {
    console.warn('Email service initialization failed:', error.message);
  }

  // Set up all routes
  await registerRoutes(app);

  // Error handling middleware
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error('API Error:', err);
    res.status(status).json({ error: message });
  });

  return app;
}

// Vercel serverless function handler
module.exports = async (req, res) => {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}; 