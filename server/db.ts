import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  classes, InsertClass, Class,
  students, InsertStudent, Student,
  classStudents,
  sessions, InsertSession, Session,
  sessionStudents,
  evaluations,
  evaluationItems, EvaluationItem,
  tutorialEvaluations, TutorialEvaluation,
  professorComponents, InsertProfessorComponent,
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
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
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

// ─── Class helpers ───
export async function createClass(data: { classCode: string; componentCode: string; semester: string; professorUserId: number }) {
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
  return db.select().from(classes).where(eq(classes.professorUserId, professorUserId)).orderBy(classes.componentCode, classes.classCode);
}

export async function updateClass(id: number, data: { classCode?: string; componentCode?: string; semester?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateSet: Record<string, unknown> = {};
  if (data.classCode !== undefined) updateSet.classCode = data.classCode;
  if (data.componentCode !== undefined) updateSet.componentCode = data.componentCode;
  if (data.semester !== undefined) updateSet.semester = data.semester;
  if (Object.keys(updateSet).length > 0) {
    await db.update(classes).set(updateSet).where(eq(classes.id, id));
  }
  return getClassById(id);
}

export async function deleteClass(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Delete all related data: evaluationItems -> evaluations -> sessionStudents -> sessions -> classStudents -> class
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
  // Remove class-student links
  await db.delete(classStudents).where(eq(classStudents.classId, id));
  // Clean up orphan students (students not linked to any other class)
  await cleanupOrphanStudents();
  await db.delete(classes).where(eq(classes.id, id));
}

// ─── Student helpers (new structure: students identified by enrollment) ───

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

// List students for a specific class (via classStudents join table)
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

// Add student to class (creates link in classStudents)
export async function addStudentToClass(studentId: number, classId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(classStudents).values({ studentId, classId }).onDuplicateKeyUpdate({ set: { studentId } });
}

// Check if student is already in a class of the same component
export async function isStudentInComponentClass(studentId: number, componentCode: string, excludeClassId?: number) {
  const db = await getDb();
  if (!db) return false;
  const links = await db.select({
    classId: classStudents.classId,
    componentCode: classes.componentCode,
  })
    .from(classStudents)
    .innerJoin(classes, eq(classStudents.classId, classes.id))
    .where(and(
      eq(classStudents.studentId, studentId),
      eq(classes.componentCode, componentCode),
    ));
  if (excludeClassId) {
    return links.some(l => l.classId !== excludeClassId);
  }
  return links.length > 0;
}

// Remove student from class. If student has no more classes, delete student entirely.
export async function removeStudentFromClass(studentId: number, classId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Remove from session_students for sessions of this class
  const classSessions = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.classId, classId));
  if (classSessions.length > 0) {
    const sessionIds = classSessions.map(s => s.id);
    await db.delete(sessionStudents).where(
      and(eq(sessionStudents.studentId, studentId), inArray(sessionStudents.sessionId, sessionIds))
    );
  }
  // Remove class-student link
  await db.delete(classStudents).where(and(eq(classStudents.studentId, studentId), eq(classStudents.classId, classId)));
  // Check if student still belongs to any class
  const remaining = await db.select({ id: classStudents.id }).from(classStudents).where(eq(classStudents.studentId, studentId));
  if (remaining.length === 0) {
    // Delete student entirely (no more classes)
    // First clean up evaluations
    const evals = await db.select({ id: evaluations.id }).from(evaluations).where(eq(evaluations.evaluatorStudentId, studentId));
    if (evals.length > 0) {
      const evalIds = evals.map(e => e.id);
      await db.delete(evaluationItems).where(inArray(evaluationItems.evaluationId, evalIds));
      await db.delete(evaluations).where(eq(evaluations.evaluatorStudentId, studentId));
    }
    // Delete evaluation items where student was evaluated
    await db.delete(evaluationItems).where(eq(evaluationItems.evaluatedStudentId, studentId));
    await db.delete(students).where(eq(students.id, studentId));
  }
}

// Clean up orphan students (students not linked to any class)
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

