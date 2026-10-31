import type { EmailMessage } from './email.service';

export type EmailLocale = 'en' | 'ar';
type Built = Omit<EmailMessage, 'to'>;

// design.md tokens and the illustration kit (screens/shared/illustration.css): sand canvas, ink-outlined white paper, terracotta action.
const INK = '#18181B';
const BRAND = '#C2410C';
const CANVAS = '#EBDFD7';
const SOFT = '#FBEDE2';
const MUTED = '#52525B';

/** Everything that comes from a person (names, messages) is escaped before it goes into HTML. */
export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Subjects are one line: no line breaks, bounded length. */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim().slice(0, 80);

/** A Latin name inside Arabic text (or the reverse) keeps its own direction, so quotes and punctuation stay where they belong. */
const isolate = (s: string) => String.fromCharCode(0x2068) + s + String.fromCharCode(0x2069); // FSI ... PDI

/** Email clients cannot show SVG, so the logo and scenes are PNGs served by the web app (frontend/public/email). */
const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

type Scene = 'verify' | 'reset' | 'invite';

interface Layout {
  locale: EmailLocale;
  title: string;
  preheader: string;
  heading: string;
  /** Already-safe HTML. */
  body: string;
  scene?: Scene;
  code?: string;
  button?: { label: string; url: string; fallback?: string };
  footer: string;
}

