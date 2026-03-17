import nodemailer from "nodemailer";

export type AccountUpdatedEmailInput = {
  to: string;
  username: string;
  email: string;
  passwordChanged: boolean;
};

export type PasswordResetEmailInput = {
  to: string;
  resetUrl: string;
};

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !portRaw || !user || !pass || !from) return null;
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) return null;

  return { host, port, user, pass, from };
}

export async function sendAccountUpdatedEmail(input: AccountUpdatedEmailInput) {
  const cfg = getSmtpConfig();
  if (!cfg) return { ok: false as const, error: "SMTP_NOT_CONFIGURED" as const };

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const lines = [
    "Your Goers Golf account details were updated.",
    "",
    `Username: ${input.username}`,
    `Email: ${input.email}`,
    `Password: ${input.passwordChanged ? "Changed" : "Unchanged"}`,
    "",
    "If you didn't make this change, please sign in and update your password immediately.",
  ];

  await transport.sendMail({
    from: cfg.from,
    to: input.to,
    subject: "Goers Golf account updated",
    text: lines.join("\n"),
  });

  return { ok: true as const };
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput) {
  const cfg = getSmtpConfig();
  if (!cfg) return { ok: false as const, error: "SMTP_NOT_CONFIGURED" as const };

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const lines = [
    "Reset your Goers Golf password using the link below:",
    "",
    input.resetUrl,
    "",
    "This link expires soon. If you didn’t request a reset, you can ignore this email.",
  ];

  try {
    await transport.sendMail({
      from: cfg.from,
      to: input.to,
      subject: "Goers Golf password reset",
      text: lines.join("\n"),
    });
    return { ok: true as const };
  } catch (e: unknown) {
    // Log full details server-side; keep API response generic.
    console.error("Password reset email failed", {
      to: input.to,
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      error: e,
    });
    return { ok: false as const, error: "SMTP_SEND_FAILED" as const };
  }
}

