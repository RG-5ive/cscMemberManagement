import { pgTable, text, serial, integer, boolean, json, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  role: text("role", { enum: ["user", "admin", "committee_chair", "committee_cochair", "committee_member"] }).default("user").notNull(),
  // Personal information
  firstName: text("first_name"),
  lastName: text("last_name"),
  // Contact information
  phoneNumber: text("phone_number"),
  alternateEmail: text("alternate_email"),
  emergencyContact: text("emergency_contact"),
  emergencyPhone: text("emergency_phone"),
  // Demographic information
  memberLevel: text("member_level", {
    enum: ["Affiliate", "Associate", "Companion", "Full Life", "Full", "Student"]
  }),
  gender: text("gender", { enum: ["Female", "Male", "Non-Binary", ""] }),
  lgbtq2Status: text("lgbtq2_status", { enum: ["Yes", "No", ""] }),
  bipocStatus: text("bipoc_status", { enum: ["Yes", "No", ""] }),
  ethnicity: text("ethnicity").array(),
  location: text("location"),
  languages: text("languages").array(),
  // Committee-related permissions
  canManageCommittees: boolean("can_manage_committees").default(false),
  canManageWorkshops: boolean("can_manage_workshops").default(false),
  // Onboarding and account status
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messageGroups = pgTable("message_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messageGroupMembers = pgTable("message_group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => messageGroups.id).notNull(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  addedById: integer("added_by_id").references(() => users.id),
  addedAt: timestamp("added_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").references(() => users.id),
  // Can be null if it's a group message
  toUserId: integer("to_user_id").references(() => users.id),
  // Can be null if it's a direct message
  toGroupId: integer("to_group_id").references(() => messageGroups.id),
  // For messages filtered by criteria rather than explicit groups
  filterCriteria: json("filter_criteria"),
  content: text("content").notNull(),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const surveys = pgTable("surveys", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  questions: json("questions").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const calendarEvents = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  date: timestamp("date").notNull(),
  time: text("time").notNull(),
  location: text("location"),
  type: text("type", { enum: ["meeting", "workshop", "event", "deadline"] }).notNull(),
  attendees: text("attendees").array(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  // Visibility controls
  visibleToGeneralMembers: boolean("visible_to_general_members").default(false),
  visibleToCommitteeChairs: boolean("visible_to_committee_chairs").default(true),
  visibleToAdmins: boolean("visible_to_admins").default(true),
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const surveyResponses = pgTable("survey_responses", {
  id: serial("id").primaryKey(),
  surveyId: integer("survey_id").references(() => surveys.id),
  userId: integer("user_id").references(() => users.id),
  answers: json("answers").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow(),
});

export const committees = pgTable("committees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const committeeRoles = pgTable("committee_roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  canManageCommittee: boolean("can_manage_committee").default(false),
  canManageWorkshops: boolean("can_manage_workshops").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const committeeMembers = pgTable("committee_members", {
  id: serial("id").primaryKey(),
  committeeId: integer("committee_id").references(() => committees.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  memberId: integer("member_id").references(() => members.id), // Optional link to members table
  roleId: integer("role_id").references(() => committeeRoles.id).notNull(),
  addedById: integer("added_by_id").references(() => users.id),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"), // Null means still active
  createdAt: timestamp("created_at").defaultNow(),
});

export const workshopTypes = pgTable("workshop_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
});

export const membershipPricingRules = pgTable("membership_pricing_rules", {
  id: serial("id").primaryKey(),
  membershipLevel: text("membership_level").notNull().unique(),
  percentagePaid: integer("percentage_paid").notNull(), // Percentage of base cost (0-100)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const workshops = pgTable("workshops", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  startTime: text("start_time"), // Format: "HH:mm" (24-hour)
  endTime: text("end_time"), // Format: "HH:mm" (24-hour)
  capacity: integer("capacity").notNull(),
  // New fields
  committeeId: integer("committee_id").references(() => committees.id),
  locationAddress: text("location_address"),
  locationDetails: text("location_details"),
  materials: text("materials"), // Materials needed for the workshop
  isPaid: boolean("is_paid").default(false),
  baseCost: integer("base_cost"),  // Base cost in cents before membership discounts
  globalDiscountPercentage: integer("global_discount_percentage").default(0), // Additional discount (0-100)
  sponsoredBy: text("sponsored_by"), // Sponsor name/organization
  isOnline: boolean("is_online").default(false),
  meetingLink: text("meeting_link"),
  // Calendar visibility controls
  visibleToGeneralMembers: boolean("visible_to_general_members").default(false),
  visibleToCommitteeChairs: boolean("visible_to_committee_chairs").default(true),
  visibleToAdmins: boolean("visible_to_admins").default(true),
  // Administrative fields
  requiresApproval: boolean("requires_approval").default(false),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workshopRegistrations = pgTable("workshop_registrations", {
  id: serial("id").primaryKey(),
  workshopId: integer("workshop_id").references(() => workshops.id),
  userId: integer("user_id").references(() => users.id),
  registeredAt: timestamp("registered_at").defaultNow(),
  // New fields
  isApproved: boolean("is_approved").default(false),
  approvedById: integer("approved_by_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  paymentStatus: text("payment_status", {
    enum: ["unpaid", "pending", "paid", "refunded", "not_required"]
  }).default("not_required"),
  paymentConfirmedById: integer("payment_confirmed_by_id").references(() => users.id),
  paymentConfirmedAt: timestamp("payment_confirmed_at"),
  notes: text("notes"),
});

export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  memberNumber: text("member_number"),
  category: text("category"),
  lastName: text("last_name"),
  firstName: text("first_name"),
  gender: text("gender"),
  knownAs: text("known_as"),
  province: text("province"),
  affiliation: text("affiliation"),
  occupation: text("occupation"),
  homePhone: text("home_phone"),
  cellPhone: text("cell_phone"),
  email: text("email"),
  website: text("website"),
  webReel: text("web_reel"),
  instagram: text("instagram"),
  ethnicBackground: text("ethnic_background"),
  lgbtqStatus: text("lgbtq_status"),
  bipocStatus: text("bipoc_status"),
  provinceTerritory: text("province_territory"),
  languagesSpoken: text("languages_spoken").array(),
  blackStatus: text("black_status"),
  eastAsianStatus: text("east_asian_status"),
  indigenousStatus: text("indigenous_status"),
  latinoStatus: text("latino_status"),
  southAsianStatus: text("south_asian_status"),
  southeastAsianStatus: text("southeast_asian_status"),
  westAsianArabStatus: text("west_asian_arab_status"),
  whiteStatus: text("white_status"),
  isActive: boolean("is_active").default(true),
  hasPortalAccess: boolean("has_portal_access").default(false),
  importedAt: text("imported_at")
});

export const verificationCodes = pgTable("verification_codes", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  code: varchar("code", { length: 7 }).notNull(),
  verified: boolean("verified").default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Create member insert schema
export const memberSchema = createInsertSchema(members).omit({
  id: true,
  importedAt: true,
});

export const insertUserSchema = createInsertSchema(users)
  .omit({
    id: true,
    createdAt: true,
    gender: true,
    lgbtq2Status: true,
    bipocStatus: true,
    ethnicity: true,
    location: true,
    languages: true,
  })
  .extend({
    firstName: z.string().min(1, "First name is required").optional(),
    lastName: z.string().min(1, "Last name is required").optional(),
    role: z.enum(["user", "admin", "committee_chair", "committee_cochair", "committee_member"]).optional().default("user"),
    memberLevel: z.enum(["Affiliate", "Associate", "Companion", "Full Life", "Full", "Student"]).optional().nullable(),
    canManageCommittees: z.boolean().optional().default(false),
    canManageWorkshops: z.boolean().optional().default(false),
    // Make required fields optional for the insert schema
    username: z.string().optional(),
    password: z.string().optional(),
    email: z.string().email().optional(),
  });

// Create verification code schema
export const verificationCodeSchema = createInsertSchema(verificationCodes).omit({
  id: true,
  verified: true,
  createdAt: true,
});

// Create verification input schema
export const verificationInputSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  code: z.string().length(7, "Verification code must be 7 digits")
});

// Create calendar event schemas
export const calendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCalendarEventVisibilitySchema = z.object({
  id: z.number(),
  visibleToGeneralMembers: z.boolean(),
  visibleToCommitteeChairs: z.boolean(),
  visibleToAdmins: z.boolean(),
});

// Calendar event types
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof calendarEventSchema>;

// Create password reset schema
export const passwordResetSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

// Create contact form schema
export const contactFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  alternateEmail: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  phoneNumber: z.string().min(7, "Please enter a valid phone number").optional().or(z.literal("")),
  emergencyContact: z.string().min(2, "Emergency contact name is required").optional().or(z.literal("")),
  emergencyPhone: z.string().min(7, "Please enter a valid emergency contact phone").optional().or(z.literal(""))
});

// Create schemas for committee, committee roles, committee members and workshop type
export const committeeSchema = createInsertSchema(committees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const committeeRoleSchema = createInsertSchema(committeeRoles).omit({
  id: true,
  createdAt: true,
});

export const committeeMemberSchema = createInsertSchema(committeeMembers).omit({
  id: true,
  createdAt: true,
});

export const workshopTypeSchema = createInsertSchema(workshopTypes).omit({
  id: true,
});

export const membershipPricingRuleSchema = createInsertSchema(membershipPricingRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Create workshop schema with extended validation
export const workshopSchema = createInsertSchema(workshops)
  .omit({
    id: true,
    createdAt: true,
    createdById: true,
  })
  .extend({
    fee: z.number().min(0).optional(),
    meetingLink: z.string().url("Please enter a valid URL").optional(),
  });

// Demographic Change Request System
export const demographicChangeRequests = pgTable("demographic_change_requests", {
  id: serial("id").primaryKey(),
  requesterId: integer("requester_id").references(() => users.id).notNull(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  requestedChanges: json("requested_changes").notNull(), // JSON object with field names and new values
  currentValues: json("current_values").notNull(), // JSON object with current field values for comparison
  status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
  reasonForChange: text("reason_for_change"), // Optional explanation from requester
  reviewNotes: text("review_notes"), // Notes from reviewer
  reviewedById: integer("reviewed_by_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDemographicChangeRequestSchema = createInsertSchema(demographicChangeRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDemographicChangeRequest = z.infer<typeof insertDemographicChangeRequestSchema>;
export type DemographicChangeRequest = typeof demographicChangeRequests.$inferSelect;

// Create workshop registration schema
export const workshopRegistrationSchema = createInsertSchema(workshopRegistrations)
  .omit({
    id: true,
    registeredAt: true,
    approvedById: true,
    approvedAt: true,
    paymentConfirmedById: true,
    paymentConfirmedAt: true,
  });

// Payment system tables
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  workshopRegistrationId: integer("workshop_registration_id").references(() => workshopRegistrations.id).notNull(),
  method: text("method", { 
    enum: ["stripe_card", "interac_transfer", "bank_transfer"] 
  }).notNull(),
  amountCad: integer("amount_cad").notNull(), // Amount in cents
  amountOriginal: integer("amount_original"), // If paid in different currency
  currency: text("currency").default("CAD"),
  exchangeRateId: integer("exchange_rate_id").references(() => exchangeRates.id),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  providerPaymentId: text("provider_payment_id"), // For Interac or other providers
  status: text("status", {
    enum: ["initiated", "requires_action", "pending_settlement", "succeeded", "failed", "refunded", "cancelled"]
  }).default("initiated").notNull(),
  metadata: json("metadata"), // Store additional provider-specific data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  workshopRegistrationId: integer("workshop_registration_id").references(() => workshopRegistrations.id).notNull().unique(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  subtotalCad: integer("subtotal_cad").notNull(), // Amount in cents
  taxCad: integer("tax_cad").notNull(), // Amount in cents
  totalCad: integer("total_cad").notNull(), // Amount in cents
  taxRate: integer("tax_rate").notNull(), // Percentage (e.g., 5 for 5%, 13 for 13%)
  taxType: text("tax_type", {
    enum: ["GST", "HST", "GST_PST", "PST", "None"]
  }).default("GST").notNull(),
  dueDate: timestamp("due_date"),
  issuedAt: timestamp("issued_at").defaultNow(),
  paidAt: timestamp("paid_at"),
  cancelledAt: timestamp("cancelled_at"),
  pdfUrl: text("pdf_url"),
  emailSentAt: timestamp("email_sent_at"),
  status: text("status", {
    enum: ["draft", "sent", "paid", "cancelled"]
  }).default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const exchangeRates = pgTable("exchange_rates", {
  id: serial("id").primaryKey(),
  baseCurrency: text("base_currency").default("CAD").notNull(),
  targetCurrency: text("target_currency").notNull(),
  rate: text("rate").notNull(), // Store as string to preserve precision
  source: text("source", {
    enum: ["bank_of_canada", "manual"]
  }).default("bank_of_canada").notNull(),
  retrievedAt: timestamp("retrieved_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: integer("actor_user_id").references(() => users.id),
  entityType: text("entity_type", {
    enum: ["payment", "invoice", "registration", "workshop", "user", "member"]
  }).notNull(),
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(), // e.g., "created", "updated", "deleted", "paid", "refunded"
  before: json("before"), // State before the change
  after: json("after"), // State after the change
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Create schemas for payment tables
export const paymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const invoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const exchangeRateSchema = createInsertSchema(exchangeRates).omit({
  id: true,
  createdAt: true,
});

export const auditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type MessageGroup = typeof messageGroups.$inferSelect;
export type MessageGroupMember = typeof messageGroupMembers.$inferSelect;
export type Survey = typeof surveys.$inferSelect;
export type SurveyResponse = typeof surveyResponses.$inferSelect;
export type Workshop = typeof workshops.$inferSelect;
export type WorkshopRegistration = typeof workshopRegistrations.$inferSelect;
export type Committee = typeof committees.$inferSelect;
export type WorkshopType = typeof workshopTypes.$inferSelect;
export type Member = typeof members.$inferSelect;
export type VerificationCode = typeof verificationCodes.$inferSelect;
export type InsertVerificationCode = z.infer<typeof verificationCodeSchema>;
export type VerificationInput = z.infer<typeof verificationInputSchema>;
export type PasswordReset = z.infer<typeof passwordResetSchema>;
export type ContactFormValues = z.infer<typeof contactFormSchema>;
export type InsertCommittee = z.infer<typeof committeeSchema>;
export type InsertCommitteeRole = z.infer<typeof committeeRoleSchema>;
export type InsertCommitteeMember = z.infer<typeof committeeMemberSchema>;
export type InsertWorkshopType = z.infer<typeof workshopTypeSchema>;
export type InsertWorkshop = z.infer<typeof workshopSchema>;
export type InsertWorkshopRegistration = z.infer<typeof workshopRegistrationSchema>;
export type CommitteeRole = typeof committeeRoles.$inferSelect;
export type CommitteeMember = typeof committeeMembers.$inferSelect;
export type InsertMember = z.infer<typeof memberSchema>;
export type MembershipPricingRule = typeof membershipPricingRules.$inferSelect;
export type InsertMembershipPricingRule = z.infer<typeof membershipPricingRuleSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof paymentSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof invoiceSchema>;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = z.infer<typeof exchangeRateSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof auditLogSchema>;
