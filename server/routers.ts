import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  createClass, listClassesByProfessor, listClassesByComponents, updateClass, deleteClass, getClassById,
  listStudentsByClass, createStudent, updateStudent, removeStudentFromClass, getStudentByEnrollment,
  addStudentToClass, isStudentInComponentClass, bulkImportStudents,
  listAllClasses, listStudentsForExport, updateStudentEmail,
  createSession, listSessionsByClass, getSessionStudents, closeSession, openSession, finishSession, deleteSession, getSessionById,
  submitEvaluation, getSessionEvaluations, hasStudentSubmitted, deleteStudentEvaluation,
  calculateSessionResults, calculateProblemResults, getDashboardStats, getDashboardStatsByComponents,
  submitTutorialEvaluation, getTutorialEvaluation, calculateTutorialGrade,
  saveTutorialEvalDraft, getTutorialEvalDraft, deleteTutorialEvalDraft,
  calculateDesempenhoScores, calculateProblemDesempenhoScores, getStudentConsolidatedReport,
  generateAccessCode, getSessionByAccessCode, findStudentByEnrollmentInClass,
  approveUser, rejectUser, listPendingProfessors, listApprovedProfessors, deleteUser,
  addProfessorComponent, removeProfessorComponent, listProfessorComponents, listAllProfessorComponents,
  getUserById, getUserByEmail, countUsers, createUserWithPassword, updateUserPassword, setUserEmail, updateUserLoginMethod,
  getAdmin, transferCoordination, getSmtpConfig, upsertSmtpConfig, deleteSmtpConfig,
  createPasswordResetCode, verifyPasswordResetCode, markResetCodeUsed, isSmtpConfigured,
  createComponent, getComponentById, getComponentByCode, listComponents, updateComponent, deleteComponent,
  getUserApprovedComponentIds, getUserComponentRole, getUserComponents,
  requestComponentMembership, listPendingRequestsByComponents,
  approveComponentRequest, rejectComponentRequest, setComponentRole, removeProfessorFromComponent,
  getCoordinatorComponentIds,
  getComponentCoordinators,
  grantEvalPermission, revokeEvalPermission, hasEvalPermission, listEvalPermissions, listComponentProfessorsForClass,
  createEmailVerificationCode, verifyEmailCode,
  getStudentEvaluationCount, updateStudentPhoto, getStudentById,
  transferStudentBetweenClasses,
  createAuditLog, listAuditLogs, deleteAuditLogs,
  createNotification, listNotifications, countUnreadNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification,
  listPendingNotifications, countPendingNotifications,
  getPeerGradesMatrix,
  syncPendingRequestNotifications,
  createContactTicket, listContactTickets, listMyContactTickets, resolveContactTicket, getContactTicketById, countOpenContactTickets,
  exportDatabase, importDatabase, getBackupStats, rebuildDatabase,
  type BackupData,
  bulkUpsertProfessorStudentNotes, getProfessorStudentNotes,
  getNextSessionInfo,
  findStudentByEnrollment, getOpenSessionsForStudent, getClassesForStudent,
  getStudentEvaluationHistory,
  generateSessionTokenForStudent, getSessionByStudentToken, deleteSessionTokens, getTokensForSession,
  updateSessionAssignments,
  updateProblemTitleForClass,
  getRoleSummaryByClass,
  getOrCreateBrainstormBoard, getBrainstormBoard, getBrainstormItems,
  addBrainstormItem, updateBrainstormItem, deleteBrainstormItem,
  moveBrainstormItem, getBrainstormBoardWithItems,
  shareBrainstormBoard, getComponentSessionsForSharing,
  addBrainstormAttachment, removeBrainstormAttachment, getAttachmentsByItemId, updateBrainstormAttachmentTitle,
  updateTutorComments, getStudentsByComponentFromSession,
  updateDesempenhoPapel,
  getPreviousMesaScore,
  markStudentAbsentAfterClose,
  addBoardSendHistory, getBoardSendHistory, getLastBoardSend,
  listApprovedProfessorsByComponent,
  listClassesByComponent, listSemestersByComponent,
  listStudentsByComponent, listSessionsByComponent,
  getDashboardStatsByComponentAndSemester,
} from "./db";
import { storagePut } from "./storage";
import { sendEmail, testSmtpConnection, generateResetCode, buildResetEmailHtml, buildVerificationEmailHtml, buildComponentApprovalEmailHtml, buildComponentRejectionEmailHtml, buildNewRequestEmailHtml, buildEvalPermissionGrantedEmailHtml, buildContactTicketEmailHtml, buildSessionOpenedEmailHtml, buildStudentGradeReportHtml, buildBrainstormNotificationEmailHtml, buildBrainstormBoardEmailHtml, buildProfessorInviteEmailHtml, buildBrainstormViewerEmailHtml } from "./email";

/**
 * Normaliza o semestre para o formato ANO.SEMESTRE (ex: 2026.1, 2026.2).
 * Aceita formatos: "2026.1", "20261", "2026/1", "2026-1", "2026 1".
 * Retorna null se o formato for inválido.
 */
export function normalizeSemester(raw: string): string | null {
  const trimmed = raw.trim();
  // Already in correct format: 2026.1 or 2026.2
  const dotMatch = trimmed.match(/^(\d{4})\.(1|2)$/);
  if (dotMatch) return `${dotMatch[1]}.${dotMatch[2]}`;
  // Compact format: 20261 or 20262
  const compactMatch = trimmed.match(/^(\d{4})(1|2)$/);
  if (compactMatch) return `${compactMatch[1]}.${compactMatch[2]}`;
  // Slash, dash, or space separator: 2026/1, 2026-1, 2026 1
  const sepMatch = trimmed.match(/^(\d{4})[\/-\s](1|2)$/);
  if (sepMatch) return `${sepMatch[1]}.${sepMatch[2]}`;
  return null;
}

// Base: approved user (any role except "user" pending)
const approvedProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.approvalStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso pendente de aprovação" });
  return next({ ctx });
});

// Admin only
const adminProcedure = approvedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito ao administrador" });
  return next({ ctx });
});

// Coordinator or Admin (for actions that require at least coordinator level)
const coordinatorOrAdminProcedure = approvedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "coordinator" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a coordenadores" });
  return next({ ctx });
});

// Any approved professor (prof, coordinator, or admin)
const professorProcedure = approvedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "prof" && ctx.user.role !== "coordinator" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a professores" });
  }
  return next({ ctx });
});

// Helper: check if user has access to a component (is approved member or admin)
async function assertComponentAccess(userId: number, role: string, componentId: number) {
  if (role === "admin") return; // admin has access to everything
  const compRole = await getUserComponentRole(userId, componentId);
  if (!compRole) throw new TRPCError({ code: "FORBIDDEN", message: "Você não tem acesso a este componente" });
}

// Helper: check if user is coordinator of a component (or admin)
async function assertComponentCoordinator(userId: number, role: string, componentId: number) {
  if (role === "admin") return;
  const compRole = await getUserComponentRole(userId, componentId);
  if (compRole !== "coordinator") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas coordenadores deste componente podem realizar esta ação" });
}

// Helper: check if user can manage a class (admin, coordinator of component, or prof who created the class)
async function assertClassManager(userId: number, role: string, cls: { componentId: number; professorUserId: number }) {
  if (role === "admin") return;
  // Coordinator of the component can manage any class in that component
  const compRole = await getUserComponentRole(userId, cls.componentId);
  if (compRole === "coordinator") return;
  // Prof can manage only classes they created
  if (compRole === "prof" && cls.professorUserId === userId) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "Você não tem permissão para gerenciar esta turma" });
}

