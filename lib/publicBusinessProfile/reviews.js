const REVIEW_SELECT_BASE =
  "id,business_id,customer_id,rating,title,body,created_at,business_reply,business_reply_at";

const REVIEW_SELECT_WITH_UPDATED = `${REVIEW_SELECT_BASE},updated_at`;

const REVIEW_AUTHOR_SELECT_BASE = "user_id,display_name";
const REVIEW_AUTHOR_SELECT_WITH_AVATAR = `${REVIEW_AUTHOR_SELECT_BASE},avatar_url`;
const REVIEW_AUTHOR_SELECT_LEGACY_NAME = "user_id,full_name";
const REVIEW_AUTHOR_SELECT_LEGACY_NAME_WITH_PHOTO = `${REVIEW_AUTHOR_SELECT_LEGACY_NAME},profile_photo_url`;
const REVIEW_AUTHOR_SELECT_ID_BASE = "id,display_name";
const REVIEW_AUTHOR_SELECT_ID_WITH_AVATAR = `${REVIEW_AUTHOR_SELECT_ID_BASE},avatar_url`;
const REVIEW_AUTHOR_SELECT_ID_LEGACY_NAME = "id,full_name";
const REVIEW_AUTHOR_SELECT_ID_LEGACY_NAME_WITH_PHOTO = `${REVIEW_AUTHOR_SELECT_ID_LEGACY_NAME},profile_photo_url`;

function asTrimmedString(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

function asAuthorProfile(value) {
  if (!value || typeof value !== "object") return null;
  const normalized = {
    ...value,
    user_id: asTrimmedString(value.user_id) || asTrimmedString(value.id),
    display_name:
      asTrimmedString(value.display_name) ||
      asTrimmedString(value.full_name) ||
      asTrimmedString(value.name),
    avatar_url:
      asTrimmedString(value.avatar_url) ||
      asTrimmedString(value.profile_photo_url) ||
      asTrimmedString(value.photo_url),
  };
  if (!normalized.user_id && !normalized.display_name && !normalized.avatar_url) {
    return null;
  }
  return normalized;
}

export function formatReviewer(id) {
  if (!id) return "Customer";
  return `Customer ${String(id).slice(0, 6)}`;
}

export function isMissingColumnError(error) {
  if (!error) return false;
  if (error?.code === "42703") return true;
  return /column "([^"]+)" does not exist/i.test(error?.message || "");
}

function extractProfileRow(row) {
  return asAuthorProfile(row);
}

async function queryReviewAuthorProfiles(client, ids, selectClause) {
  const result = await client
    .from("user_public_profiles")
    .select(selectClause)
    .in(selectClause.startsWith("id,") ? "id" : "user_id", ids);

  if (result.error) {
    return { data: null, error: result.error };
  }

  return { data: Array.isArray(result.data) ? result.data : [], error: null };
}

export async function fetchReviewAuthorProfiles(client, customerIds = []) {
  const ids = Array.from(
    new Set(customerIds.map((value) => asTrimmedString(value)).filter(Boolean))
  );
  if (!client || !ids.length) return {};

  const selectAttempts = [
    REVIEW_AUTHOR_SELECT_WITH_AVATAR,
    REVIEW_AUTHOR_SELECT_BASE,
    REVIEW_AUTHOR_SELECT_LEGACY_NAME_WITH_PHOTO,
    REVIEW_AUTHOR_SELECT_LEGACY_NAME,
    REVIEW_AUTHOR_SELECT_ID_WITH_AVATAR,
    REVIEW_AUTHOR_SELECT_ID_BASE,
    REVIEW_AUTHOR_SELECT_ID_LEGACY_NAME_WITH_PHOTO,
    REVIEW_AUTHOR_SELECT_ID_LEGACY_NAME,
  ];

  let rows = null;
  let lastError = null;

  for (const selectClause of selectAttempts) {
    const result = await queryReviewAuthorProfiles(client, ids, selectClause);
    if (result.error) {
      lastError = result.error;
      if (isMissingColumnError(result.error)) continue;
      return {};
    }

    rows = result.data || [];
    break;
  }

  if (!rows) {
    return {};
  }

  const profilesByUserId = rows.reduce((acc, row) => {
    const profile = extractProfileRow(row);
    if (!profile) return acc;
    acc[profile.user_id] = profile;
    return acc;
  }, {});

  return profilesByUserId;
}

