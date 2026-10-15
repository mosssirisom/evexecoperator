// @vitest-environment node
// Fix 1 (audit C-1): after the database change, office staff still get the
// new-booking alert. The database (get_push_dispatch_bundle) decides WHICH
// devices are returned (only current office staff; tested in
// evexec/supabase/tests/fix1_office_push.test.sql); this checks the route
// sends to every device it is given and refuses a wrong secret.
import { describe, it, expect, vi, beforeEach } from "vitest";

const state: {
  bundle: unknown;
  rpcCalls: Array<[string, Record<string, unknown>]>;
  sent: Array<{ endpoint: string; payload: string }>;
  failWith: Record<string, number>;
} = { bundle: null, rpcCalls: [], sent: [], failWith: {} };

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push([fn, args]);
      if (fn === "get_push_dispatch_bundle") {
        return { data: args.p_secret === "right-secret" ? state.bundle : null, error: null };
      }
      return { data: null, error: null };
    },
  }),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: async (sub: { endpoint: string }, payload: string) => {
      const code = state.failWith[sub.endpoint];
      if (code) throw Object.assign(new Error("push failed"), { statusCode: code });
      state.sent.push({ endpoint: sub.endpoint, payload });
    },
  },
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";

const { POST } = await import("./route");

const staffDevices = [
  { endpoint: "https://push.example/admin-phone", p256dh: "k1", auth: "a1" },
  { endpoint: "https://push.example/dispatcher-pc", p256dh: "k2", auth: "a2" },
];

function call(secret: string, body: unknown) {
  return POST(new Request("https://ops.example/api/push/dispatch", {
    method: "POST",
    headers: { "content-type": "application/json", "x-webhook-secret": secret },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  state.bundle = { vapid_public: "pub", vapid_private: "priv", vapid_subject: "mailto:x@example.com", subscriptions: staffDevices };
  state.rpcCalls = []; state.sent = []; state.failWith = {};
});

describe("POST /api/push/dispatch", () => {
  it("sends the new-booking alert to every staff device in the bundle", async () => {
    const res = await call("right-secret", { record: { customer_name: "Jo Bloggs", ref: "EVX-1", pickup_location: "Lytham", airport: "Manchester", travel_date: "2026-11-01", travel_time: "09:30" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, sent: 2, removed: 0 });
    expect(state.sent.map((s) => s.endpoint)).toEqual(staffDevices.map((d) => d.endpoint));
    const p = JSON.parse(state.sent[0].payload);
    expect(p.title).toBe("New booking — Jo Bloggs");
    expect(p.body).toContain("09:30 01/11/2026");
  });

  it("sends website staff notices (e.g. payment received)", async () => {
    const res = await call("right-secret", { notification: { title: "EV Exec Payment Received", body: "EVX-1 £90.00", url: "/operator/bookings?q=EVX-1" } });
    expect(await res.json()).toMatchObject({ sent: 2 });
    expect(JSON.parse(state.sent[1].payload).title).toBe("EV Exec Payment Received");
  });

  it("refuses a wrong or missing secret and sends nothing", async () => {
    for (const s of ["wrong", ""]) {
      const res = await call(s, { record: { customer_name: "X" } });
      expect(res.status).toBe(401);
    }
    expect(state.sent).toEqual([]);
  });

  it("sends nothing when there are no staff devices", async () => {
    state.bundle = { ...(state.bundle as object), subscriptions: [] };
    expect(await (await call("right-secret", { record: {} })).json()).toEqual({ ok: true, sent: 0, removed: 0 });
  });

  it("one dead device doesn't stop the others", async () => {
    state.failWith[staffDevices[0].endpoint] = 410;
    expect(await (await call("right-secret", { record: {} })).json()).toEqual({ ok: true, sent: 1, removed: 1 });
    expect(state.sent.map((s) => s.endpoint)).toEqual([staffDevices[1].endpoint]);
  });
});
