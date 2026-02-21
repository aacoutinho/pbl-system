import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  classes, InsertClass, Class,
  students, InsertStudent, Student,
  sessions, InsertSession, Session,
  sessionStudents,
  evaluations,
  evaluationItems, EvaluationItem,
  tutorialEvaluations, TutorialEvaluation,
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
  // Delete all related data: evaluationItems -> evaluations -> sessionStudents -> sessions -> students -> class
  const classSessions = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.classId, id));
  if (classSessions.length > 0) {
    const sessionIds = classSessions.map(s => s.id);
    const evals = await db.select({ id: evaluations.id }).from(evaluations).where(inArray(evaluations.sessionId, sessionIds));
    if (evals.length > 0) {
      const evalIds = evals.map(e => e.id);
      await db.delete(evaluationItems).where(inArray(evaluationItems.evaluationId, evalIds));
      await db.delete(evaluations).where(inArray(evaluations.sessionId, sessionIds));
    }
    await db.delete(sessionStudents).where(inArray(sessionStudents.sessionId, sessionIds));
    await db.delete(sessions).where(eq(sessions.classId, id));
  }
  await db.delete(students).where(eq(students.classId, id));
  await db.delete(classes).where(eq(classes.id, id));
}

// Helper to find which classes a student (by email) belongs to
export async function getClassesForStudentEmail(email: string) {
  const db = await getDb();
  if (!db) return [];
  const studentRows = await db.select({
    classId: students.classId,
    studentId: students.id,
    studentName: students.name,
    classCode: classes.classCode,
    componentCode: classes.componentCode,
    semester: classes.semester,
  })
    .from(students)
    .innerJoin(classes, eq(students.classId, classes.id))
    .where(eq(students.email, email));
  return studentRows;
}

// ─── Student helpers ───
export async function createStudent(data: InsertStudent) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(students).values(data);
  const [row] = await db.select().from(students)
    .where(and(eq(students.email, data.email), eq(students.classId, data.classId)))
    .limit(1);
  return row;
}

export async function listStudentsByClass(classId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(students).where(eq(students.classId, classId)).orderBy(students.name);
}

export async function deleteStudent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(sessionStudents).where(eq(sessionStudents.studentId, id));
  await db.delete(students).where(eq(students.id, id));
}

export async function getStudentByEmailAndClass(email: string, classId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(students)
    .where(and(eq(students.email, email), eq(students.classId, classId)))
    .limit(1);
  return row;
}

export async function bulkCreateStudents(data: InsertStudent[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (data.length === 0) return;
  for (const s of data) {
    await db.insert(students).values(s).onDuplicateKeyUpdate({ set: { name: s.name } });
  }
  return listStudentsByClass(data[0].classId);
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

// ─── Calculation engine ───
export interface SessionResult {
  studentId: number;
  studentName: string;
  studentEmail: string;
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

  const allResults: Record<number, { name: string; email: string; scores: number[]; roles: string[] }> = {};
  for (const sess of problemSessions) {
    const results = await calculateSessionResults(sess.id);
    for (const r of results) {
      if (!allResults[r.studentId]) {
        allResults[r.studentId] = { name: r.studentName, email: r.studentEmail, scores: [], roles: [] };
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

  // Check if already submitted – if so, update
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
  studentEmail: string;
  role: string;
  peerScore: number;       // média avaliação pelos pares (0-10)
  finalGrade: number;      // nota final de desempenho (distribuição proporcional)
  absent: boolean;
  validEvaluations: number;
}

export async function calculateFinalGrades(sessionId: number): Promise<FinalGradeResult[]> {
  const peerResults = await calculateSessionResults(sessionId);
  const tutorialEval = await getTutorialEvaluation(sessionId);

  if (!tutorialEval) {
    // No tutorial evaluation yet, return peer results only with finalGrade = 0
    return peerResults.map(r => ({
      studentId: r.studentId,
      studentName: r.studentName,
      studentEmail: r.studentEmail,
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
    name: string; email: string;
    peerScores: number[]; finalGrades: number[]; roles: string[];
  }> = {};

  for (const sess of problemSessions) {
    const results = await calculateFinalGrades(sess.id);
    for (const r of results) {
      if (!allResults[r.studentId]) {
        allResults[r.studentId] = { name: r.studentName, email: r.studentEmail, peerScores: [], finalGrades: [], roles: [] };
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

// ─── Bulk import students with enrollment ───
export async function bulkCreateStudentsWithEnrollment(data: { name: string; email: string; enrollment?: string; classId: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (data.length === 0) return;
  for (const s of data) {
    const values: any = { name: s.name, email: s.email, classId: s.classId };
    if (s.enrollment) values.enrollment = s.enrollment;
    const updateSet: any = { name: s.name };
    if (s.enrollment) updateSet.enrollment = s.enrollment;
    await db.insert(students).values(values).onDuplicateKeyUpdate({ set: updateSet });
  }
  return listStudentsByClass(data[0].classId);
}

// ─── Dashboard stats (scoped to professor's classes) ───
export async function getDashboardStats(professorUserId: number) {
  const db = await getDb();
  if (!db) return { totalStudents: 0, totalSessions: 0, openSessions: 0, totalEvaluations: 0, totalClasses: 0 };

  const professorClasses = await db.select({ id: classes.id }).from(classes).where(eq(classes.professorUserId, professorUserId));
  if (professorClasses.length === 0) return { totalStudents: 0, totalSessions: 0, openSessions: 0, totalEvaluations: 0, totalClasses: 0 };

  const classIds = professorClasses.map(c => c.id);

  const [studentCount] = await db.select({ count: sql<number>`count(*)` }).from(students).where(inArray(students.classId, classIds));
  const [sessionCount] = await db.select({ count: sql<number>`count(*)` }).from(sessions).where(inArray(sessions.classId, classIds));
  const [openCount] = await db.select({ count: sql<number>`count(*)` }).from(sessions).where(and(inArray(sessions.classId, classIds), eq(sessions.status, "open")));

  // Count evaluations for sessions in these classes
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
    .from(students)
    .innerJoin(classes, eq(students.classId, classes.id))
    .where(inArray(students.classId, classIds))
    .orderBy(students.name);
  return rows;
}

// ─── Session access code helpers ───
export async function generateAccessCode(sessionId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Generate a 6-char alphanumeric code (uppercase, no ambiguous chars)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1
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

export async function findStudentByEmailUsername(emailUsername: string, classId: number) {
  const db = await getDb();
  if (!db) return undefined;
  // Find student whose email starts with the given username (before @)
  const classStudents = await db.select().from(students).where(eq(students.classId, classId));
  const normalized = emailUsername.toLowerCase().trim();
  return classStudents.find(s => {
    const emailUser = s.email.split("@")[0].toLowerCase();
    return emailUser === normalized;
  });
}
