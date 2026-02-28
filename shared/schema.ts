import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  uuid,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean, // ✅ ADD
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table - Required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table - Required for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("Sales Agent"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Leads table
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  phone: varchar("phone").notNull(),
  email: varchar("email"),
  source: varchar("source").notNull(),
  budget: varchar("budget"),
  preferredLocation: varchar("preferred_location"),
  stage: varchar("stage").notNull().default("New"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  nextFollowUp: timestamp("next_follow_up"),
  leadCreationDate: timestamp("lead_creation_date"),
  comments: text("comments"),
  externalId: varchar("external_id"),
  externalData: jsonb("external_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leadsRelations = relations(leads, ({ one, many }) => ({
  assignedAgent: one(users, {
    fields: [leads.assignedTo],
    references: [users.id],
  }),
  activities: many(activities),
}));

// ✅ Updated schema to allow assignedTo and nextFollowUp to be null
export const insertLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(5, "Phone number is required"),
  email: z.string().email().optional().or(z.literal("")),
  source: z.string().min(1, "Source is required"),
  budget: z.string().optional().or(z.literal("")),
  preferredLocation: z.string().optional().or(z.literal("")),
  stage: z.string().default("New"),

  assignedTo: z
    .union([z.string().uuid(), z.string().email(), z.literal("")])
    .nullable()
    .optional(),

  nextFollowUp: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === "") return null;
      if (val instanceof Date) return val;
      if (typeof val === "string") {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      }
      return val;
    },
    z.date().nullable().optional()
  ),

  leadCreationDate: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === "") return null;
      if (val instanceof Date) return val;
      if (typeof val === "string") {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      }
      return val;
    },
    z.date().nullable().optional()
  ),

  comments: z.string().optional().or(z.literal("")),
  externalId: z.string().optional(),
  externalData: z.any().optional(),
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// Property Owners table
export const owners = pgTable("owners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  phone: varchar("phone").notNull(),
  email: varchar("email"),
  agreedForCommission: text("agreed_for_commission"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ownersRelations = relations(owners, ({ many }) => ({
  properties: many(properties),
}));

// Apartments table
export const apartments = pgTable("apartments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertApartmentSchema = z.object({
  name: z.string().min(1, "Apartment Name is required"),
  address: z.string().optional().or(z.literal("")),
});

export type InsertApartment = z.infer<typeof insertApartmentSchema>;
export type Apartment = typeof apartments.$inferSelect;

// Projects table
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // relation to Project Owners (your new module)
  projectOwnerId: varchar("project_owner_id")
    .notNull()
    .references(() => projectOwners.id),

  status: varchar("status").default("Available"), // ✅ ADD THIS

  launchDate: timestamp("launch_date"),
  completionDate: timestamp("completion_date"),

  projectName: varchar("project_name").notNull(),

  reraNo: varchar("rera_no"),
  projectArea: varchar("project_area"),

  possession: varchar("possession"), // "Immediately" | "Specify Time"
  possessionDate: timestamp("possession_date"),

  transactionType: varchar("transaction_type"),

  description: text("description"),
  specification: text("specification"),
  amenities: text("amenities"),

  youtubeVideoUrl: text("youtube_video_url"),
  virtualVideo: text("virtual_video"), // store base64 OR url (same like ownerPhoto you did)

  projectAddress: text("project_address"),


  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projectsRelations = relations(projects, ({ one, many }) => ({
  projectOwner: one(projectOwners, {
    fields: [projects.projectOwnerId],
    references: [projectOwners.id],
  }),

  towers: many(projectTowers),
  unitConfigs: many(projectUnitConfigs),
  images: many(projectImages),
  documents: many(projectDocuments),
}));


export const insertProjectSchema = z.object({
  projectOwnerId: z.string().min(1, "Project Owner is required"),

  status: z.string().optional().or(z.literal("")), // ✅ ADD

  launchDate: z.preprocess(
    (val) => (val === null || val === undefined || val === "" ? null : new Date(val as any)),
    z.date().nullable().optional()
  ),

  completionDate: z.preprocess(
    (val) => (val === null || val === undefined || val === "" ? null : new Date(val as any)),
    z.date().nullable().optional()
  ),

  projectName: z.string().min(1, "Project Name is required"),

  reraNo: z.string().optional().or(z.literal("")),
  projectArea: z.string().optional().or(z.literal("")),

  possession: z.string().optional().or(z.literal("")),
  possessionDate: z.preprocess(
    (val) => (val === null || val === undefined || val === "" ? null : new Date(val as any)),
    z.date().nullable().optional()
  ),

  transactionType: z.string().optional().or(z.literal("")),

  description: z.string().optional().or(z.literal("")),
  specification: z.string().optional().or(z.literal("")),
  amenities: z.string().optional().or(z.literal("")),

  youtubeVideoUrl: z.string().optional().or(z.literal("")),
  virtualVideo: z.string().optional().or(z.literal("")),

  projectAddress: z.string().optional().or(z.literal("")),


});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type ProjectWithOwner = Project & {
  projectOwnerName: string | null;
  projectOwnerMobileNumber: string | null;
};


// ------------------------------------------------------------------
// ✅ Project Actions Tables
// 1) project_towers
// 2) project_unit_configs
// 3) project_images
// 4) project_documents
// ------------------------------------------------------------------

// 2) Add new table: project_towers
export const projectTowers = pgTable(
  "project_towers",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    projectId: varchar("project_id")
      .notNull()
      .references(() => projects.id),

    name: varchar("name").notNull(),
    completionDate: timestamp("completion_date"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_project_towers_project_id").on(table.projectId),
  ]
);

export const insertProjectTowerSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  name: z.string().min(1, "Tower/Block/Wing Name is required"),
  completionDate: z.preprocess(
    (val) => (val === null || val === undefined || val === "" ? null : new Date(val as any)),
    z.date().nullable().optional()
  ),
});

