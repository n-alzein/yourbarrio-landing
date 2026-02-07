"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/admin/audit";
import {
  clearSupportModeCookies,
  getEffectiveActorAndTarget,
  readSupportModeCookies,
  validateSupportModeSession,
  IMPERSONATE_SESSION_COOKIE,
  IMPERSONATE_USER_COOKIE,
} from "@/lib/admin/supportMode";
import { clearAllAuthCookies } from "@/lib/auth/clearAuthCookies";
import { getSafeRedirectPath } from "@/lib/auth/redirects";
import { requireAdmin, requireAdminRole } from "@/lib/admin/permissions";
import { shouldUseSecureCookies } from "@/lib/http/cookiesSecurity";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getAdminDataClient } from "@/lib/supabase/admin";

function withMessage(pathname: string, type: "success" | "error", message: string) {
  const params = new URLSearchParams();
  params.set(type, message);
  return `${pathname}?${params.toString()}`;
}

const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.string().min(2).max(64),
});

export async function updateUserRoleAction(formData: FormData) {
  const admin = await requireAdminRole("admin_super");
  const parsed = updateUserRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    redirect(withMessage("/admin/users", "error", "Invalid role update payload"));
  }

  const { client } = await getAdminDataClient();
  const { error } = await client
    .from("users")
    .update({ role: parsed.data.role, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.userId);

  if (error) {
    redirect(withMessage(`/admin/users/${parsed.data.userId}`, "error", error.message));
  }

  await audit({
    action: "user_role_updated",
    targetType: "user",
    targetId: parsed.data.userId,
    actorUserId: admin.user.id,
    meta: { new_role: parsed.data.role },
  });

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  redirect(withMessage(`/admin/users/${parsed.data.userId}`, "success", "Role updated"));
}

const toggleInternalSchema = z.object({
  userId: z.string().uuid(),
  isInternal: z.enum(["true", "false"]),
});

export async function toggleUserInternalAction(formData: FormData) {
  const admin = await requireAdminRole("admin_ops");
  const parsed = toggleInternalSchema.safeParse({
    userId: formData.get("userId"),
    isInternal: formData.get("isInternal"),
  });

  if (!parsed.success) {
    redirect(withMessage("/admin/users", "error", "Invalid internal toggle payload"));
  }

  const nextValue = parsed.data.isInternal === "true";
  const { client } = await getAdminDataClient();
  const { error } = await client
    .from("users")
    .update({ is_internal: nextValue, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.userId);

  if (error) {
    redirect(withMessage(`/admin/users/${parsed.data.userId}`, "error", error.message));
  }

  await audit({
    action: "user_internal_toggled",
    targetType: "user",
    targetId: parsed.data.userId,
    actorUserId: admin.user.id,
    meta: { is_internal: nextValue },
  });

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  redirect(withMessage(`/admin/users/${parsed.data.userId}`, "success", "Internal flag updated"));
}

const internalNoteSchema = z.object({
  userId: z.string().uuid(),
  note: z.string().min(3).max(2000),
});

export async function addUserInternalNoteAction(formData: FormData) {
  const admin = await requireAdminRole("admin_support");
  const parsed = internalNoteSchema.safeParse({
    userId: formData.get("userId"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    redirect(withMessage("/admin/users", "error", "Invalid note payload"));
  }

  await audit({
    action: "user_internal_note_added",
    targetType: "user",
    targetId: parsed.data.userId,
    actorUserId: admin.user.id,
    meta: { note: parsed.data.note },
  });

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  redirect(withMessage(`/admin/users/${parsed.data.userId}`, "success", "Note logged in audit trail"));
}

const moderationCreateSchema = z.object({
  targetUserId: z.string().uuid().optional(),
  targetBusinessId: z.string().uuid().optional(),
  reason: z.string().min(3).max(500),
  details: z.string().max(3000).optional(),
});

export async function createModerationFlagAction(formData: FormData) {
  const admin = await requireAdminRole("admin_support");
  const parsed = moderationCreateSchema.safeParse({
    targetUserId: (formData.get("targetUserId") || "").toString() || undefined,
    targetBusinessId: (formData.get("targetBusinessId") || "").toString() || undefined,
    reason: formData.get("reason"),
    details: (formData.get("details") || "").toString() || undefined,
  });

  if (!parsed.success) {
    redirect(withMessage("/admin/moderation", "error", "Invalid moderation payload"));
  }

  const { client } = await getAdminDataClient();
  const payload = {
    created_by_user_id: admin.user.id,
    target_user_id: parsed.data.targetUserId || null,
    target_business_id: parsed.data.targetBusinessId || null,
    reason: parsed.data.reason,
    details: parsed.data.details || null,
    status: "open",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("moderation_flags")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    redirect(withMessage("/admin/moderation", "error", error.message));
  }

  await audit({
    action: "moderation_flag_created",
    targetType: "moderation_flag",
    targetId: data.id,
    actorUserId: admin.user.id,
    meta: payload,
  });

  revalidatePath("/admin/moderation");
  redirect(withMessage("/admin/moderation", "success", "Moderation flag created"));
}

const moderationUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "triaged", "resolved", "dismissed"]),
  adminNotes: z.string().max(2000).optional(),
});