function layout({ locale, title, preheader, heading, body, scene, code, button, footer }: Layout): string {
  const rtl = locale === 'ar';
  const align = rtl ? 'right' : 'left';
  const font = rtl ? `'IBM Plex Sans Arabic',Tahoma,'Segoe UI',Arial,sans-serif` : `'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif`;
  const app = appUrl();
  const sentBy = rtl ? 'مرسلة من Veyro' : 'Sent by Veyro';
  return `<!doctype html>
<html lang="${locale}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&amp;family=IBM+Plex+Sans+Arabic:wght@400;600;700&amp;display=swap" rel="stylesheet">
<style>@media (max-width:600px){.v-pad{padding:24px 20px!important}.v-code{font-size:30px!important;letter-spacing:8px!important}.v-h{font-size:24px!important}}</style></head>
<body style="margin:0;padding:0;background:${CANVAS};color:${INK};font-family:${font};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${CANVAS}" style="background:${CANVAS}"><tr><td align="center" style="padding:32px 12px 40px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px">
<tr><td style="padding:0 4px 18px;text-align:${align}"><a href="${escapeHtml(app)}" style="text-decoration:none;color:${INK}"><img src="${app}/email/logo.png" width="32" height="32" alt="" style="vertical-align:middle;border:0"><span style="vertical-align:middle;font-size:20px;font-weight:800;letter-spacing:-0.02em;padding:0 8px">Veyro</span></a></td></tr>
<tr><td class="v-pad" bgcolor="#FFFFFF" style="background:#FFFFFF;border:2px solid ${INK};border-radius:20px;padding:32px;text-align:${align}">
${scene ? `<img src="${app}/email/${scene}.png" width="496" alt="" style="display:block;width:100%;max-width:496px;height:auto;border:0;margin:0 0 28px">` : ''}
<h1 class="v-h" style="margin:0;font-size:28px;line-height:1.2;font-weight:800;letter-spacing:${rtl ? '0' : '-0.02em'};color:${INK}">${escapeHtml(heading)}</h1>
<div style="margin-top:12px;font-size:16px;line-height:1.6;color:${INK}">${body}</div>
${code ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td dir="ltr" class="v-code" bgcolor="${SOFT}" style="background:${SOFT};border:2px solid ${INK};border-radius:14px;padding:14px 22px 14px 32px;font-size:36px;font-weight:800;letter-spacing:12px;font-variant-numeric:tabular-nums;color:${INK};font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif">${escapeHtml(code)}</td></tr></table>` : ''}
${button ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px"><tr><td bgcolor="${BRAND}" style="background:${BRAND};border:2px solid ${INK};border-radius:999px"><a href="${escapeHtml(button.url)}" style="display:inline-block;padding:13px 26px;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none">${escapeHtml(button.label)}</a></td></tr></table>
${button.fallback ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:${MUTED}">${escapeHtml(button.fallback)}<br><a href="${escapeHtml(button.url)}" dir="ltr" style="color:${BRAND};word-break:break-all">${escapeHtml(button.url)}</a></p>` : ''}` : ''}
<p style="margin:28px 0 0;padding:14px 16px;background:${SOFT};border-radius:12px;font-size:13px;line-height:1.55;color:${MUTED}">${escapeHtml(footer)}</p>
</td></tr>
<tr><td style="padding:18px 4px 0;font-size:12px;line-height:1.5;color:${MUTED};text-align:${align}">${sentBy} · <a href="${escapeHtml(app)}" dir="ltr" style="color:${MUTED}">${escapeHtml(app.replace(/^https?:\/\//, ''))}</a></td></tr>
</table></td></tr></table></body></html>`;
}

/** Team inbox emails: same shell, no scene; the facts as a labelled list and, when there is someone to answer, a reply button. */
function teamLayout(args: { title: string; heading: string; rows: [string, string][]; message?: string; reply?: { label: string; email: string; subject: string } }): string {
  const rows = args.rows
    .map(([k, v]) => `<tr><td style="padding:5px 16px 5px 0;font-size:13px;line-height:22px;color:${MUTED};white-space:nowrap;vertical-align:baseline">${escapeHtml(k)}</td><td style="padding:5px 0;font-size:15px;line-height:22px;color:${INK};word-break:break-word;vertical-align:baseline">${escapeHtml(v)}</td></tr>`)
    .join('');
  const body = `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="${SOFT}" style="background:${SOFT};border-radius:14px"><tr><td style="padding:12px 16px"><table role="presentation" cellpadding="0" cellspacing="0">${rows}</table></td></tr></table>${
    args.message ? `<div style="margin-top:16px;padding:16px 18px;border:2px solid ${INK};border-radius:14px;font-size:15px;line-height:1.6;white-space:pre-wrap;word-break:break-word">${escapeHtml(args.message)}</div>` : ''
  }`;
  const reply = args.reply ? { label: args.reply.label, url: `mailto:${encodeURIComponent(args.reply.email)}?subject=${encodeURIComponent(args.reply.subject)}` } : undefined;
  return layout({ locale: 'en', title: args.title, preheader: args.heading, heading: args.heading, body, button: reply, footer: 'Sent to the Veyro team inbox. Replying writes to the person named above.' });
}

export function verificationEmail(code: string, locale: EmailLocale): Built {
  const t = locale === 'ar'
    ? { subject: 'رمز التحقق الخاص بك في Veyro', heading: 'أكّد بريدك الإلكتروني', body: 'استخدم هذا الرمز لإكمال إنشاء حسابك. تنتهي صلاحيته خلال 10 دقائق.', footer: 'إذا لم تنشئ حسابًا في Veyro، يمكنك تجاهل هذه الرسالة.' }
    : { subject: 'Your Veyro verification code', heading: 'Confirm your email', body: 'Use this code to finish creating your account. It expires in 10 minutes.', footer: "If you didn't create a Veyro account, you can ignore this email." };
  return { subject: t.subject, html: layout({ locale, title: t.subject, preheader: `${code} · ${t.body}`, heading: t.heading, body: escapeHtml(t.body), scene: 'verify', code, footer: t.footer }), text: `${t.heading}\n\n${t.body}\n\n${code}\n\n${t.footer}` };
}

export function passwordResetEmail(url: string, locale: EmailLocale): Built {
  const t = locale === 'ar'
    ? { subject: 'إعادة تعيين كلمة المرور في Veyro', heading: 'إعادة تعيين كلمة المرور', body: 'استخدم الزر أدناه لاختيار كلمة مرور جديدة. يعمل الرابط لمدة 15 دقيقة.', button: 'اختر كلمة مرور جديدة', fallback: 'إذا لم يعمل الزر، افتح هذا الرابط:', footer: 'إذا لم تطلب ذلك، تجاهل هذه الرسالة وستبقى كلمة مرورك كما هي.' }
    : { subject: 'Reset your Veyro password', heading: 'Reset your password', body: 'Use the button below to choose a new password. The link works for 15 minutes.', button: 'Choose a new password', fallback: "If the button doesn't work, open this link:", footer: "If you didn't ask for this, ignore this email; your password stays the same." };
  return { subject: t.subject, html: layout({ locale, title: t.subject, preheader: t.body, heading: t.heading, body: escapeHtml(t.body), scene: 'reset', button: { label: t.button, url, fallback: t.fallback }, footer: t.footer }), text: `${t.heading}\n\n${t.body}\n\n${url}\n\n${t.footer}` };
}

export function invitationEmail(args: { inviterName: string; workspaceName: string; role: 'ADMIN' | 'MEMBER'; url: string; days: number; locale: EmailLocale }): Built {
  const { url, days, locale } = args;
  const inviter = oneLine(args.inviterName);
  const workspace = oneLine(args.workspaceName);
  const role = locale === 'ar' ? (args.role === 'ADMIN' ? 'مدير' : 'عضو') : args.role === 'ADMIN' ? 'an admin' : 'a member';
  const t = locale === 'ar'
    ? { subject: `${inviter} دعاك للانضمام إلى ${workspace} على Veyro`, heading: 'تمت دعوتك', body: `دعاك ${isolate(inviter)} للانضمام إلى مساحة العمل «${isolate(workspace)}» بدور ${role}.`, button: 'قبول الدعوة', fallback: 'إذا لم يعمل الزر، افتح هذا الرابط:', footer: `تنتهي هذه الدعوة خلال ${days} أيام. إذا لم تكن تتوقعها، تجاهل هذه الرسالة.` }
    : { subject: `${inviter} invited you to ${workspace} on Veyro`, heading: "You're invited", body: `${inviter} invited you to join the workspace "${workspace}" as ${role}.`, button: 'Accept invitation', fallback: "If the button doesn't work, open this link:", footer: `This invitation expires in ${days} days. If you weren't expecting it, you can ignore this email.` };
  return { subject: t.subject, html: layout({ locale, title: t.subject, preheader: t.body, heading: t.heading, body: escapeHtml(t.body), scene: 'invite', button: { label: t.button, url, fallback: t.fallback }, footer: t.footer }), text: `${t.heading}\n\n${t.body}\n\n${url}\n\n${t.footer}` };
}

export type SignupMethod = 'email' | 'google' | 'github';
const METHOD_LABEL: Record<SignupMethod, string> = { email: 'email and password', google: 'Google', github: 'GitHub' };

/** Goes to the team inbox, always in English: one email per new account, never for a sign-in to an existing one. */
export function signupNotificationEmail(u: { name: string; email: string; method: SignupMethod }): Built {
  const subject = `[Veyro sign-up] ${oneLine(u.name)} via ${METHOD_LABEL[u.method]}`;
  const text = `A new Veyro account was created\n\nName: ${u.name}\nEmail: ${u.email}\nSigned up with: ${METHOD_LABEL[u.method]}`;
  return {
    subject,
    html: teamLayout({ title: subject, heading: 'A new account was created', rows: [['Name', u.name], ['Email', u.email], ['Signed up with', METHOD_LABEL[u.method]]], reply: { label: `Email ${oneLine(u.name)}`, email: u.email, subject: 'Welcome to Veyro' } }),
    text,
    replyTo: u.email,
  };
}

/** Goes to the team inbox, always in English. The sender's address is the reply-to, never the "from". */
export function contactNotificationEmail(m: { name: string; email: string; topic: string; message: string }): Built {
  const subject = `[Veyro contact] ${oneLine(m.topic)}: ${oneLine(m.name)}`;
  const text = `New message from the Veyro contact form\n\nName: ${m.name}\nEmail: ${m.email}\nTopic: ${m.topic}\n\n${m.message}`;
  return {
    subject,
    html: teamLayout({ title: subject, heading: 'New message from the contact form', rows: [['Name', m.name], ['Email', m.email], ['Topic', m.topic]], message: m.message, reply: { label: `Reply to ${oneLine(m.name)}`, email: m.email, subject: `Re: your message to Veyro (${oneLine(m.topic)})` } }),
    text,
    replyTo: m.email,
  };
}
