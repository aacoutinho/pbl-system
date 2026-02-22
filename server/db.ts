import { eq, and, desc, inArray, sql, or, not } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  components, Component, InsertComponent,
  classes, InsertClass, Class,
  students, InsertStudent, Student,
  classStudents,
  sessions, InsertSession, Session,
  sessionStudents,
  evaluations,
  evaluationItems, EvaluationItem,
  tutorialEvaluations, TutorialEvaluation,
  professorComponents, InsertProfessorComponent,
  smtpConfig, InsertSmtpConfig,
  passwordResetCodes,
  classEvalPermissions,
  emailVerificationCodes,
  auditLogs,
  notifications,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User helpers ───
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) {
      values.role = 'coordinator';
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row;
}

export async function countUsers() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(users);
  return result[0]?.count ?? 0;
}

export async function createUserWithPassword(data: {
  email: string;
  name: string;
  passwordHash: string;
  role: "user" | "coordinator" | "admin" | "prof";
  approvalStatus: "pending" | "approved" | "rejected";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const openId = `local:${data.email}`;
  const [result] = await db.insert(users).values({
    openId,
    email: data.email,
    name: data.name,
    passwordHash: data.passwordHash,
    role: data.role,
    approvalStatus: data.approvalStatus,
    loginMethod: "email",
    lastSignedIn: new Date(),
  }).$returningId();
  return getUserById(result.id);
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function updateUserRole(userId: number, role: "user" | "coordinator" | "admin" | "prof") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ─── Admin helpers ───
export async function getAdmin() {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  return row;
}

export async function transferCoordination(fromUserId: number, toUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Demote current admin to prof
  await db.update(users).set({ role: "prof" }).where(eq(users.id, fromUserId));
  // Promote target to admin
  await db.update(users).set({ role: "admin" }).where(eq(users.id, toUserId));
  // Delete old admin's SMTP config
  await db.delete(smtpConfig).where(eq(smtpConfig.userId, fromUserId));
}

// ─── Professor Authorization helpers ───

export async function approveUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // When approving a user, set their role to "prof" and status to "approved"
  await db.update(users).set({ approvalStatus: "approved", role: "prof" }).where(eq(users.id, userId));
}

export async function rejectUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ approvalStatus: "rejected" }).where(eq(users.id, userId));
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Remove all professor component memberships
  await db.delete(professorComponents).where(eq(professorComponents.userId, userId));
  // Remove SMTP config if any
  await db.delete(smtpConfig).where(eq(smtpConfig.userId, userId));
  // Remove password reset codes
  await db.delete(passwordResetCodes).where(eq(passwordResetCodes.userId, userId));
  // Delete user
  await db.delete(users).where(eq(users.id, userId));
}

export async function listPendingProfessors() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.approvalStatus, "pending")).orderBy(desc(users.createdAt));
}

export async function listApprovedProfessors() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    approvalStatus: users.approvalStatus,
    createdAt: users.createdAt,
  }).from(users).where(
    and(eq(users.approvalStatus, "approved"), or(eq(users.role, "prof"), eq(users.role, "coordinator")))
  ).orderBy(users.name);
}

// ─── Professor Component Membership helpers ───

// Get user's approved component IDs
export async function getUserApprovedComponentIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ componentId: professorComponents.componentId })
    .from(professorComponents)
    .where(and(eq(professorComponents.userId, userId), eq(professorComponents.status, "approved")));
  return rows.map(r => r.componentId);
}

// Get user's role in a specific component
export async function getUserComponentRole(userId: number, componentId: number): Promise<"coordinator" | "prof" | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select({ componentRole: professorComponents.componentRole, status: professorComponents.status })
    .from(professorComponents)
    .where(and(eq(professorComponents.userId, userId), eq(professorComponents.componentId, componentId)))
    .limit(1);
  if (!row || row.status !== "approved") return null;
  return row.componentRole;
}

// Get all component memberships for a user (approved + pending)
export async function getUserComponents(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: professorComponents.id,
    userId: professorComponents.userId,
    componentId: professorComponents.componentId,
    componentRole: professorComponents.componentRole,
    status: professorComponents.status,
    authorizedAt: professorComponents.authorizedAt,
    authorizedByUserId: professorComponents.authorizedByUserId,
    componentCode: components.code,
    componentName: components.name,
  })
    .from(professorComponents)
    .leftJoin(components, eq(professorComponents.componentId, components.id))
    .where(eq(professorComponents.userId, userId))
    .orderBy(components.code);
}

// Request to join a component (creates pending entry)
export async function requestComponentMembership(userId: number, componentId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Check if already exists
  const [existing] = await db.select().from(professorComponents)
    .where(and(eq(professorComponents.userId, userId), eq(professorComponents.componentId, componentId)))
    .limit(1);
  if (existing) {
    if (existing.status === "approved") throw new Error("Já faz parte deste componente");
    throw new Error("Já existe uma solicitação pendente para este componente");
  }
  await db.insert(professorComponents).values({
    userId,
    componentId,
    componentRole: "prof",
    status: "pending",
  });
}

// List pending requests for a specific component
export async function listPendingRequestsByComponent(componentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: professorComponents.id,
    userId: professorComponents.userId,
    componentId: professorComponents.componentId,
    status: professorComponents.status,
    authorizedAt: professorComponents.authorizedAt,
    professorName: users.name,
    professorEmail: users.email,
    userCreatedAt: users.createdAt,
  })
    .from(professorComponents)
    .innerJoin(users, eq(professorComponents.userId, users.id))
    .where(and(eq(professorComponents.componentId, componentId), eq(professorComponents.status, "pending")))
    .orderBy(desc(professorComponents.authorizedAt));
}

// List pending requests for multiple components (for coordinators)
export async function listPendingRequestsByComponents(componentIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (componentIds.length === 0) return [];
  return db.select({
    id: professorComponents.id,
    userId: professorComponents.userId,
    componentId: professorComponents.componentId,
    componentCode: components.code,
    componentName: components.name,
    status: professorComponents.status,
    authorizedAt: professorComponents.authorizedAt,
    professorName: users.name,
    professorEmail: users.email,
    userCreatedAt: users.createdAt,
  })
    .from(professorComponents)
    .innerJoin(users, eq(professorComponents.userId, users.id))
    .leftJoin(components, eq(professorComponents.componentId, components.id))
    .where(and(inArray(professorComponents.componentId, componentIds), eq(professorComponents.status, "pending")))
    .orderBy(desc(professorComponents.authorizedAt));
}

// Approve a component membership request
export async function approveComponentRequest(userId: number, componentId: number, authorizedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(professorComponents).set({
    status: "approved",
    authorizedByUserId,
    authorizedAt: new Date(),
  }).where(and(eq(professorComponents.userId, userId), eq(professorComponents.componentId, componentId)));
}

// Reject (delete) a component membership request
export async function rejectComponentRequest(userId: number, componentId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(professorComponents).where(
    and(eq(professorComponents.userId, userId), eq(professorComponents.componentId, componentId))
  );
}

// Set component role (promote/demote within component)
export async function setComponentRole(userId: number, componentId: number, role: "coordinator" | "prof") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(professorComponents).set({ componentRole: role }).where(
    and(eq(professorComponents.userId, userId), eq(professorComponents.componentId, componentId))
  );
}

// Remove professor from component (not from system)
export async function removeProfessorFromComponent(userId: number, componentId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(professorComponents).where(
    and(eq(professorComponents.userId, userId), eq(professorComponents.componentId, componentId))
  );
}

