import { describe, it, expect } from "vitest";
import {
  buildComponentApprovalEmailHtml,
  buildComponentRejectionEmailHtml,
} from "./email";

describe("Component request email notification templates", () => {
  describe("buildComponentApprovalEmailHtml", () => {
    it("returns HTML string with user name, component code and name", () => {
      const html = buildComponentApprovalEmailHtml("João Silva", "TEC502", "Sistemas Distribuídos");
      expect(html).toContain("João Silva");
      expect(html).toContain("TEC502");
      expect(html).toContain("Sistemas Distribuídos");
    });

    it("contains approval-related text", () => {
      const html = buildComponentApprovalEmailHtml("Maria", "MAT101", "Cálculo I");
      expect(html).toContain("aprovada");
      expect(html).toContain("Solicitação Aprovada");
    });

    it("contains green styling for approval", () => {
      const html = buildComponentApprovalEmailHtml("Ana", "FIS201", "Física II");
      expect(html).toContain("#059669"); // green color for "aprovada"
      expect(html).toContain("#ecfdf5"); // green background
    });

    it("contains system footer", () => {
      const html = buildComponentApprovalEmailHtml("Pedro", "QUI301", "Química");
      expect(html).toContain("Sistema de Avaliação de Desempenho Tutorial");
    });

    it("contains access instruction", () => {
      const html = buildComponentApprovalEmailHtml("Carlos", "BIO101", "Biologia");
      expect(html).toContain("Você já pode acessar o sistema");
    });
  });

  describe("buildComponentRejectionEmailHtml", () => {
    it("returns HTML string with user name, component code and name", () => {
      const html = buildComponentRejectionEmailHtml("João Silva", "TEC502", "Sistemas Distribuídos");
      expect(html).toContain("João Silva");
      expect(html).toContain("TEC502");
      expect(html).toContain("Sistemas Distribuídos");
    });

    it("contains rejection-related text", () => {
      const html = buildComponentRejectionEmailHtml("Maria", "MAT101", "Cálculo I");
      expect(html).toContain("rejeitada");
      expect(html).toContain("Solicitação Rejeitada");
    });

    it("contains red styling for rejection", () => {
      const html = buildComponentRejectionEmailHtml("Ana", "FIS201", "Física II");
      expect(html).toContain("#dc2626"); // red color for "rejeitada"
      expect(html).toContain("#fef2f2"); // red background
    });

    it("contains system footer", () => {
      const html = buildComponentRejectionEmailHtml("Pedro", "QUI301", "Química");
      expect(html).toContain("Sistema de Avaliação de Desempenho Tutorial");
    });

    it("contains contact instruction", () => {
      const html = buildComponentRejectionEmailHtml("Carlos", "BIO101", "Biologia");
      expect(html).toContain("entre em contato com o coordenador");
    });
  });

  describe("Email templates are well-formed HTML", () => {
    it("approval template has proper HTML structure", () => {
      const html = buildComponentApprovalEmailHtml("Test", "CODE", "Name");
      expect(html).toContain("<div");
      expect(html).toContain("</div>");
      expect(html).toContain("font-family");
    });

    it("rejection template has proper HTML structure", () => {
      const html = buildComponentRejectionEmailHtml("Test", "CODE", "Name");
      expect(html).toContain("<div");
      expect(html).toContain("</div>");
      expect(html).toContain("font-family");
    });
  });
});
