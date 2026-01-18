"use server";

import { NextResponse } from "next/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const callbackUrl = new URL("/api/auth/callback", request.url);
  callbackUrl.search = requestUrl.search;
  return NextResponse.redirect(callbackUrl);
}
