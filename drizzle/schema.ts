import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, unique, json } from "drizzle-orm/mysql-core";

// ─── Users (auth) ───
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "coordinator", "prof"]).default("user").notNull(),
  approvalStatus: mysqlEnum("approvalStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Components (curricular components) ───
export const components = mysqlTable("components", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(), // Ex: TEC502
  name: varchar("name", { length: 255 }).notNull(), // Ex: Concorrência e Conectividade
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Component = typeof components.$inferSelect;
export type InsertComponent = typeof components.$inferInsert;

// ─── Professor Component Memberships ───
// Tracks which professors belong to which components, their role within the component,
// and whether their membership is pending approval or approved.
export const professorComponents = mysqlTable("professor_components", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  componentId: int("componentId").notNull(), // References components.id
  componentRole: mysqlEnum("componentRole", ["coordinator", "prof"]).default("prof").notNull(),
  status: mysqlEnum("status", ["pending", "approved"]).default("pending").notNull(),
  authorizedAt: timestamp("authorizedAt").defaultNow().notNull(),
  authorizedByUserId: int("authorizedByUserId"),
}, (table) => [
  unique("uq_professor_component").on(table.userId, table.componentId),
]);

export type ProfessorComponent = typeof professorComponents.$inferSelect;
export type InsertProfessorComponent = typeof professorComponents.$inferInsert;

// ─── Classes (turmas) ───
export const classes = mysqlTable("classes", {
  id: int("id").autoincrement().primaryKey(),
  classCode: varchar("classCode", { length: 32 }).notNull(), // Ex: TP01
  componentId: int("componentId").notNull(), // References components.id
  semester: varchar("semester", { length: 16 }).notNull(), // Ex: 20262
  professorUserId: int("professorUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Class = typeof classes.$inferSelect;
export type InsertClass = typeof classes.$inferInsert;

// ─── Students (identified by enrollment/matrícula) ───
export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  enrollment: varchar("enrollment", { length: 32 }).notNull().unique(), // Matrícula - chave única
  email: varchar("email", { length: 320 }), // Opcional - definido pelo aluno na avaliação
  photoUrl: varchar("photoUrl", { length: 512 }), // Foto do aluno (S3 URL)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;

// ─── Class Students (vínculo aluno-turma) ───
export const classStudents = mysqlTable("class_students", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  classId: int("classId").notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
}, (table) => [
  unique("uq_student_class").on(table.studentId, table.classId),
]);

export type ClassStudent = typeof classStudents.$inferSelect;
export type InsertClassStudent = typeof classStudents.$inferInsert;

// ─── Sessions (evaluation sessions: PxSy) ───
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(),
  problemNumber: int("problemNumber").notNull(),
  sessionNumber: int("sessionNumber").notNull(),
  problemTitle: varchar("problemTitle", { length: 255 }),
  label: varchar("label", { length: 100 }).notNull(),
  accessCode: varchar("accessCode", { length: 8 }).unique(),
  status: mysqlEnum("status", ["initiated", "open", "closed", "finished"]).default("initiated").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

// ─── Session Students (which students are in each session) ───
export const sessionStudents = mysqlTable("session_students", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  studentId: int("studentId").notNull(),
  role: mysqlEnum("role", ["COORDENADOR", "MESA", "QUADRO", "PARTICIPANTE"]).default("PARTICIPANTE").notNull(),
  absent: boolean("absent").default(false).notNull(),
}, (table) => [
  unique("uq_session_student").on(table.sessionId, table.studentId),
]);

export type SessionStudent = typeof sessionStudents.$inferSelect;

// ─── Evaluations (one per evaluator per session) ───
export const evaluations = mysqlTable("evaluations", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  evaluatorStudentId: int("evaluatorStudentId").notNull(),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
}, (table) => [
  unique("uq_eval_session_evaluator").on(table.sessionId, table.evaluatorStudentId),
]);

export type Evaluation = typeof evaluations.$inferSelect;

// ─── Evaluation Items (individual grades for each evaluated student) ───
export const evaluationItems = mysqlTable("evaluation_items", {
  id: int("id").autoincrement().primaryKey(),
  evaluationId: int("evaluationId").notNull(),
  evaluatedStudentId: int("evaluatedStudentId").notNull(),
  role: mysqlEnum("role", ["COORDENADOR", "MESA", "QUADRO", "PARTICIPANTE"]).notNull(),
  absent: boolean("absent").default(false).notNull(),
  pontualidade: decimal("pontualidade", { precision: 4, scale: 2 }).default("0").notNull(),
  pesquisaMetas: decimal("pesquisa_metas", { precision: 4, scale: 2 }).default("0").notNull(),
  dominio: decimal("dominio", { precision: 4, scale: 2 }).default("0").notNull(),
  participacao: decimal("participacao", { precision: 4, scale: 2 }).default("0").notNull(),
  desempenhoPapel: decimal("desempenho_papel", { precision: 4, scale: 2 }).default("0").notNull(),
});

export type EvaluationItem = typeof evaluationItems.$inferSelect;

// ─── Tutorial Evaluations (professor evaluates the session) ───
export const tutorialEvaluations = mysqlTable("tutorial_evaluations", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull().unique(),
  professorUserId: int("professorUserId").notNull(),
  organizacao: decimal("organizacao", { precision: 3, scale: 1 }).default("0").notNull(), // peso 1
  cooperacao: decimal("cooperacao", { precision: 3, scale: 1 }).default("0").notNull(),   // peso 1
  conteudo: decimal("conteudo", { precision: 3, scale: 1 }).default("0").notNull(),       // peso 3
  objetivo: decimal("objetivo", { precision: 3, scale: 1 }).default("0").notNull(),       // peso 3
  metas: decimal("metas", { precision: 3, scale: 1 }).default("0").notNull(),             // peso 2
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
});

