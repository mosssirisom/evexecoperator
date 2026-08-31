"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Bell,
  Car,
  Plug,
  Shield,
  ChevronRight,
  Check,
  CheckCircle2,
  Circle,
  ExternalLink,
  Copy,
  Globe,
  BookOpen,
  UserCircle,
  Mail,
  MessageCircle,
  Smartphone,
  BellRing,
} from "lucide-react";
import { useOperatorToast } from "@/components/operator/Toast";
import { isConfigured } from "@/lib/supabase";
import { useNotificationCenter } from "@/hooks/operator/useNotificationCenter";
import { isPushSupported, getPushEnabled, enableOperatorPush, disableOperatorPush } from "@/lib/operator/push";
import { PORTALS } from "@/lib/operator/portals";

const SECTIONS = [
  { key: "business", label: "Business", icon: Building2 },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "fleet", label: "Fleet & Pricing", icon: Car },
  { key: "integrations", label: "Integrations", icon: Plug },
  { key: "security", label: "Security", icon: Shield },
];

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-checked={value}
      role="switch"
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
        value ? "bg-amber-500" : "bg-slate-100"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function TextInput({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div>
      <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#0F1B33] outline-none placeholder:text-slate-400 transition focus:border-amber-400/40 focus:bg-slate-50"
      />
    </div>
  );
}

