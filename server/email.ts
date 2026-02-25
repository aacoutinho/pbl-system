import nodemailer from "nodemailer";
import { getActiveSmtpConfig, getAdmin, createNotification } from "./db";

/**
 * Notifica o administrador sobre falha no envio de e-mail.
 * Chamada internamente — nunca lança exceção para não interromper o fluxo principal.
 */
async function notifyAdminEmailFailure(options: {
  to: string;
  subject: string;
  error: string;
}) {
  try {
    const admin = await getAdmin();
    if (!admin) return;
    await createNotification({
      userId: admin.id,
      type: "email_error",
      title: "Falha no Envio de E-mail",
      message: `Erro ao enviar e-mail para ${options.to} (assunto: "${options.subject}"): ${options.error}`,
      metadata: JSON.stringify({
        recipient: options.to,
        subject: options.subject,
        error: options.error,
        occurredAt: new Date().toISOString(),
      }),
    });
  } catch (notifErr) {
    console.error("[Email] Failed to create admin notification for email error:", notifErr);
  }
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ success: boolean; error?: string }> {
  const config = await getActiveSmtpConfig();
  if (!config) {
    const error = "SMTP não configurado. O coordenador precisa configurar as credenciais de e-mail.";
    await notifyAdminEmailFailure({ to: options.to, subject: options.subject, error });
    return { success: false, error };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password,
      },
    });

    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    return { success: true };
  } catch (err: any) {
    const errorMsg = err.message || "Erro ao enviar e-mail";
    console.error("[Email] Failed to send:", errorMsg);
    await notifyAdminEmailFailure({ to: options.to, subject: options.subject, error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

export async function testSmtpConnection(config: {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail?: string;
  fromName?: string;
  testRecipient?: string;
}): Promise<{ success: boolean; error?: string; emailSent?: boolean }> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password,
      },
    });

    await transporter.verify();

    // Se tiver destinatário, envia e-mail de teste
    if (config.testRecipient && config.fromEmail) {
      const senderName = config.fromName || "Avaliação Tutorial";
      await transporter.sendMail({
        from: `"${senderName}" <${config.fromEmail}>`,
        to: config.testRecipient,
        subject: "Teste de Configuração SMTP - Avaliação Tutorial",
        text: "Este é um e-mail de teste do Sistema de Avaliação Tutorial. Se você recebeu esta mensagem, a configuração SMTP está funcionando corretamente.",
        html: buildTestEmailHtml(),
      });
      return { success: true, emailSent: true };
    }

    return { success: true, emailSent: false };
  } catch (err: any) {
    return { success: false, error: err.message || "Falha na conexão SMTP" };
  }
}

function buildTestEmailHtml(): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1f2937; margin: 0 0 8px;">Teste de Configuração SMTP</h2>
        <p style="color: #6b7280; margin: 0; font-size: 14px;">Avaliação Tutorial</p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; background: #ecfdf5; border: 2px solid #6ee7b7; border-radius: 8px; padding: 16px 32px;">
          <span style="font-size: 18px; font-weight: 600; color: #065f46;">✔ Configuração funcionando!</span>
        </div>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6; text-align: center;">
        Se você recebeu este e-mail, a configuração SMTP do sistema está correta e os e-mails de recuperação de senha serão enviados normalmente.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Sistema de Avaliação de Desempenho Tutorial
      </p>
    </div>
  `;
}

export function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function buildVerificationEmailHtml(code: string, email: string): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1f2937; margin: 0 0 8px;">Verificação de E-mail</h2>
        <p style="color: #6b7280; margin: 0; font-size: 14px;">Avaliação Tutorial</p>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Olá,
      </p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Para confirmar seu cadastro com o e-mail <strong>${email}</strong>, use o código abaixo:
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 8px; padding: 16px 32px;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1e40af;">${code}</span>
        </div>
      </div>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
        Este código expira em <strong>15 minutos</strong>. Se você não solicitou este cadastro, ignore este e-mail.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Sistema de Avaliação de Desempenho Tutorial
      </p>
    </div>
  `;
}

