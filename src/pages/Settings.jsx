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

const SECTIONS = [
  { key: "business", label: "Business", icon: Building2 },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "fleet", label: "Fleet & Pricing", icon: Car },
  { key: "integrations", label: "Integrations", icon: Plug },
  { key: "security", label: "Security", icon: Shield },
];

function Toggle({ defaultOn = false }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      onClick={() => setOn(!on)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        on ? "bg-amber-500" : "bg-white/10"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function Field({ label, defaultValue, type = "text" }) {
  return (
    <div>
      <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">
        {label}
      </label>
      <input
        type={type}
        defaultValue={defaultValue}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/40 focus:bg-white/[0.05] transition"
      />
    </div>
  );
}

function BusinessSettings() {
  return (
    <div className="space-y-5">
      <Field label="Business Name" defaultValue="EV Exec" />
      <Field label="Contact Email" defaultValue="operator@evexec.co.uk" type="email" />
      <Field label="Phone Number" defaultValue="+44 1253 000000" />
      <Field label="Business Address" defaultValue="Blackpool, Lancashire, UK" />
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

function NotificationSettings() {
  return (
    <div className="space-y-5">
      {[
        { label: "New booking confirmation", on: true },
        { label: "Missed call alert", on: true },
        { label: "Driver status change", on: true },
        { label: "Flight delay detected", on: true },
        { label: "Daily revenue summary", on: false },
        { label: "Weekly analytics report", on: false },
      ].map((n) => (
        <div
          key={n.label}
          className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4"
        >
          <span className="text-sm text-white">{n.label}</span>
          <Toggle defaultOn={n.on} />
        </div>
      ))}
    </div>
  );
}

function FleetSettings() {
  return (
    <div className="space-y-5">
      <Field label="Standard Rate (MAN → Blackpool)" defaultValue="£160" />
      <Field label="Standard Rate (LPL → Blackpool)" defaultValue="£145" />
      <Field label="Waiting Time (per 15 min)" defaultValue="£15" />
      <Field label="Child Seat Surcharge" defaultValue="£10" />
      <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4">
        <span className="text-sm text-white">Show fixed prices on booking form</span>
        <Toggle defaultOn={true} />
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4">
        <span className="text-sm text-white">Auto-assign nearest available driver</span>
        <Toggle defaultOn={false} />
      </div>
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

function SecuritySettings() {
  return (
    <div className="space-y-5">
      <Field label="Current Password" type="password" defaultValue="" />
      <Field label="New Password" type="password" defaultValue="" />
      <Field label="Confirm New Password" type="password" defaultValue="" />
      <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4">
        <span className="text-sm text-white">Two-factor authentication</span>
        <Toggle defaultOn={false} />
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4">
        <span className="text-sm text-white">Session timeout (30 minutes)</span>
        <Toggle defaultOn={true} />
      </div>
    </div>
  );
}

const sectionContent = {
  business: BusinessSettings,
  notifications: NotificationSettings,
  fleet: FleetSettings,
  integrations: IntegrationSettings,
  security: SecuritySettings,
};

export default function Settings() {
  const [active, setActive] = useState("business");
  const Content = sectionContent[active];

  return (
    <div className="p-10">
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
          <Content />
          {active !== "integrations" && (
            <div className="mt-8 flex justify-end">
              <button className="rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-amber-400">
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