// Add professor to component (directly approved, used by admin)
export async function addProfessorComponent(userId: number, componentId: number, authorizedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(professorComponents).values({
    userId,
    componentId,
    componentRole: "prof",
    status: "approved",
    authorizedByUserId,
  }).onDuplicateKeyUpdate({ set: { status: "approved", authorizedByUserId, authorizedAt: new Date() } });
}

// Legacy: removeProfessorComponent (alias)
export async function removeProfessorComponent(userId: number, componentId: number) {
  return removeProfessorFromComponent(userId, componentId);
}

export async function listProfessorComponents(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: professorComponents.id,
    userId: professorComponents.userId,
    componentId: professorComponents.componentId,
    componentRole: professorComponents.componentRole,
    status: professorComponents.status,
    authorizedAt: professorComponents.authorizedAt,
    authorizedByUserId: professorComponents.authorizedByUserId,
    componentCode: components.code,
    componentName: components.name,
  })
    .from(professorComponents)
    .leftJoin(components, eq(professorComponents.componentId, components.id))
    .where(eq(professorComponents.userId, userId));
}

export async function listAllProfessorComponents() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: professorComponents.id,
    userId: professorComponents.userId,
    componentId: professorComponents.componentId,
    componentRole: professorComponents.componentRole,
    status: professorComponents.status,
    componentCode: components.code,
    componentName: components.name,
    authorizedAt: professorComponents.authorizedAt,
    authorizedByUserId: professorComponents.authorizedByUserId,
    professorName: users.name,
    professorEmail: users.email,
  })
    .from(professorComponents)
    .innerJoin(users, eq(professorComponents.userId, users.id))
    .leftJoin(components, eq(professorComponents.componentId, components.id))
    .orderBy(components.code, users.name);
}

// Get component IDs where user is coordinator
export async function getCoordinatorComponentIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ componentId: professorComponents.componentId })
    .from(professorComponents)
    .where(and(
      eq(professorComponents.userId, userId),
      eq(professorComponents.componentRole, "coordinator"),
      eq(professorComponents.status, "approved"),
    ));
  return rows.map(r => r.componentId);
}

// ─── Class helpers ───
export async function createClass(data: { classCode: string; componentId: number; semester: string; professorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(classes).values(data).$returningId();
  return getClassById(result.id);
}

export async function getClassById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
  return row;
}

export async function listClassesByProfessor(professorUserId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: classes.id,
    classCode: classes.classCode,
    componentId: classes.componentId,
    semester: classes.semester,
    professorUserId: classes.professorUserId,
    createdAt: classes.createdAt,
    componentCode: components.code,
    componentName: components.name,
  })
    .from(classes)
    .leftJoin(components, eq(classes.componentId, components.id))
    .where(eq(classes.professorUserId, professorUserId))
    .orderBy(components.code, classes.classCode);
}

// List classes by component IDs (for coordinators/profs who belong to specific components)
export async function listClassesByComponents(componentIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (componentIds.length === 0) return [];
  return db.select({
    id: classes.id,
    classCode: classes.classCode,
    componentId: classes.componentId,
    semester: classes.semester,
    professorUserId: classes.professorUserId,
    createdAt: classes.createdAt,
    componentCode: components.code,
    componentName: components.name,
    professorName: users.name,
  })
    .from(classes)
    .leftJoin(components, eq(classes.componentId, components.id))
    .leftJoin(users, eq(classes.professorUserId, users.id))
    .where(inArray(classes.componentId, componentIds))
    .orderBy(components.code, classes.classCode);
}

// List ALL classes (for admin)
export async function listAllClasses() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: classes.id,
    classCode: classes.classCode,
    componentId: classes.componentId,
    componentCode: components.code,
    componentName: components.name,
    semester: classes.semester,
    professorUserId: classes.professorUserId,
    professorName: users.name,
    createdAt: classes.createdAt,
  })
    .from(classes)
    .leftJoin(users, eq(classes.professorUserId, users.id))
    .leftJoin(components, eq(classes.componentId, components.id))
    .orderBy(components.code, classes.classCode);
  return rows;
}

export async function updateClass(id: number, data: { classCode?: string; componentId?: number; semester?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateSet: Record<string, unknown> = {};
  if (data.classCode !== undefined) updateSet.classCode = data.classCode;
  if (data.componentId !== undefined) updateSet.componentId = data.componentId;
  if (data.semester !== undefined) updateSet.semester = data.semester;
  if (Object.keys(updateSet).length > 0) {
    await db.update(classes).set(updateSet).where(eq(classes.id, id));
  }
  return getClassById(id);
}

export async function deleteClass(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const classSessions = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.classId, id));
  if (classSessions.length > 0) {
    const sessionIds = classSessions.map(s => s.id);
    const evals = await db.select({ id: evaluations.id }).from(evaluations).where(inArray(evaluations.sessionId, sessionIds));
    if (evals.length > 0) {
      const evalIds = evals.map(e => e.id);
      await db.delete(evaluationItems).where(inArray(evaluationItems.evaluationId, evalIds));
      await db.delete(evaluations).where(inArray(evaluations.sessionId, sessionIds));
    }
    await db.delete(tutorialEvaluations).where(inArray(tutorialEvaluations.sessionId, sessionIds));
    await db.delete(sessionStudents).where(inArray(sessionStudents.sessionId, sessionIds));
    await db.delete(sessions).where(eq(sessions.classId, id));
  }
  await db.delete(classStudents).where(eq(classStudents.classId, id));
  await cleanupOrphanStudents();
  await db.delete(classes).where(eq(classes.id, id));
}

// ─── Student helpers ───

export async function getStudentByEnrollment(enrollment: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(students).where(eq(students.enrollment, enrollment)).limit(1);
  return row;
}

export async function getStudentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(students).where(eq(students.id, id)).limit(1);
  return row;
}

export async function createStudent(data: { name: string; enrollment: string; email?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const values: any = { name: data.name, enrollment: data.enrollment };
  if (data.email) values.email = data.email;
  await db.insert(students).values(values);
  return getStudentByEnrollment(data.enrollment);
}

export async function updateStudentEmail(studentId: number, email: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(students).set({ email }).where(eq(students.id, studentId));
}

export async function updateStudent(studentId: number, data: { name?: string; enrollment?: string; email?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateSet: Record<string, unknown> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.enrollment !== undefined) updateSet.enrollment = data.enrollment;
  if (data.email !== undefined) updateSet.email = data.email;
  if (Object.keys(updateSet).length > 0) {
    await db.update(students).set(updateSet).where(eq(students.id, studentId));
  }
  return getStudentById(studentId);
}

export async function listStudentsByClass(classId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: students.id,
    name: students.name,
    enrollment: students.enrollment,
    email: students.email,
    createdAt: students.createdAt,
  })
    .from(classStudents)
    .innerJoin(students, eq(classStudents.studentId, students.id))
    .where(eq(classStudents.classId, classId))
    .orderBy(students.name);
}

export async function addStudentToClass(studentId: number, classId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(classStudents).values({ studentId, classId }).onDuplicateKeyUpdate({ set: { studentId } });
}

