import React, { useEffect, useState } from "react";
import { Building2, Plus, Loader2, Users, Mail, ShieldCheck } from "lucide-react";
import { useToast } from "../components/Toast";
import { listTenants, createTenant, listTenantUsers, inviteOperatorAdmin } from "../lib/tenants";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function CreateTenantForm({ onCreated }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleNameChange(value) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast({ message: "Name and slug are required", type: "error" });
      return;
    }
    setSubmitting(true);
    const res = await createTenant({ slug, name, contactEmail, contactPhone });
    setSubmitting(false);
    if (!res?.ok) {
      toast({ message: res?.reason || "Failed to create tenant", type: "error" });
      return;
    }
    toast({ message: `${name} created`, type: "success" });
    setName("");
    setSlug("");
    setSlugTouched(false);
    setContactEmail("");
    setContactPhone("");
    onCreated?.(res.tenant);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
        <Plus className="h-4 w-4 text-amber-400" /> New operator
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-slate-500">Business name</label>
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Acme Cars"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/40"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-slate-500">Slug</label>
          <input
            value={slug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
            placeholder="acme-cars"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/40"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-slate-500">Contact email</label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="ops@acmecars.co.uk"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/40"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-slate-500">Contact phone</label>
          <input
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+44 7700 900000"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/40"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="mt-4 flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#0B132B] transition hover:bg-amber-300 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Create operator
      </button>
    </form>
  );
}

function InviteForm({ tenantId, onInvited }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    const res = await inviteOperatorAdmin({
      tenantId,
      email: email.trim(),
      redirectTo: `${window.location.origin}/login`,
    });
    setSubmitting(false);
    if (!res?.ok) {
      toast({ message: res?.reason || "Failed to send invite", type: "error" });
      return;
    }
    toast({ message: `Invite sent to ${email}`, type: "success" });
    setEmail("");
    onInvited?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="new-admin@theiroperator.com"
        className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/40"
      />
      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-400/20 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
        Invite operator_admin
      </button>
    </form>
  );
}

function TenantCard({ tenant }) {
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState(null);
  const [loadingMembers, setLoadingMembers] = useState(false);

  async function loadMembers() {
    setLoadingMembers(true);
    const res = await listTenantUsers(tenant.id);
    setLoadingMembers(false);
    setMembers(res?.ok ? res.users : []);
  }

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && members === null) loadMembers();
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10">
            <Building2 className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{tenant.name}</p>
            <p className="text-xs text-slate-500">{tenant.slug} · {tenant.status}</p>
          </div>
        </div>
        <Users className="h-4 w-4 text-slate-500" />
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-5 py-4">
          {loadingMembers ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading members…
            </div>
          ) : (
            <div className="mb-4 space-y-2">
              {(members || []).length === 0 ? (
                <p className="text-sm text-slate-500">No members yet.</p>
              ) : (
                members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                    <span className="text-sm text-slate-300">{m.email || m.user_id}</span>
                    <span className="flex items-center gap-1 text-xs uppercase tracking-wide text-amber-300">
                      <ShieldCheck className="h-3 w-3" /> {m.role}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
          <InviteForm tenantId={tenant.id} onInvited={loadMembers} />
        </div>
      )}
    </div>
  );
}

export default function PlatformAdmin() {
  const [tenants, setTenants] = useState(null);
  const toast = useToast();

  async function loadTenants() {
    const res = await listTenants();
    if (!res?.ok) {
      toast({ message: res?.reason || "Failed to load tenants", type: "error" });
      setTenants([]);
      return;
    }
    setTenants(res.tenants);
  }

  useEffect(() => {
    loadTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Platform</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Operators</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every business running on this platform, and who has access to each one.
        </p>
      </div>

      <div className="mb-6">
        <CreateTenantForm onCreated={() => loadTenants()} />
      </div>

      {tenants === null ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading operators…
        </div>
      ) : tenants.length === 0 ? (
        <p className="text-sm text-slate-500">No operators yet.</p>
      ) : (
        <div className="space-y-3">
          {tenants.map((t) => (
            <TenantCard key={t.id} tenant={t} />
          ))}
        </div>
      )}
    </div>
  );
}
