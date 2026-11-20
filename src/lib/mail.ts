import nodemailer from 'nodemailer'
import { env } from '@/env'

type Mail = { to: string; subject: string; text: string; html?: string }

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  })
  : null

/** Sends an e-mail through SMTP, or prints it to the log when SMTP is not configured (dev). */
export async function sendMail(mail: Mail) {
  if (!transport) {
    console.log(`[mail] (SMTP not configured) to=${mail.to} subject="${mail.subject}"\n${mail.text}`)
    return
  }
  await transport.sendMail({ from: env.MAIL_FROM, ...mail })
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

/** Public URL of the web app (first origin of WEB_URL). */
export const webUrl = () => env.WEB_URL.split(',')[0].trim().replace(/\/$/, '')

export function passwordRecoverMail(to: string, name: string | null, link: string): Mail {
  const greeting = name ? `Olá, ${name}!` : 'Olá!'
  return {
    to,
    subject: 'Recuperação de senha — Realtime chat',
    text: `${greeting}\n\nRecebemos um pedido para redefinir sua senha. Use o link abaixo (válido por 1 hora):\n\n${link}\n\nSe não foi você, ignore este e-mail.`,
    html: `<p>${escapeHtml(greeting)}</p>
<p>Recebemos um pedido para redefinir sua senha. O link abaixo é válido por <strong>1 hora</strong>:</p>
<p><a href="${escapeHtml(link)}">Redefinir minha senha</a></p>
<p style="color:#666">Se não foi você, ignore este e-mail.</p>`,
  }
}
