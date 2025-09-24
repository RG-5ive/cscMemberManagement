import { 
  User, InsertUser, Message, Survey, SurveyResponse, 
  Workshop, WorkshopRegistration, VerificationCode, InsertVerificationCode, Member,
  MessageGroup, MessageGroupMember,
  users, messages, surveys, surveyResponses, workshops, workshopRegistrations, verificationCodes,
  members, messageGroups, messageGroupMembers
} from '@shared/schema';
import { db } from './db';
import { eq, and, desc, sql, inArray, or } from 'drizzle-orm';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { pool } from './db';

// Re-export the interface type from memory-storage for compatibility
export type { IStorage } from './memory-storage';
import { IStorage } from './memory-storage';

// PostgreSQL session store
const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    // Initialize PostgreSQL session store
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
    console.log("PostgreSQL session store initialized");
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Use case-insensitive comparison with ilike
    const [user] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = LOWER(${email})`);
    return user;
  }
  
  // New method to get a user by email AND role
  async getUserByEmailAndRole(email: string, role: string): Promise<User | undefined> {
    console.log(`Looking for user with email ${email} and role ${role}`);
    
    // Use case-insensitive email comparison + role filtering
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          sql`LOWER(${users.email}) = LOWER(${email})`,
          sql`${users.role} = ${role}`
        )
      );
      
    if (user) {
      console.log(`Found user with matching email and role: ID ${user.id}, username ${user.username}`);
    } else {
      console.log(`No user found with email ${email} and role ${role}`);
    }
    
    return user;
  }
  
  // Get multiple users by their IDs
  async getUsersByIds(ids: number[]): Promise<User[]> {
    if (!ids.length) return [];
    
    console.log("Fetching users with IDs:", ids);

    // Make sure we're working with an array of numbers, not a string
    const userIds = ids.map(id => typeof id === 'string' ? parseInt(id, 10) : id);
    
    // Simplify the query - create an OR condition for each ID
    const conditions = userIds.map(id => eq(users.id, id));
    const userData = await db.select().from(users).where(conditions.length === 1 ? conditions[0] : or(...conditions));
    
    return userData;
  }

  async createUser(userData: InsertUser): Promise<User> {
    // Ensure required fields are present
    if (!userData.username || !userData.email || !userData.password) {
      throw new Error("Username, email, and password are required");
    }
    
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const [user] = await db.update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Message operations
  async createMessage(message: Omit<Message, "id" | "createdAt">): Promise<Message> {
    const [newMessage] = await db.insert(messages)
      .values({
        ...message,
        createdAt: new Date()
      })
      .returning();
    return newMessage;
  }

  async getMessagesByUser(userId: number): Promise<Message[]> {
    return await db.select()
      .from(messages)
      .where(eq(messages.toUserId, userId)) // Using toUserId as per the schema
      .orderBy(desc(messages.createdAt));
  }

  async markMessageAsRead(messageId: number): Promise<void> {
    await db.update(messages)
      .set({ read: true })
      .where(eq(messages.id, messageId));
  }
  
  // Message group operations
  async createMessageGroup(name: string, description: string | null, createdById: number): Promise<MessageGroup> {
    const [group] = await db.insert(messageGroups)
      .values({
        name,
        description,
        createdById,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return group;
  }
  
  async getMessageGroups(): Promise<MessageGroup[]> {
    return await db.select().from(messageGroups);
  }
  
  async getMessageGroupById(groupId: number): Promise<MessageGroup | undefined> {
    const [group] = await db.select().from(messageGroups).where(eq(messageGroups.id, groupId));
    return group;
  }
  
  async updateMessageGroup(groupId: number, data: { name?: string, description?: string }): Promise<MessageGroup> {
    const [group] = await db.update(messageGroups)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(messageGroups.id, groupId))
      .returning();
    return group;
  }
  
  async deleteMessageGroup(groupId: number): Promise<void> {
    // First delete all members of the group
    await db.delete(messageGroupMembers)
      .where(eq(messageGroupMembers.groupId, groupId));
    
    // Then delete messages sent to the group
    await db.delete(messages)
      .where(eq(messages.toGroupId, groupId));
    
    // Finally delete the group itself
    await db.delete(messageGroups)
      .where(eq(messageGroups.id, groupId));
  }
  
  // Message group members operations
  async addMemberToGroup(groupId: number, memberId: number, addedById: number): Promise<MessageGroupMember> {
    const [member] = await db.insert(messageGroupMembers)
      .values({
        groupId,
        memberId,
        addedById,
        addedAt: new Date()
      })
      .returning();
    return member;
  }
  
  async removeMemberFromGroup(groupId: number, memberId: number): Promise<void> {
    await db.delete(messageGroupMembers)
      .where(
        and(
          eq(messageGroupMembers.groupId, groupId),
          eq(messageGroupMembers.memberId, memberId)
        )
      );
  }
  
  async getGroupMembers(groupId: number): Promise<any[]> {
    // Join with members table to get full member details
    const groupMembers = await db
      .select({
        id: messageGroupMembers.id,
        groupId: messageGroupMembers.groupId,
        memberId: messageGroupMembers.memberId,
        addedAt: messageGroupMembers.addedAt,
        firstName: members.firstName,
        lastName: members.lastName,
        email: members.email,
        province: members.province,
      })
      .from(messageGroupMembers)
      .innerJoin(members, eq(messageGroupMembers.memberId, members.id))
      .where(eq(messageGroupMembers.groupId, groupId));
      
    return groupMembers;
  }
  
  // Group messaging operations
  async sendMessageToGroup(fromUserId: number, groupId: number, content: string): Promise<Message> {
    const [message] = await db.insert(messages)
      .values({
        fromUserId,
        toGroupId: groupId,
        toUserId: null,
        content,
        read: false,
        createdAt: new Date(),
        filterCriteria: null
      })
      .returning();
    return message;
  }
  
  async getMessagesForGroup(groupId: number): Promise<Message[]> {
    return await db.select()
      .from(messages)
      .where(eq(messages.toGroupId, groupId))
      .orderBy(desc(messages.createdAt));
  }

  // Survey operations
  async createSurvey(survey: Omit<Survey, "id" | "createdAt">): Promise<Survey> {
    const [newSurvey] = await db.insert(surveys)
      .values({
        ...survey,
        createdAt: new Date()
      })
      .returning();
    return newSurvey;
  }

  async getSurvey(id: number): Promise<Survey | undefined> {
    const [survey] = await db.select().from(surveys).where(eq(surveys.id, id));
    return survey;
  }

  async getSurveys(): Promise<Survey[]> {
    return await db.select().from(surveys);
  }

  // Survey response operations
  async createSurveyResponse(response: Omit<SurveyResponse, "id" | "submittedAt">): Promise<SurveyResponse> {
    const [newResponse] = await db.insert(surveyResponses)
      .values({
        ...response,
        submittedAt: new Date()
      })
      .returning();
    return newResponse;
  }

  async getSurveyResponses(surveyId: number): Promise<SurveyResponse[]> {
    return await db.select()
      .from(surveyResponses)
      .where(eq(surveyResponses.surveyId, surveyId));
  }

  // Workshop operations
  async createWorkshop(workshop: Omit<Workshop, "id">): Promise<Workshop> {
    const [newWorkshop] = await db.insert(workshops)
      .values(workshop)
      .returning();
    return newWorkshop;
  }

  async getWorkshops(): Promise<Workshop[]> {
    return await db.select().from(workshops);
  }

  // Workshop registration operations
  async registerForWorkshop(registration: Omit<WorkshopRegistration, "id" | "registeredAt">): Promise<WorkshopRegistration> {
    const [newRegistration] = await db.insert(workshopRegistrations)
      .values({
        ...registration,
        registeredAt: new Date()
      })
      .returning();
    return newRegistration;
  }

  // Verification code operations
  async createVerificationCode(data: InsertVerificationCode): Promise<VerificationCode> {
    const [newCode] = await db.insert(verificationCodes)
      .values({
        ...data,
        createdAt: new Date(),
        verified: false
      })
      .returning();
    return newCode;
  }

  async getVerificationCode(email: string, code: string): Promise<VerificationCode | undefined> {
    const [verificationCode] = await db.select()
      .from(verificationCodes)
      .where(
        and(
          sql`LOWER(${verificationCodes.email}) = LOWER(${email})`,
          eq(verificationCodes.code, code)
        )
      );
    return verificationCode;
  }

  async verifyCode(id: number): Promise<VerificationCode> {
    const [updatedCode] = await db.update(verificationCodes)
      .set({ verified: true })
      .where(eq(verificationCodes.id, id))
      .returning();
    return updatedCode;
  }
  
  async getPendingVerifications(email: string): Promise<VerificationCode[]> {
    try {
      // Get all unverified codes for this email that haven't expired (case-insensitive)
      const now = new Date();
      const verifications = await db
        .select()
        .from(verificationCodes)
        .where(
          and(
            sql`LOWER(${verificationCodes.email}) = LOWER(${email})`,
            eq(verificationCodes.verified, false),
            sql`${verificationCodes.expiresAt} > NOW()`
          )
        )
        .orderBy(desc(verificationCodes.createdAt));
      
      return verifications;
    } catch (error) {
      console.error("Error getting pending verifications:", error);
      return [];
    }
  }

  // Member verification operations (simulating check against a member database)
  async checkMemberExists(email: string, firstName: string, lastName: string): Promise<boolean> {
    // Query the members table to check if the member exists (case-insensitive email and flexible name matching)
    const foundMembers = await db.select()
      .from(members)
      .where(
        and(
          sql`LOWER(${members.email}) = LOWER(${email})`,
          sql`LOWER(TRIM(${members.firstName})) = LOWER(TRIM(${firstName}))`,
          // Allow partial matching for last name to handle cases like "Forbes, MFA" vs "Forbes"
          or(
            sql`LOWER(TRIM(${members.lastName})) = LOWER(TRIM(${lastName}))`,
            sql`LOWER(TRIM(${members.lastName})) LIKE LOWER(TRIM(${lastName})) || '%'`
          )
        )
      );
    
    return foundMembers.length > 0;
  }
  
  async getMemberData(email: string, firstName: string, lastName: string): Promise<{ memberLevel: string | null } | null> {
    // Query the members table to get member data including their level (case-insensitive email and flexible name matching)
    const foundMember = await db.select()
      .from(members)
      .where(
        and(
          sql`LOWER(${members.email}) = LOWER(${email})`,
          sql`LOWER(TRIM(${members.firstName})) = LOWER(TRIM(${firstName}))`,
          // Allow partial matching for last name to handle cases like "Forbes, MFA" vs "Forbes"
          or(
            sql`LOWER(TRIM(${members.lastName})) = LOWER(TRIM(${lastName}))`,
            sql`LOWER(TRIM(${members.lastName})) LIKE LOWER(TRIM(${lastName})) || '%'`
          )
        )
      )
      .limit(1);
    
    if (foundMember.length === 0) {
      return null;
    }
    
    // Map the category field from members table to the memberLevel format in users table
    const categoryToLevelMap: Record<string, string> = {
      "AFFILIATE": "Affiliate",
      "ASSOCIATE": "Associate",
      "COMPANION": "Companion",
      "FULL LIFE": "Full Life",
      "FULL": "Full",
      "STUDENT": "Student"
    };
    
    // Get the category and map it to a memberLevel, or null if not mappable
    const category = foundMember[0].category || '';
    const memberLevel = categoryToLevelMap[category.toUpperCase()] || null;
    
    return { memberLevel };
  }
}

// Export a DatabaseStorage instance
export const storage = new DatabaseStorage();