export function buildResetEmailHtml(code: string, userName: string): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1f2937; margin: 0 0 8px;">Recuperação de Senha</h2>
        <p style="color: #6b7280; margin: 0; font-size: 14px;">Avaliação Tutorial</p>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Olá <strong>${userName}</strong>,
      </p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Recebemos uma solicitação para redefinir sua senha. Use o código abaixo para continuar:
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; background: #f3f4f6; border: 2px dashed #9ca3af; border-radius: 8px; padding: 16px 32px;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1f2937;">${code}</span>
        </div>
      </div>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
        Este código expira em <strong>15 minutos</strong>. Se você não solicitou a recuperação de senha, ignore este e-mail.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Sistema de Avaliação de Desempenho Tutorial
      </p>
    </div>
  `;
}

export function buildComponentApprovalEmailHtml(userName: string, componentCode: string, componentName: string): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1f2937; margin: 0 0 8px;">Solicitação Aprovada</h2>
        <p style="color: #6b7280; margin: 0; font-size: 14px;">Avaliação Tutorial</p>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Olá <strong>${userName}</strong>,
      </p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Sua solicitação de entrada no componente foi <strong style="color: #059669;">aprovada</strong>!
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; background: #ecfdf5; border: 2px solid #6ee7b7; border-radius: 8px; padding: 16px 32px;">
          <span style="font-size: 18px; font-weight: 600; color: #065f46;">${componentCode} - ${componentName}</span>
        </div>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Você já pode acessar o sistema e visualizar as turmas, alunos e sessões deste componente.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Sistema de Avaliação de Desempenho Tutorial
      </p>
    </div>
  `;
}

export function buildComponentRejectionEmailHtml(userName: string, componentCode: string, componentName: string): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1f2937; margin: 0 0 8px;">Solicitação Rejeitada</h2>
        <p style="color: #6b7280; margin: 0; font-size: 14px;">Avaliação Tutorial</p>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Olá <strong>${userName}</strong>,
      </p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Infelizmente, sua solicitação de entrada no componente foi <strong style="color: #dc2626;">rejeitada</strong>.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; background: #fef2f2; border: 2px solid #fca5a5; border-radius: 8px; padding: 16px 32px;">
          <span style="font-size: 18px; font-weight: 600; color: #991b1b;">${componentCode} - ${componentName}</span>
        </div>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Caso acredite que houve um engano, entre em contato com o coordenador do componente ou com o administrador do sistema.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Sistema de Avaliação de Desempenho Tutorial
      </p>
    </div>
  `;
}

export function buildNewRequestEmailHtml(coordinatorName: string, professorName: string, professorEmail: string, componentCode: string, componentName: string): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1f2937; margin: 0 0 8px;">Nova Solicitação de Entrada</h2>
        <p style="color: #6b7280; margin: 0; font-size: 14px;">Avaliação Tutorial</p>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Olá <strong>${coordinatorName}</strong>,
      </p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Um novo professor solicitou entrada no componente que você coordena:
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; background: #fffbeb; border: 2px solid #fcd34d; border-radius: 8px; padding: 16px 32px;">
          <span style="font-size: 18px; font-weight: 600; color: #92400e;">${componentCode} - ${componentName}</span>
        </div>
      </div>
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="color: #374151; font-size: 14px; margin: 0 0 4px;"><strong>Professor:</strong> ${professorName}</p>
        <p style="color: #374151; font-size: 14px; margin: 0;"><strong>E-mail:</strong> ${professorEmail}</p>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Acesse o sistema para <strong>aprovar</strong> ou <strong>rejeitar</strong> esta solicitação na seção de Professores.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Sistema de Avaliação de Desempenho Tutorial
      </p>
    </div>
  `;
}

