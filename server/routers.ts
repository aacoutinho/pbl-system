import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createClass, listClassesByProfessor, updateClass, deleteClass, getClassById, getClassesForStudentEmail,
  listStudentsByClass, createStudent, deleteStudent, getStudentByEmailAndClass, bulkCreateStudents,
  bulkCreateStudentsWithEnrollment, listAllClasses, listStudentsForExport,
  createSession, listSessionsByClass, getSessionStudents, closeSession, openSession, deleteSession, getSessionById,
  submitEvaluation, getSessionEvaluations, hasStudentSubmitted,
  calculateSessionResults, calculateProblemResults, getDashboardStats,
  submitTutorialEvaluation, getTutorialEvaluation, calculateTutorialGrade,
  calculateFinalGrades, calculateProblemFinalGrades,
  generateAccessCode, getSessionByAccessCode, findStudentByEmailUsername,
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
      classCode: z.string().min(1),
      componentCode: z.string().min(1),
      semester: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      return createClass({ ...input, professorUserId: ctx.user.id });
    }),
    update: adminProcedure.input(z.object({
      id: z.number(),
      classCode: z.string().min(1).optional(),
      componentCode: z.string().min(1).optional(),
      semester: z.string().min(1).optional(),
    })).mutation(async ({ ctx, input }) => {
      const cls = await getClassById(input.id);
      if (!cls || cls.professorUserId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      return updateClass(input.id, { classCode: input.classCode, componentCode: input.componentCode, semester: input.semester });
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

        // Generate email: initials + last name (ignoring suffixes like Junior, Jr., Neto, Filho)
        const domain = input.emailDomain || "ecomp.uefs.br";
        const parts = name.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .split(/\s+/)
          .filter(p => p.length > 0);
        
        // Remove common suffixes from the end
        const suffixes = ["junior", "jr", "jr.", "neto", "filho"];
        let filteredParts = [...parts];
        while (filteredParts.length > 1 && suffixes.includes(filteredParts[filteredParts.length - 1].replace(/\./g, ""))) {
          filteredParts.pop();
        }
        
        let email = "";
        if (filteredParts.length >= 2) {
          const initials = filteredParts.slice(0, -1).map(p => p[0]).join("");
          const lastName = filteredParts[filteredParts.length - 1];
          email = `${initials}${lastName}@${domain}`;
        } else {
          email = `${filteredParts[0]}@${domain}`;
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
    exportGoogleWorkspace: adminProcedure.input(z.object({
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
      const toTitleCase = (str: string) => str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

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
    generateCode: adminProcedure.input(z.object({ sessionId: z.number() })).mutation(async ({ input }) => {
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
      return {
        sessionId: session.id,
        label: session.label,
        classCode: cls?.classCode ?? "",
        componentCode: cls?.componentCode ?? "",
        semester: cls?.semester ?? "",
      };
    }),
    // Login with username (email without @domain)
    login: publicProcedure.input(z.object({
      accessCode: z.string().min(1).max(8),
      emailUsername: z.string().min(1),
    })).mutation(async ({ input }) => {
      const session = await getSessionByAccessCode(input.accessCode.toUpperCase());
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Código de acesso inválido" });
      if (session.status !== "open") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta sessão já foi encerrada" });
      const student = await findStudentByEmailUsername(input.emailUsername, session.classId);
      if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado nesta turma. Verifique se digitou corretamente (ex: aatrcoutinho)." });
      // Check if student is part of this session
      const sessionStudentsList = await getSessionStudents(session.id);
      const isInSession = sessionStudentsList.some(s => s.studentId === student.id);
      if (!isInSession) throw new TRPCError({ code: "NOT_FOUND", message: "Você não está inscrito nesta sessão." });
      const submitted = await hasStudentSubmitted(session.id, student.id);
      return {
        studentId: student.id,
        studentName: student.name,
        sessionId: session.id,
        sessionLabel: session.label,
        classId: session.classId,
        alreadySubmitted: submitted,
      };
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
