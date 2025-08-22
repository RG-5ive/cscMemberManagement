// Vercel serverless function wrapper for Express app
export default async function handler(req, res) {
  try {
    // Simple response for now to test if functions work
    res.status(200).json({
      message: "API endpoint working",
      path: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
      environment: {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        nodeEnv: process.env.NODE_ENV
      }
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
} 