export function buildEvalPermissionGrantedEmailHtml(
  professorName: string,
  classCode: string,
  componentCode: string,
  componentName: string,
  grantedByName: string
): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1f2937; margin: 0 0 8px;">Permissão de Avaliação Concedida</h2>
        <p style="color: #6b7280; margin: 0; font-size: 14px;">Avaliação Tutorial</p>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Olá <strong>${professorName}</strong>,
      </p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Você recebeu <strong style="color: #2563eb;">permissão para avaliar sessões</strong> de uma turma:
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; background: #eff6ff; border: 2px solid #93c5fd; border-radius: 8px; padding: 16px 32px;">
          <span style="font-size: 18px; font-weight: 600; color: #1e40af;">${componentCode} - ${classCode}</span>
          <br />
          <span style="font-size: 14px; color: #3b82f6;">${componentName}</span>
        </div>
      </div>
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="color: #374151; font-size: 14px; margin: 0;"><strong>Concedida por:</strong> ${grantedByName}</p>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Acesse a página <strong>Avaliar Tutorial</strong> no sistema para visualizar e avaliar as sessões desta turma.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Sistema de Avaliação de Desempenho Tutorial
      </p>
    </div>
  `;
}


// ─── Contact Ticket Email Template ───
// ─── Session Opened Email Template (for students) ───
export function buildSessionOpenedEmailHtml(data: {
  studentName: string;
  sessionLabel: string;
  accessCode: string;
  accessUrl: string;
  componentCode: string;
  classCode: string;
}): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1f2937; margin: 0 0 8px;">Sessão de Avaliação Aberta</h2>
        <p style="color: #6b7280; margin: 0; font-size: 14px;">Avaliação de Desempenho Tutorial</p>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Olá <strong>${data.studentName}</strong>,
      </p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Uma nova sessão de avaliação tutorial foi aberta para você:
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; background: #eff6ff; border: 2px solid #93c5fd; border-radius: 8px; padding: 16px 32px;">
          <span style="font-size: 14px; color: #3b82f6;">${data.componentCode} - ${data.classCode}</span>
          <br />
          <span style="font-size: 18px; font-weight: 600; color: #1e40af;">${data.sessionLabel}</span>
        </div>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${data.accessUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">Avaliar Agora</a>
      </div>
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="color: #374151; font-size: 13px; margin: 0;"><strong>Como acessar:</strong></p>
        <ol style="color: #374151; font-size: 13px; margin: 8px 0 0; padding-left: 20px;">
          <li>Clique no botão acima para acessar diretamente o formulário</li>
          <li>Avalie seus colegas de equipe</li>
          <li>Confirme e envie sua avaliação</li>
        </ol>
      </div>
      <div style="background: #fef3c7; border-radius: 8px; padding: 12px 16px; margin: 12px 0;">
        <p style="color: #92400e; font-size: 12px; margin: 0;">⚠️ Este link é pessoal e intransferível. Não compartilhe com outros alunos.</p>
      </div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Sistema de Avaliação de Desempenho Tutorial
      </p>
    </div>
  `;
}

