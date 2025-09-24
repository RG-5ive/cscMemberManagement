import type { 
  User, 
  InsertUser, 
  Message, 
  Survey, 
  SurveyResponse, 
  Workshop, 
  WorkshopRegistration, 
  VerificationCode,
  InsertVerificationCode
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

// Use memory store for sessions
const MemoryStore = createMemoryStore(session);

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEmailAndRole(email: string, role: string): Promise<User | undefined>;
  getUsersByIds(ids: number[]): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User>;

  // Message operations
  createMessage(message: Omit<Message, "id" | "createdAt">): Promise<Message>;
  getMessagesByUser(userId: number): Promise<Message[]>;
  markMessageAsRead(messageId: number): Promise<void>;
  
  // Message group operations
  createMessageGroup(name: string, description: string | null, createdById: number): Promise<any>;
  getMessageGroups(): Promise<any[]>;
  getMessageGroupById(groupId: number): Promise<any | undefined>;
  updateMessageGroup(groupId: number, data: { name?: string, description?: string }): Promise<any>;
  deleteMessageGroup(groupId: number): Promise<void>;
  
  // Message group members operations
  addMemberToGroup(groupId: number, memberId: number, addedById: number): Promise<any>;
  removeMemberFromGroup(groupId: number, memberId: number): Promise<void>;
  getGroupMembers(groupId: number): Promise<any[]>;
  
  // Group messaging operations
  sendMessageToGroup(fromUserId: number, groupId: number, content: string): Promise<Message>;
  getMessagesForGroup(groupId: number): Promise<Message[]>;

  // Survey operations
  createSurvey(survey: Omit<Survey, "id" | "createdAt">): Promise<Survey>;
  getSurvey(id: number): Promise<Survey | undefined>;
  getSurveys(): Promise<Survey[]>;

  // Survey response operations
  createSurveyResponse(response: Omit<SurveyResponse, "id" | "submittedAt">): Promise<SurveyResponse>;
  getSurveyResponses(surveyId: number): Promise<SurveyResponse[]>;

  // Workshop operations
  createWorkshop(workshop: Omit<Workshop, "id">): Promise<Workshop>;
  getWorkshops(): Promise<Workshop[]>;
  registerForWorkshop(registration: Omit<WorkshopRegistration, "id" | "registeredAt">): Promise<WorkshopRegistration>;
  
  // Verification operations
  createVerificationCode(data: InsertVerificationCode): Promise<VerificationCode>;
  getVerificationCode(email: string, code: string): Promise<VerificationCode | undefined>;
  verifyCode(id: number): Promise<VerificationCode>;
  getPendingVerifications(email: string): Promise<VerificationCode[]>;
  
  // Member verification operations
  checkMemberExists(email: string, firstName: string, lastName: string): Promise<boolean>;

  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  sessionStore: session.Store;
  
  // In-memory data stores
  private users: Map<number, User> = new Map();
  private usernameIndex: Map<string, number> = new Map();
  private emailIndex: Map<string, number> = new Map();
  private nextUserId = 1;
  
  private messages: Map<number, Message> = new Map();
  private nextMessageId = 1;
  
  private surveys: Map<number, Survey> = new Map();
  private nextSurveyId = 1;
  
  private surveyResponses: Map<number, SurveyResponse> = new Map();
  private nextSurveyResponseId = 1;
  
  private workshops: Map<number, Workshop> = new Map();
  private nextWorkshopId = 1;
  
  private workshopRegistrations: Map<number, WorkshopRegistration> = new Map();
  private nextWorkshopRegistrationId = 1;
  
  private verificationCodes: Map<number, VerificationCode> = new Map();
  private codeEmailIndex: Map<string, number[]> = new Map();
  private nextVerificationCodeId = 1;
  
  private approvedMembers: Map<string, string[]> = new Map(); // Email -> names

  constructor() {
    // Use memory store for sessions
    this.sessionStore = new MemoryStore({
      checkPeriod: 3600000, // prune expired entries every hour
      stale: false, // Don't return stale sessions
      ttl: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
    });
    
    // Initialize with a demo user
    this.createInitialUser();
    
    // Add some demo approved members for testing verification
    this.approvedMembers.set('test@example.com', ['Test User']);
    this.approvedMembers.set('demo@example.com', ['Demo User']);
    this.approvedMembers.set('member@example.com', ['Member Test']);
    this.approvedMembers.set('jane@example.com', ['Jane Doe']);
    this.approvedMembers.set('john@example.com', ['John Doe']);
  }

  private createInitialUser() {
    const demoUser: User = {
      id: this.nextUserId++,
      username: "John Doe",
      firstName: "John",
      lastName: "Doe",
      email: "demo@example.com",
      password: "$2b$10$I8WF5KHSqJLWVUwUEXRZb.LNL35PwvXvrKjv0k0I1.zcO1QYvwj66", // "password"
      role: "admin",
      // Contact information
      phoneNumber: null,
      alternateEmail: null,
      emergencyContact: null,
      emergencyPhone: null,
      // Demographic information
      memberLevel: null,
      gender: null,
      lgbtq2Status: null,
      bipocStatus: null,
      ethnicity: [],
      location: null,
      languages: [],
      // Required permission fields
      canManageCommittees: true,
      canManageWorkshops: true,
      hasCompletedOnboarding: true,
      createdAt: new Date(),
    };
    
    // Add the demo user to our store
    this.users.set(demoUser.id, demoUser);
    this.usernameIndex.set(demoUser.username, demoUser.id);
    this.emailIndex.set(demoUser.email, demoUser.id);
    
    // Add some approved members
    this.approvedMembers.set("john.smith@example.com", ["John Smith", "J Smith"]);
    this.approvedMembers.set("jane.doe@example.com", ["Jane Doe"]);
    
    console.log('Initialized memory storage with demo user');
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const userId = this.usernameIndex.get(username);
    if (userId !== undefined) {
      return this.users.get(userId);
    }
    return undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const userId = this.emailIndex.get(email);
    if (userId !== undefined) {
      return this.users.get(userId);
    }
    return undefined;
  }
  
  async getUserByEmailAndRole(email: string, role: string): Promise<User | undefined> {
    console.log(`MemStorage: Looking for user with email ${email} and role ${role}`);
    
    // Find all users and look for matching email (case-insensitive) + role
    const users = Array.from(this.users.values());
    for (const user of users) {
      if (user.email.toLowerCase() === email.toLowerCase() && user.role === role) {
        console.log(`MemStorage: Found user with matching email and role: ID ${user.id}, username ${user.username}`);
        return user;
      }
    }
    
    console.log(`MemStorage: No user found with email ${email} and role ${role}`);
    return undefined;
  }
  
  async getUsersByIds(ids: number[]): Promise<User[]> {
    const result: User[] = [];
    
    for (const id of ids) {
      const user = this.users.get(id);
      if (user) {
        result.push(user);
      }
    }
    
    return result;
  }

  async createUser(userData: InsertUser): Promise<User> {
    // Validate required fields
    if (!userData.username) {
      throw new Error("Username is required");
    }
    if (!userData.email) {
      throw new Error("Email is required");
    }
    if (!userData.password) {
      throw new Error("Password is required");
    }
    
    // Check if username already exists
    if (this.usernameIndex.has(userData.username)) {
      throw new Error("Username already exists");
    }
    
    // Check if email already exists
    if (this.emailIndex.has(userData.email)) {
      throw new Error("Email already exists");
    }
    
    const user: User = {
      id: this.nextUserId++,
      username: userData.username,
      password: userData.password,
      email: userData.email,
      role: userData.role || "user",
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      // Contact information
      phoneNumber: null,
      alternateEmail: null,
      emergencyContact: null,
      emergencyPhone: null,
      // Demographic information
      memberLevel: null,
      gender: null,
      lgbtq2Status: null,
      bipocStatus: null,
      ethnicity: [],
      location: null,
      languages: [],
      // Required permission fields
      canManageCommittees: userData.role === "admin" || userData.role === "committee_chair",
      canManageWorkshops: userData.role === "admin" || userData.role === "committee_chair" || userData.role === "committee_cochair",
      hasCompletedOnboarding: false,
      createdAt: new Date(),
    };
    
    // Add to collections
    this.users.set(user.id, user);
    this.usernameIndex.set(user.username, user.id);
    this.emailIndex.set(user.email, user.id);
    
    return user;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    
    // Handle username change
    if (data.username && data.username !== user.username) {
      if (this.usernameIndex.has(data.username)) {
        throw new Error("Username already exists");
      }
      
      // Update username index
      this.usernameIndex.delete(user.username);
      this.usernameIndex.set(data.username, user.id);
    }
    
    // Handle email change
    if (data.email && data.email !== user.email) {
      if (this.emailIndex.has(data.email)) {
        throw new Error("Email already exists");
      }
      
      // Update email index
      this.emailIndex.delete(user.email);
      this.emailIndex.set(data.email, user.id);
    }
    
    // Update user data
    const updatedUser = { ...user, ...data };
    this.users.set(id, updatedUser);
    
    return updatedUser;
  }

  // Message operations
  async createMessage(message: Omit<Message, "id" | "createdAt">): Promise<Message> {
    const newMessage: Message = {
      id: this.nextMessageId++,
      ...message,
      createdAt: new Date(),
    };
    
    this.messages.set(newMessage.id, newMessage);
    return newMessage;
  }

  async getMessagesByUser(userId: number): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(
      msg => msg.fromUserId === userId || msg.toUserId === userId
    );
  }

  async markMessageAsRead(messageId: number): Promise<void> {
    const message = this.messages.get(messageId);
    if (message) {
      message.read = true;
      this.messages.set(messageId, message);
    } else {
      throw new Error(`Message with id ${messageId} not found`);
    }
  }

  // Survey operations
  async createSurvey(survey: Omit<Survey, "id" | "createdAt">): Promise<Survey> {
    const newSurvey: Survey = {
      id: this.nextSurveyId++,
      ...survey,
      createdAt: new Date(),
    };
    
    this.surveys.set(newSurvey.id, newSurvey);
    return newSurvey;
  }

  async getSurvey(id: number): Promise<Survey | undefined> {
    return this.surveys.get(id);
  }

  async getSurveys(): Promise<Survey[]> {
    return Array.from(this.surveys.values());
  }

  // Survey response operations
  async createSurveyResponse(response: Omit<SurveyResponse, "id" | "submittedAt">): Promise<SurveyResponse> {
    const newResponse: SurveyResponse = {
      id: this.nextSurveyResponseId++,
      ...response,
      submittedAt: new Date(),
    };
    
    this.surveyResponses.set(newResponse.id, newResponse);
    return newResponse;
  }

  async getSurveyResponses(surveyId: number): Promise<SurveyResponse[]> {
    return Array.from(this.surveyResponses.values())
      .filter(response => response.surveyId === surveyId);
  }

  // Workshop operations
  async createWorkshop(workshop: Omit<Workshop, "id">): Promise<Workshop> {
    const newWorkshop: Workshop = {
      id: this.nextWorkshopId++,
      ...workshop,
    };
    
    this.workshops.set(newWorkshop.id, newWorkshop);
    return newWorkshop;
  }

  async getWorkshops(): Promise<Workshop[]> {
    return Array.from(this.workshops.values());
  }

  async registerForWorkshop(registration: Omit<WorkshopRegistration, "id" | "registeredAt">): Promise<WorkshopRegistration> {
    const newRegistration: WorkshopRegistration = {
      id: this.nextWorkshopRegistrationId++,
      ...registration,
      registeredAt: new Date(),
    };
    
    this.workshopRegistrations.set(newRegistration.id, newRegistration);
    return newRegistration;
  }

  // Verification code operations
  async createVerificationCode(data: InsertVerificationCode): Promise<VerificationCode> {
    const newCode: VerificationCode = {
      id: this.nextVerificationCodeId++,
      ...data,
      verified: false,
      createdAt: new Date(),
    };
    
    this.verificationCodes.set(newCode.id, newCode);
    
    // Update email index
    const existingCodes = this.codeEmailIndex.get(data.email) || [];
    existingCodes.push(newCode.id);
    this.codeEmailIndex.set(data.email, existingCodes);
    
    return newCode;
  }

  async getVerificationCode(email: string, code: string): Promise<VerificationCode | undefined> {
    const codeIds = this.codeEmailIndex.get(email) || [];
    
    for (const id of codeIds) {
      const verificationCode = this.verificationCodes.get(id);
      if (verificationCode && verificationCode.code === code) {
        return verificationCode;
      }
    }
    
    return undefined;
  }

  async verifyCode(id: number): Promise<VerificationCode> {
    const code = this.verificationCodes.get(id);
    if (!code) {
      throw new Error(`Verification code with id ${id} not found`);
    }
    
    const updatedCode: VerificationCode = {
      ...code,
      verified: true,
    };
    
    this.verificationCodes.set(id, updatedCode);
    return updatedCode;
  }
  
  async getPendingVerifications(email: string): Promise<VerificationCode[]> {
    const codeIds = this.codeEmailIndex.get(email) || [];
    const now = new Date();
    
    // Get all unverified codes that haven't expired yet
    const pendingCodes = [];
    for (const id of codeIds) {
      const code = this.verificationCodes.get(id);
      if (code && !code.verified && code.expiresAt && new Date(code.expiresAt) > now) {
        pendingCodes.push(code);
      }
    }
    
    // Sort by creation date, most recent first
    return pendingCodes.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }

  // Member verification operations
  async checkMemberExists(email: string, firstName: string, lastName: string): Promise<boolean> {
    // Always approve in development mode for testing
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    
    // For demo purposes, always approve test@example.com
    if (email === 'test@example.com') {
      return true;
    }
    
    // Check against valid member records
    const validNames = this.approvedMembers.get(email);
    if (!validNames) {
      return false;
    }
    
    const fullName = `${firstName} ${lastName}`;
    return validNames.some(validName => 
      validName.toLowerCase() === fullName.toLowerCase() ||
      validName.toLowerCase().includes(firstName.toLowerCase()) && validName.toLowerCase().includes(lastName.toLowerCase())
    );
  }

  // Message group operations - stub implementations
  async createMessageGroup(name: string, description: string | null, createdById: number): Promise<any> {
    return { id: 1, name, description, createdById, createdAt: new Date() };
  }

  async getMessageGroups(): Promise<any[]> {
    return [];
  }

  async getMessageGroupById(groupId: number): Promise<any | undefined> {
    return undefined;
  }

  async updateMessageGroup(groupId: number, data: { name?: string, description?: string }): Promise<any> {
    return { id: groupId, ...data };
  }

  async deleteMessageGroup(groupId: number): Promise<void> {
    // Stub implementation
  }

  async addMemberToGroup(groupId: number, memberId: number, addedById: number): Promise<any> {
    return { groupId, memberId, addedById, addedAt: new Date() };
  }

  async removeMemberFromGroup(groupId: number, memberId: number): Promise<void> {
    // Stub implementation
  }

  async getGroupMembers(groupId: number): Promise<any[]> {
    return [];
  }

  async sendMessageToGroup(fromUserId: number, groupId: number, content: string): Promise<Message> {
    return this.createMessage({
      fromUserId,
      toUserId: 0, // Group message
      content,
      type: "text",
      read: false
    });
  }

  async getMessagesForGroup(groupId: number): Promise<Message[]> {
    return [];
  }
}

export const storage = new MemStorage();