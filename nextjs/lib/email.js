import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({ to, subject, html }) {
  return resend.emails.send({
    from: "YourBarrio <no-reply@yourbarrio.com>",
    to,
    subject,
    html
  });
}