export async function isStudentInComponentClass(studentId: number, componentId: number, excludeClassId?: number) {
  const db = await getDb();
  if (!db) return false;
  const links = await db.select({
    classId: classStudents.classId,
    componentId: classes.componentId,
  })
    .from(classStudents)
    .innerJoin(classes, eq(classStudents.classId, classes.id))
    .where(and(
      eq(classStudents.studentId, studentId),
      eq(classes.componentId, componentId),
    ));
  if (excludeClassId) {
    return links.some(l => l.classId !== excludeClassId);
  }
  return links.length > 0;
}

export async function removeStudentFromClass(studentId: number, classId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Remove student from future session participation lists (sessionStudents),
  // but preserve all evaluations and evaluation items for historical records.
  const classSessions = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.classId, classId));
  if (classSessions.length > 0) {
    const sessionIds = classSessions.map(s => s.id);
    await db.delete(sessionStudents).where(
      and(eq(sessionStudents.studentId, studentId), inArray(sessionStudents.sessionId, sessionIds))
    );
  }
  // Remove class-student link
  await db.delete(classStudents).where(and(eq(classStudents.studentId, studentId), eq(classStudents.classId, classId)));
  // Note: student record and all evaluations are preserved regardless of remaining class memberships.
}

export async function transferStudentBetweenClasses(studentId: number, fromClassId: number, toClassId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Remove student from source class sessions
  const fromSessions = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.classId, fromClassId));
  if (fromSessions.length > 0) {
    const sessionIds = fromSessions.map(s => s.id);
    await db.delete(sessionStudents).where(
      and(eq(sessionStudents.studentId, studentId), inArray(sessionStudents.sessionId, sessionIds))
    );
  }
  // Remove from source class
  await db.delete(classStudents).where(and(eq(classStudents.studentId, studentId), eq(classStudents.classId, fromClassId)));
  // Add to destination class
  await db.insert(classStudents).values({ studentId, classId: toClassId }).onDuplicateKeyUpdate({ set: { studentId } });
}

async function cleanupOrphanStudents() {
  const db = await getDb();
  if (!db) return;
  const allStudents = await db.select({ id: students.id }).from(students);
  for (const s of allStudents) {
    const links = await db.select({ id: classStudents.id }).from(classStudents).where(eq(classStudents.studentId, s.id));
    if (links.length === 0) {
      const evals = await db.select({ id: evaluations.id }).from(evaluations).where(eq(evaluations.evaluatorStudentId, s.id));
      if (evals.length > 0) {
        const evalIds = evals.map(e => e.id);
        await db.delete(evaluationItems).where(inArray(evaluationItems.evaluationId, evalIds));
        await db.delete(evaluations).where(eq(evaluations.evaluatorStudentId, s.id));
      }
      await db.delete(evaluationItems).where(eq(evaluationItems.evaluatedStudentId, s.id));
      await db.delete(students).where(eq(students.id, s.id));
    }
  }
}

export async function bulkImportStudents(data: { name: string; enrollment: string; classId: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (data.length === 0) return [];
  
  const cls = await getClassById(data[0].classId);
  if (!cls) throw new Error("Class not found");
  
  const results: { name: string; enrollment: string; status: "created" | "linked" | "already_in_class" | "conflict" }[] = [];
  
  for (const s of data) {
    const existing = await getStudentByEnrollment(s.enrollment);
    
    if (existing) {
      const link = await db.select().from(classStudents)
        .where(and(eq(classStudents.studentId, existing.id), eq(classStudents.classId, s.classId)))
        .limit(1);
      
      if (link.length > 0) {
        if (existing.name !== s.name) {
          await db.update(students).set({ name: s.name }).where(eq(students.id, existing.id));
        }
        results.push({ name: s.name, enrollment: s.enrollment, status: "already_in_class" });
        continue;
      }
      
      const inComponent = await isStudentInComponentClass(existing.id, cls.componentId, s.classId);
      if (inComponent) {
        results.push({ name: s.name, enrollment: s.enrollment, status: "conflict" });
        continue;
      }
      
      await addStudentToClass(existing.id, s.classId);
      if (existing.name !== s.name) {
        await db.update(students).set({ name: s.name }).where(eq(students.id, existing.id));
      }
      results.push({ name: s.name, enrollment: s.enrollment, status: "linked" });
    } else {
      const newStudent = await createStudent({ name: s.name, enrollment: s.enrollment });
      if (newStudent) {
        await addStudentToClass(newStudent.id, s.classId);
        results.push({ name: s.name, enrollment: s.enrollment, status: "created" });
      }
    }
  }
  
  return results;
}

// ─── Session helpers ───
export async function createSession(data: { classId: number; problemNumber: number; sessionNumber: number; label: string; studentIds: number[]; status?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(sessions).values({
    classId: data.classId,
    problemNumber: data.problemNumber,
    sessionNumber: data.sessionNumber,
    label: data.label,
    status: (data.status as "open" | "closed") ?? "open",
  }).$returningId();
  const sessionId = result.id;
  if (data.studentIds.length > 0) {
    await db.insert(sessionStudents).values(
      data.studentIds.map(sid => ({ sessionId, studentId: sid }))
    );
  }
  return getSessionById(sessionId);
}

export async function getSessionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return row;
}

export async function listSessionsByClass(classId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessions).where(eq(sessions.classId, classId)).orderBy(desc(sessions.createdAt));
}

export async function getSessionStudents(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    studentId: sessionStudents.studentId,
    studentName: students.name,
    studentEmail: students.email,
    studentEnrollment: students.enrollment,
  })
    .from(sessionStudents)
    .innerJoin(students, eq(sessionStudents.studentId, students.id))
    .where(eq(sessionStudents.sessionId, sessionId))
    .orderBy(students.name);
  return rows;
}

export async function closeSession(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(sessions).set({ status: "closed", closedAt: new Date() }).where(eq(sessions.id, id));
}

export async function openSession(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(sessions).set({ status: "open", closedAt: null }).where(eq(sessions.id, id));
}

export async function deleteSession(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const evals = await db.select({ id: evaluations.id }).from(evaluations).where(eq(evaluations.sessionId, id));
  if (evals.length > 0) {
    const evalIds = evals.map(e => e.id);
    await db.delete(evaluationItems).where(inArray(evaluationItems.evaluationId, evalIds));
    await db.delete(evaluations).where(eq(evaluations.sessionId, id));
  }
  await db.delete(tutorialEvaluations).where(eq(tutorialEvaluations.sessionId, id));
  await db.delete(sessionStudents).where(eq(sessionStudents.sessionId, id));
  await db.delete(sessions).where(eq(sessions.id, id));
}

// ─── Evaluation helpers ───
export async function submitEvaluation(data: {
  sessionId: number;
  evaluatorStudentId: number;
  items: Array<{
    evaluatedStudentId: number;
    role: "COORDENADOR" | "MESA" | "QUADRO" | "PARTICIPANTE";
    absent: boolean;
    atuacao: number;
    pontualidade: number;
    dominio: number;
    metas: number;
    participacao: number;
  }>;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existing = await db.select().from(evaluations)
    .where(and(eq(evaluations.sessionId, data.sessionId), eq(evaluations.evaluatorStudentId, data.evaluatorStudentId)))
    .limit(1);
  if (existing.length > 0) {
    await db.delete(evaluationItems).where(eq(evaluationItems.evaluationId, existing[0].id));
    await db.delete(evaluations).where(eq(evaluations.id, existing[0].id));
  }

  const [result] = await db.insert(evaluations).values({
    sessionId: data.sessionId,
    evaluatorStudentId: data.evaluatorStudentId,
  }).$returningId();
  const evaluationId = result.id;

  if (data.items.length > 0) {
    await db.insert(evaluationItems).values(
      data.items.map(item => ({
        evaluationId,
        evaluatedStudentId: item.evaluatedStudentId,
        role: item.role,
        absent: item.absent,
        atuacao: String(item.atuacao),
        pontualidade: String(item.pontualidade),
        dominio: String(item.dominio),
        metas: String(item.metas),
        participacao: String(item.participacao),
      }))
    );
  }
  return evaluationId;
}

export async function getSessionEvaluations(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(evaluations).where(eq(evaluations.sessionId, sessionId));
}

export async function getEvaluationItems(evaluationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(evaluationItems).where(eq(evaluationItems.evaluationId, evaluationId));
}

export async function hasStudentSubmitted(sessionId: number, studentId: number) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(evaluations)
    .where(and(eq(evaluations.sessionId, sessionId), eq(evaluations.evaluatorStudentId, studentId)))
    .limit(1);
  return rows.length > 0;
}

