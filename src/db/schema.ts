import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  smallint,
  boolean,
  timestamp,
  jsonb,
  inet,
  primaryKey,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/*                                   Enums                                     */
/* -------------------------------------------------------------------------- */

export const appRole = pgEnum("app_role", [
  "super_admin",
  "admin",
  "brand",
  "user",
  "moderator",
]);

export const attachmentVisibility = pgEnum("attachment_visibility", [
  "public",
  "brand_only",
  "super_admin_only",
]);

export const complaintStatus = pgEnum("complaint_status", [
  "pending",
  "approved",
  "in_review",
  "answered",
  "resolved",
  "rejected",
  "spam",
  "user_replied",
  "super_admin_review",
  "escalated",
  "archived",
]);

export const escalationReason = pgEnum("escalation_reason", [
  "wrong_brand",
  "duplicate",
  "spam",
  "insult",
  "profanity",
  "wrong_category",
  "legal",
  "fake_document",
  "fake_screenshot",
  "adult",
  "spam_ad",
  "other",
]);

export const escalationStatus = pgEnum("escalation_status", [
  "open",
  "approved",
  "rejected",
  "returned",
  "resolved",
]);

export const moderationKind = pgEnum("moderation_kind", [
  "escalation",
  "report",
  "sensitive",
  "verification",
  "adult",
  "duplicate",
  "other",
]);

export const moderationState = pgEnum("moderation_state", [
  "open",
  "reviewing",
  "resolved",
  "dismissed",
]);

export const otpPurpose = pgEnum("otp_purpose", ["signup", "reset"]);

export const premiumRequestStatus = pgEnum("premium_request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const reportReason = pgEnum("report_reason", [
  "spam",
  "insult",
  "adult",
  "misinformation",
  "fraud",
  "other",
]);

export const reportTarget = pgEnum("report_target", [
  "complaint",
  "comment",
  "attachment",
  "video",
  "user",
  "brand",
]);

export const sanctionType = pgEnum("sanction_type", [
  "warning",
  "ban_temp",
  "ban_permanent",
  "unban",
]);

export const verificationStatus = pgEnum("verification_status", [
  "pending",
  "reviewing",
  "approved",
  "rejected",
]);

/* -------------------------------------------------------------------------- */
/*                              BetterAuth tables                             */
/* -------------------------------------------------------------------------- */
/*
 * These 4 tables follow BetterAuth's standard Drizzle schema shape, adapted to
 * use uuid primary keys so that domain uuid foreign keys line up. This replaces
 * the former Supabase `auth.users`. Re-verify / regenerate later with:
 *   npx @better-auth/cli generate
 */

export const user = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  // BetterAuth additionalField — kayıtta telefon almak için; profiles.phone'a kopyalanır
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const session = pgTable("session", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const account = pgTable("account", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const verification = pgTable("verification", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* -------------------------------------------------------------------------- */
/*                              Profiles & roles                              */
/* -------------------------------------------------------------------------- */

// 1:1 with the auth user; id references user.id.
export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  fullName: text("full_name"),
  username: text("username").unique(),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  city: text("city"),
  bio: text("bio"),
  isBanned: boolean("is_banned").default(false).notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  phoneVerified: boolean("phone_verified").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: appRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userRoleUnique: unique().on(t.userId, t.role),
  }),
);

/* -------------------------------------------------------------------------- */
/*                             Categories & brands                            */
/* -------------------------------------------------------------------------- */

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  icon: text("icon"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  about: text("about"),
  website: text("website"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
  coverVideo: text("cover_video"),
  socials: jsonb("socials").default({}).notNull(),
  gallery: jsonb("gallery").default([]).notNull(),
  businessHours: jsonb("business_hours"),
  verified: boolean("verified").default(false).notNull(),
  premium: boolean("premium").default(false).notNull(),
  premiumUntil: timestamp("premium_until", { withTimezone: true }),
  isActive: boolean("is_active").default(true).notNull(),
  licenseNo: text("license_no"),
  tier: text("tier").default("standard").notNull(),
  rating: numeric("rating", { precision: 3, scale: 2 }).default("0").notNull(),
  ratingCount: integer("rating_count").default(0).notNull(),
  totalComplaints: integer("total_complaints").default(0).notNull(),
  complaintsPending: integer("complaints_pending").default(0).notNull(),
  complaintsResolved: integer("complaints_resolved").default(0).notNull(),
  resolutionRate: integer("resolution_rate").default(0).notNull(),
  avgResponseMinutes: integer("avg_response_minutes").default(0).notNull(),
  avgFirstResponseMinutes: integer("avg_first_response_minutes"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const brandMembers = pgTable(
  "brand_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("agent").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    brandUserUnique: unique().on(t.brandId, t.userId),
  }),
);

export const brandRatings = pgTable(
  "brand_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    brandUserUnique: unique().on(t.brandId, t.userId),
  }),
);

