import { NextResponse } from "next/server";

import { requireAdminApiRole } from "@/lib/admin/requireAdminApiRole";
import {
  HARD_DELETE_CONFIRMATION,
  auditHardDeleteEvent,
  deleteHardDeleteStorageObjects,
  isPrelaunchHardDeleteAllowed,
  normalizeHardDeletePreview,
  parseHardDeleteRequestBody,
} from "@/lib/admin/hardDeleteTestUser";
import { getAdminServiceRoleClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleHardDeleteRequest({ requestBody: { mode: "dry_run" }, context });
}

export async function POST(request: Request, context: RouteContext) {
  const body = await request.json().catch(() => null);
  return handleHardDeleteRequest({ requestBody: body, context });
}

async function handleHardDeleteRequest({
  requestBody,
  context,
}: {
  requestBody: unknown;
  context: RouteContext;
}) {
  const auth = await requireAdminApiRole("admin_super");
  if (auth.ok !== true) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isPrelaunchHardDeleteAllowed()) {
    return NextResponse.json(
      { error: "Pre-launch hard delete is disabled in production." },
      { status: 403 }
    );
  }

  const parsed = parseHardDeleteRequestBody(requestBody as any);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { id: targetUserId } = await context.params;
  if (!isUuid(targetUserId)) {
    return NextResponse.json({ error: "Invalid target user id" }, { status: 400 });
  }

  if (targetUserId === auth.actorUser.id) {
    return NextResponse.json({ error: "You cannot hard delete your own account" }, { status: 400 });
  }

  if (parsed.mode === "execute" && parsed.confirmation !== HARD_DELETE_CONFIRMATION) {
    return NextResponse.json(
      { error: `Type ${HARD_DELETE_CONFIRMATION} to continue` },
      { status: 400 }
    );
  }

  const adminClient = getAdminServiceRoleClient();

  const { data: previewData, error: previewError } = await adminClient.rpc(
    "admin_preview_hard_delete_test_user",
    { p_target_user_id: targetUserId }
  );
  if (previewError) {
    await auditHardDeleteEvent(adminClient, {
      action: "user_hard_delete_blocked",
      actorUserId: auth.actorUser.id,
      targetUserId,
      meta: { step: "preview_rpc", error: previewError.message || "Preview failed" },
    });
    return NextResponse.json(
      { error: previewError.message || "Hard delete preview failed" },
      { status: 500 }
    );
  }

  const preview = normalizeHardDeletePreview(previewData);

  await auditHardDeleteEvent(adminClient, {
    action: "user_hard_delete_preview_requested",
    actorUserId: auth.actorUser.id,
    targetUserId,
    meta: {
      blocked: preview.blocked === true,
      block_reason: preview.block_reason || null,
      counts: preview.counts || {},
      storage_file_count: preview.storage_objects?.length || 0,
    },
  });

  if (preview.blocked || !preview.eligible) {
    const message =
      preview.block_reason ||
      "This user is not marked as fake, test, or internal. Use the normal account deletion/anonymization flow instead.";
    await auditHardDeleteEvent(adminClient, {
      action: "user_hard_delete_blocked",
      actorUserId: auth.actorUser.id,
      targetUserId,
      meta: { reason: message, counts: preview.counts || {} },
    });
    return NextResponse.json({ error: message, preview }, { status: 409 });
  }

  if (parsed.mode === "dry_run") {
    return NextResponse.json({ success: true, mode: "dry_run", preview });
  }

  await auditHardDeleteEvent(adminClient, {
    action: "user_hard_delete_started",
    actorUserId: auth.actorUser.id,
    targetUserId,
    meta: {
      counts: preview.counts || {},
      storage_file_count: preview.storage_objects?.length || 0,
    },
  });

  const { data: executeData, error: executeError } = await adminClient.rpc(
    "admin_hard_delete_test_user",
    {
      p_target_user_id: targetUserId,
      p_confirmation: HARD_DELETE_CONFIRMATION,
    }
  );
  if (executeError) {
    await auditHardDeleteEvent(adminClient, {
      action: "user_hard_delete_blocked",
      actorUserId: auth.actorUser.id,
      targetUserId,
      meta: { step: "execute_rpc", error: executeError.message || "Cleanup failed" },
    });
    return NextResponse.json(
      { error: executeError.message || "Hard delete cleanup failed" },
      { status: 500 }
    );
  }

  const executed = normalizeHardDeletePreview(executeData);
  const storageObjects = executed.storage_objects?.length
    ? executed.storage_objects
    : preview.storage_objects || [];
  const storageResult = await deleteHardDeleteStorageObjects(adminClient, storageObjects);

  if (storageResult.warnings.length) {
    await auditHardDeleteEvent(adminClient, {
      action: "user_hard_delete_storage_warning",
      actorUserId: auth.actorUser.id,
      targetUserId,
      meta: { warnings: storageResult.warnings },
    });
  }

  const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(targetUserId, false);
  if (deleteAuthError) {
    await auditHardDeleteEvent(adminClient, {
      action: "user_hard_delete_storage_warning",
      actorUserId: auth.actorUser.id,
      targetUserId,
      meta: {
        step: "delete_auth_user",
        error: deleteAuthError.message || "Auth user delete failed after database cleanup",
      },
    });
    return NextResponse.json(
      {
        error: deleteAuthError.message || "Auth user delete failed after database cleanup",
        step: "delete_auth_user",
        warnings: storageResult.warnings,
        summary: executed.counts || {},
      },
      { status: 500 }
    );
  }

  await auditHardDeleteEvent(adminClient, {
    action: "user_hard_delete_completed",
    actorUserId: auth.actorUser.id,
    targetUserId,
    meta: {
      counts: executed.counts || {},
      storage_file_count: storageObjects.length,
      storage_warnings: storageResult.warnings,
    },
  });

  return NextResponse.json({
    success: true,
    message: "Fake/test account permanently deleted.",
    summary: executed.counts || {},
    warnings: storageResult.warnings,
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