export async function updateModerationFlagAction(formData: FormData) {
  const admin = await requireAdminRole("admin_support");
  const parsed = moderationUpdateSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    adminNotes: (formData.get("adminNotes") || "").toString() || undefined,
  });

  if (!parsed.success) {
    redirect(withMessage("/admin/moderation", "error", "Invalid moderation update payload"));
  }

  const { client } = await getAdminDataClient();
  const patch = {
    status: parsed.data.status,
    admin_notes: parsed.data.adminNotes || null,
    reviewed_by_user_id: admin.user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await client.from("moderation_flags").update(patch).eq("id", parsed.data.id);

  if (error) {
    redirect(withMessage("/admin/moderation", "error", error.message));
  }

  await audit({
    action: "moderation_flag_updated",
    targetType: "moderation_flag",
    targetId: parsed.data.id,
    actorUserId: admin.user.id,
    meta: patch,
  });

  revalidatePath("/admin/moderation");
  redirect(withMessage("/admin/moderation", "success", "Moderation flag updated"));
}

const supportCreateSchema = z.object({
  requesterUserId: z.string().uuid().optional(),
  subject: z.string().min(3).max(300),
  body: z.string().max(3000).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

export async function createSupportTicketAction(formData: FormData) {
  const admin = await requireAdminRole("admin_support");
  const parsed = supportCreateSchema.safeParse({
    requesterUserId: (formData.get("requesterUserId") || "").toString() || undefined,
    subject: formData.get("subject"),
    body: (formData.get("body") || "").toString() || undefined,
    priority: formData.get("priority") || "normal",
  });

  if (!parsed.success) {
    redirect(withMessage("/admin/support", "error", "Invalid support ticket payload"));
  }

  const { client } = await getAdminDataClient();
  const payload = {
    requester_user_id: parsed.data.requesterUserId || null,
    subject: parsed.data.subject,
    body: parsed.data.body || null,
    priority: parsed.data.priority,
    status: "open",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client.from("support_tickets").insert(payload).select("id").single();

  if (error) {
    redirect(withMessage("/admin/support", "error", error.message));
  }

  await audit({
    action: "support_ticket_created",
    targetType: "support_ticket",
    targetId: data.id,
    actorUserId: admin.user.id,
    meta: payload,
  });

  revalidatePath("/admin/support");
  redirect(withMessage("/admin/support", "success", "Support ticket created"));
}

const supportUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "pending", "resolved", "closed"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  assignedAdminUserId: z.string().uuid().optional(),
  adminNotes: z.string().max(2000).optional(),
});

export async function updateSupportTicketAction(formData: FormData) {
  const admin = await requireAdminRole("admin_support");
  const parsed = supportUpdateSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    assignedAdminUserId: (formData.get("assignedAdminUserId") || "").toString() || undefined,
    adminNotes: (formData.get("adminNotes") || "").toString() || undefined,
  });

  if (!parsed.success) {
    redirect(withMessage("/admin/support", "error", "Invalid support update payload"));
  }

  const { client } = await getAdminDataClient();
  const resolvedAt = parsed.data.status === "resolved" || parsed.data.status === "closed"
    ? new Date().toISOString()
    : null;

  const patch = {
    status: parsed.data.status,
    priority: parsed.data.priority,
    assigned_admin_user_id: parsed.data.assignedAdminUserId || null,
    admin_notes: parsed.data.adminNotes || null,
    resolved_at: resolvedAt,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client.from("support_tickets").update(patch).eq("id", parsed.data.id);

  if (error) {
    redirect(withMessage("/admin/support", "error", error.message));
  }

  await audit({
    action: "support_ticket_updated",
    targetType: "support_ticket",
    targetId: parsed.data.id,
    actorUserId: admin.user.id,
    meta: patch,
  });

  revalidatePath("/admin/support");
  redirect(withMessage("/admin/support", "success", "Support ticket updated"));
}

const startImpersonationSchema = z.object({
  targetUserId: z.string().uuid(),
  minutes: z.coerce.number().int().min(1).max(480).default(30),
  reason: z.string().min(3).max(500),
});

