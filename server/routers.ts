import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  createClass, listClassesByProfessor, updateClass, deleteClass, getClassById,
  listStudentsByClass, createStudent, updateStudent, removeStudentFromClass, getStudentByEnrollment,
  addStudentToClass, isStudentInComponentClass, bulkImportStudents,
  listAllClasses, listStudentsForExport, updateStudentEmail,
  createSession, listSessionsByClass, getSessionStudents, closeSession, openSession, deleteSession, getSessionById,
  submitEvaluation, getSessionEvaluations, hasStudentSubmitted, deleteStudentEvaluation,
  calculateSessionResults, calculateProblemResults, getDashboardStats,
  submitTutorialEvaluation, getTutorialEvaluation, calculateTutorialGrade,
  calculateFinalGrades, calculateProblemFinalGrades,
  generateAccessCode, getSessionByAccessCode, findStudentByEnrollmentInClass,
  approveUser, rejectUser, listPendingProfessors, listApprovedProfessors,
  addProfessorComponent, removeProfessorComponent, listProfessorComponents, listAllProfessorComponents,
  getUserById, getUserByEmail, countUsers, createUserWithPassword, updateUserPassword,
  getAdmin, transferCoordination, getSmtpConfig, upsertSmtpConfig, deleteSmtpConfig,
  createPasswordResetCode, verifyPasswordResetCode, markResetCodeUsed, isSmtpConfigured,
  createComponent, getComponentById, getComponentByCode, listComponents, updateComponent, deleteComponent,
} from "./db";
import { sendEmail, testSmtpConnection, generateResetCode, buildResetEmailHtml } from "./email";

const approvedProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.approvalStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso pendente de aprovação" });
  return next({ ctx });
});

const coordinatorProcedure = approvedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "coordinator" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a professores" });
  return next({ ctx });
});

