import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";

export async function POST(request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  if (!rateLimit(ip)) {
    return new Response("Too many requests", { status: 429 });
  }

  const data = await request.json();
  const { name, email, message } = data;

  await sendEmail({
    to: "your-email@gmail.com",
    subject: "New Contact Submission",
    html: `
      <p>Name: ${name}</p>
      <p>Email: ${email}</p>
      <p>${message}</p>
    `
  });

  return Response.json({ success: true });
}