export const brandDocuments = pgTable("brand_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  docType: text("doc_type").notNull(),
  storagePath: text("storage_path").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const brandVerificationRequests = pgTable("brand_verification_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  submittedBy: uuid("submitted_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  website: text("website"),
  message: text("message"),
  address: text("address"),
  photoUrl: text("photo_url"),
  requestType: text("request_type").default("verification").notNull(),
  status: verificationStatus("status").default("pending").notNull(),
  reviewerId: uuid("reviewer_id").references(() => user.id, {
    onDelete: "set null",
  }),
  reviewerNote: text("reviewer_note"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* -------------------------------------------------------------------------- */
/*                             AI Complaint Bot                               */
/* -------------------------------------------------------------------------- */

/**
 * Marka başına bot ayarları. Kayıt yoksa bot KAPALI sayılır (varsayılan
 * güvenli taraf), yani mevcut markalar bu özellikten etkilenmez.
 */
export const brandBotConfigs = pgTable("brand_bot_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id")
    .notNull()
    .unique()
    .references(() => brands.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").default(false).notNull(),
  /** false ise şikayet üretilir ama marka yanıtı yazılmaz. */
  generateResponses: boolean("generate_responses").default(true).notNull(),
  dailyTarget: integer("daily_target").default(3).notNull(),
  minRating: smallint("min_rating").default(1).notNull(),
  maxRating: smallint("max_rating").default(5).notNull(),
  // {"1":10,"2":15,"3":20,"4":30,"5":25} — boşsa kod içindeki varsayılan dağılım.
  ratingWeights: jsonb("rating_weights").default({}).notNull(),
  language: text("language").default("tr").notNull(),
  complaintTone: text("complaint_tone").default("natural").notNull(),
  responseTone: text("response_tone").default("professional").notNull(),
  // Boş dizi = tüm senaryolar kullanılabilir.
  scenarios: text("scenarios").array().default([]).notNull(),
  customInstructions: text("custom_instructions"),
  similarityThreshold: numeric("similarity_threshold", { precision: 3, scale: 2 })
    .default("0.82")
    .notNull(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Her bot çalıştırmasının denetim kaydı (cron veya manuel). */
export const botRuns = pgTable("bot_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  // 'cron' | 'manual'
  trigger: text("trigger").default("cron").notNull(),
  // 'running' | 'success' | 'partial' | 'failed' | 'skipped'
  status: text("status").default("running").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  targetCount: integer("target_count").default(0).notNull(),
  complaintsGenerated: integer("complaints_generated").default(0).notNull(),
  responsesGenerated: integer("responses_generated").default(0).notNull(),
  duplicatesDetected: integer("duplicates_detected").default(0).notNull(),
  errorCount: integer("error_count").default(0).notNull(),
  errors: jsonb("errors").default([]).notNull(),
  provider: text("provider"),
  triggeredBy: uuid("triggered_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* -------------------------------------------------------------------------- */
/*                                 Complaints                                 */
/* -------------------------------------------------------------------------- */

export const complaints = pgTable("complaints", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: complaintStatus("status").default("pending").notNull(),
  statusHistory: jsonb("status_history").default([]).notNull(),
  tags: text("tags").array().default([]).notNull(),
  priority: integer("priority").default(0).notNull(),
  isHighPriority: boolean("is_high_priority").default(false).notNull(),
  views: integer("views").default(0).notNull(),
  votes: integer("votes").default(0).notNull(),
  rating: smallint("rating"),
  isPublic: boolean("is_public").default(true).notNull(),
  isAnonymous: boolean("is_anonymous").default(false).notNull(),
  anonName: text("anon_name"),
  /** Bahis/casino sitesindeki kullanıcı adı (şikayet formunda zorunlu). */
  platformUsername: text("platform_username"),
  contactPhone: text("contact_phone"),
  city: text("city"),
  hidden: boolean("hidden").default(false).notNull(),
  sensitive: boolean("sensitive").default(false).notNull(),
  escalated: boolean("escalated").default(false).notNull(),
  adminNotes: text("admin_notes"),
  brandResponse: text("brand_response"),
  brandResponseAt: timestamp("brand_response_at", { withTimezone: true }),
  brandResponseBy: uuid("brand_response_by").references(() => user.id, {
    onDelete: "set null",
  }),
  firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
  firstResponseMinutes: integer("first_response_minutes"),
  publicId: text("public_id").unique(),
  shortId: text("short_id").unique(),
  sentimentScore: text("sentiment_score"),
  sentimentConfidence: numeric("sentiment_confidence"),
  isWhiteLabel: boolean("is_white_label").default(false).notNull(),
  whiteLabelSource: text("white_label_source"),
  /* --- AI Complaint Bot alanları (insan şikayetlerinde hepsi varsayılan) --- */
  // true ise içerik gerçek bir kullanıcıdan gelmemiştir. Yayına ve marka
  // ortalamasına karışması SYNTHETIC_CONTENT_PUBLIC ile kontrol edilir.
  isSynthetic: boolean("is_synthetic").default(false).notNull(),
  // null = insan, 'ai_bot' = günlük cron, 'ai_manual' = panelden tek seferlik
  generatedBy: text("generated_by"),
  language: text("language").default("tr").notNull(),
  botScenario: text("bot_scenario"),
  botRunId: uuid("bot_run_id").references(() => botRuns.id, {
    onDelete: "set null",
  }),
  // Dolu ise bot bu şikayete yanıt üretemedi; sonraki çalıştırmada denenir.
  botError: text("bot_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const complaintReplies = pgTable("complaint_replies", {
  id: uuid("id").primaryKey().defaultRandom(),
  complaintId: uuid("complaint_id")
    .notNull()
    .references(() => complaints.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  isBrand: boolean("is_brand").default(false).notNull(),
  isInternal: boolean("is_internal").default(false).notNull(),
  language: text("language"),
  // null = insan, 'ai_bot' | 'ai_manual' = bot ürünü, 'admin_edited' = elle düzeltilmiş
  generatedBy: text("generated_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const complaintAttachments = pgTable("complaint_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  complaintId: uuid("complaint_id").references(() => complaints.id, {
    onDelete: "set null",
  }),
  replyId: uuid("reply_id").references(() => complaintReplies.id, {
    onDelete: "set null",
  }),
  uploaderId: uuid("uploader_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  visibility: attachmentVisibility("visibility").default("public").notNull(),
  sensitive: boolean("sensitive").default(false).notNull(),
  aiFlags: jsonb("ai_flags").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const complaintEscalations = pgTable("complaint_escalations", {
  id: uuid("id").primaryKey().defaultRandom(),
  complaintId: uuid("complaint_id")
    .notNull()
    .references(() => complaints.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  raisedBy: uuid("raised_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  reason: escalationReason("reason").notNull(),
  status: escalationStatus("status").default("open").notNull(),
  note: text("note"),
  decision: text("decision"),
  decidedBy: uuid("decided_by").references(() => user.id, {
    onDelete: "set null",
  }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const complaintHistory = pgTable("complaint_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  complaintId: uuid("complaint_id")
    .notNull()
    .references(() => complaints.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedBy: uuid("changed_by").references(() => user.id, {
    onDelete: "set null",
  }),
  actorRole: text("actor_role"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const complaintResolutions = pgTable("complaint_resolutions", {
  id: uuid("id").primaryKey().defaultRandom(),
  complaintId: uuid("complaint_id")
    .notNull()
    .references(() => complaints.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  resolutionRating: integer("resolution_rating").notNull(),
  thanksMessage: text("thanks_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* -------------------------------------------------------------------------- */
/*                            Comments & votes                               */
/* -------------------------------------------------------------------------- */

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  complaintId: uuid("complaint_id")
    .notNull()
    .references(() => complaints.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id").references((): AnyPgColumn => comments.id, {
    onDelete: "set null",
  }),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  pinned: boolean("pinned").default(false).notNull(),
  upvotes: integer("upvotes").default(0).notNull(),
  downvotes: integer("downvotes").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const commentVotes = pgTable(
  "comment_votes",
  {
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    vote: smallint("vote").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.commentId, t.userId] }),
  }),
);

/* -------------------------------------------------------------------------- */
/*                        Conversations & messages                           */
/* -------------------------------------------------------------------------- */

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  complaintId: uuid("complaint_id").references(() => complaints.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  attachmentUrl: text("attachment_url"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* -------------------------------------------------------------------------- */
/*                                Notifications                               */
/* -------------------------------------------------------------------------- */

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* -------------------------------------------------------------------------- */
/*                          Moderation & reporting                           */
/* -------------------------------------------------------------------------- */

export const contentReports = pgTable("content_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: uuid("reporter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  targetType: reportTarget("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  reason: reportReason("reason").notNull(),
  note: text("note"),
  status: moderationState("status").default("open").notNull(),
  reviewerId: uuid("reviewer_id").references(() => user.id, {
    onDelete: "set null",
  }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const moderationQueue = pgTable("moderation_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: moderationKind("kind").notNull(),
  state: moderationState("state").default("open").notNull(),
  priority: integer("priority").default(0).notNull(),
  summary: text("summary"),
  payload: jsonb("payload").default({}).notNull(),
  targetType: text("target_type"),
  targetId: uuid("target_id"),
  relatedTable: text("related_table"),
  relatedId: uuid("related_id"),
  assigneeId: uuid("assignee_id").references(() => user.id, {
    onDelete: "set null",
  }),
  resolvedBy: uuid("resolved_by").references(() => user.id, {
    onDelete: "set null",
  }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userSanctions = pgTable("user_sanctions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: sanctionType("type").notNull(),
  reason: text("reason").notNull(),
  issuedBy: uuid("issued_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  active: boolean("active").default(true).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* -------------------------------------------------------------------------- */
/*                              Premium requests                             */
/* -------------------------------------------------------------------------- */

export const premiumRequests = pgTable("premium_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  plan: text("plan").default("standard").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }),
  currency: text("currency").default("TRY").notNull(),
  status: premiumRequestStatus("status").default("pending").notNull(),
  note: text("note"),
  decidedBy: uuid("decided_by").references(() => user.id, {
    onDelete: "set null",
  }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* -------------------------------------------------------------------------- */
/*                                  Videos                                    */
/* -------------------------------------------------------------------------- */

export const videos = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  coverUrl: text("cover_url"),
  videoUrl: text("video_url").notNull(),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  brandId: uuid("brand_id").references(() => brands.id, {
    onDelete: "set null",
  }),
  authorId: uuid("author_id").references(() => user.id, {
    onDelete: "set null",
  }),
  views: integer("views").default(0).notNull(),
  likes: integer("likes").default(0).notNull(),
  status: text("status").default("published").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const videoLikes = pgTable(
  "video_likes",
  {
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.videoId, t.userId] }),
  }),
);

/* -------------------------------------------------------------------------- */
/*                              Content / CMS                                */
/* -------------------------------------------------------------------------- */

export const blogs = pgTable("blogs", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  excerpt: text("excerpt"),
  category: text("category"),
  coverUrl: text("cover_url"),
  authorId: uuid("author_id").references(() => user.id, {
    onDelete: "set null",
  }),
  status: text("status").default("draft").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const cmsBlocks = pgTable("cms_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  type: text("type").notNull(),
  data: jsonb("data").default({}).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* -------------------------------------------------------------------------- */
/*                             Audit & security                              */
/* -------------------------------------------------------------------------- */

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  severity: text("severity").default("info").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  ip: text("ip"),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/*
 * email_otps: retained as an app-specific one-time-password store (rate-limit
 * `attempts`, `ip_address`, `otp_hash`, `purpose`). This is distinct from
 * BetterAuth's generic `verification` table and is kept so existing
 * signup/reset OTP flows keep working. Drop later if fully replaced.
 */
export const emailOtps = pgTable("email_otps", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  otpHash: text("otp_hash").notNull(),
  purpose: otpPurpose("purpose").default("signup").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  ipAddress: text("ip_address"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
