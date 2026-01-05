"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import { fetchConversations } from "@/lib/messages";
import InboxList from "@/components/messages/InboxList";

export default function BusinessMessagesPage() {
  const { user, authUser, loadingUser, supabase } = useAuth();
  const userId = user?.id || authUser?.id || null;

  const [hydrated, setHydrated] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const loadConversations = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConversations({
        supabase,
        userId,
        role: "business",
      });
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations", err);
      setError("We couldn’t load your messages. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (!hydrated || loadingUser || !userId) return;
    loadConversations();
  }, [hydrated, loadingUser, userId, loadConversations]);

  useEffect(() => {
    if (!hydrated || loadingUser || !userId) return undefined;
    const client = supabase ?? getBrowserSupabaseClient();
    if (!client) return undefined;

    const channel = client
      .channel(`conversations-business-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `business_id=eq.${userId}`,
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [hydrated, loadingUser, userId, supabase, loadConversations]);

  const intro = useMemo(
    () =>
      "Stay connected with customers, confirm orders, and follow up on leads from your inbox.",
    []
  );

  return (
    <section className="relative w-full min-h-screen pt-8 md:pt-10 pb-16 text-white">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-purple-900 via-black to-slate-900 opacity-70" />
      <div className="absolute inset-0 -z-10 backdrop-blur-3xl" />

      <div className="w-full px-6 md:px-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/50">Inbox</p>
            <h1 className="text-3xl md:text-4xl font-semibold text-white mt-2">Messages</h1>
            <p className="text-sm text-white/60 mt-2 max-w-2xl">{intro}</p>
          </div>

          {error ? (
            <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <InboxList
            conversations={conversations}
            role="business"
            basePath="/business/messages"
            loading={loading}
          />
        </div>
      </div>
    </section>
  );
}
