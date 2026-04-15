import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type NotificationRow = {
  owner_user_id: string;
  business_entity_id: string | null;
};

type VendorMemberRow = {
  business_entity_id: string | null;
  user_id: string;
};

function canReadOrderNotificationRow({
  authUid,
  notification,
  vendorMembers,
}: {
  authUid: string | null;
  notification: NotificationRow;
  vendorMembers: VendorMemberRow[];
}) {
  if (!authUid) return false;
  if (notification.owner_user_id === authUid) return true;

  return vendorMembers.some(
    (member) =>
      member.business_entity_id != null &&
      member.business_entity_id === notification.business_entity_id &&
      member.user_id === authUid
  );
}

describe("order_notifications RLS policy", () => {
  const migrationPath = join(
    process.cwd(),
    "supabase/migrations/20260413100000_add_order_notification_pipeline.sql"
  );
  const sql = readFileSync(migrationPath, "utf8");

  it("uses the corrected owner + business-entity member access shape", () => {
    expect(sql).toContain('DROP POLICY IF EXISTS "Businesses can read order notification logs"');
    expect(sql).toContain('CREATE POLICY "Businesses can read order notification logs"');
    expect(sql).toContain("(select auth.uid()) IS NOT NULL");
    expect(sql).toContain("owner_user_id = (select auth.uid())");
    expect(sql).toContain("vm.business_entity_id = order_notifications.business_entity_id");
    expect(sql).toContain("vm.user_id = (select auth.uid())");
    expect(sql).not.toContain("vendor_members.vendor_id = businesses.owner_user_id");
  });

  it("allows the owner to read their own notification row", () => {
    expect(
      canReadOrderNotificationRow({
        authUid: "owner-1",
        notification: {
          owner_user_id: "owner-1",
          business_entity_id: "business-1",
        },
        vendorMembers: [],
      })
    ).toBe(true);
  });

  it("allows an authorized member to read a row for the matching business_entity_id", () => {
    expect(
      canReadOrderNotificationRow({
        authUid: "staff-1",
        notification: {
          owner_user_id: "owner-1",
          business_entity_id: "business-1",
        },
        vendorMembers: [
          {
            business_entity_id: "business-1",
            user_id: "staff-1",
          },
        ],
      })
    ).toBe(true);
  });

  it("denies an unrelated authenticated user", () => {
    expect(
      canReadOrderNotificationRow({
        authUid: "other-user",
        notification: {
          owner_user_id: "owner-1",
          business_entity_id: "business-1",
        },
        vendorMembers: [
          {
            business_entity_id: "business-2",
            user_id: "other-user",
          },
        ],
      })
    ).toBe(false);
  });

  it("does not grant access when owner_user_id and business_entity_id do not match the member relationship", () => {
    expect(
      canReadOrderNotificationRow({
        authUid: "staff-1",
        notification: {
          owner_user_id: "owner-1",
          business_entity_id: "business-1",
        },
        vendorMembers: [
          {
            business_entity_id: "business-2",
            user_id: "staff-1",
          },
        ],
      })
    ).toBe(false);
  });

  it("denies anonymous access", () => {
    expect(
      canReadOrderNotificationRow({
        authUid: null,
        notification: {
          owner_user_id: "owner-1",
          business_entity_id: "business-1",
        },
        vendorMembers: [
          {
            business_entity_id: "business-1",
            user_id: "staff-1",
          },
        ],
      })
    ).toBe(false);
  });
});
