"use client";

import { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";

function formatReviewer(id) {
  if (!id) return "Customer";
  return `Customer ${id.slice(0, 6)}`;
}

async function ensureSession(client) {
  if (!client?.auth?.getSession) return null;
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session) return null;
  return data.session;
}

export default function ReviewsPanel({
  reviews,
  setReviews,
  reviewCount,
  ratingSummary,
  tone,
  businessId,
  supabase,
}) {
  const [loadingMore, setLoadingMore] = useState(false);
  const [customerNames, setCustomerNames] = useState({});
  const [replyReviewId, setReplyReviewId] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const pageSize = 6;

  const averageRating = ratingSummary?.average || 0;

  const canLoadMore = reviews.length < reviewCount;

  useEffect(() => {
    let active = true;
    if (!supabase) return () => {};

    const ids = Array.from(
      new Set(reviews.map((item) => item.customer_id).filter(Boolean))
    );
    const missing = ids.filter((id) => !customerNames[id]);
    if (!missing.length) return () => {};

    const loadNames = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id,full_name,business_name")
        .in("id", missing);

      if (!active || error || !data?.length) return;
      setCustomerNames((prev) => {
        const next = { ...prev };
        data.forEach((row) => {
          next[row.id] = row.full_name || row.business_name || "Customer";
        });
        return next;
      });
    };

    loadNames();
    return () => {
      active = false;
    };
  }, [reviews, customerNames, supabase]);

  const handleLoadMore = async () => {
    if (!supabase || loadingMore) return;
    setLoadingMore(true);

    const from = reviews.length;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("business_reviews")
      .select(
        "id,business_id,customer_id,rating,title,body,created_at,business_reply,business_reply_at"
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (!error && data?.length) {
      setReviews((prev) => [...prev, ...data]);
    }

    setLoadingMore(false);
  };

  const startReply = (review) => {
    setReplyReviewId(review.id);
    setReplyBody(review.business_reply || "");
    setReplyError("");
  };

  const cancelReply = () => {
    setReplyReviewId(null);
    setReplyBody("");
    setReplyError("");
  };

  const handleSaveReply = async (reviewId) => {
    if (!supabase || replyLoading) return;
    if (!replyBody.trim()) {
      setReplyError("Reply cannot be empty.");
      return;
    }

    setReplyLoading(true);
    setReplyError("");
    const session = await ensureSession(supabase);
    if (!session) {
      setReplyError("Please sign in again to reply.");
      setReplyLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("business_reviews")
      .update({
        business_reply: replyBody.trim(),
        business_reply_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .select(
        "id,business_id,customer_id,rating,title,body,created_at,business_reply,business_reply_at"
      )
      .maybeSingle();

    if (error) {
      setReplyError(error.message || "Could not save reply.");
      setReplyLoading(false);
      return;
    }

    if (data) {
      setReviews((prev) => prev.map((item) => (item.id === reviewId ? data : item)));
      cancelReply();
    }

    setReplyLoading(false);
  };

  const handleDeleteReply = async (reviewId) => {
    if (!supabase || replyLoading) return;
    setReplyLoading(true);
    setReplyError("");
    const session = await ensureSession(supabase);
    if (!session) {
      setReplyError("Please sign in again to update this reply.");
      setReplyLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("business_reviews")
      .update({
        business_reply: null,
        business_reply_at: null,
      })
      .eq("id", reviewId)
      .select(
        "id,business_id,customer_id,rating,title,body,created_at,business_reply,business_reply_at"
      )
      .maybeSingle();

    if (error) {
      setReplyError(error.message || "Could not delete reply.");
      setReplyLoading(false);
      return;
    }

    if (data) {
      setReviews((prev) => prev.map((item) => (item.id === reviewId ? data : item)));
      cancelReply();
    }

    setReplyLoading(false);
  };

  const ratingRows = useMemo(() => {
    const total = ratingSummary?.count || reviewCount || 0;
    const breakdown = ratingSummary?.breakdown || {};
    return [5, 4, 3, 2, 1].map((value) => {
      const count = breakdown[value] || 0;
      const percent = total ? Math.round((count / total) * 100) : 0;
      return { value, count, percent };
    });
  }, [ratingSummary, reviewCount]);

  return (
    <div className="space-y-6">
      <div className={`rounded-xl border ${tone.cardBorder} ${tone.cardSoft} p-5 md:p-6`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className={`text-lg font-semibold ${tone.textStrong}`}>Reviews</h3>
            <p className={`text-sm ${tone.textMuted}`}>Latest feedback from customers.</p>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-400" fill="currentColor" />
            <span className={`text-xl font-semibold ${tone.textStrong}`}>
              {averageRating ? averageRating.toFixed(1) : "0.0"}
            </span>
            <span className={`text-sm ${tone.textMuted}`}>
              ({reviewCount} total)
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          {ratingRows.map((row) => (
            <div key={row.value} className="flex items-center gap-3">
              <span className={`text-xs w-8 ${tone.textMuted}`}>{row.value}★</span>
              <div className={`h-2 flex-1 rounded-full ${tone.progressTrack}`}>
                <div
                  className={`h-2 rounded-full ${tone.progressFill}`}
                  style={{ width: `${row.percent}%` }}
                />
              </div>
              <span className={`text-xs w-10 text-right ${tone.textMuted}`}>{row.count}</span>
            </div>
          ))}
        </div>
      </div>

      {!reviews.length ? (
        <div className={`rounded-xl border ${tone.cardBorder} ${tone.cardSoft} p-6 text-center`}>
          <p className={`text-sm ${tone.textMuted}`}>No reviews yet.</p>
          <p className={`text-xs ${tone.textSoft}`}>Encourage customers to leave feedback.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className={`rounded-xl border ${tone.cardBorder} ${tone.cardSoft} p-5`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-semibold ${tone.textStrong}`}>
                    {customerNames[review.customer_id] ||
                      formatReviewer(review.customer_id)}
                  </p>
                  <p className={`text-xs ${tone.textMuted}`}>
                    {new Date(review.created_at).toLocaleDateString()}
                  </p>
                  {review.title ? (
                    <p className={`mt-1 text-xs ${tone.textMuted}`}>
                      {review.title}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      className={`h-4 w-4 ${idx < review.rating ? "" : "text-amber-400/40"}`}
                      fill={idx < review.rating ? "currentColor" : "none"}
                    />
                  ))}
                </div>
              </div>
              <p className={`mt-3 text-sm ${tone.textMuted}`}>{review.body}</p>
              {review.business_reply ? (
                <div className={`mt-4 rounded-lg border ${tone.cardBorder} ${tone.cardSoft} p-4`}>
                  <p className={`text-xs font-semibold uppercase ${tone.textSoft}`}>
                    Reply from business
                  </p>
                  <p className={`mt-2 text-sm ${tone.textMuted}`}>{review.business_reply}</p>
                </div>
              ) : null}

              {replyReviewId === review.id ? (
                <div className="mt-4 space-y-3">
                  <textarea
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    placeholder="Write a reply..."
                    className={`w-full min-h-[110px] rounded-lg border ${tone.cardBorder} ${tone.cardSoft} px-3 py-2 text-base md:text-sm ${tone.textStrong} placeholder:text-slate-500 dark:placeholder:text-white/40`}
                    maxLength={800}
                  />
                  {replyError ? (
                    <p className="text-xs text-rose-400">{replyError}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveReply(review.id)}
                      disabled={replyLoading}
                      className={`rounded-lg px-4 py-2 text-xs font-semibold ${tone.buttonPrimary}`}
                    >
                      {replyLoading ? "Saving..." : "Save reply"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelReply}
                      className={`rounded-lg px-4 py-2 text-xs font-semibold ${tone.buttonSecondary}`}
                    >
                      Cancel
                    </button>
                    {review.business_reply ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteReply(review.id)}
                        className="rounded-lg px-4 py-2 text-xs font-semibold border border-rose-300/60 text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 transition"
                      >
                        Delete reply
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => startReply(review)}
                    className={`rounded-lg px-4 py-2 text-xs font-semibold ${tone.buttonSecondary}`}
                  >
                    {review.business_reply ? "Edit reply" : "Reply"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canLoadMore ? (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={loadingMore}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${tone.buttonSecondary}`}
        >
          {loadingMore ? "Loading..." : "Load more reviews"}
        </button>
      ) : null}
    </div>
  );
}
