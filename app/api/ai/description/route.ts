import "server-only";

import { NextRequest, NextResponse } from "next/server";
import {
  AI_DESCRIPTION_DAILY_LIMIT,
  AI_DESCRIPTION_DAILY_LIMIT_MESSAGE,
  AI_DESCRIPTION_TARGET_DAILY_LIMIT,
  estimateAiDescriptionCostCents,
  getBusinessDayWindow,
  isUuid,
  isValidAiDescriptionAction,
  isValidAiDescriptionSurface,
} from "@/lib/ai/descriptionUsage";
import { getBusinessDataClientForRequest } from "@/lib/business/getBusinessDataClientForRequest";
import { getSupabaseServerClient as getServiceRoleClient } from "@/lib/supabase/server";

type AssistantAction =
  | "generate"
  | "regenerate"
  | "shorter"
  | "more_premium"
  | "more_casual"
  | "add_details";
type AssistantType = "business" | "listing";
type AssistantSurface = "onboarding" | "listing-editor" | "business-profile";

type RequestBody = {
  type?: AssistantType;
  name?: string;
  category?: string;
  surface?: AssistantSurface;
  targetId?: string;
  action?: AssistantAction;
  existingDescription?: string;
  currentSuggestion?: string;
};

type CountUsageForDayOptions = {
  businessId: string;
  surface?: AssistantSurface | null;
  targetId?: string | null;
  dayStartIso: string;
  dayEndIso: string;
};

// Description generation is a low-cost writing task, so default to a small model
// unless an explicit override is configured for this route.
const DEFAULT_DESCRIPTION_ASSISTANT_MODEL = "gpt-5.4-nano";
const FRIENDLY_AI_ERROR_MESSAGE = "AI suggestion unavailable right now. Please try again later.";

function clean(value: unknown) {
  return String(value || "").trim();
}

function extractTextCandidate(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const nestedValue = (value as { value?: unknown }).value;
    if (typeof nestedValue === "string") return nestedValue.trim();
  }
  return "";
}

function getSanitizedOpenAIResponseShape(payload: unknown) {
  const safePayload = payload && typeof payload === "object" ? payload as {
    output_text?: unknown;
    output?: unknown;
    usage?: unknown;
    error?: unknown;
  } : null;
  const output = Array.isArray(safePayload?.output) ? safePayload.output : [];

  return {
    hasOutputText: Boolean(extractTextCandidate(safePayload?.output_text)),
    outputLength: output.length,
    outputTypes: output.slice(0, 5).map((item) =>
      item && typeof item === "object" ? String((item as { type?: unknown }).type || "unknown") : typeof item
    ),
    contentTypes: output.slice(0, 5).flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const content = Array.isArray((item as { content?: unknown }).content)
        ? (item as { content: unknown[] }).content
        : [];
      return content.slice(0, 5).map((contentItem) =>
        contentItem && typeof contentItem === "object"
          ? String((contentItem as { type?: unknown }).type || "unknown")
          : typeof contentItem
      );
    }),
    hasUsage: Boolean(safePayload?.usage),
    hasError: Boolean(safePayload?.error),
  };
}

function extractOpenAIResponseText(payload: unknown): string {
  const safePayload = payload && typeof payload === "object" ? payload as {
    output_text?: unknown;
    output?: unknown;
  } : null;
  const outputText = extractTextCandidate(safePayload?.output_text);
  if (outputText) return outputText;

  const output = Array.isArray(safePayload?.output) ? safePayload.output : [];
  for (const outputItem of output) {
    if (!outputItem || typeof outputItem !== "object") continue;
    const content = Array.isArray((outputItem as { content?: unknown }).content)
      ? (outputItem as { content: unknown[] }).content
      : [];
    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") continue;
      const directText = extractTextCandidate((contentItem as { text?: unknown }).text);
      if (directText) return directText;
      const nestedText = extractTextCandidate(
        (contentItem as { content?: { text?: unknown } }).content?.text
      );
      if (nestedText) return nestedText;
    }
  }

  console.error("[ai-description] missing_response_text", {
    responseShape: getSanitizedOpenAIResponseShape(payload),
  });
  throw new Error("OpenAI description response did not include any extractable text.");
}

