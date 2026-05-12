import "server-only";

import { logAdminAction } from "@/lib/admin/audit";

export const HARD_DELETE_CONFIRMATION = "HARD DELETE USER";

export type HardDeleteMode = "dry_run" | "execute";

export type HardDeleteRequestBody = {
  mode?: unknown;
  confirmation?: unknown;
};

export type HardDeleteStorageObject = {
  bucket: string;
  path: string;
};

export type HardDeletePreview = {
  eligible?: boolean;
  blocked?: boolean;
  block_reason?: string | null;
  counts?: Record<string, number>;
  storage_objects?: HardDeleteStorageObject[];
  warnings?: string[];
};

type SupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: any }>;
  storage: {
    from: (bucket: string) => {
      remove: (paths: string[]) => Promise<{ data?: unknown; error: any }>;
    };
  };
};

export function parseHardDeleteRequestBody(body: HardDeleteRequestBody | null): {
  mode: HardDeleteMode;
  confirmation: string;
} | null {
  const mode = body?.mode === "execute" ? "execute" : body?.mode === "dry_run" ? "dry_run" : null;
  if (!mode) return null;

  return {
    mode,
    confirmation: typeof body?.confirmation === "string" ? body.confirmation : "",
  };
}

export function isPrelaunchHardDeleteAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return String(process.env.ALLOW_PRELAUNCH_HARD_DELETE || "").toLowerCase() === "true";
}

export function normalizeHardDeletePreview(data: unknown): HardDeletePreview {
  const value = data && typeof data === "object" ? (data as Record<string, any>) : {};
  const rawCounts = value.counts && typeof value.counts === "object" ? value.counts : {};
  const counts = Object.fromEntries(
    Object.entries(rawCounts).map(([key, count]) => [key, Number(count) || 0])
  );

  const storageObjects = Array.isArray(value.storage_objects)
    ? value.storage_objects
        .map((item: any) => ({
          bucket: String(item?.bucket || "").trim(),
          path: String(item?.path || "").trim(),
        }))
        .filter((item) => item.bucket && item.path)
    : [];

  return {
    eligible: value.eligible === true,
    blocked: value.blocked === true,
    block_reason: typeof value.block_reason === "string" ? value.block_reason : null,
    counts,
    storage_objects: storageObjects,
    warnings: Array.isArray(value.warnings) ? value.warnings.map(String) : [],
  };
}

export async function deleteHardDeleteStorageObjects(
  client: SupabaseLike,
  storageObjects: HardDeleteStorageObject[]
) {
  const byBucket = new Map<string, string[]>();
  for (const item of storageObjects) {
    const bucket = item.bucket.trim();
    const path = item.path.trim();
    if (!bucket || !path) continue;
    const paths = byBucket.get(bucket) || [];
    if (!paths.includes(path)) paths.push(path);
    byBucket.set(bucket, paths);
  }

  const warnings: string[] = [];
  for (const [bucket, paths] of byBucket.entries()) {
    const { error } = await client.storage.from(bucket).remove(paths);
    if (error) {
      warnings.push(
        `Storage cleanup failed for ${bucket}: ${error.message || "unknown storage error"}`
      );
    }
  }

  return { warnings, deletedObjectCount: storageObjects.length };
}

export async function auditHardDeleteEvent(
  client: { rpc: SupabaseLike["rpc"] },
  params: {
    action: string;
    actorUserId: string;
    targetUserId: string;
    meta?: Record<string, unknown>;
  }
) {
  return logAdminAction(client, {
    action: params.action,
    actorUserId: params.actorUserId,
    targetType: "user",
    targetId: params.targetUserId,
    meta: params.meta || {},
  });
}
