import {
  users,
  leads,
  properties,
  owners,
  clients,
  activities,
  activityLogs,
  contactSubmissions,
  documentAttachments,
  projectOwners,
  projects, // ✅ ADD THIS
  rentAgreements,
  sellAgreements,
  projectTowers,
  projectUnitConfigs,
  projectImages,
  projectDocuments,
  apartments,
  type Apartment,
  type InsertApartment,
  insertApartmentSchema,
  type User,
  type UpsertUser,
  type Lead,
  type InsertLead,
  type Property,
  type InsertProperty,
  type PropertyWithOwner,
  type Owner,
  type InsertOwner,
  type Client,
  type InsertClient,
  type Activity,
  type InsertActivity,
  type ContactSubmission,
  type RentAgreement,
  type InsertRentAgreement,
  type SellAgreement,
  type InsertSellAgreement,
  type InsertContactSubmission,
  type DocumentAttachment,
  type InsertDocumentAttachment,
  type ProjectOwner,
  type Project,
  type InsertProject,
  type ProjectWithOwner,
  type InsertProjectOwner,
  type InsertActivityLog,
  type ActivityLog,
  type ProjectTower,
  type InsertProjectTower,
  type ProjectUnitConfig,
  type InsertProjectUnitConfig,
  type ProjectImage,
  type InsertProjectImage,
  type ProjectDocument,
  type InsertProjectDocument,
  insertLeadSchema,
} from "@shared/schema";
import { db } from "./db";
import { eq, asc, desc, and, ne, or, isNull, gte, lte, count, sql, inArray, like, isNotNull } from "drizzle-orm";