export async function deleteStudentEvaluation(sessionId: number, studentId: number) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(evaluations)
    .where(and(eq(evaluations.sessionId, sessionId), eq(evaluations.evaluatorStudentId, studentId)))
    .limit(1);
  if (rows.length === 0) return false;
  const evaluationId = rows[0].id;
  await db.delete(evaluationItems).where(eq(evaluationItems.evaluationId, evaluationId));
  await db.delete(evaluations).where(eq(evaluations.id, evaluationId));
  return true;
}

// ─── Calculation engine ───
export interface SessionResult {
  studentId: number;
  studentName: string;
  studentEmail: string | null;
  studentEnrollment: string;
  role: string;
  totalScore: number;
  validEvaluations: number;
  absent: boolean;
}

export async function calculateSessionResults(sessionId: number): Promise<SessionResult[]> {
  const db = await getDb();
  if (!db) return [];

  const sessionStudentsList = await getSessionStudents(sessionId);
  const evals = await db.select().from(evaluations).where(eq(evaluations.sessionId, sessionId));

  if (evals.length === 0) return sessionStudentsList.map(s => ({
    studentId: s.studentId,
    studentName: s.studentName,
    studentEmail: s.studentEmail,
    studentEnrollment: s.studentEnrollment,
    role: "PARTICIPANTE",
    totalScore: 0,
    validEvaluations: 0,
    absent: false,
  }));

  const evalIds = evals.map(e => e.id);
  const allItems = await db.select({
    evaluationId: evaluationItems.evaluationId,
    evaluatedStudentId: evaluationItems.evaluatedStudentId,
    role: evaluationItems.role,
    absent: evaluationItems.absent,
    atuacao: evaluationItems.atuacao,
    pontualidade: evaluationItems.pontualidade,
    dominio: evaluationItems.dominio,
    metas: evaluationItems.metas,
    participacao: evaluationItems.participacao,
  }).from(evaluationItems).where(inArray(evaluationItems.evaluationId, evalIds));

  const evalToEvaluator = new Map<number, number>();
  for (const e of evals) evalToEvaluator.set(e.id, e.evaluatorStudentId);

  const roleCounts: Record<number, Record<string, number>> = {};
  for (const item of allItems) {
    const evaluatorId = evalToEvaluator.get(item.evaluationId);
    if (evaluatorId === item.evaluatedStudentId) continue;
    if (!roleCounts[item.evaluatedStudentId]) roleCounts[item.evaluatedStudentId] = {};
    const r = item.role;
    roleCounts[item.evaluatedStudentId][r] = (roleCounts[item.evaluatedStudentId][r] || 0) + 1;
  }

  const exclusiveRoles = ["COORDENADOR", "MESA", "QUADRO"] as const;
  const assignedRoles: Record<number, string> = {};
  const usedRoles = new Set<string>();

  for (const role of exclusiveRoles) {
    let bestStudent = -1;
    let bestCount = 0;
    for (const [sidStr, counts] of Object.entries(roleCounts)) {
      const sid = parseInt(sidStr);
      if (usedRoles.has(role)) break;
      if (assignedRoles[sid]) continue;
      const c = counts[role] || 0;
      if (c > bestCount) { bestCount = c; bestStudent = sid; }
    }
    if (bestStudent >= 0 && bestCount > 0) {
      assignedRoles[bestStudent] = role;
      usedRoles.add(role);
    }
  }

  const results: SessionResult[] = [];
  for (const s of sessionStudentsList) {
    const itemsForStudent = allItems.filter(i => {
      const evaluatorId = evalToEvaluator.get(i.evaluationId);
      return i.evaluatedStudentId === s.studentId && evaluatorId !== s.studentId;
    });

    const absentCount = itemsForStudent.filter(i => i.absent).length;
    const presentCount = itemsForStudent.filter(i => !i.absent).length;
    const isAbsent = itemsForStudent.length > 0 && absentCount > presentCount;

    if (isAbsent || itemsForStudent.length === 0) {
      results.push({
        studentId: s.studentId,
        studentName: s.studentName,
        studentEmail: s.studentEmail,
        studentEnrollment: s.studentEnrollment,
        role: isAbsent ? "FALTOU" : (assignedRoles[s.studentId] || "PARTICIPANTE"),
        totalScore: 0,
        validEvaluations: 0,
        absent: isAbsent,
      });
      continue;
    }

    const validItems = itemsForStudent.filter(i => !i.absent);
    let sumScores = 0;
    for (const item of validItems) {
      const score = Number(item.atuacao) + Number(item.pontualidade) + Number(item.dominio) + Number(item.metas) + Number(item.participacao);
      sumScores += score;
    }
    const avg = validItems.length > 0 ? sumScores / validItems.length : 0;

    results.push({
      studentId: s.studentId,
      studentName: s.studentName,
      studentEmail: s.studentEmail,
      studentEnrollment: s.studentEnrollment,
      role: assignedRoles[s.studentId] || "PARTICIPANTE",
      totalScore: Math.round(avg * 100) / 100,
      validEvaluations: validItems.length,
      absent: false,
    });
  }

  return results.sort((a, b) => b.totalScore - a.totalScore);
}

export async function calculateProblemResults(classId: number, problemNumber: number) {
  const db = await getDb();
  if (!db) return [];
  const problemSessions = await db.select().from(sessions)
    .where(and(eq(sessions.classId, classId), eq(sessions.problemNumber, problemNumber)));
  if (problemSessions.length === 0) return [];

  const allResults: Record<number, { name: string; email: string | null; enrollment: string; scores: number[]; roles: string[] }> = {};
  for (const sess of problemSessions) {
    const results = await calculateSessionResults(sess.id);
    for (const r of results) {
      if (!allResults[r.studentId]) {
        allResults[r.studentId] = { name: r.studentName, email: r.studentEmail, enrollment: r.studentEnrollment, scores: [], roles: [] };
      }
      allResults[r.studentId].scores.push(r.totalScore);
      allResults[r.studentId].roles.push(r.role);
    }
  }

  return Object.entries(allResults).map(([id, data]) => {
    const avg = data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0;
    return {
      studentId: parseInt(id),
      studentName: data.name,
      studentEmail: data.email,
      studentEnrollment: data.enrollment,
      sessionScores: data.scores,
      roles: data.roles,
      average: Math.round(avg * 100) / 100,
    };
  }).sort((a, b) => b.average - a.average);
}

