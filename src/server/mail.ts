import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

// ส่งอีเมลผ่าน SMTP (ตอนนี้ใช้ Gmail + App Password)
// ย้ายไป Resend/SES/โดเมนตัวเอง: เปลี่ยน env SMTP_* เท่านั้น
// ไม่ได้ตั้ง SMTP ตอน dev → พิมพ์อีเมลลง console แทน (ทดสอบ OTP ได้โดยไม่ต้องส่งจริง)

const globalForMail = globalThis as unknown as { mailer?: Transporter | null };

function getTransport(): Transporter | null {
  if (globalForMail.mailer !== undefined) return globalForMail.mailer;
  globalForMail.mailer =
    env.SMTP_USER && env.SMTP_PASS
      ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        })
      : null;
  return globalForMail.mailer;
}

export async function sendMail(msg: { to: string; subject: string; text: string; html: string }) {
  const transport = getTransport();
  if (!transport) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP is not configured (SMTP_USER / SMTP_PASS)");
    console.info(`\n[DEV MAIL — not sent] to=${msg.to}\nsubject: ${msg.subject}\n${msg.text}\n`);
    return;
  }
  await transport.sendMail({
    from: { name: env.MAIL_FROM_NAME, address: env.SMTP_USER! },
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
    // อีเมลอัตโนมัติ — บอกโปรแกรมอีเมลว่าไม่ต้องตอบกลับ
    headers: { "Auto-Submitted": "auto-generated", "X-Auto-Response-Suppress": "All" },
  });
}

type OtpType = "sign-in" | "email-verification" | "forget-password" | "change-email";

const SUBJECT: Record<OtpType, string> = {
  "email-verification": "ยืนยันอีเมล EASY-POS / Verify your email",
  "forget-password": "รีเซ็ตรหัสผ่าน EASY-POS / Reset your password",
  "sign-in": "รหัสเข้าสู่ระบบ EASY-POS / Sign-in code",
  "change-email": "ยืนยันอีเมลใหม่ EASY-POS / Confirm new email",
};

/** อีเมล OTP สองภาษา (ไทย/อังกฤษ) */
export async function sendOtpMail(to: string, otp: string, type: OtpType) {
  const subject = SUBJECT[type];
  const text = [
    `รหัส OTP ของคุณคือ ${otp} (ใช้ได้ 10 นาที)`,
    `Your one-time code is ${otp} (valid for 10 minutes)`,
    "",
    "ถ้าคุณไม่ได้ขอรหัสนี้ ไม่ต้องทำอะไร — If you did not request this, ignore this email.",
    "อีเมลนี้ส่งอัตโนมัติ กรุณาอย่าตอบกลับ — This is an automated message, please do not reply.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="100%" style="max-width:440px;background:#ffffff;border-radius:16px;padding:28px" cellpadding="0" cellspacing="0">
<tr><td style="font-size:20px;font-weight:bold;color:#0f766e">EASY-POS</td></tr>
<tr><td style="padding-top:12px;font-size:15px;color:#18181b">${subject}</td></tr>
<tr><td style="padding:20px 0" align="center"><div style="font-size:34px;letter-spacing:10px;font-weight:bold;color:#18181b;background:#f0fdfa;border-radius:12px;padding:14px 0">${otp}</div></td></tr>
<tr><td style="font-size:14px;color:#3f3f46;line-height:1.6">รหัสนี้ใช้ได้ 10 นาที<br>This code is valid for 10 minutes.</td></tr>
<tr><td style="padding-top:16px;font-size:12px;color:#71717a;line-height:1.6">ถ้าคุณไม่ได้ขอรหัสนี้ ไม่ต้องทำอะไร / If you did not request this, you can ignore this email.<br>อีเมลนี้ส่งอัตโนมัติ กรุณาอย่าตอบกลับ / This is an automated message — please do not reply.</td></tr>
</table></td></tr></table></body></html>`;
  await sendMail({ to, subject, text, html });
}