function buildActionInstruction(action: AssistantAction, hasExistingDescription: boolean) {
  switch (action) {
    case "shorter":
      return "Rewrite the suggestion so it is meaningfully shorter while keeping the strongest selling points.";
    case "more_premium":
      return "Rewrite the suggestion so it feels more premium, polished, and elevated without sounding generic or overhyped.";
    case "more_casual":
      return "Rewrite the suggestion so it feels warmer, more casual, and more conversational while staying polished and specific.";
    case "add_details":
      return "Rewrite the suggestion with a bit more concrete detail and texture while keeping it concise and customer-facing.";
    case "regenerate":
      return hasExistingDescription
        ? "Generate a distinctly different alternative that still stays faithful to the business or listing details."
        : "Generate a distinctly different alternative from your previous attempt.";
    case "generate":
    default:
      return hasExistingDescription
        ? "Improve the existing description while preserving its core facts and intent."
        : "Draft a fresh description from scratch.";
  }
}

function buildUserPrompt(body: Required<Pick<RequestBody, "type" | "surface">> & RequestBody) {
  const existingDescription = clean(body.existingDescription);
  const currentSuggestion = clean(body.currentSuggestion);
  const hasExistingDescription = Boolean(existingDescription);
  const subject = body.type === "listing" ? "listing" : "business";
  const lines = [
    `Subject type: ${subject}`,
    `Context: ${body.surface}`,
    `Name: ${clean(body.name) || "Unknown"}`,
    `Category: ${clean(body.category) || "Unknown"}`,
    `Task: ${buildActionInstruction(body.action || "generate", hasExistingDescription)}`,
    "Return plain text only.",
    "Do not use markdown, quotation marks around the whole response, or bullet points.",
    "Keep it concise, specific, and customer-facing.",
  ];

  if (existingDescription) {
    lines.push(`Existing description:\n${existingDescription}`);
  }

  if (currentSuggestion) {
    lines.push(`Current suggestion:\n${currentSuggestion}`);
  }

  if (body.type === "listing") {
    lines.push("Length target: 2 to 4 short sentences.");
    lines.push("Mention concrete product details, fit, materials, flavor, use case, or standout qualities when possible.");
  } else {
    lines.push("Length target: 2 to 4 short sentences.");
    lines.push("Highlight what makes the business distinct, what customers can expect, and the overall vibe.");
  }

  return lines.join("\n\n");
}

async function countUsageForDay(client, {
  businessId,
  surface,
  targetId,
  dayStartIso,
  dayEndIso,
}: CountUsageForDayOptions) {
  let query = client
    .from("ai_description_usage")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", dayStartIso)
    .lt("created_at", dayEndIso);

  if (surface) {
    query = query.eq("surface", surface);
  }
  if (targetId) {
    query = query.eq("target_id", targetId);
  }

  const { count, error } = await query;
  return { count: Number(count || 0), error };
}