export function buildBrainstormNotificationEmailHtml(data: {
  studentName: string;
  sessionLabel: string;
  brainstormUrl: string;
  componentCode: string;
  classCode: string;
}): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1f2937; margin: 0 0 8px;">Quadro de Brainstorming</h2>
        <p style="color: #6b7280; margin: 0; font-size: 14px;">Voc\u00ea foi designado como Mesa</p>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Ol\u00e1 <strong>${data.studentName}</strong>,
      </p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Voc\u00ea \u00e9 o respons\u00e1vel pelo <strong>Quadro de Brainstorming</strong> da sess\u00e3o abaixo. Use o quadro digital para registrar as Ideias, Fatos, Quest\u00f5es e Metas discutidas durante o tutorial.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; background: #f0fdf4; border: 2px solid #86efac; border-radius: 8px; padding: 16px 32px;">
          <span style="font-size: 14px; color: #16a34a;">${data.componentCode} - ${data.classCode}</span>
          <br />
          <span style="font-size: 18px; font-weight: 600; color: #15803d;">${data.sessionLabel}</span>
        </div>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${data.brainstormUrl}" style="display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">Abrir Quadro de Brainstorming</a>
      </div>
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="color: #374151; font-size: 13px; margin: 0;"><strong>Instru\u00e7\u00f5es:</strong></p>
        <ol style="color: #374151; font-size: 13px; margin: 8px 0 0; padding-left: 20px;">
          <li>Clique no bot\u00e3o acima para acessar o quadro digital</li>
          <li>Registre as Ideias, Fatos, Quest\u00f5es e Metas da discuss\u00e3o</li>
          <li>Voc\u00ea pode adicionar links, imagens e fotos ao quadro</li>
          <li>O quadro fica vis\u00edvel para todos os colegas e o professor</li>
        </ol>
      </div>
      <div style="background: #ecfdf5; border-radius: 8px; padding: 12px 16px; margin: 12px 0;">
        <p style="color: #065f46; font-size: 12px; margin: 0;">\ud83d\udcdd Voc\u00ea pode preencher o quadro durante toda a sess\u00e3o (iniciada ou aberta).</p>
      </div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Sistema de Avalia\u00e7\u00e3o de Desempenho Tutorial
      </p>
    </div>
  `;
}

export function buildContactTicketEmailHtml(data: {
  ticketType: "bug" | "feature";
  subject: string;
  message: string;
  userName: string;
  userEmail: string;
}): string {
  const typeLabel = data.ticketType === "bug" ? "Relatório de Bug" : "Pedido de Funcionalidade";
  const typeColor = data.ticketType === "bug" ? "#dc2626" : "#2563eb";
  const typeIcon = data.ticketType === "bug" ? "🐛" : "💡";

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <div style="background: ${typeColor}; padding: 24px 32px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px;">${typeIcon} ${typeLabel}</h1>
      </div>
      <div style="padding: 32px;">
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">Enviado por:</p>
          <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${data.userName}</p>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b;">${data.userEmail}</p>
        </div>
        <div style="margin-bottom: 20px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; font-weight: 600;">Assunto:</p>
          <p style="margin: 0; font-size: 16px; color: #1e293b;">${data.subject}</p>
        </div>
        <div style="background: #f1f5f9; border-left: 4px solid ${typeColor}; padding: 16px; border-radius: 0 8px 8px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; font-weight: 600;">Mensagem:</p>
          <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.6; white-space: pre-wrap;">${data.message}</p>
        </div>
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">Acesse o sistema para gerenciar este ticket.</p>
        </div>
      </div>
    </div>
  `;
}