export type InsertProjectTower = z.infer<typeof insertProjectTowerSchema>;
export type ProjectTower = typeof projectTowers.$inferSelect;


// 3) Add new table: project_unit_configs
export const projectUnitConfigs = pgTable(
  "project_unit_configs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    projectId: varchar("project_id")
      .notNull()
      .references(() => projects.id),

    towerId: varchar("tower_id")
      .notNull()
      .references(() => projectTowers.id),

    propertyType: varchar("property_type"),
    bedroom: varchar("bedroom"),

    sellPrice: text("sell_price"),
    area: text("area"),
    builtUpArea: text("built_up_area"),
    carpetArea: text("carpet_area"),
    otherArea: text("other_area"),

    totalUnit: integer("total_unit").notNull(), // ✅ required

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_project_unit_configs_project_id").on(table.projectId),
    index("idx_project_unit_configs_tower_id").on(table.towerId),
  ]
);

export const projectTowersRelations = relations(projectTowers, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectTowers.projectId],
    references: [projects.id],
  }),
  unitConfigs: many(projectUnitConfigs),
}));

export const projectUnitConfigsRelations = relations(projectUnitConfigs, ({ one }) => ({
  project: one(projects, {
    fields: [projectUnitConfigs.projectId],
    references: [projects.id],
  }),
  tower: one(projectTowers, {
    fields: [projectUnitConfigs.towerId],
    references: [projectTowers.id],
  }),
}));


export const insertProjectUnitConfigSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  towerId: z.string().min(1, "Tower is required"),

  propertyType: z.string().optional().nullable().or(z.literal("")),
  bedroom: z.string().optional().nullable().or(z.literal("")),
  sellPrice: z.string().optional().nullable().or(z.literal("")),
  area: z.string().optional().nullable().or(z.literal("")),
  builtUpArea: z.string().optional().nullable().or(z.literal("")),
  carpetArea: z.string().optional().nullable().or(z.literal("")),
  otherArea: z.string().optional().nullable().or(z.literal("")),

  totalUnit: z.coerce.number().int().min(1, "Total Unit is required"),
});

export type InsertProjectUnitConfig = z.infer<typeof insertProjectUnitConfigSchema>;
export type ProjectUnitConfig = typeof projectUnitConfigs.$inferSelect;


// 4) Add new table: project_images
export const projectImages = pgTable(
  "project_images",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    projectId: varchar("project_id")
      .notNull()
      .references(() => projects.id),

    imageUrl: text("image_url"), // can store base64 OR url
    isDefault: boolean("is_default").notNull().default(false),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_project_images_project_id").on(table.projectId),
  ]
);

export const insertProjectImageSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  imageUrl: z.string().optional().or(z.literal("")),
  isDefault: z.boolean().optional(),
});

export type InsertProjectImage = z.infer<typeof insertProjectImageSchema>;
export type ProjectImage = typeof projectImages.$inferSelect;


