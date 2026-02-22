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
}): Promise<{ success: boolean; error?: string }> {
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
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Falha na conexão SMTP" };
  }
}

export function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
