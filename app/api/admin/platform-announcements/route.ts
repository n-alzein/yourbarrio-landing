import { NextResponse } from "next/server";
import { getAdminServiceRoleClient } from "@/lib/supabase/admin";
import { requireAdminApiRole, type AdminApiAuthFailure } from "@/lib/admin/requireAdminApiRole";
import { listPlatformAnnouncements } from "@/lib/notices/platform-announcements";
import { platformAnnouncementInputSchema } from "@/lib/admin/platformAnnouncementValidation";

function authFailureResponse(auth: AdminApiAuthFailure) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

export async function GET() {
  const auth = await requireAdminApiRole("admin_support");
  if (!auth.ok) return authFailureResponse(auth as AdminApiAuthFailure);

  try {
    const client = getAdminServiceRoleClient();
    const announcements = await listPlatformAnnouncements(client);
    return NextResponse.json(
      { announcements },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unable to list announcements." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApiRole("admin_ops");
  if (!auth.ok) return authFailureResponse(auth as AdminApiAuthFailure);

  const body = await request.json().catch(() => null);
  const parsed = platformAnnouncementInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid announcement payload." }, { status: 400 });
  }

  const client = getAdminServiceRoleClient();
  const payload = {
    ...parsed.data,
    created_by: auth.actorUser.id,
    updated_by: auth.actorUser.id,
  };

  const { data, error } = await client
    .from("platform_announcements")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Unable to create announcement." },
      { status: 500 }
    );
  }

  return NextResponse.json({ announcement: data }, { status: 201 });
}
