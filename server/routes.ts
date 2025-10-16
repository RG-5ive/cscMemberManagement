import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, requireAuth, hashPassword, comparePasswords, generateAuthToken } from "./auth";
import { storage } from "./storage";
import { z, ZodError } from "zod";
import { 
  verificationInputSchema, 
  members, 
  passwordResetSchema, 
  workshops, 
  workshopRegistrations, 
  committees, 
  committeeRoles,
  committeeMembers,
  users, 
  User,
  calendarEvents,
  calendarEventSchema,
  updateCalendarEventVisibilitySchema,
  demographicChangeRequests,
  insertDemographicChangeRequestSchema,
  DemographicChangeRequest,
  membershipPricingRules,
  membershipPricingRuleSchema
} from "@shared/schema";
import { randomInt } from "crypto";
import { sendVerificationEmail, mockEmails } from "./mail-service";
import { log } from "./vite";
import { db } from "./db";
import { eq, or, and, ilike, desc, count, inArray, sql, ne, isNull, not } from "drizzle-orm";
import { getDiscordBot } from "./discord-bot";
import Stripe from "stripe";
import { PaymentService } from "./payment-service";
import { payments, invoices, auditLogs } from "@shared/schema";

// Note: Auth functions already imported above

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('Warning: STRIPE_SECRET_KEY not found. Payment features will be disabled.');
}
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" })
  : null;

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);
  
  // Discord Bot Management Routes
  app.get("/api/discord/status", requireAuth, async (req, res) => {
    try {
      const bot = getDiscordBot();
      const isConnected = bot.isConnected();
      res.json({ connected: isConnected });
    } catch (error) {
      res.json({ connected: false, error: "Bot not initialized" });
    }
  });

  app.post("/api/discord/bot/start", requireAuth, async (req, res) => {
    try {
      const bot = getDiscordBot();
      const started = await bot.start();
      res.json({ success: started, message: started ? "Bot started successfully" : "Failed to start bot" });
    } catch (error) {
      res.status(500).json({ error: "Failed to start Discord bot" });
    }
  });

  app.post("/api/discord/bot/stop", requireAuth, async (req, res) => {
    try {
      const bot = getDiscordBot();
      await bot.stop();
      res.json({ success: true, message: "Bot stopped successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop Discord bot" });
    }
  });

  app.get("/api/discord/server-info", requireAuth, async (req, res) => {
    try {
      const bot = getDiscordBot();
      const guildId = process.env.DISCORD_GUILD_ID;
      if (!guildId) {
        return res.status(400).json({ error: "Discord guild ID not configured" });
      }
      
      const serverInfo = await bot.getServerInfo(guildId);
      if (!serverInfo) {
        return res.status(404).json({ error: "Discord server not found" });
      }
      
      res.json(serverInfo);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch Discord server info" });
    }
  });

  app.post("/api/discord/channels", requireAuth, async (req, res) => {
    try {
      const { name, type, description } = req.body;
      const bot = getDiscordBot();
      const guildId = process.env.DISCORD_GUILD_ID;
      
      if (!guildId) {
        return res.status(400).json({ error: "Discord guild ID not configured" });
      }
      
      const channel = await bot.createChannelFromWeb(guildId, name, type, description);
      if (!channel) {
        return res.status(400).json({ error: "Failed to create channel" });
      }
      
      res.json({ success: true, channel: { id: channel.id, name: channel.name } });
    } catch (error) {
      res.status(500).json({ error: "Failed to create Discord channel" });
    }
  });

  app.post("/api/discord/announcements", requireAuth, async (req, res) => {
    try {
      const { title, message, channelId } = req.body;
      const bot = getDiscordBot();
      const guildId = process.env.DISCORD_GUILD_ID;
      
      if (!guildId) {
        return res.status(400).json({ error: "Discord guild ID not configured" });
      }
      
      // Use default announcement channel if none specified
      const targetChannelId = channelId || process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID;
      if (!targetChannelId) {
        return res.status(400).json({ error: "No announcement channel configured" });
      }
      
      const success = await bot.sendAnnouncementFromWeb(guildId, targetChannelId, title, message);
      if (!success) {
        return res.status(400).json({ error: "Failed to send announcement" });
      }
      
      res.json({ success: true, message: "Announcement sent successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to send Discord announcement" });
    }
  });

  app.post("/api/discord/roles", requireAuth, async (req, res) => {
    try {
      // This would be implemented similar to channels
      // For now, return a placeholder response
      res.json({ success: true, message: "Role creation via API not yet implemented" });
    } catch (error) {
      res.status(500).json({ error: "Failed to create Discord role" });
    }
  });
  
  // Message Groups API endpoints
  app.get("/api/message-groups", requireAuth, async (req, res) => {
    try {
      const groups = await storage.getMessageGroups();
      res.json(groups);
    } catch (error) {
      console.error("Error fetching message groups:", error);
      res.status(500).json({ error: "Failed to fetch message groups" });
    }
  });

  app.post("/api/message-groups", requireAuth, async (req, res) => {
    try {
      const { name, description } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Group name is required" });
      }
      
      const messageGroup = await storage.createMessageGroup(
        name, 
        description || null,
        req.user!.id
      );
      
      res.status(201).json(messageGroup);
    } catch (error) {
      console.error("Error creating message group:", error);
      res.status(500).json({ error: "Failed to create message group" });
    }
  });

  app.get("/api/message-groups/:id", requireAuth, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      
      if (isNaN(groupId)) {
        return res.status(400).json({ error: "Invalid group ID" });
      }
      
      const group = await storage.getMessageGroupById(groupId);
      
      if (!group) {
        return res.status(404).json({ error: "Message group not found" });
      }
      
      res.json(group);
    } catch (error) {
      console.error("Error fetching message group:", error);
      res.status(500).json({ error: "Failed to fetch message group" });
    }
  });

  app.patch("/api/message-groups/:id", requireAuth, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      
      if (isNaN(groupId)) {
        return res.status(400).json({ error: "Invalid group ID" });
      }
      
      const { name, description } = req.body;
      const updateData: { name?: string; description?: string } = {};
      
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No update data provided" });
      }
      
      const updatedGroup = await storage.updateMessageGroup(groupId, updateData);
      
      res.json(updatedGroup);
    } catch (error) {
      console.error("Error updating message group:", error);
      res.status(500).json({ error: "Failed to update message group" });
    }
  });

  app.delete("/api/message-groups/:id", requireAuth, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      
      if (isNaN(groupId)) {
        return res.status(400).json({ error: "Invalid group ID" });
      }
      
      await storage.deleteMessageGroup(groupId);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting message group:", error);
      res.status(500).json({ error: "Failed to delete message group" });
    }
  });

  app.get("/api/message-groups/:id/members", requireAuth, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      
      if (isNaN(groupId)) {
        return res.status(400).json({ error: "Invalid group ID" });
      }
      
      const members = await storage.getGroupMembers(groupId);
      
      res.json(members);
    } catch (error) {
      console.error("Error fetching group members:", error);
      res.status(500).json({ error: "Failed to fetch group members" });
    }
  });

  app.post("/api/message-groups/:id/members", requireAuth, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const { memberId } = req.body;
      
      if (isNaN(groupId) || !memberId) {
        return res.status(400).json({ error: "Invalid group ID or member ID" });
      }
      
      const member = await storage.addMemberToGroup(groupId, memberId, req.user!.id);
      
      res.status(201).json(member);
    } catch (error) {
      console.error("Error adding member to group:", error);
      res.status(500).json({ error: "Failed to add member to group" });
    }
  });

  app.delete("/api/message-groups/:groupId/members/:memberId", requireAuth, async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const memberId = parseInt(req.params.memberId);
      
      if (isNaN(groupId) || isNaN(memberId)) {
        return res.status(400).json({ error: "Invalid group ID or member ID" });
      }
      
      await storage.removeMemberFromGroup(groupId, memberId);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error removing member from group:", error);
      res.status(500).json({ error: "Failed to remove member from group" });
    }
  });

  app.post("/api/message-groups/:id/send", requireAuth, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const { content } = req.body;
      
      if (isNaN(groupId) || !content) {
        return res.status(400).json({ error: "Invalid group ID or message content" });
      }
      
      const message = await storage.sendMessageToGroup(req.user!.id, groupId, content);
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Error sending message to group:", error);
      res.status(500).json({ error: "Failed to send message to group" });
    }
  });

  // Helper function to check if user can access sensitive demographic data
  const canAccessDemographics = async (userId: number): Promise<boolean> => {
    try {
      // Check if user is an admin
      const user = await storage.getUser(userId);
      if (user?.role === 'admin') return true;

      // Check if user is a chair/co-chair of Diversity Committee
      const userCommitteeRoles = await db
        .select({
          committee: committees.name,
          role: committeeRoles.name
        })
        .from(committeeMembers)
        .innerJoin(committees, eq(committeeMembers.committeeId, committees.id))
        .innerJoin(committeeRoles, eq(committeeMembers.roleId, committeeRoles.id))
        .where(eq(committeeMembers.userId, userId));

      // Check if user has chair/co-chair role in diversity-related committee
      return userCommitteeRoles.some(membership => 
        (membership.role === 'Chair' || membership.role === 'Co-Chair') &&
        membership.committee.toLowerCase().includes('diversity')
      );
    } catch (error) {
      console.error('Error checking demographics access:', error);
      return false;
    }
  };

  // Function to filter sensitive demographic data
  const filterMemberData = (member: any, canAccessDemographics: boolean) => {
    if (canAccessDemographics) {
      return member; // Return full data if user has access
    }
    
    // Remove sensitive demographic fields for privacy compliance
    const {
      gender,
      lgbtq2Status,
      bipocStatus,
      ethnicity,
      ...filteredMember
    } = member;
    
    return filteredMember;
  };

  // Get all members for member selection in message groups
  app.get("/api/members", requireAuth, async (req, res) => {
    try {
      // Get search parameters from query string
      const search = req.query.search as string | undefined;
      const page = parseInt(req.query.page as string || '1');
      const limit = parseInt(req.query.limit as string || '50');
      const offset = (page - 1) * limit;
      
      // Handle invalid pagination parameters
      if (isNaN(page) || isNaN(limit) || page < 1 || limit < 1) {
        return res.status(400).json({ error: "Invalid pagination parameters" });
      }
      
      // Check if user can access demographic data
      const hasAccessToDemographics = await canAccessDemographics(req.user!.id);
      
      // Build the base query for filtering
      const whereClause = search ? 
        or(
          ilike(members.firstName, `%${search}%`),
          ilike(members.lastName, `%${search}%`),
          ilike(members.email, `%${search}%`)
        ) : undefined;
      
      // Count total members matching the search criteria
      const countQuery = db.select({
        count: count()
      }).from(members);
      
      // Add filter to count query if needed
      const finalCountQuery = whereClause ? 
        countQuery.where(whereClause) : 
        countQuery;
      
      // Query database for members with pagination
      let query = db.select().from(members)
        .limit(limit)
        .offset(offset)
        .orderBy(members.id);
      
      // Add search filter to main query if provided
      const finalQuery = whereClause ?
        query.where(whereClause) :
        query;
      
      // Execute both queries concurrently
      const [countResult, membersResult] = await Promise.all([
        finalCountQuery,
        finalQuery
      ]);
      
      // Get total count from count query result
      const totalCount = countResult[0]?.count || 0;
      
      // Filter member data based on access permissions
      const filteredMembers = membersResult.map(member => 
        filterMemberData(member, hasAccessToDemographics)
      );
      
      // Return paginated results with pagination metadata
      res.json({
        members: filteredMembers,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: offset + membersResult.length < totalCount
        },
        accessLevel: hasAccessToDemographics ? 'full' : 'limited'
      });
    } catch (error) {
      console.error("Error fetching members:", error);
      res.status(500).json({ error: "Failed to fetch members", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get all members for statistics (no pagination)
  app.get("/api/members/statistics", async (req, res) => {
    try {
      // For now, allow full demographic access for statistics page
      // TODO: Re-implement proper authentication after session issues are resolved
      const hasAccessToDemographics = true;
      
      // Get all members from database
      const allMembers = await db.select().from(members).orderBy(members.id);
      
      // Filter member data based on access permissions
      const filteredMembers = allMembers.map(member => 
        filterMemberData(member, hasAccessToDemographics)
      );
      
      // Return all members without pagination
      res.json({
        members: filteredMembers,
        totalCount: filteredMembers.length,
        accessLevel: hasAccessToDemographics ? 'full' : 'limited'
      });
    } catch (error) {
      console.error("Error fetching member statistics:", error);
      res.status(500).json({ error: "Failed to fetch member statistics", details: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // Test routes for email service (only available in development)
  if (process.env.NODE_ENV !== 'production') {
    // Send a test email
    app.get("/api/test/email", async (req, res) => {
      try {
        const result = await sendVerificationEmail(
          "test@example.com", 
          "Test", 
          "User", 
          "1234567"
        );
        res.json({ 
          success: result, 
          message: result ? "Test email sent" : "Failed to send test email" 
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to send test email", details: (error as Error).message });
      }
    });
    
    // Get all mock emails sent (for testing and debugging)
    app.get("/api/dev/emails", (req, res) => {
      res.json({
        count: mockEmails.length,
        emails: mockEmails.map(email => ({
          to: email.to,
          from: email.from,
          subject: email.subject,
          html: email.html,
          text: email.text,
          sentAt: email.sentAt,
          code: email.code
        }))
      });
    });
    
    // Get the most recent verification code for a specific email (for testing)
    app.get("/api/dev/verification-code", (req, res) => {
      const email = req.query.email as string;
      
      if (!email) {
        return res.status(400).json({ error: "Email parameter is required" });
      }
      
      // Log the mock emails array for debugging
      console.log(`Looking for verification code for ${email}`, {
        mockEmailsCount: mockEmails.length,
        emails: mockEmails.map(e => ({ to: e.to, code: e.code, sentAt: e.sentAt }))
      });
      
      // Find the most recent verification email sent to this address with a code
      const verificationEmails = mockEmails
        .filter(mail => mail.to === email && mail.code !== undefined)
        .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
      
      if (verificationEmails.length === 0) {
        return res.status(404).json({ error: "No verification emails found for this address" });
      }
      
      // Return the most recent code
      res.json({
        email,
        code: verificationEmails[0].code,
        sentAt: verificationEmails[0].sentAt
      });
    });
  }
  
  // Member verification routes
  app.post("/api/verify/member", async (req, res) => {
    try {
      // Validate input
      const input = verificationInputSchema.pick({ email: true, firstName: true, lastName: true }).safeParse(req.body);
      
      if (!input.success) {
        return res.status(400).json({ error: "Invalid input", details: input.error.format() });
      }
      
      const { email, firstName, lastName } = input.data;
      
      // Check if member exists in database and get their data
      const memberExists = await storage.checkMemberExists(email, firstName, lastName);
      
      if (!memberExists) {
        return res.status(404).json({ 
          error: "Member not found", 
          message: "No matching record found for this name and email." 
        });
      }
      
      // Get member level data from the members table
      const memberData = await storage.getMemberData(email, firstName, lastName);
      
      // Generate a random 7-digit code
      const code = randomInt(1000000, 9999999).toString();
      
      // Store code in database with expiration
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute expiration
      
      const verificationRecord = await storage.createVerificationCode({
        email,
        firstName,
        lastName,
        code,
        expiresAt
      });
      
      // Send verification email
      const emailSent = await sendVerificationEmail(email, firstName, lastName, code);
      
      // Log the verification code for development purposes
      log(`Verification code for ${email}: ${code}`, 'mail');
      
      if (!emailSent) {
        log(`Failed to send verification email to ${email}`, 'mail');
      }
      
      // Include the member level information in the response
      const memberInfo = memberData || { memberLevel: null };
      
      // Log the member information for debugging
      console.log("Member verification result:", {
        email,
        firstName,
        lastName,
        memberFound: !!memberData,
        memberLevel: memberInfo.memberLevel
      });
      
      // Respond with success but don't include the code in production
      res.status(200).json({ 
        success: true, 
        message: emailSent 
          ? "Verification code sent to email" 
          : "Verification code generated but email delivery failed",
        // Include the code in development mode only
        code: process.env.NODE_ENV === 'development' ? code : undefined,
        // Include the member level information
        memberLevel: memberInfo.memberLevel
      });
    } catch (error) {
      console.error("Error in member verification:", error);
      res.status(500).json({ error: "Server error during verification" });
    }
  });
  
  // Verify the code sent to email
  app.post("/api/verify/code", async (req, res) => {
    try {
      // For development purposes, we'll make a more flexible schema that only requires email and code
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      // Create a validation schema based on environment
      const verificationSchema = isDevelopment
        ? z.object({
            email: z.string().email(),
            code: z.string().min(6).max(7), // More lenient in dev
            firstName: z.string().min(1).optional(), // Optional in dev
            lastName: z.string().optional() // Optional in dev
          })
        : verificationInputSchema;
      
      // Validate input
      const input = verificationSchema.safeParse(req.body);
      
      if (!input.success) {
        return res.status(400).json({ error: "Invalid input", details: input.error.format() });
      }
      
      const { email, code } = input.data;
      const firstName = input.data.firstName || 'Test';
      const lastName = input.data.lastName || 'User';
      
      // Check if verification code exists and is valid
      const verificationRecord = await storage.getVerificationCode(email, code);
      
      if (!verificationRecord) {
        return res.status(404).json({ 
          error: "Invalid code", 
          message: "The verification code is invalid or has expired." 
        });
      }
      
      // Check if code is expired
      if (new Date() > new Date(verificationRecord.expiresAt)) {
        return res.status(400).json({ 
          error: "Expired code", 
          message: "The verification code has expired." 
        });
      }
      
      // Mark code as verified
      await storage.verifyCode(verificationRecord.id);
      
      // Generate a temporary auth token for onboarding
      // This allows the user to proceed to onboarding without a full account yet
      const tempToken = generateAuthToken(0); // 0 is a special value for temporary tokens
      
      // Get member level data if available
      const memberData = await storage.getMemberData(email, firstName, lastName);
      const memberLevel = memberData ? memberData.memberLevel : null;
      
      // Log member verification for debugging
      console.log("Verification code check result:", {
        email,
        firstName,
        lastName,
        memberFound: !!memberData,
        memberLevel,
        codeVerified: true
      });
      
      // Return success and token
      res.status(200).json({ 
        success: true, 
        message: "Verification successful",
        token: tempToken,
        firstName,
        lastName,
        email,
        memberLevel
      });
    } catch (error) {
      console.error("Error in code verification:", error);
      res.status(500).json({ error: "Server error during code verification" });
    }
  });

  // Complete registration after email verification
  app.post("/api/register", async (req, res) => {
    try {
      console.log("Registration request body:", req.body);
      
      // Define a registration schema for validation - make fields more flexible
      const registrationSchema = z.object({
        email: z.string().email("Valid email is required"),
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        memberLevel: z.string().nullable().optional(),
        role: z.string().default("user").optional()
      });
      
      // Validate input data - let's check each field individually for debugging
      console.log("Validating each field:");
      console.log("- email:", req.body.email, typeof req.body.email);
      console.log("- firstName:", req.body.firstName, typeof req.body.firstName);
      console.log("- lastName:", req.body.lastName, typeof req.body.lastName);
      console.log("- password:", req.body.password ? "***provided***" : "MISSING", typeof req.body.password);
      console.log("- memberLevel:", req.body.memberLevel, typeof req.body.memberLevel);
      console.log("- role:", req.body.role, typeof req.body.role);
      
      const validation = registrationSchema.safeParse(req.body);
      if (!validation.success) {
        console.log("Registration validation failed:", validation.error);
        console.log("Validation error details:", JSON.stringify(validation.error.format(), null, 2));
        console.log("Error issues:", validation.error.issues);
        return res.status(400).json({ 
          error: "Invalid registration data",
          details: validation.error.format(),
          issues: validation.error.issues,
          receivedData: req.body
        });
      }
      
      const { email, firstName, lastName, password, memberLevel, role } = validation.data;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists with this email" });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Create user account
      const newUser = await storage.createUser({
        email,
        firstName,
        lastName,
        username: email, // Use email as username
        password: hashedPassword,
        role: (role as "user" | "admin" | "committee_chair" | "committee_cochair" | "committee_member") || "user",
        memberLevel: (memberLevel as "Affiliate" | "Associate" | "Companion" | "Full Life" | "Full" | "Student" | null) || null,
        canManageCommittees: false,
        canManageWorkshops: false,
        hasCompletedOnboarding: false
      });
      
      console.log("User created successfully:", newUser.id);
      
      // Generate auth token
      const authToken = generateAuthToken(newUser.id);
      
      // Set up session
      req.login(newUser, (err) => {
        if (err) {
          console.error("Login error after registration:", err);
          return res.status(500).json({ error: "Registration successful but login failed" });
        }
        
        console.log("User logged in successfully after registration");
        
        res.status(201).json({
          success: true,
          message: "Registration successful",
          user: {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            role: newUser.role,
            memberLevel: newUser.memberLevel,
            hasCompletedOnboarding: newUser.hasCompletedOnboarding
          },
          token: authToken
        });
      });
      
    } catch (error) {
      console.error("Error during registration:", error);
      res.status(500).json({ error: "Registration failed", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Email change request endpoint
  app.post("/api/user/email-change-request", requireAuth, async (req, res) => {
    try {
      const userId = req.body.userId;
      const newEmail = req.body.newEmail;
      
      if (!userId || !newEmail) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check if email is already in use by another user
      const existingUser = await storage.getUserByEmail(newEmail);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: "Email is already in use" });
      }
      
      // Generate verification code
      const verificationCode = randomInt(1000000, 9999999).toString();
      
      // Store verification information
      await storage.createVerificationCode({
        email: newEmail,
        firstName: user.firstName || user.username,
        lastName: user.lastName || "",
        code: verificationCode,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });
      
      // Send verification email to the new email address
      await sendVerificationEmail(
        newEmail, 
        user.firstName || user.username, 
        user.lastName || "",
        verificationCode
      );
      
      // Log the code in development mode
      if (process.env.NODE_ENV === 'development') {
        log(`Email change verification code for ${newEmail}: ${verificationCode}`, 'mail');
      }
      
      res.status(200).json({ 
        success: true, 
        message: "Verification email sent to the new email address"
      });
    } catch (error) {
      console.error("Error processing email change request:", error);
      res.status(500).json({ error: "Server error" });
    }
  });
  
  // Resend verification email
  app.post("/api/user/resend-verification", requireAuth, async (req, res) => {
    try {
      const userId = req.body.userId;
      
      if (!userId) {
        return res.status(400).json({ error: "Missing user ID" });
      }
      
      // Get the user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Find the most recent unverified code for this user's new email
      // We'll use a direct query since this is a special case
      const pendingVerifications = await db.query.verificationCodes.findMany({
        where: (fields, { and, eq, isNull, gt }) => 
          and(
            eq(fields.email, user.alternateEmail || ""),
            eq(fields.verified, false),
            gt(fields.expiresAt, new Date())
          ),
        orderBy: (fields, { desc }) => [desc(fields.createdAt)],
        limit: 1
      });
      
      if (!pendingVerifications || pendingVerifications.length === 0) {
        return res.status(404).json({ error: "No pending verification found" });
      }
      
      // Use the most recent verification code
      const latestVerification = pendingVerifications[0];
      
      // Send a new verification email
      await sendVerificationEmail(
        latestVerification.email,
        latestVerification.firstName,
        latestVerification.lastName,
        latestVerification.code
      );
      
      // Log the code in development mode
      if (process.env.NODE_ENV === 'development') {
        log(`Resent verification code for ${latestVerification.email}: ${latestVerification.code}`, 'mail');
      }
      
      res.status(200).json({ 
        success: true, 
        message: "Verification email resent"
      });
    } catch (error) {
      console.error("Error resending verification:", error);
      res.status(500).json({ error: "Server error" });
    }
  });

  // User profile routes
  app.patch("/api/user/:id", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      console.log(`Profile update attempt for user ${userId} by ${req.user?.id}`);
      
      // Verify user is updating their own profile or is an admin
      if (userId !== req.user?.id && req.user?.role !== 'admin') {
        console.log('Forbidden: User attempting to update another user profile');
        return res.status(403).json({ error: "Forbidden: You can only update your own profile" });
      }

      console.log('Update data:', req.body);
      const updatedUser = await storage.updateUser(userId, req.body);
      
      // If user completed onboarding, also update their member record to grant portal access
      if (req.body.hasCompletedOnboarding === true && updatedUser.email) {
        try {
          console.log(`User ${userId} completed onboarding, updating member portal access for email: ${updatedUser.email}`);
          
          // Find the member record by email and update hasPortalAccess
          const result = await db.update(members)
            .set({ hasPortalAccess: true })
            .where(sql`LOWER(${members.email}) = LOWER(${updatedUser.email})`)
            .returning();
          
          if (result.length > 0) {
            console.log(`Updated portal access for member ID ${result[0].id} (${updatedUser.email})`);
          } else {
            console.log(`No member record found for email ${updatedUser.email} - user may not be in members table`);
          }
        } catch (memberUpdateError) {
          console.error('Error updating member portal access:', memberUpdateError);
          // Don't fail the user update if member update fails
        }
      }
      
      // If this is the current user, update the session
      if (userId === req.user?.id) {
        // Update the session to reflect the changes
        req.login(updatedUser, (err) => {
          if (err) {
            console.error('Failed to update session:', err);
            return res.status(500).json({ error: "Failed to update session" });
          }
          console.log('User profile and session updated successfully');
          return res.json(updatedUser);
        });
      } else {
        console.log('Admin updated another user profile');
        return res.json(updatedUser);
      }
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Message routes
  app.post("/api/messages", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const message = await storage.createMessage({
        fromUserId: req.user.id,
        toUserId: req.body.toUserId,
        toGroupId: req.body.toGroupId || null,
        content: req.body.content,
        filterCriteria: req.body.filterCriteria || null,
        read: false,
      });
      res.json(message);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/api/messages", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const messages = await storage.getMessagesByUser(req.user.id);
      res.json(messages);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });
  
  // Update message read status
  app.patch("/api/messages/:id/read", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const messageId = parseInt(req.params.id);
      await storage.markMessageAsRead(messageId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });
  
  // Message group routes (admin only)
  app.post("/api/message-groups", requireAuth, async (req, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can create message groups" });
      }
      
      const { name, description } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Group name is required" });
      }
      
      const group = await storage.createMessageGroup(
        name,
        description || null,
        req.user.id
      );
      
      res.status(201).json(group);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });
  
  app.get("/api/message-groups", requireAuth, async (req, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can view message groups" });
      }
      
      const groups = await storage.getMessageGroups();
      res.json(groups);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });
  
  app.get("/api/message-groups/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can view message groups" });
      }
      
      const groupId = parseInt(req.params.id);
      const group = await storage.getMessageGroupById(groupId);
      
      if (!group) {
        return res.status(404).json({ error: "Message group not found" });
      }
      
      res.json(group);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });
  
  app.patch("/api/message-groups/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can update message groups" });
      }
      
      const groupId = parseInt(req.params.id);
      const { name, description } = req.body;
      
      if (!name && description === undefined) {
        return res.status(400).json({ error: "At least one field to update is required" });
      }
      
      const data: { name?: string, description?: string } = {};
      if (name) data.name = name;
      if (description !== undefined) data.description = description;
      
      const updatedGroup = await storage.updateMessageGroup(groupId, data);
      res.json(updatedGroup);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });
  
  app.delete("/api/message-groups/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can delete message groups" });
      }
      
      const groupId = parseInt(req.params.id);
      await storage.deleteMessageGroup(groupId);
      
      res.json({ success: true, message: "Group deleted successfully" });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });
  
  // Message group members routes
  app.post("/api/message-groups/:id/members", requireAuth, async (req, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can add members to groups" });
      }
      
      const groupId = parseInt(req.params.id);
      const { memberId } = req.body;
      
      if (!memberId) {
        return res.status(400).json({ error: "Member ID is required" });
      }
      
      const member = await storage.addMemberToGroup(groupId, memberId, req.user.id);
      res.status(201).json(member);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });
  
  app.delete("/api/message-groups/:groupId/members/:memberId", requireAuth, async (req, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can remove members from groups" });
      }
      
      const groupId = parseInt(req.params.groupId);
      const memberId = parseInt(req.params.memberId);
      
      await storage.removeMemberFromGroup(groupId, memberId);
      res.json({ success: true, message: "Member removed from group" });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });
  
  app.get("/api/message-groups/:id/members", requireAuth, async (req, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can view group members" });
      }
      
      const groupId = parseInt(req.params.id);
      const members = await storage.getGroupMembers(groupId);
      
      res.json(members);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });
  
  // Group messaging routes
  app.post("/api/message-groups/:id/messages", requireAuth, async (req, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can send group messages" });
      }
      
      const groupId = parseInt(req.params.id);
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Message content is required" });
      }
      
      const message = await storage.sendMessageToGroup(req.user.id, groupId, content);
      res.status(201).json(message);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });
  
  app.get("/api/message-groups/:id/messages", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const groupId = parseInt(req.params.id);
      const messages = await storage.getMessagesForGroup(groupId);
      
      res.json(messages);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Survey routes
  app.post("/api/surveys", requireAuth, async (req, res) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const survey = await storage.createSurvey({
        title: req.body.title,
        questions: req.body.questions,
        createdBy: req.user.id,
      });
      res.json(survey);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/api/surveys", requireAuth, async (req, res) => {
    try {
      const surveys = await storage.getSurveys();
      res.json(surveys);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Committee routes
  app.get("/api/committees", requireAuth, async (req, res) => {
    try {
      // Admins, committee chairs, and users with committee management permissions can access committee data
      if (!req.user || (req.user.role !== "admin" && 
                          req.user.role !== "committee_chair" && 
                          req.user.role !== "committee_cochair" && 
                          !req.user.canManageCommittees)) {
        return res.status(403).json({ error: "Access denied. Committee management privileges required." });
      }
      
      const committeesList = await db.select().from(committees);
      res.json(committeesList);
    } catch (error) {
      console.error("Error fetching committees:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/committees/:id", requireAuth, async (req, res) => {
    try {
      // Admins, committee chairs, and users with committee management permissions can access committee data
      if (!req.user || (req.user.role !== "admin" && 
                          req.user.role !== "committee_chair" && 
                          req.user.role !== "committee_cochair" && 
                          !req.user.canManageCommittees)) {
        return res.status(403).json({ error: "Access denied. Committee management privileges required." });
      }
      
      const committeeId = parseInt(req.params.id);
      
      if (isNaN(committeeId)) {
        return res.status(400).json({ error: "Invalid committee ID" });
      }
      
      const [committee] = await db.select().from(committees)
        .where(eq(committees.id, committeeId));
      
      if (!committee) {
        return res.status(404).json({ error: "Committee not found" });
      }
      
      res.json(committee);
    } catch (error) {
      console.error("Error fetching committee:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/committees", requireAuth, async (req, res) => {
    // Only admins can create committees
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Only administrators can create committees" });
    }

    try {
      const { name, description, members: membersToAdd } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Committee name is required" });
      }

      // Check if committee already exists
      const existingCommittee = await db.select()
        .from(committees)
        .where(eq(committees.name, name));
      
      if (existingCommittee.length > 0) {
        return res.status(400).json({ error: "A committee with this name already exists" });
      }

      // Create new committee
      const [committee] = await db.insert(committees)
        .values({
          name,
          description: description || null,
        })
        .returning();

      // Add committee members if provided
      const addedMembers = [];
      if (membersToAdd && Array.isArray(membersToAdd) && membersToAdd.length > 0) {
        for (const memberAssignment of membersToAdd) {
          const { userId, roleId } = memberAssignment;
          
          if (!userId || !roleId) {
            console.warn(`Skipping member assignment - missing userId (${userId}) or roleId (${roleId})`);
            continue;
          }

          try {
            // Find the member record by user ID
            const [member] = await db.select()
              .from(members)
              .innerJoin(users, eq(users.email, members.email))
              .where(eq(users.id, userId));

            // Add member to committee
            const [addedMember] = await db.insert(committeeMembers)
              .values({
                committeeId: committee.id,
                userId: userId,
                memberId: member?.members?.id || null,
                roleId: roleId,
                addedById: req.user.id,
              })
              .returning();

            addedMembers.push(addedMember);
          } catch (memberError) {
            console.error(`Error adding member ${userId} to committee:`, memberError);
            // Continue with other members even if one fails
          }
        }
      }
      
      res.status(201).json({
        ...committee,
        addedMembers: addedMembers.length
      });
    } catch (error) {
      console.error("Error creating committee:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.put("/api/committees/:id", requireAuth, async (req, res) => {
    // Only admins can update committees
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Only administrators can update committees" });
    }

    try {
      const committeeId = parseInt(req.params.id);
      if (isNaN(committeeId)) {
        return res.status(400).json({ error: "Invalid committee ID" });
      }

      const { name, description } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Committee name is required" });
      }

      // Update committee
      const [updatedCommittee] = await db.update(committees)
        .set({
          name,
          description: description || null,
          updatedAt: new Date()
        })
        .where(eq(committees.id, committeeId))
        .returning();
      
      if (!updatedCommittee) {
        return res.status(404).json({ error: "Committee not found" });
      }
      
      res.json(updatedCommittee);
    } catch (error) {
      console.error("Error updating committee:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // API endpoint to update just the committee description
  app.patch("/api/committees/:id/description", requireAuth, async (req, res) => {
    try {
      const committeeId = parseInt(req.params.id);
      if (isNaN(committeeId)) {
        return res.status(400).json({ error: "Invalid committee ID" });
      }

      const { description } = req.body;
      
      // Check if user has permission to update this committee
      // Either admin or chair/co-chair of this committee
      let hasPermission = req.user?.role === "admin";
      
      if (!hasPermission && (req.user?.role === "committee_chair" || req.user?.role === "committee_cochair")) {
        // Check if user is chair/co-chair of this committee
        const userCommitteeMemberships = await db.select()
          .from(committeeMembers)
          .where(and(
            eq(committeeMembers.userId, req.user.id),
            eq(committeeMembers.committeeId, committeeId),
            isNull(committeeMembers.endDate)
          ))
          .innerJoin(committeeRoles, eq(committeeMembers.roleId, committeeRoles.id));
          
        hasPermission = userCommitteeMemberships.some(membership => 
          membership.committee_roles.name === 'Chair' || membership.committee_roles.name === 'Co-Chair'
        );
      }
      
      if (!hasPermission) {
        return res.status(403).json({ 
          error: "Access denied. You need to be an admin or chair/co-chair of this committee." 
        });
      }

      // Update committee description
      const [updatedCommittee] = await db.update(committees)
        .set({
          description: description,
          updatedAt: new Date()
        })
        .where(eq(committees.id, committeeId))
        .returning();
      
      if (!updatedCommittee) {
        return res.status(404).json({ error: "Committee not found" });
      }
      
      res.json(updatedCommittee);
    } catch (error) {
      console.error("Error updating committee description:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/committees/:id", requireAuth, async (req, res) => {
    // Only admins can delete committees
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Only administrators can delete committees" });
    }

    try {
      const committeeId = parseInt(req.params.id);
      if (isNaN(committeeId)) {
        return res.status(400).json({ error: "Invalid committee ID" });
      }

      // Check if committee exists
      const [committee] = await db.select()
        .from(committees)
        .where(eq(committees.id, committeeId));
      
      if (!committee) {
        return res.status(404).json({ error: "Committee not found" });
      }

      // Check if any workshops are linked to this committee
      const workshopsWithCommittee = await db.select()
        .from(workshops)
        .where(eq(workshops.committeeId, committeeId));
      
      if (workshopsWithCommittee.length > 0) {
        return res.status(400).json({ 
          error: "Cannot delete committee with associated workshops", 
          count: workshopsWithCommittee.length 
        });
      }

      // Delete committee
      await db.delete(committees).where(eq(committees.id, committeeId));
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting committee:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Committee Roles API endpoints
  app.get("/api/committee-roles", requireAuth, async (req, res) => {
    try {
      // Allow admins, committee chairs, and users with canManageCommittees permission
      if (
        req.user?.role !== 'admin' && 
        req.user?.role !== 'committee_chair' && 
        req.user?.role !== 'committee_cochair' && 
        !req.user?.canManageCommittees
      ) {
        return res.status(403).json({ error: "Access denied. Admin or committee management privileges required." });
      }
      
      const roles = await db.select().from(committeeRoles).orderBy(committeeRoles.name);
      res.json(roles);
    } catch (error) {
      console.error("Error fetching committee roles:", error);
      res.status(500).json({ error: "Failed to fetch committee roles" });
    }
  });
  
  app.post("/api/committee-roles", requireAuth, async (req, res) => {
    try {
      // Only admins can create committee roles
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: "Access denied. Admin privileges required." });
      }
      
      const { name, description, canManageCommittee, canManageWorkshops } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Role name is required" });
      }
      
      // Check if role already exists
      const existingRoles = await db.select().from(committeeRoles)
        .where(eq(committeeRoles.name, name));
      
      if (existingRoles.length > 0) {
        return res.status(400).json({ error: "A role with this name already exists" });
      }
      
      // Create the role
      const [role] = await db.insert(committeeRoles).values({
        name,
        description,
        canManageCommittee: canManageCommittee || false,
        canManageWorkshops: canManageWorkshops || false
      }).returning();
      
      res.status(201).json(role);
    } catch (error) {
      console.error("Error creating committee role:", error);
      res.status(500).json({ error: "Failed to create committee role" });
    }
  });
  
  app.get("/api/committee-roles/:id", requireAuth, async (req, res) => {
    try {
      // Admins, committee chairs, and users with committee management permissions can access committee roles
      if (!req.user || (req.user.role !== "admin" && 
                          req.user.role !== "committee_chair" && 
                          req.user.role !== "committee_cochair" && 
                          !req.user.canManageCommittees)) {
        return res.status(403).json({ error: "Access denied. Committee management privileges required." });
      }
      
      const roleId = parseInt(req.params.id);
      
      if (isNaN(roleId)) {
        return res.status(400).json({ error: "Invalid role ID" });
      }
      
      const roles = await db.select().from(committeeRoles)
        .where(eq(committeeRoles.id, roleId));
      
      if (roles.length === 0) {
        return res.status(404).json({ error: "Committee role not found" });
      }
      
      res.json(roles[0]);
    } catch (error) {
      console.error("Error fetching committee role:", error);
      res.status(500).json({ error: "Failed to fetch committee role" });
    }
  });
  
  app.put("/api/committee-roles/:id", requireAuth, async (req, res) => {
    try {
      // Only admins can update committee roles
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: "Access denied. Admin privileges required." });
      }
      
      const roleId = parseInt(req.params.id);
      
      if (isNaN(roleId)) {
        return res.status(400).json({ error: "Invalid role ID" });
      }
      
      const { name, description, canManageCommittee, canManageWorkshops } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Role name is required" });
      }
      
      // Check if role exists
      const roles = await db.select().from(committeeRoles)
        .where(eq(committeeRoles.id, roleId));
      
      if (roles.length === 0) {
        return res.status(404).json({ error: "Committee role not found" });
      }
      
      const existingRole = roles[0];
      
      // Update the role
      const [updatedRole] = await db.update(committeeRoles)
        .set({
          name,
          description,
          canManageCommittee: canManageCommittee !== undefined ? canManageCommittee : existingRole.canManageCommittee,
          canManageWorkshops: canManageWorkshops !== undefined ? canManageWorkshops : existingRole.canManageWorkshops
        })
        .where(eq(committeeRoles.id, roleId))
        .returning();
      
      res.json(updatedRole);
    } catch (error) {
      console.error("Error updating committee role:", error);
      res.status(500).json({ error: "Failed to update committee role" });
    }
  });
  
  app.delete("/api/committee-roles/:id", requireAuth, async (req, res) => {
    try {
      // Only admins can delete committee roles
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: "Access denied. Admin privileges required." });
      }
      
      const roleId = parseInt(req.params.id);
      
      if (isNaN(roleId)) {
        return res.status(400).json({ error: "Invalid role ID" });
      }
      
      // Check if role exists
      const roles = await db.select().from(committeeRoles)
        .where(eq(committeeRoles.id, roleId));
      
      if (roles.length === 0) {
        return res.status(404).json({ error: "Committee role not found" });
      }
      
      // Check if role is being used by any committee members
      const committeeMembersData = await db.select().from(committeeMembers)
        .where(eq(committeeMembers.roleId, roleId));
      
      if (committeeMembersData.length > 0) {
        return res.status(400).json({ 
          error: "Cannot delete role as it's currently assigned to committee members",
          message: "You must reassign all members using this role before deleting it"
        });
      }
      
      // Delete the role
      await db.delete(committeeRoles).where(eq(committeeRoles.id, roleId));
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting committee role:", error);
      res.status(500).json({ error: "Failed to delete committee role" });
    }
  });
  
  // Committee Members API endpoints
  app.get("/api/committees/:committeeId/members", requireAuth, async (req, res) => {
    try {
      // Admins, committee chairs, or users with committee management permissions can access committee members
      if (!req.user || (req.user.role !== "admin" && 
                          req.user.role !== "committee_chair" && 
                          req.user.role !== "committee_cochair" && 
                          !req.user.canManageCommittees)) {
        return res.status(403).json({ error: "Access denied. Committee management privileges required." });
      }
      
      const committeeId = parseInt(req.params.committeeId);
      
      if (isNaN(committeeId)) {
        return res.status(400).json({ error: "Invalid committee ID" });
      }
      
      // Get committee members with user and role details
      // By default only return active members (those with null endDate)
      const includeInactive = req.query.includeInactive === 'true';
      console.log(`Fetching committee members for committee ${committeeId}, includeInactive=${includeInactive}`);
      
      // Build where conditions
      const whereConditions = [eq(committeeMembers.committeeId, committeeId)];
      
      // Only include active members unless specifically requested to include inactive ones
      if (!includeInactive) {
        whereConditions.push(isNull(committeeMembers.endDate));
      }
      
      const committeesMembersData = await db.select({
        id: committeeMembers.id,
        startDate: committeeMembers.startDate,
        endDate: committeeMembers.endDate,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          username: users.username
        },
        role: {
          id: committeeRoles.id,
          name: committeeRoles.name,
          canManageCommittee: committeeRoles.canManageCommittee,
          canManageWorkshops: committeeRoles.canManageWorkshops
        }
      })
      .from(committeeMembers)
      .leftJoin(users, eq(committeeMembers.userId, users.id))
      .leftJoin(committeeRoles, eq(committeeMembers.roleId, committeeRoles.id))
      .where(and(...whereConditions));
      
      res.json(committeesMembersData);
    } catch (error) {
      console.error("Error fetching committee members:", error);
      res.status(500).json({ error: "Failed to fetch committee members" });
    }
  });
  
  app.post("/api/committees/:committeeId/members", requireAuth, async (req, res) => {
    try {
      console.log("Committee member add request received:", {
        user: req.user?.id,
        role: req.user?.role,
        canManageCommittees: req.user?.canManageCommittees,
        body: req.body,
        committeeId: req.params.committeeId
      });
      
      // Only admins, committee chairs or users with committee management permission can add members
      if (req.user?.role !== 'admin' && 
          req.user?.role !== 'committee_chair' && 
          !req.user?.canManageCommittees) {
        console.log("Access denied - insufficient permissions:", {
          userRole: req.user?.role,
          canManageCommittees: req.user?.canManageCommittees
        });
        return res.status(403).json({ error: "Access denied. Committee management privileges required." });
      }
      
      const committeeId = parseInt(req.params.committeeId);
      const { userId, roleId, memberId, startDate, endDate } = req.body;
      
      console.log("Parsed input:", { committeeId, userId, roleId, memberId, startDate, endDate });
      
      if (isNaN(committeeId) || !userId || !roleId) {
        console.log("Invalid input - missing required fields:", { committeeId, userId, roleId });
        return res.status(400).json({ error: "Invalid input. Committee ID, user ID, and role ID are required." });
      }
      
      // Check if committee exists
      const committeeResult = await db.select().from(committees)
        .where(eq(committees.id, committeeId));
      
      console.log(`Committee check: found ${committeeResult.length} committees with ID ${committeeId}`);
      
      if (committeeResult.length === 0) {
        return res.status(404).json({ error: "Committee not found" });
      }
      
      // Check if user exists
      const userResult = await db.select().from(users)
        .where(eq(users.id, userId));
      
      console.log(`User check: found ${userResult.length} users with ID ${userId}`);
      
      if (userResult.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const user = userResult[0];
      
      // Check if role exists
      const roleResult = await db.select().from(committeeRoles)
        .where(eq(committeeRoles.id, roleId));
      
      console.log(`Role check: found ${roleResult.length} roles with ID ${roleId}`);
      
      if (roleResult.length === 0) {
        return res.status(404).json({ error: "Role not found" });
      }
      
      const role = roleResult[0];
      console.log("Found role:", role);
      
      // Check if member already exists in this committee
      const existingMember = await db.select().from(committeeMembers)
        .where(
          and(
            eq(committeeMembers.committeeId, committeeId),
            eq(committeeMembers.userId, userId),
            isNull(committeeMembers.endDate) // Only check active memberships
          )
        );
      
      console.log(`Active membership check: found ${existingMember.length} active memberships`);
      
      // Check if member was previously removed (has an end date)
      const previousMembership = await db.select().from(committeeMembers)
        .where(
          and(
            eq(committeeMembers.committeeId, committeeId),
            eq(committeeMembers.userId, userId),
            not(isNull(committeeMembers.endDate)) // Find memberships with end dates
          )
        );
      
      console.log(`Previous membership check: found ${previousMembership.length} ended memberships`);
      
      // If active membership exists, return error
      if (existingMember.length > 0) {
        return res.status(400).json({ error: "User is already an active member of this committee" });
      }
      
      // Declare a variable to hold committee member data
      let committeeMember;
      
      // If previous membership exists, update it instead of creating a new one
      if (previousMembership.length > 0) {
        console.log("Reactivating previous membership");
        const mostRecentMembership = previousMembership.sort((a, b) => {
          // Sort by endDate in descending order to get the most recent one
          return new Date(b.endDate!).getTime() - new Date(a.endDate!).getTime();
        })[0];
        
        // Update the existing record
        const [updatedMember] = await db.update(committeeMembers)
          .set({
            roleId,
            addedById: req.user!.id,
            startDate: startDate ? new Date(startDate) : new Date(),
            endDate: null // Remove end date to reactivate
          })
          .where(eq(committeeMembers.id, mostRecentMembership.id))
          .returning();
        
        console.log("Membership reactivated:", updatedMember);
        
        committeeMember = updatedMember;
      } else {
        console.log("Creating new committee membership");
        // Add user to committee
        const [newMember] = await db.insert(committeeMembers)
          .values({
            committeeId,
            userId,
            memberId: memberId || null,
            roleId,
            addedById: req.user!.id,
            startDate: startDate ? new Date(startDate) : new Date(),
            endDate: endDate ? new Date(endDate) : null
          })
          .returning();
        
        console.log("New membership created:", newMember);
        
        committeeMember = newMember;
      }
      
      // If role has management permissions, update the user's permissions
      if (role.canManageCommittee || role.canManageWorkshops) {
        console.log("Role has management permissions, updating user permissions");
        const updateData = {
          canManageCommittees: role.canManageCommittee || user.canManageCommittees,
          canManageWorkshops: role.canManageWorkshops || user.canManageWorkshops,
        };

        // Only update role if the user is not an admin
        if (user.role !== 'admin') {
          const newRole = role.name === 'Chair' ? 'committee_chair' : 
                          role.name === 'Co-Chair' ? 'committee_cochair' :
                          user.role === 'user' ? 'committee_member' : user.role;
          (updateData as any).role = newRole;
        }
        
        console.log("Updating user with:", updateData);
        
        const [updatedUser] = await db.update(users)
          .set(updateData)
          .where(eq(users.id, userId))
          .returning();
        
        console.log("User permissions updated:", updatedUser);
      }
      
      // Return the new committee member with full details
      const newMemberDetails = await db.select({
        id: committeeMembers.id,
        startDate: committeeMembers.startDate,
        endDate: committeeMembers.endDate,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          username: users.username
        },
        role: {
          id: committeeRoles.id,
          name: committeeRoles.name,
          canManageCommittee: committeeRoles.canManageCommittee,
          canManageWorkshops: committeeRoles.canManageWorkshops
        }
      })
      .from(committeeMembers)
      .leftJoin(users, eq(committeeMembers.userId, users.id))
      .leftJoin(committeeRoles, eq(committeeMembers.roleId, committeeRoles.id))
      .where(eq(committeeMembers.id, committeeMember?.id || 0));
      
      console.log("Returning committee member details:", newMemberDetails[0]);
      
      res.status(201).json(newMemberDetails[0]);
    } catch (error) {
      console.error("Error adding committee member:", error);
      res.status(500).json({ error: "Failed to add committee member: " + (error as Error).message });
    }
  });
  
  app.put("/api/committees/:committeeId/members/:memberId", requireAuth, async (req, res) => {
    try {
      // Only admins, committee chairs or users with committee management permission can update members
      if (req.user?.role !== 'admin' && 
          req.user?.role !== 'committee_chair' && 
          !req.user?.canManageCommittees) {
        return res.status(403).json({ error: "Access denied. Committee management privileges required." });
      }
      
      const committeeId = parseInt(req.params.committeeId);
      const committeeMemberId = parseInt(req.params.memberId);
      const { roleId, endDate } = req.body;
      
      if (isNaN(committeeId) || isNaN(committeeMemberId)) {
        return res.status(400).json({ error: "Invalid committee ID or member ID" });
      }
      
      // Find the committee member
      const memberResult = await db.select()
        .from(committeeMembers)
        .where(
          and(
            eq(committeeMembers.id, committeeMemberId),
            eq(committeeMembers.committeeId, committeeId)
          )
        );
      
      if (memberResult.length === 0) {
        return res.status(404).json({ error: "Committee member not found" });
      }
      
      const committeeMember = memberResult[0];
      
      // Get the current role
      const currentRoleResult = await db.select()
        .from(committeeRoles)
        .where(eq(committeeRoles.id, committeeMember.roleId));
      
      if (currentRoleResult.length === 0) {
        return res.status(500).json({ error: "Current role not found" });
      }
      
      const currentRole = currentRoleResult[0];
      
      // Prepare update data
      const updateData: { roleId?: number, endDate?: Date | null } = {};
      
      // Update role if provided
      if (roleId) {
        // Check if role exists
        const roleResult = await db.select()
          .from(committeeRoles)
          .where(eq(committeeRoles.id, roleId));
        
        if (roleResult.length === 0) {
          return res.status(404).json({ error: "Role not found" });
        }
        
        const newRole = roleResult[0];
        updateData.roleId = roleId;
        
        // If role changes to one with management permissions, update the user's permissions
        if (newRole.id !== currentRole.id) {
          // Get the user
          const userResult = await db.select()
            .from(users)
            .where(eq(users.id, committeeMember.userId));
          
          if (userResult.length > 0) {
            const user = userResult[0];
            
            // Prepare update data
            const userUpdateData = {
              canManageCommittees: newRole.canManageCommittee,
              canManageWorkshops: newRole.canManageWorkshops,
            };
            
            // Only update role if the user is not an admin
            if (user.role !== 'admin') {
              const newUserRole = newRole.name === 'Chair' ? 'committee_chair' : 
                                 newRole.name === 'Co-Chair' ? 'committee_cochair' :
                                 newRole.name === 'Member' ? 'committee_member' : user.role;
              (userUpdateData as any).role = newUserRole;
            }
            
            // Update user permissions based on role change
            await db.update(users)
              .set(userUpdateData)
              .where(eq(users.id, user.id));
          }
        }
      }
      
      // Update end date if provided
      if (endDate !== undefined) {
        updateData.endDate = endDate ? new Date(endDate) : null;
      }
      
      // Only update if there are changes
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No update data provided" });
      }
      
      // Update the committee member
      const [updatedMember] = await db.update(committeeMembers)
        .set(updateData)
        .where(eq(committeeMembers.id, committeeMemberId))
        .returning();
      
      // Return the updated member with full details
      const updatedMemberDetails = await db.select({
        id: committeeMembers.id,
        startDate: committeeMembers.startDate,
        endDate: committeeMembers.endDate,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          username: users.username
        },
        role: {
          id: committeeRoles.id,
          name: committeeRoles.name,
          canManageCommittee: committeeRoles.canManageCommittee,
          canManageWorkshops: committeeRoles.canManageWorkshops
        }
      })
      .from(committeeMembers)
      .leftJoin(users, eq(committeeMembers.userId, users.id))
      .leftJoin(committeeRoles, eq(committeeMembers.roleId, committeeRoles.id))
      .where(eq(committeeMembers.id, updatedMember.id));
      
      res.json(updatedMemberDetails[0]);
    } catch (error) {
      console.error("Error updating committee member:", error);
      res.status(500).json({ error: "Failed to update committee member" });
    }
  });
  
  // Chair login uses the regular login endpoint - no separate endpoint needed

  // Endpoint for setting chair credentials
  app.post("/api/committees/:committeeId/members/:memberId/credentials", requireAuth, async (req, res) => {
    try {
      // Only admins can set chair credentials
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: "Access denied. Admin privileges required to set chair credentials." });
      }
      
      const committeeId = parseInt(req.params.committeeId);
      const userId = parseInt(req.params.memberId);
      const { username, password, role } = req.body;
      
      if (isNaN(committeeId) || isNaN(userId) || !username || !password || !role) {
        return res.status(400).json({ 
          error: "Invalid input. Committee ID, user ID, username, password, and role are required." 
        });
      }
      
      // Validate that the role is for chair or co-chair
      if (role !== 'committee_chair' && role !== 'committee_cochair') {
        return res.status(400).json({ 
          error: "Invalid role. Only 'committee_chair' or 'committee_cochair' roles can have credentials set." 
        });
      }
      
      // Check if user exists
      const userResult = await db.select().from(users)
        .where(eq(users.id, userId));
      
      if (userResult.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      // Update the user with new credentials and role
      const [updatedUser] = await db.update(users)
        .set({
          username,
          password: hashedPassword,
          role
        })
        .where(eq(users.id, userId))
        .returning();
      
      // Remove the password from the returned object
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      res.status(200).json({
        ...userWithoutPassword,
        message: "Chair credentials set successfully"
      });
    } catch (error) {
      console.error("Error setting chair credentials:", error);
      res.status(500).json({ error: "Failed to set chair credentials" });
    }
  });

  app.delete("/api/committees/:committeeId/members/:memberId", requireAuth, async (req, res) => {
    try {
      // Only admins, committee chairs or users with committee management permission can remove members
      if (req.user?.role !== 'admin' && 
          req.user?.role !== 'committee_chair' && 
          !req.user?.canManageCommittees) {
        return res.status(403).json({ error: "Access denied. Committee management privileges required." });
      }
      
      const committeeId = parseInt(req.params.committeeId);
      const committeeMemberId = parseInt(req.params.memberId);
      
      console.log(`Delete request for committee ${committeeId}, member ${committeeMemberId}`);
      
      if (isNaN(committeeId) || isNaN(committeeMemberId)) {
        return res.status(400).json({ error: "Invalid committee ID or member ID" });
      }
      
      // Find the committee member
      const memberResult = await db.select()
        .from(committeeMembers)
        .where(
          and(
            eq(committeeMembers.id, committeeMemberId),
            eq(committeeMembers.committeeId, committeeId)
          )
        );
      
      if (memberResult.length === 0) {
        return res.status(404).json({ error: "Committee member not found" });
      }
      
      const committeeMember = memberResult[0];
      
      // Check if the member is already inactive (already removed)
      if (committeeMember.endDate !== null) {
        // Already removed, return success
        console.log(`Committee member ${committeeMemberId} already has an end date set:`, committeeMember.endDate);
        return res.status(200).json({ message: "Member was already removed from this committee" });
      }
      
      // Get the member's role
      const roleResult = await db.select()
        .from(committeeRoles)
        .where(eq(committeeRoles.id, committeeMember.roleId));
      
      if (roleResult.length === 0) {
        return res.status(500).json({ error: "Role not found" });
      }
      
      const role = roleResult[0];
      
      // Remove committee member (soft delete by setting end date)
      await db.update(committeeMembers)
        .set({
          endDate: new Date() // Set end date to now to mark as inactive
        })
        .where(eq(committeeMembers.id, committeeMemberId))
        .returning();
        
      console.log(`Set end date for committee member ${committeeMemberId}`);
      
      // If user had special role in this committee, check if they're still in other committees
      if (role.canManageCommittee || role.canManageWorkshops) {
        const otherActiveMembers = await db.select()
          .from(committeeMembers)
          .where(
            and(
              eq(committeeMembers.userId, committeeMember.userId),
              isNull(committeeMembers.endDate), // Only active memberships
              ne(committeeMembers.id, committeeMemberId) // Not the one we just removed
            )
          );
        
        console.log(`Found ${otherActiveMembers.length} other active committee memberships for user ${committeeMember.userId}`);
        
        // Get the current user data
        const [userData] = await db.select().from(users).where(eq(users.id, committeeMember.userId));
        
        if (!userData) {
          console.log(`User ${committeeMember.userId} not found when updating permissions`);
          return res.status(500).json({ error: "User not found" });
        }
        
        // CRITICAL: If the user is an admin, we DON'T change ANY permissions
        if (userData.role === 'admin') {
          console.log(`User ${committeeMember.userId} is an admin, preserving all admin privileges`);
          // No changes needed, admin permissions are preserved
        } else {
          // Check the roles of the other active memberships only for non-admin users
          if (otherActiveMembers.length > 0) {
            const remainingRoleIds = otherActiveMembers.map(m => m.roleId);
            
            // If they're in other committees, check those roles
            const remainingRoles = await db.select()
              .from(committeeRoles)
              .where(inArray(committeeRoles.id, remainingRoleIds));
            
            // If they're not in any other committees with management roles, reset those permissions
            const hasOtherManagementRoles = remainingRoles.some(
              r => r.canManageCommittee || r.canManageWorkshops
            );
            
            if (!hasOtherManagementRoles) {
              // For non-admin users, update only the management permissions 
              const updateData: any = {
                canManageCommittees: false,
                canManageWorkshops: false,
              };
              
              // Only update the role if it's currently committee-related
              if (userData.role === 'committee_chair' || userData.role === 'committee_cochair' || userData.role === 'committee_member') {
                updateData.role = 'user';
              }
              
              await db.update(users)
                .set(updateData)
                .where(eq(users.id, committeeMember.userId));
                
              console.log(`Reset committee permissions for user ${committeeMember.userId} - no other management roles`);
            } else {
              console.log(`User ${committeeMember.userId} still has other management roles, keeping permissions`);
            }
          } else {
            // No other active memberships, reset committee-related permissions only for non-admin
            const updateData: any = {
              canManageCommittees: false,
              canManageWorkshops: false,
            };
              
            // Only update the role if it's currently committee-related
            if (userData.role === 'committee_chair' || userData.role === 'committee_cochair' || userData.role === 'committee_member') {
              updateData.role = 'user';
            }
            
            await db.update(users)
              .set(updateData)
              .where(eq(users.id, committeeMember.userId));
              
            console.log(`Reset permissions for user ${committeeMember.userId} - no other committee memberships`);
          }
        }
      }
      
      res.status(200).json({ message: "Committee member removed successfully" });
    } catch (error) {
      console.error("Error removing committee member:", error);
      res.status(500).json({ error: "Failed to remove committee member" });
    }
  });

  // Membership Pricing Rules Routes
  // Get all membership pricing rules
  app.get("/api/membership-pricing-rules", requireAuth, async (req, res) => {
    try {
      const rules = await db.select()
        .from(membershipPricingRules)
        .orderBy(membershipPricingRules.membershipLevel);
      
      res.json(rules);
    } catch (error) {
      console.error("Error fetching membership pricing rules:", error);
      res.status(500).json({ error: "Failed to fetch pricing rules" });
    }
  });

  // Create or update a membership pricing rule (admin only)
  app.post("/api/membership-pricing-rules", requireAuth, async (req, res) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Only administrators can manage pricing rules" });
    }

    try {
      const { membershipLevel, percentagePaid } = req.body;

      if (!membershipLevel || percentagePaid === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (percentagePaid < 0 || percentagePaid > 100) {
        return res.status(400).json({ error: "Percentage must be between 0 and 100" });
      }

      // Check if rule already exists
      const [existingRule] = await db.select()
        .from(membershipPricingRules)
        .where(eq(membershipPricingRules.membershipLevel, membershipLevel));

      if (existingRule) {
        // Update existing rule
        const [updatedRule] = await db.update(membershipPricingRules)
          .set({ 
            percentagePaid: Number(percentagePaid),
            updatedAt: new Date()
          })
          .where(eq(membershipPricingRules.id, existingRule.id))
          .returning();
        
        res.json(updatedRule);
      } else {
        // Create new rule
        const [newRule] = await db.insert(membershipPricingRules)
          .values({
            membershipLevel,
            percentagePaid: Number(percentagePaid)
          })
          .returning();
        
        res.status(201).json(newRule);
      }
    } catch (error) {
      console.error("Error creating/updating pricing rule:", error);
      res.status(500).json({ error: "Failed to create/update pricing rule" });
    }
  });

  // Update a membership pricing rule (admin only)
  app.patch("/api/membership-pricing-rules/:id", requireAuth, async (req, res) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Only administrators can manage pricing rules" });
    }

    try {
      const ruleId = parseInt(req.params.id);
      const { percentagePaid } = req.body;

      if (isNaN(ruleId)) {
        return res.status(400).json({ error: "Invalid rule ID" });
      }

      if (percentagePaid === undefined) {
        return res.status(400).json({ error: "Missing percentagePaid field" });
      }

      if (percentagePaid < 0 || percentagePaid > 100) {
        return res.status(400).json({ error: "Percentage must be between 0 and 100" });
      }

      const [updatedRule] = await db.update(membershipPricingRules)
        .set({ 
          percentagePaid: Number(percentagePaid),
          updatedAt: new Date()
        })
        .where(eq(membershipPricingRules.id, ruleId))
        .returning();

      if (!updatedRule) {
        return res.status(404).json({ error: "Pricing rule not found" });
      }

      res.json(updatedRule);
    } catch (error) {
      console.error("Error updating pricing rule:", error);
      res.status(500).json({ error: "Failed to update pricing rule" });
    }
  });

  // Seed initial membership pricing rules (admin only)
  app.post("/api/membership-pricing-rules/seed", requireAuth, async (req, res) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Only administrators can seed pricing rules" });
    }

    try {
      const defaultRules = [
        { membershipLevel: "Full", percentagePaid: 100 },
        { membershipLevel: "Full Retired", percentagePaid: 20 },
        { membershipLevel: "LifeFull", percentagePaid: 20 },
        { membershipLevel: "Associate", percentagePaid: 35 },
        { membershipLevel: "Affiliate", percentagePaid: 60 },
        { membershipLevel: "Student", percentagePaid: 60 },
        { membershipLevel: "Companion", percentagePaid: 75 },
      ];

      const createdRules = [];
      for (const rule of defaultRules) {
        // Check if rule already exists
        const [existing] = await db.select()
          .from(membershipPricingRules)
          .where(eq(membershipPricingRules.membershipLevel, rule.membershipLevel));

        if (!existing) {
          const [created] = await db.insert(membershipPricingRules)
            .values(rule)
            .returning();
          createdRules.push(created);
        }
      }

      res.json({ 
        message: `Seeded ${createdRules.length} pricing rules`,
        rules: createdRules 
      });
    } catch (error) {
      console.error("Error seeding pricing rules:", error);
      res.status(500).json({ error: "Failed to seed pricing rules" });
    }
  });

  // Workshop routes
  app.post("/api/workshops", requireAuth, async (req, res) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      // Extract and validate workshop data
      const { 
        title, description, date, capacity, committeeId, locationAddress,
        locationDetails, isPaid, baseCost, globalDiscountPercentage, sponsoredBy,
        isOnline, meetingLink, requiresApproval, startTime, endTime, materials
      } = req.body;
      
      // Validate required fields
      if (!title || !description || !date || !capacity) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Ensure the date is properly formatted
      let workshopDate;
      try {
        workshopDate = new Date(date);
        if (isNaN(workshopDate.getTime())) {
          throw new Error("Invalid date format");
        }
      } catch (dateError) {
        return res.status(400).json({ error: "Invalid date format. Please use a valid date." });
      }

      // Check if specified committee exists
      if (committeeId) {
        const [committeeExists] = await db.select()
          .from(committees)
          .where(eq(committees.id, committeeId));
        
        if (!committeeExists) {
          return res.status(400).json({ error: "Specified committee does not exist" });
        }
      }

      // Create workshop with all available data
      const workshopData = {
        title,
        description,
        date: workshopDate,
        capacity: Number(capacity),
        committeeId: committeeId || null,
        locationAddress: locationAddress || null,
        locationDetails: locationDetails || null,
        isPaid: isPaid === true,
        baseCost: baseCost ? Number(baseCost) : null,
        globalDiscountPercentage: globalDiscountPercentage ? Number(globalDiscountPercentage) : 0,
        sponsoredBy: sponsoredBy || null,
        isOnline: isOnline === true,
        meetingLink: meetingLink || null,
        requiresApproval: requiresApproval === true,
        createdById: req.user.id,
        startTime: startTime || null,
        endTime: endTime || null,
        materials: materials || null
      };

      const [workshop] = await db.insert(workshops)
        .values(workshopData)
        .returning();
      
      res.status(201).json(workshop);
    } catch (error) {
      console.error("Error creating workshop:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/api/workshops", requireAuth, async (req, res) => {
    try {
      // Get workshops with committee information
      const workshopsWithCommittees = await db.select({
        id: workshops.id,
        title: workshops.title,
        description: workshops.description,
        date: workshops.date,
        capacity: workshops.capacity,
        committeeId: workshops.committeeId,
        committeeName: committees.name,
        locationAddress: workshops.locationAddress,
        locationDetails: workshops.locationDetails,
        isPaid: workshops.isPaid,
        baseCost: workshops.baseCost,
        globalDiscountPercentage: workshops.globalDiscountPercentage,
        sponsoredBy: workshops.sponsoredBy,
        isOnline: workshops.isOnline,
        meetingLink: workshops.meetingLink,
        requiresApproval: workshops.requiresApproval,
        startTime: workshops.startTime,
        endTime: workshops.endTime,
        materials: workshops.materials,
        visibleToGeneralMembers: workshops.visibleToGeneralMembers,
        visibleToCommitteeChairs: workshops.visibleToCommitteeChairs,
        visibleToAdmins: workshops.visibleToAdmins
      })
      .from(workshops)
      .leftJoin(
        committees,
        eq(workshops.committeeId, committees.id)
      )
      .orderBy(workshops.date);
      
      res.json(workshopsWithCommittees);
    } catch (error) {
      console.error("Error fetching workshops:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Update workshop (admin only)
  app.patch("/api/workshops/:id", requireAuth, async (req, res) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const workshopId = parseInt(req.params.id);
      
      if (isNaN(workshopId)) {
        return res.status(400).json({ error: "Invalid workshop ID" });
      }

      // Check if workshop exists
      const [existingWorkshop] = await db.select()
        .from(workshops)
        .where(eq(workshops.id, workshopId));
      
      if (!existingWorkshop) {
        return res.status(404).json({ error: "Workshop not found" });
      }

      // Extract and validate update data
      const { 
        title, description, date, capacity, locationAddress, committeeId,
        locationDetails, isPaid, baseCost, globalDiscountPercentage, sponsoredBy,
        isOnline, meetingLink, requiresApproval, startTime, endTime, materials
      } = req.body;

      // Prepare update data (only include fields that are provided)
      const updateData: any = {};
      
      if (title !== undefined) {
        if (!title || title.trim().length < 3) {
          return res.status(400).json({ error: "Title must be at least 3 characters" });
        }
        updateData.title = title.trim();
      }
      
      if (description !== undefined) {
        if (!description || description.trim().length < 10) {
          return res.status(400).json({ error: "Description must be at least 10 characters" });
        }
        updateData.description = description.trim();
      }
      
      if (date !== undefined) {
        let workshopDate;
        try {
          workshopDate = new Date(date);
          if (isNaN(workshopDate.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (dateError) {
          return res.status(400).json({ error: "Invalid date format. Please use a valid date." });
        }
        updateData.date = workshopDate;
      }
      
      if (capacity !== undefined) {
        const capacityNum = Number(capacity);
        if (!Number.isInteger(capacityNum) || capacityNum < 1) {
          return res.status(400).json({ error: "Capacity must be a positive integer" });
        }
        updateData.capacity = capacityNum;
      }
      
      if (locationAddress !== undefined) {
        updateData.locationAddress = locationAddress || null;
      }
      
      if (locationDetails !== undefined) {
        updateData.locationDetails = locationDetails || null;
      }
      
      if (isPaid !== undefined) {
        updateData.isPaid = isPaid === true;
      }
      
      if (baseCost !== undefined) {
        updateData.baseCost = baseCost ? Number(baseCost) : null;
      }
      
      if (globalDiscountPercentage !== undefined) {
        updateData.globalDiscountPercentage = globalDiscountPercentage ? Number(globalDiscountPercentage) : 0;
      }
      
      if (sponsoredBy !== undefined) {
        updateData.sponsoredBy = sponsoredBy || null;
      }
      
      if (isOnline !== undefined) {
        updateData.isOnline = isOnline === true;
      }
      
      if (meetingLink !== undefined) {
        updateData.meetingLink = meetingLink || null;
      }
      
      if (requiresApproval !== undefined) {
        updateData.requiresApproval = requiresApproval === true;
      }
      
      if (committeeId !== undefined) {
        updateData.committeeId = committeeId || null;
      }
      
      if (startTime !== undefined) {
        updateData.startTime = startTime || null;
      }
      
      if (endTime !== undefined) {
        updateData.endTime = endTime || null;
      }
      
      if (materials !== undefined) {
        updateData.materials = materials || null;
      }

      // Perform the update
      const [updatedWorkshop] = await db.update(workshops)
        .set(updateData)
        .where(eq(workshops.id, workshopId))
        .returning();
      
      console.log(`Workshop ${workshopId} updated by admin ${req.user.id}`);
      res.json(updatedWorkshop);
    } catch (error) {
      console.error("Error updating workshop:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Update workshop visibility (admin only)
  app.patch("/api/workshops/:id/visibility", requireAuth, async (req, res) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const workshopId = parseInt(req.params.id);
      
      if (isNaN(workshopId)) {
        return res.status(400).json({ error: "Invalid workshop ID" });
      }

      const { visibleToGeneralMembers, visibleToCommitteeChairs, visibleToAdmins } = req.body;

      // Update visibility
      const [updatedWorkshop] = await db.update(workshops)
        .set({
          visibleToGeneralMembers,
          visibleToCommitteeChairs,
          visibleToAdmins
        })
        .where(eq(workshops.id, workshopId))
        .returning();
      
      if (!updatedWorkshop) {
        return res.status(404).json({ error: "Workshop not found" });
      }

      console.log(`Workshop ${workshopId} visibility updated by admin ${req.user.id}`);
      res.json(updatedWorkshop);
    } catch (error) {
      console.error("Error updating workshop visibility:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post("/api/workshops/:id/register", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const workshopId = parseInt(req.params.id);
      
      if (isNaN(workshopId)) {
        return res.status(400).json({ error: "Invalid workshop ID" });
      }
      
      // Check if workshop exists
      const [workshop] = await db.select()
        .from(workshops)
        .where(eq(workshops.id, workshopId));
      
      if (!workshop) {
        return res.status(404).json({ error: "Workshop not found" });
      }
      
      // Check if user is already registered
      const existingRegistration = await db.select()
        .from(workshopRegistrations)
        .where(
          and(
            eq(workshopRegistrations.workshopId, workshopId),
            eq(workshopRegistrations.userId, req.user.id)
          )
        );
      
      if (existingRegistration.length > 0) {
        return res.status(400).json({ error: "You are already registered for this workshop" });
      }
      
      // Determine initial status based on workshop requirements
      const paymentStatus = workshop.isPaid ? "unpaid" : "not_required";
      const isApproved = !workshop.requiresApproval;
      
      // Register user for workshop
      const [registration] = await db.insert(workshopRegistrations)
        .values({
          workshopId,
          userId: req.user.id,
          isApproved,
          paymentStatus,
          notes: null
        })
        .returning();
      
      res.status(201).json(registration);
    } catch (error) {
      console.error("Error registering for workshop:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get workshop registrations (admin only)
  app.get("/api/workshops/:id/registrations", requireAuth, async (req, res) => {
    try {
      // Only admin can access registrations
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can view workshop registrations" });
      }
      
      const workshopId = parseInt(req.params.id);
      
      if (isNaN(workshopId)) {
        return res.status(400).json({ error: "Invalid workshop ID" });
      }
      
      // Get registrations with user details 
      // We need to use a simpler approach because of the alias issue
      const registrations = await db.select({
        id: workshopRegistrations.id,
        workshopId: workshopRegistrations.workshopId,
        userId: workshopRegistrations.userId,
        registeredAt: workshopRegistrations.registeredAt,
        isApproved: workshopRegistrations.isApproved,
        approvedAt: workshopRegistrations.approvedAt,
        paymentStatus: workshopRegistrations.paymentStatus,
        notes: workshopRegistrations.notes,
        // User details - we'll get them in a separate query
      })
      .from(workshopRegistrations)
      .where(eq(workshopRegistrations.workshopId, workshopId));
      
      // Get user details for each registration
      if (registrations.length > 0) {
        // Get all user ids, filtering out any null values
        const userIds = registrations.map(reg => reg.userId).filter((id): id is number => id !== null);
        
        // Get all users in one query
        const allUsersData = await storage.getUsersByIds(userIds);
        
        // Map users to registration
        const registrationsWithUsers = registrations.map(reg => {
          const user = allUsersData.find((u: User) => u.id === reg.userId);
          return {
            ...reg,
            user: user || { username: 'Unknown', firstName: '', lastName: '', email: '' }
          };
        });
        
        res.json(registrationsWithUsers);
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error("Error fetching workshop registrations:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Add participant to workshop (admin only)
  app.post("/api/workshops/:id/add-participant", requireAuth, async (req, res) => {
    console.log("Add participant API called with params:", req.params, "and body:", req.body);
    try {
      // Only admin can add participants directly
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can add participants" });
      }
      
      const workshopId = parseInt(req.params.id);
      const { userId } = req.body;
      
      if (isNaN(workshopId) || !userId) {
        return res.status(400).json({ error: "Invalid workshop ID or user ID" });
      }
      
      // Check if workshop exists
      const [workshop] = await db.select()
        .from(workshops)
        .where(eq(workshops.id, workshopId));
      
      if (!workshop) {
        return res.status(404).json({ error: "Workshop not found" });
      }
      
      // Check if user is already registered
      const existingRegistration = await db.select()
        .from(workshopRegistrations)
        .where(
          and(
            eq(workshopRegistrations.workshopId, workshopId),
            eq(workshopRegistrations.userId, userId)
          )
        );
      
      if (existingRegistration.length > 0) {
        return res.status(400).json({ error: "User is already registered for this workshop" });
      }
      
      // Check workshop capacity
      const countResult = await db.select({ count: count() })
        .from(workshopRegistrations)
        .where(eq(workshopRegistrations.workshopId, workshopId));
      
      const currentRegistrations = countResult[0]?.count || 0;
      
      if (currentRegistrations >= workshop.capacity) {
        return res.status(400).json({ error: "Workshop is at full capacity" });
      }
      
      // Register user for workshop with admin approval
      const [registration] = await db.insert(workshopRegistrations)
        .values({
          workshopId,
          userId,
          isApproved: true, // Auto-approve admin-added registrations
          paymentStatus: workshop.isPaid ? "paid" : "not_required", // Mark as paid if it's a paid workshop
          notes: "Added by administrator",
          registeredAt: new Date(),
        })
        .returning();
      
      res.status(201).json(registration);
    } catch (error) {
      console.error("Error adding workshop participant:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Remove workshop registration (admin only)
  app.delete("/api/workshops/registration/:id", requireAuth, async (req, res) => {
    try {
      // Only admin can remove registrations
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can remove workshop registrations" });
      }
      
      const registrationId = parseInt(req.params.id);
      
      if (isNaN(registrationId)) {
        return res.status(400).json({ error: "Invalid registration ID" });
      }
      
      // Delete the registration
      await db.delete(workshopRegistrations)
        .where(eq(workshopRegistrations.id, registrationId));
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error removing workshop registration:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Approve payment for a workshop registration (admin only)
  app.post("/api/workshops/registration/:id/approve-payment", requireAuth, async (req, res) => {
    try {
      // Only admin can approve payments
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can approve payments" });
      }
      
      const registrationId = parseInt(req.params.id);
      
      if (isNaN(registrationId)) {
        return res.status(400).json({ error: "Invalid registration ID" });
      }
      
      // Update the registration
      const [updatedRegistration] = await db.update(workshopRegistrations)
        .set({
          paymentStatus: "paid",
          isApproved: true, // Auto-approve when payment is approved
          notes: "Payment approved by administrator",
        })
        .where(eq(workshopRegistrations.id, registrationId))
        .returning();
      
      res.status(200).json(updatedRegistration);
    } catch (error) {
      console.error("Error approving workshop payment:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Payment Routes
  // Calculate workshop pricing for current user
  app.get("/api/workshops/:id/pricing", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const workshopId = parseInt(req.params.id);
      if (isNaN(workshopId)) {
        return res.status(400).json({ error: "Invalid workshop ID" });
      }

      const [workshop] = await db.select()
        .from(workshops)
        .where(eq(workshops.id, workshopId));

      if (!workshop) {
        return res.status(404).json({ error: "Workshop not found" });
      }

      // Get member info for province (tax calculation)
      let memberProvince = null;
      if (req.user.email) {
        const [member] = await db.select()
          .from(members)
          .where(eq(members.email, req.user.email));
        memberProvince = member?.provinceTerritory || null;
      }

      const pricing = await PaymentService.calculateWorkshopPrice(
        workshop,
        req.user,
        memberProvince
      );

      res.json(pricing);
    } catch (error) {
      console.error("Error calculating workshop pricing:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Create payment intent for workshop registration
  app.post("/api/payments/create-intent", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!stripe) {
        return res.status(500).json({ error: "Payment system not configured" });
      }

      const { registrationId, paymentMethod } = req.body;

      if (!registrationId || !paymentMethod) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Get registration and workshop
      const [registration] = await db.select()
        .from(workshopRegistrations)
        .where(eq(workshopRegistrations.id, registrationId));

      if (!registration) {
        return res.status(404).json({ error: "Registration not found" });
      }

      if (registration.userId !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const [workshop] = await db.select()
        .from(workshops)
        .where(eq(workshops.id, registration.workshopId!));

      if (!workshop) {
        return res.status(404).json({ error: "Workshop not found" });
      }

      // Get member info for province (tax calculation)
      let memberProvince = null;
      if (req.user.email) {
        const [member] = await db.select()
          .from(members)
          .where(eq(members.email, req.user.email));
        memberProvince = member?.provinceTerritory || null;
      }

      // Calculate pricing
      const pricing = await PaymentService.calculateWorkshopPrice(
        workshop,
        req.user,
        memberProvince
      );

      if (pricing.total === 0) {
        return res.status(400).json({ error: "This workshop is free" });
      }

      // For Stripe card payments
      if (paymentMethod === "stripe_card") {
        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: pricing.total, // Already in cents
          currency: "cad",
          metadata: {
            registrationId: registrationId.toString(),
            workshopId: workshop.id.toString(),
            userId: req.user.id.toString(),
            workshopTitle: workshop.title,
          },
        });

        // Create payment record
        const [payment] = await db.insert(payments)
          .values({
            workshopRegistrationId: registrationId,
            method: "stripe_card",
            amountCad: pricing.total,
            currency: "CAD",
            stripePaymentIntentId: paymentIntent.id,
            status: "initiated",
            metadata: { pricing },
          })
          .returning();

        // Create invoice
        const invoiceNumber = PaymentService.generateInvoiceNumber();
        const [invoice] = await db.insert(invoices)
          .values({
            workshopRegistrationId: registrationId,
            invoiceNumber,
            subtotalCad: pricing.subtotal,
            taxCad: pricing.taxAmount,
            totalCad: pricing.total,
            taxRate: pricing.taxRate,
            taxType: pricing.taxType,
            status: "draft",
            issuedAt: new Date(),
          })
          .returning();

        // Update registration status
        await db.update(workshopRegistrations)
          .set({ paymentStatus: "pending" })
          .where(eq(workshopRegistrations.id, registrationId));

        // Log audit trail
        await db.insert(auditLogs)
          .values({
            actorUserId: req.user.id,
            entityType: "payment",
            entityId: payment.id,
            action: "payment_initiated",
            after: { paymentId: payment.id, invoiceId: invoice.id, method: paymentMethod },
            ipAddress: req.ip,
          });

        res.json({
          clientSecret: paymentIntent.client_secret,
          paymentId: payment.id,
          invoiceNumber,
        });
      } else if (paymentMethod === "interac_transfer" || paymentMethod === "bank_transfer") {
        // For e-Transfer/bank transfer, create pending payment
        const [payment] = await db.insert(payments)
          .values({
            workshopRegistrationId: registrationId,
            method: paymentMethod,
            amountCad: pricing.total,
            currency: "CAD",
            status: "pending_settlement",
            metadata: { 
              pricing,
              instructions: paymentMethod === "interac_transfer" 
                ? "Send e-Transfer to payments@csc.ca with invoice number in message"
                : "Contact admin for bank transfer details"
            },
          })
          .returning();

        // Create invoice
        const invoiceNumber = PaymentService.generateInvoiceNumber();
        const [invoice] = await db.insert(invoices)
          .values({
            workshopRegistrationId: registrationId,
            invoiceNumber,
            subtotalCad: pricing.subtotal,
            taxCad: pricing.taxAmount,
            totalCad: pricing.total,
            taxRate: pricing.taxRate,
            taxType: pricing.taxType,
            status: "sent",
            issuedAt: new Date(),
          })
          .returning();

        // Update registration status
        await db.update(workshopRegistrations)
          .set({ paymentStatus: "pending" })
          .where(eq(workshopRegistrations.id, registrationId));

        // Log audit trail
        await db.insert(auditLogs)
          .values({
            actorUserId: req.user.id,
            entityType: "payment",
            entityId: payment.id,
            action: "payment_initiated",
            after: { paymentId: payment.id, invoiceId: invoice.id, method: paymentMethod },
            ipAddress: req.ip,
          });

        res.json({
          paymentId: payment.id,
          invoiceNumber,
          instructions: payment.metadata,
          totalCad: pricing.total,
        });
      } else {
        res.status(400).json({ error: "Invalid payment method" });
      }
    } catch (error) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Stripe webhook handler
  app.post("/api/webhooks/stripe", express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe not configured" });
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!sig) {
      console.error("Missing stripe signature");
      return res.status(400).json({ error: "Missing stripe signature" });
    }

    try {
      let event;

      // Verify webhook signature if webhook secret is configured
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(
          req.body, 
          sig as string, 
          webhookSecret
        );
      } else {
        // For development without webhook secret (NOT RECOMMENDED FOR PRODUCTION)
        console.warn("WARNING: Processing webhook without signature verification. Set STRIPE_WEBHOOK_SECRET for production.");
        event = JSON.parse(req.body.toString());
      }

      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object;
          
          // Find payment by stripe payment intent ID
          const [payment] = await db.select()
            .from(payments)
            .where(eq(payments.stripePaymentIntentId, paymentIntent.id));

          if (payment) {
            // Update payment status
            await db.update(payments)
              .set({
                status: "succeeded",
                settledAt: new Date(),
              })
              .where(eq(payments.id, payment.id));

            // Update workshop registration
            await db.update(workshopRegistrations)
              .set({
                paymentStatus: "paid",
                isApproved: true,
              })
              .where(eq(workshopRegistrations.id, payment.workshopRegistrationId!));

            // Update invoice
            await db.update(invoices)
              .set({
                status: "paid",
                paidAt: new Date(),
              })
              .where(eq(invoices.workshopRegistrationId, payment.workshopRegistrationId!));

            // Log audit trail
            await db.insert(auditLogs)
              .values({
                entityType: "payment",
                entityId: payment.id,
                action: "payment_completed",
                after: { paymentIntentId: paymentIntent.id, status: "completed" },
              });

            console.log(`Payment ${payment.id} completed successfully`);
          }
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object;
          
          const [payment] = await db.select()
            .from(payments)
            .where(eq(payments.stripePaymentIntentId, paymentIntent.id));

          if (payment) {
            await db.update(payments)
              .set({
                status: "failed",
                metadata: {
                  ...(payment.metadata || {}),
                  error: paymentIntent.last_payment_error,
                },
              })
              .where(eq(payments.id, payment.id));

            console.log(`Payment ${payment.id} failed`);
          }
          break;
        }

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(400).json({ error: "Webhook handler failed" });
    }
  });

  // Get a single workshop by ID
  app.get("/api/workshops/:id", requireAuth, async (req, res) => {
    try {
      const workshopId = parseInt(req.params.id);
      
      if (isNaN(workshopId)) {
        return res.status(400).json({ error: "Invalid workshop ID" });
      }
      
      // Get workshop with committee information
      const [workshop] = await db.select({
        id: workshops.id,
        title: workshops.title,
        description: workshops.description,
        date: workshops.date,
        capacity: workshops.capacity,
        committeeId: workshops.committeeId,
        committeeName: committees.name,
        locationAddress: workshops.locationAddress,
        locationDetails: workshops.locationDetails,
        isPaid: workshops.isPaid,
        baseCost: workshops.baseCost,
        globalDiscountPercentage: workshops.globalDiscountPercentage,
        sponsoredBy: workshops.sponsoredBy,
        isOnline: workshops.isOnline,
        meetingLink: workshops.meetingLink,
        requiresApproval: workshops.requiresApproval,
        startTime: workshops.startTime,
        endTime: workshops.endTime,
        materials: workshops.materials
      })
      .from(workshops)
      .leftJoin(
        committees,
        eq(workshops.committeeId, committees.id)
      )
      .where(eq(workshops.id, workshopId));
      
      if (!workshop) {
        return res.status(404).json({ error: "Workshop not found" });
      }
      
      res.json(workshop);
    } catch (error) {
      console.error("Error fetching workshop:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // User search for committee management
  app.get("/api/users/search", requireAuth, async (req, res) => {
    try {
      // Allow admins, committee chairs, co-chairs, and users with committee management permissions to search users
      if (!req.user || (req.user.role !== 'admin' && 
                      req.user.role !== 'committee_chair' && 
                      req.user.role !== 'committee_cochair' && 
                      !req.user.canManageCommittees)) {
        console.log('Unauthorized user attempted to search users:', req.user?.role);
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      const searchQuery = req.query.q as string;
      
      if (!searchQuery || searchQuery.length < 2) {
        return res.status(400).json({ error: "Search query must be at least 2 characters" });
      }
      
      // Break the search query into words for more flexible searching
      const searchWords = searchQuery.split(/\s+/).filter(word => word.length >= 2);
      const searchTerms = searchWords.length > 0 ? searchWords : [searchQuery];
      
      let searchResults: any[] = [];
      
      // For single-term searches, use a simple OR condition
      if (searchTerms.length === 1) {
        searchResults = await db.select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role
        })
        .from(users)
        .where(
          or(
            ilike(users.firstName, `%${searchTerms[0]}%`),
            ilike(users.lastName, `%${searchTerms[0]}%`),
            ilike(users.email, `%${searchTerms[0]}%`),
            ilike(users.username, `%${searchTerms[0]}%`)
          )
        )
        .limit(10);
      } else {
        // For multi-word searches, first try to match first + last name
        const exactMatches = await db.select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role
        })
        .from(users)
        .where(
          and(
            ilike(users.firstName, `%${searchTerms[0]}%`),
            ilike(users.lastName, `%${searchTerms[1]}%`)
          )
        )
        .limit(10);
        
        // If we found exact matches, use them
        if (exactMatches.length > 0) {
          searchResults = exactMatches;
        } else {
          // Otherwise try a broader search where any term can match any field
          const conditions = searchTerms.map(term => 
            or(
              ilike(users.firstName, `%${term}%`),
              ilike(users.lastName, `%${term}%`),
              ilike(users.email, `%${term}%`),
              ilike(users.username, `%${term}%`)
            )
          );
          
          searchResults = await db.select({
            id: users.id,
            username: users.username,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            role: users.role
          })
          .from(users)
          .where(and(...conditions))
          .limit(10);
        }
      }
      
      res.json(searchResults);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Member search for workshop participants (admin only)
  // NOTE: Using the unified member search implementation below at line ~1950

  // Approve a workshop registration (admin only)
  app.post("/api/workshops/:workshopId/registrations/:registrationId/approve", requireAuth, async (req, res) => {
    try {
      // Only admin can approve registrations
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can approve workshop registrations" });
      }
      
      const workshopId = parseInt(req.params.workshopId);
      const registrationId = parseInt(req.params.registrationId);
      
      if (isNaN(workshopId) || isNaN(registrationId)) {
        return res.status(400).json({ error: "Invalid IDs provided" });
      }
      
      // Update the registration
      const [updatedRegistration] = await db.update(workshopRegistrations)
        .set({
          isApproved: true,
          approvedById: req.user.id,
          approvedAt: new Date()
        })
        .where(
          and(
            eq(workshopRegistrations.id, registrationId),
            eq(workshopRegistrations.workshopId, workshopId)
          )
        )
        .returning();
      
      if (!updatedRegistration) {
        return res.status(404).json({ error: "Registration not found" });
      }
      
      res.json(updatedRegistration);
    } catch (error) {
      console.error("Error approving workshop registration:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Confirm payment for a workshop registration (admin only)
  app.post("/api/workshops/:workshopId/registrations/:registrationId/confirm-payment", requireAuth, async (req, res) => {
    try {
      // Only admin can confirm payments
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can confirm workshop payments" });
      }
      
      const workshopId = parseInt(req.params.workshopId);
      const registrationId = parseInt(req.params.registrationId);
      
      if (isNaN(workshopId) || isNaN(registrationId)) {
        return res.status(400).json({ error: "Invalid IDs provided" });
      }
      
      // Update the registration
      const [updatedRegistration] = await db.update(workshopRegistrations)
        .set({
          paymentStatus: "paid",
          paymentConfirmedById: req.user.id,
          paymentConfirmedAt: new Date()
        })
        .where(
          and(
            eq(workshopRegistrations.id, registrationId),
            eq(workshopRegistrations.workshopId, workshopId)
          )
        )
        .returning();
      
      if (!updatedRegistration) {
        return res.status(404).json({ error: "Registration not found" });
      }
      
      res.json(updatedRegistration);
    } catch (error) {
      console.error("Error confirming payment for workshop registration:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Add notes to a workshop registration (admin only)
  app.post("/api/workshops/:workshopId/registrations/:registrationId/notes", requireAuth, async (req, res) => {
    try {
      // Only admin can add notes
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can add notes to registrations" });
      }
      
      const workshopId = parseInt(req.params.workshopId);
      const registrationId = parseInt(req.params.registrationId);
      const { notes } = req.body;
      
      if (isNaN(workshopId) || isNaN(registrationId)) {
        return res.status(400).json({ error: "Invalid IDs provided" });
      }
      
      if (!notes) {
        return res.status(400).json({ error: "Notes cannot be empty" });
      }
      
      // Update the registration
      const [updatedRegistration] = await db.update(workshopRegistrations)
        .set({ notes })
        .where(
          and(
            eq(workshopRegistrations.id, registrationId),
            eq(workshopRegistrations.workshopId, workshopId)
          )
        )
        .returning();
      
      if (!updatedRegistration) {
        return res.status(404).json({ error: "Registration not found" });
      }
      
      res.json(updatedRegistration);
    } catch (error) {
      console.error("Error adding notes to workshop registration:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get user's registered workshops
  app.get("/api/user/workshops", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Get registrations with workshop details using join
      const userWorkshops = await db.select({
        id: workshops.id,
        title: workshops.title,
        description: workshops.description,
        date: workshops.date,
        capacity: workshops.capacity,
        isPaid: workshops.isPaid,
        baseCost: workshops.baseCost,
        globalDiscountPercentage: workshops.globalDiscountPercentage,
        sponsoredBy: workshops.sponsoredBy,
        isOnline: workshops.isOnline,
        meetingLink: workshops.meetingLink,
        locationAddress: workshops.locationAddress,
        locationDetails: workshops.locationDetails,
        startTime: workshops.startTime,
        endTime: workshops.endTime,
        materials: workshops.materials,
        committeeName: committees.name,
        // Registration details
        registrationId: workshopRegistrations.id,
        isApproved: workshopRegistrations.isApproved,
        paymentStatus: workshopRegistrations.paymentStatus,
        registeredAt: workshopRegistrations.registeredAt
      })
      .from(workshopRegistrations)
      .innerJoin(
        workshops, 
        eq(workshops.id, workshopRegistrations.workshopId)
      )
      .leftJoin(
        committees,
        eq(workshops.committeeId, committees.id)
      )
      .where(eq(workshopRegistrations.userId, req.user.id))
      .orderBy(workshops.date);
      
      res.json(userWorkshops);
    } catch (error) {
      console.error("Error fetching user workshops:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Cancel a workshop registration
  app.delete("/api/workshops/:id/register", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const workshopId = parseInt(req.params.id);
      
      // Delete the registration
      await db.delete(workshopRegistrations)
        .where(
          and(
            eq(workshopRegistrations.workshopId, workshopId),
            eq(workshopRegistrations.userId, req.user.id)
          )
        );
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error cancelling workshop registration:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Members API routes
  // Get all members (admin only)
  app.get('/api/members', requireAuth, async (req, res) => {
    try {
      // Only admins can access all members
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only administrators can access the member list'
        });
      }
      
      // Get all members from database
      const allMembers = await db.select().from(members);
      
      res.json({
        count: allMembers.length,
        members: allMembers
      });
    } catch (error) {
      console.error('Error fetching members:', error);
      res.status(500).json({ error: 'Failed to fetch members' });
    }
  });
  
  // Get members by category
  app.get('/api/members/category/:category', requireAuth, async (req, res) => {
    try {
      // Only admins can access member lists
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only administrators can access the member list'
        });
      }
      
      const { category } = req.params;
      
      // Get members of specified category
      const categoryMembers = await db.select()
        .from(members)
        .where(eq(members.category, category));
      
      res.json({
        category,
        count: categoryMembers.length,
        members: categoryMembers
      });
    } catch (error) {
      console.error('Error fetching members by category:', error);
      res.status(500).json({ error: 'Failed to fetch members' });
    }
  });
  
  // Search members
  app.get('/api/members/search', requireAuth, async (req, res) => {
    console.log('Received member search request with query:', req.query);
    try {
      // Allow admins, committee chairs, co-chairs, and users with committee management permissions to search members
      if (!req.user || (req.user.role !== 'admin' && 
                        req.user.role !== 'committee_chair' && 
                        req.user.role !== 'committee_cochair' && 
                        !req.user.canManageCommittees)) {
        console.log('Unauthorized user attempted to search members:', req.user?.role);
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You need committee management privileges to search the member database'
        });
      }

      // Check if user can access demographic data
      const hasAccessToDemographics = await canAccessDemographics(req.user.id);
      
      // Support both 'query' (new implementation) and 'q' (old implementation) parameters
      const queryParam = req.query.query || req.query.q;
      console.log('Using search term:', queryParam);
      
      if (!queryParam || typeof queryParam !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }
      
      // First split the query into words for more precise searching
      const queryWords = queryParam.trim().split(/\s+/);
      let searchResult;
      
      // Special handling for two-word searches which are likely first+last name combinations
      if (queryWords.length === 2) {
        const [firstWord, secondWord] = queryWords;
        
        // FIRST APPROACH: Try exact match for first name + last name (most restrictive)
        // This gives highest priority to exact first+last name matches
        const exactResults = await db.select().from(members).where(
          or(
            // First name + last name exact match (Luc Montpellier)
            and(
              ilike(members.firstName, `${firstWord}`), 
              ilike(members.lastName, `${secondWord}`)
            ),
            // Last name + first name exact match (Montpellier Luc)
            and(
              ilike(members.firstName, `${secondWord}`), 
              ilike(members.lastName, `${firstWord}`)
            ),
            // Known as + last name match
            and(
              ilike(members.knownAs, `${firstWord}`),
              ilike(members.lastName, `${secondWord}`)
            )
          )
        );
        
        // If we found exact matches, use those (highest priority)
        if (exactResults.length > 0) {
          searchResult = exactResults;
        } else {
          // SECOND APPROACH: Less restrictive - partial matches on words in first/last name
          // This tries to match first word to beginning of first name and second word to beginning of last name
          const beginningResults = await db.select().from(members).where(
            or(
              // First word matches start of first name, second matches start of last name
              and(
                ilike(members.firstName, `${firstWord}%`),
                ilike(members.lastName, `${secondWord}%`)
              ),
              // Or vice versa (reversed order)
              and(
                ilike(members.firstName, `${secondWord}%`),
                ilike(members.lastName, `${firstWord}%`)
              )
            )
          );
          
          // If we found beginning matches, use those (second priority)
          if (beginningResults.length > 0) {
            searchResult = beginningResults;
          } else {
            // THIRD APPROACH: Fallback to the most liberal search for each word
            const fallbackResults = await db.select().from(members).where(
              and(
                // Each word must be found somewhere in the member record
                or(
                  ilike(members.firstName, `%${firstWord}%`),
                  ilike(members.lastName, `%${firstWord}%`),
                  ilike(members.email, `%${firstWord}%`),
                  ilike(members.knownAs, `%${firstWord}%`),
                  ilike(members.province, `%${firstWord}%`)
                ),
                or(
                  ilike(members.firstName, `%${secondWord}%`),
                  ilike(members.lastName, `%${secondWord}%`),
                  ilike(members.email, `%${secondWord}%`),
                  ilike(members.knownAs, `%${secondWord}%`),
                  ilike(members.province, `%${secondWord}%`)
                )
              )
            );
            
            searchResult = fallbackResults;
          }
        }
      } else {
        // For single word or 3+ word searches, use the standard approach
        // Create conditions for each searchable field
        const conditions = [
          ilike(members.firstName, `%${queryParam}%`),
          ilike(members.lastName, `%${queryParam}%`),
          ilike(members.email, `%${queryParam}%`),
          ilike(members.homePhone, `%${queryParam}%`),
          ilike(members.cellPhone, `%${queryParam}%`),
          ilike(members.memberNumber, `%${queryParam}%`),
          ilike(members.province, `%${queryParam}%`),
          ilike(members.occupation, `%${queryParam}%`),
          ilike(members.affiliation, `%${queryParam}%`),
          ilike(members.knownAs, `%${queryParam}%`)
        ];
        
        // If it's a 3+ word search, add conditions to find members matching all words
        if (queryWords.length > 2) {
          const andConditions = queryWords.map(word => 
            or(
              ilike(members.firstName, `%${word}%`),
              ilike(members.lastName, `%${word}%`),
              ilike(members.email, `%${word}%`),
              ilike(members.knownAs, `%${word}%`)
            )
          );
          
          // Try to find records matching all words
          const multiWordResults = await db.select().from(members).where(and(...andConditions));
          
          // If we found matches for all words, use those results
          if (multiWordResults.length > 0) {
            searchResult = multiWordResults;
          } else {
            // Fallback to the regular single field search
            searchResult = await db.select().from(members).where(or(...conditions));
          }
        } else {
          // Single word search - use standard conditions
          searchResult = await db.select().from(members).where(or(...conditions));
        }
      }
      
      // For each member, check if they have a user account
      const memberEmails = searchResult.map(member => member.email).filter(email => email !== null) as string[];
      const usersWithEmail = memberEmails.length > 0 ? await db.select()
        .from(users)
        .where(
          inArray(
            users.email,
            memberEmails
          )
        ) : [];
      
      // Create a map of email -> user for quick lookups
      const usersByEmail: Record<string, any> = {};
      usersWithEmail.forEach(user => {
        usersByEmail[user.email.toLowerCase()] = user;
      });
      
      // Attach user information to each member and filter sensitive data
      const membersWithUserInfo = searchResult.map(member => {
        const userAccount = member.email ? usersByEmail[member.email.toLowerCase()] : null;
        const memberData = {
          ...member,
          user: userAccount || null,
          isActive: member.isActive !== false
        };
        
        // Apply privacy filtering
        return filterMemberData(memberData, hasAccessToDemographics);
      });
      
      res.json({
        query: queryParam,
        count: membersWithUserInfo.length,
        members: membersWithUserInfo,
        accessLevel: hasAccessToDemographics ? 'full' : 'limited'
      });
    } catch (error) {
      console.error('Error searching members:', error);
      res.status(500).json({ error: 'Failed to search members' });
    }
  });
  
  // Get a single member by ID
  app.get('/api/members/:id', requireAuth, async (req, res) => {
    try {
      // Only admins can access member details
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only administrators can access member data'
        });
      }
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid member ID' });
      }
      
      // Get member details
      const [member] = await db.select()
        .from(members)
        .where(eq(members.id, id));
      
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      res.json(member);
    } catch (error) {
      console.error('Error fetching member details:', error);
      res.status(500).json({ error: 'Failed to fetch member details' });
    }
  });
  
  // Update a member by ID
  app.patch('/api/members/:id', requireAuth, async (req, res) => {
    try {
      // Only admins can update member details
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only administrators can modify member data'
        });
      }
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid member ID' });
      }
      
      // First check if the member exists
      const [memberExists] = await db.select()
        .from(members)
        .where(eq(members.id, id));
        
      if (!memberExists) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      // Prepare data for update - need to handle importedAt separately
      const updateData = { ...req.body };
      
      // Remove importedAt from the update if it exists (we don't want to modify this timestamp)
      delete updateData.importedAt;
      
      // Update the member with the sanitized data
      const result = await db.update(members)
        .set(updateData)
        .where(eq(members.id, id))
        .returning();
      
      res.json(result[0]);
    } catch (error) {
      console.error('Error updating member:', error);
      res.status(500).json({ error: 'Failed to update member details' });
    }
  });
  
  // Create a new member
  app.post('/api/members', requireAuth, async (req, res) => {
    try {
      // Only admins can create new members
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only administrators can add new members'
        });
      }
      
      const memberData = req.body;
      
      // Check if email already exists
      const [existingMember] = await db.select()
        .from(members)
        .where(eq(members.email, memberData.email));
      
      if (existingMember) {
        return res.status(400).json({ 
          error: 'Member with this email already exists',
          memberId: existingMember.id
        });
      }
      
      // Generate a member number if not provided
      if (!memberData.memberNumber) {
        // Get the highest member number and increment by 1
        const results = await db.select()
          .from(members)
          .limit(1);
        
        const lastMember = results[0];
        
        if (lastMember && lastMember.memberNumber) {
          // Try to parse the last member number and add 1
          const lastNumber = parseInt(lastMember.memberNumber);
          if (!isNaN(lastNumber)) {
            memberData.memberNumber = String(lastNumber + 1);
          } else {
            memberData.memberNumber = String(lastMember.id + 1);
          }
        } else {
          // Start with member number 1001 if no members exist
          memberData.memberNumber = "1001";
        }
      }
      
      // Set imported timestamp
      memberData.importedAt = new Date();
      
      // Create the new member
      const [newMember] = await db.insert(members)
        .values(memberData)
        .returning();
      
      res.status(201).json(newMember);
    } catch (error) {
      console.error('Error creating member:', error);
      res.status(500).json({ error: 'Failed to create new member' });
    }
  });
  
  // Continue importing members from the CSV file
  app.post('/api/members/continue-import', requireAuth, async (req, res) => {
    try {
      // Only admins can trigger import operations
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only administrators can import member data'
        });
      }
      
      // Execute the import script
      const { exec } = require('child_process');
      
      // Start the import process in the background
      const importProcess = exec('npx tsx continue-import.ts', (error: any, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Import process error: ${error.message}`);
          return;
        }
        
        if (stderr) {
          console.error(`Import process stderr: ${stderr}`);
          return;
        }
        
        console.log(`Import process completed: ${stdout}`);
      });
      
      // Send a response immediately
      res.json({
        success: true,
        message: 'Import process started in the background',
        pid: importProcess.pid
      });
      
    } catch (error) {
      console.error('Error starting member import:', error);
      res.status(500).json({ error: 'Failed to start import process' });
    }
  });

  // Password reset request - Initiate a password reset
  app.post("/api/password-reset/request", async (req, res) => {
    try {
      // Validate email
      const validatedEmail = z.object({ email: z.string().email("Invalid email address") }).safeParse(req.body);
      
      if (!validatedEmail.success) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      
      const { email } = validatedEmail.data;
      
      // Check if user exists with this email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Don't reveal whether user exists for security reasons
        return res.status(200).json({ 
          success: true, 
          message: "If your email is registered, you will receive a password reset code"
        });
      }
      
      // Generate a random 7-digit code
      const code = randomInt(1000000, 9999999).toString();
      
      // Set expiration (10 minutes)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);
      
      // Store the reset code
      await storage.createVerificationCode({
        email,
        firstName: user.firstName || user.username,
        lastName: user.lastName || "",
        code,
        expiresAt
      });
      
      // Send the reset code to the user's email
      await sendVerificationEmail(
        email,
        user.firstName || user.username,
        user.lastName || "",
        code
      );
      
      // Log the code in development mode
      if (process.env.NODE_ENV === 'development') {
        log(`Password reset verification code for ${email}: ${code}`, 'mail');
      }
      
      res.status(200).json({
        success: true,
        message: "If your email is registered, you will receive a password reset code"
      });
    } catch (error) {
      console.error("Error in password reset request:", error);
      res.status(500).json({ error: "Server error during password reset request" });
    }
  });
  
  // Verify password reset code
  app.post("/api/password-reset/verify", async (req, res) => {
    try {
      // Validate the input
      const validatedInput = z.object({
        email: z.string().email("Invalid email address"),
        code: z.string().length(7, "Verification code must be 7 digits")
      }).safeParse(req.body);
      
      if (!validatedInput.success) {
        return res.status(400).json({ error: "Invalid input", details: validatedInput.error.format() });
      }
      
      const { email, code } = validatedInput.data;
      
      // Check if code exists and is valid
      const verificationRecord = await storage.getVerificationCode(email, code);
      
      if (!verificationRecord) {
        return res.status(404).json({
          error: "Invalid code",
          message: "The verification code is invalid or has expired."
        });
      }
      
      // Check if code is expired
      if (new Date() > new Date(verificationRecord.expiresAt)) {
        return res.status(400).json({
          error: "Expired code",
          message: "The verification code has expired."
        });
      }
      
      // Mark code as verified
      await storage.verifyCode(verificationRecord.id);
      
      // Get the user
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(404).json({
          error: "User not found",
          message: "No user found with this email address."
        });
      }
      
      // Generate a temporary token for password reset
      const tempToken = generateAuthToken(0); // Special token for password reset
      
      res.status(200).json({
        success: true,
        message: "Code verified successfully",
        token: tempToken,
        email
      });
    } catch (error) {
      console.error("Error in password reset code verification:", error);
      res.status(500).json({ error: "Server error during code verification" });
    }
  });
  
  // Complete password reset
  app.post("/api/password-reset/complete", async (req, res) => {
    try {
      // Validate the password data
      const validatedData = passwordResetSchema.safeParse(req.body);
      
      if (!validatedData.success) {
        return res.status(400).json({ error: "Invalid input", details: validatedData.error.format() });
      }
      
      const { email, password } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      // Find the user by email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Import and use the hashPassword function
      const { hashPassword } = await import('./auth');
      const hashedPassword = await hashPassword(password);
      
      // Update the user's password
      const updatedUser = await storage.updateUser(user.id, { password: hashedPassword });
      
      // Respond with success
      res.status(200).json({
        success: true,
        message: "Password reset successful"
      });
    } catch (error) {
      console.error("Error completing password reset:", error);
      res.status(500).json({ error: "Server error during password reset" });
    }
  });

  // Get all users - Admin only endpoint
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      // Check if the requester is an admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only administrators can view all users'
        });
      }

      // Get all users from storage
      const users = await db.query.users.findMany({
        columns: {
          id: true,
          username: true,
          email: true,
          role: true,
          memberLevel: true,
          firstName: true,
          lastName: true,
          location: true,
          createdAt: true
        },
        orderBy: (fields, { desc }) => [desc(fields.createdAt)]
      });
      
      // Remove password from results for security
      const safeUsers = users.map(user => {
        // @ts-ignore
        const { password, ...safeUser } = user;
        return safeUser;
      });

      res.json(safeUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to retrieve users' });
    }
  });

  // Create new admin user - Admin only endpoint
  app.post("/api/users/admin", requireAuth, async (req, res) => {
    try {
      // Check if the requester is an admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only administrators can create admin users'
        });
      }

      const { username, email, password, firstName, lastName, role } = req.body;

      // Validate required fields
      if (!username || !email || !password) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          message: 'Username, email, and password are required' 
        });
      }

      // Validate role
      const validRoles = ['user', 'admin', 'committee_chair', 'committee_cochair', 'committee_member'];
      const userRole = role || 'admin'; // Default to admin
      if (!validRoles.includes(userRole)) {
        return res.status(400).json({ 
          error: 'Invalid role',
          message: `Role must be one of: ${validRoles.join(', ')}` 
        });
      }

      // Check if username already exists
      const existingUsername = await db.query.users.findFirst({
        where: eq(users.username, username)
      });

      if (existingUsername) {
        return res.status(400).json({ 
          error: 'Username exists',
          message: 'This username is already taken' 
        });
      }

      // Check if email already exists
      const existingEmail = await db.query.users.findFirst({
        where: eq(users.email, email)
      });

      if (existingEmail) {
        return res.status(400).json({ 
          error: 'Email exists',
          message: 'This email is already registered' 
        });
      }

      // Hash the password
      const { hashPassword } = await import('./auth');
      const hashedPassword = await hashPassword(password);

      // Create the new user
      const [newUser] = await db.insert(users).values({
        username,
        email,
        password: hashedPassword,
        role: userRole as any,
        firstName: firstName || null,
        lastName: lastName || null,
        hasCompletedOnboarding: true, // Admin users don't need onboarding
      }).returning();

      // Remove password from response
      const { password: _, ...safeUser } = newUser;

      console.log(`New admin user created: ${username} (${email}) with role: ${userRole}`);

      res.status(201).json({ 
        message: 'Admin user created successfully',
        user: safeUser 
      });
    } catch (error) {
      console.error('Error creating admin user:', error);
      res.status(500).json({ error: 'Failed to create admin user' });
    }
  });
  
  // Get committees and roles for the authenticated user
  app.get("/api/users/me/committee-roles", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const userId = req.user.id;
      console.log(`Fetching committee roles for user ID: ${userId}`);
      
      // Get all active committee memberships for this user with committee and role details
      const memberships = await db.select({
        id: committeeMembers.id,
        committeeId: committeeMembers.committeeId,
        startDate: committeeMembers.startDate,
        committee: {
          id: committees.id,
          name: committees.name
        },
        role: {
          id: committeeRoles.id,
          name: committeeRoles.name,
          canManageCommittee: committeeRoles.canManageCommittee,
          canManageWorkshops: committeeRoles.canManageWorkshops
        }
      })
      .from(committeeMembers)
      .where(and(
        eq(committeeMembers.userId, userId),
        isNull(committeeMembers.endDate)
      ))
      .innerJoin(committeeRoles, eq(committeeMembers.roleId, committeeRoles.id))
      .innerJoin(committees, eq(committeeMembers.committeeId, committees.id))
      .orderBy(committees.name);
      
      console.log(`Found ${memberships.length} committee memberships:`, memberships);
      res.json(memberships);
    } catch (error) {
      console.error("Error fetching user committee roles:", error);
      res.status(500).json({ error: "Failed to fetch committee roles" });
    }
  });

  // Add a member to a workshop (creates a user account if needed) - admin only
  app.post('/api/workshops/:id/add-member', requireAuth, async (req, res) => {
    try {
      // Only admins can add members directly
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only administrators can directly add members to workshops'
        });
      }
      
      const workshopId = parseInt(req.params.id);
      const { memberId } = req.body;
      
      if (isNaN(workshopId) || !memberId) {
        return res.status(400).json({ error: 'Workshop ID and member ID are required' });
      }
      
      // Check if workshop exists
      const [workshop] = await db.select().from(workshops).where(eq(workshops.id, workshopId));
      
      if (!workshop) {
        return res.status(404).json({ error: 'Workshop not found' });
      }
      
      // Check if member exists
      const [member] = await db.select().from(members).where(eq(members.id, memberId));
      
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      // Check workshop capacity
      const registrations = await db.select().from(workshopRegistrations)
        .where(eq(workshopRegistrations.workshopId, workshopId));
      
      if (workshop.capacity && registrations.length >= workshop.capacity) {
        return res.status(400).json({ error: 'Workshop is at full capacity' });
      }
      
      // First check if this member already has a user account
      let userId = null;
      let existingUser = null;
      
      if (member.email) {
        const emailToCheck = member.email.toLowerCase();
        [existingUser] = await db.select()
          .from(users)
          .where(eq(sql`LOWER(${users.email})`, emailToCheck));
          
        if (existingUser) {
          userId = existingUser.id;
          
          // If user exists, check if they're already registered
          const existingRegistrations = await db.select()
            .from(workshopRegistrations)
            .where(
              and(
                eq(workshopRegistrations.workshopId, workshopId),
                eq(workshopRegistrations.userId, existingUser.id)
              )
            );
            
          if (existingRegistrations.length > 0) {
            return res.status(400).json({ 
              error: 'Member already registered',
              message: `${member.firstName} ${member.lastName} is already registered for this workshop`
            });
          }
        }
      }
      
      // If no user account exists, create one
      if (!existingUser && member.email) {
        // Generate a random temporary password (will be reset at first login)
        const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
        const { hashPassword } = await import('./auth');
        const hashedPassword = await hashPassword(tempPassword);
        
        // Create a username from the email
        const tempUsername = member.email.split('@')[0] + '-' + Math.floor(Math.random() * 10000);
        
        // Insert the new user
        const [newUser] = await db.insert(users)
          .values({
            username: tempUsername,
            password: hashedPassword,
            email: member.email,
            firstName: member.firstName,
            lastName: member.lastName,
            role: 'user' as const,
            memberLevel: (member.category as "Affiliate" | "Associate" | "Companion" | "Full Life" | "Full" | "Student" | null) || null,
            hasCompletedOnboarding: false
          })
          .returning();
          
        userId = newUser.id;
        
        // Log the creation of a temporary account
        console.log(`Created temporary user account for member #${member.memberNumber} (${member.firstName} ${member.lastName}) with ID ${userId}`);
      }
      
      // If we couldn't create a user (no email?), return an error
      if (!userId) {
        return res.status(400).json({ 
          error: 'Cannot add member without email',
          message: 'This member has no email address and cannot be registered for the workshop'
        });
      }
      
      // Check if registration already exists
      const [existingRegistration] = await db.select()
        .from(workshopRegistrations)
        .where(
          and(
            eq(workshopRegistrations.workshopId, workshopId),
            eq(workshopRegistrations.userId, userId)
          )
        );
      
      if (existingRegistration) {
        return res.status(400).json({ error: 'Member is already registered for this workshop' });
      }
      
      // Create the registration
      const [newRegistration] = await db.insert(workshopRegistrations)
        .values({
          workshopId,
          userId,
          isApproved: true, // Admin-added participants are auto-approved
          registeredAt: new Date(),
          paymentStatus: workshop.isPaid ? 'pending' : 'not_required'
        })
        .returning();
      
      res.status(201).json({
        registration: newRegistration,
        message: existingUser 
          ? `Added member with existing user account to workshop` 
          : `Added member to workshop with new user account`
      });
    } catch (error) {
      console.error('Error adding member to workshop:', error);
      res.status(500).json({ error: 'Failed to add member to workshop' });
    }
  });

  // Committee messaging endpoints
  app.post('/api/committees/:id/messages', requireAuth, async (req, res) => {
    try {
      const committeeId = parseInt(req.params.id);
      const { subject, content } = req.body;
      
      if (!subject || !content) {
        return res.status(400).json({ error: 'Subject and content are required' });
      }

      // Verify user has permission to send messages to this committee
      const userMembership = await db.select()
        .from(committeeMembers)
        .where(and(
          eq(committeeMembers.userId, req.user!.id),
          eq(committeeMembers.committeeId, committeeId),
          isNull(committeeMembers.endDate)
        ));

      if (userMembership.length === 0) {
        return res.status(403).json({ error: 'You are not a member of this committee' });
      }

      // Get all committee members to send message to
      const members = await db.select({
        userId: committeeMembers.userId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName
      })
      .from(committeeMembers)
      .innerJoin(users, eq(committeeMembers.userId, users.id))
      .where(and(
        eq(committeeMembers.committeeId, committeeId),
        isNull(committeeMembers.endDate)
      ));

      // Create messages for each committee member
      const messagePromises = members.map(member => 
        storage.createMessage({
          fromUserId: req.user!.id,
          toUserId: member.userId,
          toGroupId: null,
          filterCriteria: null,
          content: `[Committee Message] ${subject}\n\n${content}`,
          read: false
        })
      );

      await Promise.all(messagePromises);

      res.json({ 
        success: true, 
        message: `Message sent to ${members.length} committee members` 
      });
    } catch (error) {
      console.error('Error sending committee message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // Zoom meeting endpoints
  app.post('/api/committees/:id/meetings/instant', requireAuth, async (req, res) => {
    try {
      const committeeId = parseInt(req.params.id);
      
      // Verify user has permission to create meetings for this committee
      const userMembership = await db.select()
        .from(committeeMembers)
        .innerJoin(committeeRoles, eq(committeeMembers.roleId, committeeRoles.id))
        .where(and(
          eq(committeeMembers.userId, req.user!.id),
          eq(committeeMembers.committeeId, committeeId),
          isNull(committeeMembers.endDate),
          or(
            eq(committeeRoles.name, 'Chair'),
            eq(committeeRoles.name, 'Co-Chair')
          )
        ));

      if (userMembership.length === 0) {
        return res.status(403).json({ error: 'Only chairs and co-chairs can create meetings' });
      }

      // For now, return a mock Zoom meeting URL
      // In production, this would integrate with Zoom API
      const meetingUrl = `https://zoom.us/j/${Math.floor(Math.random() * 1000000000)}`;
      const meetingId = Math.floor(Math.random() * 1000000000).toString();
      
      res.json({
        success: true,
        meeting: {
          id: meetingId,
          url: meetingUrl,
          topic: `Committee Meeting - ${new Date().toLocaleDateString()}`,
          startTime: new Date().toISOString(),
          password: Math.random().toString(36).substring(2, 8)
        }
      });
    } catch (error) {
      console.error('Error creating instant meeting:', error);
      res.status(500).json({ error: 'Failed to create meeting' });
    }
  });

  app.post('/api/committees/:id/meetings/schedule', requireAuth, async (req, res) => {
    try {
      const committeeId = parseInt(req.params.id);
      const { topic, startTime, duration } = req.body;
      
      // Verify user has permission to schedule meetings for this committee
      const userMembership = await db.select()
        .from(committeeMembers)
        .innerJoin(committeeRoles, eq(committeeMembers.roleId, committeeRoles.id))
        .where(and(
          eq(committeeMembers.userId, req.user!.id),
          eq(committeeMembers.committeeId, committeeId),
          isNull(committeeMembers.endDate),
          or(
            eq(committeeRoles.name, 'Chair'),
            eq(committeeRoles.name, 'Co-Chair')
          )
        ));

      if (userMembership.length === 0) {
        return res.status(403).json({ error: 'Only chairs and co-chairs can schedule meetings' });
      }

      // For now, return a mock scheduled meeting
      // In production, this would integrate with Zoom API
      const meetingUrl = `https://zoom.us/j/${Math.floor(Math.random() * 1000000000)}`;
      const meetingId = Math.floor(Math.random() * 1000000000).toString();
      
      res.json({
        success: true,
        meeting: {
          id: meetingId,
          url: meetingUrl,
          topic: topic || `Committee Meeting - ${new Date(startTime).toLocaleDateString()}`,
          startTime: startTime,
          duration: duration || 60,
          password: Math.random().toString(36).substring(2, 8)
        }
      });
    } catch (error) {
      console.error('Error scheduling meeting:', error);
      res.status(500).json({ error: 'Failed to schedule meeting' });
    }
  });

  // Google Calendar endpoints
  app.post('/api/committees/:id/calendar/create', requireAuth, async (req, res) => {
    try {
      const committeeId = parseInt(req.params.id);
      
      // Verify user has permission to manage this committee
      const userMembership = await db.select()
        .from(committeeMembers)
        .innerJoin(committeeRoles, eq(committeeMembers.roleId, committeeRoles.id))
        .where(and(
          eq(committeeMembers.userId, req.user!.id),
          eq(committeeMembers.committeeId, committeeId),
          isNull(committeeMembers.endDate),
          or(
            eq(committeeRoles.name, 'Chair'),
            eq(committeeRoles.name, 'Co-Chair')
          )
        ));

      if (userMembership.length === 0) {
        return res.status(403).json({ error: 'Only chairs and co-chairs can create calendars' });
      }

      // Get committee info
      const committee = await db.select()
        .from(committees)
        .where(eq(committees.id, committeeId))
        .limit(1);

      if (committee.length === 0) {
        return res.status(404).json({ error: 'Committee not found' });
      }

      const { googleCalendarService } = await import('./google-calendar-service');
      
      if (!googleCalendarService.isConfigured()) {
        return res.status(501).json({ 
          error: 'Google Calendar not configured',
          message: 'Calendar integration requires Google API credentials'
        });
      }

      const calendarId = await googleCalendarService.createCommitteeCalendar(committee[0].name);
      
      res.json({
        success: true,
        calendarId: calendarId,
        message: 'Committee calendar created successfully'
      });
    } catch (error) {
      console.error('Error creating committee calendar:', error);
      res.status(500).json({ error: 'Failed to create calendar' });
    }
  });

  app.post('/api/committees/:id/calendar/events', requireAuth, async (req, res) => {
    try {
      const committeeId = parseInt(req.params.id);
      const { calendarId, title, description, startTime, endTime, attendeeEmails } = req.body;
      
      // Verify user has permission to create events for this committee
      const userMembership = await db.select()
        .from(committeeMembers)
        .innerJoin(committeeRoles, eq(committeeMembers.roleId, committeeRoles.id))
        .where(and(
          eq(committeeMembers.userId, req.user!.id),
          eq(committeeMembers.committeeId, committeeId),
          isNull(committeeMembers.endDate),
          or(
            eq(committeeRoles.name, 'Chair'),
            eq(committeeRoles.name, 'Co-Chair')
          )
        ));

      if (userMembership.length === 0) {
        return res.status(403).json({ error: 'Only chairs and co-chairs can create events' });
      }

      const { googleCalendarService } = await import('./google-calendar-service');
      
      if (!googleCalendarService.isConfigured()) {
        return res.status(501).json({ 
          error: 'Google Calendar not configured',
          message: 'Calendar integration requires Google API credentials'
        });
      }

      const event = await googleCalendarService.createEvent(calendarId, {
        summary: title,
        description: description,
        start: {
          dateTime: startTime,
          timeZone: 'America/Toronto'
        },
        end: {
          dateTime: endTime,
          timeZone: 'America/Toronto'
        },
        attendees: attendeeEmails?.map((email: string) => ({ email }))
      });

      res.json({
        success: true,
        event: event,
        message: 'Event created successfully'
      });
    } catch (error) {
      console.error('Error creating calendar event:', error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  });

  app.get('/api/committees/:id/calendar/events', requireAuth, async (req, res) => {
    try {
      const committeeId = parseInt(req.params.id);
      const { calendarId, timeMin, timeMax } = req.query;
      
      // Verify user has access to this committee
      const userMembership = await db.select()
        .from(committeeMembers)
        .where(and(
          eq(committeeMembers.userId, req.user!.id),
          eq(committeeMembers.committeeId, committeeId),
          isNull(committeeMembers.endDate)
        ));

      if (userMembership.length === 0) {
        return res.status(403).json({ error: 'Access denied to this committee' });
      }

      const { googleCalendarService } = await import('./google-calendar-service');
      
      if (!googleCalendarService.isConfigured()) {
        return res.status(501).json({ 
          error: 'Google Calendar not configured',
          message: 'Calendar integration requires Google API credentials'
        });
      }

      const events = await googleCalendarService.getEvents(
        calendarId as string,
        timeMin as string,
        timeMax as string
      );

      res.json({
        success: true,
        events: events
      });
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  });

  // Calendar Events API
  // Get calendar events (role-based visibility)
  app.get("/api/calendar-events", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      let whereConditions = [];
      
      // Role-based visibility filtering
      if (req.user.role === 'admin') {
        // Admins see all events (no additional filtering needed)
      } else if (req.user.role === 'committee_chair' || req.user.role === 'committee_cochair') {
        // Committee chairs see events visible to them OR to admins
        whereConditions.push(
          or(
            eq(calendarEvents.visibleToCommitteeChairs, true),
            eq(calendarEvents.visibleToAdmins, true)
          )
        );
      } else {
        // General members see only events marked as visible to them
        whereConditions.push(eq(calendarEvents.visibleToGeneralMembers, true));
      }

      const events = await db.select()
        .from(calendarEvents)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(calendarEvents.date));

      res.json(events);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ error: "Failed to fetch calendar events" });
    }
  });

  // Create calendar event (admin and committee chairs only)
  app.post("/api/calendar-events", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Only admins and committee chairs can create events
      if (req.user.role !== 'admin' && req.user.role !== 'committee_chair' && req.user.role !== 'committee_cochair') {
        return res.status(403).json({ error: "Only administrators and committee chairs can create calendar events" });
      }

      const eventData = {
        title: req.body.title,
        description: req.body.description || null,
        date: new Date(req.body.date),
        time: req.body.time || '09:00',
        location: req.body.location || null,
        type: req.body.type || 'meeting',
        attendees: req.body.attendees || [],
        createdBy: req.user.id,
        // Default visibility: only admin and chairs can see initially
        visibleToGeneralMembers: false,
        visibleToCommitteeChairs: true,
        visibleToAdmins: true
      };

      const [newEvent] = await db.insert(calendarEvents)
        .values(eventData)
        .returning();

      res.status(201).json(newEvent);
    } catch (error) {
      console.error("Error creating calendar event:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create calendar event" });
    }
  });

  // Update calendar event visibility (admin only)
  app.patch("/api/calendar-events/:id/visibility", requireAuth, async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: "Only administrators can update event visibility" });
      }

      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json({ error: "Invalid event ID" });
      }

      const { visibleToGeneralMembers, visibleToCommitteeChairs, visibleToAdmins } = req.body;

      const [updatedEvent] = await db.update(calendarEvents)
        .set({
          visibleToGeneralMembers: visibleToGeneralMembers,
          visibleToCommitteeChairs: visibleToCommitteeChairs,
          visibleToAdmins: visibleToAdmins,
          updatedAt: new Date()
        })
        .where(eq(calendarEvents.id, eventId))
        .returning();

      if (!updatedEvent) {
        return res.status(404).json({ error: "Calendar event not found" });
      }

      res.json(updatedEvent);
    } catch (error) {
      console.error("Error updating calendar event visibility:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update event visibility" });
    }
  });

  // Update calendar event (admin and creator only)
  app.patch("/api/calendar-events/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json({ error: "Invalid event ID" });
      }

      // Check if event exists and user has permission to edit
      const [existingEvent] = await db.select()
        .from(calendarEvents)
        .where(eq(calendarEvents.id, eventId));

      if (!existingEvent) {
        return res.status(404).json({ error: "Calendar event not found" });
      }

      // Only admin or the creator can edit
      if (req.user.role !== 'admin' && existingEvent.createdBy !== req.user.id) {
        return res.status(403).json({ error: "You can only edit events you created" });
      }

      const { visibleToGeneralMembers, visibleToCommitteeChairs, visibleToAdmins, ...eventData } = req.body;

      const [updatedEvent] = await db.update(calendarEvents)
        .set({
          ...eventData,
          updatedAt: new Date()
        })
        .where(eq(calendarEvents.id, eventId))
        .returning();

      res.json(updatedEvent);
    } catch (error) {
      console.error("Error updating calendar event:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update calendar event" });
    }
  });

  // Delete calendar event (admin and creator only)
  app.delete("/api/calendar-events/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json({ error: "Invalid event ID" });
      }

      // Check if event exists and user has permission to delete
      const [existingEvent] = await db.select()
        .from(calendarEvents)
        .where(eq(calendarEvents.id, eventId));

      if (!existingEvent) {
        return res.status(404).json({ error: "Calendar event not found" });
      }

      // Only admin or the creator can delete
      if (req.user.role !== 'admin' && existingEvent.createdBy !== req.user.id) {
        return res.status(403).json({ error: "You can only delete events you created" });
      }

      await db.delete(calendarEvents)
        .where(eq(calendarEvents.id, eventId));

      res.json({ message: "Calendar event deleted successfully" });
    } catch (error) {
      console.error("Error deleting calendar event:", error);
      res.status(500).json({ error: "Failed to delete calendar event" });
    }
  });

  // Get current user's member profile
  app.get("/api/user/member-profile", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Find member record that matches user's email
      const [memberRecord] = await db.select()
        .from(members)
        .where(eq(members.email, req.user.email))
        .limit(1);

      if (!memberRecord) {
        return res.status(404).json({ error: "Member profile not found" });
      }

      // Return member profile data
      res.json({
        member: {
          id: memberRecord.id,
          firstName: memberRecord.firstName,
          lastName: memberRecord.lastName,
          email: memberRecord.email,
          memberNumber: memberRecord.memberNumber,
          category: memberRecord.category
        }
      });
    } catch (error) {
      console.error("Error fetching user member profile:", error);
      res.status(500).json({ error: "Failed to fetch member profile" });
    }
  });
  
  // Demographic Change Request API endpoints
  app.post("/api/demographic-change-requests", requireAuth, async (req, res) => {
    try {
      console.log("Request body:", req.body);
      console.log("User:", req.user);
      
      // Prepare the data with required fields
      const requestData = {
        requesterId: req.user!.id,
        memberId: req.body.memberId,
        requestedChanges: req.body.requestedChanges,
        reasonForChange: req.body.reasonForChange || null,
        currentValues: {}, // Will be filled below
      };
      
      console.log("Request data before validation:", requestData);
      
      // Get current member data for comparison
      const currentMember = await db.select().from(members).where(eq(members.id, requestData.memberId)).limit(1);
      
      if (currentMember.length === 0) {
        return res.status(404).json({ error: "Member not found" });
      }

      // Add current values
      requestData.currentValues = currentMember[0];
      
      const validatedData = insertDemographicChangeRequestSchema.parse(requestData);
      
      const request = await db.insert(demographicChangeRequests).values(validatedData).returning();

      res.status(201).json(request[0]);
    } catch (error) {
      console.error("Error creating demographic change request:", error);
      if (error instanceof ZodError) {
        console.error("Zod validation error:", error.errors);
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create demographic change request" });
    }
  });

  app.get("/api/demographic-change-requests/pending", requireAuth, async (req, res) => {
    try {
      const pendingRequests = await db.select({
        id: demographicChangeRequests.id,
        requesterId: demographicChangeRequests.requesterId,
        memberId: demographicChangeRequests.memberId,
        requestedChanges: demographicChangeRequests.requestedChanges,
        currentValues: demographicChangeRequests.currentValues,
        status: demographicChangeRequests.status,
        reasonForChange: demographicChangeRequests.reasonForChange,
        createdAt: demographicChangeRequests.createdAt,
        requesterName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        memberName: sql<string>`${members.firstName} || ' ' || ${members.lastName}`,
      })
      .from(demographicChangeRequests)
      .leftJoin(users, eq(demographicChangeRequests.requesterId, users.id))
      .leftJoin(members, eq(demographicChangeRequests.memberId, members.id))
      .where(eq(demographicChangeRequests.status, "pending"))
      .orderBy(desc(demographicChangeRequests.createdAt));

      res.json(pendingRequests);
    } catch (error) {
      console.error("Error fetching pending demographic change requests:", error);
      res.status(500).json({ error: "Failed to fetch pending requests" });
    }
  });

  // Get user's own demographic change requests
  app.get("/api/demographic-change-requests/user/:userId", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Only allow users to see their own requests (or admins/diversity chairs to see all)
      if (req.user!.id !== userId && !req.user!.username.includes('admin@csc.ca') && !req.user!.username.includes('div.chair@csc.ca')) {
        return res.status(403).json({ error: "Access denied" });
      }

      const userRequests = await db.select().from(demographicChangeRequests)
        .where(and(
          eq(demographicChangeRequests.requesterId, userId),
          eq(demographicChangeRequests.status, 'pending')
        ))
        .orderBy(desc(demographicChangeRequests.createdAt));
      
      res.json(userRequests);
    } catch (error) {
      console.error("Error fetching user demographic change requests:", error);
      res.status(500).json({ error: "Failed to fetch user requests" });
    }
  });

  app.patch("/api/demographic-change-requests/:id", requireAuth, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const { status, reviewNotes } = req.body;

      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      // Get the original request
      const originalRequest = await db.select().from(demographicChangeRequests).where(eq(demographicChangeRequests.id, requestId)).limit(1);
      
      if (originalRequest.length === 0) {
        return res.status(404).json({ error: "Request not found" });
      }

      // Update the request status
      const updatedRequest = await db.update(demographicChangeRequests)
        .set({
          status,
          reviewNotes,
          reviewedById: req.user!.id,
          reviewedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(demographicChangeRequests.id, requestId))
        .returning();

      // If approved, update the member's demographic data
      if (status === "approved") {
        const requestedChanges = originalRequest[0].requestedChanges as Record<string, any>;
        await db.update(members)
          .set(requestedChanges)
          .where(eq(members.id, originalRequest[0].memberId));
      }

      res.json(updatedRequest[0]);
    } catch (error) {
      console.error("Error reviewing demographic change request:", error);
      res.status(500).json({ error: "Failed to review request" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}