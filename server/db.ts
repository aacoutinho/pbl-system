import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  students, InsertStudent, Student,
  sessions, InsertSession, Session,
  sessionStudents,
  evaluations,
  evaluationItems, EvaluationItem,
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

// ─── Student helpers ───
export async function createStudent(data: InsertStudent) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(students).values(data);
  const [row] = await db.select().from(students).where(eq(students.email, data.email)).limit(1);
  return row;
}

export async function listStudents() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(students).orderBy(students.name);
}

export async function deleteStudent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(students).where(eq(students.id, id));
}

export async function getStudentByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(students).where(eq(students.email, email)).limit(1);
  return row;
}

export async function bulkCreateStudents(data: InsertStudent[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (data.length === 0) return;
  for (const s of data) {
    await db.insert(students).values(s).onDuplicateKeyUpdate({ set: { name: s.name } });
  }
  return listStudents();
}

// ─── Session helpers ───
export async function createSession(data: InsertSession & { studentIds: number[] }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(sessions).values({
    problemNumber: data.problemNumber,
    sessionNumber: data.sessionNumber,
    label: data.label,
    status: data.status ?? "open",
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

export async function listSessions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessions).orderBy(desc(sessions.createdAt));
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
  // Delete all related data
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

  // Map evaluationId -> evaluatorStudentId
  const evalToEvaluator = new Map<number, number>();
  for (const e of evals) evalToEvaluator.set(e.id, e.evaluatorStudentId);

  // Determine roles by majority vote (excluding self-evaluations)
  const roleCounts: Record<number, Record<string, number>> = {};
  for (const item of allItems) {
    const evaluatorId = evalToEvaluator.get(item.evaluationId);
    if (evaluatorId === item.evaluatedStudentId) continue; // skip self
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

    // Check if student is absent (majority marked absent)
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

    // Calculate valid scores (non-absent, non-self)
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
export async function calculateProblemResults(problemNumber: number) {
  const db = await getDb();
  if (!db) return [];
  const problemSessions = await db.select().from(sessions).where(eq(sessions.problemNumber, problemNumber));
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

// ─── Dashboard stats ───
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { totalStudents: 0, totalSessions: 0, openSessions: 0, totalEvaluations: 0 };
  const [studentCount] = await db.select({ count: sql<number>`count(*)` }).from(students);
  const [sessionCount] = await db.select({ count: sql<number>`count(*)` }).from(sessions);
  const [openCount] = await db.select({ count: sql<number>`count(*)` }).from(sessions).where(eq(sessions.status, "open"));
  const [evalCount] = await db.select({ count: sql<number>`count(*)` }).from(evaluations);
  return {
    totalStudents: Number(studentCount.count),
    totalSessions: Number(sessionCount.count),
    openSessions: Number(openCount.count),
    totalEvaluations: Number(evalCount.count),
  };
}
