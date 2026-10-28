import type { EmailMessage } from './email.service';

export type EmailLocale = 'en' | 'ar';
type Built = Omit<EmailMessage, 'to'>;

const INK = '#18181B';
const BRAND = '#C2410C';
const CANVAS = '#EBDFD7';

/** Everything that comes from a person (names, messages) is escaped before it goes into HTML. */
export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Subjects are one line: no line breaks, bounded length. */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim().slice(0, 80);

interface Layout { locale: EmailLocale; heading: string; body: string; code?: string; button?: { label: string; url: string }; footer: string }

function layout({ locale, heading, body, code, button, footer }: Layout): string {
  const rtl = locale === 'ar';
  const align = rtl ? 'right' : 'left';
  return `<!doctype html><html lang="${locale}" dir="${rtl ? 'rtl' : 'ltr'}"><body style="margin:0;padding:24px;background:${CANVAS};font-family:Segoe UI,Tahoma,Arial,sans-serif;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px;text-align:${align}">
<tr><td style="font-size:20px;font-weight:700;color:${BRAND}">Veyro</td></tr>
<tr><td style="padding-top:20px;font-size:22px;font-weight:700">${escapeHtml(heading)}</td></tr>
<tr><td style="padding-top:12px;font-size:15px;line-height:1.6">${body}</td></tr>
${code ? `<tr><td style="padding-top:20px"><div dir="ltr" style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:8px;padding:12px 20px;background:${CANVAS};border-radius:8px">${escapeHtml(code)}</div></td></tr>` : ''}
${button ? `<tr><td style="padding-top:24px"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">${escapeHtml(button.label)}</a></td></tr>
<tr><td style="padding-top:12px;font-size:12px;color:#52525b;word-break:break-all" dir="ltr">${escapeHtml(button.url)}</td></tr>` : ''}
<tr><td style="padding-top:28px;font-size:12px;line-height:1.5;color:#52525b">${escapeHtml(footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

export function verificationEmail(code: string, locale: EmailLocale): Built {
  const t = locale === 'ar'
    ? { subject: 'رمز التحقق الخاص بك في Veyro', heading: 'أكّد بريدك الإلكتروني', body: 'استخدم هذا الرمز لإكمال إنشاء حسابك. تنتهي صلاحيته خلال 10 دقائق.', footer: 'إذا لم تنشئ حسابًا في Veyro، يمكنك تجاهل هذه الرسالة.' }
    : { subject: 'Your Veyro verification code', heading: 'Confirm your email', body: 'Use this code to finish creating your account. It expires in 10 minutes.', footer: "If you didn't create a Veyro account, you can ignore this email." };
  return { subject: t.subject, html: layout({ locale, heading: t.heading, body: escapeHtml(t.body), code, footer: t.footer }), text: `${t.heading}\n\n${t.body}\n\n${code}\n\n${t.footer}` };
}

export function passwordResetEmail(url: string, locale: EmailLocale): Built {
  const t = locale === 'ar'
    ? { subject: 'إعادة تعيين كلمة المرور في Veyro', heading: 'إعادة تعيين كلمة المرور', body: 'استخدم الزر أدناه لاختيار كلمة مرور جديدة. يعمل الرابط لمدة 15 دقيقة.', button: 'اختر كلمة مرور جديدة', footer: 'إذا لم تطلب ذلك، تجاهل هذه الرسالة وستبقى كلمة مرورك كما هي.' }
    : { subject: 'Reset your Veyro password', heading: 'Reset your password', body: 'Use the button below to choose a new password. The link works for 15 minutes.', button: 'Choose a new password', footer: "If you didn't ask for this, ignore this email; your password stays the same." };
  return { subject: t.subject, html: layout({ locale, heading: t.heading, body: escapeHtml(t.body), button: { label: t.button, url }, footer: t.footer }), text: `${t.heading}\n\n${t.body}\n\n${url}\n\n${t.footer}` };
}

export function invitationEmail(args: { inviterName: string; workspaceName: string; role: 'ADMIN' | 'MEMBER'; url: string; days: number; locale: EmailLocale }): Built {
  const { url, days, locale } = args;
  const inviter = oneLine(args.inviterName);
  const workspace = oneLine(args.workspaceName);
  const role = locale === 'ar' ? (args.role === 'ADMIN' ? 'مدير' : 'عضو') : args.role === 'ADMIN' ? 'an admin' : 'a member';
  const t = locale === 'ar'
    ? { subject: `${inviter} دعاك للانضمام إلى ${workspace} على Veyro`, heading: 'تمت دعوتك', body: `دعاك ${inviter} للانضمام إلى مساحة العمل "${workspace}" بدور ${role}.`, button: 'قبول الدعوة', footer: `تنتهي هذه الدعوة خلال ${days} أيام. إذا لم تكن تتوقعها، تجاهل هذه الرسالة.` }
    : { subject: `${inviter} invited you to ${workspace} on Veyro`, heading: "You're invited", body: `${inviter} invited you to join the workspace "${workspace}" as ${role}.`, button: 'Accept invitation', footer: `This invitation expires in ${days} days. If you weren't expecting it, you can ignore this email.` };
  return { subject: t.subject, html: layout({ locale, heading: t.heading, body: escapeHtml(t.body), button: { label: t.button, url }, footer: t.footer }), text: `${t.heading}\n\n${t.body}\n\n${url}\n\n${t.footer}` };
}

/** Goes to the team inbox, always in English. The sender's address is the reply-to, never the "from". */
export function contactNotificationEmail(m: { name: string; email: string; topic: string; message: string }): Built {
  const text = `New message from the Veyro contact form\n\nName: ${m.name}\nEmail: ${m.email}\nTopic: ${m.topic}\n\n${m.message}`;
  return {
    subject: `[Veyro contact] ${oneLine(m.topic)}: ${oneLine(m.name)}`,
    html: `<pre style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
    text,
    replyTo: m.email,
  };
}
