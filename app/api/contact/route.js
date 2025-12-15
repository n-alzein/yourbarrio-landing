import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";

export async function POST(request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  if (!rateLimit(ip)) {
    return new Response("Too many requests", { status: 429 });
  }

  const data = await request.json();
  const { name, email, message } = data;

  const result = await sendEmail({
    to: "n.alzein@gmail.com",
    from: "YourBarrio <onboarding@resend.dev>", // temporary fallback sender
    subject: "New Contact Submission",
    html: `
      <p>Name: ${name}</p>
      <p>Email: ${email}</p>
      <p>${message}</p>
    `,
  });

  if (result?.error) {
    console.error("Send email failed", result.error);
    return Response.json({ success: false, error: "email_failed" }, { status: 500 });
  }

  return Response.json({ success: true });
}
