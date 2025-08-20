const { google } = require('googleapis');
const http = require('http');
const url = require('url');

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
  prompt: 'consent'
});

console.log('GOOGLE CALENDAR OAUTH SETUP');
console.log('='.repeat(50));
console.log();
console.log('STEP 1: Open this URL in your browser:');
console.log(authUrl);
console.log();
console.log('STEP 2: Complete authorization and come back here');
console.log('The server is running on http://localhost:3000');
console.log();

// Create server to handle OAuth callback
const server = http.createServer(async (req, res) => {
  const query = url.parse(req.url, true).query;
  
  if (req.url.startsWith('/oauth/callback')) {
    if (query.code) {
      try {
        const { tokens } = await oauth2Client.getToken(query.code);
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px;">
              <h2 style="color: green;">✅ OAuth Setup Complete!</h2>
              <h3>Your Google Calendar Credentials:</h3>
              <div style="background: #f0f0f0; padding: 20px; border-radius: 8px; font-family: monospace; margin: 20px 0;">
                <div style="margin-bottom: 15px;">
                  <strong>GOOGLE_CALENDAR_CLIENT_ID:</strong><br>
                  <span style="word-break: break-all;">${CLIENT_ID}</span>
                </div>
                <div style="margin-bottom: 15px;">
                  <strong>GOOGLE_CALENDAR_CLIENT_SECRET:</strong><br>
                  <span style="word-break: break-all;">${CLIENT_SECRET}</span>
                </div>
                <div>
                  <strong>GOOGLE_CALENDAR_REFRESH_TOKEN:</strong><br>
                  <span style="word-break: break-all;">${tokens.refresh_token || 'ERROR: No refresh token received'}</span>
                </div>
              </div>
              <p><strong>Next:</strong> Provide these three values to complete the Google Calendar integration.</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);

        console.log('\n✅ SUCCESS! Here are your credentials:');
        console.log('='.repeat(50));
        console.log('GOOGLE_CALENDAR_CLIENT_ID:', CLIENT_ID);
        console.log('GOOGLE_CALENDAR_CLIENT_SECRET:', CLIENT_SECRET);
        console.log('GOOGLE_CALENDAR_REFRESH_TOKEN:', tokens.refresh_token || 'ERROR: No refresh token');
        console.log('='.repeat(50));
        
        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 2000);
        
      } catch (error) {
        console.error('❌ Error:', error.message);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error: ' + error.message);
      }
    } else if (query.error) {
      console.error('❌ OAuth error:', query.error);
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('OAuth error: ' + query.error);
    }
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px;">
          <h2>Google Calendar OAuth Setup</h2>
          <p>Waiting for authorization...</p>
          <p>If you haven't already, <a href="${authUrl}" target="_blank">click here to authorize</a></p>
        </body>
      </html>
    `);
  }
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
  console.log('Please open the authorization URL above in your browser.');
});