import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminServiceRoleClient } from "@/lib/supabase/admin";
import { requireAdminApiRole, type AdminApiAuthFailure } from "@/lib/admin/requireAdminApiRole";
import { platformAnnouncementPatchSchema } from "@/lib/admin/platformAnnouncementValidation";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

function authFailureResponse(auth: AdminApiAuthFailure) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiRole("admin_ops");
  if (!auth.ok) return authFailureResponse(auth as AdminApiAuthFailure);

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid announcement id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = platformAnnouncementPatchSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Invalid announcement payload." }, { status: 400 });
  }

  const client = getAdminServiceRoleClient();
  const { data, error } = await client
    .from("platform_announcements")
    .update({
      ...parsed.data,
      updated_by: auth.actorUser.id,
    })
    .eq("id", parsedParams.data.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Unable to update announcement." },
      { status: 500 }
    );
  }

  return NextResponse.json({ announcement: data });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiRole("admin_super");
  if (!auth.ok) return authFailureResponse(auth as AdminApiAuthFailure);

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid announcement id." }, { status: 400 });
  }

  const client = getAdminServiceRoleClient();
  const { error } = await client
    .from("platform_announcements")
    .delete()
    .eq("id", parsedParams.data.id);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Unable to delete announcement." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