export type TutorialEvaluation = typeof tutorialEvaluations.$inferSelect;
export type InsertTutorialEvaluation = typeof tutorialEvaluations.$inferInsert;

// ─── Tutorial Evaluation Drafts (professor saves partial evaluation) ───
export const tutorialEvalDrafts = mysqlTable("tutorial_eval_drafts", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull().unique(),
  professorUserId: int("professorUserId").notNull(),
  organizacao: decimal("organizacao", { precision: 3, scale: 1 }).default("0").notNull(),
  cooperacao: decimal("cooperacao", { precision: 3, scale: 1 }).default("0").notNull(),
  conteudo: decimal("conteudo", { precision: 3, scale: 1 }).default("0").notNull(),
  objetivo: decimal("objetivo", { precision: 3, scale: 1 }).default("0").notNull(),
  metas: decimal("metas", { precision: 3, scale: 1 }).default("0").notNull(),
  savedAt: timestamp("savedAt").defaultNow().notNull(),
});

export type TutorialEvalDraft = typeof tutorialEvalDrafts.$inferSelect;
export type InsertTutorialEvalDraft = typeof tutorialEvalDrafts.$inferInsert;

// ─── Class Evaluation Permissions (professor authorizes another professor to evaluate sessions of a class) ───
export const classEvalPermissions = mysqlTable("class_eval_permissions", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(), // The class whose sessions can be evaluated
  authorizedUserId: int("authorizedUserId").notNull(), // The professor being authorized
  grantedByUserId: int("grantedByUserId").notNull(), // The professor who granted the permission (class owner)
  grantedAt: timestamp("grantedAt").defaultNow().notNull(),
}, (table) => [
  unique("uq_class_eval_perm").on(table.classId, table.authorizedUserId),
]);

export type ClassEvalPermission = typeof classEvalPermissions.$inferSelect;
export type InsertClassEvalPermission = typeof classEvalPermissions.$inferInsert;

