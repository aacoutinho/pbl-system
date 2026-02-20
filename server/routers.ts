import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  listStudents, createStudent, deleteStudent, getStudentByEmail, bulkCreateStudents,
  createSession, listSessions, getSessionStudents, closeSession, openSession, deleteSession, getSessionById,
  submitEvaluation, getSessionEvaluations, hasStudentSubmitted,
  calculateSessionResults, calculateProblemResults, getDashboardStats,
} from "./db";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores" });
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

  // ─── Students ───
  students: router({
    list: protectedProcedure.query(async () => {
      return listStudents();
    }),
    create: adminProcedure.input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
    })).mutation(async ({ input }) => {
      return createStudent(input);
    }),
    bulkCreate: adminProcedure.input(z.object({
      students: z.array(z.object({
        name: z.string().min(1),
        email: z.string().email(),
      })),
    })).mutation(async ({ input }) => {
      return bulkCreateStudents(input.students);
    }),
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteStudent(input.id);
      return { success: true };
    }),
    me: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user.email) return null;
      return getStudentByEmail(ctx.user.email);
    }),
  }),

  // ─── Sessions ───
  sessions: router({
    list: protectedProcedure.query(async () => {
      return listSessions();
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getSessionById(input.id);
    }),
    create: adminProcedure.input(z.object({
      problemNumber: z.number().min(1).max(10),
      sessionNumber: z.number().min(1).max(10),
      label: z.string().min(1),
      studentIds: z.array(z.number()),
    })).mutation(async ({ input }) => {
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

  // ─── Results & Dashboard ───
  results: router({
    session: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => {
      return calculateSessionResults(input.sessionId);
    }),
    problem: protectedProcedure.input(z.object({ problemNumber: z.number() })).query(async ({ input }) => {
      return calculateProblemResults(input.problemNumber);
    }),
    dashboard: adminProcedure.query(async () => {
      return getDashboardStats();
    }),
  }),
});

export type AppRouter = typeof appRouter;
