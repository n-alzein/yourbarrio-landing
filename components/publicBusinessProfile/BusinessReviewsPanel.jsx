"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";

function formatReviewer(id) {
  if (!id) return "Customer";
  return `Customer ${id.slice(0, 6)}`;
}

export default function BusinessReviewsPanel({
  businessId,
  initialReviews,
  ratingSummary,
  reviewCount,
}) {
  const [reviews, setReviews] = useState(initialReviews || []);
  const [loadingMore, setLoadingMore] = useState(false);

  const reviewAverage = reviews.length
    ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) /
      reviews.length
    : 0;
  const averageRating = ratingSummary?.count ? ratingSummary.average : reviewAverage;
  const breakdown = ratingSummary?.breakdown || {};
  const totalReviews = Math.max(
    ratingSummary?.count ?? 0,
    reviewCount ?? 0,
    reviews.length
  );
  const pageSize = 6;

  const ratingRows = useMemo(() => {
    return [5, 4, 3, 2, 1].map((value) => {
      const count = breakdown[value] || 0;
      const percent = totalReviews ? Math.round((count / totalReviews) * 100) : 0;
      return { value, count, percent };
    });
  }, [breakdown, totalReviews]);

  const canLoadMore = reviews.length < totalReviews;

  const handleLoadMore = async () => {
    if (!businessId || loadingMore) return;
    setLoadingMore(true);

    const client = getBrowserSupabaseClient();
    if (!client) {
      setLoadingMore(false);
      return;
    }

    const from = reviews.length;
    const to = from + pageSize - 1;
    const { data, error } = await client
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

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.7)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold">Reviews</h2>
          <p className="text-sm text-white/70">
            What customers are saying.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-300" fill="currentColor" />
          <span className="text-2xl font-semibold text-white">
            {averageRating ? averageRating.toFixed(1) : "0.0"}
          </span>
          <span className="text-sm text-white/60">
            ({totalReviews} total)
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-2">
        {ratingRows.map((row) => (
          <div key={row.value} className="flex items-center gap-3 text-sm">
            <span className="w-8 text-white/70">{row.value}*</span>
            <div className="h-2 flex-1 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-amber-300"
                style={{ width: `${row.percent}%` }}
              />
            </div>
            <span className="w-10 text-right text-white/60">{row.count}</span>
          </div>
        ))}
      </div>

      {!reviews.length ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
          No reviews yet.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {review.title || formatReviewer(review.customer_id)}
                  </p>
                  <p className="text-xs text-white/60">
                    {review.created_at
                      ? new Date(review.created_at).toLocaleDateString()
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-amber-300">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      className={`h-4 w-4 ${
                        idx < (review.rating || 0)
                          ? "text-amber-300"
                          : "text-amber-300/30"
                      }`}
                      fill={idx < (review.rating || 0) ? "currentColor" : "none"}
                    />
                  ))}
                </div>
              </div>
              {review.body ? (
                <p className="mt-3 text-sm text-white/70 leading-relaxed">
                  {review.body}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {canLoadMore ? (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="mt-5 inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/20 transition"
        >
          {loadingMore ? "Loading..." : "Load more reviews"}
        </button>
      ) : null}
    </section>
  );
}
