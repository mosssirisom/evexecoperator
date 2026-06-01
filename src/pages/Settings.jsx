import React, { useState } from "react";
import {
  Building2,
  Bell,
  Car,
  Plug,
  Shield,
  ChevronRight,
  Check,
} from "lucide-react";
import { useToast } from "../components/Toast";

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
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
        value ? "bg-amber-500" : "bg-white/10"
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

function TextInput({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/40 focus:bg-white/[0.05] transition"
      />
    </div>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4">
      <span className="text-sm text-white">{label}</span>
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
          {["Manchester Airport", "Liverpool Airport", "Blackpool", "Lytham St Annes", "Preston"].map(
            (area) => (
              <span
                key={area}
                className="flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-300"
              >
                <Check className="h-3 w-3" />
                {area}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationSettings({ state, set }) {
  const items = [
    { key: "newBooking", label: "New booking confirmation" },
    { key: "missedCall", label: "Missed call alert" },
    { key: "driverStatus", label: "Driver status change" },
    { key: "flightDelay", label: "Flight delay detected" },
    { key: "dailySummary", label: "Daily revenue summary" },
    { key: "weeklyReport", label: "Weekly analytics report" },
  ];
  return (
    <div className="space-y-5">
      {items.map((n) => (
        <ToggleRow key={n.key} label={n.label} value={state[n.key]} onChange={set(n.key)} />
      ))}
    </div>
  );
}

function FleetSettings({ state, set }) {
  return (
    <div className="space-y-5">
      <TextInput label="Standard Rate (MAN → Blackpool)" value={state.rateMan} onChange={set("rateMan")} />
      <TextInput label="Standard Rate (LPL → Blackpool)" value={state.rateLpl} onChange={set("rateLpl")} />
      <TextInput label="Waiting Time (per 15 min)" value={state.rateWaiting} onChange={set("rateWaiting")} />
      <TextInput label="Child Seat Surcharge" value={state.rateChildSeat} onChange={set("rateChildSeat")} />
      <ToggleRow label="Show fixed prices on booking form" value={state.showPrices} onChange={set("showPrices")} />
      <ToggleRow label="Auto-assign nearest available driver" value={state.autoAssign} onChange={set("autoAssign")} />
    </div>
  );
}

function IntegrationItem({ name, description, connected }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <div>
        <p className="font-medium text-white">{name}</p>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      <button
        className={`rounded-xl border px-4 py-2 text-xs font-medium transition ${
          connected
            ? "border-emerald-400/20 text-emerald-300 hover:bg-emerald-400/10"
            : "border-amber-400/20 text-amber-300 hover:bg-amber-400/10"
        }`}
      >
        {connected ? "Connected" : "Connect"}
      </button>
    </div>
  );
}

function IntegrationSettings() {
  return (
    <div className="space-y-4">
      <IntegrationItem name="Supabase" description="Database & realtime backend" connected={false} />
      <IntegrationItem name="Twilio" description="SMS & voice for missed call recovery" connected={false} />
      <IntegrationItem name="Stripe" description="Payment processing & invoicing" connected={false} />
      <IntegrationItem name="Google Maps API" description="Live map & routing on dispatch board" connected={false} />
      <IntegrationItem name="EV Exec Driver App" description="Job dispatch to evexecdriverapp.vercel.app" connected={false} />
    </div>
  );
}

function SecuritySettings({ state, set }) {
  return (
    <div className="space-y-5">
      <TextInput label="Current Password" value={state.currentPassword} onChange={set("currentPassword")} type="password" />
      <TextInput label="New Password" value={state.newPassword} onChange={set("newPassword")} type="password" />
      <TextInput label="Confirm New Password" value={state.confirmPassword} onChange={set("confirmPassword")} type="password" />
      <ToggleRow label="Two-factor authentication" value={state.twoFactor} onChange={set("twoFactor")} />
      <ToggleRow label="Session timeout (30 minutes)" value={state.sessionTimeout} onChange={set("sessionTimeout")} />
    </div>
  );
}

const INITIAL = {
  business: { name: "EV Exec", email: "operator@evexec.co.uk", phone: "+44 1253 000000", address: "Blackpool, Lancashire, UK" },
  notifications: { newBooking: true, missedCall: true, driverStatus: true, flightDelay: true, dailySummary: false, weeklyReport: false },
  fleet: { rateMan: "£160", rateLpl: "£145", rateWaiting: "£15", rateChildSeat: "£10", showPrices: true, autoAssign: false },
  security: { currentPassword: "", newPassword: "", confirmPassword: "", twoFactor: false, sessionTimeout: true },
};

export default function Settings() {
  const [active, setActive] = useState("business");
  const [settings, setSettings] = useState(INITIAL);
  const toast = useToast();

  function set(section) {
    return (field) => (value) =>
      setSettings((prev) => ({
        ...prev,
        [section]: { ...prev[section], [field]: value },
      }));
  }

  function handleSave() {
    toast({ message: "Settings saved", type: "success" });
  }

  const sectionContent = {
    business: <BusinessSettings state={settings.business} set={set("business")} />,
    notifications: <NotificationSettings state={settings.notifications} set={set("notifications")} />,
    fleet: <FleetSettings state={settings.fleet} set={set("fleet")} />,
    integrations: <IntegrationSettings />,
    security: <SecuritySettings state={settings.security} set={set("security")} />,
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Sidebar nav */}
        <div className="card h-fit p-2">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-sm transition ${
                  active === s.key
                    ? "bg-amber-400/10 text-amber-300"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
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

        {/* Content panel */}
        <div className="card p-8">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.28em] text-amber-400">
              Settings
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
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