// 5) Add new table: project_documents
export const projectDocuments = pgTable(
  "project_documents",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    projectId: varchar("project_id")
      .notNull()
      .references(() => projects.id),

    name: varchar("name").notNull(),
    fileUrl: text("file_url"), // can store base64 OR url
    fileType: varchar("file_type"), // pdf/doc/ppt/xlsx etc
    fileName: text("file_name"),     // ✅ ADD
    mimeType: text("mime_type"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_project_documents_project_id").on(table.projectId),
  ]
);

export const insertProjectDocumentSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  name: z.string().min(1, "Document name is required"),
  fileUrl: z.string().optional().or(z.literal("")),
  fileType: z.string().optional().or(z.literal("")),
  // ✅ ADD THESE
  fileName: z.string().optional().or(z.literal("")),
  mimeType: z.string().optional().or(z.literal("")),
});

export type InsertProjectDocument = z.infer<typeof insertProjectDocumentSchema>;
export type ProjectDocument = typeof projectDocuments.$inferSelect;


export const insertOwnerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(5, "Phone is required"),
  email: z.string().email().optional().or(z.literal("")),
  agreedForCommission: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
});

export type InsertOwner = z.infer<typeof insertOwnerSchema>;
export type Owner = typeof owners.$inferSelect;


// Project Owners table
export const projectOwners = pgTable("project_owners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  name: varchar("name").notNull(),
  mobileNumber: varchar("mobile_number").notNull(),

  otherNumber: varchar("other_number"),
  email: varchar("email"),
  uniqueNumber: varchar("unique_number"),
  address: text("address"),
  companyName: varchar("company_name"),
  dateOfBirth: timestamp("date_of_birth"),
  websiteUrl: varchar("website_url"),

  // Store image as DataURL (same pattern as property images array usage)
  ownerPhoto: text("owner_photo"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProjectOwnerSchema = z.object({
  name: z.string().min(1, "Project Owner Name is required"),

  // exactly 10 digits
  mobileNumber: z
    .string()
    .regex(/^\d{10}$/, "Mobile Number must be exactly 10 digits"),

  otherNumber: z.string().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  uniqueNumber: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  companyName: z.string().optional().or(z.literal("")),

  // allow empty -> null/undefined from frontend
  dateOfBirth: z.union([z.coerce.date(), z.null(), z.undefined()]).optional().nullable(),

  websiteUrl: z.string().optional().or(z.literal("")),
  ownerPhoto: z.string().optional().or(z.literal("")),
});

export type InsertProjectOwner = z.infer<typeof insertProjectOwnerSchema>;
export type ProjectOwner = typeof projectOwners.$inferSelect;

export const projectOwnersRelations = relations(projectOwners, ({ many }) => ({
  projects: many(projects),
}));




export type InsertRentAgreement = z.infer<typeof insertRentAgreementSchema>;
export type RentAgreement = typeof rentAgreements.$inferSelect;

export const sellAgreements = pgTable("sell_agreements", {
  id: uuid("id").defaultRandom().primaryKey(),

  clientId: uuid("client_id").notNull(),
  ownerId: uuid("owner_id").notNull(),
  propertyId: uuid("property_id").notNull(),

  propertyRegistrationDate: timestamp("property_registration_date", {
    mode: "date",
  }).notNull(),

  sellAgreementDate: timestamp("sell_agreement_date", {
    mode: "date",
  }).notNull(),

  finalDealPrice: text("final_deal_price"),
  totalBrokerage: text("total_brokerage"),
  partlyPaidBrokerage: text("partly_paid_brokerage"),
  remainingBrokerage: text("remaining_brokerage"),

  ownerBrokerage: text("owner_brokerage"),
  clientBrokerage: text("client_brokerage"),

  agreementStatus: varchar("agreement_status", { length: 50 }).notNull(),

  description: text("description"),
  sellDocumentId: text("sellDocumentId"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSellAgreementSchema = z.object({
  clientId: z.string().uuid(),
  ownerId: z.string().uuid(),
  propertyId: z.string().uuid(),

  propertyRegistrationDate: z.coerce.date(),
  sellAgreementDate: z.coerce.date(),

  finalDealPrice: z.string().optional(),
  totalBrokerage: z.string().optional(),
  partlyPaidBrokerage: z.string().optional(),
  remainingBrokerage: z.string().optional(),

  ownerBrokerage: z.string().optional(),
  clientBrokerage: z.string().optional(),

  agreementStatus: z.enum(["Deal Cancel", "Deal Done"]),

  description: z.string().optional(),
  sellDocumentId: z.string().optional(),
});

export type InsertSellAgreement = z.infer<typeof insertSellAgreementSchema>;
export type SellAgreement = typeof sellAgreements.$inferSelect;

// Properties table
export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title"),
  location: varchar("location"),
  googleMapLink: text("google_map_link"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  price: text("price"),
  area: text("area"),
  builtUpArea: text("built_up_area"),

  floor: text("floor"),
  constructionYear: text("construction_year"),
  type: varchar("type"),
  transactionType: varchar("transaction_type"),
  status: varchar("status").notNull().default("Available"),
  furnishingStatus: text("furnishing_status"),
  ownerId: varchar("owner_id").references(() => owners.id),
  apartmentId: varchar("apartment_id").references(() => apartments.id),
  images: text("images").array().default(sql`ARRAY[]::text[]`),
  description: text("description"),
  officeMessage: text("office_message"),
  ownerMessage: text("owner_message"),
  agreementStartDate: timestamp("agreement_start_date"),
  agreementEndDate: timestamp("agreement_end_date"),
  lift: text("lift"),
  parking: text("parking"),
  locationPriority: text("location_priority"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  carpetArea: text("carpet_area"),
  totalFloor: text("total_floor"),
  propertyFacing: text("property_facing"),
  bedrooms: text("bedrooms"),
  bathrooms: text("bathrooms"),
  balconies: text("balconies"),
  halls: text("halls"),
  searchText: text("search_text"),
  codeNo: text("code_no"),
  caste: text("caste"),
});

export const liftValues = ["Available", "Not Available"] as const;
export const parkingValues = [
  "2 Wheeler",
  "4 Wheeler",
  "Common Parking",
  "Not Available",
] as const;

export const furnishingStatusValues = [
  "Furnished",
  "Semi-furnished",
  "Unfurnished",
] as const;

export const locationPriorityValues = [
  "Prime Location",
  "Secondary Location",
  "Normal Location",
] as const;

export const propertyFacingValues = [
  "East",
  "West",
  "South",
  "North",
  "North-East",
  "North-West",
  "South-East",
  "South-West",
] as const;

export const propertiesRelations = relations(properties, ({ one }) => ({
  owner: one(owners, {
    fields: [properties.ownerId],
    references: [owners.id],
  }),
}));

export const insertPropertySchema = createInsertSchema(properties)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    price: z.string().optional(),
    area: z.union([z.string(), z.number()]).optional(),
    builtUpArea: z.union([z.string(), z.number()]).optional().nullable(),
    floor: z.string().optional().nullable(),
    constructionYear: z.string().optional().nullable(),
    furnishingStatus: z.enum(furnishingStatusValues).optional().nullable(),
    agreementStartDate: z
      .union([z.coerce.date(), z.null(), z.undefined()])
      .optional()
      .nullable(),
    agreementEndDate: z
      .union([z.coerce.date(), z.null(), z.undefined()])
      .optional()
      .nullable(),
    lift: z.enum(liftValues).optional().nullable(),
    parking: z.enum(parkingValues).optional().nullable(),
    locationPriority: z.enum(locationPriorityValues).optional().nullable(),
    carpetArea: z.string().optional().nullable(),
    totalFloor: z.string().optional().nullable(),
    propertyFacing: z.enum(propertyFacingValues).optional().nullable(),
    bedrooms: z.string().optional().nullable(),
    bathrooms: z.string().optional().nullable(),
    balconies: z.string().optional().nullable(),
    halls: z.string().optional().nullable(),
    codeNo: z.string().trim().optional().nullable(),
    apartmentId: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v === "" ? null : v)),
    caste: z.enum(["All Caste", "Restricted"]).optional().nullable(),
  });

export type LocationPriority = (typeof locationPriorityValues)[number];

export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

export type PropertyWithOwner = Property & {
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
};

// Clients/Buyers table
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  phone: varchar("phone").notNull(),
  email: varchar("email"),
  linkedLeadId: varchar("linked_lead_id").references(() => leads.id),
  linkedPropertyId: varchar("linked_property_id").references(() => properties.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clientsRelations = relations(clients, ({ one }) => ({
  linkedLead: one(leads, {
    fields: [clients.linkedLeadId],
    references: [leads.id],
  }),
  linkedProperty: one(properties, {
    fields: [clients.linkedPropertyId],
    references: [properties.id],
  }),
}));


// Rent Agreements table
export const rentAgreements = pgTable("rent_agreements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  clientId: varchar("client_id").notNull().references(() => clients.id),
  ownerId: varchar("owner_id").notNull().references(() => owners.id),
  propertyId: varchar("property_id").notNull().references(() => properties.id),

  inTheNameOf: varchar("in_the_name_of"),

  agreementStartDate: timestamp("agreement_start_date").notNull(),
  agreementEndDate: timestamp("agreement_end_date").notNull(),

  crNumber: varchar("cr_number"),
  licencePeriodMonths: integer("licence_period_months"),

  rentPerMonth: decimal("rent_per_month", { precision: 12, scale: 2 }),
  securityDeposit: decimal("security_deposit", { precision: 12, scale: 2 }),
  registrationCost: decimal("registration_cost", { precision: 12, scale: 2 }),
  totalBrokerage: decimal("total_brokerage", { precision: 12, scale: 2 }),
  partlyPaid: decimal("partly_paid", { precision: 12, scale: 2 }),
  remainingBrokerage: decimal("remaining_brokerage", { precision: 12, scale: 2 }),
  documentationCharges: decimal("documentation_charges", { precision: 12, scale: 2 }),
  stampDuty: decimal("stamp_duty", { precision: 12, scale: 2 }),
  otherExpenses: decimal("other_expenses", { precision: 12, scale: 2 }),
  agreementStatus: varchar("agreement_status"),
  description: text("description"),
  rentDocumentId: text("rent_document_id"),
  furnitureAndFixtures: text("furniture_and_fixtures"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRentAgreementSchema = createInsertSchema(rentAgreements)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    agreementStartDate: z.coerce.date(),
    agreementEndDate: z.coerce.date(),

    // optional but recommended coercions:
    licencePeriodMonths: z.coerce.number().int().optional(),

    // ✅ NEW: Agreement Status validation (optional, but controlled values)
    agreementStatus: z
      .enum(["Agreement Cancel", "Agreement Renewed"])
      .optional()
      .nullable(),

    // ✅ NEW: Description
    description: z.string().optional().nullable(),

    // if you want these as numbers in DB, use coerce (only if schema expects numeric)
    // rentPerMonth: z.coerce.number().optional(),
    // securityDeposit: z.coerce.number().optional(),
  });


export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Activities/Timeline table
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id),
  type: varchar("type").notNull(),
  description: text("description").notNull(),
  performedBy: varchar("performed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activitiesRelations = relations(activities, ({ one }) => ({
  lead: one(leads, {
    fields: [activities.leadId],
    references: [leads.id],
  }),
  user: one(users, {
    fields: [activities.performedBy],
    references: [users.id],
  }),
}));

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

