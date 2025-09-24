import nodemailer from 'nodemailer';
import { MailService } from '@sendgrid/mail';
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

// Initialize SendGrid if API key is available
let mailService: MailService | null = null;
let usingSendGrid = false;

if (process.env.SENDGRID_API_KEY) {
  mailService = new MailService();
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
  usingSendGrid = true;
  log('Using SendGrid email service - emails will be sent', 'mail');
} else {
  // Fallback to SMTP if SendGrid is not configured
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  log('Using SMTP email transport - emails will be sent', 'mail');
}

// Verify the email service configuration on startup
async function verifyEmailService() {
  try {
    if (usingSendGrid && mailService) {
      // SendGrid doesn't need verification, just check if API key is set
      log('SendGrid email service is ready to send messages', 'mail');
      return true;
    } else if (transporter) {
      await transporter.verify();
      log('SMTP email service is ready to send messages', 'mail');
      return true;
    } else {
      log('No email service configured', 'mail');
      return false;
    }
  } catch (error) {
    log(`Email service configuration error: ${error}`, 'mail');
    return false;
  }
}

// Initialize the email service
export async function initializeMailService() {
  return await verifyEmailService();
}

// Send verification email with code
export async function sendVerificationEmail(
  email: string, 
  firstName: string, 
  lastName: string, 
  code: string
) {
  try {
    const emailContent = {
      to: email,
      from: process.env.EMAIL_FROM || 'noreply@csc.ca',
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

    if (usingSendGrid && mailService) {
      // Use SendGrid
      await mailService.send(emailContent);
      log(`SendGrid verification email sent to: ${email}`, 'mail');
      log(`Verification code for ${email}: ${code}`, 'mail');
      return true;
    } else if (transporter) {
      // Use SMTP
      const info = await transporter.sendMail(emailContent);
      log(`SMTP verification email sent: ${info.messageId}`, 'mail');
      log(`Verification code for ${email}: ${code}`, 'mail');
      return true;
    } else {
      log('No email service available', 'mail');
      return false;
    }
  } catch (error) {
    log(`Error sending verification email: ${error}`, 'mail');
    return false;
  }
}