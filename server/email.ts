import nodemailer from "nodemailer";
import { getActiveSmtpConfig } from "./db";

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ success: boolean; error?: string }> {
  const config = await getActiveSmtpConfig();
  if (!config) {
    return { success: false, error: "SMTP não configurado. O coordenador precisa configurar as credenciais de e-mail." };
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
    console.error("[Email] Failed to send:", err.message);
    return { success: false, error: err.message || "Erro ao enviar e-mail" };
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
          <span style="font-size: 18px; font-weight: 600; color: #065f46;">\u2714 Configura\u00e7\u00e3o funcionando!</span>
        </div>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6; text-align: center;">
        Se voc\u00ea recebeu este e-mail, a configura\u00e7\u00e3o SMTP do sistema est\u00e1 correta e os e-mails de recupera\u00e7\u00e3o de senha ser\u00e3o enviados normalmente.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Sistema de Avalia\u00e7\u00e3o de Desempenho Tutorial
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