export async function startImpersonationAction(formData: FormData) {
  const admin = await requireAdminRole("admin_support");
  const parsed = startImpersonationSchema.safeParse({
    targetUserId: formData.get("targetUserId"),
    minutes: formData.get("minutes") || 30,
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    redirect(withMessage("/admin/impersonation", "error", "Invalid impersonation payload"));
  }

  const { client } = await getAdminDataClient();
  const { data, error } = await client.rpc("create_impersonation_session", {
    target_user_id: parsed.data.targetUserId,
    minutes: parsed.data.minutes,
    reason: parsed.data.reason,
    meta: {
      source: "admin_ui",
      actor_user_id: admin.user.id,
    },
  });

  if (error || !data) {
    redirect(withMessage("/admin/impersonation", "error", error?.message || "Failed to create session"));
  }

  const secure = await shouldUseSecureCookies();
  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATE_USER_COOKIE, parsed.data.targetUserId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: parsed.data.minutes * 60,
  });
  cookieStore.set(IMPERSONATE_SESSION_COOKIE, data, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: parsed.data.minutes * 60,
  });

  revalidatePath("/admin");
  redirect(withMessage("/admin/impersonation", "success", "Support mode started"));
}

const stopImpersonationSchema = z.object({
  sessionId: z.string().uuid().optional(),
  returnTo: z.string().optional(),
});

export async function stopImpersonationAction(formData?: FormData) {
  const admin = await requireAdmin();
  const cookieState = await readSupportModeCookies();
  const sessionIdFromCookie = cookieState.sessionId || undefined;
  const targetUserFromCookie = cookieState.targetUserId || undefined;

  const parsed = stopImpersonationSchema.safeParse({
    sessionId: formData?.get("sessionId") || sessionIdFromCookie || undefined,
    returnTo: (formData?.get("returnTo") || "").toString() || undefined,
  });

  const safeReturnTo = getSafeRedirectPath(parsed.success ? parsed.data.returnTo : null) || "/admin";

  if (!parsed.success || !parsed.data.sessionId) {
    await clearSupportModeCookies();
    redirect(withMessage(safeReturnTo, "error", "No active support mode found"));
  }

  const { client } = await getAdminDataClient();
  const endedAt = new Date().toISOString();
  const { error } = await client
    .from("admin_impersonation_sessions")
    .update({ active: false, ended_at: endedAt })
    .eq("id", parsed.data.sessionId)
    .eq("actor_user_id", admin.user.id);

  await clearSupportModeCookies();

  if (!error) {
    await audit({
      action: "impersonation_stop",
      targetType: "user",
      targetId: targetUserFromCookie || null,
      actorUserId: admin.user.id,
      meta: { session_id: parsed.data.sessionId, ended_at: endedAt },
    });
  }

  revalidatePath("/admin");
  redirect(withMessage(safeReturnTo, error ? "error" : "success", error ? error.message : "Support mode stopped"));
}

export async function goToImpersonatedHomeAction() {
  const diagEnabled = String(process.env.NEXT_PUBLIC_AUTH_DIAG || "") === "1";
  const admin = await requireAdmin({
    unauthenticatedRedirectTo: "/signin?modal=signin&next=/admin",
    unauthorizedRedirectTo: "/not-authorized",
  });
  const cookieState = await readSupportModeCookies();
  const secure = await shouldUseSecureCookies();
  if (diagEnabled) {
    console.warn("[AUTH_DIAG] goToImpersonatedHome:cookies", {
      actorUserId: admin.user.id,
      hasSessionCookie: Boolean(cookieState.sessionId),
      hasTargetCookie: Boolean(cookieState.targetUserId),
      secure,
    });
  }

  const session = await validateSupportModeSession(admin.user.id);
  if (!session.ok) {
    const reasonParam = diagEnabled ? `&reason=${encodeURIComponent(session.reason)}` : "";
    if (diagEnabled) {
      console.warn("[AUTH_DIAG] goToImpersonatedHome:no_support_mode", {
        actorUserId: admin.user.id,
        reason: session.reason,
        sessionId: session.sessionId,
        targetUserId: session.targetUserId,
      });
    }
    redirect(`/admin/impersonation?error=no-support-mode${reasonParam}`);
  }

  const resolved = await getEffectiveActorAndTarget(admin.user.id);
  if (!resolved.supportMode) {
    const reasonParam = diagEnabled ? `&reason=${encodeURIComponent(resolved.reason)}` : "";
    redirect(`/admin/impersonation?error=no-support-mode${reasonParam}`);
  }

  if (resolved.targetRole === "business") {
    redirect("/business/dashboard");
  }
  if (resolved.targetRole === "customer") {
    redirect("/customer/home");
  }
  redirect("/admin/impersonation?error=missing-target-role");
}

export async function adminLogoutAction() {
  await requireAdmin({
    unauthenticatedRedirectTo: "/",
    unauthorizedRedirectTo: "/",
  });

  const supabase = await getSupabaseServerClient();
  await supabase?.auth?.signOut();
  await clearAllAuthCookies();
  revalidatePath("/");
  redirect("/?signedout=1");
}

/*
MANUAL REGRESSION CHECKLIST
1) Start support mode for customer target, click \"Go to user home\", confirm /customer/home loads.
2) Start support mode for business target, click \"Go to user home\", confirm /business/dashboard loads.
3) Click admin logout once, confirm redirect to /?signedout=1 with public navbar and no avatar.
4) Refresh / and revisit protected routes, confirm session is fully cleared.
*/