export async function POST(request: NextRequest) {
  const access = await getBusinessDataClientForRequest({
    includeEffectiveProfile: false,
    ensureVendorMembership: false,
    timingLabel: "ai-description",
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const apiKey = clean(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI description assistant is not configured." },
      { status: 500 }
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) || {};
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const type =
    body.type === "listing" ? "listing" : body.type === "business" ? "business" : null;
  const surface = isValidAiDescriptionSurface(body.surface) ? body.surface : null;
  const action = isValidAiDescriptionAction(body.action) ? body.action : null;
  const targetId = clean(body.targetId);

  if (!type || !surface || !action) {
    return NextResponse.json({ error: "Invalid assistant request." }, { status: 400 });
  }

  if (targetId && !isUuid(targetId)) {
    return NextResponse.json({ error: "Invalid assistant target." }, { status: 400 });
  }

  const dayWindow = getBusinessDayWindow();
  const [businessUsage, targetUsage] = await Promise.all([
    countUsageForDay(access.client, {
      businessId: access.businessId,
      dayStartIso: dayWindow.startIso,
      dayEndIso: dayWindow.endIso,
    }),
    targetId
      ? countUsageForDay(access.client, {
          businessId: access.businessId,
          targetId,
          dayStartIso: dayWindow.startIso,
          dayEndIso: dayWindow.endIso,
        })
      : Promise.resolve({ count: 0, error: null }),
  ]);

  if (businessUsage.error || targetUsage.error) {
    console.warn("[ai-description] usage_limit_check_failed", {
      businessId: access.businessId,
      userId: access.effectiveUserId,
      businessError: businessUsage.error?.message || null,
      targetError: targetUsage.error?.message || null,
    });
    return NextResponse.json(
      { error: FRIENDLY_AI_ERROR_MESSAGE },
      { status: 500 }
    );
  }

  if (businessUsage.count >= AI_DESCRIPTION_DAILY_LIMIT) {
    return NextResponse.json(
      { error: AI_DESCRIPTION_DAILY_LIMIT_MESSAGE },
      { status: 429 }
    );
  }

  if (targetId && targetUsage.count >= AI_DESCRIPTION_TARGET_DAILY_LIMIT) {
    return NextResponse.json(
      { error: AI_DESCRIPTION_DAILY_LIMIT_MESSAGE },
      { status: 429 }
    );
  }

  try {
    const model =
      clean(process.env.OPENAI_DESCRIPTION_ASSISTANT_MODEL) ||
      DEFAULT_DESCRIPTION_ASSISTANT_MODEL;
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions:
          "You write concise, specific marketplace descriptions for small local businesses and listings. Keep claims grounded in provided details.",
        input: buildUserPrompt({
          ...body,
          type,
          surface,
          action,
        }),
      }),
    });

    const payload = await upstream.json().catch((error) => {
      throw new Error(
        `Failed to parse OpenAI response JSON: ${error instanceof Error ? error.message : "unknown error"}`
      );
    });
    const description = extractOpenAIResponseText(payload);
    const promptTokens = Number(payload?.usage?.input_tokens);
    const completionTokens = Number(payload?.usage?.output_tokens);
    const totalTokens = Number(payload?.usage?.total_tokens);

    if (!upstream.ok) {
      throw new Error(
        `OpenAI description request failed with status ${upstream.status}: ${
          clean(payload?.error?.message) || "unknown upstream error"
        }`
      );
    }

    const serviceClient = getServiceRoleClient();
    if (!serviceClient) {
      console.warn("[ai-description] usage_log_skipped_missing_service_client", {
        businessId: access.businessId,
        userId: access.effectiveUserId,
      });
    } else {
      const { error: usageInsertError } = await serviceClient
        .from("ai_description_usage")
        .insert({
          business_id: access.businessId,
          user_id: access.effectiveUserId,
          surface,
          target_id: targetId || null,
          action,
          model,
          prompt_tokens: Number.isFinite(promptTokens) ? promptTokens : null,
          completion_tokens: Number.isFinite(completionTokens) ? completionTokens : null,
          total_tokens: Number.isFinite(totalTokens) ? totalTokens : null,
          estimated_cost_cents: estimateAiDescriptionCostCents({
            model,
            promptTokens,
            completionTokens,
          }),
        });

      if (usageInsertError) {
        console.warn("[ai-description] usage_log_failed", {
          businessId: access.businessId,
          userId: access.effectiveUserId,
          message: usageInsertError.message || null,
          code: usageInsertError.code || null,
        });
      }
    }

    return NextResponse.json({ description }, { status: 200 });
  } catch (error) {
    console.error("[ai-description] generation_failed", {
      businessId: access.businessId,
      userId: access.effectiveUserId,
      error,
    });
    return NextResponse.json(
      { error: FRIENDLY_AI_ERROR_MESSAGE },
      { status: 500 }
    );
  }
}