// Helper: get accessible component IDs for user
async function getAccessibleComponentIds(userId: number, role: string): Promise<number[]> {
  if (role === "admin") {
    // Admin sees all components
    const allComps = await listComponents();
    return allComps.map(c => c.id);
  }
  return getUserApprovedComponentIds(userId);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    isFirstUser: publicProcedure.query(async () => {
      const total = await countUsers();
      return { isFirstUser: total === 0 };
    }),
    // Step 1: Send verification code to email
    sendVerificationCode: publicProcedure.input(z.object({
      email: z.string().email(),
    })).mutation(async ({ input }) => {
      const existing = await getUserByEmail(input.email.toLowerCase());
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado" });
      const smtpOk = await isSmtpConfigured();
      if (!smtpOk) {
        // If SMTP is not configured and this is the first user, skip verification
        const total = await countUsers();
        if (total === 0) {
          return { success: true, smtpSkipped: true };
        }
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O servidor de e-mail não está configurado. Contacte o administrador." });
      }
      const code = generateResetCode(); // reuse 6-digit code generator
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await createEmailVerificationCode(input.email.toLowerCase(), code, expiresAt);
      const result = await sendEmail({
        to: input.email.toLowerCase(),
        subject: "Código de Verificação - Sessão Tutorial",
        text: `Seu código de verificação é: ${code}. Válido por 15 minutos.`,
        html: buildVerificationEmailHtml(code, input.email.toLowerCase()),
      });
      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao enviar e-mail de verificação: " + (result.error || "desconhecido") });
      }
      return { success: true, smtpSkipped: false };
    }),
    // Step 2: Verify code and complete registration
    register: publicProcedure.input(z.object({
      email: z.string().email(),
      name: z.string().min(1),
      password: z.string().min(6),
      verificationCode: z.string().length(6).optional(), // Optional for first user when SMTP not configured
      componentIds: z.array(z.number()).optional(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await getUserByEmail(input.email.toLowerCase());
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado" });
      const total = await countUsers();
      const isFirst = total === 0;
      // Verify email code (skip for first user if SMTP not configured)
      if (!isFirst || await isSmtpConfigured()) {
        if (!input.verificationCode) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Código de verificação é obrigatório" });
        }
        const valid = await verifyEmailCode(input.email.toLowerCase(), input.verificationCode);
        if (!valid) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Código de verificação inválido ou expirado" });
        }
      }
      const passwordHash = await bcrypt.hash(input.password, 10);
      const user = await createUserWithPassword({
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash,
        role: isFirst ? "admin" : "user",
        approvalStatus: isFirst ? "approved" : "pending",
      });
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao criar usuário" });
      // Create pending component membership requests and notify coordinators
      if (input.componentIds && input.componentIds.length > 0 && !isFirst) {
        for (const compId of input.componentIds) {
          try {
            await requestComponentMembership(user.id, compId);
            // Notify coordinators of the component about the new registration
            try {
              const component = await getComponentById(compId);
              const coordinators = await getComponentCoordinators(compId);
              if (component && coordinators.length > 0) {
                for (const coord of coordinators) {
                  // In-app notification
                  await createNotification({
                    userId: coord.userId,
                    type: "pending_request",
                    title: "Nova Solicitação de Entrada",
                    message: `${input.name || input.email} solicitou entrada em ${component.code} - ${component.name} (novo cadastro)`,
                    metadata: JSON.stringify({ componentId: compId, requesterId: user.id, source: "registration" }),
                  });
                  // Email notification
                  if (coord.userEmail) {
                    await sendEmail({
                      to: coord.userEmail,
                      subject: `Nova Solicitação de Entrada - ${component.code}`,
                      text: `Olá ${coord.userName || ""}, o professor ${input.name || input.email} solicitou entrada no componente ${component.code} - ${component.name} ao se cadastrar no sistema. Acesse o sistema para aprovar ou rejeitar.`,
                      html: buildNewRequestEmailHtml(
                        coord.userName || coord.userEmail,
                        input.name || input.email,
                        input.email,
                        component.code,
                        component.name,
                      ),
                    });
                  }
                }
              }
            } catch (notifErr) {
              console.error("[Notification] Failed to notify coordinators on registration:", notifErr);
            }
          } catch {
            // Ignore errors (component may not exist)
          }
        }
      }
      // Auto-login after registration
      const openId = `local:${input.email.toLowerCase()}`;
      const sessionToken = await sdk.createSessionToken(openId, {
        name: input.name,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return { success: true, isFirstUser: isFirst, user: { id: user.id, name: user.name, email: user.email, role: user.role, approvalStatus: user.approvalStatus } };
    }),
    login: publicProcedure.input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(input.email.toLowerCase());
      if (!user || !user.passwordHash) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos" });
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos" });
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || user.email || "",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, approvalStatus: user.approvalStatus } };
    }),
    changePassword: protectedProcedure.input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6),
    })).mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.passwordHash) throw new TRPCError({ code: "BAD_REQUEST", message: "Usuário não encontrado ou sem senha definida. Use 'Definir Senha' primeiro." });
      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha atual incorreta" });
      const newHash = await bcrypt.hash(input.newPassword, 10);
      await updateUserPassword(user.id, newHash);
      return { success: true };
    }),
    // Set password for users who logged in via OAuth and don't have a password yet
    setPassword: protectedProcedure.input(z.object({
      newPassword: z.string().min(6),
      email: z.string().email().optional(),
    })).mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "BAD_REQUEST", message: "Usuário não encontrado" });
      if (user.passwordHash) throw new TRPCError({ code: "BAD_REQUEST", message: "Você já tem uma senha definida. Use 'Alterar Senha' para mudá-la." });
      const newHash = await bcrypt.hash(input.newPassword, 10);
      await updateUserPassword(user.id, newHash);
      // If user doesn't have an email set (OAuth user), allow setting it
      if (input.email && !user.email) {
        await setUserEmail(user.id, input.email.toLowerCase());
      }
      // Update loginMethod to include email if it was only OAuth
      if (user.loginMethod && user.loginMethod !== "email") {
        await updateUserLoginMethod(user.id, `${user.loginMethod}+email`);
      }
      return { success: true };
    }),
    // Check if current user has a password set
    hasPassword: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      return { hasPassword: !!user?.passwordHash, hasEmail: !!user?.email };
    }),
    requestResetCode: publicProcedure.input(z.object({
      email: z.string().email(),
    })).mutation(async ({ input }) => {
      const user = await getUserByEmail(input.email.toLowerCase());
      if (!user) return { success: true };
      const smtpReady = await isSmtpConfigured();
      if (!smtpReady) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O sistema de e-mail não está configurado. Contacte o administrador." });
      }
      const code = generateResetCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await createPasswordResetCode(user.id, code, expiresAt);
      const result = await sendEmail({
        to: user.email!,
        subject: "Código de Recuperação de Senha - Sessão Tutorial",
        text: `Seu código de recuperação é: ${code}. Válido por 15 minutos.`,
        html: buildResetEmailHtml(code, user.name || "Professor"),
      });
      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao enviar e-mail: " + (result.error || "desconhecido") });
      }
      return { success: true };
    }),
    resetPassword: publicProcedure.input(z.object({
      email: z.string().email(),
      code: z.string().length(6),
      newPassword: z.string().min(6),
    })).mutation(async ({ input }) => {
      const user = await getUserByEmail(input.email.toLowerCase());
      if (!user) throw new TRPCError({ code: "BAD_REQUEST", message: "E-mail não encontrado" });
      const valid = await verifyPasswordResetCode(user.id, input.code);
      if (!valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Código inválido ou expirado" });
      const newHash = await bcrypt.hash(input.newPassword, 10);
      await updateUserPassword(user.id, newHash);
      await markResetCodeUsed(user.id, input.code);
      return { success: true };
    }),
    smtpStatus: publicProcedure.query(async () => {
      const configured = await isSmtpConfigured();
      return { configured };
    }),
  }),

  // ─── SMTP Configuration (admin only) ───
  smtp: router({
    get: adminProcedure.query(async ({ ctx }) => {
      const config = await getSmtpConfig(ctx.user.id);
      if (!config) return null;
      return {
        host: config.host,
        port: config.port,
        secure: config.secure,
        username: config.username,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        configured: config.configured,
      };
    }),
    save: adminProcedure.input(z.object({
      host: z.string().min(1),
      port: z.number().int().min(1).max(65535),
      secure: z.boolean(),
      username: z.string().min(1),
      password: z.string().min(1),
      fromEmail: z.string().email(),
      fromName: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      await upsertSmtpConfig({ userId: ctx.user.id, ...input });
      return { success: true };
    }),
    test: adminProcedure.input(z.object({
      host: z.string().min(1),
      port: z.number().int().min(1).max(65535),
      secure: z.boolean(),
      username: z.string().min(1),
      password: z.string().min(1),
      fromEmail: z.string().email().optional(),
      fromName: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      return testSmtpConnection({
        ...input,
        testRecipient: ctx.user.email ?? undefined,
      });
    }),
    delete: adminProcedure.mutation(async ({ ctx }) => {
      await deleteSmtpConfig(ctx.user.id);
      return { success: true };
    }),
  }),

  // ─── Administration (admin only) ───
  coordination: router({
    current: approvedProcedure.query(async () => {
      const coord = await getAdmin();
      if (!coord) return null;
      return { id: coord.id, name: coord.name, email: coord.email };
    }),
    transfer: adminProcedure.input(z.object({
      toUserId: z.number().int(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.toUserId) throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível transferir para si mesmo" });
      const target = await getUserById(input.toUserId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Professor não encontrado" });
      if (target.approvalStatus !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "O professor precisa estar aprovado" });
      await transferCoordination(ctx.user.id, input.toUserId);
      return { success: true };
    }),
  }),

  // ─── Components (componentes curriculares) ───
  components: router({
    // ALL approved users can list components
    list: approvedProcedure.query(async () => {
      return listComponents();
    }),
    // Also public list for registration page
    listPublic: publicProcedure.query(async () => {
      return listComponents();
    }),
    // List only the components accessible to the current user
    listMine: approvedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin") return listComponents();
      const componentIds = await getUserApprovedComponentIds(ctx.user.id);
      if (componentIds.length === 0) return [];
      const all = await listComponents();
      return all.filter(c => componentIds.includes(c.id));
    }),
    // Only admin can create/update/delete
    create: adminProcedure.input(z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      type: z.enum(["T", "TP"]).default("TP"),
    })).mutation(async ({ input }) => {
      const existing = await getComponentByCode(input.code);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe um componente com este código" });
      return createComponent(input);
    }),
    update: adminProcedure.input(z.object({
      id: z.number(),
      code: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
      type: z.enum(["T", "TP"]).optional(),
    })).mutation(async ({ input }) => {
      if (input.code) {
        const existing = await getComponentByCode(input.code);
        if (existing && existing.id !== input.id) throw new TRPCError({ code: "CONFLICT", message: "Já existe um componente com este código" });
      }
      return updateComponent(input.id, { code: input.code, name: input.name, type: input.type });
    }),
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      try {
        await deleteComponent(input.id);
        return { success: true };
      } catch (e: any) {
        throw new TRPCError({ code: "CONFLICT", message: e.message || "Erro ao excluir componente" });
      }
    }),
  }),

  // ─── Classes (turmas) ───
  classes: router({
    // List classes: admin sees all, coordinator/prof see their component classes
    list: approvedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin") {
        return listAllClasses();
      }
      const componentIds = await getUserApprovedComponentIds(ctx.user.id);
      if (componentIds.length === 0) return [];
      return listClassesByComponents(componentIds);
    }),
    // Create: admin can create for any component, coordinator for their components
    create: approvedProcedure.input(z.object({
      classNumber: z.number().min(1).max(99),
      componentId: z.number(),
      semester: z.string().min(1),
      professorUserId: z.number().optional(), // defaults to current user
    })).mutation(async ({ ctx, input }) => {
      // Any approved professor who is member of the component can create a class
      await assertComponentAccess(ctx.user.id, ctx.user.role, input.componentId);
      const semester = normalizeSemester(input.semester);
      if (!semester) throw new TRPCError({ code: "BAD_REQUEST", message: "Formato de semestre inválido. Use ANO.SEMESTRE (ex: 2026.1)" });
      // Build classCode from component type + number
      const comp = await getComponentById(input.componentId);
      if (!comp) throw new TRPCError({ code: "NOT_FOUND", message: "Componente não encontrado" });
      const prefix = comp.type || "TP";
      const classCode = `${prefix}${String(input.classNumber).padStart(2, "0")}`;
      const professorUserId = input.professorUserId ?? ctx.user.id;
      return createClass({ classCode, componentId: input.componentId, semester, professorUserId });
    }),
    // Update: admin can update any, coordinator can update classes of their components
    update: approvedProcedure.input(z.object({
      id: z.number(),
      classNumber: z.number().min(1).max(99),
      componentId: z.number(),
      semester: z.string().min(1),
      professorUserId: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.id);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      const semester = normalizeSemester(input.semester);
      if (!semester) throw new TRPCError({ code: "BAD_REQUEST", message: "Formato de semestre inválido. Use ANO.SEMESTRE (ex: 2026.1)" });
      // Build classCode from component type + number
      const comp = await getComponentById(input.componentId);
      if (!comp) throw new TRPCError({ code: "NOT_FOUND", message: "Componente não encontrado" });
      const prefix = comp.type || "TP";
      const classCode = `${prefix}${String(input.classNumber).padStart(2, "0")}`;
      const professorUserId = input.professorUserId ?? cls.professorUserId;
      return updateClass(input.id, { classCode, componentId: input.componentId, semester, professorUserId });
    }),
    // Update only the professor of a class
    updateProfessor: approvedProcedure.input(z.object({
      id: z.number(),
      professorUserId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.id);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      return updateClass(input.id, { professorUserId: input.professorUserId });
    }),
    // List approved professors for a component (for professor selector)
    listProfessorsForComponent: approvedProcedure.input(z.object({ componentId: z.number() })).query(async ({ ctx, input }) => {
      await assertComponentAccess(ctx.user.id, ctx.user.role, input.componentId);
      return listApprovedProfessorsByComponent(input.componentId);
    }),
    // Delete: admin can delete any, coordinator can delete classes of their components
    delete: approvedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.id);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      try {
        await deleteClass(input.id);
        return { success: true };
      } catch (err: any) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: err.message || "Erro ao excluir turma" });
      }
    }),
    // All classes (for admin or cross-class results)
    listAll: approvedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin") {
        return listAllClasses();
      }
      const componentIds = await getUserApprovedComponentIds(ctx.user.id);
      if (componentIds.length === 0) return [];
      return listClassesByComponents(componentIds);
    }),
    // List classes by single component with optional semester filter
    listByComponent: approvedProcedure.input(z.object({
      componentId: z.number(),
      semester: z.string().optional(),
    })).query(async ({ ctx, input }) => {
      await assertComponentAccess(ctx.user.id, ctx.user.role, input.componentId);
      return listClassesByComponent(input.componentId, input.semester);
    }),
    // List distinct semesters for a component
    semestersByComponent: approvedProcedure.input(z.object({ componentId: z.number() })).query(async ({ ctx, input }) => {
      await assertComponentAccess(ctx.user.id, ctx.user.role, input.componentId);
      return listSemestersByComponent(input.componentId);
    }),
  }),

  // ─── Students ───
  students: router({
    // List: scoped by component access
    list: approvedProcedure.input(z.object({ classId: z.number() })).query(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);
      return listStudentsByClass(input.classId);
    }),
    // Create: admin, coordinator of component, or prof who created the class
    // Check if enrollment exists in another component (used before create to alert professor)
    checkEnrollment: approvedProcedure.input(z.object({
      classId: z.number(),
      enrollment: z.string().min(1),
    })).query(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);
      const existing = await getStudentByEnrollment(input.enrollment);
      if (!existing) return { exists: false as const };
      const classStudentsList = await listStudentsByClass(input.classId);
      if (classStudentsList.some(s => s.id === existing.id)) {
        return { exists: true as const, sameClass: true as const, student: { id: existing.id, name: existing.name, email: existing.email, enrollment: existing.enrollment } };
      }
      const inComponent = await isStudentInComponentClass(existing.id, cls.componentId, input.classId);
      if (inComponent) {
        return { exists: true as const, sameComponent: true as const, student: { id: existing.id, name: existing.name, email: existing.email, enrollment: existing.enrollment } };
      }
      return { exists: true as const, otherComponent: true as const, student: { id: existing.id, name: existing.name, email: existing.email, enrollment: existing.enrollment } };
    }),
    create: approvedProcedure.input(z.object({
      classId: z.number(),
      name: z.string().min(1),
      enrollment: z.string().min(1),
      email: z.string().optional(),
      useExisting: z.boolean().optional(), // If true, import from bank using existing data
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      let student = await getStudentByEnrollment(input.enrollment);
      if (student) {
        const classStudentsList = await listStudentsByClass(input.classId);
        if (classStudentsList.some(s => s.id === student!.id)) {
          throw new TRPCError({ code: "CONFLICT", message: "Aluno já está nesta turma" });
        }
        const inComponent = await isStudentInComponentClass(student.id, cls.componentId, input.classId);
        if (inComponent) {
          throw new TRPCError({ code: "CONFLICT", message: "Aluno já está em outra turma deste componente" });
        }
        // If useExisting is true, just link without changing data
        // If useExisting is false/undefined and names differ, throw error to alert professor
        if (!input.useExisting && student.name !== input.name) {
          throw new TRPCError({
            code: "CONFLICT",
            message: JSON.stringify({
              type: "enrollment_exists_different_data",
              existingName: student.name,
              existingEmail: student.email,
              inputName: input.name,
              inputEmail: input.email || null,
            }),
          });
        }
        await addStudentToClass(student.id, input.classId);
      } else {
        student = await createStudent({ name: input.name, enrollment: input.enrollment, email: input.email || null });
        if (student) await addStudentToClass(student.id, input.classId);
      }
      return student;
    }),
    update: approvedProcedure.input(z.object({
      studentId: z.number(),
      classId: z.number(), // needed to verify component access
      name: z.string().optional(),
      enrollment: z.string().optional(),
      email: z.string().nullable().optional(),
      photoUrl: z.string().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      if (input.enrollment) {
        const existing = await getStudentByEnrollment(input.enrollment);
        if (existing && existing.id !== input.studentId) {
          throw new TRPCError({ code: "CONFLICT", message: "Já existe outro aluno com esta matrícula" });
        }
      }
      // If photoUrl provided, also update it
      if (input.photoUrl !== undefined && input.photoUrl !== null) {
        await updateStudentPhoto(input.studentId, input.photoUrl);
      }
      return updateStudent(input.studentId, { name: input.name, enrollment: input.enrollment, email: input.email });
    }),
    // Remove from class: admin, coordinator of component, or prof who created the class
    removeFromClass: approvedProcedure.input(z.object({ studentId: z.number(), classId: z.number() })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      await removeStudentFromClass(input.studentId, input.classId);
      return { success: true };
    }),
    importCSV: approvedProcedure.input(z.object({
      classId: z.number(),
      csvContent: z.string(),
      skipEnrollments: z.array(z.string()).optional(), // matrículas a ignorar (já existentes)
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);

      // Robust SAGRES Folha de Frequência parser.
      // Detects enrollment by content pattern instead of fixed column position.
      // Handles all known formats including comma-delimited and semicolon-delimited variants.
      const ENROLLMENT_RE = /^\s*\d{5,11}\s*$/;
      const HEADER_NAME_RE = /aluno|nome/i;
      // Auto-detect delimiter: count semicolons vs commas in the first 10 non-empty lines
      const csvLines = input.csvContent.split(/\r?\n/);
      const sampleLines = csvLines.filter(l => l.trim()).slice(0, 10);
      const semicolonCount = sampleLines.join("").split(";").length - 1;
      const commaCount = sampleLines.join("").split(",").length - 1;
      const delimiter = commaCount > semicolonCount ? "," : ";";
      const parsedStudents: { name: string; enrollment: string }[] = [];

      for (const line of csvLines) {
        const cols = line.split(delimiter);
        let enrollmentIdx = -1;
        for (let i = 0; i < cols.length; i++) {
          if (ENROLLMENT_RE.test(cols[i])) { enrollmentIdx = i; break; }
        }
        if (enrollmentIdx === -1) continue;
        const enrollment = cols[enrollmentIdx].trim();
        const name = cols[enrollmentIdx + 1]?.trim();
        if (!name || HEADER_NAME_RE.test(name)) continue;
        if (/^[_\s]+$/.test(name)) continue; // skip signature lines
        parsedStudents.push({ name, enrollment });
      }

      if (parsedStudents.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum aluno encontrado no CSV. Verifique se o formato é compatível com a Folha de Frequência do SAGRES." });
      }

      // Filter out enrollments explicitly skipped by the user
      const studentsToImport = input.skipEnrollments && input.skipEnrollments.length > 0
        ? parsedStudents.filter(s => !input.skipEnrollments!.includes(s.enrollment))
        : parsedStudents;

      const results = await bulkImportStudents(
        studentsToImport.map(s => ({ ...s, classId: input.classId }))
      );

      const created = results.filter(r => r.status === "created").length;
      const linked = results.filter(r => r.status === "linked").length;
      const alreadyInClass = results.filter(r => r.status === "already_in_class").length;
      const conflicts = results.filter(r => r.status === "conflict");
      const nameMismatches = results.filter(r => r.status === "name_mismatch");

      const alreadyInClassDetails = results.filter(r => r.status === "already_in_class");

      return {
        success: true,
        count: studentsToImport.length,
        totalInCsv: parsedStudents.length,
        created,
        linked,
        alreadyInClass,
        alreadyInClassDetails: alreadyInClassDetails.map(c => ({ name: c.name, enrollment: c.enrollment, currentClassCode: c.currentClassCode ?? null })),
        conflicts: conflicts.map(c => ({ name: c.name, enrollment: c.enrollment })),
        nameMismatches: nameMismatches.map(c => ({
          csvName: c.name,
          enrollment: c.enrollment,
          existingName: c.existingName!,
          existingEmail: c.existingEmail ?? null,
        })),
        students: parsedStudents,
      };
    }),
    // Resolve name mismatch conflicts from CSV import
    resolveImportConflict: approvedProcedure.input(z.object({
      classId: z.number(),
      enrollment: z.string(),
      action: z.enum(["use_existing", "update_name"]),
      csvName: z.string().optional(), // needed when action is update_name
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma n\u00e3o encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      const existing = await getStudentByEnrollment(input.enrollment);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Aluno n\u00e3o encontrado no banco" });
      
      if (input.action === "update_name" && input.csvName) {
        await updateStudent(existing.id, { name: input.csvName });
      }
      // Link student to class
      await addStudentToClass(existing.id, input.classId);
      return { success: true };
    }),
    exportGoogleWorkspace: adminProcedure.input(z.object({
      classIds: z.array(z.number()).min(1),
    })).query(async ({ ctx, input }) => {
      // Admin-only: Verify component access for all classes
      for (const classId of input.classIds) {
        const cls = await getClassById(classId);
        if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      }
      const studentsData = await listStudentsForExport(input.classIds);
      if (studentsData.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum aluno encontrado nas turmas selecionadas." });
      }

      const header = "First Name [Required];Last Name [Required];Email Address [Required];Password [Required];Password Hash Function [UPLOAD ONLY];Org Unit Path [Required];New Primary Email [UPLOAD ONLY];Recovery Email;Home Secondary Email;Work Secondary Email;Recovery Phone [MUST BE IN THE E.164 FORMAT];Work Phone;Home Phone;Mobile Phone;Work Address;Home Address;Employee ID;Employee Type;Employee Title;Manager Email;Department;Cost Center;Building ID;Floor Name;Floor Section;Change Password at Next Sign-In;New Status [UPLOAD ONLY];New Licenses [UPLOAD ONLY];Advanced Protection Program enrollment";

      const PREPOSITIONS = new Set(["de", "da", "do", "dos", "das", "e"]);
      const toTitleCase = (str: string) => {
        return str.toLowerCase().split(/\s+/).map((word) => {
          if (PREPOSITIONS.has(word)) return word;
          return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(" ");
      };

      const rows = studentsData.map(s => {
        const nameParts = s.studentName.trim().split(/\s+/);
        const firstName = toTitleCase(nameParts[0] || "");
        const lastName = toTitleCase(nameParts.slice(1).join(" ") || "");
        const initials = nameParts.map(p => p[0]?.toLowerCase() || "").join("");
        const enrollment = s.studentEnrollment || "";
        const password = `${initials}${enrollment}`;
        return [
          firstName, lastName, s.studentEmail, password,
          "", "/Alunos", "", "", "", "", "", "", "", "", "", "",
          "", "", "", "", "", "", "", "", "", "True", "", "", "False",
        ].join(";");
      });

      const seen = new Set<string>();
      const uniqueRows = rows.filter(row => {
        const email = row.split(";")[2];
        if (seen.has(email)) return false;
        seen.add(email);
        return true;
      });

      return { csv: [header, ...uniqueRows].join("\n"), count: uniqueRows.length };
    }),
    // Transfer student between classes of the same component (coordinator or admin only)
    transfer: approvedProcedure.input(z.object({
      studentId: z.number(),
      fromClassId: z.number(),
      toClassId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const fromCls = await getClassById(input.fromClassId);
      if (!fromCls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma de origem não encontrada" });
      const toCls = await getClassById(input.toClassId);
      if (!toCls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma de destino não encontrada" });
      // Both classes must belong to the same component
      if (fromCls.componentId !== toCls.componentId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "As turmas devem pertencer ao mesmo componente" });
      }
      if (input.fromClassId === input.toClassId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A turma de destino deve ser diferente da turma de origem" });
      }
      // Only coordinator of the component or admin can transfer
      await assertComponentCoordinator(ctx.user.id, ctx.user.role, fromCls.componentId);
      // Verify student is in the source class
      const studentsInFrom = await listStudentsByClass(input.fromClassId);
      if (!studentsInFrom.some((s: any) => s.id === input.studentId)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Aluno não encontrado na turma de origem" });
      }
      // Verify student is not already in the destination class
      const studentsInTo = await listStudentsByClass(input.toClassId);
      if (studentsInTo.some((s: any) => s.id === input.studentId)) {
        throw new TRPCError({ code: "CONFLICT", message: "Aluno já está na turma de destino" });
      }
      await transferStudentBetweenClasses(input.studentId, input.fromClassId, input.toClassId);
      await createAuditLog({ action: "transfer_student", actorUserId: ctx.user.id, componentId: fromCls.componentId, classId: input.fromClassId, details: JSON.stringify({ studentId: input.studentId, fromClassId: input.fromClassId, toClassId: input.toClassId }) });
      return { success: true };
    }),
    // Get student profile (history + info) for professor view
    profile: approvedProcedure.input(z.object({
      studentId: z.number(),
    })).query(async ({ ctx, input }) => {
      const student = await getStudentById(input.studentId);
      if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Aluno não encontrado" });
      const history = await getStudentEvaluationHistory(input.studentId);
      return { student, history };
    }),
    // List students by component with optional semester/class filters
    listByComponent: approvedProcedure.input(z.object({
      componentId: z.number(),
      semester: z.string().optional(),
      classId: z.number().optional(),
    })).query(async ({ ctx, input }) => {
      await assertComponentAccess(ctx.user.id, ctx.user.role, input.componentId);
      return listStudentsByComponent(input.componentId, input.semester, input.classId);
    }),
  }),

  // ─── Sessions ───
  sessions: router({
    // List sessions for a class: scoped by component access
    list: approvedProcedure.input(z.object({ classId: z.number() })).query(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);
      return listSessionsByClass(input.classId);
    }),
    // List sessions with permission info for the current professor
    listWithPermissions: professorProcedure.input(z.object({ classId: z.number() })).query(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);
      const sessionsList = await listSessionsByClass(input.classId);
      if (ctx.user.role === "admin") {
        return sessionsList.map(s => ({ ...s, evalPermission: "admin" as const }));
      }
      const isOwner = cls.professorUserId === ctx.user.id;
      const compRole = await getUserComponentRole(ctx.user.id, cls.componentId);
      const isCoordinator = compRole === "coordinator";
      if (isOwner) {
        return sessionsList.map(s => ({ ...s, evalPermission: "owner" as const }));
      }
      if (isCoordinator) {
        return sessionsList.map(s => ({ ...s, evalPermission: "coordinator" as const }));
      }
      // Check explicit permission
      const permitted = await hasEvalPermission(input.classId, ctx.user.id);
      return sessionsList.map(s => ({ ...s, evalPermission: permitted ? "authorized" as const : "no_permission" as const }));
    }),
    listForStudent: protectedProcedure.input(z.object({ classId: z.number() })).query(async ({ input }) => {
      return listSessionsByClass(input.classId);
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getSessionById(input.id);
    }),
    // Get next session info (auto-numbering)
    getNextInfo: approvedProcedure.input(z.object({ classId: z.number() })).query(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);
      return getNextSessionInfo(input.classId);
    }),
    // Create session: admin, coordinator of component, or prof who created the class
    // problemNumber is provided by user (must be >= lastProblemNumber), sessionNumber is auto-calculated
    create: approvedProcedure.input(z.object({
      classId: z.number(),
      problemNumber: z.number().min(1).max(10),
      problemTitle: z.string().max(255).optional(),
      studentAssignments: z.array(z.object({
        studentId: z.number(),
        role: z.enum(["COORDENADOR", "MESA", "QUADRO", "PARTICIPANTE"]),
        absent: z.boolean(),
      })),
      origin: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      if (input.studentAssignments.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione ao menos um aluno" });
      // Validate exclusive roles
      const exclusiveRoles = ["COORDENADOR", "MESA", "QUADRO"];
      for (const role of exclusiveRoles) {
        const count = input.studentAssignments.filter(sa => sa.role === role && !sa.absent).length;
        if (count > 1) throw new TRPCError({ code: "BAD_REQUEST", message: `O papel ${role} só pode ser atribuído a um aluno` });
      }
      // Validate required roles: must have at least one Coordenador, Mesa and Quadro among present students
      const presentRoles = input.studentAssignments.filter(sa => !sa.absent).map(sa => sa.role);
      if (!presentRoles.includes("COORDENADOR")) throw new TRPCError({ code: "BAD_REQUEST", message: "É necessário atribuir o papel de Coordenador a um aluno presente." });
      if (!presentRoles.includes("MESA")) throw new TRPCError({ code: "BAD_REQUEST", message: "É necessário atribuir o papel de Mesa a um aluno presente." });
      if (!presentRoles.includes("QUADRO")) throw new TRPCError({ code: "BAD_REQUEST", message: "É necessário atribuir o papel de Quadro a um aluno presente." });
      // Auto-calculate session number
      const info = await getNextSessionInfo(input.classId);
      let sessionNumber: number;
      if (info.lastProblemNumber === 0) {
        if (input.problemNumber !== 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A primeira sessão da turma deve ser obrigatoriamente Problema 1 - Sessão 1." });
        }
        sessionNumber = 1;
      } else if (input.problemNumber === info.nextProblemNumber) {
        sessionNumber = info.nextSessionNumber;
      } else if (input.problemNumber === info.lastProblemNumber + 1) {
        sessionNumber = 1;
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: `O número do problema deve ser ${info.lastProblemNumber} (continuar) ou ${info.lastProblemNumber + 1} (novo problema).` });
      }
      const titlePart = input.problemTitle ? ` - ${input.problemTitle}` : "";
      const label = `Problema ${input.problemNumber} - Sessão ${sessionNumber}${titlePart}`;
      const newSession = await createSession({
        classId: input.classId,
        problemNumber: input.problemNumber,
        sessionNumber,
        problemTitle: input.problemTitle || null,
        label,
        studentAssignments: input.studentAssignments,
      });

      // Send brainstorm board link to all participants
      if (newSession && input.origin) {
        try {
          const studentsInClass = await listStudentsByClass(input.classId);
          let componentCode = "";
          if (cls.componentId) {
            const comp = await getComponentById(cls.componentId);
            componentCode = comp?.code ?? "";
          }
          for (const assignment of input.studentAssignments) {
            if (assignment.absent) continue;
            const student = studentsInClass.find(s => s.id === assignment.studentId);
            if (!student?.email) continue;
            // Include studentId in URL so BrainstormViewPage can determine edit permission
            const brainstormUrl = `${input.origin}/brainstorm/${newSession.id}?student=${student.id}`;
            if (assignment.role === "MESA") {
              // Mesa student: editor email
              const html = buildBrainstormNotificationEmailHtml({
                studentName: student.name,
                sessionLabel: label,
                brainstormUrl,
                componentCode,
                classCode: cls.classCode,
              });
              sendEmail({
                to: student.email,
                subject: `Quadro de Brainstorming - ${label}`,
                text: `Ol\u00e1 ${student.name}, voc\u00ea \u00e9 o respons\u00e1vel pelo Quadro de Brainstorming da sess\u00e3o ${label}. Acesse: ${brainstormUrl}`,
                html,
              }).catch(err => console.error(`[Email] Failed to send brainstorm link to ${student.email}:`, err));
            } else {
              // Other participants: viewer email
              const html = buildBrainstormViewerEmailHtml({
                studentName: student.name,
                sessionLabel: label,
                brainstormUrl,
                componentCode,
                classCode: cls.classCode,
                role: assignment.role,
              });
              sendEmail({
                to: student.email,
                subject: `Quadro de Brainstorming - ${label}`,
                text: `Ol\u00e1 ${student.name}, uma nova sess\u00e3o tutorial foi criada: ${label}. Acesse o quadro de brainstorming: ${brainstormUrl}`,
                html,
              }).catch(err => console.error(`[Email] Failed to send brainstorm viewer link to ${student.email}:`, err));
            }
          }
        } catch (err) {
          console.error("[Sessions] Error sending brainstorm emails:", err);
        }
      }

      return newSession;
    }),
    getStudents: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => {
      return getSessionStudents(input.sessionId);
    }),
    // Close/Open/Delete: admin, coordinator of component, or prof who created the class
    close: approvedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      if (session.status === "finished") throw new TRPCError({ code: "FORBIDDEN", message: "Sessão encerrada. Nenhuma alteração é permitida." });
      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      await closeSession(input.id);
      return { success: true };
    }),
    finish: approvedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      if (session.status !== "open" && session.status !== "closed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Apenas sessões com status 'Em Avaliação' ou 'Fechada' podem ser encerradas." });
      }
      await finishSession(input.id, ctx.user.id);
      return { success: true };
    }),
    open: approvedProcedure.input(z.object({ id: z.number(), origin: z.string().optional() })).mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      await openSession(input.id);

      // Regenerate individual tokens and send emails
      let emailsSent = 0;
      let tokensGenerated = 0;
      try {
        const sessionStudentsList = await getSessionStudents(input.id);
        const studentsInClass = await listStudentsByClass(session.classId);
        const studentMap = new Map(studentsInClass.map(s => [s.id, s]));
        let componentCode = "";
        if (cls.componentId) {
          const comp = await getComponentById(cls.componentId);
          componentCode = comp?.code ?? "";
        }
        const baseUrl = input.origin || "";
        for (const ss of sessionStudentsList) {
          // Skip absent students — they don't receive tokens or emails
          if (ss.absent) continue;
          const student = studentMap.get(ss.studentId);
          if (!student) continue;
          const token = await generateSessionTokenForStudent(input.id, student.id);
          tokensGenerated++;
          if (student.email) {
            const accessUrl = baseUrl ? `${baseUrl}/avaliacao?token=${token}` : "";
            const html = buildSessionOpenedEmailHtml({
              studentName: student.name,
              sessionLabel: session.label,
              accessCode: "",
              accessUrl,
              componentCode,
              classCode: cls.classCode,
            });
            sendEmail({
              to: student.email,
              subject: `Sessão Tutorial - ${session.label} (Reaberta)`,
              text: `Olá ${student.name}, a sessão ${session.label} foi reaberta. Acesse o link para avaliar: ${accessUrl}`,
              html,
            }).catch(err => console.error(`[Email] Failed to send to ${student.email}:`, err));
            emailsSent++;
          }
        }
      } catch (err) {
        console.error("[Sessions] Error regenerating tokens on reopen:", err);
      }

      return { success: true, emailsSent, tokensGenerated };
    }),
    delete: approvedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      // Only allow deleting the last session of the class to preserve sequential numbering
      const info = await getNextSessionInfo(session.classId);
      const lastProblem = info.lastProblemNumber;
      const lastSession = info.nextSessionNumber - 1;
      const isLastSession = session.problemNumber === lastProblem && session.sessionNumber === lastSession;
      if (!isLastSession) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Só é possível excluir a última sessão da turma (Problema ${lastProblem} - Sessão ${lastSession}). Esta sessão é Problema ${session.problemNumber} - Sessão ${session.sessionNumber}.`,
        });
      }
      await deleteSession(input.id);
      return { success: true };
    }),
    updateAssignments: approvedProcedure.input(z.object({
      sessionId: z.number(),
      studentAssignments: z.array(z.object({
        studentId: z.number(),
        role: z.enum(["COORDENADOR", "MESA", "QUADRO", "PARTICIPANTE"]),
        absent: z.boolean(),
      })),
    })).mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      if (session.status !== "initiated") throw new TRPCError({ code: "FORBIDDEN", message: "Papéis e presença só podem ser editados quando a sessão está no estado Ativa." });
      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      // Validate required roles
      const roles = input.studentAssignments.filter(a => !a.absent).map(a => a.role);
      if (!roles.includes("COORDENADOR")) throw new TRPCError({ code: "BAD_REQUEST", message: "É necessário atribuir o papel de Coordenador a um aluno presente." });
      if (!roles.includes("MESA")) throw new TRPCError({ code: "BAD_REQUEST", message: "É necessário atribuir o papel de Mesa a um aluno presente." });
      if (!roles.includes("QUADRO")) throw new TRPCError({ code: "BAD_REQUEST", message: "É necessário atribuir o papel de Quadro a um aluno presente." });
      await updateSessionAssignments(input.sessionId, input.studentAssignments);
      await createAuditLog({ action: "session.updateAssignments", actorUserId: ctx.user.id, details: `Papéis atualizados na sessão ${session.label}` });
      return { success: true };
    }),
    // Mark a present student as absent after session is closed (present→absent only)
    markAbsentAfterClose: approvedProcedure.input(z.object({
      sessionId: z.number(),
      studentId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      if (session.status !== "closed") throw new TRPCError({ code: "FORBIDDEN", message: "Esta ação só é permitida em sessões fechadas" });
      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      const result = await markStudentAbsentAfterClose(input.sessionId, input.studentId);
      await createAuditLog({ action: "session.markAbsentAfterClose", actorUserId: ctx.user.id, details: `Aluno ${input.studentId} marcado como ausente na sessão fechada ${session.label}` });
      return result;
    }),
    updateProblemTitle: approvedProcedure.input(z.object({
      classId: z.number(),
      problemNumber: z.number().min(1).max(10),
      problemTitle: z.string().max(255).optional(),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      await updateProblemTitleForClass(input.classId, input.problemNumber, input.problemTitle ?? null);
      await createAuditLog({ action: "session.updateProblemTitle", actorUserId: ctx.user.id, details: `Título do Problema ${input.problemNumber} atualizado para "${input.problemTitle ?? '(sem título)'}" na turma ${cls.classCode}` });
      return { success: true };
    }),
    roleSummary: approvedProcedure.input(z.object({ classId: z.number() })).query(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);
      return getRoleSummaryByClass(input.classId);
    }),
    submissionStatus: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => {
      const sessionStudentsList = await getSessionStudents(input.sessionId);
      // Use realOnly=true so autoFilled evaluations are NOT counted as submitted
      const evals = await getSessionEvaluations(input.sessionId, true);
      const submittedIds = new Set(evals.map(e => e.evaluatorStudentId));
      return sessionStudentsList.map(s => ({
        ...s,
        submitted: submittedIds.has(s.studentId),
      }));
    }),
    openAndNotify: approvedProcedure.input(z.object({ sessionId: z.number(), origin: z.string().optional() })).mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);

      // Open the session (set status to "open")
      await openSession(input.sessionId);

      // Generate individual tokens for each student and send emails
      let emailsSent = 0;
      let tokensGenerated = 0;
      try {
        const sessionStudentsList = await getSessionStudents(input.sessionId);
        const studentsInClass = await listStudentsByClass(session.classId);
        const studentMap = new Map(studentsInClass.map(s => [s.id, s]));
        let componentCode = "";
        let componentName = "";
        if (cls.componentId) {
          const comp = await getComponentById(cls.componentId);
          componentCode = comp?.code ?? "";
          componentName = comp?.name ?? "";
        }
        const baseUrl = input.origin || "";

        for (const ss of sessionStudentsList) {
          // Skip absent students — they don't receive tokens or emails
          if (ss.absent) continue;
          const student = studentMap.get(ss.studentId);
          if (!student) continue;
          // Generate individual token for this student
          const token = await generateSessionTokenForStudent(input.sessionId, student.id);
          tokensGenerated++;

          if (student.email) {
            const accessUrl = baseUrl ? `${baseUrl}/avaliacao?token=${token}` : "";
            const html = buildSessionOpenedEmailHtml({
              studentName: student.name,
              sessionLabel: session.label,
              accessCode: "",
              accessUrl,
              componentCode,
              classCode: cls.classCode,
            });
            sendEmail({
              to: student.email,
              subject: `Sessão Tutorial - ${session.label}`,
              text: `Olá ${student.name}, a sessão ${session.label} foi aberta. Acesse o link para avaliar: ${accessUrl}`,
              html,
            }).catch(err => console.error(`[Email] Failed to send to ${student.email}:`, err));
            emailsSent++;
          }
        }
        console.log(`[Sessions] Session ${input.sessionId} opened, ${tokensGenerated} tokens generated, ${emailsSent} emails queued`);
      } catch (err) {
        console.error("[Sessions] Error generating tokens/sending emails:", err);
      }

      return { emailsSent, tokensGenerated };
    }),
    resendEmails: approvedProcedure.input(z.object({ sessionId: z.number(), origin: z.string().optional() })).mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      if (session.status !== "open") throw new TRPCError({ code: "BAD_REQUEST", message: "Sessão não está aberta" });
      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);

      const sessionStudentsList = await getSessionStudents(input.sessionId);
      const studentsInClass = await listStudentsByClass(session.classId);
      const studentMap = new Map(studentsInClass.map(s => [s.id, s]));
      let componentCode = "";
      if (cls.componentId) {
        const comp = await getComponentById(cls.componentId);
        componentCode = comp?.code ?? "";
      }
      const baseUrl = input.origin || "";

      // Get existing tokens or generate new ones
      const existingTokens = await getTokensForSession(input.sessionId);
      const tokenMap = new Map(existingTokens.map(t => [t.studentId, t.token]));

      let emailsSent = 0;
      for (const ss of sessionStudentsList) {
        // Skip absent students — they don't receive emails
        if (ss.absent) continue;
        const student = studentMap.get(ss.studentId);
        if (student?.email) {
          // Get existing token or generate new one
          let token = tokenMap.get(student.id);
          if (!token) {
            token = await generateSessionTokenForStudent(input.sessionId, student.id);
          }
          const accessUrl = baseUrl ? `${baseUrl}/avaliacao?token=${token}` : "";
          const html = buildSessionOpenedEmailHtml({
            studentName: student.name,
            sessionLabel: session.label,
            accessCode: "",
            accessUrl,
            componentCode,
            classCode: cls.classCode,
          });
          sendEmail({
            to: student.email,
            subject: `Sessão Tutorial - ${session.label}`,
            text: `Olá ${student.name}, a sessão ${session.label} está aberta. Acesse o link para avaliar: ${accessUrl}`,
            html,
          }).catch(err => console.error(`[Email] Failed to send to ${student.email}:`, err));
          emailsSent++;
        }
      }
      console.log(`[Sessions] Resent emails for session ${input.sessionId}, ${emailsSent} emails queued`);
      return { emailsSent };
    }),
    // List sessions by component with optional semester/class filters
    listByComponent: approvedProcedure.input(z.object({
      componentId: z.number(),
      semester: z.string().optional(),
      classId: z.number().optional(),
    })).query(async ({ ctx, input }) => {
      await assertComponentAccess(ctx.user.id, ctx.user.role, input.componentId);
      return listSessionsByComponent(input.componentId, input.semester, input.classId);
    }),
    // List sessions by component with eval permissions (for TutorialEvalPage)
    listByComponentWithPermissions: professorProcedure.input(z.object({
      componentId: z.number(),
      semester: z.string().optional(),
      classId: z.number().optional(),
    })).query(async ({ ctx, input }) => {
      await assertComponentAccess(ctx.user.id, ctx.user.role, input.componentId);
      const sessionsList = await listSessionsByComponent(input.componentId, input.semester, input.classId);
      if (ctx.user.role === "admin") {
        return sessionsList.map(s => ({ ...s, evalPermission: "admin" as const }));
      }
      // For each session, determine permission based on class ownership
      const compRole = await getUserComponentRole(ctx.user.id, input.componentId);
      const isCoordinator = compRole === "coordinator";
      const results = await Promise.all(sessionsList.map(async (s) => {
        const cls = await getClassById(s.classId);
        if (!cls) return { ...s, evalPermission: "no_permission" as const };
        const isOwner = cls.professorUserId === ctx.user.id;
        if (isOwner) return { ...s, evalPermission: "owner" as const };
        if (isCoordinator) return { ...s, evalPermission: "coordinator" as const };
        const permitted = await hasEvalPermission(s.classId, ctx.user.id);
        return { ...s, evalPermission: permitted ? "authorized" as const : "no_permission" as const };
      }));
      return results;
    }),
  }),

  // ─── Student simplified access (no login required) ───
  studentAccess: router({
    // Step 1: Student enters enrollment number
    // Returns student info + whether email is registered (needs setup or code)
    loginByEnrollment: publicProcedure.input(z.object({
      enrollment: z.string().min(1),
    })).mutation(async ({ input }) => {
      const student = await findStudentByEnrollment(input.enrollment.trim());
      if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Matrícula não encontrada no sistema. Verifique se digitou corretamente." });
      const hasEmail = !!student.email;
      const hasPhoto = !!student.photoUrl;
      // If student has email, auto-send verification code
      let codeSent = false;
      if (hasEmail && student.email) {
        try {
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
          await createEmailVerificationCode(student.email.toLowerCase(), code, expiresAt);
          const html = buildVerificationEmailHtml(code, student.email.toLowerCase());
          const result = await sendEmail({
            to: student.email.toLowerCase(),
            subject: "Código de Acesso - Sessão Tutorial",
            text: `Seu código de acesso é: ${code}. Válido por 15 minutos.`,
            html,
          });
          codeSent = result.success;
          if (!result.success) {
            console.error("[StudentAccess] Failed to send login code:", result.error);
          }
        } catch (err) {
          console.error("[StudentAccess] Error sending login code:", err);
        }
      }
      // Mask email for display (show first 3 chars + domain)
      let maskedEmail: string | null = null;
      if (hasEmail && student.email) {
        const [local, domain] = student.email.split("@");
        maskedEmail = local.length > 3 ? local.slice(0, 3) + "***@" + domain : local + "***@" + domain;
      }
      return {
        studentId: student.id,
        studentName: student.name,
        studentEnrollment: student.enrollment,
        hasEmail,
        hasPhoto,
        maskedEmail,
        codeSent,
      };
    }),
    // Step 2a: Verify login code (for students who already have email)
    verifyLoginCode: publicProcedure.input(z.object({
      studentId: z.number(),
      code: z.string().length(6),
    })).mutation(async ({ input }) => {
      const studentData = await getStudentById(input.studentId);
      if (!studentData || !studentData.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Aluno sem e-mail cadastrado" });
      const valid = await verifyEmailCode(studentData.email.toLowerCase(), input.code);
      if (!valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Código inválido ou expirado. Verifique e tente novamente." });
      const classes = await getClassesForStudent(input.studentId);
      return {
        studentId: studentData.id,
        studentName: studentData.name,
        studentEmail: studentData.email,
        studentEnrollment: studentData.enrollment,
        studentPhotoUrl: studentData.photoUrl,
        classes,
        authenticated: true,
      };
    }),
    // Step 2b: Resend login code
    resendLoginCode: publicProcedure.input(z.object({
      studentId: z.number(),
    })).mutation(async ({ input }) => {
      const studentData = await getStudentById(input.studentId);
      if (!studentData || !studentData.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Aluno sem e-mail cadastrado" });
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await createEmailVerificationCode(studentData.email.toLowerCase(), code, expiresAt);
      const html = buildVerificationEmailHtml(code, studentData.email.toLowerCase());
      const result = await sendEmail({
        to: studentData.email.toLowerCase(),
        subject: "Código de Acesso - Sessão Tutorial",
        text: `Seu código de acesso é: ${code}. Válido por 15 minutos.`,
        html,
      });
      if (!result.success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Erro ao enviar código" });
      return { success: true };
    }),
    // Get evaluation history for a student
    myEvaluationHistory: publicProcedure.input(z.object({
      studentId: z.number(),
    })).query(async ({ input }) => {
      return await getStudentEvaluationHistory(input.studentId);
    }),
    // Get open sessions for a logged-in student
    myOpenSessions: publicProcedure.input(z.object({
      studentId: z.number(),
    })).query(async ({ input }) => {
      const openSessions = await getOpenSessionsForStudent(input.studentId);
      // For each session, check if student already submitted and if there's a Mesa to re-evaluate
      const sessionsWithStatus = await Promise.all(openSessions.map(async (s) => {
        const submitted = await hasStudentSubmitted(s.sessionId, input.studentId);
        // For closed sessions, check if there's a Mesa student (other than the current student)
        let mesaStudentId: number | null = null;
        let hasMesaToReview = false;
        if (s.sessionStatus === "closed") {
          const sessionStudentsList = await getSessionStudents(s.sessionId);
          const mesaStudent = sessionStudentsList.find(
            st => st.role === "MESA" && !st.absent && st.studentId !== input.studentId
          );
          if (mesaStudent) {
            mesaStudentId = mesaStudent.studentId;
            hasMesaToReview = true;
          }
        }
        return { ...s, alreadySubmitted: submitted, hasMesaToReview, mesaStudentId };
      }));
      return sessionsWithStatus;
    }),
    validateCode: publicProcedure.input(z.object({
      accessCode: z.string().min(1).max(8),
    })).query(async ({ input }) => {
      const session = await getSessionByAccessCode(input.accessCode.toUpperCase());
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Código de acesso inválido" });
      if (session.status !== "open" && session.status !== "closed") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta sessão não está disponível para acesso" });
      const cls = await getClassById(session.classId);
      let componentCode = "";
      let componentName = "";
      if (cls?.componentId) {
        const comp = await getComponentById(cls.componentId);
        componentCode = comp?.code ?? "";
        componentName = comp?.name ?? "";
      }
      return {
        sessionId: session.id,
        label: session.label,
        classCode: cls?.classCode ?? "",
        componentCode,
        componentName,
        semester: cls?.semester ?? "",
        sessionStatus: session.status,
      };
    }),
    login: publicProcedure.input(z.object({
      accessCode: z.string().min(1).max(8),
      enrollment: z.string().min(1),
    })).mutation(async ({ input }) => {
      const session = await getSessionByAccessCode(input.accessCode.toUpperCase());
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Código de acesso inválido" });
      if (session.status !== "open" && session.status !== "closed") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta sessão não está disponível para acesso" });
      const student = await findStudentByEnrollmentInClass(input.enrollment.trim(), session.classId);
      if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Matrícula não encontrada nesta turma. Verifique se digitou corretamente." });
      const sessionStudentsList = await getSessionStudents(session.id);
      const isInSession = sessionStudentsList.some(s => s.studentId === student.id);
      if (!isInSession) throw new TRPCError({ code: "NOT_FOUND", message: "Você não está inscrito nesta sessão." });
      const submitted = await hasStudentSubmitted(session.id, student.id);
      const evalCount = await getStudentEvaluationCount(student.id);
      return {
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        studentPhotoUrl: student.photoUrl,
        sessionId: session.id,
        sessionLabel: session.label,
        sessionStatus: session.status,
        classId: session.classId,
        alreadySubmitted: submitted,
        isFirstEval: evalCount === 0 && !submitted,
      };
    }),
    sendEmailVerification: publicProcedure.input(z.object({
      studentId: z.number(),
      email: z.string().email(),
    })).mutation(async ({ input }) => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await createEmailVerificationCode(input.email.toLowerCase(), code, expiresAt);
      const html = buildVerificationEmailHtml(code, input.email.toLowerCase());
      const result = await sendEmail({
        to: input.email.toLowerCase(),
        subject: "Código de Verificação - Sessão Tutorial",
        text: `Seu código de verificação é: ${code}. Válido por 15 minutos.`,
        html,
      });
      if (!result.success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Erro ao enviar e-mail de verificação" });
      return { success: true };
    }),
    verifyEmailCode: publicProcedure.input(z.object({
      studentId: z.number(),
      email: z.string().email(),
      code: z.string().length(6),
    })).mutation(async ({ input }) => {
      const valid = await verifyEmailCode(input.email.toLowerCase(), input.code);
      if (!valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Código inválido ou expirado" });
      await updateStudentEmail(input.studentId, input.email.toLowerCase());
      return { success: true };
    }),
    uploadPhoto: publicProcedure.input(z.object({
      studentId: z.number(),
      photoBase64: z.string(),
      mimeType: z.string(),
    })).mutation(async ({ input }) => {
      const buffer = Buffer.from(input.photoBase64, "base64");
      if (buffer.length > 5 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "Foto deve ter no máximo 5MB" });
      const ext = input.mimeType.includes("png") ? "png" : input.mimeType.includes("webp") ? "webp" : "jpg";
      const suffix = Math.random().toString(36).substring(2, 10);
      const fileKey = `student-photos/${input.studentId}-${suffix}.${ext}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      await updateStudentPhoto(input.studentId, url);
      return { success: true, photoUrl: url };
    }),
    updateEmail: publicProcedure.input(z.object({
      studentId: z.number(),
      email: z.string().email(),
    })).mutation(async ({ input }) => {
      await updateStudentEmail(input.studentId, input.email.toLowerCase());
      return { success: true };
    }),
    // Access session directly by individual token (from email link)
    accessByToken: publicProcedure.input(z.object({
      token: z.string().min(1),
    })).query(async ({ input }) => {
      const tokenData = await getSessionByStudentToken(input.token);
      if (!tokenData) throw new TRPCError({ code: "NOT_FOUND", message: "Link inválido ou expirado" });
      // Todos os estados são permitidos — o frontend trata cada caso (active, open, closed, finished)
      const student = await getStudentById(tokenData.studentId);
      if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Aluno não encontrado" });
      const alreadySubmitted = await hasStudentSubmitted(tokenData.sessionId, tokenData.studentId);
      let componentCode = "";
      let componentName = "";
      if (tokenData.componentId) {
        const comp = await getComponentById(tokenData.componentId);
        componentCode = comp?.code ?? "";
        componentName = comp?.name ?? "";
      }
      return {
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        studentEnrollment: student.enrollment,
        studentPhotoUrl: student.photoUrl,
        sessionId: tokenData.sessionId,
        sessionLabel: tokenData.sessionLabel,
        sessionStatus: tokenData.sessionStatus,
        classId: tokenData.classId,
        classCode: tokenData.classCode,
        componentCode,
        componentName,
        problemNumber: tokenData.problemNumber,
        sessionNumber: tokenData.sessionNumber,
        alreadySubmitted,
      };
    }),
    getSessionStudents: publicProcedure.input(z.object({
      sessionId: z.number(),
    })).query(async ({ input }) => {
      return getSessionStudents(input.sessionId);
    }),
    getPreviousMesaScore: publicProcedure.input(z.object({
      sessionId: z.number(),
      evaluatorStudentId: z.number(),
      mesaStudentId: z.number(),
    })).query(async ({ input }) => {
      const score = await getPreviousMesaScore(input.sessionId, input.evaluatorStudentId, input.mesaStudentId);
      return { score };
    }),
    updateDesempenho: publicProcedure.input(z.object({
      sessionId: z.number(),
      evaluatorStudentId: z.number(),
      items: z.array(z.object({
        evaluatedStudentId: z.number(),
        desempenhoPapel: z.number().min(0).max(1),
      })),
    })).mutation(async ({ input }) => {
      const session = await getSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      if (session.status !== "closed") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta sessão não está fechada. O desempenho no papel só pode ser atualizado em sessões fechadas." });
      // Qualquer aluno presente pode atualizar o desempenho da Mesa, mesmo sem ter submetido durante a sessão aberta
      await updateDesempenhoPapel({
        sessionId: input.sessionId,
        evaluatorStudentId: input.evaluatorStudentId,
        items: input.items,
      });
      return { success: true };
    }),
    submitEvaluation: publicProcedure.input(z.object({
      sessionId: z.number(),
      evaluatorStudentId: z.number(),
      items: z.array(z.object({
        evaluatedStudentId: z.number(),
        pontualidade: z.number().min(0).max(1),
        pesquisaMetas: z.number().min(0).max(1),
        dominio: z.number().min(0).max(1),
        participacao: z.number().min(0).max(1),
        desempenhoPapel: z.number().min(0).max(1),
      })),
    })).mutation(async ({ input }) => {
      const session = await getSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      if (session.status !== "open") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta sessão não está aberta para avaliações" });
      const alreadySubmitted = await hasStudentSubmitted(session.id, input.evaluatorStudentId);
      if (alreadySubmitted) throw new TRPCError({ code: "BAD_REQUEST", message: "Você já realizou a avaliação desta sessão. Solicite ao professor a liberação para reavaliar." });
      // Fetch role/absent from sessionStudents (defined by professor)
      const sessionStudentsList = await getSessionStudents(input.sessionId);
      const studentMap = new Map(sessionStudentsList.map(s => [s.studentId, s]));
      // Block evaluation from absent students
      const evaluatorEntry = studentMap.get(input.evaluatorStudentId);
      if (evaluatorEntry?.absent) throw new TRPCError({ code: "FORBIDDEN", message: "Alunos marcados como ausentes não podem avaliar" });
      const selfEval = input.items.find(i => i.evaluatedStudentId === input.evaluatorStudentId);
      if (selfEval) throw new TRPCError({ code: "BAD_REQUEST", message: "Autoavaliação não é permitida" });
      const itemsWithRoles = input.items.map(item => {
        const ss = studentMap.get(item.evaluatedStudentId);
        const role = ss?.role ?? "PARTICIPANTE";
        const absent = ss?.absent ?? false;
        return { ...item, role: role as "COORDENADOR" | "MESA" | "QUADRO" | "PARTICIPANTE", absent };
      });
      const evalId = await submitEvaluation({
        sessionId: session.id,
        evaluatorStudentId: input.evaluatorStudentId,
        items: itemsWithRoles,
      });
      return { success: true, evaluationId: evalId };
    }),
    hasSubmitted: protectedProcedure.input(z.object({
      sessionId: z.number(),
      studentId: z.number(),
    })).query(async ({ input }) => {
      return hasStudentSubmitted(input.sessionId, input.studentId);
    }),
    // Allow re-evaluation: admin, coordinator of component, or prof who created the class
    allowReevaluation: approvedProcedure.input(z.object({
      sessionId: z.number(),
      studentId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      if (session.status === "finished") throw new TRPCError({ code: "FORBIDDEN", message: "Sessão encerrada. Nenhuma alteração é permitida." });
      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      const deleted = await deleteStudentEvaluation(input.sessionId, input.studentId);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Avaliação não encontrada para este aluno nesta sessão" });
      return { success: true };
    }),
    submittedStudents: approvedProcedure.input(z.object({
      sessionId: z.number(),
    })).query(async ({ input }) => {
      const evals = await getSessionEvaluations(input.sessionId);
      return evals.map(e => ({ studentId: e.evaluatorStudentId, submittedAt: e.submittedAt }));
    }),
  }),

  // ─── Tutorial Evaluation (professor evaluates session) ───
  // Coordinator/prof of the component or admin can evaluate
  tutorialEval: router({
    submit: professorProcedure.input(z.object({
      sessionId: z.number(),
      organizacao: z.number().min(0).max(1),
      cooperacao: z.number().min(0).max(1),
      conteudo: z.number().min(0).max(1),
      objetivo: z.number().min(0).max(1),
      metas: z.number().min(0).max(1),
    })).mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      if (session.status === "finished") throw new TRPCError({ code: "FORBIDDEN", message: "Sessão encerrada. Nenhuma alteração é permitida." });
      // Professor pode avaliar a qualquer momento (sessão ativa, em avaliação ou fechada)
      // Não há bloqueio por status exceto encerrada
      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);
      // Admin can always evaluate; otherwise check permissions
      if ((ctx.user as any).role !== "admin" && cls.professorUserId !== ctx.user.id) {
        const compRole = await getUserComponentRole(ctx.user.id, cls.componentId);
        if (compRole !== "coordinator") {
          const permitted = await hasEvalPermission(cls.id, ctx.user.id);
          if (!permitted) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Você não tem autorização para avaliar sessões desta turma. Solicite ao professor responsável ou ao coordenador do componente." });
          }
        }
      }
      const evalId = await submitTutorialEvaluation({
        ...input,
        professorUserId: ctx.user.id,
      });
      // Limpar rascunho se existir
      await deleteTutorialEvalDraft(input.sessionId);
      // NÃO mudar status da sessão para "finished" aqui.
      // A avaliação do tutor não deve fechar a sessão para os alunos,
      // pois eles podem ainda estar preenchendo suas avaliações.
      return { success: true, evaluationId: evalId };
    }),
    get: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => {
      const eval_ = await getTutorialEvaluation(input.sessionId);
      if (!eval_) return null;
      const grade = calculateTutorialGrade(eval_);
      return { ...eval_, tutorialGrade: Math.round(grade * 10) / 10 };
    }),
    // Check if current user can evaluate a specific session
    canEvaluate: professorProcedure.input(z.object({ sessionId: z.number() })).query(async ({ ctx, input }) => {
      if (ctx.user.role === "admin") return { canEvaluate: true, reason: "admin" };
      const session = await getSessionById(input.sessionId);
      if (!session) return { canEvaluate: false, reason: "session_not_found" };
      const cls = await getClassById(session.classId);
      if (!cls) return { canEvaluate: false, reason: "class_not_found" };
      // Class owner can always evaluate
      if (cls.professorUserId === ctx.user.id) return { canEvaluate: true, reason: "owner" };
      // Coordinator of component can always evaluate
      const compRole = await getUserComponentRole(ctx.user.id, cls.componentId);
      if (compRole === "coordinator") return { canEvaluate: true, reason: "coordinator" };
      // Check explicit permission
      if (compRole === "prof") {
        const permitted = await hasEvalPermission(cls.id, ctx.user.id);
        return { canEvaluate: permitted, reason: permitted ? "authorized" : "not_authorized" };
      }
      return { canEvaluate: false, reason: "no_access" };
    }),
    // Save draft of tutorial evaluation
    saveDraft: professorProcedure.input(z.object({
      sessionId: z.number(),
      organizacao: z.number().min(0).max(1),
      cooperacao: z.number().min(0).max(1),
      conteudo: z.number().min(0).max(1),
      objetivo: z.number().min(0).max(1),
      metas: z.number().min(0).max(1),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role === "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Administradores não avaliam sessões tutoriais" });
      }
      const session = await getSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      if (session.status === "finished") throw new TRPCError({ code: "FORBIDDEN", message: "Sessão encerrada. Nenhuma alteração é permitida." });
      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);
      const draftId = await saveTutorialEvalDraft({
        ...input,
        professorUserId: ctx.user.id,
      });
      return { success: true, draftId };
    }),
    // Get draft of tutorial evaluation
    getDraft: professorProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => {
      const draft = await getTutorialEvalDraft(input.sessionId);
      return draft || null;
    }),
    // Save professor's per-student notes (positive/negative points + comments)
    saveStudentNotes: professorProcedure.input(z.object({
      sessionId: z.number(),
      notes: z.array(z.object({
        studentId: z.number(),
        positivePoints: z.number().min(0).max(10),
        negativePoints: z.number().min(0).max(10),
        positiveTexts: z.array(z.string()).max(10).optional(),
        negativeTexts: z.array(z.string()).max(10).optional(),
        notes: z.string().nullable(),
      })),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role === "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Administradores não avaliam sessões tutoriais" });
      }
      const session = await getSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      if (session.status === "finished") throw new TRPCError({ code: "FORBIDDEN", message: "Sessão encerrada. Nenhuma alteração é permitida." });
      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);
      await bulkUpsertProfessorStudentNotes(
        input.notes.map(n => ({
          sessionId: input.sessionId,
          studentId: n.studentId,
          professorUserId: ctx.user.id,
          positivePoints: n.positivePoints,
          negativePoints: n.negativePoints,
          positiveTexts: n.positiveTexts ?? null,
          negativeTexts: n.negativeTexts ?? null,
          notes: n.notes,
        }))
      );
      return { success: true };
    }),
    // Get professor's per-student notes for a session
    getStudentNotes: professorProcedure.input(z.object({ sessionId: z.number() })).query(async ({ ctx, input }) => {
      return getProfessorStudentNotes(input.sessionId, ctx.user.id);
    }),
  }),

  // ─── Evaluation Permissions (authorize professors to evaluate sessions of a class) ───
  evalPermissions: router({
    // List authorized professors for a class
    list: approvedProcedure.input(z.object({ classId: z.number() })).query(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);
      return listEvalPermissions(input.classId);
    }),
    // List candidate professors (same component, not the class owner)
    candidates: approvedProcedure.input(z.object({ classId: z.number() })).query(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      // Only class owner, coordinator of component, or admin can see candidates
      if (ctx.user.role !== "admin" && cls.professorUserId !== ctx.user.id) {
        const compRole = await getUserComponentRole(ctx.user.id, cls.componentId);
        if (compRole !== "coordinator") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o professor da turma ou coordenador do componente pode gerenciar autorizações" });
        }
      }
      return listComponentProfessorsForClass(input.classId);
    }),
    // Grant permission: class owner or coordinator of component can authorize
    grant: approvedProcedure.input(z.object({
      classId: z.number(),
      authorizedUserId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      // Only class owner, coordinator of component, or admin can grant
      if (ctx.user.role !== "admin" && cls.professorUserId !== ctx.user.id) {
        const compRole = await getUserComponentRole(ctx.user.id, cls.componentId);
        if (compRole !== "coordinator") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o professor da turma ou coordenador do componente pode autorizar avaliações" });
        }
      }
      await grantEvalPermission(input.classId, input.authorizedUserId, ctx.user.id);
      await createAuditLog({ action: "grant_eval_permission", actorUserId: ctx.user.id, targetUserId: input.authorizedUserId, classId: input.classId, details: JSON.stringify({ classId: input.classId }) });
      // In-app notification
      const grantComponent = await getComponentById(cls.componentId);
      await createNotification({
        userId: input.authorizedUserId,
        type: "eval_permission_granted",
        title: "Permissão de Avaliação Concedida",
        message: `Você recebeu permissão para avaliar sessões da turma ${cls.classCode} do componente ${grantComponent?.code || ""} - ${grantComponent?.name || ""}.`,
        metadata: JSON.stringify({ classId: input.classId, componentId: cls.componentId }),
      });
      // Send notification email to the authorized professor
      try {
        const authorizedUser = await getUserById(input.authorizedUserId);
        const component = await getComponentById(cls.componentId);
        if (authorizedUser?.email && component) {
          const grantedByName = ctx.user.name || ctx.user.email || "Administrador";
          await sendEmail({
            to: authorizedUser.email,
            subject: `Permissão de Avaliação Concedida - ${component.code} ${cls.classCode}`,
            text: `Olá ${authorizedUser.name || ""}, você recebeu permissão para avaliar sessões da turma ${cls.classCode} do componente ${component.code} - ${component.name}. Concedida por ${grantedByName}.`,
            html: buildEvalPermissionGrantedEmailHtml(
              authorizedUser.name || authorizedUser.email,
              cls.classCode,
              component.code,
              component.name,
              grantedByName
            ),
          });
        }
      } catch (e) {
        console.error("[Email] Failed to send eval permission notification:", e);
      }
      return { success: true };
    }),
    // Revoke permission: class owner or coordinator of component can revoke
    revoke: approvedProcedure.input(z.object({
      classId: z.number(),
      authorizedUserId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      // Only class owner, coordinator of component, or admin can revoke
      if (ctx.user.role !== "admin" && cls.professorUserId !== ctx.user.id) {
        const compRole = await getUserComponentRole(ctx.user.id, cls.componentId);
        if (compRole !== "coordinator") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o professor da turma ou coordenador do componente pode revogar autorizações" });
        }
      }
      await revokeEvalPermission(input.classId, input.authorizedUserId);
      await createAuditLog({ action: "revoke_eval_permission", actorUserId: ctx.user.id, targetUserId: input.authorizedUserId, classId: input.classId, details: JSON.stringify({ classId: input.classId }) });
      // In-app notification
      const revokeComponent = await getComponentById(cls.componentId);
      await createNotification({
        userId: input.authorizedUserId,
        type: "eval_permission_revoked",
        title: "Permissão de Avaliação Revogada",
        message: `Sua permissão para avaliar sessões da turma ${cls.classCode} do componente ${revokeComponent?.code || ""} - ${revokeComponent?.name || ""} foi revogada.`,
        metadata: JSON.stringify({ classId: input.classId, componentId: cls.componentId }),
      });
      return { success: true };
    }),
  }),

  // ─── Professor Management ───
  professors: router({
    // System-level pending users (admin only)
    pending: adminProcedure.query(async () => {
      return listPendingProfessors();
    }),
    // All approved professors (any approved user can see)
    approved: approvedProcedure.query(async () => {
      return listApprovedProfessors();
    }),
    // Approve user into system (admin only)
    approve: adminProcedure.input(z.object({ userId: z.number() })).mutation(async ({ input }) => {
      await approveUser(input.userId);
      return { success: true };
    }),
    // Reject user (admin only)
    reject: adminProcedure.input(z.object({ userId: z.number() })).mutation(async ({ input }) => {
      await rejectUser(input.userId);
      return { success: true };
    }),
    // Delete user from system (admin only)
    deleteUser: adminProcedure.input(z.object({ userId: z.number() })).mutation(async ({ input }) => {
      try {
        await deleteUser(input.userId);
        return { success: true };
      } catch (err: any) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: err.message || "Erro ao excluir usuário" });
      }
    }),
    // Get my component memberships
    myComponents: approvedProcedure.query(async ({ ctx }) => {
      return getUserComponents(ctx.user.id);
    }),
    // Get another user's components
    components: approvedProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
      return listProfessorComponents(input.userId);
    }),
    // All professor-component mappings
    allComponents: approvedProcedure.query(async () => {
      return listAllProfessorComponents();
    }),
    // Request to join a component (any approved user)
    requestComponent: approvedProcedure.input(z.object({
      componentId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      try {
        await requestComponentMembership(ctx.user.id, input.componentId);
        // Notify coordinators of the component via email
        try {
          const component = await getComponentById(input.componentId);
          const coordinators = await getComponentCoordinators(input.componentId);
          const requester = await getUserById(ctx.user.id);
          if (component && requester && coordinators.length > 0) {
            for (const coord of coordinators) {
              if (coord.userEmail) {
                await sendEmail({
                  to: coord.userEmail,
                  subject: `Nova Solicitação de Entrada - ${component.code}`,
                  text: `Olá ${coord.userName || ""}, o professor ${requester.name || requester.email || ""} solicitou entrada no componente ${component.code} - ${component.name}. Acesse o sistema para aprovar ou rejeitar.`,
                  html: buildNewRequestEmailHtml(
                    coord.userName || coord.userEmail,
                    requester.name || requester.email || "Professor",
                    requester.email || "Não informado",
                    component.code,
                    component.name,
                  ),
                });
              }
            }
          }
        } catch (emailErr) {
          console.error("[Email] Failed to send new request notification to coordinators:", emailErr);
        }
        // Create in-app notification for coordinators about the pending request
        try {
          const component = await getComponentById(input.componentId);
          const coordinators = await getComponentCoordinators(input.componentId);
          const requester = await getUserById(ctx.user.id);
          if (component && requester && coordinators.length > 0) {
            for (const coord of coordinators) {
              await createNotification({
                userId: coord.userId,
                type: "pending_request",
                title: `Nova Solicitação de Entrada`,
                message: `${requester.name || requester.email || "Professor"} solicitou entrada em ${component.code} - ${component.name}`,
                metadata: JSON.stringify({ componentId: input.componentId, requesterId: ctx.user.id }),
              });
            }
          }
        } catch (notifErr) {
          console.error("[Notification] Failed to create pending request notification:", notifErr);
        }
        return { success: true };
      } catch (e: any) {
        throw new TRPCError({ code: "CONFLICT", message: e.message || "Erro ao solicitar entrada no componente" });
      }
    }),
    // Pending component requests (for coordinators: only their components; for admin: all)
    pendingComponentRequests: approvedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin") {
        // Admin sees all pending requests
        const allComps = await listComponents();
        const allIds = allComps.map(c => c.id);
        if (allIds.length === 0) return [];
        return listPendingRequestsByComponents(allIds);
      }
      // Coordinator sees pending requests for their coordinated components
      const coordCompIds = await getCoordinatorComponentIds(ctx.user.id);
      if (coordCompIds.length === 0) return [];
      return listPendingRequestsByComponents(coordCompIds);
    }),
    // Approve component request (admin or coordinator of that component)
    approveComponentRequest: approvedProcedure.input(z.object({
      userId: z.number(),
      componentId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      await assertComponentCoordinator(ctx.user.id, ctx.user.role, input.componentId);
      await approveComponentRequest(input.userId, input.componentId, ctx.user.id);
      await createAuditLog({ action: "approve_component_request", actorUserId: ctx.user.id, targetUserId: input.userId, componentId: input.componentId, details: JSON.stringify({ componentId: input.componentId }) });

      // Auto-approve user in the system if still pending
      const targetUser = await getUserById(input.userId);
      let autoApprovedInSystem = false;
      if (targetUser && targetUser.approvalStatus === "pending") {
        await approveUser(input.userId);
        autoApprovedInSystem = true;
        await createAuditLog({
          action: "auto_approve_user",
          actorUserId: ctx.user.id,
          targetUserId: input.userId,
          componentId: input.componentId,
          details: JSON.stringify({ reason: "Aprovado automaticamente ao ter componente aprovado", componentId: input.componentId }),
        });
      }

      // In-app notification
      const approvedComponent = await getComponentById(input.componentId);
      const notifMessage = autoApprovedInSystem
        ? `Sua solicitação de entrada no componente ${approvedComponent?.code || ""} - ${approvedComponent?.name || ""} foi aprovada. Você também foi aprovado no sistema como professor.`
        : `Sua solicitação de entrada no componente ${approvedComponent?.code || ""} - ${approvedComponent?.name || ""} foi aprovada.`;
      await createNotification({
        userId: input.userId,
        type: "component_approved",
        title: autoApprovedInSystem ? "Solicitação Aprovada - Acesso ao Sistema Liberado" : "Solicitação Aprovada",
        message: notifMessage,
        metadata: JSON.stringify({ componentId: input.componentId, autoApprovedInSystem }),
      });
      // Send notification email
      try {
        const user = targetUser || await getUserById(input.userId);
        const component = approvedComponent;
        if (user?.email && component) {
          await sendEmail({
            to: user.email,
            subject: `Solicitação Aprovada - ${component.code}`,
            text: `Olá ${user.name || ""}, sua solicitação de entrada no componente ${component.code} - ${component.name} foi aprovada.${autoApprovedInSystem ? " Você também foi aprovado no sistema como professor." : ""}`,
            html: buildComponentApprovalEmailHtml(user.name || user.email, component.code, component.name),
          });
        }
      } catch (e) {
        console.error("[Email] Failed to send approval notification:", e);
      }
      return { success: true, autoApprovedInSystem };
    }),
    // Reject component request (admin or coordinator of that component)
    rejectComponentRequest: approvedProcedure.input(z.object({
      userId: z.number(),
      componentId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      await assertComponentCoordinator(ctx.user.id, ctx.user.role, input.componentId);
      // Get user and component info before rejecting
      const user = await getUserById(input.userId);
      const component = await getComponentById(input.componentId);
      await rejectComponentRequest(input.userId, input.componentId);
      await createAuditLog({ action: "reject_component_request", actorUserId: ctx.user.id, targetUserId: input.userId, componentId: input.componentId, details: JSON.stringify({ componentId: input.componentId }) });
      // In-app notification
      await createNotification({
        userId: input.userId,
        type: "component_rejected",
        title: "Solicitação Rejeitada",
        message: `Sua solicitação de entrada no componente ${component?.code || ""} - ${component?.name || ""} foi rejeitada.`,
        metadata: JSON.stringify({ componentId: input.componentId }),
      });
      // Send notification email
      try {
        if (user?.email && component) {
          await sendEmail({
            to: user.email,
            subject: `Solicitação Rejeitada - ${component.code}`,
            text: `Olá ${user.name || ""}, sua solicitação de entrada no componente ${component.code} - ${component.name} foi rejeitada.`,
            html: buildComponentRejectionEmailHtml(user.name || user.email, component.code, component.name),
          });
        }
      } catch (e) {
        console.error("[Email] Failed to send rejection notification:", e);
      }
      return { success: true };
    }),
    // Approve all pending component requests visible to the current user (admin or coordinator)
    approveAllComponentRequests: approvedProcedure.mutation(async ({ ctx }) => {
      // Get pending requests visible to this user
      let pendingRequests: any[] = [];
      if (ctx.user.role === "admin") {
        const allComps = await listComponents();
        const allIds = allComps.map(c => c.id);
        if (allIds.length > 0) {
          pendingRequests = await listPendingRequestsByComponents(allIds);
        }
      } else {
        const coordCompIds = await getCoordinatorComponentIds(ctx.user.id);
        if (coordCompIds.length > 0) {
          pendingRequests = await listPendingRequestsByComponents(coordCompIds);
        }
      }
      if (pendingRequests.length === 0) {
        return { success: true, approvedCount: 0, autoApprovedUsers: 0 };
      }
      let approvedCount = 0;
      let autoApprovedUsers = 0;
      for (const req of pendingRequests) {
        try {
          await approveComponentRequest(req.userId, req.componentId, ctx.user.id);
          await createAuditLog({ action: "approve_component_request", actorUserId: ctx.user.id, targetUserId: req.userId, componentId: req.componentId, details: JSON.stringify({ componentId: req.componentId, batchApproval: true }) });
          // Auto-approve user in the system if still pending
          const targetUser = await getUserById(req.userId);
          let autoApproved = false;
          if (targetUser && targetUser.approvalStatus === "pending") {
            await approveUser(req.userId);
            autoApproved = true;
            autoApprovedUsers++;
            await createAuditLog({
              action: "auto_approve_user",
              actorUserId: ctx.user.id,
              targetUserId: req.userId,
              componentId: req.componentId,
              details: JSON.stringify({ reason: "Aprovado automaticamente via aprovação em lote", componentId: req.componentId }),
            });
          }
          // In-app notification
          const approvedComponent = await getComponentById(req.componentId);
          const notifMessage = autoApproved
            ? `Sua solicitação de entrada no componente ${approvedComponent?.code || ""} - ${approvedComponent?.name || ""} foi aprovada. Você também foi aprovado no sistema como professor.`
            : `Sua solicitação de entrada no componente ${approvedComponent?.code || ""} - ${approvedComponent?.name || ""} foi aprovada.`;
          await createNotification({
            userId: req.userId,
            type: "component_approved",
            title: autoApproved ? "Solicitação Aprovada - Acesso ao Sistema Liberado" : "Solicitação Aprovada",
            message: notifMessage,
            metadata: JSON.stringify({ componentId: req.componentId, autoApprovedInSystem: autoApproved, batchApproval: true }),
          });
          // Send notification email
          try {
            const user = targetUser || await getUserById(req.userId);
            const component = approvedComponent;
            if (user?.email && component) {
              await sendEmail({
                to: user.email,
                subject: `Solicitação Aprovada - ${component.code}`,
                text: `Olá ${user.name || ""}, sua solicitação de entrada no componente ${component.code} - ${component.name} foi aprovada.${autoApproved ? " Você também foi aprovado no sistema como professor." : ""}`,
                html: buildComponentApprovalEmailHtml(user.name || user.email, component.code, component.name),
              });
            }
          } catch (e) {
            console.error("[Email] Failed to send batch approval notification:", e);
          }
          approvedCount++;
        } catch (e) {
          console.error(`[BatchApproval] Failed to approve userId=${req.userId} componentId=${req.componentId}:`, e);
        }
      }
      await createAuditLog({
        action: "batch_approve_component_requests",
        actorUserId: ctx.user.id,
        details: JSON.stringify({ approvedCount, autoApprovedUsers, totalRequests: pendingRequests.length }),
      });
      return { success: true, approvedCount, autoApprovedUsers };
    }),
    // Promote prof to coordinator in a component (coordinator of that component or admin)
    promoteToCoordinator: approvedProcedure.input(z.object({
      userId: z.number(),
      componentId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      await assertComponentCoordinator(ctx.user.id, ctx.user.role, input.componentId);
      await setComponentRole(input.userId, input.componentId, "coordinator");
      await createAuditLog({ action: "promote_to_coordinator", actorUserId: ctx.user.id, targetUserId: input.userId, componentId: input.componentId });
      // In-app notification
      const promoComponent = await getComponentById(input.componentId);
      await createNotification({
        userId: input.userId,
        type: "promoted_to_coordinator",
        title: "Promovido a Coordenador",
        message: `Você foi promovido a coordenador do componente ${promoComponent?.code || ""} - ${promoComponent?.name || ""}.`,
        metadata: JSON.stringify({ componentId: input.componentId }),
      });
      // Also update user's system role to coordinator if they are currently prof
      const user = await getUserById(input.userId);
      if (user && user.role === "prof") {
        const { updateUserRole } = await import("./db");
        await updateUserRole(input.userId, "coordinator");
      }
      return { success: true };
    }),
    // Demote coordinator to prof in a component (coordinator of that component or admin)
    demoteToProf: approvedProcedure.input(z.object({
      userId: z.number(),
      componentId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      await assertComponentCoordinator(ctx.user.id, ctx.user.role, input.componentId);
      await setComponentRole(input.userId, input.componentId, "prof");
      await createAuditLog({ action: "demote_to_prof", actorUserId: ctx.user.id, targetUserId: input.userId, componentId: input.componentId });
      // In-app notification
      const demoteComponent = await getComponentById(input.componentId);
      await createNotification({
        userId: input.userId,
        type: "demoted_to_prof",
        title: "Papel Alterado",
        message: `Seu papel no componente ${demoteComponent?.code || ""} - ${demoteComponent?.name || ""} foi alterado para professor.`,
        metadata: JSON.stringify({ componentId: input.componentId }),
      });
      // Check if user is still coordinator of any component, if not, demote system role
      const userComps = await getUserComponents(input.userId);
      const stillCoordinator = userComps.some(c => c.componentRole === "coordinator" && c.status === "approved" && c.componentId !== input.componentId);
      if (!stillCoordinator) {
        const user = await getUserById(input.userId);
        if (user && user.role === "coordinator") {
          const { updateUserRole } = await import("./db");
          await updateUserRole(input.userId, "prof");
        }
      }
      return { success: true };
    }),
    // Remove professor from component (coordinator of that component or admin)
    removeFromComponent: approvedProcedure.input(z.object({
      userId: z.number(),
      componentId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      await assertComponentCoordinator(ctx.user.id, ctx.user.role, input.componentId);
      await removeProfessorFromComponent(input.userId, input.componentId);
      await createAuditLog({ action: "remove_from_component", actorUserId: ctx.user.id, targetUserId: input.userId, componentId: input.componentId });
      // In-app notification
      const removedComponent = await getComponentById(input.componentId);
      await createNotification({
        userId: input.userId,
        type: "removed_from_component",
        title: "Removido do Componente",
        message: `Você foi removido do componente ${removedComponent?.code || ""} - ${removedComponent?.name || ""}.`,
        metadata: JSON.stringify({ componentId: input.componentId }),
      });
      // Check if user still has any approved components, if not, check system role
      const userComps = await getUserComponents(input.userId);
      const hasCoordinator = userComps.some(c => c.componentRole === "coordinator" && c.status === "approved");
      if (!hasCoordinator) {
        const user = await getUserById(input.userId);
        if (user && user.role === "coordinator") {
          const { updateUserRole } = await import("./db");
          await updateUserRole(input.userId, "prof");
        }
      }
      return { success: true };
    }),
    // Add professor to component directly (admin only)
    addComponent: adminProcedure.input(z.object({
      userId: z.number(),
      componentId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      await addProfessorComponent(input.userId, input.componentId, ctx.user.id);
      return { success: true };
    }),
    // Remove component from professor (admin only)
    removeComponent: adminProcedure.input(z.object({
      userId: z.number(),
      componentId: z.number(),
    })).mutation(async ({ input }) => {
      await removeProfessorComponent(input.userId, input.componentId);
      return { success: true };
    }),
    myStatus: protectedProcedure.query(async ({ ctx }) => {
      return { approvalStatus: ctx.user.approvalStatus, role: ctx.user.role };
    }),
    // List approved professors for a specific component (admin or coordinator of that component)
    listByComponent: approvedProcedure.input(z.object({ componentId: z.number() })).query(async ({ input }) => {
      return listApprovedProfessorsByComponent(input.componentId);
    }),
    // Send invite email to a professor for a specific component
    sendInvite: approvedProcedure.input(z.object({
      email: z.string().email(),
      componentId: z.number(),
      origin: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const component = await getComponentById(input.componentId);
      if (!component) throw new TRPCError({ code: "NOT_FOUND", message: "Componente não encontrado" });
      await assertComponentCoordinator(ctx.user.id, ctx.user.role, input.componentId);
      const inviter = await getUserById(ctx.user.id);
      const registerUrl = `${input.origin}/`;
      const result = await sendEmail({
        to: input.email,
        subject: `Convite para o componente ${component.code} - Sistema de Sessão Tutorial`,
        text: `Você foi convidado por ${inviter?.name || "um professor"} para participar do componente ${component.code} - ${component.name}. Acesse: ${registerUrl}`,
        html: buildProfessorInviteEmailHtml({
          inviterName: inviter?.name || "Professor",
          componentCode: component.code,
          componentName: component.name,
          registerUrl,
        }),
      });
      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Erro ao enviar e-mail" });
      }
      await createAuditLog({
        action: "send_professor_invite",
        actorUserId: ctx.user.id,
        componentId: input.componentId,
        details: JSON.stringify({ invitedEmail: input.email, componentId: input.componentId }),
      });
      return { success: true };
    }),
  }),

  // ─── Results & Dashboard ───
  results: router({
    session: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => {
      return calculateSessionResults(input.sessionId);
    }),
    peerGradesMatrix: protectedProcedure.input(z.object({ sessionId: z.number(), provisional: z.boolean().optional() })).query(async ({ input }) => {
      return getPeerGradesMatrix(input.sessionId, input.provisional ?? false);
    }),
    sessionFinal: protectedProcedure.input(z.object({ sessionId: z.number(), provisional: z.boolean().optional() })).query(async ({ input }) => {
      return calculateDesempenhoScores(input.sessionId, input.provisional ?? false);
    }),
    problem: approvedProcedure.input(z.object({ classId: z.number(), problemNumber: z.number() })).query(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);
      return calculateProblemResults(input.classId, input.problemNumber);
    }),
    problemFinal: approvedProcedure.input(z.object({ classId: z.number(), problemNumber: z.number() })).query(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);
      return calculateProblemDesempenhoScores(input.classId, input.problemNumber);
    }),
    sessionsForClass: approvedProcedure.input(z.object({ classId: z.number() })).query(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);
      return listSessionsByClass(input.classId);
    }),
    studentConsolidated: approvedProcedure.input(z.object({ classId: z.number() })).query(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);
      return getStudentConsolidatedReport(input.classId);
    }),
    // Export all classes data for a component/semester
    allClassesSessionResults: approvedProcedure.input(z.object({
      componentId: z.number(),
      semester: z.string(),
      problemNumber: z.number(),
      sessionNumber: z.number(),
    })).query(async ({ ctx, input }) => {
      await assertComponentAccess(ctx.user.id, ctx.user.role, input.componentId);
      const classes = await listClassesByComponent(input.componentId, input.semester);
      const results = [];
      for (const cls of classes) {
        const sessions = await listSessionsByClass(cls.id);
        const session = sessions.find(s => s.problemNumber === input.problemNumber && s.sessionNumber === input.sessionNumber);
        if (!session) { results.push({ classCode: cls.classCode, classId: cls.id, sessionId: null, desempenhoScores: [] }); continue; }
        const desempenhoScores = await calculateDesempenhoScores(session.id, session.status !== 'finished');
        results.push({ classCode: cls.classCode, classId: cls.id, sessionId: session.id, desempenhoScores });
      }
      return results;
    }),

    allClassesProblemResults: approvedProcedure.input(z.object({
      componentId: z.number(),
      semester: z.string(),
      problemNumber: z.number(),
    })).query(async ({ ctx, input }) => {
      await assertComponentAccess(ctx.user.id, ctx.user.role, input.componentId);
      const classes = await listClassesByComponent(input.componentId, input.semester);
      const results = [];
      for (const cls of classes) {
        const problemFinal = await calculateProblemDesempenhoScores(cls.id, input.problemNumber);
        const sessions = await listSessionsByClass(cls.id);
        const problemSessions = sessions.filter(s => s.problemNumber === input.problemNumber).sort((a, b) => a.sessionNumber - b.sessionNumber);
        results.push({ classCode: cls.classCode, classId: cls.id, problemFinal, problemSessions });
      }
      return results;
    }),

    allClassesConsolidated: approvedProcedure.input(z.object({
      componentId: z.number(),
      semester: z.string(),
    })).query(async ({ ctx, input }) => {
      await assertComponentAccess(ctx.user.id, ctx.user.role, input.componentId);
      const classes = await listClassesByComponent(input.componentId, input.semester);
      const results = [];
      for (const cls of classes) {
        const report = await getStudentConsolidatedReport(cls.id);
        results.push({ classCode: cls.classCode, classId: cls.id, report });
      }
      return results;
    }),

    // Send grade report emails to all students of a session
    sendGradeEmails: approvedProcedure.input(z.object({ sessionId: z.number() })).mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });

      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });

      await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);

      const component = await getComponentById(cls.componentId);
      if (!component) throw new TRPCError({ code: "NOT_FOUND", message: "Componente não encontrado" });

      const tutorialEval = await getTutorialEvaluation(input.sessionId);
      if (!tutorialEval) throw new TRPCError({ code: "BAD_REQUEST", message: "A avaliação do tutorial precisa ser finalizada antes de enviar as notas." });

      const desempenhoScores = await calculateDesempenhoScores(input.sessionId);
      const problemFinalGrades = await calculateProblemDesempenhoScores(session.classId, session.problemNumber);

      const smtpOk = await isSmtpConfigured();
      if (!smtpOk) throw new TRPCError({ code: "BAD_REQUEST", message: "SMTP não configurado. Configure o servidor de e-mail primeiro." });

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const student of desempenhoScores) {
        if (!student.studentEmail) {
          failed++;
          errors.push(`${student.studentName}: sem e-mail cadastrado`);
          continue;
        }

        const problemData = problemFinalGrades.find(p => p.studentId === student.studentId);
        const problemAvg = problemData ? problemData.mediaDesempenho : null;

        const html = buildStudentGradeReportHtml({
          studentName: student.studentName,
          componentCode: component.code,
          componentName: component.name,
          className: cls.classCode,
          sessionLabel: session.label,
          problemNumber: session.problemNumber,
          tutorialCriteria: {
            organizacao: Number(tutorialEval.organizacao),
            cooperacao: Number(tutorialEval.cooperacao),
            conteudo: Number(tutorialEval.conteudo),
            objetivo: Number(tutorialEval.objetivo),
            metas: Number(tutorialEval.metas),
            tutorialGrade: calculateTutorialGrade(tutorialEval),
          },
          peerAverage: student.peerScore > 0 ? student.peerScore : null,
          desempenhoScore: student.desempenhoScore > 0 ? student.desempenhoScore : null,
          problemAverage: problemAvg,
        });

        const subject = `Relatório de Avaliação - ${session.label} - ${component.code}`;
        const result = await sendEmail({
          to: student.studentEmail,
          subject,
          text: `Relatório de Avaliação Tutorial - ${session.label}. Nota do Tutorial: ${calculateTutorialGrade(tutorialEval).toFixed(1)}/10. Média dos Pares: ${student.peerScore > 0 ? student.peerScore.toFixed(1) : 'Pendente'}. Nota Final: ${student.desempenhoScore > 0 ? student.desempenhoScore.toFixed(1) : 'Pendente'}.`,
          html,
        });

        if (result.success) {
          sent++;
        } else {
          failed++;
          errors.push(`${student.studentName}: ${result.error}`);
        }
      }

      await createAuditLog({
        actorUserId: ctx.user.id,
        action: "send_grade_emails",
        classId: session.classId,
        details: JSON.stringify({ sessionId: input.sessionId, sent, failed, total: desempenhoScores.length }),
      });

      return { sent, failed, total: desempenhoScores.length, errors };
    }),

    // Dashboard: scoped by user's accessible components
    dashboard: approvedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin") {
        // Admin sees global stats
        const allComps = await listComponents();
        const allIds = allComps.map(c => c.id);
        if (allIds.length === 0) return { totalStudents: 0, totalSessions: 0, openSessions: 0, totalEvaluations: 0, totalClasses: 0 };
        return getDashboardStatsByComponents(allIds);
      }
      const componentIds = await getUserApprovedComponentIds(ctx.user.id);
      if (componentIds.length === 0) return { totalStudents: 0, totalSessions: 0, openSessions: 0, totalEvaluations: 0, totalClasses: 0 };
      return getDashboardStatsByComponents(componentIds);
    }),
    // Dashboard stats for a single component with optional semester filter
    dashboardByComponent: approvedProcedure.input(z.object({
      componentId: z.number(),
      semester: z.string().optional(),
    })).query(async ({ ctx, input }) => {
      await assertComponentAccess(ctx.user.id, ctx.user.role, input.componentId);
      return getDashboardStatsByComponentAndSemester(input.componentId, input.semester);
    }),
  }),

  // ─── Audit Logs ───
  auditLogs: router({
    list: adminProcedure.input(z.object({
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    })).query(async ({ ctx, input }) => {
      return listAuditLogs({ limit: input.limit, offset: input.offset });
    }),
    delete: adminProcedure.input(z.object({
      period: z.enum(["last_hour", "last_day", "all"]),
    })).mutation(async ({ ctx, input }) => {
      const deleted = await deleteAuditLogs(input.period);
      return { success: true, deleted };
    }),
  }),

  // ─── Notifications ───
  notifications: router({
    list: approvedProcedure.input(z.object({
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    })).query(async ({ ctx, input }) => {
      // Sync pending requests that may not have notifications yet (retroactive)
      try { await syncPendingRequestNotifications(ctx.user.id); } catch {}
      return listNotifications(ctx.user.id, { limit: input.limit, offset: input.offset });
    }),
    unreadCount: approvedProcedure.query(async ({ ctx }) => {
      // Sync pending requests that may not have notifications yet (retroactive)
      try { await syncPendingRequestNotifications(ctx.user.id); } catch {}
      const count = await countUnreadNotifications(ctx.user.id);
      return { count };
    }),
    markAsRead: approvedProcedure.input(z.object({
      notificationId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      await markNotificationAsRead(input.notificationId, ctx.user.id);
      return { success: true };
    }),
    markAllAsRead: approvedProcedure.mutation(async ({ ctx }) => {
      await markAllNotificationsAsRead(ctx.user.id);
      return { success: true };
    }),
    delete: approvedProcedure.input(z.object({
      notificationId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      await deleteNotification(input.notificationId, ctx.user.id);
      return { success: true };
    }),
    pendingList: approvedProcedure.input(z.object({
      limit: z.number().min(1).max(20).optional().default(5),
    })).query(async ({ ctx, input }) => {
      try { await syncPendingRequestNotifications(ctx.user.id); } catch {}
      return listPendingNotifications(ctx.user.id, input.limit);
    }),
    pendingCount: approvedProcedure.query(async ({ ctx }) => {
      try { await syncPendingRequestNotifications(ctx.user.id); } catch {}
      const count = await countPendingNotifications(ctx.user.id);
      return { count };
    }),
  }),

  // ─── Contact Tickets ───
  contactTickets: router({
    // Professor submits a bug report or feature request
    create: approvedProcedure.input(z.object({
      type: z.enum(["bug", "feature"]),
      subject: z.string().min(3).max(255),
      message: z.string().min(10).max(5000),
    })).mutation(async ({ ctx, input }) => {
      const ticket = await createContactTicket({
        userId: ctx.user.id,
        type: input.type,
        subject: input.subject,
        message: input.message,
      });

      // Send email to all admins
      try {
        const admin = await getAdmin();
        if (admin?.email) {
          const html = buildContactTicketEmailHtml({
            ticketType: input.type,
            subject: input.subject,
            message: input.message,
            userName: ctx.user.name || "Professor",
            userEmail: ctx.user.email || "",
          });
          const typeLabel = input.type === "bug" ? "Bug" : "Funcionalidade";
          await sendEmail({
            to: admin.email,
            subject: `[${typeLabel}] ${input.subject}`,
            text: `${ctx.user.name || "Professor"} (${ctx.user.email}) enviou: ${input.subject}\n\n${input.message}`,
            html,
          });
        }
      } catch (err) {
        console.error("[ContactTicket] Failed to send email:", err);
      }

      return ticket;
    }),

    // Professor sees their own tickets
    myList: approvedProcedure.input(z.object({
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    })).query(async ({ ctx, input }) => {
      return listMyContactTickets(ctx.user.id, { limit: input.limit, offset: input.offset });
    }),

    // Admin sees all tickets
    list: adminProcedure.input(z.object({
      status: z.enum(["open", "resolved"]).optional(),
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    })).query(async ({ input }) => {
      return listContactTickets({ status: input.status, limit: input.limit, offset: input.offset });
    }),

    // Admin resolves a ticket
    resolve: adminProcedure.input(z.object({
      ticketId: z.number(),
    })).mutation(async ({ input }) => {
      const ticket = await getContactTicketById(input.ticketId);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Ticket não encontrado" });
      await resolveContactTicket(input.ticketId);
      return { success: true };
    }),

    // Admin gets count of open tickets
    openCount: adminProcedure.query(async () => {
      const count = await countOpenContactTickets();
      return { count };
    }),
  }),

  // ─── Database Backup / Restore ───
  backup: router({
    // Export entire database as JSON
    export: adminProcedure.mutation(async ({ ctx }) => {
      const data = await exportDatabase();
      await createAuditLog({
        action: "database_export",
        actorUserId: ctx.user.id,
        details: JSON.stringify({ exportedAt: data.exportedAt, tableCount: Object.keys(data.tables).length }),
      });
      return data;
    }),

    // Import database from JSON backup
    import: adminProcedure.input(z.object({
      data: z.object({
        version: z.string(),
        exportedAt: z.string(),
        tables: z.record(z.string(), z.array(z.any())),
      }),
      clearFirst: z.boolean().default(true),
    })).mutation(async ({ ctx, input }) => {
      const result = await importDatabase(input.data as BackupData, input.clearFirst);
      // Log after import (note: audit log table may have been cleared)
      await createAuditLog({
        action: "database_import",
        actorUserId: ctx.user.id,
        details: JSON.stringify({
          importedAt: new Date().toISOString(),
          originalExportedAt: input.data.exportedAt,
          clearFirst: input.clearFirst,
          ...result,
        }),
      });
      return result;
    }),

    // Get row counts for all tables
    stats: adminProcedure.query(async () => {
      return getBackupStats();
    }),

    // Rebuild database: drop all tables and recreate from migrations
    rebuild: adminProcedure.mutation(async ({ ctx }) => {
      const result = await rebuildDatabase();
      // Log after rebuild (tables were just recreated, so audit log table is fresh)
      try {
        await createAuditLog({
          action: "database_rebuild",
          actorUserId: ctx.user.id,
          details: JSON.stringify({
            rebuiltAt: new Date().toISOString(),
            tablesCreated: result.tablesCreated,
          }),
        });
      } catch {
        // audit log table may not accept inserts right after rebuild
      }
      return result;
    }),
  }),

  // ─── Brainstorm Board (digital whiteboard per session) ───
  brainstorm: router({
    // Get or create board for a session (Mesa student)
    getOrCreateBoard: publicProcedure.input(z.object({
      sessionId: z.number(),
      studentId: z.number(),
    })).mutation(async ({ input }) => {
      return getOrCreateBrainstormBoard(input.sessionId, input.studentId);
    }),

    // Get board with all items (read-only, for any viewer)
    getBoard: publicProcedure.input(z.object({
      sessionId: z.number(),
    })).query(async ({ input }) => {
      return getBrainstormBoardWithItems(input.sessionId);
    }),

    // Add item to a section
    addItem: publicProcedure.input(z.object({
      boardId: z.number(),
      sessionId: z.number().optional(),
      section: z.enum(["ideias", "fatos", "questoes", "metas"]),
      content: z.string().min(1),
      status: z.string().optional(),
      attachmentUrl: z.string().nullable().optional(),
      attachmentType: z.enum(["link", "image", "video", "photo", "document"]).nullable().optional(),
    })).mutation(async ({ input }) => {
      if (input.sessionId) {
        const session = await getSessionById(input.sessionId);
        if (session?.status === "finished") throw new TRPCError({ code: "FORBIDDEN", message: "Sessão encerrada. Nenhuma alteração é permitida." });
      }
      // Set default status based on section
      const defaultStatuses: Record<string, string> = {
        ideias: "analise",
        fatos: "verificar",
        questoes: "duvida",
        metas: "planejada",
      };
      const status = input.status || defaultStatuses[input.section] || "default";
      return addBrainstormItem({
        boardId: input.boardId,
        section: input.section,
        content: input.content,
        status,
        attachmentUrl: input.attachmentUrl,
        attachmentType: input.attachmentType,
      });
    }),

    // Update an item (content, status, attachment)
    updateItem: publicProcedure.input(z.object({
      itemId: z.number(),
      content: z.string().optional(),
      status: z.string().optional(),
      attachmentUrl: z.string().nullable().optional(),
      attachmentType: z.enum(["link", "image", "video", "photo", "document"]).nullable().optional(),
    })).mutation(async ({ input }) => {
      const { itemId, ...data } = input;
      return updateBrainstormItem(itemId, data);
    }),

    // Delete an item
    deleteItem: publicProcedure.input(z.object({
      itemId: z.number(),
    })).mutation(async ({ input }) => {
      await deleteBrainstormItem(input.itemId);
      return { success: true };
    }),

    // Move item to any section
    moveItem: publicProcedure.input(z.object({
      itemId: z.number(),
      targetSection: z.enum(["ideias", "fatos", "questoes", "metas"]),
    })).mutation(async ({ input }) => {
      return moveBrainstormItem(input.itemId, input.targetSection);
    }),

    // Upload photo attachment (from Mesa student's phone)
    uploadPhoto: publicProcedure.input(z.object({
      fileName: z.string(),
      fileBase64: z.string(),
      contentType: z.string().default("image/jpeg"),
    })).mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const suffix = Math.random().toString(36).substring(2, 10);
      const key = `brainstorm-photos/${Date.now()}-${suffix}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.contentType);
      return { url };
    }),

    // Add attachment to an item
    addAttachment: publicProcedure.input(z.object({
      itemId: z.number(),
      url: z.string().min(1),
      type: z.enum(["link", "image", "video", "photo", "document"]),
      title: z.string().optional(),
    })).mutation(async ({ input }) => {
      return addBrainstormAttachment(input);
    }),

    // Remove attachment from an item
    removeAttachment: publicProcedure.input(z.object({
      attachmentId: z.number(),
    })).mutation(async ({ input }) => {
      await removeBrainstormAttachment(input.attachmentId);
      return { success: true };
    }),

    // Update attachment title
    updateAttachmentTitle: publicProcedure.input(z.object({
      attachmentId: z.number(),
      title: z.string(),
    })).mutation(async ({ input }) => {
      await updateBrainstormAttachmentTitle(input.attachmentId, input.title);
      return { success: true };
    }),

    // Get attachments for an item
    getAttachments: publicProcedure.input(z.object({
      itemId: z.number(),
    })).query(async ({ input }) => {
      return getAttachmentsByItemId(input.itemId);
    }),

    // Share board with all sessions of the same component
    shareBoard: protectedProcedure.input(z.object({
      sessionId: z.number(),
      targetSessionIds: z.array(z.number()).optional(),
    })).mutation(async ({ input }) => {
      const sessionCheck = await getSessionById(input.sessionId);
      if (sessionCheck?.status === "finished") throw new TRPCError({ code: "FORBIDDEN", message: "Sessão encerrada. Nenhuma alteração é permitida." });
      try {
        return await shareBrainstormBoard(input.sessionId, input.targetSessionIds);
      } catch (e: any) {
        throw new TRPCError({ code: "NOT_FOUND", message: e.message || "Erro ao compartilhar quadro" });
      }
    }),

    // Get all sessions of the same component (for sharing UI)
    getComponentSessions: protectedProcedure.input(z.object({
      sessionId: z.number(),
    })).query(async ({ input }) => {
      return getComponentSessionsForSharing(input.sessionId);
    }),

    // Update tutor comments on a brainstorm board
    updateTutorComments: publicProcedure.input(z.object({
      sessionId: z.number(),
      comments: z.string(),
    })).mutation(async ({ input }) => {
      const session = await getSessionById(input.sessionId);
      if (session?.status === "finished") throw new TRPCError({ code: "FORBIDDEN", message: "Sessão encerrada. Nenhuma alteração é permitida." });
      return updateTutorComments(input.sessionId, input.comments);
    }),

    // Send brainstorm board by email to all students in the component
    sendBoardEmail: publicProcedure.input(z.object({
      sessionId: z.number(),
      origin: z.string(),
      senderName: z.string().optional(),
      senderRole: z.string().optional(),
    })).mutation(async ({ input }) => {
      const sessionCheck = await getSessionById(input.sessionId);
      if (sessionCheck?.status === "finished") throw new TRPCError({ code: "FORBIDDEN", message: "Sessão encerrada. Nenhuma alteração é permitida." });
      // Check for duplicate sends (minimum 2 minutes between sends)
      const lastSend = await getLastBoardSend(input.sessionId);
      if (lastSend) {
        const timeSinceLastSend = Date.now() - new Date(lastSend.sentAt).getTime();
        if (timeSinceLastSend < 2 * 60 * 1000) {
          const remainingSeconds = Math.ceil((2 * 60 * 1000 - timeSinceLastSend) / 1000);
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Aguarde ${remainingSeconds}s antes de enviar novamente. \u00daltimo envio por ${lastSend.sentByName}.` });
        }
      }

      const board = await getBrainstormBoardWithItems(input.sessionId);
      if (!board || board.noBoard) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quadro n\u00e3o encontrado" });
      }

      const studentsInComponent = await getStudentsByComponentFromSession(input.sessionId);
      const studentsWithEmail = studentsInComponent.filter(s => s.email);

      if (studentsWithEmail.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum aluno com e-mail cadastrado no componente" });
      }

      const brainstormUrl = `${input.origin}/brainstorm/${input.sessionId}`;

      // Group items by section
      const sections = {
        ideias: board.items.filter(i => i.section === "ideias"),
        fatos: board.items.filter(i => i.section === "fatos"),
        questoes: board.items.filter(i => i.section === "questoes"),
        metas: board.items.filter(i => i.section === "metas"),
      };

      const html = buildBrainstormBoardEmailHtml({
        sessionLabel: board.sessionLabel,
        sections,
        tutorComments: (board as any).tutorComments || "",
        brainstormUrl,
      });

      let sentCount = 0;
      let failCount = 0;
      for (const student of studentsWithEmail) {
        try {
          await sendEmail({
            to: student.email!,
            subject: `Quadro de Brainstorming - ${board.sessionLabel}`,
            text: `Quadro de Brainstorming da sess\u00e3o ${board.sessionLabel}. Acesse: ${brainstormUrl}`,
            html,
          });
          sentCount++;
        } catch (err) {
          failCount++;
          console.error(`[Email] Failed to send board to ${student.email}:`, err);
        }
      }

      // Record send history
      await addBoardSendHistory({
        sessionId: input.sessionId,
        sentByName: input.senderName || "Desconhecido",
        sentByRole: input.senderRole || "student",
        recipientCount: sentCount,
        failCount,
      });

      return { sentCount, failCount, totalStudents: studentsWithEmail.length };
    }),

    getBoardSendHistory: publicProcedure.input(z.object({
      sessionId: z.number(),
    })).query(async ({ input }) => {
      return getBoardSendHistory(input.sessionId);
    }),

    getStudentCount: publicProcedure.input(z.object({
      sessionId: z.number(),
    })).query(async ({ input }) => {
      const students = await getStudentsByComponentFromSession(input.sessionId);
      const withEmail = students.filter(s => s.email);
      return { total: students.length, withEmail: withEmail.length };
    }),
  }),
});

export type AppRouter = typeof appRouter;
