import { describe, it, expect, vi } from "vitest";
import { buildContactTicketEmailHtml } from "./email";

describe("Contact Tickets", () => {
  describe("buildContactTicketEmailHtml", () => {
    it("should generate bug report email with red color", () => {
      const html = buildContactTicketEmailHtml({
        ticketType: "bug",
        subject: "Erro ao salvar sessão",
        message: "Quando tento salvar uma sessão, aparece erro 500.",
        userName: "Prof. Silva",
        userEmail: "silva@uni.edu",
      });
      expect(html).toContain("Relatório de Bug");
      expect(html).toContain("#dc2626"); // red color
      expect(html).toContain("🐛");
      expect(html).toContain("Prof. Silva");
      expect(html).toContain("silva@uni.edu");
      expect(html).toContain("Erro ao salvar sessão");
      expect(html).toContain("Quando tento salvar uma sessão, aparece erro 500.");
    });

    it("should generate feature request email with blue color", () => {
      const html = buildContactTicketEmailHtml({
        ticketType: "feature",
        subject: "Exportar resultados em PDF",
        message: "Gostaria de poder exportar os resultados das sessões em formato PDF.",
        userName: "Prof. Costa",
        userEmail: "costa@uni.edu",
      });
      expect(html).toContain("Pedido de Funcionalidade");
      expect(html).toContain("#2563eb"); // blue color
      expect(html).toContain("💡");
      expect(html).toContain("Prof. Costa");
      expect(html).toContain("costa@uni.edu");
      expect(html).toContain("Exportar resultados em PDF");
    });

    it("should include sender information section", () => {
      const html = buildContactTicketEmailHtml({
        ticketType: "bug",
        subject: "Test",
        message: "Test message content",
        userName: "João",
        userEmail: "joao@test.com",
      });
      expect(html).toContain("Enviado por:");
      expect(html).toContain("João");
      expect(html).toContain("joao@test.com");
    });

    it("should include subject and message sections", () => {
      const html = buildContactTicketEmailHtml({
        ticketType: "feature",
        subject: "Meu assunto",
        message: "Minha mensagem detalhada",
        userName: "Maria",
        userEmail: "maria@test.com",
      });
      expect(html).toContain("Assunto:");
      expect(html).toContain("Meu assunto");
      expect(html).toContain("Mensagem:");
      expect(html).toContain("Minha mensagem detalhada");
    });

    it("should have proper HTML structure with styled container", () => {
      const html = buildContactTicketEmailHtml({
        ticketType: "bug",
        subject: "Test",
        message: "Test message",
        userName: "Test User",
        userEmail: "test@test.com",
      });
      expect(html).toContain("font-family:");
      expect(html).toContain("max-width: 600px");
      expect(html).toContain("border-radius:");
    });

    it("should preserve message whitespace with pre-wrap", () => {
      const html = buildContactTicketEmailHtml({
        ticketType: "bug",
        subject: "Test",
        message: "Line 1\nLine 2\nLine 3",
        userName: "Test",
        userEmail: "test@test.com",
      });
      expect(html).toContain("white-space: pre-wrap");
      expect(html).toContain("Line 1\nLine 2\nLine 3");
    });
  });

  describe("Contact Ticket Types", () => {
    it("should support bug type", () => {
      const html = buildContactTicketEmailHtml({
        ticketType: "bug",
        subject: "Bug test",
        message: "Bug description",
        userName: "User",
        userEmail: "user@test.com",
      });
      expect(html).toContain("Relatório de Bug");
    });

    it("should support feature type", () => {
      const html = buildContactTicketEmailHtml({
        ticketType: "feature",
        subject: "Feature test",
        message: "Feature description",
        userName: "User",
        userEmail: "user@test.com",
      });
      expect(html).toContain("Pedido de Funcionalidade");
    });
  });
});