export function buildStudentGradeReportHtml(data: {
  studentName: string;
  componentCode: string;
  componentName: string;
  className: string;
  sessionLabel: string;
  problemNumber: number;
  tutorialCriteria: {
    organizacao: number;
    cooperacao: number;
    conteudo: number;
    objetivo: number;
    metas: number;
    tutorialGrade: number;
  };
  peerAverage: number | null;
  finalGrade: number | null;
  normalizedGrade: number | null;
  problemAverage: number | null;
}): string {
  const gradeColor = (v: number) => v >= 7 ? "#059669" : v >= 5 ? "#d97706" : "#dc2626";

  const criteriaRows = [
    { label: "Organização", weight: 1, value: data.tutorialCriteria.organizacao },
    { label: "Cooperação", weight: 1, value: data.tutorialCriteria.cooperacao },
    { label: "Conteúdo", weight: 3, value: data.tutorialCriteria.conteudo },
    { label: "Objetivo", weight: 3, value: data.tutorialCriteria.objetivo },
    { label: "Metas", weight: 2, value: data.tutorialCriteria.metas },
  ].map(c => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">${c.label}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; font-weight: 600; text-align: center; color: ${gradeColor(c.value * 10)};">${c.value.toFixed(2)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; text-align: center;">×${c.weight}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; font-weight: 600; text-align: center; color: #374151;">${(c.value * c.weight).toFixed(2)}</td>
    </tr>
  `).join("");

  const tutorialGrade = data.tutorialCriteria.tutorialGrade;
  const peerText = data.peerAverage !== null ? data.peerAverage.toFixed(1) : "Pendente";
  const finalText = data.finalGrade !== null ? data.finalGrade.toFixed(1) : "Pendente";
  const normalizedText = data.normalizedGrade !== null ? data.normalizedGrade.toFixed(1) : "Pendente";
  const problemText = data.problemAverage !== null ? data.problemAverage.toFixed(1) : "Pendente";

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 24px 32px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Relatório de Avaliação Tutorial</h1>
        <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">${data.componentCode} - ${data.componentName}</p>
      </div>
      <div style="padding: 24px 32px;">
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0 0 4px; font-size: 14px; color: #6b7280;">Aluno(a)</p>
          <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">${data.studentName}</p>
          <p style="margin: 8px 0 0; font-size: 13px; color: #6b7280;">Turma: ${data.className} | ${data.sessionLabel}</p>
        </div>

        <h3 style="margin: 0 0 12px; font-size: 15px; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Avaliação do Tutor sobre o Tutorial</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #6b7280; font-weight: 600;">Critério</th>
              <th style="padding: 10px 12px; text-align: center; font-size: 13px; color: #6b7280; font-weight: 600;">Nota</th>
              <th style="padding: 10px 12px; text-align: center; font-size: 13px; color: #6b7280; font-weight: 600;">Peso</th>
              <th style="padding: 10px 12px; text-align: center; font-size: 13px; color: #6b7280; font-weight: 600;">Pontuação</th>
            </tr>
          </thead>
          <tbody>
            ${criteriaRows}
            <tr style="background: #f0fdf4;">
              <td colspan="3" style="padding: 10px 12px; font-size: 14px; font-weight: 700; color: #1f2937;">Nota do Tutorial</td>
              <td style="padding: 10px 12px; font-size: 16px; font-weight: 700; text-align: center; color: ${gradeColor(tutorialGrade)};">${tutorialGrade.toFixed(1)}</td>
            </tr>
          </tbody>
        </table>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-size: 14px; color: #374151;">Média dos Pares</td>
              <td style="padding: 6px 0; font-size: 18px; font-weight: 700; text-align: right; color: ${data.peerAverage !== null ? gradeColor(data.peerAverage) : '#6b7280'};">${peerText}${data.peerAverage !== null ? ' / 10' : ''}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 14px; color: #374151;">Nota Final</td>
              <td style="padding: 6px 0; font-size: 18px; font-weight: 700; text-align: right; color: ${data.finalGrade !== null ? gradeColor(data.finalGrade) : '#6b7280'};">${finalText}</td>
            </tr>
            <tr style="border-top: 2px solid #86efac;">
              <td style="padding: 10px 0 6px; font-size: 15px; font-weight: 600; color: #1f2937;">Nota Normalizada</td>
              <td style="padding: 10px 0 6px; font-size: 22px; font-weight: 700; text-align: right; color: ${data.normalizedGrade !== null ? gradeColor(data.normalizedGrade) : '#6b7280'};">${normalizedText}${data.normalizedGrade !== null ? ' / 10' : ''}</td>
            </tr>
          </table>
        </div>

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
          <p style="margin: 0; font-size: 14px; color: #1e40af;">
            <strong>Média do Problema ${data.problemNumber}:</strong>
            <span style="float: right; font-size: 16px; font-weight: 700; color: ${data.problemAverage !== null ? gradeColor(data.problemAverage) : '#6b7280'};">${problemText}${data.problemAverage !== null ? ' / 10' : ''}</span>
          </p>
        </div>

        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #9ca3af;">Este relatório foi gerado automaticamente pelo Sistema de Avaliação Tutorial.</p>
          <p style="margin: 4px 0 0; font-size: 12px; color: #9ca3af;">Em caso de dúvidas, entre em contato com o professor responsável.</p>
        </div>
      </div>
    </div>
  `;
}
