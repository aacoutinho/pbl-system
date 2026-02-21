import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, unique } from "drizzle-orm/mysql-core";

// ─── Users (auth) ───
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  approvalStatus: mysqlEnum("approvalStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Professor Component Authorizations ───
export const professorComponents = mysqlTable("professor_components", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  componentCode: varchar("componentCode", { length: 32 }).notNull(), // Ex: TEC502
  authorizedAt: timestamp("authorizedAt").defaultNow().notNull(),
  authorizedByUserId: int("authorizedByUserId"),
}, (table) => [
  unique("uq_professor_component").on(table.userId, table.componentCode),
]);

export type ProfessorComponent = typeof professorComponents.$inferSelect;
export type InsertProfessorComponent = typeof professorComponents.$inferInsert;

// ─── Classes (turmas) ───
export const classes = mysqlTable("classes", {
  id: int("id").autoincrement().primaryKey(),
  classCode: varchar("classCode", { length: 32 }).notNull(), // Ex: TP01
  componentCode: varchar("componentCode", { length: 32 }).notNull(), // Ex: TEC502
  semester: varchar("semester", { length: 16 }).notNull(), // Ex: 20262
  professorUserId: int("professorUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Class = typeof classes.$inferSelect;
export type InsertClass = typeof classes.$inferInsert;

// ─── Students (registered in the course) ───
export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  enrollment: varchar("enrollment", { length: 32 }),
  classId: int("classId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  unique("uq_student_email_class").on(table.email, table.classId),
]);

export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;

// ─── Sessions (evaluation sessions: PxSy) ───
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(),
  problemNumber: int("problemNumber").notNull(),
  sessionNumber: int("sessionNumber").notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  accessCode: varchar("accessCode", { length: 8 }).unique(),
  status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
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
  atuacao: decimal("atuacao", { precision: 3, scale: 1 }).default("0").notNull(),
  pontualidade: decimal("pontualidade", { precision: 3, scale: 1 }).default("0").notNull(),
  dominio: decimal("dominio", { precision: 3, scale: 1 }).default("0").notNull(),
  metas: decimal("metas", { precision: 3, scale: 1 }).default("0").notNull(),
  participacao: decimal("participacao", { precision: 3, scale: 1 }).default("0").notNull(),
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