// ─── Tutorial Evaluation helpers ───
export async function submitTutorialEvaluation(data: {
  sessionId: number;
  professorUserId: number;
  organizacao: number;
  cooperacao: number;
  conteudo: number;
  objetivo: number;
  metas: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existing = await db.select().from(tutorialEvaluations)
    .where(eq(tutorialEvaluations.sessionId, data.sessionId))
    .limit(1);

  if (existing.length > 0) {
    await db.update(tutorialEvaluations).set({
      organizacao: String(data.organizacao),
      cooperacao: String(data.cooperacao),
      conteudo: String(data.conteudo),
      objetivo: String(data.objetivo),
      metas: String(data.metas),
      submittedAt: new Date(),
    }).where(eq(tutorialEvaluations.id, existing[0].id));
    return existing[0].id;
  }

  const [result] = await db.insert(tutorialEvaluations).values({
    sessionId: data.sessionId,
    professorUserId: data.professorUserId,
    organizacao: String(data.organizacao),
    cooperacao: String(data.cooperacao),
    conteudo: String(data.conteudo),
    objetivo: String(data.objetivo),
    metas: String(data.metas),
  }).$returningId();
  return result.id;
}

export async function getTutorialEvaluation(sessionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(tutorialEvaluations)
    .where(eq(tutorialEvaluations.sessionId, sessionId))
    .limit(1);
  return row;
}

export function calculateTutorialGrade(eval_: { organizacao: string; cooperacao: string; conteudo: string; objetivo: string; metas: string }): number {
  const org = Number(eval_.organizacao);
  const coop = Number(eval_.cooperacao);
  const cont = Number(eval_.conteudo);
  const obj = Number(eval_.objetivo);
  const met = Number(eval_.metas);
  return org * 1 + coop * 1 + cont * 3 + obj * 3 + met * 2;
}

// ─── Final grade calculation ───
export interface FinalGradeResult {
  studentId: number;
  studentName: string;
  studentEmail: string | null;
  studentEnrollment: string;
  role: string;
  peerScore: number;
  finalGrade: number;
  absent: boolean;
  validEvaluations: number;
}

export async function calculateFinalGrades(sessionId: number): Promise<FinalGradeResult[]> {
  const peerResults = await calculateSessionResults(sessionId);
  const tutorialEval = await getTutorialEvaluation(sessionId);

  if (!tutorialEval) {
    return peerResults.map(r => ({
      studentId: r.studentId,
      studentName: r.studentName,
      studentEmail: r.studentEmail,
      studentEnrollment: r.studentEnrollment,
      role: r.role,
      peerScore: Math.round(r.totalScore * 10) / 10,
      finalGrade: 0,
      absent: r.absent,
      validEvaluations: r.validEvaluations,
    }));
  }

  const tutorialGrade = calculateTutorialGrade(tutorialEval);
  const presentStudents = peerResults.filter(r => !r.absent && r.totalScore > 0);
  const numPresent = presentStudents.length;
  const totalPoints = tutorialGrade * numPresent;
  const sumPeerScores = presentStudents.reduce((sum, r) => sum + r.totalScore, 0);

  return peerResults.map(r => {
    if (r.absent || r.totalScore === 0) {
      return {
        studentId: r.studentId,
        studentName: r.studentName,
        studentEmail: r.studentEmail,
        studentEnrollment: r.studentEnrollment,
        role: r.role,
        peerScore: 0,
        finalGrade: 0,
        absent: r.absent,
        validEvaluations: r.validEvaluations,
      };
    }

    const proportion = r.totalScore / sumPeerScores;
    const finalGrade = sumPeerScores > 0 ? Math.round(proportion * totalPoints * 10) / 10 : 0;

    return {
      studentId: r.studentId,
      studentName: r.studentName,
      studentEmail: r.studentEmail,
      studentEnrollment: r.studentEnrollment,
      role: r.role,
      peerScore: Math.round(r.totalScore * 10) / 10,
      finalGrade,
      absent: r.absent,
      validEvaluations: r.validEvaluations,
    };
  }).sort((a, b) => b.finalGrade - a.finalGrade);
}

export async function calculateProblemFinalGrades(classId: number, problemNumber: number) {
  const db = await getDb();
  if (!db) return [];
  const problemSessions = await db.select().from(sessions)
    .where(and(eq(sessions.classId, classId), eq(sessions.problemNumber, problemNumber)));
  if (problemSessions.length === 0) return [];

  const allResults: Record<number, {
    name: string; email: string | null; enrollment: string;
    peerScores: number[]; finalGrades: number[]; roles: string[];
  }> = {};

  for (const sess of problemSessions) {
    const results = await calculateFinalGrades(sess.id);
    for (const r of results) {
      if (!allResults[r.studentId]) {
        allResults[r.studentId] = { name: r.studentName, email: r.studentEmail, enrollment: r.studentEnrollment, peerScores: [], finalGrades: [], roles: [] };
      }
      allResults[r.studentId].peerScores.push(r.peerScore);
      allResults[r.studentId].finalGrades.push(r.finalGrade);
      allResults[r.studentId].roles.push(r.role);
    }
  }

  return Object.entries(allResults).map(([id, data]) => {
    const peerAvg = data.peerScores.length > 0 ? data.peerScores.reduce((a, b) => a + b, 0) / data.peerScores.length : 0;
    const finalAvg = data.finalGrades.length > 0 ? data.finalGrades.reduce((a, b) => a + b, 0) / data.finalGrades.length : 0;
    return {
      studentId: parseInt(id),
      studentName: data.name,
      studentEmail: data.email,
      studentEnrollment: data.enrollment,
      peerScores: data.peerScores,
      finalGrades: data.finalGrades,
      roles: data.roles,
      peerAverage: Math.round(peerAvg * 10) / 10,
      finalAverage: Math.round(finalAvg * 10) / 10,
    };
  }).sort((a, b) => b.finalAverage - a.finalAverage);
}

// ─── Export helpers ───
export async function listStudentsForExport(classIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (classIds.length === 0) return [];
  const rows = await db.select({
    studentName: students.name,
    studentEmail: students.email,
    studentEnrollment: students.enrollment,
    classCode: classes.classCode,
    componentCode: components.code,
    semester: classes.semester,
  })
    .from(classStudents)
    .innerJoin(students, eq(classStudents.studentId, students.id))
    .innerJoin(classes, eq(classStudents.classId, classes.id))
    .leftJoin(components, eq(classes.componentId, components.id))
    .where(inArray(classStudents.classId, classIds))
    .orderBy(students.name);
  return rows;
}

// ─── Dashboard stats ───
export async function getDashboardStats(professorUserId: number) {
  const db = await getDb();
  if (!db) return { totalStudents: 0, totalSessions: 0, openSessions: 0, totalEvaluations: 0, totalClasses: 0 };

  const professorClasses = await db.select({ id: classes.id }).from(classes).where(eq(classes.professorUserId, professorUserId));
  if (professorClasses.length === 0) return { totalStudents: 0, totalSessions: 0, openSessions: 0, totalEvaluations: 0, totalClasses: 0 };

  const classIds = professorClasses.map(c => c.id);

  const [studentCount] = await db.select({ count: sql<number>`count(DISTINCT ${classStudents.studentId})` }).from(classStudents).where(inArray(classStudents.classId, classIds));
  const [sessionCount] = await db.select({ count: sql<number>`count(*)` }).from(sessions).where(inArray(sessions.classId, classIds));
  const [openCount] = await db.select({ count: sql<number>`count(*)` }).from(sessions).where(and(inArray(sessions.classId, classIds), eq(sessions.status, "open")));

  const classSessions = await db.select({ id: sessions.id }).from(sessions).where(inArray(sessions.classId, classIds));
  let evalCount = 0;
  if (classSessions.length > 0) {
    const sessionIds = classSessions.map(s => s.id);
    const [ec] = await db.select({ count: sql<number>`count(*)` }).from(evaluations).where(inArray(evaluations.sessionId, sessionIds));
    evalCount = Number(ec.count);
  }

  return {
    totalStudents: Number(studentCount.count),
    totalSessions: Number(sessionCount.count),
    openSessions: Number(openCount.count),
    totalEvaluations: evalCount,
    totalClasses: professorClasses.length,
  };
}

// Dashboard stats scoped by component IDs
export async function getDashboardStatsByComponents(componentIds: number[]) {
  const db = await getDb();
  if (!db) return { totalStudents: 0, totalSessions: 0, openSessions: 0, totalEvaluations: 0, totalClasses: 0 };
  if (componentIds.length === 0) return { totalStudents: 0, totalSessions: 0, openSessions: 0, totalEvaluations: 0, totalClasses: 0 };

  const componentClasses = await db.select({ id: classes.id }).from(classes).where(inArray(classes.componentId, componentIds));
  if (componentClasses.length === 0) return { totalStudents: 0, totalSessions: 0, openSessions: 0, totalEvaluations: 0, totalClasses: 0 };

  const classIds = componentClasses.map(c => c.id);

  const [studentCount] = await db.select({ count: sql<number>`count(DISTINCT ${classStudents.studentId})` }).from(classStudents).where(inArray(classStudents.classId, classIds));
  const [sessionCount] = await db.select({ count: sql<number>`count(*)` }).from(sessions).where(inArray(sessions.classId, classIds));
  const [openCount] = await db.select({ count: sql<number>`count(*)` }).from(sessions).where(and(inArray(sessions.classId, classIds), eq(sessions.status, "open")));

  const classSessions = await db.select({ id: sessions.id }).from(sessions).where(inArray(sessions.classId, classIds));
  let evalCount = 0;
  if (classSessions.length > 0) {
    const sessionIds = classSessions.map(s => s.id);
    const [ec] = await db.select({ count: sql<number>`count(*)` }).from(evaluations).where(inArray(evaluations.sessionId, sessionIds));
    evalCount = Number(ec.count);
  }

  return {
    totalStudents: Number(studentCount.count),
    totalSessions: Number(sessionCount.count),
    openSessions: Number(openCount.count),
    totalEvaluations: evalCount,
    totalClasses: componentClasses.length,
  };
}

// ─── Session access code helpers ───
export async function generateAccessCode(sessionId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  await db.update(sessions).set({ accessCode: code }).where(eq(sessions.id, sessionId));
  return code;
}

export async function getSessionByAccessCode(accessCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(sessions).where(eq(sessions.accessCode, accessCode.toUpperCase())).limit(1);
  return row;
}

export async function findStudentByEnrollmentInClass(enrollment: string, classId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({
    id: students.id,
    name: students.name,
    enrollment: students.enrollment,
    email: students.email,
  })
    .from(classStudents)
    .innerJoin(students, eq(classStudents.studentId, students.id))
    .where(and(eq(classStudents.classId, classId), eq(students.enrollment, enrollment)))
    .limit(1);
  return rows.length > 0 ? rows[0] : undefined;
}

// ─── SMTP Config helpers ───
export async function getSmtpConfig(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(smtpConfig).where(eq(smtpConfig.userId, userId)).limit(1);
  return row;
}

export async function getActiveSmtpConfig() {
  const db = await getDb();
  if (!db) return undefined;
  // Get the admin's SMTP config
  const admin = await getAdmin();
  if (!admin) return undefined;
  const [row] = await db.select().from(smtpConfig)
    .where(and(eq(smtpConfig.userId, admin.id), eq(smtpConfig.configured, true)))
    .limit(1);
  return row;
}

export async function upsertSmtpConfig(data: {
  userId: number;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getSmtpConfig(data.userId);
  if (existing) {
    await db.update(smtpConfig).set({
      host: data.host,
      port: data.port,
      secure: data.secure,
      username: data.username,
      password: data.password,
      fromEmail: data.fromEmail,
      fromName: data.fromName,
      configured: true,
    }).where(eq(smtpConfig.userId, data.userId));
  } else {
    await db.insert(smtpConfig).values({
      userId: data.userId,
      host: data.host,
      port: data.port,
      secure: data.secure,
      username: data.username,
      password: data.password,
      fromEmail: data.fromEmail,
      fromName: data.fromName,
      configured: true,
    });
  }
}

export async function deleteSmtpConfig(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(smtpConfig).where(eq(smtpConfig.userId, userId));
}

// ─── Password Reset Code helpers ───
export async function createPasswordResetCode(userId: number, code: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(passwordResetCodes)
    .set({ used: true })
    .where(and(eq(passwordResetCodes.userId, userId), eq(passwordResetCodes.used, false)));
  await db.insert(passwordResetCodes).values({ userId, code, expiresAt });
}

export async function verifyPasswordResetCode(userId: number, code: string) {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db.select().from(passwordResetCodes)
    .where(and(
      eq(passwordResetCodes.userId, userId),
      eq(passwordResetCodes.code, code),
      eq(passwordResetCodes.used, false),
    ))
    .limit(1);
  if (!row) return false;
  if (new Date() > row.expiresAt) return false;
  return true;
}

export async function markResetCodeUsed(userId: number, code: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(passwordResetCodes)
    .set({ used: true })
    .where(and(
      eq(passwordResetCodes.userId, userId),
      eq(passwordResetCodes.code, code),
    ));
}

export async function isSmtpConfigured() {
  const config = await getActiveSmtpConfig();
  return !!config;
}

// ─── Component CRUD helpers ───
export async function createComponent(data: { code: string; name: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(components).values({
    code: data.code.toUpperCase(),
    name: data.name,
  }).$returningId();
  return getComponentById(result.id);
}

export async function getComponentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(components).where(eq(components.id, id)).limit(1);
  return row;
}

export async function getComponentByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(components).where(eq(components.code, code.toUpperCase())).limit(1);
  return row;
}

export async function listComponents() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(components).orderBy(components.code);
}

