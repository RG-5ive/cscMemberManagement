// Simplest possible test function
export default function handler(req, res) {
  res.status(200).json({
    message: "Simple function works!",
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });
} 