import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin Professor",
    loginMethod: "manus",
    role: "admin",
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
    name: "Student Test",
    loginMethod: "manus",
    role: "user",
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

describe("evaluation system routes", () => {
  it("admin can access dashboard stats", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.results.dashboard();
    expect(stats).toHaveProperty("totalStudents");
    expect(stats).toHaveProperty("totalSessions");
    expect(stats).toHaveProperty("openSessions");
    expect(stats).toHaveProperty("totalEvaluations");
    expect(typeof stats.totalStudents).toBe("number");
    expect(typeof stats.totalSessions).toBe("number");
  });

  it("non-admin cannot access dashboard stats", async () => {
    const ctx = createStudentContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.results.dashboard()).rejects.toThrow();
  });

  it("authenticated user can list students", async () => {
    const ctx = createStudentContext();
    const caller = appRouter.createCaller(ctx);
    const students = await caller.students.list();
    expect(Array.isArray(students)).toBe(true);
  });

  it("authenticated user can list sessions", async () => {
    const ctx = createStudentContext();
    const caller = appRouter.createCaller(ctx);
    const sessions = await caller.sessions.list();
    expect(Array.isArray(sessions)).toBe(true);
  });

  it("non-admin cannot create students", async () => {
    const ctx = createStudentContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.students.create({ name: "Test", email: "test@test.com" })
    ).rejects.toThrow();
  });

  it("non-admin cannot create sessions", async () => {
    const ctx = createStudentContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.sessions.create({ problemNumber: 1, sessionNumber: 1, label: "Test", studentIds: [] })
    ).rejects.toThrow();
  });

  it("evaluation submission rejects self-evaluation", async () => {
    const ctx = createStudentContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.evaluations.submit({
        sessionId: 999,
        evaluatorStudentId: 1,
        items: [{
          evaluatedStudentId: 1, // same as evaluator
          role: "PARTICIPANTE",
          absent: false,
          atuacao: 2, pontualidade: 2, dominio: 2, metas: 2, participacao: 2,
        }],
      })
    ).rejects.toThrow("Autoavaliação não é permitida");
  });

  it("evaluation submission rejects duplicate exclusive roles", async () => {
    const ctx = createStudentContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.evaluations.submit({
        sessionId: 999,
        evaluatorStudentId: 1,
        items: [
          { evaluatedStudentId: 2, role: "COORDENADOR", absent: false, atuacao: 2, pontualidade: 2, dominio: 2, metas: 2, participacao: 2 },
          { evaluatedStudentId: 3, role: "COORDENADOR", absent: false, atuacao: 2, pontualidade: 2, dominio: 2, metas: 2, participacao: 2 },
        ],
      })
    ).rejects.toThrow("O papel COORDENADOR só pode ser atribuído a um aluno");
  });

  it("auth.me returns user for authenticated context", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const me = await caller.auth.me();
    expect(me).toBeDefined();
    expect(me?.name).toBe("Admin Professor");
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
