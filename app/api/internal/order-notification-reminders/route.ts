import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  acquireReminderWorkerLock,
  findOrdersNeedingReminderProcessing,
  reconcileStaleSmsNotifications,
  releaseReminderWorkerLock,
  sendReminderNotifications,
} from "@/lib/notifications/orders";

const requestSchema = z
  .object({
    source: z.string().trim().max(64).optional(),
    limit: z.coerce.number().int().min(1).max(250).optional(),
  })
  .optional();

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const authToken = String(process.env.ORDER_NOTIFICATION_REMINDER_TOKEN || "").trim();
  if (!authToken) {
    return NextResponse.json(
      { error: "ORDER_NOTIFICATION_REMINDER_TOKEN is missing." },
      { status: 500 }
    );
  }

  const authHeader = String(request.headers.get("authorization") || "");
  if (authHeader !== `Bearer ${authToken}`) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  const limit =
    parsed.success && parsed.data?.limit
      ? parsed.data.limit
      : Number.parseInt(process.env.ORDER_NOTIFICATION_REMINDER_BATCH_SIZE || "", 10) || 50;

  const lockAcquired = await acquireReminderWorkerLock();
  if (!lockAcquired) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: "lock_not_acquired" },
      { status: 200 }
    );
  }

  const summary = {
    scanned: 0,
    processed: 0,
    failed: 0,
    reconciled: 0,
    failures: [] as Array<{ orderId: string; error: string }>,
  };

  try {
    const candidates = await findOrdersNeedingReminderProcessing({ limit });
    summary.scanned = candidates.length;
    for (const order of candidates.slice(0, limit)) {
      const orderId = String(order?.id || "").trim();
      if (!orderId) continue;

      try {
        await sendReminderNotifications(orderId);
        summary.processed += 1;
      } catch (error: any) {
        summary.failed += 1;
        summary.failures.push({
          orderId,
          error: error?.message || "Unknown reminder failure",
        });
      }
    }

    summary.reconciled = await reconcileStaleSmsNotifications({ limit });

    return NextResponse.json({ ok: true, ...summary }, { status: 200 });
  } finally {
    await releaseReminderWorkerLock().catch(() => null);
  }
}
