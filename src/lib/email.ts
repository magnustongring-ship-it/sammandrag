import "server-only";

// Skickar e-post via Resends REST-API. Utan RESEND_API_KEY och EMAIL_FROM i
// miljön hoppas utskicket över (loggas), så appen fungerar utan e-post.

type Email = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string | null;
};

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(email: Email): Promise<void> {
  if (!emailEnabled()) {
    console.info(`[e-post] Avstängt, skickar inte "${email.subject}" till ${email.to}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error(`[e-post] Resend svarade ${res.status}: ${await res.text()}`);
    }
  } catch (error) {
    console.error("[e-post] Kunde inte skicka", error);
  }
}
