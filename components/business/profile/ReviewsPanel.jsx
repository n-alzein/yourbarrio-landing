"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";

function formatReviewer(id) {
  if (!id) return "Customer";
  return `Customer ${id.slice(0, 6)}`;
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
  const pageSize = 6;

  const averageRating = ratingSummary?.average || 0;
  const breakdown = ratingSummary?.breakdown || {};

  const canLoadMore = reviews.length < reviewCount;

  const handleLoadMore = async () => {
    if (!supabase || loadingMore) return;
    setLoadingMore(true);

    const from = reviews.length;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("business_reviews")
      .select("id,business_id,customer_id,rating,title,body,created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (!error && data?.length) {
      setReviews((prev) => [...prev, ...data]);
    }

    setLoadingMore(false);
  };

  const ratingRows = useMemo(() => {
    const total = ratingSummary?.count || reviewCount || 0;
    return [5, 4, 3, 2, 1].map((value) => {
      const count = breakdown[value] || 0;
      const percent = total ? Math.round((count / total) * 100) : 0;
      return { value, count, percent };
    });
  }, [breakdown, reviewCount, ratingSummary]);

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
                    {review.title || formatReviewer(review.customer_id)}
                  </p>
                  <p className={`text-xs ${tone.textMuted}`}>
                    {new Date(review.created_at).toLocaleDateString()}
                  </p>
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