// ─── Email Verification Codes (for registration) ───
export const emailVerificationCodes = mysqlTable("email_verification_codes", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailVerificationCode = typeof emailVerificationCodes.$inferSelect;

// ─── SMTP Configuration (admin's email credentials) ───
export const smtpConfig = mysqlTable("smtp_config", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // Only admin can have this
  host: varchar("host", { length: 255 }).notNull(),
  port: int("port").notNull().default(587),
  secure: boolean("secure").default(false).notNull(), // true for 465, false for 587/STARTTLS
  username: varchar("username", { length: 320 }).notNull(),
  password: varchar("password", { length: 512 }).notNull(), // encrypted in practice
  fromEmail: varchar("fromEmail", { length: 320 }).notNull(),
  fromName: varchar("fromName", { length: 255 }).default("Avaliação Tutorial").notNull(),
  configured: boolean("configured").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SmtpConfig = typeof smtpConfig.$inferSelect;
export type InsertSmtpConfig = typeof smtpConfig.$inferInsert;

// ─── Password Reset Codes ───
export const passwordResetCodes = mysqlTable("password_reset_codes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetCode = typeof passwordResetCodes.$inferSelect;

// ─── Audit Logs (action history for administrative traceability) ───
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  action: varchar("action", { length: 64 }).notNull(), // e.g. "approve_request", "reject_request", "promote_coordinator", etc.
  actorUserId: int("actorUserId").notNull(), // Who performed the action
  targetUserId: int("targetUserId"), // Who was affected (nullable for non-user actions)
  componentId: int("componentId"), // Related component (nullable)
  classId: int("classId"), // Related class (nullable)
  details: text("details"), // JSON string with additional context
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── Notifications (in-app alerts for professors) ───
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // The user who receives the notification
  type: varchar("type", { length: 64 }).notNull(), // e.g. "component_approved", "eval_permission_granted"
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  metadata: text("metadata"), // JSON string with extra context (componentId, classId, etc.)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Professor Student Notes (professor's per-student notes per session) ───
export const professorStudentNotes = mysqlTable("professor_student_notes", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  studentId: int("studentId").notNull(),
  professorUserId: int("professorUserId").notNull(),
  positivePoints: int("positivePoints").default(0).notNull(), // 0-10
  negativePoints: int("negativePoints").default(0).notNull(), // 0-10
  positiveTexts: json("positiveTexts").$type<string[]>(), // Array of up to 10 text annotations for positive points
  negativeTexts: json("negativeTexts").$type<string[]>(), // Array of up to 10 text annotations for negative points
  notes: text("notes"), // Private notes/comments (not visible to student)
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  unique("uq_prof_student_session").on(table.sessionId, table.studentId, table.professorUserId),
]);

export type ProfessorStudentNote = typeof professorStudentNotes.$inferSelect;
export type InsertProfessorStudentNote = typeof professorStudentNotes.$inferInsert;

// ─── Contact Tickets (bug reports and feature requests) ───
export const contactTickets = mysqlTable("contact_tickets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // The professor who submitted the ticket
  type: mysqlEnum("type", ["bug", "feature"]).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["open", "resolved"]).default("open").notNull(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContactTicket = typeof contactTickets.$inferSelect;
export type InsertContactTicket = typeof contactTickets.$inferInsert;

// ─── Session Access Tokens (individual token per student per session for direct access) ───
export const sessionAccessTokens = mysqlTable("session_access_tokens", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  studentId: int("studentId").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  unique("uq_session_student_token").on(table.sessionId, table.studentId),
]);

export type SessionAccessToken = typeof sessionAccessTokens.$inferSelect;
export type InsertSessionAccessToken = typeof sessionAccessTokens.$inferInsert;

// ─── Brainstorm Boards (digital whiteboard per session, filled by Mesa student) ───
export const brainstormBoards = mysqlTable("brainstorm_boards", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull().unique(), // One board per session
  mesaStudentId: int("mesaStudentId").notNull(), // The student with role MESA who edits
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrainstormBoard = typeof brainstormBoards.$inferSelect;
export type InsertBrainstormBoard = typeof brainstormBoards.$inferInsert;

// ─── Brainstorm Items (individual items in each section of the board) ───
export const brainstormItems = mysqlTable("brainstorm_items", {
  id: int("id").autoincrement().primaryKey(),
  boardId: int("boardId").notNull(), // References brainstormBoards.id
  section: mysqlEnum("section", ["ideias", "fatos", "questoes", "metas"]).notNull(),
  content: text("content").notNull(), // The text content of the item
  // Status depends on section:
  // ideias: analise, aceita, descartada
  // fatos: verificar, confirmado, inexato
  // questoes: duvida, investigacao, respondida
  // metas: planejada, em_andamento, concluida
  status: varchar("status", { length: 32 }).default("default").notNull(),
  attachmentUrl: varchar("attachmentUrl", { length: 1024 }), // Link to site, image, video, or uploaded photo
  attachmentType: mysqlEnum("attachmentType", ["link", "image", "video", "photo", "document"]), // Type of attachment
  sortOrder: int("sortOrder").default(0).notNull(), // For ordering items within a section
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrainstormItem = typeof brainstormItems.$inferSelect;
export type InsertBrainstormItem = typeof brainstormItems.$inferInsert;

// ─── Brainstorm Item Attachments (multiple attachments per item) ───
export const brainstormItemAttachments = mysqlTable("brainstorm_item_attachments", {
  id: int("id").autoincrement().primaryKey(),
  itemId: int("itemId").notNull(), // References brainstormItems.id
  url: varchar("url", { length: 1024 }).notNull(),
  type: mysqlEnum("type", ["link", "image", "video", "photo", "document"]).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BrainstormItemAttachment = typeof brainstormItemAttachments.$inferSelect;
export type InsertBrainstormItemAttachment = typeof brainstormItemAttachments.$inferInsert;
