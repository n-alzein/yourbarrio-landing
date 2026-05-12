import { describe, expect, it } from "vitest";

import { getCustomerBusinessAccountTotal } from "@/lib/admin/accountGrowth";

describe("admin account growth totals", () => {
  it("combines only customer and business account buckets", () => {
    const customers = 29;
    const businesses = 9;
    const broaderAllUsersTotal = 40;

    const total = getCustomerBusinessAccountTotal({ customers, businesses });

    expect(total).toBe(38);
    expect(total).not.toBe(broaderAllUsersTotal);
  });
});