// Bulk import students: create or find by enrollment, link to class
export async function bulkImportStudents(data: { name: string; enrollment: string; classId: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (data.length === 0) return [];
  
  const cls = await getClassById(data[0].classId);
  if (!cls) throw new Error("Class not found");
  
  const results: { name: string; enrollment: string; status: "created" | "linked" | "already_in_class" | "conflict" }[] = [];
  
  for (const s of data) {
    // Check if student already exists by enrollment
    const existing = await getStudentByEnrollment(s.enrollment);
    
    if (existing) {
      // Check if already in this class
      const link = await db.select().from(classStudents)
        .where(and(eq(classStudents.studentId, existing.id), eq(classStudents.classId, s.classId)))
        .limit(1);
      
      if (link.length > 0) {
        // Already in this class, update name if different
        if (existing.name !== s.name) {
          await db.update(students).set({ name: s.name }).where(eq(students.id, existing.id));
        }
        results.push({ name: s.name, enrollment: s.enrollment, status: "already_in_class" });
        continue;
      }
      
      // Check if student is already in another class of the same component
      const inComponent = await isStudentInComponentClass(existing.id, cls.componentCode, s.classId);
      if (inComponent) {
        results.push({ name: s.name, enrollment: s.enrollment, status: "conflict" });
        continue;
      }
      
      // Link existing student to this class
      await addStudentToClass(existing.id, s.classId);
      // Update name if different
      if (existing.name !== s.name) {
        await db.update(students).set({ name: s.name }).where(eq(students.id, existing.id));
      }
      results.push({ name: s.name, enrollment: s.enrollment, status: "linked" });
    } else {
      // Create new student
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

  // Check if already submitted – if so, delete old and re-submit
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
  // Find the evaluation
  const rows = await db.select().from(evaluations)
    .where(and(eq(evaluations.sessionId, sessionId), eq(evaluations.evaluatorStudentId, studentId)))
    .limit(1);
  if (rows.length === 0) return false;
  const evaluationId = rows[0].id;
  // Delete evaluation items first
  await db.delete(evaluationItems).where(eq(evaluationItems.evaluationId, evaluationId));
  // Delete evaluation
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

  // Determine roles by majority vote (excluding self-evaluations)
  const roleCounts: Record<number, Record<string, number>> = {};
  for (const item of allItems) {
    const evaluatorId = evalToEvaluator.get(item.evaluationId);
    if (evaluatorId === item.evaluatedStudentId) continue;
    if (!roleCounts[item.evaluatedStudentId]) roleCounts[item.evaluatedStudentId] = {};
    const r = item.role;
    roleCounts[item.evaluatedStudentId][r] = (roleCounts[item.evaluatedStudentId][r] || 0) + 1;
  }

  // Assign exclusive roles
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

  // Determine absences and calculate scores
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

// ─── Multi-session aggregation ───
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

// ─── Tutorial Evaluation helpers (professor evaluates session) ───
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

// Calculate weighted tutorial grade: Org×1 + Coop×1 + Cont×3 + Obj×3 + Metas×2 = total weight 10
export function calculateTutorialGrade(eval_: { organizacao: string; cooperacao: string; conteudo: string; objetivo: string; metas: string }): number {
  const org = Number(eval_.organizacao);
  const coop = Number(eval_.cooperacao);
  const cont = Number(eval_.conteudo);
  const obj = Number(eval_.objetivo);
  const met = Number(eval_.metas);
  return org * 1 + coop * 1 + cont * 3 + obj * 3 + met * 2;
}

// ─── Final grade calculation (proportional distribution) ───
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

// ─── Problem-level final grades ───
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

// ─── List all classes (for cross-class visibility) ───
export async function listAllClasses() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: classes.id,
    classCode: classes.classCode,
    componentCode: classes.componentCode,
    semester: classes.semester,
    professorUserId: classes.professorUserId,
    professorName: users.name,
    createdAt: classes.createdAt,
  })
    .from(classes)
    .leftJoin(users, eq(classes.professorUserId, users.id))
    .orderBy(classes.componentCode, classes.classCode);
  return rows;
}

// ─── Export: list students with class info for Google Workspace CSV ───
export async function listStudentsForExport(classIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (classIds.length === 0) return [];
  const rows = await db.select({
    studentName: students.name,
    studentEmail: students.email,
    studentEnrollment: students.enrollment,
    classCode: classes.classCode,
    componentCode: classes.componentCode,
    semester: classes.semester,
  })
    .from(classStudents)
    .innerJoin(students, eq(classStudents.studentId, students.id))
    .innerJoin(classes, eq(classStudents.classId, classes.id))
    .where(inArray(classStudents.classId, classIds))
    .orderBy(students.name);
  return rows;
}

// ─── Dashboard stats (scoped to professor's classes) ───
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

// Find student by enrollment (matrícula) in a class
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

// ─── Professor Authorization helpers ───

export async function approveUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ approvalStatus: "approved", role: "admin" }).where(eq(users.id, userId));
}

export async function rejectUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ approvalStatus: "rejected" }).where(eq(users.id, userId));
}

export async function listPendingProfessors() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.approvalStatus, "pending")).orderBy(desc(users.createdAt));
}

export async function listApprovedProfessors() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.approvalStatus, "approved")).orderBy(users.name);
}

export async function addProfessorComponent(userId: number, componentCode: string, authorizedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(professorComponents).values({
    userId,
    componentCode: componentCode.toUpperCase(),
    authorizedByUserId,
  }).onDuplicateKeyUpdate({ set: { authorizedByUserId } });
}

export async function removeProfessorComponent(userId: number, componentCode: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(professorComponents).where(
    and(eq(professorComponents.userId, userId), eq(professorComponents.componentCode, componentCode.toUpperCase()))
  );
}

export async function listProfessorComponents(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(professorComponents).where(eq(professorComponents.userId, userId));
}

export async function listAllProfessorComponents() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: professorComponents.id,
    userId: professorComponents.userId,
    componentCode: professorComponents.componentCode,
    authorizedAt: professorComponents.authorizedAt,
    authorizedByUserId: professorComponents.authorizedByUserId,
    professorName: users.name,
    professorEmail: users.email,
  })
    .from(professorComponents)
    .innerJoin(users, eq(professorComponents.userId, users.id))
    .orderBy(professorComponents.componentCode, users.name);
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row;
}

// ─── Email/Password Auth helpers ───
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
  role: "user" | "admin";
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