export async function updateComponent(id: number, data: { code?: string; name?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateSet: Record<string, unknown> = {};
  if (data.code !== undefined) updateSet.code = data.code.toUpperCase();
  if (data.name !== undefined) updateSet.name = data.name;
  if (Object.keys(updateSet).length > 0) {
    await db.update(components).set(updateSet).where(eq(components.id, id));
  }
  return getComponentById(id);
}

export async function deleteComponent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const classesUsingComponent = await db.select({ id: classes.id }).from(classes).where(eq(classes.componentId, id));
  if (classesUsingComponent.length > 0) {
    throw new Error("Componente está sendo usado por turmas e não pode ser excluído");
  }
  // Also remove professor component memberships
  await db.delete(professorComponents).where(eq(professorComponents.componentId, id));
  await db.delete(components).where(eq(components.id, id));
}


// ─── Class Evaluation Permissions ───

// Grant a professor permission to evaluate sessions of a class
export async function grantEvalPermission(classId: number, authorizedUserId: number, grantedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(classEvalPermissions).values({ classId, authorizedUserId, grantedByUserId });
}

// Revoke a professor's permission to evaluate sessions of a class
export async function revokeEvalPermission(classId: number, authorizedUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(classEvalPermissions).where(
    and(eq(classEvalPermissions.classId, classId), eq(classEvalPermissions.authorizedUserId, authorizedUserId))
  );
}

