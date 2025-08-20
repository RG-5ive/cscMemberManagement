const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const open = require('open');

// Your Google OAuth credentials - using environment variables
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

// Validate environment variables are set
if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
  console.log('❌ Missing environment variables!');
  console.log('Please set: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI');
  process.exit(1);
}

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Generate the auth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ],
  prompt: 'consent' // Force consent to get refresh token
});

console.log('='.repeat(80));
console.log('GOOGLE CALENDAR OAUTH SETUP');
console.log('='.repeat(80));
console.log();
console.log('STEP 1: Add redirect URI to your Google OAuth settings');
console.log('- Go to Google Cloud Console > APIs & Services > Credentials');
console.log('- Edit your OAuth 2.0 Client ID');
console.log('- Add this redirect URI:', REDIRECT_URI);
console.log();
console.log('STEP 2: Complete OAuth flow');
console.log('- A browser will open automatically');
console.log('- Sign in to Google and authorize the application');
console.log('- You will be redirected back to get your refresh token');
console.log();

// Create a temporary server to handle the OAuth callback
const server = http.createServer(async (req, res) => {
  const query = url.parse(req.url, true).query;
  
  if (req.url.startsWith('/oauth/callback')) {
    if (query.code) {
      try {
        // Exchange authorization code for tokens
        const { tokens } = await oauth2Client.getToken(query.code);
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
              <h2 style="color: green;">✅ OAuth Setup Complete!</h2>
              <p>Your Google Calendar integration is now configured.</p>
              <h3>Copy these values to your environment:</h3>
              <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; font-family: monospace;">
                <strong>GOOGLE_CALENDAR_CLIENT_ID:</strong><br>
                ${CLIENT_ID}<br><br>
                <strong>GOOGLE_CALENDAR_CLIENT_SECRET:</strong><br>
                ${CLIENT_SECRET}<br><br>
                <strong>GOOGLE_CALENDAR_REFRESH_TOKEN:</strong><br>
                ${tokens.refresh_token || 'No refresh token received - try running again with prompt=consent'}
              </div>
              <p>You can close this window and stop the setup script.</p>
            </body>
          </html>
        `);

        console.log();
        console.log('✅ SUCCESS! OAuth tokens received:');
        console.log('='.repeat(50));
        console.log('GOOGLE_CALENDAR_CLIENT_ID:', CLIENT_ID);
        console.log('GOOGLE_CALENDAR_CLIENT_SECRET:', CLIENT_SECRET);
        console.log('GOOGLE_CALENDAR_REFRESH_TOKEN:', tokens.refresh_token || 'No refresh token - try again');
        console.log('='.repeat(50));
        console.log();
        console.log('Add these to your environment variables and restart the application.');
        
        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 1000);
        
      } catch (error) {
        console.error('❌ Error getting tokens:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error getting tokens: ' + error.message);
        server.close();
        process.exit(1);
      }
    } else if (query.error) {
      console.error('❌ OAuth error:', query.error);
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('OAuth error: ' + query.error);
      server.close();
      process.exit(1);
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

// Start the server
server.listen(3000, () => {
  console.log('🚀 OAuth server started on http://localhost:3000');
  console.log('Opening browser for OAuth flow...');
  console.log();
  
  // Open the authorization URL in the default browser
  open(authUrl);
});