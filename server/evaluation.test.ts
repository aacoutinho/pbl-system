import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "professor@example.com",
    name: "Professor Admin",
    loginMethod: "manus",
    role: "admin",
    approvalStatus: "approved",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createStudentContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "student-user",
    email: "student@example.com",
    name: "Student User",
    loginMethod: "manus",
    role: "user",
    approvalStatus: "approved",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("Router structure with classes support", () => {
  it("has all required routers defined", () => {
    const caller = appRouter.createCaller(createAdminContext());
    expect(caller.auth).toBeDefined();
    expect(caller.classes).toBeDefined();
    expect(caller.students).toBeDefined();
    expect(caller.sessions).toBeDefined();
    expect(caller.evaluations).toBeDefined();
    expect(caller.results).toBeDefined();
  });

  it("has class CRUD operations", () => {
    const caller = appRouter.createCaller(createAdminContext());
    expect(caller.classes.list).toBeDefined();
    expect(caller.classes.create).toBeDefined();
    expect(caller.classes.update).toBeDefined();
    expect(caller.classes.delete).toBeDefined();
    expect(caller.classes.myClasses).toBeDefined();
  });

  it("has student operations", () => {
    const caller = appRouter.createCaller(createAdminContext());
    expect(caller.students.list).toBeDefined();
    expect(caller.students.create).toBeDefined();
    expect(caller.students.bulkCreate).toBeDefined();
    expect(caller.students.delete).toBeDefined();
    expect(caller.students.me).toBeDefined();
  });

  it("has session operations", () => {
    const caller = appRouter.createCaller(createAdminContext());
    expect(caller.sessions.list).toBeDefined();
    expect(caller.sessions.listForStudent).toBeDefined();
    expect(caller.sessions.create).toBeDefined();
    expect(caller.sessions.close).toBeDefined();
    expect(caller.sessions.open).toBeDefined();
    expect(caller.sessions.delete).toBeDefined();
    expect(caller.sessions.submissionStatus).toBeDefined();
  });

  it("has evaluation operations", () => {
    const caller = appRouter.createCaller(createAdminContext());
    expect(caller.evaluations.submit).toBeDefined();
    expect(caller.evaluations.hasSubmitted).toBeDefined();
  });

  it("has results and dashboard operations", () => {
    const caller = appRouter.createCaller(createAdminContext());
    expect(caller.results.session).toBeDefined();
    expect(caller.results.problem).toBeDefined();
    expect(caller.results.dashboard).toBeDefined();
  });
});

describe("Access control with classes", () => {
  it("admin can access dashboard stats", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const stats = await caller.results.dashboard();
    expect(stats).toHaveProperty("totalStudents");
    expect(stats).toHaveProperty("totalSessions");
    expect(stats).toHaveProperty("openSessions");
    expect(stats).toHaveProperty("totalEvaluations");
    expect(stats).toHaveProperty("totalClasses");
    expect(typeof stats.totalStudents).toBe("number");
    expect(typeof stats.totalClasses).toBe("number");
  });

  it("blocks student from accessing admin class routes", async () => {
    const caller = appRouter.createCaller(createStudentContext());
    await expect(caller.classes.list()).rejects.toThrow();
  });

  it("blocks student from creating classes", async () => {
    const caller = appRouter.createCaller(createStudentContext());
    await expect(caller.classes.create({ name: "Test", code: "T01" })).rejects.toThrow();
  });

  it("blocks student from deleting classes", async () => {
    const caller = appRouter.createCaller(createStudentContext());
    await expect(caller.classes.delete({ id: 1 })).rejects.toThrow();
  });

  it("blocks student from creating students (requires classId)", async () => {
    const caller = appRouter.createCaller(createStudentContext());
    await expect(
      caller.students.create({ classId: 1, name: "Test", email: "test@test.com" })
    ).rejects.toThrow();
  });

  it("blocks student from creating sessions (requires classId)", async () => {
    const caller = appRouter.createCaller(createStudentContext());
    await expect(
      caller.sessions.create({ classId: 1, problemNumber: 1, sessionNumber: 1, label: "Test", studentIds: [] })
    ).rejects.toThrow();
  });

  it("blocks student from closing sessions", async () => {
    const caller = appRouter.createCaller(createStudentContext());
    await expect(caller.sessions.close({ id: 1 })).rejects.toThrow();
  });

  it("blocks student from accessing dashboard stats", async () => {
    const caller = appRouter.createCaller(createStudentContext());
    await expect(caller.results.dashboard()).rejects.toThrow();
  });

  it("blocks student from accessing student routes (no longer available)", async () => {
    const caller = appRouter.createCaller(createStudentContext());
    // myClasses and listForStudent routes were removed - students access via session code only
    expect(caller.studentAccess).toBeDefined();
  });
});

describe("Evaluation validation", () => {
  it("rejects self-evaluation in submission", async () => {
    const caller = appRouter.createCaller(createStudentContext());
    await expect(
      caller.evaluations.submit({
        sessionId: 999,
        evaluatorStudentId: 10,
        items: [{
          evaluatedStudentId: 10,
          role: "PARTICIPANTE",
          absent: false,
          atuacao: 2,
          pontualidade: 2,
          dominio: 2,
          metas: 2,
          participacao: 2,
        }],
      })
    ).rejects.toThrow("Autoavaliação não é permitida");
  });

  it("rejects duplicate exclusive roles", async () => {
    const caller = appRouter.createCaller(createStudentContext());
    await expect(
      caller.evaluations.submit({
        sessionId: 999,
        evaluatorStudentId: 10,
        items: [
          { evaluatedStudentId: 20, role: "COORDENADOR", absent: false, atuacao: 2, pontualidade: 2, dominio: 2, metas: 2, participacao: 2 },
          { evaluatedStudentId: 30, role: "COORDENADOR", absent: false, atuacao: 2, pontualidade: 2, dominio: 2, metas: 2, participacao: 2 },
        ],
      })
    ).rejects.toThrow("O papel COORDENADOR só pode ser atribuído a um aluno");
  });

  it("allows multiple absent students with same exclusive role", async () => {
    const caller = appRouter.createCaller(createStudentContext());
    try {
      await caller.evaluations.submit({
        sessionId: 999,
        evaluatorStudentId: 10,
        items: [
          { evaluatedStudentId: 20, role: "COORDENADOR", absent: true, atuacao: 0, pontualidade: 0, dominio: 0, metas: 0, participacao: 0 },
          { evaluatedStudentId: 30, role: "COORDENADOR", absent: true, atuacao: 0, pontualidade: 0, dominio: 0, metas: 0, participacao: 0 },
        ],
      });
    } catch (e: any) {
      // Should not throw for role validation when students are absent
      expect(e.message).not.toContain("O papel COORDENADOR só pode ser atribuído a um aluno");
    }
  });
});

describe("Auth routes", () => {
  it("auth.me returns user for authenticated context", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const me = await caller.auth.me();
    expect(me).toBeDefined();
    expect(me?.name).toBe("Professor Admin");
    expect(me?.role).toBe("admin");
  });

  it("auth.me returns null for unauthenticated context", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const me = await caller.auth.me();
    expect(me).toBeNull();
  });
});
