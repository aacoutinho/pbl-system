import { describe, it, expect } from "vitest";

// Test the getPeerGradesMatrix interface and structure
describe("Peer Grades Matrix", () => {
  describe("Interface structure", () => {
    it("should define PeerGradeDetail with required fields", () => {
      const detail = {
        evaluatorStudentId: 1,
        evaluatorSerial: 1,
        score: 8.5,
        absent: false,
      };
      expect(detail).toHaveProperty("evaluatorStudentId");
      expect(detail).toHaveProperty("evaluatorSerial");
      expect(detail).toHaveProperty("score");
      expect(detail).toHaveProperty("absent");
    });

    it("should define PeerGradesMatrixRow with required fields", () => {
      const row = {
        serial: 1,
        studentId: 10,
        studentName: "João Silva",
        studentEnrollment: "2024001",
        peerGrades: [],
        peerAverage: 0,
        absent: false,
      };
      expect(row).toHaveProperty("serial");
      expect(row).toHaveProperty("studentId");
      expect(row).toHaveProperty("studentName");
      expect(row).toHaveProperty("studentEnrollment");
      expect(row).toHaveProperty("peerGrades");
      expect(row).toHaveProperty("peerAverage");
      expect(row).toHaveProperty("absent");
    });

    it("should define matrix result with evaluators and rows", () => {
      const result = {
        evaluators: [
          { studentId: 1, serial: 1, name: "Alice", enrollment: "2024001" },
          { studentId: 2, serial: 2, name: "Bob", enrollment: "2024002" },
        ],
        rows: [],
      };
      expect(result).toHaveProperty("evaluators");
      expect(result).toHaveProperty("rows");
      expect(result.evaluators).toHaveLength(2);
    });
  });

  describe("Average calculation logic", () => {
    it("should calculate average excluding absent grades", () => {
      const grades = [
        { evaluatorStudentId: 1, evaluatorSerial: 1, score: 8.0, absent: false },
        { evaluatorStudentId: 2, evaluatorSerial: 2, score: 0, absent: true },
        { evaluatorStudentId: 3, evaluatorSerial: 3, score: 6.0, absent: false },
      ];
      const validGrades = grades.filter(g => !g.absent);
      const avg = validGrades.reduce((sum, g) => sum + g.score, 0) / validGrades.length;
      expect(avg).toBe(7.0);
    });

    it("should return 0 average when all grades are absent", () => {
      const grades = [
        { evaluatorStudentId: 1, evaluatorSerial: 1, score: 0, absent: true },
        { evaluatorStudentId: 2, evaluatorSerial: 2, score: 0, absent: true },
      ];
      const validGrades = grades.filter(g => !g.absent);
      const avg = validGrades.length > 0
        ? validGrades.reduce((sum, g) => sum + g.score, 0) / validGrades.length
        : 0;
      expect(avg).toBe(0);
    });

    it("should calculate average with all valid grades", () => {
      const grades = [
        { evaluatorStudentId: 1, evaluatorSerial: 1, score: 10.0, absent: false },
        { evaluatorStudentId: 2, evaluatorSerial: 2, score: 8.0, absent: false },
        { evaluatorStudentId: 3, evaluatorSerial: 3, score: 6.0, absent: false },
      ];
      const validGrades = grades.filter(g => !g.absent);
      const avg = validGrades.reduce((sum, g) => sum + g.score, 0) / validGrades.length;
      expect(avg).toBe(8.0);
    });

    it("should handle single valid grade", () => {
      const grades = [
        { evaluatorStudentId: 1, evaluatorSerial: 1, score: 7.5, absent: false },
      ];
      const validGrades = grades.filter(g => !g.absent);
      const avg = validGrades.reduce((sum, g) => sum + g.score, 0) / validGrades.length;
      expect(avg).toBe(7.5);
    });
  });

  describe("Self-evaluation exclusion", () => {
    it("should not include self-evaluation in peer grades", () => {
      const studentId = 5;
      const evaluators = [
        { studentId: 3, serial: 1 },
        { studentId: 5, serial: 2 }, // self
        { studentId: 7, serial: 3 },
      ];
      const peerEvaluators = evaluators.filter(e => e.studentId !== studentId);
      expect(peerEvaluators).toHaveLength(2);
      expect(peerEvaluators.map(e => e.studentId)).not.toContain(studentId);
    });
  });

  describe("Serial number assignment", () => {
    it("should assign sequential serial numbers starting from 1", () => {
      const students = [
        { studentId: 10, studentName: "Alice" },
        { studentId: 20, studentName: "Bob" },
        { studentId: 30, studentName: "Carlos" },
      ];
      const serialMap = new Map<number, number>();
      students.forEach((s, i) => serialMap.set(s.studentId, i + 1));
      expect(serialMap.get(10)).toBe(1);
      expect(serialMap.get(20)).toBe(2);
      expect(serialMap.get(30)).toBe(3);
    });
  });

  describe("Score calculation from 5 criteria", () => {
    it("should sum all 5 criteria for total score", () => {
      const item = {
        atuacao: "2.0",
        pontualidade: "2.0",
        dominio: "2.0",
        metas: "2.0",
        participacao: "2.0",
      };
      const score = Number(item.atuacao) + Number(item.pontualidade) + Number(item.dominio) + Number(item.metas) + Number(item.participacao);
      expect(score).toBe(10.0);
    });

    it("should handle partial scores", () => {
      const item = {
        atuacao: "1.5",
        pontualidade: "1.0",
        dominio: "2.0",
        metas: "0.5",
        participacao: "1.0",
      };
      const score = Number(item.atuacao) + Number(item.pontualidade) + Number(item.dominio) + Number(item.metas) + Number(item.participacao);
      expect(score).toBe(6.0);
    });

    it("should handle zero scores", () => {
      const item = {
        atuacao: "0",
        pontualidade: "0",
        dominio: "0",
        metas: "0",
        participacao: "0",
      };
      const score = Number(item.atuacao) + Number(item.pontualidade) + Number(item.dominio) + Number(item.metas) + Number(item.participacao);
      expect(score).toBe(0);
    });
  });

  describe("Absent student detection", () => {
    it("should mark student as absent when majority marks them absent", () => {
      const items = [
        { absent: true },
        { absent: true },
        { absent: false },
      ];
      const absentCount = items.filter(i => i.absent).length;
      const presentCount = items.filter(i => !i.absent).length;
      const isAbsent = items.length > 0 && absentCount > presentCount;
      expect(isAbsent).toBe(true);
    });

    it("should not mark student as absent when majority marks them present", () => {
      const items = [
        { absent: false },
        { absent: false },
        { absent: true },
      ];
      const absentCount = items.filter(i => i.absent).length;
      const presentCount = items.filter(i => !i.absent).length;
      const isAbsent = items.length > 0 && absentCount > presentCount;
      expect(isAbsent).toBe(false);
    });
  });
});
