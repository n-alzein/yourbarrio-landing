import { NextResponse } from "next/server";
import { getMediaServiceClient } from "@/lib/images/mediaAssets.server";
import { redactMediaErrorMessage } from "@/lib/images/redactMediaError";

const DEFAULT_BATCH_SIZE = 50;

function isAuthorized(request) {
  const configured = process.env.CRON_SECRET || process.env.MEDIA_CLEANUP_SECRET;
  if (!configured) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${configured}`;
}

async function removeStoragePaths(client, bucket, paths) {
  const cleanPaths = [...new Set((paths || []).filter(Boolean))];
  if (!cleanPaths.length) return;
  const { error } = await client.storage.from(bucket).remove(cleanPaths);
  if (error) {
    console.warn("[media.cleanup] storage_remove_failed", {
      bucket,
      count: cleanPaths.length,
      message: redactMediaErrorMessage(error.message || String(error)),
    });
  }
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    200,
    Math.max(1, Number(searchParams.get("limit") || DEFAULT_BATCH_SIZE) || DEFAULT_BATCH_SIZE)
  );
  const client = getMediaServiceClient();

  const { data: assets, error } = await client
    .from("media_assets")
    .select("*")
    .eq("status", "temporary")
    .lt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[media.cleanup] query_failed", {
      message: redactMediaErrorMessage(error.message || String(error)),
    });
    return NextResponse.json({ ok: false, error: "Cleanup query failed" }, { status: 500 });
  }

  for (const asset of assets || []) {
    await removeStoragePaths(client, asset.bucket, [
      asset.source_path,
      asset.original_path,
      asset.thumb_path,
      asset.card_path,
      asset.detail_path,
      asset.cover_mobile_path,
      asset.cover_desktop_path,
      asset.avatar_128_path,
      asset.avatar_256_path,
    ]);
  }

  if (assets?.length) {
    const { error: updateError } = await client
      .from("media_assets")
      .update({ status: "deleted", deleted_at: new Date().toISOString() })
      .in("id", assets.map((asset) => asset.id));
    if (updateError) {
      console.error("[media.cleanup] update_failed", {
        message: redactMediaErrorMessage(updateError.message || String(updateError)),
      });
      return NextResponse.json({ ok: false, error: "Cleanup update failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, cleaned: assets?.length || 0 });
}