function ToggleRow({ label, value, onChange, description }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
      <div className="min-w-0">
        <span className="text-sm text-[#0F1B33]">{label}</span>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

function BusinessSettings({ state, set }) {
  return (
    <div className="space-y-5">
      <TextInput label="Business Name" value={state.name} onChange={set("name")} />
      <TextInput label="Contact Email" value={state.email} onChange={set("email")} type="email" />
      <TextInput label="Phone Number" value={state.phone} onChange={set("phone")} />
      <TextInput label="Business Address" value={state.address} onChange={set("address")} />
      <div>
        <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">
          Operating Area
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            "Manchester Airport",
            "Liverpool Airport",
            "Blackpool",
            "Lytham St Annes",
            "Preston",
          ].map((area) => (
            <span
              key={area}
              className="flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-600"
            >
              <Check className="h-3 w-3" />
              {area}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const NOTIF_TYPE_LABELS = {
  received: "Customer confirmation",
  reminder_24h: "Customer 24h reminder",
  status_update: "Customer live update",
  driver_allocated: "Driver — new job",
  driver_reminder_24h: "Driver 24h reminder",
};

function channelChipCls(ch) {
  return {
    email: "border-blue-400/30 bg-blue-400/10 text-blue-600",
    sms: "border-violet-400/30 bg-violet-400/10 text-violet-300",
    whatsapp: "border-emerald-400/30 bg-emerald-400/10 text-emerald-600",
    push: "border-amber-400/30 bg-amber-400/10 text-amber-600",
  }[ch] || "border-slate-200 text-slate-500";
}

function deliveryState(row) {
  if (row.has_error) return { label: "Failed", cls: "text-red-600" };
  if (row.status === "sent") return { label: "Delivered", cls: "text-emerald-600" };
  if (row.delivery_status === "retrying") return { label: "Retrying", cls: "text-amber-600" };
  return { label: "Queued", cls: "text-slate-500" };
}

function notifWhen(x) {
  if (!x) return "";
  const d = new Date(x);
  if (isNaN(d)) return "";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Enable/disable Web Push on the current device (operator gets pinged when a
// website booking comes in, even with the app closed).
function PushDeviceRow() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setSupported(isPushSupported());
    getPushEnabled().then(setEnabled).catch(() => {});
  }, []);

  const toggle = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (enabled) { await disableOperatorPush(); setEnabled(false); }
      else { await enableOperatorPush(); setEnabled(true); }
    } catch (e) {
      setErr(e?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <BellRing className="h-4 w-4 flex-shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#0F1B33]">Push notifications on this device</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            {supported
              ? "Get an alert on this device when a booking comes in from the website — even with the app closed."
              : "This browser can't do push. On iPhone, add the app to your Home Screen first, then open it and try again."}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={busy || !supported}
          className={`flex-shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
            enabled ? "border border-slate-200 text-slate-600 hover:text-[#0F1B33]" : "bg-amber-500 text-black hover:bg-amber-400"
          }`}
        >
          {busy ? "…" : enabled ? "Turn off" : "Enable"}
        </button>
      </div>
      {err && <p className="mt-2 text-[11px] text-red-600">{err}</p>}
      {enabled && !err && <p className="mt-2 text-[11px] text-emerald-600">This device is set up for push alerts.</p>}
    </div>
  );
}

// Central notification control — channel priority, the "SMS only when necessary"
// switch, and a live delivery log (channel used + whether delivered).
function NotificationCenter() {
  const { settings, activity, loading, saving, error, update } = useNotificationCenter();

  const channels = [
    { key: "push", n: 1, icon: BellRing, label: "Push / in-app", connected: false },
    { key: "email", n: 2, icon: Mail, label: "Email", connected: true, enabled: settings.email_enabled, toggle: "email_enabled" },
    { key: "whatsapp", n: 3, icon: MessageCircle, label: "WhatsApp", connected: false },
    { key: "sms", n: 4, icon: Smartphone, label: "SMS", connected: true, enabled: settings.sms_enabled, toggle: "sms_enabled" },
  ];

  return (
    <div className="space-y-6">
      <PushDeviceRow />

      <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4 text-xs leading-relaxed text-slate-600">
        <p className="mb-1 font-semibold text-amber-600">How messages are sent</p>
        Confirmations and 24-hour reminders go out on the highest-priority channel available for that
        person — <strong>email first</strong>, falling back to SMS only when there's no email. Time-critical
        alerts (a driver's new job, and “driver on the way / arrived”) always use SMS. Every message is sent on a
        single channel, so no one is texted and emailed the same thing.
      </div>

      <div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">Channel priority</p>
        <div className="space-y-2">
          {channels.map((c) => (
            <div key={c.key} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-500">{c.n}</span>
              <c.icon className="h-4 w-4 flex-shrink-0 text-slate-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#0F1B33]">{c.label}</p>
                {!c.connected && <p className="text-[11px] text-slate-600">Not connected yet</p>}
              </div>
              {c.connected ? (
                <Toggle value={!!c.enabled} onChange={(v) => update({ [c.toggle]: v })} />
              ) : (
                <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-medium text-slate-500">Coming soon</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <ToggleRow
        label="Use SMS only when necessary"
        description="Prefer email for confirmations & reminders; keep SMS for time-critical alerts. Cuts Twilio spend."
        value={!!settings.sms_only_when_necessary}
        onChange={(v) => update({ sms_only_when_necessary: v })}
      />

      {saving && <p className="text-[11px] text-slate-500">Saving…</p>}
      {error && <p className="text-[11px] text-red-600">{error}</p>}

      <div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">Recent notifications</p>
        <div className="divide-y divide-white/5 rounded-2xl border border-slate-100 bg-slate-50">
          {loading ? (
            <p className="px-4 py-6 text-center text-xs text-slate-600">Loading…</p>
          ) : activity.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-600">No notifications sent yet.</p>
          ) : (
            activity.map((row) => {
              const d = deliveryState(row);
              return (
                <div key={row.id} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-700">{NOTIF_TYPE_LABELS[row.type] || row.type}</p>
                    <p className="text-[10px] text-slate-600">{notifWhen(row.sent_at || row.created_at)}</p>
                  </div>
                  <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${channelChipCls(row.channel)}`}>{row.channel}</span>
                  <span className={`w-16 flex-shrink-0 text-right text-[11px] font-medium ${d.cls}`}>{d.label}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationSettings({ state, set }) {
  const items = [
    { key: "newBooking", label: "New booking confirmation", description: "Alert when a booking is created" },
    { key: "missedCall", label: "Missed call alert", description: "Immediate notification for missed calls" },
    { key: "driverStatus", label: "Driver status change", description: "When a driver's availability changes" },
    { key: "flightDelay", label: "Flight delay detected", description: "Auto-monitors connected flights" },
    { key: "dailySummary", label: "Daily revenue summary", description: "End-of-day report via email" },
    { key: "weeklyReport", label: "Weekly analytics report", description: "Sent every Monday morning" },
  ];
  return (
    <div className="space-y-4">
      {items.map((n) => (
        <ToggleRow
          key={n.key}
          label={n.label}
          description={n.description}
          value={state[n.key]}
          onChange={set(n.key)}
        />
      ))}
    </div>
  );
}

function FleetSettings({ state, set }) {
  return (
    <div className="space-y-5">
      <TextInput
        label="Standard Rate (MAN → Blackpool)"
        value={state.rateMan}
        onChange={set("rateMan")}
        placeholder="£160"
      />
      <TextInput
        label="Standard Rate (LPL → Blackpool)"
        value={state.rateLpl}
        onChange={set("rateLpl")}
        placeholder="£145"
      />
      <TextInput
        label="Waiting Time (per 15 min)"
        value={state.rateWaiting}
        onChange={set("rateWaiting")}
        placeholder="£15"
      />
      <TextInput
        label="Child Seat Surcharge"
        value={state.rateChildSeat}
        onChange={set("rateChildSeat")}
        placeholder="£10"
      />
      <ToggleRow
        label="Show fixed prices on booking form"
        value={state.showPrices}
        onChange={set("showPrices")}
      />
      <ToggleRow
        label="Auto-assign nearest available driver"
        value={state.autoAssign}
        onChange={set("autoAssign")}
      />
    </div>
  );
}

const PORTAL_ICONS = {
  driverApp: Car,
  bookingForm: BookOpen,
  customerAccount: UserCircle,
  website: Globe,
};

function PortalRow({ portalKey, toast }) {
  const portal = PORTALS[portalKey];
  const Icon = PORTAL_ICONS[portalKey] ?? Globe;
  const [copied, setCopied] = useState(false);

  const handleOpen = () => {
    window.open(portal.url, "_blank", "noopener,noreferrer");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(portal.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ message: "URL copied to clipboard", type: "success" });
    } catch {
      toast({ message: "Copy failed — please copy manually", type: "error" });
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
          <Icon className="h-4 w-4 text-amber-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[#0F1B33]">{portal.label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{portal.description}</p>
          <p className="mt-2 truncate font-mono text-[11px] text-slate-600">{portal.url}</p>
          <p className="mt-1 text-[10px] text-slate-700">env: {portal.envKey}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={handleOpen}
          className="flex items-center gap-1.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-xs font-medium text-amber-600 transition hover:bg-amber-400/10"
        >
          <ExternalLink className="h-3 w-3" />
          Open
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-500 transition hover:border-slate-300 hover:text-[#0F1B33]"
        >
          <Copy className="h-3 w-3" />
          {copied ? "Copied!" : "Copy URL"}
        </button>
      </div>
    </div>
  );
}

function IntegrationItem({ name, description, connected, onAction, actionLabel }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {connected ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <Circle className="h-4 w-4 text-slate-600" />
          )}
        </div>
        <div>
          <p className="font-medium text-[#0F1B33]">{name}</p>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <button
        onClick={onAction}
        className={`flex-shrink-0 rounded-xl border px-4 py-2 text-xs font-medium transition ${
          connected
            ? "border-emerald-400/20 text-emerald-600 hover:bg-emerald-400/10"
            : "border-amber-400/20 text-amber-600 hover:bg-amber-400/10"
        }`}
      >
        {actionLabel ?? (connected ? "Connected" : "Connect")}
      </button>
    </div>
  );
}

function IntegrationSettings({ toast }) {
  return (
    <div className="space-y-8">
      {/* Portals & Website */}
      <div>
        <p className="mb-1 text-xs uppercase tracking-[0.28em] text-amber-600">Portals & Website</p>
        <p className="mb-4 text-xs text-slate-500">
          Quick-launch links for the driver portal and customer-facing website pages. Override any URL
          by setting the corresponding environment variable.
        </p>
        <div className="space-y-3">
          {(["driverApp", "bookingForm", "customerAccount", "website"]).map((key) => (
            <PortalRow key={key} portalKey={key} toast={toast} />
          ))}
        </div>
      </div>

      {/* Backend services */}
      <div>
        <p className="mb-4 text-xs uppercase tracking-[0.28em] text-amber-600">Backend Services</p>
        <div className="space-y-4">
          <IntegrationItem
            name="Supabase"
            description="Database & realtime backend"
            connected={isConfigured}
            onAction={() =>
              toast({
                message: isConfigured
                  ? "Supabase is connected and live"
                  : "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment",
                type: isConfigured ? "success" : "info",
              })
            }
            actionLabel={isConfigured ? "Connected" : "Configure"}
          />
          <IntegrationItem
            name="EV Exec Driver App"
            description={`Real-time job dispatch to ${PORTALS.driverApp.url}`}
            connected={isConfigured}
            onAction={() => {
              window.open(PORTALS.driverApp.url, "_blank", "noopener,noreferrer");
            }}
            actionLabel={isConfigured ? "Open Portal" : "Requires Supabase"}
          />
          <IntegrationItem
            name="Twilio"
            description="Customer SMS: confirmations, 24h reminders & status updates"
            connected={true}
            actionLabel="Live"
            onAction={() => toast({ message: "Twilio SMS is live — booking, reminder and status texts are sending", type: "success" })}
          />
          <IntegrationItem
            name="Stripe"
            description="Payment links + auto-reconcile webhook (mark Paid on payment)"
            connected={true}
            actionLabel="Live"
            onAction={() => toast({ message: "Stripe payment links are live. Manage keys in the Vercel environment settings.", type: "success" })}
          />
          <IntegrationItem
            name="Google Maps API"
            description="Live map & routing on dispatch board"
            connected={false}
            onAction={() => toast({ message: "Maps integration coming soon", type: "info" })}
          />
        </div>
      </div>
    </div>
  );
}

function SecuritySettings({ state, set }) {
  return (
    <div className="space-y-5">
      <TextInput
        label="Current Password"
        value={state.currentPassword}
        onChange={set("currentPassword")}
        type="password"
        placeholder="••••••••"
      />
      <TextInput
        label="New Password"
        value={state.newPassword}
        onChange={set("newPassword")}
        type="password"
        placeholder="••••••••"
      />
      <TextInput
        label="Confirm New Password"
        value={state.confirmPassword}
        onChange={set("confirmPassword")}
        type="password"
        placeholder="••••••••"
      />
      <ToggleRow
        label="Two-factor authentication"
        description="Adds an extra layer of login security"
        value={state.twoFactor}
        onChange={set("twoFactor")}
      />
      <ToggleRow
        label="Session timeout (30 minutes)"
        description="Auto-logout after inactivity"
        value={state.sessionTimeout}
        onChange={set("sessionTimeout")}
      />
    </div>
  );
}

const STORAGE_KEY = "evexec_settings";

const INITIAL = {
  business: {
    name: "EV Exec",
    email: "operator@evexec.co.uk",
    phone: "+44 1253 000000",
    address: "Blackpool, Lancashire, UK",
  },
  notifications: {
    newBooking: true,
    missedCall: true,
    driverStatus: true,
    flightDelay: true,
    dailySummary: false,
    weeklyReport: false,
  },
  fleet: {
    rateMan: "£160",
    rateLpl: "£145",
    rateWaiting: "£15",
    rateChildSeat: "£10",
    showPrices: true,
    autoAssign: false,
  },
  security: {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    twoFactor: false,
    sessionTimeout: true,
  },
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const saved = JSON.parse(raw);
    return {
      business: { ...INITIAL.business, ...saved.business },
      notifications: { ...INITIAL.notifications, ...saved.notifications },
      fleet: { ...INITIAL.fleet, ...saved.fleet },
      security: { ...INITIAL.security, ...saved.security },
    };
  } catch {
    return INITIAL;
  }
}

export default function Settings() {
  const [active, setActive] = useState("business");
  const [settings, setSettings] = useState(loadSettings);
  const toast = useOperatorToast();

  function set(section) {
    return (field) => (value) =>
      setSettings((prev) => ({
        ...prev,
        [section]: { ...prev[section], [field]: value },
      }));
  }

  function handleSave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      toast({ message: "Settings saved successfully", type: "success" });
    } catch {
      toast({ message: "Failed to save — storage may be full", type: "error" });
    }
  }

  const sectionContent = {
    business: <BusinessSettings state={settings.business} set={set("business")} />,
    notifications: (
      <div className="space-y-8">
        <NotificationCenter />
        <div>
          <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-slate-500">Alert preferences</p>
          <NotificationSettings state={settings.notifications} set={set("notifications")} />
        </div>
      </div>
    ),
    fleet: <FleetSettings state={settings.fleet} set={set("fleet")} />,
    integrations: <IntegrationSettings toast={toast} />,
    security: <SecuritySettings state={settings.security} set={set("security")} />,
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      {/* Mobile: horizontal scrollable tab strip */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-100 bg-white p-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={`flex flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition ${
                active === s.key
                  ? "bg-amber-400/10 text-amber-600"
                  : "text-slate-500 hover:text-[#0F1B33]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Desktop sidebar nav */}
        <div className="hidden h-fit lg:block">
          <div className="card p-2">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.key}
                  onClick={() => setActive(s.key)}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-sm transition ${
                    active === s.key
                      ? "bg-amber-400/10 text-amber-600"
                      : "text-slate-500 hover:bg-slate-100 hover:text-[#0F1B33]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    {s.label}
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 opacity-40" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Content panel */}
        <div className="card p-6 sm:p-8">
          <div className="mb-6 sm:mb-8">
            <p className="text-xs uppercase tracking-[0.28em] text-amber-600">Settings</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#0F1B33]">
              {SECTIONS.find((s) => s.key === active)?.label}
            </h2>
          </div>
          {sectionContent[active]}
          {active !== "integrations" && (
            <div className="mt-8 flex justify-end">
              <button
                onClick={handleSave}
                className="rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-amber-400"
              >
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}