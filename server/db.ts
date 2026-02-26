import { eq, and, desc, inArray, sql, or, not, gte, lt } from "drizzle-orm";
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
  tutorialEvalDrafts,
  professorComponents, InsertProfessorComponent,
  smtpConfig, InsertSmtpConfig,
  passwordResetCodes,
  classEvalPermissions,
  emailVerificationCodes,
  auditLogs,
  notifications,
  contactTickets,
  professorStudentNotes,
  sessionAccessTokens,
  brainstormBoards, InsertBrainstormBoard, BrainstormBoard,
  brainstormItems, InsertBrainstormItem, BrainstormItem,
  brainstormItemAttachments, BrainstormItemAttachment,
  brainstormBoardSendHistory,
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

export async function setUserEmail(userId: number, email: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ email }).where(eq(users.id, userId));
}

export async function updateUserLoginMethod(userId: number, loginMethod: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ loginMethod }).where(eq(users.id, userId));
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
  
  // Check if professor has classes (as owner)
  const userClasses = await db.select({ id: classes.id }).from(classes).where(eq(classes.professorUserId, userId)).limit(1);
  if (userClasses.length > 0) {
    throw new Error("Não é possível excluir este professor pois ele possui turmas cadastradas. Remova as turmas primeiro.");
  }
  
  // Check if professor has tutorial evaluations (historical data)
  const tutorialEvals = await db.select({ id: tutorialEvaluations.id }).from(tutorialEvaluations).where(eq(tutorialEvaluations.professorUserId, userId)).limit(1);
  if (tutorialEvals.length > 0) {
    throw new Error("Não é possível excluir este professor pois ele possui avaliações tutoriais registradas.");
  }
  
  // Check if professor has student notes (historical data)
  const profNotes = await db.select({ id: professorStudentNotes.id }).from(professorStudentNotes).where(eq(professorStudentNotes.professorUserId, userId)).limit(1);
  if (profNotes.length > 0) {
    throw new Error("Não é possível excluir este professor pois ele possui notas de alunos registradas.");
  }
  
  // Safe to delete — no historical data
  // Remove all professor component memberships
  await db.delete(professorComponents).where(eq(professorComponents.userId, userId));
  // Remove eval permissions
  await db.delete(classEvalPermissions).where(eq(classEvalPermissions.authorizedUserId, userId));
  // Remove SMTP config if any
  await db.delete(smtpConfig).where(eq(smtpConfig.userId, userId));
  // Remove password reset codes
  await db.delete(passwordResetCodes).where(eq(passwordResetCodes.userId, userId));
  // Remove notifications
  await db.delete(notifications).where(eq(notifications.userId, userId));
  // Remove contact tickets
  await db.delete(contactTickets).where(eq(contactTickets.userId, userId));
  // Remove audit logs where user is actor
  await db.delete(auditLogs).where(eq(auditLogs.actorUserId, userId));
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
    userApprovalStatus: users.approvalStatus,
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
  const classSessions = await db.select({ id: sessions.id, status: sessions.status }).from(sessions).where(eq(sessions.classId, id));
  
  if (classSessions.length > 0) {
    // Check if any session has evaluations (historical data that must be preserved)
    const finishedSessions = classSessions.filter(s => s.status === "finished");
    if (finishedSessions.length > 0) {
      throw new Error("Não é possível excluir esta turma pois possui sessões encerradas com dados históricos. Considere arquivar a turma.");
    }
    
    const sessionIds = classSessions.map(s => s.id);
    const evals = await db.select({ id: evaluations.id }).from(evaluations).where(inArray(evaluations.sessionId, sessionIds));
    if (evals.length > 0) {
      throw new Error("Não é possível excluir esta turma pois possui avaliações registradas. Encerre ou exclua as sessões primeiro.");
    }
    
    // Safe to delete sessions without evaluations
    await db.delete(tutorialEvalDrafts).where(inArray(tutorialEvalDrafts.sessionId, sessionIds));
    await db.delete(sessionAccessTokens).where(inArray(sessionAccessTokens.sessionId, sessionIds));
    await db.delete(professorStudentNotes).where(inArray(professorStudentNotes.sessionId, sessionIds));
    // Clean brainstorm data
    for (const sessId of sessionIds) {
      const boards = await db.select({ id: brainstormBoards.id }).from(brainstormBoards).where(eq(brainstormBoards.sessionId, sessId));
      for (const board of boards) {
        const items = await db.select({ id: brainstormItems.id }).from(brainstormItems).where(eq(brainstormItems.boardId, board.id));
        if (items.length > 0) {
          await db.delete(brainstormItemAttachments).where(inArray(brainstormItemAttachments.itemId, items.map(i => i.id)));
          await db.delete(brainstormItems).where(eq(brainstormItems.boardId, board.id));
        }
        await db.delete(brainstormBoards).where(eq(brainstormBoards.id, board.id));
      }
      await db.delete(brainstormBoardSendHistory).where(eq(brainstormBoardSendHistory.sessionId, sessId));
    }
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
    photoUrl: students.photoUrl,
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
      // Check if student has any evaluations (as evaluator or evaluated) — preserve historical data
      const evalsAsEvaluator = await db.select({ id: evaluations.id }).from(evaluations).where(eq(evaluations.evaluatorStudentId, s.id)).limit(1);
      const evalsAsEvaluated = await db.select({ id: evaluationItems.id }).from(evaluationItems).where(eq(evaluationItems.evaluatedStudentId, s.id)).limit(1);
      // Check if student is in any session (sessionStudents)
      const sessionLinks = await db.select({ id: sessionStudents.id }).from(sessionStudents).where(eq(sessionStudents.studentId, s.id)).limit(1);
      // Check if student has professor notes
      const profNotes = await db.select({ id: professorStudentNotes.id }).from(professorStudentNotes).where(eq(professorStudentNotes.studentId, s.id)).limit(1);
      
      const hasHistoricalData = evalsAsEvaluator.length > 0 || evalsAsEvaluated.length > 0 || sessionLinks.length > 0 || profNotes.length > 0;
      
      if (!hasHistoricalData) {
        // Safe to delete — no historical data exists
        await db.delete(students).where(eq(students.id, s.id));
      }
      // If student has historical data, keep the record for result integrity
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
export async function createSession(data: { classId: number; problemNumber: number; sessionNumber: number; problemTitle?: string | null; label: string; studentAssignments: { studentId: number; role: "COORDENADOR" | "MESA" | "QUADRO" | "PARTICIPANTE"; absent: boolean }[]; status?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(sessions).values({
    classId: data.classId,
    problemNumber: data.problemNumber,
    sessionNumber: data.sessionNumber,
    problemTitle: data.problemTitle ?? null,
    label: data.label,
    status: "initiated",
  }).$returningId();
  const sessionId = result.id;
  if (data.studentAssignments.length > 0) {
    await db.insert(sessionStudents).values(
      data.studentAssignments.map(sa => ({ sessionId, studentId: sa.studentId, role: sa.role, absent: sa.absent }))
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
    studentPhotoUrl: students.photoUrl,
    role: sessionStudents.role,
    absent: sessionStudents.absent,
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

export async function finishSession(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(sessions).set({ status: "finished" }).where(eq(sessions.id, id));
}

export async function deleteSession(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.transaction(async (tx) => {
    const evals = await tx.select({ id: evaluations.id }).from(evaluations).where(eq(evaluations.sessionId, id));
    if (evals.length > 0) {
      const evalIds = evals.map(e => e.id);
      await tx.delete(evaluationItems).where(inArray(evaluationItems.evaluationId, evalIds));
      await tx.delete(evaluations).where(eq(evaluations.sessionId, id));
    }
    await tx.delete(tutorialEvaluations).where(eq(tutorialEvaluations.sessionId, id));
    await tx.delete(sessionStudents).where(eq(sessionStudents.sessionId, id));
    await tx.delete(sessions).where(eq(sessions.id, id));
  });
}

export async function updateSessionAssignments(sessionId: number, assignments: Array<{ studentId: number; role: "COORDENADOR" | "MESA" | "QUADRO" | "PARTICIPANTE"; absent: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Delete existing assignments and re-insert
  await db.delete(sessionStudents).where(eq(sessionStudents.sessionId, sessionId));
  if (assignments.length > 0) {
    await db.insert(sessionStudents).values(
      assignments.map(a => ({ sessionId, studentId: a.studentId, role: a.role, absent: a.absent }))
    );
  }
}

// ─── Evaluation helpers ───
export async function submitEvaluation(data: {
  sessionId: number;
  evaluatorStudentId: number;
  items: Array<{
    evaluatedStudentId: number;
    role: "COORDENADOR" | "MESA" | "QUADRO" | "PARTICIPANTE";
    absent: boolean;
    pontualidade: number;
    pesquisaMetas: number;
    dominio: number;
    participacao: number;
    desempenhoPapel: number;
  }>;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  return db.transaction(async (tx) => {
    const existing = await tx.select().from(evaluations)
      .where(and(eq(evaluations.sessionId, data.sessionId), eq(evaluations.evaluatorStudentId, data.evaluatorStudentId)))
      .limit(1);
    if (existing.length > 0) {
      await tx.delete(evaluationItems).where(eq(evaluationItems.evaluationId, existing[0].id));
      await tx.delete(evaluations).where(eq(evaluations.id, existing[0].id));
    }

    const [result] = await tx.insert(evaluations).values({
      sessionId: data.sessionId,
      evaluatorStudentId: data.evaluatorStudentId,
    }).$returningId();
    const evaluationId = result.id;

    if (data.items.length > 0) {
      await tx.insert(evaluationItems).values(
        data.items.map(item => ({
          evaluationId,
          evaluatedStudentId: item.evaluatedStudentId,
          role: item.role,
          absent: item.absent,
          pontualidade: String(item.pontualidade),
          pesquisaMetas: String(item.pesquisaMetas),
          dominio: String(item.dominio),
          participacao: String(item.participacao),
          desempenhoPapel: String(item.desempenhoPapel),
        }))
      );
    }
    return evaluationId;
  });
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
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(evaluations)
      .where(and(eq(evaluations.sessionId, sessionId), eq(evaluations.evaluatorStudentId, studentId)))
      .limit(1);
    if (rows.length === 0) return false;
    const evaluationId = rows[0].id;
    await tx.delete(evaluationItems).where(eq(evaluationItems.evaluationId, evaluationId));
    await tx.delete(evaluations).where(eq(evaluations.id, evaluationId));
    return true;
  });
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
  
  // Get session to find classId, then get ALL students in the class
  const session = await getSessionById(sessionId);
  const allClassStudents = session ? await listStudentsByClass(session.classId) : [];
  
  // Build set of students in the session
  const sessionStudentIds = new Set(sessionStudentsList.map(s => s.studentId));
  
  // Absent students = class students NOT in the session
  const absentStudents = allClassStudents.filter(s => !sessionStudentIds.has(s.id));
  
  const evals = await db.select().from(evaluations).where(eq(evaluations.sessionId, sessionId));

  if (evals.length === 0) {
    const results = sessionStudentsList.map(s => ({
      studentId: s.studentId,
      studentName: s.studentName,
      studentEmail: s.studentEmail,
      studentEnrollment: s.studentEnrollment,
      role: "PARTICIPANTE",
      totalScore: 0,
      validEvaluations: 0,
      absent: false,
    }));
    // Add absent students (not in session) with zero
    for (const s of absentStudents) {
      results.push({
        studentId: s.id,
        studentName: s.name,
        studentEmail: s.email,
        studentEnrollment: s.enrollment,
        role: "FALTOU",
        totalScore: 0,
        validEvaluations: 0,
        absent: true,
      });
    }
    return results;
  }

  const evalIds = evals.map(e => e.id);
  const allItems = await db.select({
    evaluationId: evaluationItems.evaluationId,
    evaluatedStudentId: evaluationItems.evaluatedStudentId,
    role: evaluationItems.role,
    absent: evaluationItems.absent,
    pontualidade: evaluationItems.pontualidade,
    pesquisaMetas: evaluationItems.pesquisaMetas,
    dominio: evaluationItems.dominio,
    participacao: evaluationItems.participacao,
    desempenhoPapel: evaluationItems.desempenhoPapel,
  }).from(evaluationItems).where(inArray(evaluationItems.evaluationId, evalIds));

  const evalToEvaluator = new Map<number, number>();
  for (const e of evals) evalToEvaluator.set(e.id, e.evaluatorStudentId);

  // Build set of absent student IDs (marked absent by professor in sessionStudents)
  const absentStudentIds = new Set(
    sessionStudentsList.filter(s => s.absent).map(s => s.studentId)
  );

  // Filter out evaluations FROM absent evaluators
  // If a student was marked absent but had already submitted an evaluation, exclude it
  const validEvals = new Set(
    evals.filter(e => !absentStudentIds.has(e.evaluatorStudentId)).map(e => e.id)
  );
  const filteredItems = allItems.filter(i => validEvals.has(i.evaluationId));

  const roleCounts: Record<number, Record<string, number>> = {};
  for (const item of filteredItems) {
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
    const itemsForStudent = filteredItems.filter(i => {
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
      const score = Number(item.pontualidade) * 1 + Number(item.pesquisaMetas) * 3 + Number(item.dominio) * 3 + Number(item.participacao) * 3 - Number(item.desempenhoPapel) * 1;
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

  // Add absent students (class students not in session) with zero
  for (const s of absentStudents) {
    results.push({
      studentId: s.id,
      studentName: s.name,
      studentEmail: s.email,
      studentEnrollment: s.enrollment,
      role: "FALTOU",
      totalScore: 0,
      validEvaluations: 0,
      absent: true,
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

  return db.transaction(async (tx) => {
    const existing = await tx.select().from(tutorialEvaluations)
      .where(eq(tutorialEvaluations.sessionId, data.sessionId))
      .limit(1);

    if (existing.length > 0) {
      await tx.update(tutorialEvaluations).set({
        organizacao: String(data.organizacao),
        cooperacao: String(data.cooperacao),
        conteudo: String(data.conteudo),
        objetivo: String(data.objetivo),
        metas: String(data.metas),
        submittedAt: new Date(),
      }).where(eq(tutorialEvaluations.id, existing[0].id));
      return existing[0].id;
    }

    const [result] = await tx.insert(tutorialEvaluations).values({
      sessionId: data.sessionId,
      professorUserId: data.professorUserId,
      organizacao: String(data.organizacao),
      cooperacao: String(data.cooperacao),
      conteudo: String(data.conteudo),
      objetivo: String(data.objetivo),
      metas: String(data.metas),
    }).$returningId();
    return result.id;
  });
}

export async function getTutorialEvaluation(sessionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(tutorialEvaluations)
    .where(eq(tutorialEvaluations.sessionId, sessionId))
    .limit(1);
  return row;
}

// ─── Tutorial Evaluation Drafts ───
export async function saveTutorialEvalDraft(data: {
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
  return db.transaction(async (tx) => {
    const existing = await tx.select().from(tutorialEvalDrafts)
      .where(eq(tutorialEvalDrafts.sessionId, data.sessionId))
      .limit(1);
    if (existing.length > 0) {
      await tx.update(tutorialEvalDrafts).set({
        organizacao: String(data.organizacao),
        cooperacao: String(data.cooperacao),
        conteudo: String(data.conteudo),
        objetivo: String(data.objetivo),
        metas: String(data.metas),
        professorUserId: data.professorUserId,
        savedAt: new Date(),
      }).where(eq(tutorialEvalDrafts.id, existing[0].id));
      return existing[0].id;
    }
    const [result] = await tx.insert(tutorialEvalDrafts).values({
      sessionId: data.sessionId,
      professorUserId: data.professorUserId,
      organizacao: String(data.organizacao),
      cooperacao: String(data.cooperacao),
      conteudo: String(data.conteudo),
      objetivo: String(data.objetivo),
      metas: String(data.metas),
    }).$returningId();
    return result.id;
  });
}

export async function getTutorialEvalDraft(sessionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(tutorialEvalDrafts)
    .where(eq(tutorialEvalDrafts.sessionId, sessionId))
    .limit(1);
  return row;
}

export async function deleteTutorialEvalDraft(sessionId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(tutorialEvalDrafts).where(eq(tutorialEvalDrafts.sessionId, sessionId));
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

// ─── Student Consolidated Report ───
export async function getStudentConsolidatedReport(classId: number) {
  const db = await getDb();
  if (!db) return [];

  // Get all sessions for this class
  const classSessions = await db.select().from(sessions)
    .where(eq(sessions.classId, classId))
    .orderBy(sessions.problemNumber, sessions.sessionNumber);

  if (classSessions.length === 0) return [];

  // Get all students in the class
  const classStudentRows = await db.select({
    studentId: classStudents.studentId,
    studentName: students.name,
    studentEmail: students.email,
    studentEnrollment: students.enrollment,
  }).from(classStudents)
    .innerJoin(students, eq(classStudents.studentId, students.id))
    .where(eq(classStudents.classId, classId))
    .orderBy(students.name);

  // Calculate final grades for each session
  const sessionResults: Record<number, { label: string; problemNumber: number; sessionNumber: number; status: string; grades: Record<number, { peerScore: number; finalGrade: number; role: string; absent: boolean }> }> = {};

  for (const sess of classSessions) {
    const finalGrades = await calculateFinalGrades(sess.id);
    sessionResults[sess.id] = {
      label: sess.label,
      problemNumber: sess.problemNumber,
      sessionNumber: sess.sessionNumber,
      status: sess.status,
      grades: {},
    };
    for (const g of finalGrades) {
      sessionResults[sess.id].grades[g.studentId] = {
        peerScore: g.peerScore,
        finalGrade: g.finalGrade,
        role: g.role,
        absent: g.absent,
      };
    }
  }

  // Build consolidated report per student
  return classStudentRows.map(student => {
    const sessionData = classSessions.map(sess => {
      const grade = sessionResults[sess.id]?.grades[student.studentId];
      return {
        sessionId: sess.id,
        label: sess.label,
        problemNumber: sess.problemNumber,
        sessionNumber: sess.sessionNumber,
        status: sess.status,
        peerScore: grade?.peerScore ?? 0,
        finalGrade: grade?.finalGrade ?? 0,
        role: grade?.role ?? "FALTOU",
        absent: grade?.absent ?? true,
      };
    });

    const presentSessions = sessionData.filter(s => !s.absent);
    const absentSessions = sessionData.filter(s => s.absent);
    const avgPeer = presentSessions.length > 0
      ? Math.round(presentSessions.reduce((sum, s) => sum + s.peerScore, 0) / presentSessions.length * 10) / 10
      : 0;
    const avgFinal = presentSessions.length > 0
      ? Math.round(presentSessions.reduce((sum, s) => sum + s.finalGrade, 0) / presentSessions.length * 10) / 10
      : 0;

    return {
      studentId: student.studentId,
      studentName: student.studentName,
      studentEmail: student.studentEmail,
      studentEnrollment: student.studentEnrollment,
      sessions: sessionData,
      totalSessions: sessionData.length,
      presentCount: presentSessions.length,
      absentCount: absentSessions.length,
      avgPeerScore: avgPeer,
      avgFinalGrade: avgFinal,
    };
  });
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
  await db.update(sessions).set({ accessCode: code, status: "open" }).where(eq(sessions.id, sessionId));
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
    photoUrl: students.photoUrl,
  })
    .from(classStudents)
    .innerJoin(students, eq(classStudents.studentId, students.id))
    .where(and(eq(classStudents.classId, classId), eq(students.enrollment, enrollment)))
    .limit(1);
  return rows.length > 0 ? rows[0] : undefined;
}

export async function getStudentEvaluationCount(studentId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ id: evaluations.id }).from(evaluations)
    .where(eq(evaluations.evaluatorStudentId, studentId));
  return rows.length;
}

export async function updateStudentPhoto(studentId: number, photoUrl: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(students).set({ photoUrl }).where(eq(students.id, studentId));
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
export async function createComponent(data: { code: string; name: string; type?: "T" | "TP" }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(components).values({
    code: data.code.toUpperCase(),
    name: data.name,
    type: data.type || "TP",
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

export async function updateComponent(id: number, data: { code?: string; name?: string; type?: "T" | "TP" }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateSet: Record<string, unknown> = {};
  if (data.code !== undefined) updateSet.code = data.code.toUpperCase();
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.type !== undefined) updateSet.type = data.type;
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
  return db.transaction(async (tx) => {
    const [record] = await tx.select().from(emailVerificationCodes)
      .where(and(
        eq(emailVerificationCodes.email, email),
        eq(emailVerificationCodes.code, code),
        eq(emailVerificationCodes.used, false),
      ))
      .limit(1);
    if (!record) return false;
    if (record.expiresAt < new Date()) return false;
    // Mark as used atomically
    await tx.update(emailVerificationCodes)
      .set({ used: true })
      .where(eq(emailVerificationCodes.id, record.id));
    return true;
  });
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

export async function deleteAuditLogs(period: "last_hour" | "last_day" | "all"): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  let condition;
  if (period === "last_hour") {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    condition = gte(auditLogs.createdAt, oneHourAgo);
  } else if (period === "last_day") {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    condition = gte(auditLogs.createdAt, oneDayAgo);
  }
  // period === "all" => no condition, delete everything

  const result = condition
    ? await db.delete(auditLogs).where(condition)
    : await db.delete(auditLogs);

  return (result as any)[0]?.affectedRows ?? 0;
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
    pontualidade: evaluationItems.pontualidade,
    pesquisaMetas: evaluationItems.pesquisaMetas,
    dominio: evaluationItems.dominio,
    participacao: evaluationItems.participacao,
    desempenhoPapel: evaluationItems.desempenhoPapel,
  }).from(evaluationItems).where(inArray(evaluationItems.evaluationId, evalIds));

  const evalToEvaluator = new Map<number, number>();
  for (const e of evals) evalToEvaluator.set(e.id, e.evaluatorStudentId);

  // Build set of absent student IDs (marked absent by professor in sessionStudents)
  const absentStudentIdsSet = new Set(
    sessionStudentsList.filter(s => s.absent).map(s => s.studentId)
  );

  // Filter out evaluations FROM absent evaluators
  const validEvalIds = new Set(
    evals.filter(e => !absentStudentIdsSet.has(e.evaluatorStudentId)).map(e => e.id)
  );
  const filteredItems = allItems.filter(i => validEvalIds.has(i.evaluationId));

  // Assign serial numbers to all students in the session (alphabetical order by name)
  const serialMap = new Map<number, number>();
  sessionStudentsList.forEach((s, i) => serialMap.set(s.studentId, i + 1));

  // Build evaluator list (only present students who actually submitted evaluations)
  const evaluatorIds = new Set(evals.filter(e => !absentStudentIdsSet.has(e.evaluatorStudentId)).map(e => e.evaluatorStudentId));
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
    const itemsForStudent = filteredItems.filter(i => {
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
      const item = filteredItems.find(
        i => i.evaluationId === eval_.id && i.evaluatedStudentId === s.studentId
      );
      if (item) {
        const score = item.absent ? 0 :
          Number(item.pontualidade) * 1 + Number(item.pesquisaMetas) * 3 + Number(item.dominio) * 3 + Number(item.participacao) * 3 - Number(item.desempenhoPapel) * 1;
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
export async function syncPendingRequestNotifications(currentUserId?: number) {
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

    // Get all admin users
    const adminUsers = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"));

    // For each pending request, ensure coordinators AND admins have notifications
    for (const req of pendingRequests) {
      const coordinators = await getComponentCoordinators(req.componentId);
      
      // Build list of recipients: coordinators + admins (deduplicated)
      const recipientIds = new Set<number>();
      for (const coord of coordinators) recipientIds.add(coord.userId);
      for (const admin of adminUsers) recipientIds.add(admin.id);
      // If currentUserId is provided, ensure it's included
      if (currentUserId) recipientIds.add(currentUserId);

      for (const recipientId of Array.from(recipientIds)) {
        // Check if a pending_request notification already exists for this recipient about this request
        const existingWithMeta = await db.select({ id: notifications.id, metadata: notifications.metadata })
          .from(notifications)
          .where(and(
            eq(notifications.userId, recipientId),
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
            userId: recipientId,
            type: "pending_request",
            title: "Nova Solicitação de Entrada",
            message: `${req.requesterName || req.requesterEmail || "Professor"} solicitou entrada em ${req.componentCode} - ${req.componentName}`,
            metadata: JSON.stringify({ componentId: req.componentId, requesterId: req.userId }),
          });
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


// ─── Contact Tickets helpers ───
export async function createContactTicket(data: {
  userId: number;
  type: "bug" | "feature";
  subject: string;
  message: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(contactTickets).values({
    userId: data.userId,
    type: data.type,
    subject: data.subject,
    message: data.message,
  }).$returningId();
  return result;
}

export async function listContactTickets(options?: { status?: "open" | "resolved"; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions = [];
  if (options?.status) {
    conditions.push(eq(contactTickets.status, options.status));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db.select({
    id: contactTickets.id,
    userId: contactTickets.userId,
    type: contactTickets.type,
    subject: contactTickets.subject,
    message: contactTickets.message,
    status: contactTickets.status,
    resolvedAt: contactTickets.resolvedAt,
    createdAt: contactTickets.createdAt,
    userName: users.name,
    userEmail: users.email,
  })
    .from(contactTickets)
    .leftJoin(users, eq(contactTickets.userId, users.id))
    .where(whereClause)
    .orderBy(desc(contactTickets.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);

  const [countRow] = await db.select({ count: sql<number>`count(*)` })
    .from(contactTickets)
    .where(whereClause);

  return { items, total: countRow?.count ?? 0 };
}

export async function listMyContactTickets(userId: number, options?: { limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const items = await db.select()
    .from(contactTickets)
    .where(eq(contactTickets.userId, userId))
    .orderBy(desc(contactTickets.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);

  const [countRow] = await db.select({ count: sql<number>`count(*)` })
    .from(contactTickets)
    .where(eq(contactTickets.userId, userId));

  return { items, total: countRow?.count ?? 0 };
}

export async function resolveContactTicket(ticketId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contactTickets)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(eq(contactTickets.id, ticketId));
}

export async function getContactTicketById(ticketId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select()
    .from(contactTickets)
    .where(eq(contactTickets.id, ticketId))
    .limit(1);
  return row ?? null;
}

export async function countOpenContactTickets(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db.select({ count: sql<number>`count(*)` })
    .from(contactTickets)
    .where(eq(contactTickets.status, "open"));
  return row?.count ?? 0;
}


// ─── Database Backup / Restore helpers ───

// Tables to export (order matters for import: parents first, children later)
const BACKUP_TABLES = [
  { name: "users", table: users },
  { name: "components", table: components },
  { name: "professorComponents", table: professorComponents },
  { name: "classes", table: classes },
  { name: "students", table: students },
  { name: "classStudents", table: classStudents },
  { name: "sessions", table: sessions },
  { name: "sessionStudents", table: sessionStudents },
  { name: "evaluations", table: evaluations },
  { name: "evaluationItems", table: evaluationItems },
  { name: "tutorialEvaluations", table: tutorialEvaluations },
  { name: "tutorialEvalDrafts", table: tutorialEvalDrafts },
  { name: "classEvalPermissions", table: classEvalPermissions },
  { name: "emailVerificationCodes", table: emailVerificationCodes },
  { name: "passwordResetCodes", table: passwordResetCodes },
  { name: "smtpConfig", table: smtpConfig },
  { name: "auditLogs", table: auditLogs },
  { name: "notifications", table: notifications },
  { name: "contactTickets", table: contactTickets },
  { name: "professorStudentNotes", table: professorStudentNotes },
  { name: "sessionAccessTokens", table: sessionAccessTokens },
  { name: "brainstormBoards", table: brainstormBoards },
  { name: "brainstormItems", table: brainstormItems },
  { name: "brainstormItemAttachments", table: brainstormItemAttachments },
  { name: "brainstormBoardSendHistory", table: brainstormBoardSendHistory },
] as const;

// Tables to clear in reverse order (children first, parents last) to avoid FK issues
const CLEAR_ORDER = [...BACKUP_TABLES].reverse();

export interface BackupData {
  version: string;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

export async function exportDatabase(): Promise<BackupData> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const backup: BackupData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    tables: {},
  };

  for (const { name, table } of BACKUP_TABLES) {
    const rows = await db.select().from(table);
    backup.tables[name] = rows;
  }

  return backup;
}

export async function importDatabase(data: BackupData, clearFirst: boolean): Promise<{ tablesImported: number; rowsImported: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let tablesImported = 0;
  let rowsImported = 0;

  if (clearFirst) {
    // Delete all data in reverse order (children first)
    for (const { table } of CLEAR_ORDER) {
      await db.delete(table);
    }
  }

  // Insert data in order (parents first)
  for (const { name, table } of BACKUP_TABLES) {
    const rows = data.tables[name];
    if (!rows || rows.length === 0) continue;

    // Insert in batches of 100 to avoid query size limits
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await db.insert(table).values(batch as any[]);
    }

    tablesImported++;
    rowsImported += rows.length;
  }

  return { tablesImported, rowsImported };
}

export async function rebuildDatabase(): Promise<{ success: boolean; tablesCreated: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Get all existing tables in the database
  const existingTables = await db.execute(sql`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
  `);

  // 2. Disable foreign key checks, drop all tables, re-enable
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  try {
    const tableRows = (existingTables as any)[0] || existingTables;
    if (Array.isArray(tableRows)) {
      for (const row of tableRows) {
        const tableName = (row as any).TABLE_NAME || (row as any).table_name;
        if (tableName) {
          await db.execute(sql.raw(`DROP TABLE IF EXISTS \`${tableName}\``));
        }
      }
    }
  } finally {
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
  }

  // 3. Run drizzle migrations to recreate all tables
  const { migrate } = await import("drizzle-orm/mysql2/migrator");
  const path = await import("path");
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  await migrate(db as any, { migrationsFolder });

  // 4. Count recreated tables
  const newTables = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
  `);
  const tableCount = ((newTables as any)[0]?.[0]?.cnt ?? (newTables as any)[0]?.cnt ?? 0) as number;

  return { success: true, tablesCreated: tableCount };
}

export async function getBackupStats(): Promise<Record<string, number>> {
  const db = await getDb();
  if (!db) return {};

  const stats: Record<string, number> = {};
  for (const { name, table } of BACKUP_TABLES) {
    const [row] = await db.select({ count: sql<number>`count(*)` }).from(table);
    stats[name] = row?.count ?? 0;
  }
  return stats;
}

// ─── Professor Student Notes helpers ───
export async function upsertProfessorStudentNote(data: {
  sessionId: number;
  studentId: number;
  professorUserId: number;
  positivePoints: number;
  negativePoints: number;
  positiveTexts: string[] | null;
  negativeTexts: string[] | null;
  notes: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  return db.transaction(async (tx) => {
    // Check if note already exists
    const [existing] = await tx.select().from(professorStudentNotes)
      .where(and(
        eq(professorStudentNotes.sessionId, data.sessionId),
        eq(professorStudentNotes.studentId, data.studentId),
        eq(professorStudentNotes.professorUserId, data.professorUserId),
      )).limit(1);

    if (existing) {
      await tx.update(professorStudentNotes)
        .set({
          positivePoints: data.positivePoints,
          negativePoints: data.negativePoints,
          positiveTexts: data.positiveTexts,
          negativeTexts: data.negativeTexts,
          notes: data.notes,
        })
        .where(eq(professorStudentNotes.id, existing.id));
      return { ...existing, ...data };
    } else {
      const [result] = await tx.insert(professorStudentNotes).values(data).$returningId();
      return { id: result.id, ...data };
    }
  });
}

export async function getProfessorStudentNotes(sessionId: number, professorUserId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(professorStudentNotes)
    .where(and(
      eq(professorStudentNotes.sessionId, sessionId),
      eq(professorStudentNotes.professorUserId, professorUserId),
    ));
}

export async function bulkUpsertProfessorStudentNotes(notes: Array<{
  sessionId: number;
  studentId: number;
  professorUserId: number;
  positivePoints: number;
  negativePoints: number;
  positiveTexts: string[] | null;
  negativeTexts: string[] | null;
  notes: string | null;
}>) {
  const results = [];
  for (const note of notes) {
    results.push(await upsertProfessorStudentNote(note));
  }
  return results;
}

// ─── Get next session number for a class ───
export async function getNextSessionInfo(classId: number) {
  const db = await getDb();
  if (!db) return { nextProblemNumber: 1, nextSessionNumber: 1, lastProblemNumber: 0 };

  const existingSessions = await db.select({
    problemNumber: sessions.problemNumber,
    sessionNumber: sessions.sessionNumber,
  }).from(sessions)
    .where(eq(sessions.classId, classId))
    .orderBy(sessions.problemNumber, sessions.sessionNumber);

  if (existingSessions.length === 0) {
    return { nextProblemNumber: 1, nextSessionNumber: 1, lastProblemNumber: 0 };
  }

  const lastSession = existingSessions[existingSessions.length - 1];
  return {
    nextProblemNumber: lastSession.problemNumber,
    nextSessionNumber: lastSession.sessionNumber + 1,
    lastProblemNumber: lastSession.problemNumber,
  };
}

// ─── Student login by enrollment (global, not per class) ───
export async function findStudentByEnrollment(enrollment: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select({
    id: students.id,
    name: students.name,
    enrollment: students.enrollment,
    email: students.email,
    photoUrl: students.photoUrl,
  }).from(students)
    .where(eq(students.enrollment, enrollment.trim()))
    .limit(1);
  return row;
}

// ─── Get open sessions for a student (across all classes/components) ───
export async function getOpenSessionsForStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    sessionId: sessions.id,
    sessionLabel: sessions.label,
    sessionStatus: sessions.status,
    problemNumber: sessions.problemNumber,
    sessionNumber: sessions.sessionNumber,
    classId: sessions.classId,
    classCode: classes.classCode,
    componentId: classes.componentId,
    componentCode: components.code,
    componentName: components.name,
    semester: classes.semester,
    accessCode: sessions.accessCode,
    studentRole: sessionStudents.role,
  })
    .from(sessionStudents)
    .innerJoin(sessions, eq(sessionStudents.sessionId, sessions.id))
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .innerJoin(components, eq(classes.componentId, components.id))
    .where(and(
      eq(sessionStudents.studentId, studentId),
      eq(sessions.status, "open"),
    ))
    .orderBy(sessions.createdAt);
  return rows;
}

// ─── Get all sessions for a student (any status, for history) ───
export async function getAllSessionsForStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    sessionId: sessions.id,
    sessionLabel: sessions.label,
    sessionStatus: sessions.status,
    problemNumber: sessions.problemNumber,
    sessionNumber: sessions.sessionNumber,
    classId: sessions.classId,
    classCode: classes.classCode,
    componentCode: components.code,
    componentName: components.name,
    semester: classes.semester,
  })
    .from(sessionStudents)
    .innerJoin(sessions, eq(sessionStudents.sessionId, sessions.id))
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .innerJoin(components, eq(classes.componentId, components.id))
    .where(eq(sessionStudents.studentId, studentId))
    .orderBy(sessions.createdAt);
  return rows;
}

// ─── Get classes for a student ───
export async function getClassesForStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    classId: classes.id,
    classCode: classes.classCode,
    componentCode: components.code,
    componentName: components.name,
    semester: classes.semester,
  })
    .from(classStudents)
    .innerJoin(classes, eq(classStudents.classId, classes.id))
    .innerJoin(components, eq(classes.componentId, components.id))
    .where(eq(classStudents.studentId, studentId))
    .orderBy(components.code, classes.classCode);
  return rows;
}

// ─── Get student evaluation history (completed evaluations with grades) ───
export async function getStudentEvaluationHistory(studentId: number) {
  const db = await getDb();
  if (!db) return [];

  // Get all evaluations submitted by this student
  const evals = await db.select({
    evaluationId: evaluations.id,
    sessionId: evaluations.sessionId,
    submittedAt: evaluations.submittedAt,
    sessionLabel: sessions.label,
    sessionStatus: sessions.status,
    problemNumber: sessions.problemNumber,
    sessionNumber: sessions.sessionNumber,
    classCode: classes.classCode,
    componentCode: components.code,
    componentName: components.name,
    semester: classes.semester,
  })
    .from(evaluations)
    .innerJoin(sessions, eq(evaluations.sessionId, sessions.id))
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .innerJoin(components, eq(classes.componentId, components.id))
    .where(eq(evaluations.evaluatorStudentId, studentId))
    .orderBy(evaluations.submittedAt);

  // For each evaluation, compute the total grade given by this student (sum of 5 criteria per evaluated peer)
  const history = await Promise.all(evals.map(async (ev) => {
    const items = await db.select({
      evaluatedStudentId: evaluationItems.evaluatedStudentId,
      absent: evaluationItems.absent,
      pontualidade: evaluationItems.pontualidade,
      pesquisaMetas: evaluationItems.pesquisaMetas,
      dominio: evaluationItems.dominio,
      participacao: evaluationItems.participacao,
      desempenhoPapel: evaluationItems.desempenhoPapel,
    }).from(evaluationItems)
      .where(eq(evaluationItems.evaluationId, ev.evaluationId));

    // Count peers evaluated (excluding absences)
    const peersEvaluated = items.filter(i => !i.absent).length;
    const totalPeers = items.length;

    // Compute average grade given (average of sum of 5 criteria across all evaluated peers)
    let avgGradeGiven = 0;
    if (peersEvaluated > 0) {
      const totalSum = items.filter(i => !i.absent).reduce((sum, i) => {
        return sum + Number(i.pontualidade) + Number(i.pesquisaMetas) + Number(i.dominio) + Number(i.participacao) + Number(i.desempenhoPapel);
      }, 0);
      avgGradeGiven = totalSum / peersEvaluated;
    }

    return {
      sessionId: ev.sessionId,
      sessionLabel: ev.sessionLabel,
      sessionStatus: ev.sessionStatus,
      problemNumber: ev.problemNumber,
      sessionNumber: ev.sessionNumber,
      classCode: ev.classCode,
      componentCode: ev.componentCode,
      componentName: ev.componentName,
      semester: ev.semester,
      submittedAt: ev.submittedAt,
      peersEvaluated,
      totalPeers,
      avgGradeGiven: Math.round(avgGradeGiven * 100) / 100,
    };
  }));

  return history;
}

// ─── Session Access Tokens (individual per student per session) ───

export async function generateSessionTokenForStudent(sessionId: number, studentId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Generate a random 32-char hex token
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  // Upsert atomically: if token already exists for this student+session, replace it
  return db.transaction(async (tx) => {
    await tx.delete(sessionAccessTokens).where(
      and(eq(sessionAccessTokens.sessionId, sessionId), eq(sessionAccessTokens.studentId, studentId))
    );
    await tx.insert(sessionAccessTokens).values({ sessionId, studentId, token });
    return token;
  });
}

export async function getSessionByStudentToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select({
    tokenId: sessionAccessTokens.id,
    sessionId: sessionAccessTokens.sessionId,
    studentId: sessionAccessTokens.studentId,
    sessionLabel: sessions.label,
    sessionStatus: sessions.status,
    classId: sessions.classId,
    problemNumber: sessions.problemNumber,
    sessionNumber: sessions.sessionNumber,
    classCode: classes.classCode,
    componentId: classes.componentId,
  })
    .from(sessionAccessTokens)
    .innerJoin(sessions, eq(sessionAccessTokens.sessionId, sessions.id))
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .where(eq(sessionAccessTokens.token, token))
    .limit(1);
  return row ?? null;
}

export async function deleteSessionTokens(sessionId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(sessionAccessTokens).where(eq(sessionAccessTokens.sessionId, sessionId));
}

export async function getTokensForSession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    studentId: sessionAccessTokens.studentId,
    token: sessionAccessTokens.token,
  })
    .from(sessionAccessTokens)
    .where(eq(sessionAccessTokens.sessionId, sessionId));
}


// ─── Role Summary for a class (how many times each student assumed each role) ───
export async function getRoleSummaryByClass(classId: number) {
  const db = await getDb();
  if (!db) return [];

  // Get all sessions for this class
  const classSessions = await db.select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.classId, classId));

  if (classSessions.length === 0) return [];

  const sessionIds = classSessions.map(s => s.id);

  // Get all session students with their roles
  const allAssignments = await db.select({
    studentId: sessionStudents.studentId,
    sessionId: sessionStudents.sessionId,
    role: sessionStudents.role,
    absent: sessionStudents.absent,
    studentName: students.name,
    studentEnrollment: students.enrollment,
  })
    .from(sessionStudents)
    .innerJoin(students, eq(sessionStudents.studentId, students.id))
    .where(inArray(sessionStudents.sessionId, sessionIds));

  // Group by student
  const summaryMap = new Map<number, {
    studentId: number;
    studentName: string;
    studentEnrollment: string;
    coordenador: number;
    mesa: number;
    quadro: number;
    participante: number;
    ausencias: number;
    totalSessions: number;
  }>();

  for (const a of allAssignments) {
    if (!summaryMap.has(a.studentId)) {
      summaryMap.set(a.studentId, {
        studentId: a.studentId,
        studentName: a.studentName,
        studentEnrollment: a.studentEnrollment,
        coordenador: 0,
        mesa: 0,
        quadro: 0,
        participante: 0,
        ausencias: 0,
        totalSessions: 0,
      });
    }
    const entry = summaryMap.get(a.studentId)!;
    entry.totalSessions++;
    if (a.absent) {
      entry.ausencias++;
    } else {
      switch (a.role) {
        case "COORDENADOR": entry.coordenador++; break;
        case "MESA": entry.mesa++; break;
        case "QUADRO": entry.quadro++; break;
        case "PARTICIPANTE": entry.participante++; break;
      }
    }
  }

  return Array.from(summaryMap.values()).sort((a, b) => a.studentName.localeCompare(b.studentName));
}


// ─── Brainstorm Board helpers ───

export async function getOrCreateBrainstormBoard(sessionId: number, mesaStudentId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(brainstormBoards)
      .where(eq(brainstormBoards.sessionId, sessionId))
      .limit(1);

    if (existing) return existing;

    const [result] = await tx.insert(brainstormBoards).values({ sessionId, mesaStudentId }).$returningId();
    return { id: result.id, sessionId, mesaStudentId, createdAt: new Date(), updatedAt: new Date() };
  });
}

export async function getBrainstormBoard(sessionId: number) {
  const db = await getDb();
  if (!db) return null;

  const [board] = await db.select().from(brainstormBoards)
    .where(eq(brainstormBoards.sessionId, sessionId))
    .limit(1);

  return board ?? null;
}

export async function getBrainstormItems(boardId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(brainstormItems)
    .where(eq(brainstormItems.boardId, boardId))
    .orderBy(brainstormItems.section, brainstormItems.sortOrder, brainstormItems.createdAt);
}

// ─── Brainstorm Item Attachment helpers ───

export async function getAttachmentsByItemId(itemId: number): Promise<BrainstormItemAttachment[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(brainstormItemAttachments)
    .where(eq(brainstormItemAttachments.itemId, itemId))
    .orderBy(brainstormItemAttachments.sortOrder, brainstormItemAttachments.createdAt);
}

export async function getAttachmentsByItemIds(itemIds: number[]): Promise<BrainstormItemAttachment[]> {
  const db = await getDb();
  if (!db) return [];
  if (itemIds.length === 0) return [];
  return db.select().from(brainstormItemAttachments)
    .where(inArray(brainstormItemAttachments.itemId, itemIds))
    .orderBy(brainstormItemAttachments.sortOrder, brainstormItemAttachments.createdAt);
}

export async function addBrainstormAttachment(data: {
  itemId: number;
  url: string;
  type: "link" | "image" | "video" | "photo" | "document";
  title?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  return db.transaction(async (tx) => {
    // Get max sortOrder for this item atomically
    const [maxRow] = await tx.select({ maxOrder: sql<number>`COALESCE(MAX(${brainstormItemAttachments.sortOrder}), -1)` })
      .from(brainstormItemAttachments)
      .where(eq(brainstormItemAttachments.itemId, data.itemId));

    const sortOrder = (maxRow?.maxOrder ?? -1) + 1;

    const [result] = await tx.insert(brainstormItemAttachments).values({
      itemId: data.itemId,
      url: data.url,
      type: data.type,
      title: data.title || "",
      sortOrder,
    }).$returningId();

    return { id: result.id, ...data, title: data.title || "", sortOrder, createdAt: new Date() };
  });
}

export async function removeBrainstormAttachment(attachmentId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(brainstormItemAttachments).where(eq(brainstormItemAttachments.id, attachmentId));
}

export async function updateBrainstormAttachmentTitle(attachmentId: number, title: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(brainstormItemAttachments)
    .set({ title })
    .where(eq(brainstormItemAttachments.id, attachmentId));
}

export async function addBrainstormItem(data: {
  boardId: number;
  section: "ideias" | "fatos" | "questoes" | "metas";
  content: string;
  status: string;
  attachmentUrl?: string | null;
  attachmentType?: "link" | "image" | "video" | "photo" | "document" | null;
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  return db.transaction(async (tx) => {
    // Get max sortOrder for this section atomically
    const [maxRow] = await tx.select({ maxOrder: sql<number>`COALESCE(MAX(${brainstormItems.sortOrder}), -1)` })
      .from(brainstormItems)
      .where(and(
        eq(brainstormItems.boardId, data.boardId),
        eq(brainstormItems.section, data.section),
      ));

    const sortOrder = data.sortOrder ?? ((maxRow?.maxOrder ?? -1) + 1);

    const [result] = await tx.insert(brainstormItems).values({
      boardId: data.boardId,
      section: data.section,
      content: data.content,
      status: data.status,
      attachmentUrl: data.attachmentUrl ?? null,
      attachmentType: data.attachmentType ?? null,
      sortOrder,
    }).$returningId();

    return { id: result.id, ...data, sortOrder };
  });
}

export async function updateBrainstormItem(itemId: number, data: {
  content?: string;
  status?: string;
  section?: "ideias" | "fatos" | "questoes" | "metas";
  attachmentUrl?: string | null;
  attachmentType?: "link" | "image" | "video" | "photo" | "document" | null;
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const updateData: Record<string, unknown> = {};
  if (data.content !== undefined) updateData.content = data.content;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.section !== undefined) updateData.section = data.section;
  if (data.attachmentUrl !== undefined) updateData.attachmentUrl = data.attachmentUrl;
  if (data.attachmentType !== undefined) updateData.attachmentType = data.attachmentType;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  if (Object.keys(updateData).length > 0) {
    await db.update(brainstormItems).set(updateData as any).where(eq(brainstormItems.id, itemId));
  }

  const [updated] = await db.select().from(brainstormItems).where(eq(brainstormItems.id, itemId)).limit(1);
  return updated;
}

export async function deleteBrainstormItem(itemId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Delete all attachments for this item first
  await db.delete(brainstormItemAttachments).where(eq(brainstormItemAttachments.itemId, itemId));
  await db.delete(brainstormItems).where(eq(brainstormItems.id, itemId));
}

export async function moveBrainstormItem(itemId: number, targetSection: "ideias" | "fatos" | "questoes" | "metas") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  return db.transaction(async (tx) => {
    // Get current item
    const [item] = await tx.select().from(brainstormItems).where(eq(brainstormItems.id, itemId)).limit(1);
    if (!item) throw new Error("Item not found");

    // Don't move to the same section
    if (item.section === targetSection) {
      return item;
    }

    // Set default status for target section
    const defaultStatusMap: Record<string, string> = {
      ideias: "analise",
      fatos: "verificar",
      questoes: "duvida",
      metas: "planejada",
    };
    const defaultStatus = defaultStatusMap[targetSection] || "analise";

    // Get max sortOrder in target section atomically
    const [maxRow] = await tx.select({ maxOrder: sql<number>`COALESCE(MAX(${brainstormItems.sortOrder}), -1)` })
      .from(brainstormItems)
      .where(and(
        eq(brainstormItems.boardId, item.boardId),
        eq(brainstormItems.section, targetSection),
      ));

    await tx.update(brainstormItems).set({
      section: targetSection,
      status: defaultStatus,
      sortOrder: (maxRow?.maxOrder ?? -1) + 1,
    }).where(eq(brainstormItems.id, itemId));

    const [updated] = await tx.select().from(brainstormItems).where(eq(brainstormItems.id, itemId)).limit(1);
    return updated;
  });
}

export async function getBrainstormBoardWithItems(sessionId: number) {
  const db = await getDb();
  if (!db) return null;

  const board = await getBrainstormBoard(sessionId);
  if (!board) {
    // Even if no board, return session label for display
    const [session] = await db.select({ label: sessions.label }).from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    return { id: 0, sessionId, mesaStudentId: 0, sessionLabel: session?.label || '', items: [], createdAt: new Date(), updatedAt: new Date(), noBoard: true };
  }

  const items = await getBrainstormItems(board.id);
  // Fetch all attachments for all items in one query
  const itemIds = items.map(i => i.id);
  const allAttachments = itemIds.length > 0 ? await getAttachmentsByItemIds(itemIds) : [];
  const attachmentsByItem = new Map<number, BrainstormItemAttachment[]>();
  for (const att of allAttachments) {
    if (!attachmentsByItem.has(att.itemId)) attachmentsByItem.set(att.itemId, []);
    attachmentsByItem.get(att.itemId)!.push(att);
  }
  const itemsWithAttachments = items.map(item => ({
    ...item,
    attachments: attachmentsByItem.get(item.id) || [],
  }));
  const [session] = await db.select({ label: sessions.label }).from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  return { ...board, sessionLabel: session?.label || '', items: itemsWithAttachments };
}

export async function getComponentSessionsForSharing(sessionId: number) {
  const db = await getDb();
  if (!db) return [];

  // sessions -> classes -> componentId
  const [sourceInfo] = await db.select({
    componentId: classes.componentId,
  }).from(sessions)
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .where(eq(sessions.id, sessionId)).limit(1);

  if (!sourceInfo) return [];

  const allSessions = await db.select({
    id: sessions.id,
    label: sessions.label,
    status: sessions.status,
  }).from(sessions)
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .where(and(
      eq(classes.componentId, sourceInfo.componentId),
      sql`${sessions.id} != ${sessionId}`
    ));

  const result = [];
  for (const s of allSessions) {
    const board = await getBrainstormBoard(s.id);
    result.push({ ...s, hasBoard: !!board });
  }
  return result;
}

export async function shareBrainstormBoard(sessionId: number, targetSessionIds?: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // Get source board
  const sourceBoard = await getBrainstormBoardWithItems(sessionId);
  if (!sourceBoard || (sourceBoard as any).noBoard) {
    throw new Error("Quadro de brainstorming não encontrado para esta sessão");
  }

  // sessions -> classes -> componentId
  const [sourceInfo] = await db.select({
    componentId: classes.componentId,
  }).from(sessions)
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .where(eq(sessions.id, sessionId)).limit(1);

  if (!sourceInfo) throw new Error("Sessão não encontrada");

  // Get target sessions
  let targetIds = targetSessionIds;
  if (!targetIds || targetIds.length === 0) {
    const allSessions = await db.select({ id: sessions.id }).from(sessions)
      .innerJoin(classes, eq(sessions.classId, classes.id))
      .where(and(
        eq(classes.componentId, sourceInfo.componentId),
        sql`${sessions.id} != ${sessionId}`
      ));
    targetIds = allSessions.map(s => s.id);
  }

  let sharedCount = 0;
  for (const targetSessionId of targetIds) {
    const existingBoard = await getBrainstormBoard(targetSessionId);
    if (existingBoard) continue;

    const newBoard = await getOrCreateBrainstormBoard(targetSessionId, sourceBoard.mesaStudentId);

    for (const item of sourceBoard.items) {
      await addBrainstormItem({
        boardId: newBoard.id,
        section: item.section as "ideias" | "fatos" | "questoes" | "metas",
        content: item.content,
        status: item.status,
        attachmentUrl: item.attachmentUrl,
        attachmentType: item.attachmentType as "link" | "image" | "video" | "photo" | null,
        sortOrder: item.sortOrder,
      });
    }
    sharedCount++;
  }

  return { sharedCount, totalTargets: targetIds.length };
}

// ─── Update tutor comments on brainstorm board ───
export async function updateTutorComments(sessionId: number, comments: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const board = await getBrainstormBoard(sessionId);
  if (!board) throw new Error("Quadro não encontrado");
  await db.update(brainstormBoards).set({ tutorComments: comments }).where(eq(brainstormBoards.id, board.id));
  return true;
}

// ─── Get all students from the same component as a session (across all classes) ───
export async function getStudentsByComponentFromSession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];

  // Find the componentId from the session
  const [sessionInfo] = await db.select({
    componentId: classes.componentId,
    componentCode: components.code,
    componentName: components.name,
  }).from(sessions)
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .innerJoin(components, eq(classes.componentId, components.id))
    .where(eq(sessions.id, sessionId)).limit(1);

  if (!sessionInfo) return [];

  // Get all classes for this component
  const componentClasses = await db.select({ id: classes.id }).from(classes)
    .where(eq(classes.componentId, sessionInfo.componentId));

  if (componentClasses.length === 0) return [];

  const classIds = componentClasses.map(c => c.id);

  // Get all students from those classes (distinct)
  const rows = await db.selectDistinct({
    id: students.id,
    name: students.name,
    email: students.email,
    enrollment: students.enrollment,
  }).from(classStudents)
    .innerJoin(students, eq(classStudents.studentId, students.id))
    .where(inArray(classStudents.classId, classIds));

  return rows;
}

// ─── Brainstorm Board Send History ───

export async function addBoardSendHistory(data: {
  sessionId: number;
  sentByName: string;
  sentByRole: string;
  recipientCount: number;
  failCount: number;
}) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.insert(brainstormBoardSendHistory).values(data).$returningId();
  return row;
}

export async function getBoardSendHistory(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(brainstormBoardSendHistory)
    .where(eq(brainstormBoardSendHistory.sessionId, sessionId))
    .orderBy(desc(brainstormBoardSendHistory.sentAt));
}

export async function getLastBoardSend(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(brainstormBoardSendHistory)
    .where(eq(brainstormBoardSendHistory.sessionId, sessionId))
    .orderBy(desc(brainstormBoardSendHistory.sentAt))
    .limit(1);
  return row || null;
}
