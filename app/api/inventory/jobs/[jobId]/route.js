import { NextResponse } from "next/server";
import { getSupabaseServerClient, getUserCached } from "@/lib/supabaseServer";
import { perfLog, perfTimer } from "@/lib/perf";

const allowedFields = new Set([
  "inventory_status",
  "inventory_quantity",
  "low_stock_threshold",
]);

function sanitizeUpdates(updates) {
  if (!updates || typeof updates !== "object") return {};
  return Object.keys(updates).reduce((acc, key) => {
    if (allowedFields.has(key)) {
      acc[key] = updates[key];
    }
    return acc;
  }, {});
}

async function getJobForUser(supabase, jobId, userId) {
  const { data, error } = await supabase
    .from("inventory_jobs")
    .select(
      "id, business_id, listing_id, status, progress, error, payload, created_at, updated_at, started_at, completed_at"
    )
    .eq("id", jobId)
    .eq("business_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

function resolveJobId(params, request) {
  const paramId = params?.jobId;
  if (paramId && typeof paramId === "string") return paramId;
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || null;
}

export async function GET(request, { params }) {
  const supabase = await getSupabaseServerClient();
  const { user, error: userError } = await getUserCached(supabase);

  if (userError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const jobId = resolveJobId(params, request);
  if (
    !jobId ||
    typeof jobId !== "string" ||
    jobId === "undefined" ||
    jobId === "null"
  ) {
    return NextResponse.json({ error: "missing_job_id" }, { status: 400 });
  }

  try {
    const job = await getJobForUser(supabase, jobId, user.id);
    if (!job) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (err) {
    perfLog("inventory job fetch failed", err);
    return NextResponse.json(
      {
        error: "job_fetch_failed",
        details: err?.message || "Unknown error",
        code: err?.code || null,
      },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  const supabase = await getSupabaseServerClient();
  const { user, error: userError } = await getUserCached(supabase);

  if (userError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const jobId = resolveJobId(params, request);
  if (
    !jobId ||
    typeof jobId !== "string" ||
    jobId === "undefined" ||
    jobId === "null"
  ) {
    return NextResponse.json({ error: "missing_job_id" }, { status: 400 });
  }

  const stopTimer = perfTimer("inventory_job_run");
  try {
    const job = await getJobForUser(supabase, jobId, user.id);
    if (!job) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (job.status === "succeeded" || job.status === "running") {
      return NextResponse.json({ job });
    }

    const now = new Date().toISOString();
    const { error: startError } = await supabase
      .from("inventory_jobs")
      .update({
        status: "running",
        progress: 20,
        error: null,
        started_at: now,
        updated_at: now,
      })
      .eq("id", job.id);

    if (startError) {
      perfLog("inventory job start failed", startError);
      return NextResponse.json({ error: "job_start_failed" }, { status: 500 });
    }

    const updates = sanitizeUpdates(job.payload);
    const listingUpdates = {
      ...updates,
      inventory_last_updated_at: now,
    };

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .update(listingUpdates)
      .eq("id", job.listing_id)
      .eq("business_id", user.id)
      .select(
        "id, inventory_status, inventory_quantity, low_stock_threshold, inventory_last_updated_at"
      )
      .single();

    if (listingError) {
      perfLog("inventory job listing update failed", listingError);
      await supabase
        .from("inventory_jobs")
        .update({
          status: "failed",
          progress: 100,
          error: listingError.message || "listing_update_failed",
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return NextResponse.json({
        job: {
          ...job,
          status: "failed",
          error: listingError.message || "listing_update_failed",
        },
      });
    }

    const completedAt = new Date().toISOString();
    const { data: finishedJob } = await supabase
      .from("inventory_jobs")
      .update({
        status: "succeeded",
        progress: 100,
        error: null,
        updated_at: completedAt,
        completed_at: completedAt,
      })
      .eq("id", job.id)
      .select(
        "id, business_id, listing_id, status, progress, error, created_at, updated_at, started_at, completed_at"
      )
      .single();

    return NextResponse.json({ job: finishedJob, listing });
  } catch (err) {
    perfLog("inventory job run failed", err);
    return NextResponse.json(
      {
        error: "job_run_failed",
        details: err?.message || "Unknown error",
        code: err?.code || null,
      },
      { status: 500 }
    );
  } finally {
    stopTimer();
  }
}