const adminProcedure = approvedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito ao administrador" });
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
    // Check if system has any users (for first-time setup)
    isFirstUser: publicProcedure.query(async () => {
      const total = await countUsers();
      return { isFirstUser: total === 0 };
    }),
    // Register a new professor (first user becomes admin auto-approved)
    register: publicProcedure.input(z.object({
      email: z.string().email(),
      name: z.string().min(1),
      password: z.string().min(6),
    })).mutation(async ({ ctx, input }) => {
      const existing = await getUserByEmail(input.email.toLowerCase());
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado" });
      const total = await countUsers();
      const isFirst = total === 0;
      const passwordHash = await bcrypt.hash(input.password, 10);
      const user = await createUserWithPassword({
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash,
        role: isFirst ? "admin" : "user",
        approvalStatus: isFirst ? "approved" : "pending",
      });
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao criar usuário" });
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
    // Login with email and password
    login: publicProcedure.input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(input.email.toLowerCase());
      if (!user || !user.passwordHash) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos" });
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos" });
      // Create session
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || user.email || "",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, approvalStatus: user.approvalStatus } };
    }),
    // Change password (for logged-in user)
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
    // Request password reset code (public - sends email)
    requestResetCode: publicProcedure.input(z.object({
      email: z.string().email(),
    })).mutation(async ({ input }) => {
      const user = await getUserByEmail(input.email.toLowerCase());
      if (!user) {
        // Don't reveal if email exists - always return success
        return { success: true };
      }
      const smtpReady = await isSmtpConfigured();
      if (!smtpReady) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O sistema de e-mail não está configurado. Contacte o administrador." });
      }
      const code = generateResetCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
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
    // Verify reset code and set new password
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
    // Check if SMTP is configured (for showing "forgot password" link)
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
      // Don't return the actual password
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
      if (input.toUserId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Você já é o administrador" });
      const target = await getUserById(input.toUserId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Professor não encontrado" });
      if (target.approvalStatus !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "O professor precisa estar aprovado" });
      await transferCoordination(ctx.user.id, input.toUserId);
      return { success: true };
    }),
  }),

  // ─── Components (componentes curriculares) ───
  components: router({
    list: approvedProcedure.query(async () => {
      return listComponents();
    }),
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
    list: coordinatorProcedure.query(async ({ ctx }) => {
      return listClassesByProfessor(ctx.user.id);
    }),
    create: coordinatorProcedure.input(z.object({
      classCode: z.string().min(1),
      componentId: z.number(),
      semester: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      return createClass({ ...input, professorUserId: ctx.user.id });
    }),
    update: coordinatorProcedure.input(z.object({
      id: z.number(),
      classCode: z.string().min(1).optional(),
      componentId: z.number().optional(),
      semester: z.string().min(1).optional(),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.id);
      if (!cls || cls.professorUserId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      return updateClass(input.id, { classCode: input.classCode, componentId: input.componentId, semester: input.semester });
    }),
    delete: coordinatorProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.id);
      if (!cls || cls.professorUserId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await deleteClass(input.id);
      return { success: true };
    }),

    // All classes (for cross-class results visibility)
    listAll: coordinatorProcedure.query(async () => {
      return listAllClasses();
    }),
  }),

  // ─── Students ───
  students: router({
    list: coordinatorProcedure.input(z.object({ classId: z.number() })).query(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls || cls.professorUserId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      return listStudentsByClass(input.classId);
    }),
    create: coordinatorProcedure.input(z.object({
      classId: z.number(),
      name: z.string().min(1),
      enrollment: z.string().min(1),
      email: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls || cls.professorUserId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      // Check if student already exists by enrollment
      let student = await getStudentByEnrollment(input.enrollment);
      if (student) {
        // Check if already in this class
        const classStudentsList = await listStudentsByClass(input.classId);
        if (classStudentsList.some(s => s.id === student!.id)) {
          throw new TRPCError({ code: "CONFLICT", message: "Aluno já está nesta turma" });
        }
        // Check component conflict
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
    update: coordinatorProcedure.input(z.object({
      studentId: z.number(),
      name: z.string().optional(),
      enrollment: z.string().optional(),
      email: z.string().nullable().optional(),
    })).mutation(async ({ input }) => {
      // Validate enrollment uniqueness if changing enrollment
      if (input.enrollment) {
        const existing = await getStudentByEnrollment(input.enrollment);
        if (existing && existing.id !== input.studentId) {
          throw new TRPCError({ code: "CONFLICT", message: "Já existe outro aluno com esta matrícula" });
        }
      }
      return updateStudent(input.studentId, { name: input.name, enrollment: input.enrollment, email: input.email });
    }),
    removeFromClass: coordinatorProcedure.input(z.object({ studentId: z.number(), classId: z.number() })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls || cls.professorUserId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      await removeStudentFromClass(input.studentId, input.classId);
      return { success: true };
    }),
    importCSV: coordinatorProcedure.input(z.object({
      classId: z.number(),
      csvContent: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.classId);
      if (!cls || cls.professorUserId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });

      // Parse CSV from SAGRES system (semicolon-separated)
      const lines = input.csvContent.split("\n");
      const parsedStudents: { name: string; enrollment: string }[] = [];

      for (const line of lines) {
        const cols = line.split(";");
        // Student rows have a number in col[1] and name in col[4]
        const num = cols[1]?.trim();
        if (!num || isNaN(parseInt(num))) continue;
        const enrollment = cols[3]?.trim();
        const name = cols[4]?.trim();
        if (!name || !enrollment) continue;
        // Skip header row
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
    exportGoogleWorkspace: coordinatorProcedure.input(z.object({
      classIds: z.array(z.number()).min(1),
    })).query(async ({ ctx, input }) => {
      // Verify all classes belong to the professor
      for (const classId of input.classIds) {
        const cls = await getClassById(classId);
        if (!cls || cls.professorUserId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
        }
      }
      const studentsData = await listStudentsForExport(input.classIds);
      if (studentsData.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum aluno encontrado nas turmas selecionadas." });
      }

      // Google Workspace CSV header (29 columns)
      const header = "First Name [Required];Last Name [Required];Email Address [Required];Password [Required];Password Hash Function [UPLOAD ONLY];Org Unit Path [Required];New Primary Email [UPLOAD ONLY];Recovery Email;Home Secondary Email;Work Secondary Email;Recovery Phone [MUST BE IN THE E.164 FORMAT];Work Phone;Home Phone;Mobile Phone;Work Address;Home Address;Employee ID;Employee Type;Employee Title;Manager Email;Department;Cost Center;Building ID;Floor Name;Floor Section;Change Password at Next Sign-In;New Status [UPLOAD ONLY];New Licenses [UPLOAD ONLY];Advanced Protection Program enrollment";

      // Title Case: primeira letra maiúscula, resto minúscula
      // Preposições portuguesas permanecem em minúscula
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
        // Password: iniciais do nome + matrícula
        const initials = nameParts.map(p => p[0]?.toLowerCase() || "").join("");
        const enrollment = s.studentEnrollment || "";
        const password = `${initials}${enrollment}`;
        // 29 columns: fill specified ones, rest empty
        return [
          firstName,   // 1. First Name
          lastName,    // 2. Last Name
          s.studentEmail, // 3. Email Address
          password,    // 4. Password
          "",          // 5. Password Hash Function
          "/Alunos",   // 6. Org Unit Path
          "",          // 7. New Primary Email
          "",          // 8. Recovery Email
          "",          // 9. Home Secondary Email
          "",          // 10. Work Secondary Email
          "",          // 11. Recovery Phone
          "",          // 12. Work Phone
          "",          // 13. Home Phone
          "",          // 14. Mobile Phone
          "",          // 15. Work Address
          "",          // 16. Home Address
          "",          // 17. Employee ID
          "",          // 18. Employee Type
          "",          // 19. Employee Title
          "",          // 20. Manager Email
          "",          // 21. Department
          "",          // 22. Cost Center
          "",          // 23. Building ID
          "",          // 24. Floor Name
          "",          // 25. Floor Section
          "True",      // 26. Change Password at Next Sign-In
          "",          // 27. New Status
          "",          // 28. New Licenses
          "False",     // 29. Advanced Protection Program enrollment
        ].join(";");
      });

      // Deduplicate by email (student may appear in multiple classes, use first occurrence)
      const seen = new Set<string>();
      const uniqueRows = rows.filter(row => {
        const email = row.split(";")[2];
        if (seen.has(email)) return false;
        seen.add(email);
        return true;
      });

      return { csv: [header, ...uniqueRows].join("\n"), count: uniqueRows.length };
    }),
  }),

  // ─── Sessions ───
  sessions: router({
    list: coordinatorProcedure.input(z.object({ classId: z.number() })).query(async ({ ctx, input }) => {
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
    create: coordinatorProcedure.input(z.object({
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
    close: coordinatorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await closeSession(input.id);
      return { success: true };
    }),
    open: coordinatorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await openSession(input.id);
      return { success: true };
    }),
    delete: coordinatorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
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
    generateCode: coordinatorProcedure.input(z.object({ sessionId: z.number() })).mutation(async ({ input }) => {
      const session = await getSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada" });
      const code = await generateAccessCode(input.sessionId);
      return { accessCode: code };
    }),
  }),

  // ─── Student simplified access (no login required) ───
  studentAccess: router({
    // Validate access code and return session info
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
    // Login with enrollment (matrícula)
    login: publicProcedure.input(z.object({
      accessCode: z.string().min(1).max(8),
      enrollment: z.string().min(1),
    })).mutation(async ({ input }) => {
      const session = await getSessionByAccessCode(input.accessCode.toUpperCase());
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Código de acesso inválido" });
      if (session.status !== "open") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta sessão já foi encerrada" });
      const student = await findStudentByEnrollmentInClass(input.enrollment.trim(), session.classId);
      if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Matrícula não encontrada nesta turma. Verifique se digitou corretamente." });
      // Check if student is part of this session
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
    // Update student email during evaluation
    updateEmail: publicProcedure.input(z.object({
      studentId: z.number(),
      email: z.string().email(),
    })).mutation(async ({ input }) => {
      await updateStudentEmail(input.studentId, input.email.toLowerCase());
      return { success: true };
    }),
    // Get session students for evaluation (public, by access code)
    getSessionStudents: publicProcedure.input(z.object({
      accessCode: z.string().min(1).max(8),
    })).query(async ({ input }) => {
      const session = await getSessionByAccessCode(input.accessCode.toUpperCase());
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Código inválido" });
      return getSessionStudents(session.id);
    }),
    // Submit evaluation (public, by access code + student id)
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
      // Check if student already submitted
      const alreadySubmitted = await hasStudentSubmitted(session.id, input.evaluatorStudentId);
      if (alreadySubmitted) throw new TRPCError({ code: "BAD_REQUEST", message: "Você já realizou a avaliação desta sessão. Solicite ao professor a liberação para reavaliar." });
      // Validate: evaluator cannot evaluate self
      const selfEval = input.items.find(i => i.evaluatedStudentId === input.evaluatorStudentId);
      if (selfEval) throw new TRPCError({ code: "BAD_REQUEST", message: "Autoavaliação não é permitida" });
      // Validate exclusive roles
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
    // Professor releases a student to re-evaluate
    allowReevaluation: coordinatorProcedure.input(z.object({
      sessionId: z.number(),
      studentId: z.number(),
    })).mutation(async ({ input }) => {
      const deleted = await deleteStudentEvaluation(input.sessionId, input.studentId);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Avaliação não encontrada para este aluno nesta sessão" });
      return { success: true };
    }),
    // List students who have submitted evaluations for a session
    submittedStudents: coordinatorProcedure.input(z.object({
      sessionId: z.number(),
    })).query(async ({ input }) => {
      const evals = await getSessionEvaluations(input.sessionId);
      return evals.map(e => ({ studentId: e.evaluatorStudentId, submittedAt: e.submittedAt }));
    }),
  }),

  // ─── Tutorial Evaluation (professor evaluates session) ───
  tutorialEval: router({
    submit: coordinatorProcedure.input(z.object({
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

  // ─── Professor Authorization ───
  professors: router({
    pending: approvedProcedure.query(async () => {
      return listPendingProfessors();
    }),
    approved: approvedProcedure.query(async () => {
      return listApprovedProfessors();
    }),
    approve: adminProcedure.input(z.object({ userId: z.number() })).mutation(async ({ input }) => {
      await approveUser(input.userId);
      return { success: true };
    }),
    reject: adminProcedure.input(z.object({ userId: z.number() })).mutation(async ({ input }) => {
      await rejectUser(input.userId);
      return { success: true };
    }),
    addComponent: adminProcedure.input(z.object({
      userId: z.number(),
      componentId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      await addProfessorComponent(input.userId, input.componentId, ctx.user.id);
      return { success: true };
    }),
    removeComponent: adminProcedure.input(z.object({
      userId: z.number(),
      componentId: z.number(),
    })).mutation(async ({ input }) => {
      await removeProfessorComponent(input.userId, input.componentId);
      return { success: true };
    }),
    components: coordinatorProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
      return listProfessorComponents(input.userId);
    }),
    allComponents: approvedProcedure.query(async () => {
      return listAllProfessorComponents();
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
    sessionFinal: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => {
      return calculateFinalGrades(input.sessionId);
    }),
    problem: coordinatorProcedure.input(z.object({ classId: z.number(), problemNumber: z.number() })).query(async ({ input }) => {
      return calculateProblemResults(input.classId, input.problemNumber);
    }),
    problemFinal: coordinatorProcedure.input(z.object({ classId: z.number(), problemNumber: z.number() })).query(async ({ input }) => {
      return calculateProblemFinalGrades(input.classId, input.problemNumber);
    }),
    // List sessions for any class (cross-class visibility)
    sessionsForClass: coordinatorProcedure.input(z.object({ classId: z.number() })).query(async ({ input }) => {
      return listSessionsByClass(input.classId);
    }),
    dashboard: coordinatorProcedure.query(async ({ ctx }) => {
      return getDashboardStats(ctx.user.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;
