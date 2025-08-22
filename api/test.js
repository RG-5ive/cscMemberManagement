// Simple test endpoint to verify functions work
module.exports = async (req, res) => {
  res.json({
    success: true,
    message: "Function is working!",
    method: req.method,
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      envKeys: Object.keys(process.env).filter(key => 
        key.includes('DATABASE') || key.includes('SUPABASE')
      )
    }
  });
}; 