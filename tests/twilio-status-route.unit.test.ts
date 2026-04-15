import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAdminServiceRoleClientMock, validateRequestMock } = vi.hoisted(() => ({
  getAdminServiceRoleClientMock: vi.fn(),
  validateRequestMock: vi.fn(),
}));

vi.mock("twilio", () => ({
  __esModule: true,
  default: {
    validateRequest: validateRequestMock,
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminServiceRoleClient: getAdminServiceRoleClientMock,
}));

import { POST } from "@/app/api/twilio/status/route";

function createRequest(
  fields: Record<string, string>,
  headers: Record<string, string> = {}
) {
  return new Request("http://127.0.0.1:3000/api/twilio/status?foo=bar", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": "test-signature",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "api.yourbarrio.com",
      ...headers,
    },
    body: new URLSearchParams(fields),
  });
}

function createSupabaseMock({
  existingRowId = "notification-1",
  lookupError = null,
  updateError = null,
}: {
  existingRowId?: string | null;
  lookupError?: { message: string } | null;
  updateError?: { message: string } | null;
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: existingRowId ? { id: existingRowId } : null,
    error: lookupError,
  });
  const selectEq = vi.fn(() => ({
    maybeSingle,
  }));
  const select = vi.fn(() => ({
    eq: selectEq,
  }));

  const updateEq = vi.fn().mockResolvedValue({
    error: updateError,
  });
  const update = vi.fn(() => ({
    eq: updateEq,
  }));

  return {
    from: vi.fn(() => ({
      select,
      update,
    })),
    __mocks: {
      maybeSingle,
      select,
      selectEq,
      update,
      updateEq,
    },
  };
}

describe("POST /api/twilio/status", () => {
  const originalAuthToken = process.env.TWILIO_AUTH_TOKEN;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TWILIO_AUTH_TOKEN = "auth-token";
    validateRequestMock.mockReturnValue(true);
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.TWILIO_AUTH_TOKEN = originalAuthToken;
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("updates the matching notification for a valid signed callback", async () => {
    const supabase = createSupabaseMock();
    getAdminServiceRoleClientMock.mockReturnValue(supabase);

    const response = await POST(
      createRequest({
        MessageSid: "SM123",
        MessageStatus: "delivered",
        ErrorCode: "30007",
        ErrorMessage: "Carrier violation",
      })
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    expect(validateRequestMock).toHaveBeenCalledWith(
      "auth-token",
      "test-signature",
      "https://api.yourbarrio.com/api/twilio/status?foo=bar",
      expect.objectContaining({
        MessageSid: "SM123",
        MessageStatus: "delivered",
      })
    );
    expect(supabase.__mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "twilio",
        provider_message_id: "SM123",
        provider_status: "delivered",
        provider_error_code: "30007",
        provider_error_message: "Carrier violation",
        last_provider_event_at: expect.any(String),
      })
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "twilio_status_webhook",
        event: "successful_update",
        messageSid: "SM123",
        messageStatus: "delivered",
      })
    );
  });

  it("returns 403 for an invalid signature", async () => {
    validateRequestMock.mockReturnValue(false);

    const response = await POST(
      createRequest({
        MessageSid: "SM123",
        MessageStatus: "delivered",
      })
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("forbidden");
    expect(getAdminServiceRoleClientMock).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "twilio_status_webhook",
        event: "invalid_signature",
      })
    );
  });

  it("returns 500 when the auth token is missing", async () => {
    process.env.TWILIO_AUTH_TOKEN = "";

    const response = await POST(
      createRequest({
        MessageSid: "SM123",
        MessageStatus: "delivered",
      })
    );

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("server misconfiguration");
    expect(validateRequestMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "twilio_status_webhook",
        event: "server_misconfiguration",
      })
    );
  });

  it("returns 200 and logs a warning when no notification matches the message sid", async () => {
    const supabase = createSupabaseMock({ existingRowId: null });
    getAdminServiceRoleClientMock.mockReturnValue(supabase);

    const response = await POST(
      createRequest({
        MessageSid: "SM404",
        MessageStatus: "sent",
      })
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    expect(supabase.__mocks.update).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "twilio_status_webhook",
        event: "notification_not_found",
        messageSid: "SM404",
        messageStatus: "sent",
      })
    );
  });

  it("falls back to SmsSid and SmsStatus when MessageSid and MessageStatus are absent", async () => {
    const supabase = createSupabaseMock();
    getAdminServiceRoleClientMock.mockReturnValue(supabase);

    const response = await POST(
      createRequest({
        SmsSid: "SM999",
        SmsStatus: "undelivered",
      })
    );

    expect(response.status).toBe(200);
    expect(supabase.__mocks.selectEq).toHaveBeenCalledWith("provider_message_id", "SM999");
    expect(supabase.__mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        provider_message_id: "SM999",
        provider_status: "undelivered",
      })
    );
  });

  it("returns 200 without crashing when the payload is missing sid or status", async () => {
    const supabase = createSupabaseMock();
    getAdminServiceRoleClientMock.mockReturnValue(supabase);

    const response = await POST(
      createRequest({
        MessageSid: "SM123",
      })
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    expect(getAdminServiceRoleClientMock).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "twilio_status_webhook",
        event: "malformed_payload",
      })
    );
  });
});
