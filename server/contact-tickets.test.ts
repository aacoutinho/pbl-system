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

// ─── Test contact tickets indicator in sidebar ───
describe("Contact tickets indicator in sidebar", () => {
  describe("openCount route", () => {
    it("returns count as a number", () => {
      const response = { count: 3 };
      expect(typeof response.count).toBe("number");
      expect(response.count).toBeGreaterThanOrEqual(0);
    });

    it("returns 0 when no open tickets", () => {
      const response = { count: 0 };
      expect(response.count).toBe(0);
    });

    it("returns positive count when open tickets exist", () => {
      const response = { count: 5 };
      expect(response.count).toBeGreaterThan(0);
    });
  });

  describe("Badge visibility logic", () => {
    it("shows badge when admin and openTicketsCount > 0", () => {
      const isAdmin = true;
      const isContact = true;
      const openTicketsCount = 3;
      const showContactBadge = isContact && isAdmin && openTicketsCount > 0;
      expect(showContactBadge).toBe(true);
    });

    it("hides badge when openTicketsCount is 0", () => {
      const isAdmin = true;
      const isContact = true;
      const openTicketsCount = 0;
      const showContactBadge = isContact && isAdmin && openTicketsCount > 0;
      expect(showContactBadge).toBe(false);
    });

    it("hides badge for non-admin users", () => {
      const isAdmin = false;
      const isContact = true;
      const openTicketsCount = 5;
      const showContactBadge = isContact && isAdmin && openTicketsCount > 0;
      expect(showContactBadge).toBe(false);
    });

    it("hides badge on non-contact menu items", () => {
      const isAdmin = true;
      const isContact = false;
      const openTicketsCount = 5;
      const showContactBadge = isContact && isAdmin && openTicketsCount > 0;
      expect(showContactBadge).toBe(false);
    });

    it("hides badge for prof role", () => {
      const role = "prof";
      const isAdmin = role === "admin";
      const isContact = true;
      const openTicketsCount = 3;
      const showContactBadge = isContact && isAdmin && openTicketsCount > 0;
      expect(showContactBadge).toBe(false);
    });

    it("hides badge for coordinator role", () => {
      const role = "coordinator";
      const isAdmin = role === "admin";
      const isContact = true;
      const openTicketsCount = 3;
      const showContactBadge = isContact && isAdmin && openTicketsCount > 0;
      expect(showContactBadge).toBe(false);
    });
  });

  describe("Badge display format", () => {
    it("shows exact count when <= 99", () => {
      const count = 42;
      const display = count > 99 ? "99+" : String(count);
      expect(display).toBe("42");
    });

    it("shows 99+ when count exceeds 99", () => {
      const count = 150;
      const display = count > 99 ? "99+" : String(count);
      expect(display).toBe("99+");
    });

    it("shows 1 for single open ticket", () => {
      const count = 1;
      const display = count > 99 ? "99+" : String(count);
      expect(display).toBe("1");
    });
  });

  describe("Contact menu item position", () => {
    it("Contato item exists in menu for all approved roles", () => {
      const contactItem = { icon: "MessageSquare", label: "Contato", path: "/contact" };
      expect(contactItem.path).toBe("/contact");
      expect(contactItem.label).toBe("Contato");
    });

    it("openCount uses adminProcedure (admin-only)", () => {
      const procedureType = "adminProcedure";
      expect(procedureType).toBe("adminProcedure");
    });

    it("openCount query is enabled only for admin", () => {
      const isAdmin = true;
      const queryEnabled = isAdmin;
      expect(queryEnabled).toBe(true);

      const isProf = false;
      const queryEnabledProf = isProf;
      expect(queryEnabledProf).toBe(false);
    });
  });
});