// Check if a professor has permission to evaluate sessions of a class
export async function hasEvalPermission(classId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: classEvalPermissions.id })
    .from(classEvalPermissions)
    .where(and(eq(classEvalPermissions.classId, classId), eq(classEvalPermissions.authorizedUserId, userId)))
    .limit(1);
  return rows.length > 0;
}

// List all professors authorized to evaluate sessions of a class
export async function listEvalPermissions(classId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: classEvalPermissions.id,
    classId: classEvalPermissions.classId,
    authorizedUserId: classEvalPermissions.authorizedUserId,
    grantedByUserId: classEvalPermissions.grantedByUserId,
    grantedAt: classEvalPermissions.grantedAt,
    authorizedUserName: users.name,
    authorizedUserEmail: users.email,
  })
    .from(classEvalPermissions)
    .innerJoin(users, eq(classEvalPermissions.authorizedUserId, users.id))
    .where(eq(classEvalPermissions.classId, classId));
  return rows;
}

// List professors in the same component as a class (potential candidates for eval permission)
export async function listComponentProfessorsForClass(classId: number) {
  const db = await getDb();
  if (!db) return [];
  const cls = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
  if (cls.length === 0) return [];
  const componentId = cls[0].componentId;
  const classOwnerUserId = cls[0].professorUserId;
  // Get all approved professors in this component except the class owner
  const rows = await db.select({
    userId: professorComponents.userId,
    componentRole: professorComponents.componentRole,
    userName: users.name,
    userEmail: users.email,
  })
    .from(professorComponents)
    .innerJoin(users, eq(professorComponents.userId, users.id))
    .where(and(
      eq(professorComponents.componentId, componentId),
      eq(professorComponents.status, "approved"),
      not(eq(professorComponents.userId, classOwnerUserId)),
    ));
  return rows;
}

// ─── Email Verification Codes ───

export async function createEmailVerificationCode(email: string, code: string, expiresAt: Date) {
  const db = (await getDb())!;
  // Invalidate any previous codes for this email
  await db.update(emailVerificationCodes)
    .set({ used: true })
    .where(and(eq(emailVerificationCodes.email, email), eq(emailVerificationCodes.used, false)));
  // Create new code
  await db.insert(emailVerificationCodes).values({ email, code, expiresAt });
}

export async function verifyEmailCode(email: string, code: string): Promise<boolean> {
  const db = (await getDb())!;
  const [record] = await db.select().from(emailVerificationCodes)
    .where(and(
      eq(emailVerificationCodes.email, email),
      eq(emailVerificationCodes.code, code),
      eq(emailVerificationCodes.used, false),
    ))
    .limit(1);
  if (!record) return false;
  if (record.expiresAt < new Date()) return false;
  // Mark as used
  await db.update(emailVerificationCodes)
    .set({ used: true })
    .where(eq(emailVerificationCodes.id, record.id));
  return true;
}


// ─── Get coordinators of a component (for notifications) ───
export async function getComponentCoordinators(componentId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    userId: professorComponents.userId,
    userName: users.name,
    userEmail: users.email,
  })
    .from(professorComponents)
    .innerJoin(users, eq(professorComponents.userId, users.id))
    .where(and(
      eq(professorComponents.componentId, componentId),
      eq(professorComponents.componentRole, "coordinator"),
      eq(professorComponents.status, "approved"),
    ));
  return rows;
}


// ─── Audit Log helpers ───
export async function createAuditLog(data: {
  action: string;
  actorUserId: number;
  targetUserId?: number | null;
  componentId?: number | null;
  classId?: number | null;
  details?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(auditLogs).values({
      action: data.action,
      actorUserId: data.actorUserId,
      targetUserId: data.targetUserId ?? null,
      componentId: data.componentId ?? null,
      classId: data.classId ?? null,
      details: data.details ?? null,
    });
  } catch (err) {
    console.error("[AuditLog] Failed to create audit log:", err);
  }
}