export function mergeReviewAuthorProfiles(reviews = [], profilesByUserId = {}) {
  return (Array.isArray(reviews) ? reviews : []).map((review) => {
    const customerId = asTrimmedString(review?.customer_id);
    const existingProfile = asAuthorProfile(review?.author_profile);

    const resolvedProfile =
      (customerId && profilesByUserId[customerId]) || existingProfile || null;

    return {
      ...review,
      author_profile: resolvedProfile,
    };
  });
}

export async function attachReviewAuthorProfiles(client, reviews = []) {
  const profilesByUserId = await fetchReviewAuthorProfiles(
    client,
    (Array.isArray(reviews) ? reviews : []).map((review) => review?.customer_id)
  );
  return mergeReviewAuthorProfiles(reviews, profilesByUserId).map((review) =>
    serializePublicBusinessReview(review)
  );
}

export function getReviewAuthorDisplayName(review) {
  const explicitName =
    asTrimmedString(review?.author_display_name) ||
    asTrimmedString(review?.reviewer_name);
  if (explicitName) return explicitName;

  const authorProfile = asAuthorProfile(review?.author_profile);
  if (authorProfile?.display_name) return authorProfile.display_name;

  return formatReviewer(review?.customer_id);
}

export function serializePublicBusinessReview(review) {
  if (!review || typeof review !== "object") return null;

  const authorProfile = asAuthorProfile(review.author_profile);
  const authorDisplayName =
    asTrimmedString(review.author_display_name) ||
    asTrimmedString(review.reviewer_name) ||
    authorProfile?.display_name ||
    null;

  return {
    ...review,
    id: review.id ?? null,
    business_id: review.business_id ?? null,
    customer_id: asTrimmedString(review.customer_id),
    rating: Number(review.rating || 0),
    title: asTrimmedString(review.title),
    body: asTrimmedString(review.body),
    created_at: review.created_at || null,
    updated_at: review.updated_at || null,
    business_reply: asTrimmedString(review.business_reply),
    business_reply_at: review.business_reply_at || null,
    author_profile: authorProfile,
    author_display_name: authorDisplayName,
  };
}

export function mergePublicBusinessReview(existingReview, incomingReview) {
  const existing = serializePublicBusinessReview(existingReview);
  const incoming = serializePublicBusinessReview(incomingReview);
  if (!existing) return incoming;
  if (!incoming) return existing;

  return serializePublicBusinessReview({
    ...existing,
    ...incoming,
    author_profile: incoming.author_profile || existing.author_profile || null,
    author_display_name:
      incoming.author_display_name || existing.author_display_name || null,
  });
}

export async function fetchBusinessReviews(
  client,
  { businessId, from, to, limit, customerId, single = false } = {}
) {
  if (!client || !businessId) {
    return single ? null : [];
  }

  const applyFilters = (query) => {
    let next = query.eq("business_id", businessId);
    if (customerId) {
      next = next.eq("customer_id", customerId);
    }
    if (single) {
      return next.maybeSingle();
    }
    if (typeof from === "number" && typeof to === "number") {
      next = next.order("created_at", { ascending: false }).range(from, to);
    } else if (typeof limit === "number") {
      next = next.order("created_at", { ascending: false }).limit(limit);
    } else {
      next = next.order("created_at", { ascending: false });
    }
    return next;
  };

  let result = await applyFilters(
    client.from("business_reviews").select(REVIEW_SELECT_WITH_UPDATED)
  );

  if (result.error && isMissingColumnError(result.error)) {
    result = await applyFilters(
      client.from("business_reviews").select(REVIEW_SELECT_BASE)
    );
  }

  if (result.error) {
    return single ? null : [];
  }

  if (single) {
    const row = result.data ?? null;
    if (!row) return null;
    const [enriched] = await attachReviewAuthorProfiles(client, [row]);
    return serializePublicBusinessReview(enriched || row);
  }

  const enriched = await attachReviewAuthorProfiles(client, result.data || []);
  return enriched
    .map((review) => serializePublicBusinessReview(review))
    .filter(Boolean);
}

export {
  REVIEW_SELECT_BASE,
  REVIEW_SELECT_WITH_UPDATED,
  REVIEW_AUTHOR_SELECT_BASE,
  REVIEW_AUTHOR_SELECT_WITH_AVATAR,
};