// ✅ Activity Logs table (ONLY ONCE)
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  userId: varchar("user_id").references(() => users.id),
  userRole: varchar("user_role"),
  // ✅ store user info from your user.json login
  userEmail: varchar("user_email"),
  userName: varchar("user_name"),

  // ✅ human readable line
  message: text("message"),
  action: varchar("action").notNull(),
  method: varchar("method").notNull(),
  path: text("path").notNull(),

  entityType: varchar("entity_type"),
  entityId: varchar("entity_id"),

  ip: varchar("ip"),
  userAgent: text("user_agent"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// Contact form submissions
export const contactSubmissions = pgTable("contact_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  email: varchar("email").notNull(),
  phone: varchar("phone").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContactSubmissionSchema =
  createInsertSchema(contactSubmissions).omit({
    id: true,
    createdAt: true,
  });

export type InsertContactSubmission = z.infer<typeof insertContactSubmissionSchema>;
export type ContactSubmission = typeof contactSubmissions.$inferSelect;

// Document Attachments table
export const documentAttachments = pgTable("document_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: varchar("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  fileName: varchar("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type").notNull(),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  previewUrl: text("preview_url"),
  previewMimeType: text("preview_mime_type"),
});

export const documentAttachmentsRelations = relations(
  documentAttachments,
  ({ one }) => ({
    uploader: one(users, {
      fields: [documentAttachments.uploadedBy],
      references: [users.id],
    }),
  })
);

export const insertDocumentAttachmentSchema = createInsertSchema(
  documentAttachments
).omit({
  id: true,
  createdAt: true,
});

export type InsertDocumentAttachment = z.infer<typeof insertDocumentAttachmentSchema>;
export type DocumentAttachment = typeof documentAttachments.$inferSelect;
