import nodemailer from 'nodemailer';
import { log } from './vite';

// Store sent emails for development access
interface MockEmail {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  sentAt: Date;
  code?: string; // Store verification code for easy access
}

// In-memory mock email storage for development
export const mockEmails: MockEmail[] = [];

// Configure email transport based on environment
let transporter: nodemailer.Transporter;
let isUsingMockTransport = false;

// For development, create a mock nodemailer transport that doesn't actually send emails
// but stores them in the mockEmails array and logs them
if (process.env.NODE_ENV !== 'production') {
  isUsingMockTransport = true;
  
  // Create a mock transport that simulates sending but doesn't actually send
  transporter = {
    sendMail: async (mailOptions: any) => {
      // Extract the verification code from the HTML if it exists
      // The regex needs to handle whitespace between the div tags and content
      const codeMatch = mailOptions.html?.match(/<div[^>]*>\s*(\d{7})\s*<\/div>/);
      const verificationCode = codeMatch ? codeMatch[1] : undefined;
      
      // Log the regex matching attempt for debugging
      console.log("Mail HTML code extraction:", { 
        hasHtml: !!mailOptions.html,
        match: codeMatch,
        extractedCode: verificationCode
      });
      
      // Store the email in our mock storage
      const mockEmail: MockEmail = {
        to: mailOptions.to,
        from: mailOptions.from,
        subject: mailOptions.subject,
        html: mailOptions.html,
        text: mailOptions.text,
        sentAt: new Date(),
        code: verificationCode
      };
      
      mockEmails.push(mockEmail);
      
      // Log the mock email being "sent"
      log(`[MOCK EMAIL] To: ${mailOptions.to}`, 'mail');
      log(`[MOCK EMAIL] Subject: ${mailOptions.subject}`, 'mail');
      if (verificationCode) {
        log(`[MOCK EMAIL] Verification Code: ${verificationCode}`, 'mail');
      }
      
      // Return a fake success response
      return {
        messageId: `mock-email-${Date.now()}@localhost`,
        envelope: {
          from: mailOptions.from,
          to: [mailOptions.to]
        },
        accepted: [mailOptions.to],
        rejected: [],
        pending: [],
        response: '250 OK: Message accepted'
      };
    },
    verify: async () => true // Always verify successfully for the mock transport
  } as any; // Type assertion since we're only implementing the methods we need
  
  log('Using mock email transport for development - emails will be logged but not sent', 'mail');
} else {
  // For production, use real SMTP settings
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// Verify the transporter configuration on startup
async function verifyTransporter() {
  try {
    await transporter.verify();
    log('Email service is ready to send messages', 'mail');
    return true;
  } catch (error) {
    log(`Email service configuration error: ${error}`, 'mail');
    return false;
  }
}

// Initialize the email service
export async function initializeMailService() {
  return await verifyTransporter();
}

// Send verification email with code
export async function sendVerificationEmail(
  email: string, 
  firstName: string, 
  lastName: string, 
  code: string
) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'CSC Member Portal Registration Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a73e8;">CSC Member Portal - Email Verification</h2>
          <p>Hello ${firstName} ${lastName},</p>
          <p>Thank you for registering with the CSC Member Portal. To complete your registration, please use the verification code below:</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you did not request this verification code, please ignore this email.</p>
          <p>Regards,<br>CSC Member Portal Team</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    log(`Verification email sent: ${info.messageId}`, 'mail');
    return true;
  } catch (error) {
    log(`Error sending verification email: ${error}`, 'mail');
    return false;
  }
}