// ---------------------------------------------
// Helper: Parse follow-up date from Excel/text
// ---------------------------------------------
function parseNextFollowUpServer(raw: any): Date | undefined {
  if (!raw) return undefined;

  // Already a JS Date
  if (raw instanceof Date) return raw;

  // Excel serial number (number)
  if (typeof raw === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // 1899-12-30
    const msPerDay = 24 * 60 * 60 * 1000;
    const d = new Date(excelEpoch.getTime() + raw * msPerDay);
    return isNaN(d.getTime()) ? undefined : d;
  }

  const str = String(raw).trim();
  if (!str) return undefined;

  // Try direct Date parsing (ISO strings, etc.)
  const direct = new Date(str);
  if (!isNaN(direct.getTime())) return direct;

  // Excel serial number (string)
  if (/^\d+(\.\d+)?$/.test(str)) {
    const serial = Number(str);
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const msPerDay = 24 * 60 * 60 * 1000;
    const d = new Date(excelEpoch.getTime() + serial * msPerDay);
    return isNaN(d.getTime()) ? undefined : d;
  }

  // Fallback: DD-MM-YYYY[ HH:MM]
  const cleaned = str.replace(/\//g, "-");
  const [datePart, timePart] = cleaned.split(/\s+/);
  const parts = datePart.split("-");
  if (parts.length !== 3) return undefined;

  const [ddStr, mmStr, yyyyStr] = parts;
  const dd = Number(ddStr);
  const mm = Number(mmStr);
  const yyyy = Number(yyyyStr);
  if (!dd || !mm || !yyyy) return undefined;

  let hours = 0;
  let minutes = 0;
  if (timePart) {
    const [hhStr, minStr] = timePart.split(":");
    hours = Number(hhStr) || 0;
    minutes = Number(minStr) || 0;
  }

  const d = new Date(yyyy, mm - 1, dd, hours, minutes);
  return isNaN(d.getTime()) ? undefined : d;
}

// ✅ NEW type for paginated response with total
export type PropertiesWithTotal = {
  items: PropertyWithOwner[];
  total: number;
};

export interface IStorage {
  // Activity operations
  getActivities(leadId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  getActivity(id: string): Promise<Activity | null>;
  updateActivity(id: string, activity: Partial<InsertActivity>): Promise<Activity>;
  deleteActivity(id: string): Promise<void>;
  getRecentActivities(limit: number): Promise<Activity[]>;
  getPhoneCallActivities(): Promise<Activity[]>; // NEW
  getRentAgreementsEndingSoon(days: number): Promise<any[]>;
  getSellAgreementsWithPendingBrokerage(limit?: number): Promise<any[]>;

  // Apartment operations
  getApartments(): Promise<Apartment[]>;
  getApartment(id: string): Promise<Apartment | undefined>;
  createApartment(apartment: InsertApartment): Promise<Apartment>;
  updateApartment(id: string, apartment: Partial<InsertApartment>): Promise<Apartment>;
  deleteApartment(id: string): Promise<void>;

  // ✅ Activity Logs (new)
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogsByDate(dateISO: string): Promise<ActivityLog[]>;

  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUsersByRole(role: string): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(id: string, role: string): Promise<User>;
  createManualUser(email: string, role: string): Promise<User>;
  deactivateUser(id: string): Promise<User>;
  reactivateUser(id: string): Promise<User>;

  updateProjectStatus(projectId: string, status: string | null): Promise<Project>;

  getProjectTowers(projectId: string): Promise<ProjectTower[]>;
  createProjectTower(data: InsertProjectTower): Promise<ProjectTower>;
  updateProjectTower(id: string, data: Partial<InsertProjectTower>): Promise<ProjectTower>;
  deleteProjectTower(id: string): Promise<void>;

  getProjectUnitConfigs(projectId: string): Promise<ProjectUnitConfig[]>;
  createProjectUnitConfig(data: InsertProjectUnitConfig): Promise<ProjectUnitConfig>;
  updateProjectUnitConfig(id: string, data: Partial<InsertProjectUnitConfig>): Promise<ProjectUnitConfig>;
  deleteProjectUnitConfig(id: string): Promise<void>;

  getProjectImages(projectId: string): Promise<ProjectImage[]>;
  addProjectImage(data: InsertProjectImage): Promise<ProjectImage>;
  deleteProjectImage(id: string): Promise<void>;
  setDefaultProjectImage(projectId: string, imageId: string): Promise<void>;
  getProjectImage(imageId: string): Promise<ProjectImage | undefined>;

  getProjectDocuments(projectId: string): Promise<ProjectDocument[]>;
  createProjectDocument(data: InsertProjectDocument): Promise<ProjectDocument>;
  updateProjectDocument(id: string, data: Partial<InsertProjectDocument>): Promise<ProjectDocument>;
  deleteProjectDocument(id: string): Promise<void>;
  getProjectDocument(id: string): Promise<ProjectDocument | undefined>;

  // Lead operations
  getLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  findLeadByPhone(phone: string): Promise<Lead | undefined>; // 🔹 NEW
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, lead: Partial<InsertLead>): Promise<Lead>;
  deleteLead(id: string): Promise<void>;

  // Rent Agreement operations
  getRentAgreements(filters?: {
    clientId?: string;
    ownerId?: string;
    startDate?: string; // YYYY-MM-DD
    endDate?: string;   // YYYY-MM-DD
  }): Promise<RentAgreement[]>;
  createRentAgreement(data: InsertRentAgreement): Promise<RentAgreement>;
  updateRentAgreement(id: string, data: Partial<InsertRentAgreement>): Promise<RentAgreement>;
  deleteRentAgreement(id: string): Promise<void>;

  // Sell Agreement operations
  getSellAgreements(): Promise<SellAgreement[]>;
  createSellAgreement(data: InsertSellAgreement): Promise<SellAgreement>;
  updateSellAgreement(id: string, data: Partial<InsertSellAgreement>): Promise<SellAgreement>;
  deleteSellAgreement(id: string): Promise<void>;

  // Property operations
  getProperties(params?: {
    limit?: number;
    offset?: number;
    search?: string;
    transactionType?: string;
    status?: string;
    caste?: string; // ✅ ADD
  }): Promise<PropertyWithOwner[]>;

  // ✅ NEW: return items + total
  getPropertiesWithTotal(params?: {
    limit?: number;
    offset?: number;
    search?: string;
    transactionType?: string;
    status?: string;
    caste?: string; // ✅ ADD
    apartmentId?: string;
  }): Promise<PropertiesWithTotal>;

  getPropertyImagesByIds(ids: string[]): Promise<{ id: string; images: string[] | null }[]>;
  getProperty(id: string): Promise<PropertyWithOwner | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property>;
  deleteProperty(id: string): Promise<void>;
  getExpiringRentalAgreements(daysAhead: number): Promise<PropertyWithOwner[]>;

  // Owner operations
  getOwners(): Promise<Owner[]>;
  getOwner(id: string): Promise<Owner | undefined>;
  createOwner(owner: InsertOwner): Promise<Owner>;
  updateOwner(id: string, owner: Partial<InsertOwner>): Promise<Owner>;
  deleteOwner(id: string): Promise<void>;

  // Project Owner operations
  getProjectOwners(): Promise<ProjectOwner[]>;
  getProjectOwner(id: string): Promise<ProjectOwner | undefined>;
  createProjectOwner(data: InsertProjectOwner): Promise<ProjectOwner>;
  updateProjectOwner(id: string, data: Partial<InsertProjectOwner>): Promise<ProjectOwner>;
  deleteProjectOwner(id: string): Promise<void>;

  // Projects operations
  getProjects(): Promise<ProjectWithOwner[]>;
  getProject(id: string): Promise<ProjectWithOwner | undefined>;
  createProject(data: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  // Client operations
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client>;
  deleteClient(id: string): Promise<void>;

  // Contact submission operations
  getContactSubmissions(): Promise<ContactSubmission[]>;
  createContactSubmission(submission: InsertContactSubmission): Promise<ContactSubmission>;

  // Dashboard stats
  getDashboardStats(): Promise<any>;
  getSalesData(): Promise<any[]>;
  getLeadSourceData(): Promise<any[]>;
  getTopAgents(): Promise<any[]>;
  getDailyExecutiveActivities(): Promise<any[]>;

  // Bulk import operations
  bulkImportLeads(leadsData: InsertLead[]): Promise<{ inserted: number; updated: number; errors: any[] }>;
  bulkImportProperties(propertiesData: InsertProperty[]): Promise<{ inserted: number; updated: number; errors: any[] }>;
  bulkImportOwners(ownersData: InsertOwner[]): Promise<{ inserted: number; updated: number; errors: any[] }>;
  bulkImportClients(clientsData: InsertClient[]): Promise<{ inserted: number; updated: number; errors: any[] }>;

  // Helper methods for import
  getOwnerByEmail(email: string): Promise<Owner | undefined>;
  getLeadByEmail(email: string): Promise<Lead | undefined>;
  getPropertyByTitleAndLocation(title: string, location: string): Promise<Property | undefined>;

  // Document attachment operations
  getDocuments(entityType?: string, entityId?: string): Promise<DocumentAttachment[]>;
  getDocument(id: string): Promise<DocumentAttachment | undefined>;
  createDocument(document: InsertDocumentAttachment): Promise<DocumentAttachment>;
  updateDocument(id: string, document: Partial<InsertDocumentAttachment>): Promise<DocumentAttachment>;
  deleteDocument(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getPropertyImagesByIds(ids: string[]): Promise<{ id: string; images: string[] | null }[]> {
    if (!ids || ids.length === 0) return [];

    return await db
      .select({
        id: properties.id,
        images: properties.images,
      })
      .from(properties)
      .where(inArray(properties.id, ids));
  }

  async setDefaultProjectImage(projectId: string, imageId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(projectImages)
        .set({ isDefault: false })
        .where(eq(projectImages.projectId, projectId));

      await tx
        .update(projectImages)
        .set({ isDefault: true })
        .where(eq(projectImages.id, imageId));
    });
  }

  async getProjectImage(imageId: string): Promise<ProjectImage | undefined> {
    const rows = await db
      .select()
      .from(projectImages)
      .where(eq(projectImages.id, imageId))
      .limit(1);

    return rows[0];
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getPhoneCallActivities(): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(eq(activities.type, "call"))
      .orderBy(desc(activities.createdAt));
  }


  async getRentAgreementsEndingSoon(days: number): Promise<any[]> {
    // Date-only filter: avoids timezone/time-of-day issues
    // Includes agreements where end_date is between today and today + days (inclusive)
    // ❌ Excludes agreements with status = 'Agreement Cancel'

    const rows = await db
      .select({
        id: rentAgreements.id,
        agreementStartDate: rentAgreements.agreementStartDate,
        agreementEndDate: rentAgreements.agreementEndDate,

        // ✅ include status
        agreementStatus: rentAgreements.agreementStatus,

        clientName: clients.name,
        clientPhone: clients.phone,

        ownerName: owners.name,
        ownerPhone: owners.phone,

        propertyId: properties.id,
        propertyTitle: properties.title,
        propertyCode: properties.codeNo,
        propertyLocation: properties.location,
      })
      .from(rentAgreements)
      .innerJoin(clients, eq(rentAgreements.clientId, clients.id))
      .innerJoin(owners, eq(rentAgreements.ownerId, owners.id))
      .innerJoin(properties, eq(rentAgreements.propertyId, properties.id))
      .where(
        and(
          // ✅ END DATE BETWEEN today AND today + days
          sql`${rentAgreements.agreementEndDate}::date >= CURRENT_DATE
             AND ${rentAgreements.agreementEndDate}::date <= (CURRENT_DATE + (${days} * INTERVAL '1 day'))`,

          // ✅ EXCLUDE CANCELLED AGREEMENTS
          or(
            isNull(rentAgreements.agreementStatus),
            ne(rentAgreements.agreementStatus, "Agreement Cancel")
          )
        )
      )
      .orderBy(asc(rentAgreements.agreementEndDate));

    return rows;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [existingUser] = await db.select().from(users).where(eq(users.email, userData.email!));

    if (existingUser) {
      if (existingUser.id !== userData.id) {
        return await db.transaction(async (tx) => {
          const leadsToMigrate = await tx.select().from(leads).where(eq(leads.assignedTo, existingUser.id));
          const activitiesToMigrate = await tx.select().from(activities).where(eq(activities.performedBy, existingUser.id));
          const documentsToMigrate = await tx
            .select()
            .from(documentAttachments)
            .where(eq(documentAttachments.uploadedBy, existingUser.id));

          const leadIds = leadsToMigrate.map((l) => l.id);
          const activityIds = activitiesToMigrate.map((a) => a.id);
          const documentIds = documentsToMigrate.map((d) => d.id);

          if (leadIds.length > 0) {
            await tx.update(leads).set({ assignedTo: null }).where(inArray(leads.id, leadIds));
          }

          if (activityIds.length > 0) {
            await tx.update(activities).set({ performedBy: null }).where(inArray(activities.id, activityIds));
          }

          if (documentIds.length > 0) {
            await tx
              .update(documentAttachments)
              .set({ uploadedBy: null })
              .where(inArray(documentAttachments.id, documentIds));
          }

          const [updatedUser] = await tx
            .update(users)
            .set({
              id: userData.id,
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
              updatedAt: new Date(),
            })
            .where(eq(users.email, userData.email!))
            .returning();

          if (leadIds.length > 0) {
            await tx.update(leads).set({ assignedTo: userData.id }).where(inArray(leads.id, leadIds));
          }

          if (activityIds.length > 0) {
            await tx.update(activities).set({ performedBy: userData.id }).where(inArray(activities.id, activityIds));
          }

          // NOTE: you previously set uploadedBy back to null here.
          // That might be intentional. If you want to restore, change to userData.id.
          if (documentIds.length > 0) {
            await tx
              .update(documentAttachments)
              .set({ uploadedBy: null })
              .where(inArray(documentAttachments.id, documentIds));
          }

          return updatedUser;
        });
      }

      const [updatedUser] = await db
        .update(users)
        .set({
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.email, userData.email!))
        .returning();
      return updatedUser;
    }

    const userCount = await db.select({ count: sql`count(*)::int` }).from(users);
    const isFirstUser = userCount[0]?.count === 0;

    const adminPattern = process.env.ADMIN_EMAIL_PATTERN || "admin";
    const isTrustedEmail = userData.email?.toLowerCase().includes(adminPattern.toLowerCase());
    const shouldBeAdmin = isFirstUser && isTrustedEmail;

    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        role: shouldBeAdmin ? "Admin" : userData.role || "Sales Agent",
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(and(eq(users.role, role), eq(users.isActive, 1)));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserRole(id: string, role: string): Promise<User> {
    const [updatedUser] = await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return updatedUser;
  }

  async getRentAgreements(filters?: {
    clientId?: string;
    ownerId?: string;
    startDate?: string; // YYYY-MM-DD
    endDate?: string;   // YYYY-MM-DD
  }): Promise<RentAgreement[]> {
    const conditions: any[] = [];

    if (filters?.clientId) {
      conditions.push(eq(rentAgreements.clientId, filters.clientId));
    }

    if (filters?.ownerId) {
      conditions.push(eq(rentAgreements.ownerId, filters.ownerId));
    }

    // ✅ Date range filter
    // We filter by agreementStartDate between startDate..endDate (inclusive)
    // If only one date is provided, it becomes >= start OR <= end
    if (filters?.startDate) {
      const start = new Date(`${filters.startDate}T00:00:00.000Z`);
      conditions.push(gte(rentAgreements.agreementStartDate, start));
    }

    if (filters?.endDate) {
      const end = new Date(`${filters.endDate}T23:59:59.999Z`);
      conditions.push(lte(rentAgreements.agreementStartDate, end));
    }

    const query = conditions.length > 0
      ? db.select().from(rentAgreements).where(and(...conditions))
      : db.select().from(rentAgreements);

    return await query.orderBy(desc(rentAgreements.createdAt));
  }

  async createRentAgreement(data: InsertRentAgreement): Promise<RentAgreement> {
    const [row] = await db.insert(rentAgreements).values(data).returning();
    return row;
  }

  async updateRentAgreement(id: string, data: Partial<InsertRentAgreement>): Promise<RentAgreement> {
    const [row] = await db
      .update(rentAgreements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rentAgreements.id, id))
      .returning();
    return row;
  }

  async deleteRentAgreement(id: string): Promise<void> {
    await db.delete(rentAgreements).where(eq(rentAgreements.id, id));
  }

  async getSellAgreements(): Promise<SellAgreement[]> {
    return await db.select().from(sellAgreements).orderBy(desc(sellAgreements.createdAt));
  }

  async createSellAgreement(data: InsertSellAgreement): Promise<SellAgreement> {
    const [row] = await db.insert(sellAgreements).values(data).returning();
    return row;
  }

  async updateSellAgreement(id: string, data: Partial<InsertSellAgreement>): Promise<SellAgreement> {
    const [row] = await db
      .update(sellAgreements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sellAgreements.id, id))
      .returning();
    return row;
  }

  async deleteSellAgreement(id: string): Promise<void> {
    await db.delete(sellAgreements).where(eq(sellAgreements.id, id));
  }

  // Add in DatabaseStorage class
  async getPendingSellBrokerageAgreements(limit = 10) {
    const rows = await db
      .select({
        id: sellAgreements.id,

        clientName: clients.name,
        clientPhone: clients.phone,

        ownerName: owners.name,
        ownerPhone: owners.phone,

        propertyTitle: properties.title,
        propertyLocation: properties.location,

        propertyRegistrationDate: sellAgreements.propertyRegistrationDate,
        sellAgreementDate: sellAgreements.sellAgreementDate,

        finalDealPrice: sellAgreements.finalDealPrice,
        totalBrokerage: sellAgreements.totalBrokerage,
        remainingBrokerage: sellAgreements.remainingBrokerage,

        agreementStatus: sellAgreements.agreementStatus,
        createdAt: sellAgreements.createdAt,
      })
      .from(sellAgreements)

      // ✅ KEY FIX: compare text-to-text to avoid uuid=varchar operator error
      .leftJoin(clients, sql`${sellAgreements.clientId}::text = ${clients.id}`)
      .leftJoin(owners, sql`${sellAgreements.ownerId}::text = ${owners.id}`)
      .leftJoin(properties, sql`${sellAgreements.propertyId}::text = ${properties.id}`)

      // ✅ remainingBrokerage must be numeric > 0 (handles '-', '', null safely)
      .where(sql`
      COALESCE(
        NULLIF(REGEXP_REPLACE(TRIM(${sellAgreements.remainingBrokerage}), '[^0-9.]', '', 'g'), ''),
        '0'
      )::numeric > 0
    `)
      .orderBy(desc(sellAgreements.createdAt))
      .limit(limit);

    return rows;
  }


  async createManualUser(email: string, role: string): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email,
        role,
        firstName: email.split("@")[0],
        lastName: "",
      })
      .returning();
    return user;
  }

  async deactivateUser(id: string): Promise<User> {
    const [user] = await db.update(users).set({ isActive: 0, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return user;
  }

  async reactivateUser(id: string): Promise<User> {
    const [user] = await db.update(users).set({ isActive: 1, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return user;
  }

  async createActivityLog(data: InsertActivityLog) {
    const [row] = await db.insert(activityLogs).values(data).returning();
    return row;
  }

  async getActivityLogsByDate(dateISO: string) {
    const start = new Date(`${dateISO}T00:00:00.000Z`);
    const end = new Date(`${dateISO}T23:59:59.999Z`);

    const rows = await db
      .select({
        id: activityLogs.id,
        userId: activityLogs.userId,
        userRole: activityLogs.userRole,
        action: activityLogs.action,
        method: activityLogs.method,
        path: activityLogs.path,
        entityType: activityLogs.entityType,
        entityId: activityLogs.entityId,
        ip: activityLogs.ip,
        userAgent: activityLogs.userAgent,
        createdAt: activityLogs.createdAt,

        // ✅ user fields
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .where(and(gte(activityLogs.createdAt, start), lte(activityLogs.createdAt, end)))
      .orderBy(desc(activityLogs.createdAt));

    return rows;
  }


  // Lead operations
  async getLeads(): Promise<Lead[]> {
    return await db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async findLeadByPhone(rawPhone: string): Promise<Lead | undefined> {
    if (!rawPhone) return undefined;

    const digits = rawPhone.replace(/\D/g, "");
    if (!digits) return undefined;

    const last10 = digits.slice(-10);
    if (!last10) return undefined;

    const pattern = `%${last10}`;
    const [lead] = await db.select().from(leads).where(like(leads.phone, pattern)).limit(1);
    return lead;
  }

  async createLead(leadData: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(leadData).returning();
    return lead;
  }

  async updateLead(id: string, leadData: Partial<InsertLead>): Promise<Lead> {
    const [lead] = await db.update(leads).set({ ...leadData, updatedAt: new Date() }).where(eq(leads.id, id)).returning();
    return lead;
  }

  async deleteLead(id: string): Promise<void> {
    await db.delete(leads).where(eq(leads.id, id));
  }

  // ---------------------------------------------
  // ✅ Property operations (TOTAL SUPPORT ADDED)
  // ---------------------------------------------

  // Backward compatible: returns ONLY items array (old behavior)
  async getProperties(params?: {
    limit?: number;
    offset?: number;
    search?: string;
    transactionType?: string;
    status?: string;
  }): Promise<PropertyWithOwner[]> {
    const result = await this.getPropertiesWithTotal(params);
    return result.items;
  }

  // ✅ NEW: returns items + total
  async getPropertiesWithTotal(params?: {
    limit?: number;
    offset?: number;
    search?: string;
    transactionType?: string;
    status?: string;
    caste?: string; // ✅ ADD
    apartmentId?: string;
  }): Promise<PropertiesWithTotal> {
    const limit = params?.limit;
    const offset = params?.offset;
    const search = params?.search?.trim();
    const transactionType = params?.transactionType?.trim();
    const status = params?.status;
    const apartmentId = params?.apartmentId;
    const caste = params?.caste?.trim(); // ✅ ADD

    const baseQuery = db
      .select({
        id: properties.id,
        codeNo: properties.codeNo,
        caste: properties.caste,
        title: properties.title,
        location: properties.location,
        googleMapLink: properties.googleMapLink,
        latitude: properties.latitude,
        longitude: properties.longitude,
        price: properties.price,
        area: properties.area,
        builtUpArea: properties.builtUpArea,
        floor: properties.floor,

        description: properties.description,
        officeMessage: properties.officeMessage,
        ownerMessage: properties.ownerMessage,

        constructionYear: properties.constructionYear,
        type: properties.type,
        transactionType: properties.transactionType,
        status: properties.status,
        ownerId: properties.ownerId,
        apartmentId: properties.apartmentId,
        locationPriority: properties.locationPriority,
        agreementStartDate: properties.agreementStartDate,
        agreementEndDate: properties.agreementEndDate,

        lift: properties.lift,
        parking: properties.parking,
        furnishingStatus: properties.furnishingStatus,
        carpetArea: properties.carpetArea,
        totalFloor: properties.totalFloor,

        createdAt: properties.createdAt,
        updatedAt: properties.updatedAt,

        ownerName: owners.name,
        ownerPhone: owners.phone,
        ownerEmail: owners.email,

        propertyFacing: properties.propertyFacing,
        bedrooms: properties.bedrooms,
        bathrooms: properties.bathrooms,
        balconies: properties.balconies,
        halls: properties.halls,
      })
      .from(properties)
      .leftJoin(owners, eq(properties.ownerId, owners.id))
      .orderBy(desc(properties.createdAt));

    const conditions: any[] = [];

    if (search && search.length > 0) {
      const q = `%${search}%`;
      conditions.push(
        sql`(
          properties.code_no ILIKE ${q} OR
          properties.title ILIKE ${q} OR
          properties.location ILIKE ${q} OR
          properties.type ILIKE ${q} OR
          CAST(properties.area AS TEXT) ILIKE ${q} OR
          CAST(properties.built_up_area AS TEXT) ILIKE ${q} OR
          owners.name ILIKE ${q} OR
          CAST(owners.phone AS TEXT) ILIKE ${q}
        )` as unknown as any
      );
    }

    if (transactionType && transactionType !== "all") {
      conditions.push(
        sql`lower(${properties.transactionType}) = lower(${transactionType})`
      );
    }

    if (status && status !== "all") {
      conditions.push(eq(properties.status, status));
    }
    if (apartmentId && apartmentId !== "all") {
      conditions.push(eq(properties.apartmentId, apartmentId));
    }

    if (caste && caste !== "all") {
      conditions.push(eq(properties.caste, caste)); // ✅ ADD
    }

    const whereQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

    // ✅ total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(properties)
      .leftJoin(owners, eq(properties.ownerId, owners.id))
      .where(conditions.length > 0 ? and(...conditions) : (undefined as any));

    // ✅ items
    const items =
      typeof limit === "number" && typeof offset === "number"
        ? await whereQuery.limit(limit).offset(offset)
        : await whereQuery;

    return { items, total: Number(total) || 0 };
  }

  async getProperty(id: string): Promise<PropertyWithOwner | undefined> {
    const [property] = await db
      .select({
        id: properties.id,
        codeNo: properties.codeNo,
        caste: properties.caste,
        title: properties.title,
        location: properties.location,
        googleMapLink: properties.googleMapLink,
        latitude: properties.latitude,
        longitude: properties.longitude,
        price: properties.price,
        area: properties.area,
        builtUpArea: properties.builtUpArea,
        floor: properties.floor,
        constructionYear: properties.constructionYear,
        type: properties.type,
        transactionType: properties.transactionType,
        status: properties.status,
        ownerId: properties.ownerId,
        apartmentId: properties.apartmentId,
        locationPriority: properties.locationPriority,

        images: properties.images,
        description: properties.description,
        officeMessage: properties.officeMessage,
        ownerMessage: properties.ownerMessage,
        agreementStartDate: properties.agreementStartDate,
        agreementEndDate: properties.agreementEndDate,
        lift: properties.lift,
        parking: properties.parking,

        furnishingStatus: properties.furnishingStatus,
        carpetArea: properties.carpetArea,
        totalFloor: properties.totalFloor,

        createdAt: properties.createdAt,
        updatedAt: properties.updatedAt,
        ownerName: owners.name,
        ownerPhone: owners.phone,
        ownerEmail: owners.email,

        propertyFacing: properties.propertyFacing,
        bedrooms: properties.bedrooms,
        bathrooms: properties.bathrooms,
        balconies: properties.balconies,
        halls: properties.halls,
      })
      .from(properties)
      .leftJoin(owners, eq(properties.ownerId, owners.id))
      .where(eq(properties.id, id));
    return property;
  }

  async createProperty(propertyData: InsertProperty): Promise<Property> {
    const [property] = await db.insert(properties).values(propertyData).returning();
    return property;
  }

  async updateProperty(id: string, propertyData: Partial<InsertProperty>): Promise<Property> {
    const [property] = await db.update(properties).set({ ...propertyData, updatedAt: new Date() }).where(eq(properties.id, id)).returning();
    return property;
  }

  async deleteProperty(id: string): Promise<void> {
    await db.delete(properties).where(eq(properties.id, id));
  }

  async getExpiringRentalAgreements(daysAhead: number): Promise<PropertyWithOwner[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + daysAhead);

    const result = await db
      .select({
        id: properties.id,
        codeNo: properties.codeNo,
        caste: properties.caste,
        title: properties.title,
        location: properties.location,
        googleMapLink: properties.googleMapLink,
        latitude: properties.latitude,
        longitude: properties.longitude,
        price: properties.price,
        area: properties.area,
        builtUpArea: properties.builtUpArea,
        floor: properties.floor,
        constructionYear: properties.constructionYear,
        type: properties.type,
        transactionType: properties.transactionType,
        status: properties.status,
        ownerId: properties.ownerId,
        locationPriority: properties.locationPriority,

        images: properties.images,
        description: properties.description,
        officeMessage: properties.officeMessage,
        ownerMessage: properties.ownerMessage,
        agreementStartDate: properties.agreementStartDate,
        agreementEndDate: properties.agreementEndDate,
        createdAt: properties.createdAt,
        updatedAt: properties.updatedAt,

        lift: properties.lift,
        parking: properties.parking,
        furnishingStatus: properties.furnishingStatus,
        carpetArea: properties.carpetArea,
        totalFloor: properties.totalFloor,

        propertyFacing: properties.propertyFacing,
        bedrooms: properties.bedrooms,
        bathrooms: properties.bathrooms,
        balconies: properties.balconies,
        halls: properties.halls,

        ownerName: owners.name,
        ownerPhone: owners.phone,
        ownerEmail: owners.email,
      })
      .from(properties)
      .leftJoin(owners, eq(properties.ownerId, owners.id))
      .where(and(eq(properties.transactionType, "Rent"), gte(properties.agreementEndDate, now), lte(properties.agreementEndDate, future)))
      .orderBy(properties.agreementEndDate);

    return result;
  }

  // ✅ Towers (ADD THIS in DatabaseStorage)
  async getProjectTowers(projectId: string): Promise<ProjectTower[]> {
    return await db
      .select()
      .from(projectTowers)
      .where(eq(projectTowers.projectId, projectId))
      .orderBy(asc(projectTowers.createdAt));
  }

  async createProjectTower(data: InsertProjectTower): Promise<ProjectTower> {
    const [row] = await db.insert(projectTowers).values(data).returning();
    if (!row) throw new Error("Failed to create tower");
    return row;
  }

  async updateProjectTower(id: string, data: Partial<InsertProjectTower>): Promise<ProjectTower> {
    const [row] = await db
      .update(projectTowers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projectTowers.id, id))
      .returning();

    if (!row) throw new Error("Tower not found");
    return row;
  }

  async deleteProjectTower(id: string): Promise<void> {
    await db.delete(projectTowers).where(eq(projectTowers.id, id));
  }

  // ✅ Unit Configs
  async getProjectUnitConfigs(projectId: string): Promise<ProjectUnitConfig[]> {
    return await db
      .select()
      .from(projectUnitConfigs)
      .where(eq(projectUnitConfigs.projectId, projectId))
      .orderBy(asc(projectUnitConfigs.createdAt));
  }

  async createProjectUnitConfig(data: InsertProjectUnitConfig): Promise<ProjectUnitConfig> {
    const [row] = await db.insert(projectUnitConfigs).values(data).returning();
    if (!row) throw new Error("Failed to create unit config");
    return row;
  }

  async updateProjectUnitConfig(id: string, data: Partial<InsertProjectUnitConfig>): Promise<ProjectUnitConfig> {
    const [row] = await db
      .update(projectUnitConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projectUnitConfigs.id, id))
      .returning();

    if (!row) throw new Error("Unit config not found");
    return row;
  }

  async deleteProjectUnitConfig(id: string): Promise<void> {
    await db.delete(projectUnitConfigs).where(eq(projectUnitConfigs.id, id));
  }

  // ✅ Project Images
  async getProjectImages(projectId: string): Promise<ProjectImage[]> {
    return await db
      .select()
      .from(projectImages)
      .where(eq(projectImages.projectId, projectId))
      .orderBy(asc(projectImages.createdAt));
  }

  async addProjectImage(data: InsertProjectImage): Promise<ProjectImage> {
    const [row] = await db.insert(projectImages).values(data).returning();
    if (!row) throw new Error("Failed to add project image");
    return row;
  }

  async deleteProjectImage(id: string): Promise<void> {
    await db.delete(projectImages).where(eq(projectImages.id, id));
  }

  // ✅ Project Documents

  async getProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
    return await db
      .select()
      .from(projectDocuments)
      .where(eq(projectDocuments.projectId, projectId))
      .orderBy(asc(projectDocuments.createdAt));
  }

  async getProjectDocument(id: string): Promise<ProjectDocument | undefined> {
    const [row] = await db.select().from(projectDocuments).where(eq(projectDocuments.id, id)).limit(1);
    return row;
  }
  async createProjectDocument(data: InsertProjectDocument): Promise<ProjectDocument> {
    const [row] = await db.insert(projectDocuments).values(data).returning();
    if (!row) throw new Error("Failed to create project document");
    return row;
  }

  async updateProjectDocument(id: string, data: Partial<InsertProjectDocument>): Promise<ProjectDocument> {
    const [row] = await db
      .update(projectDocuments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projectDocuments.id, id))
      .returning();

    if (!row) throw new Error("Project document not found");
    return row;
  }

  async deleteProjectDocument(id: string): Promise<void> {
    await db.delete(projectDocuments).where(eq(projectDocuments.id, id));
  }


  // Owner operations
  async getOwners(): Promise<Owner[]> {
    return await db.select().from(owners).orderBy(desc(owners.createdAt));
  }

  async getOwner(id: string): Promise<Owner | undefined> {
    const [owner] = await db.select().from(owners).where(eq(owners.id, id));
    return owner;
  }

  async getOwnerByPhone(phone: string): Promise<Owner | undefined> {
    const [owner] = await db.select().from(owners).where(eq(owners.phone, phone));
    return owner;
  }

  async createOwner(ownerData: InsertOwner): Promise<Owner> {
    const [owner] = await db.insert(owners).values(ownerData).returning();
    return owner;
  }

  async updateOwner(id: string, ownerData: Partial<InsertOwner>): Promise<Owner> {
    const [owner] = await db.update(owners).set({ ...ownerData, updatedAt: new Date() }).where(eq(owners.id, id)).returning();
    return owner;
  }

  async deleteOwner(id: string): Promise<void> {
    await db.delete(owners).where(eq(owners.id, id));
  }

  // Project Owner operations
  async getProjectOwners(): Promise<ProjectOwner[]> {
    return await db.select().from(projectOwners).orderBy(desc(projectOwners.createdAt));
  }

  async getProjectOwner(id: string): Promise<ProjectOwner | undefined> {
    const [row] = await db.select().from(projectOwners).where(eq(projectOwners.id, id));
    return row;
  }

  async createProjectOwner(data: InsertProjectOwner): Promise<ProjectOwner> {
    const [row] = await db.insert(projectOwners).values(data).returning();
    return row;
  }

  async updateProjectOwner(id: string, data: Partial<InsertProjectOwner>): Promise<ProjectOwner> {
    const [row] = await db
      .update(projectOwners)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projectOwners.id, id))
      .returning();
    return row;
  }

  async deleteProjectOwner(id: string): Promise<void> {
    await db.delete(projectOwners).where(eq(projectOwners.id, id));
  }


  // Projects operations
  async getProjects(): Promise<ProjectWithOwner[]> {
    const rows = await db
      .select({
        // project fields
        id: projects.id,
        projectOwnerId: projects.projectOwnerId,
        launchDate: projects.launchDate,
        completionDate: projects.completionDate,
        projectName: projects.projectName,
        reraNo: projects.reraNo,
        projectArea: projects.projectArea,
        possession: projects.possession,
        possessionDate: projects.possessionDate,
        transactionType: projects.transactionType,
        description: projects.description,
        specification: projects.specification,
        amenities: projects.amenities,
        youtubeVideoUrl: projects.youtubeVideoUrl,
        virtualVideo: projects.virtualVideo,
        projectAddress: projects.projectAddress,
        status: projects.status,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,

        // joined project owner fields (for cards)
        projectOwnerName: projectOwners.name,
        projectOwnerMobileNumber: projectOwners.mobileNumber,
      })
      .from(projects)
      .leftJoin(projectOwners, eq(projects.projectOwnerId, projectOwners.id))
      .orderBy(desc(projects.createdAt));

    return rows;
  }

  async getProject(id: string): Promise<ProjectWithOwner | undefined> {
    const [row] = await db
      .select({
        id: projects.id,
        projectOwnerId: projects.projectOwnerId,
        launchDate: projects.launchDate,
        completionDate: projects.completionDate,
        projectName: projects.projectName,
        reraNo: projects.reraNo,
        projectArea: projects.projectArea,
        possession: projects.possession,
        possessionDate: projects.possessionDate,
        transactionType: projects.transactionType,
        description: projects.description,
        specification: projects.specification,
        amenities: projects.amenities,
        youtubeVideoUrl: projects.youtubeVideoUrl,
        virtualVideo: projects.virtualVideo,
        projectAddress: projects.projectAddress,
        status: projects.status,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,

        projectOwnerName: projectOwners.name,
        projectOwnerMobileNumber: projectOwners.mobileNumber,
      })
      .from(projects)
      .leftJoin(projectOwners, eq(projects.projectOwnerId, projectOwners.id))
      .where(eq(projects.id, id));

    return row;
  }

  async createProject(data: InsertProject): Promise<Project> {
    const [row] = await db.insert(projects).values(data).returning();
    return row;
  }

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project> {
    const [row] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return row;
  }

  async updateProjectStatus(projectId: string, status: string | null): Promise<Project> {
    const [row] = await db
      .update(projects)
      .set({ status, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();

    if (!row) throw new Error("Project not found");
    return row;
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }


  // Client operations
  async getClients(): Promise<Client[]> {
    return await db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async createClient(clientData: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(clientData).returning();
    return client;
  }

  async updateClient(id: string, clientData: Partial<InsertClient>): Promise<Client> {
    const [client] = await db.update(clients).set({ ...clientData, updatedAt: new Date() }).where(eq(clients.id, id)).returning();
    return client;
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getActivities(leadId: string): Promise<Activity[]> {
    return await db.select().from(activities).where(eq(activities.leadId, leadId)).orderBy(desc(activities.createdAt));
  }

  async createActivity(activityData: InsertActivity): Promise<Activity> {
    const [activity] = await db.insert(activities).values(activityData).returning();
    return activity;
  }

  async getActivity(id: string): Promise<Activity | null> {
    const [activity] = await db.select().from(activities).where(eq(activities.id, id));
    return activity ?? null;
  }

  async updateActivity(id: string, activityData: Partial<InsertActivity>): Promise<Activity> {
    const [activity] = await db.update(activities).set(activityData).where(eq(activities.id, id)).returning();
    return activity;
  }

  async deleteActivity(id: string): Promise<void> {
    await db.delete(activities).where(eq(activities.id, id));
  }

  async getRecentActivities(limit: number = 10): Promise<Activity[]> {
    return await db.select().from(activities).orderBy(desc(activities.createdAt)).limit(limit);
  }

  // Apartment operations

  async getApartments(): Promise<Apartment[]> {
    return await db.select().from(apartments).orderBy(desc(apartments.createdAt));
  }

  async getApartment(id: string): Promise<Apartment | undefined> {
    const [apt] = await db.select().from(apartments).where(eq(apartments.id, id));
    return apt;
  }

  async createApartment(apartment: InsertApartment): Promise<Apartment> {
    const [apt] = await db.insert(apartments).values(apartment).returning();
    return apt;
  }

  async updateApartment(id: string, apartment: Partial<InsertApartment>): Promise<Apartment> {
    const [apt] = await db
      .update(apartments)
      .set({ ...apartment, updatedAt: new Date() })
      .where(eq(apartments.id, id))
      .returning();

    if (!apt) throw new Error("Apartment not found");
    return apt;
  }

  async deleteApartment(id: string): Promise<void> {
    await db.delete(apartments).where(eq(apartments.id, id));
  }


  // Contact submission operations
  async getContactSubmissions(): Promise<ContactSubmission[]> {
    return await db.select().from(contactSubmissions).orderBy(desc(contactSubmissions.createdAt));
  }

  async createContactSubmission(submissionData: InsertContactSubmission): Promise<ContactSubmission> {
    const [submission] = await db.insert(contactSubmissions).values(submissionData).returning();
    return submission;
  }

  // Dashboard stats
  async getDashboardStats(): Promise<any> {
    const [totalLeadsResult] = await db.select({ count: count() }).from(leads);
    const [activeLeadsResult] = await db.select({ count: count() }).from(leads).where(sql`${leads.stage} != 'Closed'`);
    const [closedDealsResult] = await db.select({ count: count() }).from(leads).where(eq(leads.stage, "Closed"));
    const [totalPropertiesResult] = await db.select({ count: count() }).from(properties);
    const [availablePropertiesResult] = await db.select({ count: count() }).from(properties).where(eq(properties.status, "Available"));

    const soldProperties = await db.select({ price: properties.price }).from(properties).where(eq(properties.status, "Sold"));

    const [rentPropertiesResult] = await db.select({ count: count() }).from(properties).where(eq(properties.transactionType, "Rent"));
    const [sellPropertiesResult] = await db.select({ count: count() }).from(properties).where(eq(properties.transactionType, "Sell"));

    const totalRevenue = soldProperties.reduce((sum, prop) => sum + Number(prop.price), 0);

    return {
      totalLeads: totalLeadsResult.count,
      activeLeads: activeLeadsResult.count,
      closedDeals: closedDealsResult.count,
      totalProperties: totalPropertiesResult.count,
      availableProperties: availablePropertiesResult.count,
      totalRentProperties: rentPropertiesResult.count,
      totalSellProperties: sellPropertiesResult.count,
      totalRevenue,
    };
  }

  async getSalesData(): Promise<any[]> {
    const soldProperties = await db.select({ createdAt: properties.createdAt, price: properties.price }).from(properties).where(eq(properties.status, "Sold"));

    const monthlyData: { [key: string]: number } = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    soldProperties.forEach((prop) => {
      const date = new Date(prop.createdAt!);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthlyData[yearMonth] = (monthlyData[yearMonth] || 0) + Number(prop.price);
    });

    const currentDate = new Date();
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const monthName = monthNames[date.getMonth()];
      last6Months.push({ month: monthName, sales: monthlyData[yearMonth] || 0 });
    }

    return last6Months;
  }

  async getLeadSourceData(): Promise<any[]> {
    const sourceData = await db.select({ source: leads.source, count: count() }).from(leads).groupBy(leads.source);

    return sourceData.map((item) => ({
      name: item.source,
      value: item.count,
    }));
  }

  async getTopAgents(): Promise<any[]> {
    const agentDeals = await db
      .select({ agentId: leads.assignedTo, deals: count() })
      .from(leads)
      .where(and(eq(leads.stage, "Closed"), sql`${leads.assignedTo} IS NOT NULL`))
      .groupBy(leads.assignedTo)
      .orderBy(desc(count()))
      .limit(5);

    const agentsWithNames = await Promise.all(
      agentDeals.map(async (agent) => {
        const user = await this.getUser(agent.agentId!);
        return {
          id: agent.agentId,
          name: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || "Unknown",
          deals: agent.deals,
        };
      })
    );

    return agentsWithNames;
  }

  async getDailyExecutiveActivities(): Promise<any[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allUsers = await this.getAllUsers();
    const executives = allUsers.filter((u) => (u.role === "Sales Agent" || u.role === "Marketing Executive") && u.isActive);

    const executiveReports = await Promise.all(
      executives.map(async (user) => {
        const leadsAssignedToday = await db.select({ count: count() }).from(leads).where(and(eq(leads.assignedTo, user.id), gte(leads.createdAt, today)));

        const siteVisitsToday = await db
          .select({ count: count() })
          .from(activities)
          .where(and(eq(activities.performedBy, user.id), eq(activities.type, "site_visit"), gte(activities.createdAt, today)));

        const leadsClosedToday = await db
          .select({ count: count() })
          .from(leads)
          .where(and(eq(leads.assignedTo, user.id), eq(leads.stage, "Closed"), gte(leads.updatedAt, today)));

        return {
          userId: user.id,
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Unknown",
          role: user.role,
          leadsAssigned: leadsAssignedToday[0]?.count || 0,
          siteVisits: siteVisitsToday[0]?.count || 0,
          leadsClosed: leadsClosedToday[0]?.count || 0,
        };
      })
    );

    return executiveReports.sort((a, b) => {
      const totalA = a.leadsAssigned + a.siteVisits + a.leadsClosed;
      const totalB = b.leadsAssigned + b.siteVisits + b.leadsClosed;
      return totalB - totalA;
    });
  }

  // Helper methods for import
  async getOwnerByEmail(email: string): Promise<Owner | undefined> {
    const [owner] = await db.select().from(owners).where(eq(owners.email, email));
    return owner;
  }

  async getLeadByEmail(email: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.email, email));
    return lead;
  }

  async getPropertyByTitleAndLocation(title: string, location: string): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(and(eq(properties.title, title), eq(properties.location, location)));
    return property;
  }

  // Bulk import operations
  async bulkImportLeads(leadsData: InsertLead[]): Promise<{ inserted: number; updated: number; errors: any[] }> {
    const errors: any[] = [];

    for (let i = 0; i < leadsData.length; i++) {
      const leadData = leadsData[i];
      if (!leadData.name || !leadData.phone || !leadData.source) {
        errors.push({ row: i + 1, error: "Missing required fields: name, phone, or source" });
      }
    }

    if (errors.length > 0) return { inserted: 0, updated: 0, errors };

    let inserted = 0;
    let updated = 0;

    await db.transaction(async (tx) => {
      for (const leadData of leadsData) {
        const normalizedLead: any = { ...leadData };

        if (typeof normalizedLead.budget === "string" && normalizedLead.budget.trim() !== "") {
          const num = Number(normalizedLead.budget);
          normalizedLead.budget = isNaN(num) ? undefined : num;
        }

        if (typeof normalizedLead.nextFollowUp === "string") {
          normalizedLead.nextFollowUp = parseNextFollowUpServer(normalizedLead.nextFollowUp);
        }

        if (normalizedLead.comments === "") normalizedLead.comments = null;

        await tx.insert(leads).values(normalizedLead);
        inserted++;
      }
    });

    return { inserted, updated, errors };
  }

  async bulkImportProperties(propertiesData: any[]): Promise<{ inserted: number; updated: number; errors: any[] }> {
    const errors: any[] = [];

    const cleanFlexibleValue = (value: any): string | number | null => {
      if (value === null || value === undefined || value === "") return null;
      const strValue = String(value).trim();
      if (/^\d+(\.\d+)?$/.test(strValue)) return parseFloat(strValue);
      return strValue;
    };

    for (let i = 0; i < propertiesData.length; i++) {
      const propertyData = propertiesData[i];
      if (propertyData.ownerName || propertyData.ownerPhone) {
        if (!propertyData.ownerName || !propertyData.ownerPhone) {
          errors.push({
            row: i + 1,
            error: "Both owner name and phone are required if owner data is provided",
          });
        }
      }
    }

    if (errors.length > 0) return { inserted: 0, updated: 0, errors };

    let inserted = 0;
    let updated = 0;

    await db.transaction(async (tx) => {
      for (const propertyData of propertiesData) {
        let ownerId = propertyData.ownerId;

        if (propertyData.ownerName && propertyData.ownerPhone) {
          const [existingOwner] = await tx.select().from(owners).where(eq(owners.phone, propertyData.ownerPhone));
          if (existingOwner) {
            ownerId = existingOwner.id;
          } else {
            const [newOwner] = await tx
              .insert(owners)
              .values({ name: propertyData.ownerName, phone: propertyData.ownerPhone, email: null, address: null })
              .returning();
            ownerId = newOwner.id;
          }
        }

        const { ownerName, ownerPhone, ...cleanPropertyData } = propertyData;

        if (cleanPropertyData.price !== undefined) cleanPropertyData.price = cleanFlexibleValue(cleanPropertyData.price);
        if (cleanPropertyData.area !== undefined) cleanPropertyData.area = cleanFlexibleValue(cleanPropertyData.area);
        if (cleanPropertyData.latitude !== undefined) cleanPropertyData.latitude = cleanFlexibleValue(cleanPropertyData.latitude);
        if (cleanPropertyData.longitude !== undefined) cleanPropertyData.longitude = cleanFlexibleValue(cleanPropertyData.longitude);

        const finalPropertyData = { ...cleanPropertyData, ownerId };

        await tx.insert(properties).values(finalPropertyData);
        inserted++;
      }
    });

    return { inserted, updated, errors };
  }

  async bulkImportOwners(ownersData: InsertOwner[]): Promise<{ inserted: number; updated: number; errors: any[] }> {
    const errors: any[] = [];

    for (let i = 0; i < ownersData.length; i++) {
      const ownerData = ownersData[i];
      const name = ownerData.name?.toString().trim();
      const phone = ownerData.phone?.toString().trim();
      if (!name || !phone) errors.push({ row: i + 1, error: "Missing required fields: name or phone" });
    }

    if (errors.length > 0) return { inserted: 0, updated: 0, errors };

    let inserted = 0;
    let updated = 0;

    await db.transaction(async (tx) => {
      for (const ownerData of ownersData) {
        let existingOwner;

        if (ownerData.email) {
          const [byEmail] = await tx.select().from(owners).where(eq(owners.email, ownerData.email));
          existingOwner = byEmail;
        }

        if (!existingOwner && ownerData.phone) {
          const [byPhone] = await tx.select().from(owners).where(eq(owners.phone, ownerData.phone));
          existingOwner = byPhone;
        }

        if (existingOwner) {
          await tx.update(owners).set({ ...ownerData, updatedAt: new Date() }).where(eq(owners.id, existingOwner.id));
          updated++;
        } else {
          await tx.insert(owners).values(ownerData);
          inserted++;
        }
      }
    });

    return { inserted, updated, errors };
  }

  async bulkImportClients(clientsData: InsertClient[]): Promise<{ inserted: number; updated: number; errors: any[] }> {
    const errors: any[] = [];

    for (let i = 0; i < clientsData.length; i++) {
      const clientData = clientsData[i];
      if (!clientData.name || !clientData.phone) errors.push({ row: i + 1, error: "Missing required fields: name or phone" });
      if (!clientData.email && !clientData.phone) errors.push({ row: i + 1, error: "Either email or phone is required for duplicate detection" });
    }

    if (errors.length > 0) return { inserted: 0, updated: 0, errors };

    let inserted = 0;
    let updated = 0;

    await db.transaction(async (tx) => {
      for (const clientData of clientsData) {
        let existingClient;
        if (clientData.email) {
          [existingClient] = await tx.select().from(clients).where(eq(clients.email, clientData.email));
        }
        if (!existingClient && clientData.phone) {
          [existingClient] = await tx.select().from(clients).where(eq(clients.phone, clientData.phone));
        }

        if (existingClient) {
          await tx.update(clients).set({ ...clientData, updatedAt: new Date() }).where(eq(clients.id, existingClient.id));
          updated++;
        } else {
          await tx.insert(clients).values(clientData);
          inserted++;
        }
      }
    });

    return { inserted, updated, errors };
  }

  // Document attachment operations
  async getDocuments(entityType?: string, entityId?: string): Promise<DocumentAttachment[]> {
    let query = db.select().from(documentAttachments);

    if (entityType && entityId) {
      return await query
        .where(and(eq(documentAttachments.entityType, entityType), eq(documentAttachments.entityId, entityId)))
        .orderBy(desc(documentAttachments.createdAt));
    } else if (entityType) {
      return await query.where(eq(documentAttachments.entityType, entityType)).orderBy(desc(documentAttachments.createdAt));
    }

    return await query.orderBy(desc(documentAttachments.createdAt));
  }

  async getDocument(id: string): Promise<DocumentAttachment | undefined> {
    const [document] = await db.select().from(documentAttachments).where(eq(documentAttachments.id, id));
    return document;
  }

  async createDocument(documentData: InsertDocumentAttachment): Promise<DocumentAttachment> {
    const [document] = await db.insert(documentAttachments).values(documentData).returning();
    return document;
  }

  async updateDocument(id: string, documentData: Partial<InsertDocumentAttachment>): Promise<DocumentAttachment> {
    const [document] = await db.update(documentAttachments).set(documentData).where(eq(documentAttachments.id, id)).returning();
    return document;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documentAttachments).where(eq(documentAttachments.id, id));
  }
}

export const storage = new DatabaseStorage();
