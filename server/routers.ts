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
  createSession, listSessionsByClass, getSessionStudents, closeSession, openSession, deleteSession, getSessionById,
  submitEvaluation, getSessionEvaluations, hasStudentSubmitted, deleteStudentEvaluation,
  calculateSessionResults, calculateProblemResults, getDashboardStats, getDashboardStatsByComponents,
  submitTutorialEvaluation, getTutorialEvaluation, calculateTutorialGrade,
  calculateFinalGrades, calculateProblemFinalGrades,
  generateAccessCode, getSessionByAccessCode, findStudentByEnrollmentInClass,
  approveUser, rejectUser, listPendingProfessors, listApprovedProfessors, deleteUser,
  addProfessorComponent, removeProfessorComponent, listProfessorComponents, listAllProfessorComponents,
  getUserById, getUserByEmail, countUsers, createUserWithPassword, updateUserPassword,
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
  transferStudentBetweenClasses,
  createAuditLog, listAuditLogs,
  createNotification, listNotifications, countUnreadNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification,
  listPendingNotifications, countPendingNotifications,
  getPeerGradesMatrix,
  syncPendingRequestNotifications,
  createContactTicket, listContactTickets, listMyContactTickets, resolveContactTicket, getContactTicketById, countOpenContactTickets,
  exportDatabase, importDatabase, getBackupStats, rebuildDatabase,
  type BackupData,
} from "./db";
import { sendEmail, testSmtpConnection, generateResetCode, buildResetEmailHtml, buildVerificationEmailHtml, buildComponentApprovalEmailHtml, buildComponentRejectionEmailHtml, buildNewRequestEmailHtml, buildEvalPermissionGrantedEmailHtml, buildContactTicketEmailHtml } from "./email";

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
        subject: "Código de Verificação - Avaliação Tutorial",
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
      // Create pending component membership requests
      if (input.componentIds && input.componentIds.length > 0 && !isFirst) {
        for (const compId of input.componentIds) {
          try {
            await requestComponentMembership(user.id, compId);
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
      if (!user || !user.passwordHash) throw new TRPCError({ code: "BAD_REQUEST", message: "Usuário não encontrado" });
      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha atual incorreta" });
      const newHash = await bcrypt.hash(input.newPassword, 10);
      await updateUserPassword(user.id, newHash);
      return { success: true };
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
        subject: "Código de Recuperação de Senha - Avaliação Tutorial",
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
    // Only admin can create/update/delete
    create: adminProcedure.input(z.object({
      code: z.string().min(1),
      name: z.string().min(1),
    })).mutation(async ({ input }) => {
      const existing = await getComponentByCode(input.code);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe um componente com este código" });
      return createComponent(input);
    }),
    update: adminProcedure.input(z.object({
      id: z.number(),
      code: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
    })).mutation(async ({ input }) => {
      if (input.code) {
        const existing = await getComponentByCode(input.code);
        if (existing && existing.id !== input.id) throw new TRPCError({ code: "CONFLICT", message: "Já existe um componente com este código" });
      }
      return updateComponent(input.id, { code: input.code, name: input.name });
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
      classCode: z.string().min(1),
      componentId: z.number(),
      semester: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      // Any approved professor who is member of the component can create a class
      await assertComponentAccess(ctx.user.id, ctx.user.role, input.componentId);
      return createClass({ ...input, professorUserId: ctx.user.id });
    }),
    // Update: admin can update any, coordinator can update classes of their components
    update: approvedProcedure.input(z.object({
      id: z.number(),
      classCode: z.string().min(1),
      componentId: z.number(),
      semester: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.id);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      return updateClass(input.id, { classCode: input.classCode, componentId: input.componentId, semester: input.semester });
    }),
    // Delete: admin can delete any, coordinator can delete classes of their components
    delete: approvedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.id);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      await deleteClass(input.id);
      return { success: true };
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
    create: approvedProcedure.input(z.object({
      classId: z.number(),
      name: z.string().min(1),
      enrollment: z.string().min(1),
      email: z.string().optional(),
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
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);

      const lines = input.csvContent.split("\n");
      const parsedStudents: { name: string; enrollment: string }[] = [];

      for (const line of lines) {
        const cols = line.split(";");
        const num = cols[1]?.trim();
        if (!num || isNaN(parseInt(num))) continue;
        const enrollment = cols[3]?.trim();
        const name = cols[4]?.trim();
        if (!name || !enrollment) continue;
        if (name === "Aluno" || enrollment === "Matrícula") continue;
        parsedStudents.push({ name, enrollment });
      }

      if (parsedStudents.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum aluno encontrado no CSV. Verifique se o formato é compatível com a Folha de Frequência do SAGRES." });
      }

      const results = await bulkImportStudents(
        parsedStudents.map(s => ({ ...s, classId: input.classId }))
      );

      const created = results.filter(r => r.status === "created").length;
      const linked = results.filter(r => r.status === "linked").length;
      const alreadyInClass = results.filter(r => r.status === "already_in_class").length;
      const conflicts = results.filter(r => r.status === "conflict");

      return {
        success: true,
        count: parsedStudents.length,
        created,
        linked,
        alreadyInClass,
        conflicts: conflicts.map(c => ({ name: c.name, enrollment: c.enrollment })),
        students: parsedStudents,
      };
    }),
    exportGoogleWorkspace: approvedProcedure.input(z.object({
      classIds: z.array(z.number()).min(1),
    })).query(async ({ ctx, input }) => {
      // Verify component access for all classes
      for (const classId of input.classIds) {
        const cls = await getClassById(classId);
        if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
        await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);
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
    // Create session: admin, coordinator of component, or prof who created the class
    create: approvedProcedure.input(z.object({
      classId: z.number(),
      problemNumber: z.number().min(1).max(10),
      sessionNumber: z.number().min(1).max(10),
      label: z.string().min(1),
      studentIds: z.array(z.number()),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      return createSession(input);
    }),
    getStudents: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => {
      return getSessionStudents(input.sessionId);
    }),
    // Close/Open/Delete: admin, coordinator of component, or prof who created the class
    close: approvedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      await closeSession(input.id);
      return { success: true };
    }),
    open: approvedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      await openSession(input.id);
      return { success: true };
    }),
    delete: approvedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
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
    generateCode: approvedProcedure.input(z.object({ sessionId: z.number() })).mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertClassManager(ctx.user.id, ctx.user.role, cls);
      const code = await generateAccessCode(input.sessionId);
      return { accessCode: code };
    }),
  }),

  // ─── Student simplified access (no login required) ───
  studentAccess: router({
    validateCode: publicProcedure.input(z.object({
      accessCode: z.string().min(1).max(8),
    })).query(async ({ input }) => {
      const session = await getSessionByAccessCode(input.accessCode.toUpperCase());
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Código de acesso inválido" });
      if (session.status !== "open") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta sessão já foi encerrada" });
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
      };
    }),
    login: publicProcedure.input(z.object({
      accessCode: z.string().min(1).max(8),
      enrollment: z.string().min(1),
    })).mutation(async ({ input }) => {
      const session = await getSessionByAccessCode(input.accessCode.toUpperCase());
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Código de acesso inválido" });
      if (session.status !== "open") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta sessão já foi encerrada" });
      const student = await findStudentByEnrollmentInClass(input.enrollment.trim(), session.classId);
      if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Matrícula não encontrada nesta turma. Verifique se digitou corretamente." });
      const sessionStudentsList = await getSessionStudents(session.id);
      const isInSession = sessionStudentsList.some(s => s.studentId === student.id);
      if (!isInSession) throw new TRPCError({ code: "NOT_FOUND", message: "Você não está inscrito nesta sessão." });
      const submitted = await hasStudentSubmitted(session.id, student.id);
      return {
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        sessionId: session.id,
        sessionLabel: session.label,
        classId: session.classId,
        alreadySubmitted: submitted,
      };
    }),
    updateEmail: publicProcedure.input(z.object({
      studentId: z.number(),
      email: z.string().email(),
    })).mutation(async ({ input }) => {
      await updateStudentEmail(input.studentId, input.email.toLowerCase());
      return { success: true };
    }),
    getSessionStudents: publicProcedure.input(z.object({
      accessCode: z.string().min(1).max(8),
    })).query(async ({ input }) => {
      const session = await getSessionByAccessCode(input.accessCode.toUpperCase());
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Código inválido" });
      return getSessionStudents(session.id);
    }),
    submitEvaluation: publicProcedure.input(z.object({
      accessCode: z.string().min(1).max(8),
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
      const session = await getSessionByAccessCode(input.accessCode.toUpperCase());
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Código inválido" });
      if (session.status !== "open") throw new TRPCError({ code: "BAD_REQUEST", message: "Sessão encerrada" });
      const alreadySubmitted = await hasStudentSubmitted(session.id, input.evaluatorStudentId);
      if (alreadySubmitted) throw new TRPCError({ code: "BAD_REQUEST", message: "Você já realizou a avaliação desta sessão. Solicite ao professor a liberação para reavaliar." });
      const selfEval = input.items.find(i => i.evaluatedStudentId === input.evaluatorStudentId);
      if (selfEval) throw new TRPCError({ code: "BAD_REQUEST", message: "Autoavaliação não é permitida" });
      const exclusiveRoles = ["COORDENADOR", "MESA", "QUADRO"];
      for (const role of exclusiveRoles) {
        const count = input.items.filter(i => i.role === role && !i.absent).length;
        if (count > 1) throw new TRPCError({ code: "BAD_REQUEST", message: `O papel ${role} só pode ser atribuído a um aluno` });
      }
      const evalId = await submitEvaluation({
        sessionId: session.id,
        evaluatorStudentId: input.evaluatorStudentId,
        items: input.items,
      });
      return { success: true, evaluationId: evalId };
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
      const selfEval = input.items.find(i => i.evaluatedStudentId === input.evaluatorStudentId);
      if (selfEval) throw new TRPCError({ code: "BAD_REQUEST", message: "Autoavaliação não é permitida" });
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
    // Allow re-evaluation: admin, coordinator of component, or prof who created the class
    allowReevaluation: approvedProcedure.input(z.object({
      sessionId: z.number(),
      studentId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
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
  // Only coordinator/prof of the component can evaluate (NOT admin)
  tutorialEval: router({
    submit: professorProcedure.input(z.object({
      sessionId: z.number(),
      organizacao: z.number().min(0).max(1),
      cooperacao: z.number().min(0).max(1),
      conteudo: z.number().min(0).max(1),
      objetivo: z.number().min(0).max(1),
      metas: z.number().min(0).max(1),
    })).mutation(async ({ ctx, input }) => {
      // Admin doesn't evaluate tutorials
      if (ctx.user.role === "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Administradores não avaliam sessões tutoriais" });
      }
      const session = await getSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      const cls = await getClassById(session.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);
      // If not the class owner and not coordinator of component, check eval permission
      if (cls.professorUserId !== ctx.user.id) {
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
      if (ctx.user.role === "admin") return { canEvaluate: false, reason: "admin" };
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
      await deleteUser(input.userId);
      return { success: true };
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
  }),

  // ─── Results & Dashboard ───
  results: router({
    session: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => {
      return calculateSessionResults(input.sessionId);
    }),
    peerGradesMatrix: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => {
      return getPeerGradesMatrix(input.sessionId);
    }),
    sessionFinal: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => {
      return calculateFinalGrades(input.sessionId);
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
      return calculateProblemFinalGrades(input.classId, input.problemNumber);
    }),
    sessionsForClass: approvedProcedure.input(z.object({ classId: z.number() })).query(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await assertComponentAccess(ctx.user.id, ctx.user.role, cls.componentId);
      return listSessionsByClass(input.classId);
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
  }),

  // ─── Audit Logs ───
  auditLogs: router({
    list: approvedProcedure.input(z.object({
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    })).query(async ({ ctx, input }) => {
      // Admin sees all; coordinators see logs for their components
      if (ctx.user.role === "admin") {
        return listAuditLogs({ limit: input.limit, offset: input.offset });
      }
      const coordCompIds = await getCoordinatorComponentIds(ctx.user.id);
      if (coordCompIds.length === 0) {
        // Regular prof: see only logs where they are the actor
        return listAuditLogs({ limit: input.limit, offset: input.offset, componentIds: [] });
      }
      return listAuditLogs({ limit: input.limit, offset: input.offset, componentIds: coordCompIds });
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
});

export type AppRouter = typeof appRouter;
