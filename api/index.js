// Vercel serverless function wrapper for Express app
let expressApp = null;

export default async function handler(req, res) {
  try {
    // Initialize the Express app only once
    if (!expressApp) {
      const { default: app } = await import('../dist/index.js');
      
      // Give the app a moment to finish async initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      expressApp = app;
    }
    
    // Handle the request with the Express app
    expressApp(req, res);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 