export async function listAuditLogs(opts: {
  limit?: number;
  offset?: number;
  componentIds?: number[];
}) {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const conditions = [];
  if (opts.componentIds && opts.componentIds.length > 0) {
    conditions.push(inArray(auditLogs.componentId, opts.componentIds));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db.select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(whereClause);

  const rows = await db.select({
    id: auditLogs.id,
    action: auditLogs.action,
    actorUserId: auditLogs.actorUserId,
    targetUserId: auditLogs.targetUserId,
    componentId: auditLogs.componentId,
    classId: auditLogs.classId,
    details: auditLogs.details,
    createdAt: auditLogs.createdAt,
    actorName: users.name,
    actorEmail: users.email,
  })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return { logs: rows, total: Number(countResult.count) };
}


// ─── Notification helpers ───
export async function createNotification(data: {
  userId: number;
  type: string;
  title: string;
  message: string;
  metadata?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(notifications).values({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      metadata: data.metadata ?? null,
    });
  } catch (err) {
    console.error("[Notification] Failed to create notification:", err);
  }
}

export async function listNotifications(userId: number, opts: { limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const [countResult] = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(eq(notifications.userId, userId));

  const items = await db.select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  return { items, total: Number(countResult.count) };
}

export async function countUnreadNotifications(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return Number(result.count);
}

export async function markNotificationAsRead(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllNotificationsAsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
}

// ─── Peer Grades Matrix (notas individuais dos pares) ───
export interface PeerGradeDetail {
  evaluatorStudentId: number;
  evaluatorSerial: number;
  score: number; // soma dos 5 critérios
  absent: boolean;
}

export interface PeerGradesMatrixRow {
  serial: number;
  studentId: number;
  studentName: string;
  studentEnrollment: string;
  peerGrades: PeerGradeDetail[]; // uma entrada por avaliador (excluindo autoavaliação)
  peerAverage: number;
  absent: boolean;
}

export async function getPeerGradesMatrix(sessionId: number): Promise<{
  evaluators: { studentId: number; serial: number; name: string; enrollment: string }[];
  rows: PeerGradesMatrixRow[];
}> {
  const db = await getDb();
  if (!db) return { evaluators: [], rows: [] };

  const sessionStudentsList = await getSessionStudents(sessionId);
  const evals = await db.select().from(evaluations).where(eq(evaluations.sessionId, sessionId));

  if (evals.length === 0) {
    return {
      evaluators: [],
      rows: sessionStudentsList.map((s, i) => ({
        serial: i + 1,
        studentId: s.studentId,
        studentName: s.studentName,
        studentEnrollment: s.studentEnrollment,
        peerGrades: [],
        peerAverage: 0,
        absent: false,
      })),
    };
  }

  const evalIds = evals.map(e => e.id);
  const allItems = await db.select({
    evaluationId: evaluationItems.evaluationId,
    evaluatedStudentId: evaluationItems.evaluatedStudentId,
    absent: evaluationItems.absent,
    atuacao: evaluationItems.atuacao,
    pontualidade: evaluationItems.pontualidade,
    dominio: evaluationItems.dominio,
    metas: evaluationItems.metas,
    participacao: evaluationItems.participacao,
  }).from(evaluationItems).where(inArray(evaluationItems.evaluationId, evalIds));

  const evalToEvaluator = new Map<number, number>();
  for (const e of evals) evalToEvaluator.set(e.id, e.evaluatorStudentId);

  // Assign serial numbers to all students in the session (alphabetical order by name)
  const serialMap = new Map<number, number>();
  sessionStudentsList.forEach((s, i) => serialMap.set(s.studentId, i + 1));

  // Build evaluator list (only students who actually submitted evaluations)
  const evaluatorIds = new Set(evals.map(e => e.evaluatorStudentId));
  const evaluators = sessionStudentsList
    .filter(s => evaluatorIds.has(s.studentId))
    .map(s => ({
      studentId: s.studentId,
      serial: serialMap.get(s.studentId) || 0,
      name: s.studentName,
      enrollment: s.studentEnrollment,
    }))
    .sort((a, b) => a.serial - b.serial);

  // Determine absent students
  const absentStudents = new Set<number>();
  for (const s of sessionStudentsList) {
    const itemsForStudent = allItems.filter(i => {
      const evaluatorId = evalToEvaluator.get(i.evaluationId);
      return i.evaluatedStudentId === s.studentId && evaluatorId !== s.studentId;
    });
    const absentCount = itemsForStudent.filter(i => i.absent).length;
    const presentCount = itemsForStudent.filter(i => !i.absent).length;
    if (itemsForStudent.length > 0 && absentCount > presentCount) {
      absentStudents.add(s.studentId);
    }
  }

  // Build rows
  const rows: PeerGradesMatrixRow[] = sessionStudentsList.map(s => {
    const isAbsent = absentStudents.has(s.studentId);

    // Get individual grades from each evaluator (excluding self-evaluation)
    const peerGrades: PeerGradeDetail[] = [];
    for (const evaluator of evaluators) {
      if (evaluator.studentId === s.studentId) continue; // skip self
      // Find the evaluation item from this evaluator for this student
      const eval_ = evals.find(e => e.evaluatorStudentId === evaluator.studentId);
      if (!eval_) continue;
      const item = allItems.find(
        i => i.evaluationId === eval_.id && i.evaluatedStudentId === s.studentId
      );
      if (item) {
        const score = item.absent ? 0 :
          Number(item.atuacao) + Number(item.pontualidade) + Number(item.dominio) + Number(item.metas) + Number(item.participacao);
        peerGrades.push({
          evaluatorStudentId: evaluator.studentId,
          evaluatorSerial: evaluator.serial,
          score: Math.round(score * 100) / 100,
          absent: item.absent,
        });
      }
    }

    // Calculate average (only from non-absent grades)
    const validGrades = peerGrades.filter(g => !g.absent);
    const peerAverage = validGrades.length > 0
      ? Math.round((validGrades.reduce((sum, g) => sum + g.score, 0) / validGrades.length) * 100) / 100
      : 0;

    return {
      serial: serialMap.get(s.studentId) || 0,
      studentId: s.studentId,
      studentName: s.studentName,
      studentEnrollment: s.studentEnrollment,
      peerGrades,
      peerAverage,
      absent: isAbsent,
    };
  });

  return { evaluators, rows };
}

export async function deleteNotification(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

// Sync pending requests that don't have corresponding notifications
// This ensures that requests created before the notification system was implemented
// still appear in the notifications page
export async function syncPendingRequestNotifications() {
  const db = await getDb();
  if (!db) return;
  try {
    // Get all pending requests
    const pendingRequests = await db.select({
      userId: professorComponents.userId,
      componentId: professorComponents.componentId,
      requesterName: users.name,
      requesterEmail: users.email,
      componentCode: components.code,
      componentName: components.name,
    })
      .from(professorComponents)
      .innerJoin(users, eq(professorComponents.userId, users.id))
      .innerJoin(components, eq(professorComponents.componentId, components.id))
      .where(eq(professorComponents.status, "pending"));

    if (pendingRequests.length === 0) return;

    // For each pending request, check if coordinators already have a notification
    for (const req of pendingRequests) {
      const coordinators = await getComponentCoordinators(req.componentId);
      for (const coord of coordinators) {
        // Check if a pending_request notification already exists for this coordinator about this request
        const existing = await db.select({ id: notifications.id })
          .from(notifications)
          .where(and(
            eq(notifications.userId, coord.userId),
            eq(notifications.type, "pending_request"),
            eq(notifications.read, false),
          ))
          .limit(100);

        // Check if any existing notification matches this specific request (by metadata)
        const hasNotification = existing.some(() => {
          // We need to check metadata for componentId and requesterId match
          return false; // Will be refined below
        });

        if (!hasNotification) {
          // Check more precisely by querying with metadata content
          const existingWithMeta = await db.select({ id: notifications.id, metadata: notifications.metadata })
            .from(notifications)
            .where(and(
              eq(notifications.userId, coord.userId),
              eq(notifications.type, "pending_request"),
            ))
            .limit(100);

          const alreadyExists = existingWithMeta.some(n => {
            if (!n.metadata) return false;
            try {
              const meta = JSON.parse(n.metadata);
              return meta.componentId === req.componentId && meta.requesterId === req.userId;
            } catch { return false; }
          });

          if (!alreadyExists) {
            await createNotification({
              userId: coord.userId,
              type: "pending_request",
              title: "Nova Solicitação de Entrada",
              message: `${req.requesterName || req.requesterEmail || "Professor"} solicitou entrada em ${req.componentCode} - ${req.componentName}`,
              metadata: JSON.stringify({ componentId: req.componentId, requesterId: req.userId }),
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("[Sync] Failed to sync pending request notifications:", err);
  }
}

// List notifications that are still "pending" resolution.
// A notification is considered pending if:
// - It is of type "pending_request" and the underlying request is still pending (not yet approved/rejected)
// - OR it is unread (any type)
// This is used for the "Notificações Pendentes" section on the dashboard.
export async function listPendingNotifications(userId: number, limit: number = 5) {
  const db = await getDb();
  if (!db) return [];

  // Get all unread notifications + all pending_request notifications (even if read)
  const allCandidates = await db.select()
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      or(
        eq(notifications.read, false),
        eq(notifications.type, "pending_request"),
      ),
    ))
    .orderBy(desc(notifications.createdAt))
    .limit(100);

  // For pending_request notifications, check if the underlying request is still pending
  const result: typeof allCandidates = [];
  for (const notif of allCandidates) {
    if (notif.type === "pending_request") {
      // Check if the request is still pending
      if (notif.metadata) {
        try {
          const meta = JSON.parse(notif.metadata);
          if (meta.componentId && meta.requesterId) {
            const [row] = await db.select({ status: professorComponents.status })
              .from(professorComponents)
              .where(and(
                eq(professorComponents.userId, meta.requesterId),
                eq(professorComponents.componentId, meta.componentId),
              ))
              .limit(1);
            if (row && row.status === "pending") {
              result.push(notif);
            }
            // If not pending anymore, skip it (resolved)
            continue;
          }
        } catch {}
      }
      // If metadata is missing or invalid, include it as unread
      if (!notif.read) result.push(notif);
    } else {
      // Non-pending_request: only include if unread
      if (!notif.read) result.push(notif);
    }
    if (result.length >= limit) break;
  }

  return result.slice(0, limit);
}

export async function countPendingNotifications(userId: number): Promise<number> {
  const items = await listPendingNotifications(userId, 100);
  return items.length;
}
