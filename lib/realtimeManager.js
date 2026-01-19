const channels = new Set();

export function registerChannel(channel) {
  if (!channel) return channel;
  channels.add(channel);
  return channel;
}

export async function stopRealtime(supabase) {
  if (!supabase) return;
  try {
    await supabase.removeAllChannels();
  } catch {
    // best effort
  }
  try {
    supabase.realtime?.disconnect?.();
  } catch {
    // best effort
  }
  channels.clear();
}
