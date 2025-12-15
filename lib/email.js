import { Resend } from "resend";

let cachedClient = null;

function getClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cachedClient) {
    cachedClient = new Resend(key);
  }
  return cachedClient;
}

export async function sendEmail({ to, subject, html }) {
  const client = getClient();
  if (!client) {
    console.warn("Resend API key missing; skipping email send.");
    return { skipped: true };
  }

  return client.emails.send({
    from: "YourBarrio <no-reply@yourbarrio.com>",
    to,
    subject,
    html,
  });
}
