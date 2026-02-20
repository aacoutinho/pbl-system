import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createClass, listClassesByProfessor, updateClass, deleteClass, getClassById, getClassesForStudentEmail,
  listStudentsByClass, createStudent, deleteStudent, getStudentByEmailAndClass, bulkCreateStudents,
  bulkCreateStudentsWithEnrollment, listAllClasses,
  createSession, listSessionsByClass, getSessionStudents, closeSession, openSession, deleteSession, getSessionById,
  submitEvaluation, getSessionEvaluations, hasStudentSubmitted,
  calculateSessionResults, calculateProblemResults, getDashboardStats,
  submitTutorialEvaluation, getTutorialEvaluation, calculateTutorialGrade,
  calculateFinalGrades, calculateProblemFinalGrades,
} from "./db";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a professores" });
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Classes (turmas) ───
  classes: router({
    list: adminProcedure.query(async ({ ctx }) => {
      return listClassesByProfessor(ctx.user.id);
    }),
    create: adminProcedure.input(z.object({
      name: z.string().min(1),
      code: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      return createClass({ ...input, professorUserId: ctx.user.id });
    }),
    update: adminProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      code: z.string().min(1).optional(),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.id);
      if (!cls || cls.professorUserId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      return updateClass(input.id, { name: input.name, code: input.code });
    }),
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.id);
      if (!cls || cls.professorUserId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await deleteClass(input.id);
      return { success: true };
    }),
    // For students: list classes they belong to
    myClasses: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user.email) return [];
      return getClassesForStudentEmail(ctx.user.email);
    }),
    // All classes (for cross-class results visibility)
    listAll: adminProcedure.query(async () => {
      return listAllClasses();
    }),
  }),

  // ─── Students ───
  students: router({
    list: adminProcedure.input(z.object({ classId: z.number() })).query(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls || cls.professorUserId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      return listStudentsByClass(input.classId);
    }),
    create: adminProcedure.input(z.object({
      classId: z.number(),
      name: z.string().min(1),
      email: z.string().email(),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls || cls.professorUserId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      return createStudent({ name: input.name, email: input.email.toLowerCase(), classId: input.classId });
    }),
    bulkCreate: adminProcedure.input(z.object({
      classId: z.number(),
      students: z.array(z.object({
        name: z.string().min(1),
        email: z.string().email(),
      })),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls || cls.professorUserId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      return bulkCreateStudents(input.students.map(s => ({ ...s, email: s.email.toLowerCase(), classId: input.classId })));
    }),
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteStudent(input.id);
      return { success: true };
    }),
    importCSV: adminProcedure.input(z.object({
      classId: z.number(),
      csvContent: z.string(),
      emailDomain: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls || cls.professorUserId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Turma n\u00e3o encontrada" });

      // Parse CSV from SAGRES system (semicolon-separated, ISO-8859-1)
      const lines = input.csvContent.split("\n");
      const parsedStudents: { name: string; email: string; enrollment: string }[] = [];

      for (const line of lines) {
        const cols = line.split(";");
        // Student rows have a number in col[1] and name in col[4]
        const num = cols[1]?.trim();
        if (!num || isNaN(parseInt(num))) continue;
        const enrollment = cols[3]?.trim();
        const name = cols[4]?.trim();
        if (!name || !enrollment) continue;
        // Skip header row
        if (name === "Aluno" || enrollment === "Matr\u00edcula") continue;

        // Generate email from name if domain provided
        let email = "";
        if (input.emailDomain) {
          // Generate email: first.last@domain
          const parts = name.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .split(/\s+/);
          if (parts.length >= 2) {
            email = `${parts[0]}.${parts[parts.length - 1]}@${input.emailDomain}`;
          } else {
            email = `${parts[0]}@${input.emailDomain}`;
          }
        } else {
          email = `${enrollment}@placeholder.com`;
        }

        parsedStudents.push({ name, email, enrollment });
      }

      if (parsedStudents.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum aluno encontrado no CSV. Verifique se o formato \u00e9 compat\u00edvel com a Folha de Frequ\u00eancia do SAGRES." });
      }

      await bulkCreateStudentsWithEnrollment(
        parsedStudents.map(s => ({ ...s, classId: input.classId }))
      );

      return { success: true, count: parsedStudents.length, students: parsedStudents };
    }),
    me: protectedProcedure.input(z.object({ classId: z.number() })).query(async ({ ctx, input }) => {
      if (!ctx.user.email) return null;
      return getStudentByEmailAndClass(ctx.user.email, input.classId);
    }),
  }),

  // ─── Sessions ───
  sessions: router({
    list: adminProcedure.input(z.object({ classId: z.number() })).query(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls || cls.professorUserId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      return listSessionsByClass(input.classId);
    }),
    // For students: list sessions for a class (no admin check)
    listForStudent: protectedProcedure.input(z.object({ classId: z.number() })).query(async ({ input }) => {
      return listSessionsByClass(input.classId);
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getSessionById(input.id);
    }),
    create: adminProcedure.input(z.object({
      classId: z.number(),
      problemNumber: z.number().min(1).max(10),
      sessionNumber: z.number().min(1).max(10),
      label: z.string().min(1),
      studentIds: z.array(z.number()),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls || cls.professorUserId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      return createSession(input);
    }),
    getStudents: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => {
      return getSessionStudents(input.sessionId);
    }),
    close: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await closeSession(input.id);
      return { success: true };
    }),
    open: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await openSession(input.id);
      return { success: true };
    }),
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteSession(input.id);
      return { success: true };
    }),
    submissionStatus: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => {
      const sessionStudentsList = await getSessionStudents(input.sessionId);
      const evals = await getSessionEvaluations(input.sessionId);
      const submittedIds = new Set(evals.map(e => e.evaluatorStudentId));
      return sessionStudentsList.map(s => ({
        ...s,
        submitted: submittedIds.has(s.studentId),
      }));
    }),
  }),

  // ─── Evaluations ───
  evaluations: router({
    submit: protectedProcedure.input(z.object({
      sessionId: z.number(),
      evaluatorStudentId: z.number(),
      items: z.array(z.object({
        evaluatedStudentId: z.number(),
        role: z.enum(["COORDENADOR", "MESA", "QUADRO", "PARTICIPANTE"]),
        absent: z.boolean(),
        atuacao: z.number().min(0).max(2),
        pontualidade: z.number().min(0).max(2),
        dominio: z.number().min(0).max(2),
        metas: z.number().min(0).max(2),
        participacao: z.number().min(0).max(2),
      })),
    })).mutation(async ({ input }) => {
      // Validate: evaluator cannot evaluate self
      const selfEval = input.items.find(i => i.evaluatedStudentId === input.evaluatorStudentId);
      if (selfEval) throw new TRPCError({ code: "BAD_REQUEST", message: "Autoavaliação não é permitida" });

      // Validate exclusive roles
      const exclusiveRoles = ["COORDENADOR", "MESA", "QUADRO"];
      for (const role of exclusiveRoles) {
        const count = input.items.filter(i => i.role === role && !i.absent).length;
        if (count > 1) throw new TRPCError({ code: "BAD_REQUEST", message: `O papel ${role} só pode ser atribuído a um aluno` });
      }

      const evalId = await submitEvaluation(input);
      return { success: true, evaluationId: evalId };
    }),
    hasSubmitted: protectedProcedure.input(z.object({
      sessionId: z.number(),
      studentId: z.number(),
    })).query(async ({ input }) => {
      return hasStudentSubmitted(input.sessionId, input.studentId);
    }),
  }),

  // ─── Tutorial Evaluation (professor evaluates session) ───
  tutorialEval: router({
    submit: adminProcedure.input(z.object({
      sessionId: z.number(),
      organizacao: z.number().min(0).max(1),
      cooperacao: z.number().min(0).max(1),
      conteudo: z.number().min(0).max(1),
      objetivo: z.number().min(0).max(1),
      metas: z.number().min(0).max(1),
    })).mutation(async ({ ctx, input }) => {
      const evalId = await submitTutorialEvaluation({
        ...input,
        professorUserId: ctx.user.id,
      });
      return { success: true, evaluationId: evalId };
    }),
    get: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => {
      const eval_ = await getTutorialEvaluation(input.sessionId);
      if (!eval_) return null;
      const grade = calculateTutorialGrade(eval_);
      return { ...eval_, tutorialGrade: Math.round(grade * 10) / 10 };
    }),
  }),

  // ─── Results & Dashboard ───
  results: router({
    session: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => {
      return calculateSessionResults(input.sessionId);
    }),
    sessionFinal: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => {
      return calculateFinalGrades(input.sessionId);
    }),
    problem: adminProcedure.input(z.object({ classId: z.number(), problemNumber: z.number() })).query(async ({ input }) => {
      return calculateProblemResults(input.classId, input.problemNumber);
    }),
    problemFinal: adminProcedure.input(z.object({ classId: z.number(), problemNumber: z.number() })).query(async ({ input }) => {
      return calculateProblemFinalGrades(input.classId, input.problemNumber);
    }),
    // List sessions for any class (cross-class visibility)
    sessionsForClass: adminProcedure.input(z.object({ classId: z.number() })).query(async ({ input }) => {
      return listSessionsByClass(input.classId);
    }),
    dashboard: adminProcedure.query(async ({ ctx }) => {
      return getDashboardStats(ctx.user.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;
