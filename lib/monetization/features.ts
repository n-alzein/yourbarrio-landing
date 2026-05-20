export const FEATURES = {
  INVENTORY_ONLINE_STOCK: "inventory.online_stock",
  INVENTORY_UNIQUE_ITEMS: "inventory.unique_items",
  INVENTORY_EXTERNAL_POS: "inventory.external_pos",
  INVENTORY_CAPACITY_BASED: "inventory.capacity_based",
  LISTINGS_ACTIVE_LIMIT: "listings.active_limit",
  LISTINGS_IMAGES_PER_LISTING_LIMIT: "listings.images_per_listing_limit",
  AI_PHOTO_ENHANCEMENT: "ai.photo_enhancement",
  AI_PHOTO_ENHANCEMENT_MONTHLY_LIMIT: "ai.photo_enhancement.monthly_limit",
  AI_DESCRIPTION_GENERATION: "ai.description_generation",
  AI_DESCRIPTION_GENERATION_MONTHLY_LIMIT: "ai.description_generation.monthly_limit",
  ANALYTICS_BASIC: "analytics.basic",
  ANALYTICS_ADVANCED: "analytics.advanced",
  ORDERS_ONLINE_CHECKOUT: "orders.online_checkout",
  ORDERS_REQUEST_TO_BUY: "orders.request_to_buy",
  ORDERS_BUSINESS_CONFIRMATION_REQUIRED: "orders.business_confirmation_required",
  MESSAGING_CUSTOMER_BUSINESS: "messaging.customer_business",
  FEATURED_PLACEMENT: "featured_placement",
  FEATURED_PLACEMENT_MONTHLY_CREDITS: "featured_placement.monthly_credits",
  PROMOTIONS_SELF_SERVE: "promotions.self_serve",
  TEAM_MEMBERS_LIMIT: "team.members_limit",
  STOREFRONT_CUSTOMIZATION: "storefront.customization",
  SUPPORT_PRIORITY: "support.priority",
  MARKETPLACE_TAKE_RATE_PERCENT: "marketplace.take_rate_percent",
  MARKETPLACE_FIXED_FEE_CENTS: "marketplace.fixed_fee_cents",
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

export const FEATURE_KEYS = Object.values(FEATURES) as FeatureKey[];

export const METERED_LIMIT_FEATURE_BY_USAGE_FEATURE: Partial<Record<FeatureKey, FeatureKey>> = {
  [FEATURES.AI_PHOTO_ENHANCEMENT]: FEATURES.AI_PHOTO_ENHANCEMENT_MONTHLY_LIMIT,
  [FEATURES.AI_DESCRIPTION_GENERATION]: FEATURES.AI_DESCRIPTION_GENERATION_MONTHLY_LIMIT,
  [FEATURES.FEATURED_PLACEMENT]: FEATURES.FEATURED_PLACEMENT_MONTHLY_CREDITS,
};

export const FOUNDING_PLAN_KEY = "founding_business";
export const FREE_PLAN_KEY = "free";

