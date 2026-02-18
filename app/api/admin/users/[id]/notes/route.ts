import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerAuthedClient } from "@/lib/supabaseServer";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const createNoteSchema = z.object({
  note: z.string().trim().min(3).max(2000),
});

function isPermissionError(message: string, code: string | null | undefined) {
  const normalized = message.toLowerCase();
  return code === "42501" || normalized.includes("insufficient permissions") || normalized.includes("not authenticated");
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid target user id" }, { status: 400 });
  }

  const authedClient = await getSupabaseServerAuthedClient();
  if (!authedClient) {
    return NextResponse.json({ error: "Authentication client unavailable" }, { status: 500 });
  }

  const {
    data: { user },
    error: authError,
  } = await authedClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await authedClient.rpc("admin_list_user_notes", {
    p_target_user_id: parsedParams.data.id,
    p_limit: 50,
    p_offset: 0,
  });

  if (error) {
    if (isPermissionError(error.message || "", error.code)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Unable to list notes" }, { status: 500 });
  }

  return NextResponse.json({ notes: Array.isArray(data) ? data : [] });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid target user id" }, { status: 400 });
  }

  const authedClient = await getSupabaseServerAuthedClient();
  if (!authedClient) {
    return NextResponse.json({ error: "Authentication client unavailable" }, { status: 500 });
  }

  const {
    data: { user },
    error: authError,
  } = await authedClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = createNoteSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data, error } = await authedClient.rpc("admin_add_user_note", {
    p_target_user_id: parsedParams.data.id,
    p_note: parsedBody.data.note,
  });

  if (error) {
    if (isPermissionError(error.message || "", error.code)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Unable to add note" }, { status: 500 });
  }

  const note = Array.isArray(data) ? data[0] || null : data || null;
  if (!note) {
    return NextResponse.json({ error: "Unable to add note" }, { status: 500 });
  }

  return NextResponse.json({ note });
}
