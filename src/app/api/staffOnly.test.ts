// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// A fake Supabase client: getUser always succeeds (a signed-in account);
// tenant_users returns whatever the test sets; bookings returns one booking.
const state: { roles: Array<{ tenant_id: string | null; role: string }>; booking: Record<string, unknown> } = { roles: [], booking: {} };

function chain(table: string) {
  const q: Record<string, unknown> = {};
  const self = () => q;
  for (const m of ["select", "eq", "in", "limit", "order", "update", "insert"]) q[m] = vi.fn(self);
  q.single = vi.fn(async () => ({ data: table === "bookings" ? state.booking : null, error: null }));
  q.then = (res: (v: unknown) => unknown) => res({ data: table === "tenant_users" ? state.roles : [], error: null });
  return q;
}
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    from: (t: string) => chain(t),
  }),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
process.env.STRIPE_SECRET_KEY = "sk_test_x";
process.env.RESEND_API_KEY = "re_x";

const req = (body: unknown) => new Request("http://localhost/api", {
  method: "POST", headers: { authorization: "Bearer tok", "content-type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => {
  state.roles = [];
  state.booking = { ref: "EVX-1", tenant_id: "t1", customer_email: "c@example.com", quoted_price: 90 };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "cs_1", url: "https://stripe.test" }), { status: 200 })));
});

describe("staff-only API routes", () => {
  it("send-invoice refuses a signed-in account that isn't staff", async () => {
    const { POST } = await import("./send-invoice/route");
    const res = await POST(req({ to: "x@example.com", pdfBase64: "AAA", number: "INV-1" }));
    expect(res.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("payment-link refuses a signed-in account that isn't staff", async () => {
    const { POST } = await import("./payment-link/route");
    const res = await POST(req({ ref: "EVX-1" }));
    expect(res.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("payment-link hides another business's booking from staff", async () => {
    state.roles = [{ tenant_id: "t2", role: "dispatcher" }];
    const { POST } = await import("./payment-link/route");
    const res = await POST(req({ ref: "EVX-1" }));
    expect(res.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("payment-link lets staff of the booking's business through to Stripe", async () => {
    state.roles = [{ tenant_id: "t1", role: "operator_admin" }];
    const { POST } = await import("./payment-link/route");
    await POST(req({ ref: "EVX-1" }));
    expect(fetch).toHaveBeenCalledWith("https://api.stripe.com/v1/checkout/sessions", expect.anything());
  });
});
