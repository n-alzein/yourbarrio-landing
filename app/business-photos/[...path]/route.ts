import { NextRequest, NextResponse } from "next/server";

const PLACEHOLDER_PATH = "/business-placeholder.png";

function getSupabasePublicStorageUrl(bucket: string, pathParts: string[]) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !pathParts.length) return null;
  const safePath = pathParts.map((part) => encodeURIComponent(part)).join("/");
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${safePath}`;
}

async function publicObjectExists(url: string) {
  try {
    const response = await fetch(url, { method: "HEAD", cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await params;
  const storageUrl = getSupabasePublicStorageUrl("business-photos", path);
  if (storageUrl && (await publicObjectExists(storageUrl))) {
    return NextResponse.redirect(storageUrl, 307);
  }
  return NextResponse.redirect(new URL(PLACEHOLDER_PATH, request.url), 307);
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await params;
  const storageUrl = getSupabasePublicStorageUrl("business-photos", path);
  if (storageUrl && (await publicObjectExists(storageUrl))) {
    return NextResponse.redirect(storageUrl, 307);
  }
  return NextResponse.redirect(new URL(PLACEHOLDER_PATH, request.url), 307);
}
