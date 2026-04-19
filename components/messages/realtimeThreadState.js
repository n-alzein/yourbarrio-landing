export function appendMessageDedup(prevMessages = [], nextMessage) {
  if (!nextMessage?.id) return prevMessages;
  if (prevMessages.some((item) => item.id === nextMessage.id)) return prevMessages;
  return [...prevMessages, nextMessage];
}

export function prependMessagesDedup(prevMessages = [], olderMessages = []) {
  if (!Array.isArray(olderMessages) || olderMessages.length === 0) {
    return prevMessages;
  }
  const existingIds = new Set(prevMessages.map((message) => message.id));
  const uniqueOlder = olderMessages.filter(
    (message) => message?.id && !existingIds.has(message.id)
  );
  if (uniqueOlder.length === 0) return prevMessages;
  return [...uniqueOlder, ...prevMessages];
}

export function getTrackedOrderIds(messages = []) {
  const ids = new Set();
  messages.forEach((message) => {
    if (message?.type === "order_status_update" && message.order_id) {
      ids.add(message.order_id);
    }
  });
  return Array.from(ids).sort();
}

export function patchOrderStatusMessage(prevMessages = [], orderUpdate) {
  if (!orderUpdate?.id || !orderUpdate?.status) return prevMessages;

  const orderMessages = prevMessages.filter(
    (message) =>
      message?.type === "order_status_update" &&
      message.order_id === orderUpdate.id
  );
  if (orderMessages.length === 0) return prevMessages;

  const timestamp =
    orderUpdate.updated_at ||
    orderUpdate.fulfilled_at ||
    orderUpdate.confirmed_at ||
    new Date().toISOString();
  const syntheticId = `order-status-${orderUpdate.id}-${orderUpdate.status}-${timestamp}`;
  if (prevMessages.some((message) => message.id === syntheticId)) return prevMessages;

  const latest = orderMessages[orderMessages.length - 1];
  return [
    ...prevMessages,
    {
      ...latest,
      id: syntheticId,
      body: latest.body || "",
      created_at: timestamp,
      read_at: latest.read_at || null,
      type: "order_status_update",
      order_id: orderUpdate.id,
      order_number: orderUpdate.order_number || latest.order_number || "",
      status: orderUpdate.status,
      timestamp,
      fulfillment_type: orderUpdate.fulfillment_type || latest.fulfillment_type || null,
      business_name: latest.business_name || "",
      order_items: Array.isArray(latest.order_items) ? latest.order_items : [],
      synthetic: true,
    },
  ];
}

export function isNearScrollBottom(element, threshold = 120) {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

export function scrollToBottom(element) {
  if (!element) return;
  element.scrollTop = element.scrollHeight;
}
