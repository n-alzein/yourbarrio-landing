const LEGACY_ORDER_UPDATE_PATTERN =
  /^Order\s+(YB-[A-Z0-9-]+)\s+update:\s+Your order status is now\s+(.+?)\.?\s*$/i;
const HUMAN_SENDER_ROLES = new Set(["customer", "business"]);
const SYSTEM_SENDER_ROLES = new Set(["system"]);
const SYSTEM_ORDER_TYPES = new Set([
  "system_order_update",
  "order_status_update",
]);

export function formatLegacyOrderUpdatePreview(preview = "") {
  const text = typeof preview === "string" ? preview.trim() : "";
  const match = text.match(LEGACY_ORDER_UPDATE_PATTERN);
  if (!match) return text;

  const orderNumber = match[1].toUpperCase();
  const status = match[2].trim().replace(/\s+/g, " ").toLowerCase();
  if (!orderNumber || !status) return text;

  return `Order ${orderNumber} ${status}`;
}

export function classifyInboxItem(conversation = {}) {
  if (hasHumanMessageEvidence(conversation)) {
    return "conversation";
  }

  if (hasSystemOrderUpdateMetadata(conversation)) {
    return "order_update";
  }

  if (hasLegacyOrderUpdateFallback(conversation)) {
    return "order_update";
  }

  return "conversation";
}

export function splitInboxConversations(conversations = []) {
  return conversations.reduce(
    (groups, conversation) => {
      if (classifyInboxItem(conversation) === "order_update") {
        groups.orderUpdates.push(conversation);
      } else {
        groups.conversations.push(conversation);
      }
      return groups;
    },
    { conversations: [], orderUpdates: [] }
  );
}

function normalizeValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getMessageRecords(conversation = {}) {
  if (Array.isArray(conversation.messages)) return conversation.messages;
  if (Array.isArray(conversation.thread)) return conversation.thread;
  if (Array.isArray(conversation.recent_messages)) return conversation.recent_messages;
  return [];
}

function getMessageType(item = {}) {
  return normalizeValue(
    item.message_type ||
      item.type ||
      item.last_message_type ||
      item.lastMessageType
  );
}

function getSenderRole(item = {}) {
  return normalizeValue(
    item.sender_role ||
      item.senderRole ||
      item.last_message_sender_role ||
      item.lastMessageSenderRole
  );
}

function hasHumanMessageEvidence(conversation = {}) {
  const records = [conversation, ...getMessageRecords(conversation)];

  return records.some((item) => {
    const senderRole = getSenderRole(item);
    const messageType = getMessageType(item);
    return HUMAN_SENDER_ROLES.has(senderRole) && messageType !== "system";
  });
}

function hasSystemOrderUpdateMetadata(conversation = {}) {
  const records = [conversation, ...getMessageRecords(conversation)];

  return records.some((item) => {
    const senderRole = getSenderRole(item);
    const messageType = getMessageType(item);
    const taggedAsOrderStatus =
      SYSTEM_ORDER_TYPES.has(messageType) ||
      normalizeValue(item.order_update_type) === "order_status" ||
      normalizeValue(item.system_event) === "order_status";

    return (
      SYSTEM_ORDER_TYPES.has(messageType) ||
      (SYSTEM_SENDER_ROLES.has(senderRole) && taggedAsOrderStatus)
    );
  });
}

function hasLegacyOrderUpdateFallback(conversation = {}) {
  const preview = conversation?.last_message_preview || "";
  const formattedPreview = formatLegacyOrderUpdatePreview(preview);
  if (!formattedPreview || formattedPreview === String(preview).trim()) {
    return false;
  }

  return !hasHumanMessageEvidence(conversation);
}
