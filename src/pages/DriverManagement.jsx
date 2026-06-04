import React, { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Car, Phone, Star, CheckCircle2, Clock, UserX, MoreVertical, Plus, X,
  User, Hash, Truck, MapPin, ExternalLink, Edit2, Trash2, Mail,
} from "lucide-react";
import { useDrivers } from "../hooks/useDrivers";
import { useBookings } from "../hooks/useBookings";
import { useToast } from "../components/Toast";
import { bookingStatusColor } from "../lib/statusColor";
import { PORTALS } from "../lib/portals";

function statusBadge(status) {
  if (status === "Available") return "text-emerald-300 bg-emerald-400/10 border-emerald-400/20";
  if (status === "En route" || status === "Passenger onboard")
    return "text-blue-300 bg-blue-400/10 border-blue-400/20";
  if (status === "Available soon")
    return "text-amber-300 bg-amber-400/10 border-amber-400/20";
  return "text-slate-400 bg-slate-500/10 border-slate-500/20";
}

// ── Shared driver form fields ─────────────────────────────────────────────────
const DRIVER_FIELDS = [
  { key: "name",    label: "Full Name",    placeholder: "James Whitmore",        icon: User,  type: "text"  },
  { key: "phone",   label: "Phone",        placeholder: "+44 7700 900000",       icon: Phone, type: "tel"   },
  { key: "email",   label: "Email",        placeholder: "driver@example.com",    icon: Mail,  type: "email" },
  { key: "vehicle", label: "Vehicle",      placeholder: "Tesla Model Y",         icon: Truck, type: "text"  },
  { key: "plate",   label: "Plate Number", placeholder: "EV21 XYZ",              icon: Hash,  type: "text"  },
];

// ── Driver form modal (used for both Add and Edit) ────────────────────────────
function DriverFormModal({ title, initial, submitLabel, onClose, onSubmit }) {
  const [form, setForm] = useState(
    initial ?? { name: "", phone: "", email: "", vehicle: "", plate: "" }
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setSubmitError(err?.message ?? "An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#0B132B] shadow-2xl sm:max-w-md sm:rounded-3xl">
        {/* Mobile drag handle */}
        <div className="flex flex-shrink-0 justify-center pb-1 pt-3 sm:hidden">
          <div className="h-1 w-12 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/5 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Fleet</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 text-slate-400 transition hover:border-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <form onSubmit={handleSubmit} className="grid gap-4 p-6">
            {DRIVER_FIELDS.map(({ key, label, placeholder, icon: Icon, type }) => (
              <div key={key}>
                <label className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                  <Icon className="h-3.5 w-3.5" />
                  {label}{key === "name" && <span className="text-red-400">*</span>}
                </label>
                <input
                  type={type}
                  value={form[key] ?? ""}
                  onChange={set(key)}
                  placeholder={placeholder}
                  required={key === "name"}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 transition focus:border-amber-400/40"
                />
              </div>
            ))}

            {submitError && (
              <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs text-red-300">
                {submitError}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-white/10 py-3 text-sm text-slate-400 transition hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !form.name.trim()}
                className="flex-1 rounded-2xl bg-amber-500 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Saving…" : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────
function DeleteDriverModal({ driver, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onConfirm();
    } catch (err) {
      setDeleteError(err?.message ?? "Failed to remove driver.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/10 bg-[#0B132B] p-6 shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10">
          <Trash2 className="h-5 w-5 text-red-300" />
        </div>
        <h2 className="text-lg font-semibold text-white">Remove {driver.name}?</h2>
        <p className="mt-2 text-sm text-slate-400">
          This will permanently remove the driver from the fleet. Any bookings currently assigned to them will become unassigned.
        </p>
        {deleteError && (
          <p className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs text-red-300">
            {deleteError}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 rounded-2xl border border-white/10 py-3 text-sm text-slate-400 transition hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 rounded-2xl border border-red-400/20 bg-red-400/10 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-400/20 disabled:opacity-50"
          >
            {deleting ? "Removing…" : "Remove Driver"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assign Job Modal ──────────────────────────────────────────────────────────
function AssignJobModal({ driver, bookings, onAssign, onClose }) {
  const assignable = useMemo(
    () =>
      bookings.filter(
        (b) =>
          !["Completed", "Cancelled"].includes(b.status) &&
          b.driverId !== driver.id
      ),
    [bookings, driver.id]
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-lg flex-col rounded-3xl border border-white/10 bg-[#0B132B] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Fleet</p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Assign job to {driver.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 text-slate-400 transition hover:border-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-4">
          {assignable.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600">
              No available bookings to assign.
            </p>
          ) : (
            <div className="space-y-2">
              {assignable.map((b) => (
                <button
                  key={b.id}
                  onClick={() => onAssign(b)}
                  className="w-full rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-left transition hover:border-amber-400/30 hover:bg-amber-400/[0.05]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">{b.id}</span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${bookingStatusColor(b.status)}`}
                        >
                          {b.status}
                        </span>
                      </div>
                      <p className="mt-1 font-medium text-white">{b.customer}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{b.route}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-semibold text-amber-300">{b.price}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{b.time}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-white/5 p-4">
          <button
            onClick={onClose}
            className="w-full rounded-2xl border border-white/10 py-3 text-sm text-slate-400 transition hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Driver context menu (MoreVertical) ────────────────────────────────────────
function DriverMenu({ driver, onClose, onUpdateStatus, onAssignJob, onEdit, onDelete }) {
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [onClose]);

  const statusOptions = ["Available", "Available soon", "Off duty"];

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-1 w-48 rounded-2xl border border-white/10 bg-[#0B132B] py-1 shadow-2xl"
    >
      <a
        href={`tel:${driver.phone}`}
        onClick={onClose}
        className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-300 transition hover:bg-white/5"
      >
        <Phone className="h-3.5 w-3.5 text-slate-500" />
        Call Driver
      </a>
      {driver.email && (
        <a
          href={`mailto:${driver.email}`}
          onClick={onClose}
          className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-300 transition hover:bg-white/5"
        >
          <Mail className="h-3.5 w-3.5 text-slate-500" />
          Email Driver
        </a>
      )}
      <button
        onClick={() => { onAssignJob(driver); onClose(); }}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs text-slate-300 transition hover:bg-white/5"
      >
        <Car className="h-3.5 w-3.5 text-slate-500" />
        Assign Job
      </button>
      <a
        href={PORTALS.driverApp.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClose}
        className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-300 transition hover:bg-white/5"
      >
        <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
        Driver Portal
      </a>

      <div className="my-1 border-t border-white/5" />

      {statusOptions.map((s) => (
        <button
          key={s}
          onClick={() => { onUpdateStatus(driver.id, s); onClose(); }}
          className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-xs transition hover:bg-white/5 ${
            driver.status === s ? "text-amber-300" : "text-slate-400"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              s === "Available"
                ? "bg-emerald-400"
                : s === "Available soon"
                ? "bg-amber-400"
                : "bg-slate-500"
            }`}
          />
          {s}
        </button>
      ))}

      <div className="my-1 border-t border-white/5" />

      <button
        onClick={() => { onEdit(driver); onClose(); }}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs text-slate-300 transition hover:bg-white/5"
      >
        <Edit2 className="h-3.5 w-3.5 text-slate-500" />
        Edit Details
      </button>
      <button
        onClick={() => { onDelete(driver); onClose(); }}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs text-red-400 transition hover:bg-red-400/[0.06]"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Remove Driver
      </button>
    </div>
  );
}

// ── Driver Card ───────────────────────────────────────────────────────────────
function DriverCard({ driver, onAssignJob, onUpdateStatus, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="card relative flex flex-col gap-5 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 text-xl font-semibold text-amber-300">
            {driver.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div>
            <h3 className="font-semibold text-white">{driver.name}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{driver.plate}</p>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-white/5 hover:text-slate-400"
            title="Driver options"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <DriverMenu
              driver={driver}
              onClose={() => setMenuOpen(false)}
              onUpdateStatus={onUpdateStatus}
              onAssignJob={onAssignJob}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}
        </div>
      </div>

      <span
        className={`self-start rounded-full border px-3 py-1 text-xs font-medium ${statusBadge(driver.status)}`}
      >
        {driver.status}
      </span>

      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-slate-400">
          <Car className="h-4 w-4 text-slate-600" />
          {driver.vehicle}
        </div>
        <a
          href={`tel:${driver.phone}`}
          className="flex items-center gap-2 text-slate-400 transition hover:text-white"
        >
          <Phone className="h-4 w-4 text-slate-600" />
          {driver.phone}
        </a>
        {driver.email && (
          <a
            href={`mailto:${driver.email}`}
            className="flex items-center gap-2 truncate text-slate-400 transition hover:text-white"
          >
            <Mail className="h-4 w-4 flex-shrink-0 text-slate-600" />
            {driver.email}
          </a>
        )}
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="h-4 w-4 text-slate-600" />
          {driver.job}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/5 pt-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-white">{driver.completedToday}</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Today</p>
        </div>
        <div className="text-center">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <p className="text-lg font-semibold text-white">{driver.rating}</p>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Rating</p>
        </div>
        <button
          onClick={() => onEdit(driver)}
          className="min-h-[44px] rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300 transition hover:border-amber-400/20 hover:text-amber-300"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DriverManagement() {
  const navigate = useNavigate();
  const toast = useToast();
  const { drivers, updateStatus, createDriver, updateDriver, deleteDriver } = useDrivers();
  const { bookings, assignDriver } = useBookings();
  const [assignModal, setAssignModal] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(null);   // driver object to edit
  const [deleteModal, setDeleteModal] = useState(null); // driver object to delete

  const available = drivers.filter((d) => ["Available", "Available soon"].includes(d.status)).length;
  const active = drivers.filter((d) => ["En route", "Passenger onboard"].includes(d.status)).length;
  const offDuty = drivers.length - active - available;

  const todayJobs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return bookings
      .filter((b) => {
        if (!b.pickupTime) return false;
        const d = new Date(b.pickupTime);
        return d >= today && d < tomorrow && b.driver !== "Unassigned";
      })
      .sort((a, b) => new Date(a.pickupTime) - new Date(b.pickupTime));
  }, [bookings]);

  const handleAssign = async (booking) => {
    if (!assignModal) return;
    try {
      await assignDriver(booking.id, assignModal.id);
      toast({ message: `${booking.customer} → ${assignModal.name}`, type: "success" });
      setAssignModal(null);
    } catch (err) {
      toast({ message: err?.message ?? "Failed to assign driver", type: "error" });
    }
  };

  const handleAddDriver = async (form) => {
    await createDriver(form);
    toast({ message: `${form.name} added to the fleet`, type: "success" });
    setAddModal(false);
  };

  const handleEditDriver = async (form) => {
    await updateDriver(editModal.id, form);
    toast({ message: `${form.name} updated`, type: "success" });
    setEditModal(null);
  };

  const handleDeleteDriver = async () => {
    await deleteDriver(deleteModal.id);
    toast({ message: `${deleteModal.name} removed from fleet`, type: "success" });
    setDeleteModal(null);
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await updateStatus(id, status);
      toast({ message: `Status updated to ${status}`, type: "success" });
    } catch (err) {
      toast({ message: err?.message ?? "Failed to update status", type: "error" });
    }
  };

  return (
    <>
      {assignModal && (
        <AssignJobModal
          driver={assignModal}
          bookings={bookings}
          onAssign={handleAssign}
          onClose={() => setAssignModal(null)}
        />
      )}
      {addModal && (
        <DriverFormModal
          title="Add Driver"
          submitLabel="Add Driver"
          onClose={() => setAddModal(false)}
          onSubmit={handleAddDriver}
        />
      )}
      {editModal && (
        <DriverFormModal
          title="Edit Driver"
          submitLabel="Save Changes"
          initial={{ name: editModal.name, phone: editModal.phone === "—" ? "" : editModal.phone, email: editModal.email ?? "", vehicle: editModal.vehicle === "—" ? "" : editModal.vehicle, plate: editModal.plate === "—" ? "" : editModal.plate }}
          onClose={() => setEditModal(null)}
          onSubmit={handleEditDriver}
        />
      )}
      {deleteModal && (
        <DeleteDriverModal
          driver={deleteModal}
          onClose={() => setDeleteModal(null)}
          onConfirm={handleDeleteDriver}
        />
      )}

      <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 lg:p-10">
        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[
            { label: "Total Drivers", value: drivers.length, icon: CheckCircle2, color: "text-white" },
            { label: "On Job", value: active, icon: Car, color: "text-blue-300" },
            { label: "Available", value: available, icon: CheckCircle2, color: "text-emerald-300" },
            { label: "Off Duty", value: offDuty < 0 ? 0 : offDuty, icon: UserX, color: "text-slate-400" },
          ].map((s) => (
            <div key={s.label} className="card p-4 sm:p-5">
              <div className="mb-2 flex items-center justify-between sm:mb-3">
                <s.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${s.color}`} />
                <span className="text-[9px] uppercase tracking-[0.2em] text-slate-600 sm:text-[10px]">Live</span>
              </div>
              <p className={`text-2xl font-semibold sm:text-3xl ${s.color}`}>{s.value}</p>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Section header + Add Driver */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Fleet</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Active Drivers</h2>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={PORTALS.driverApp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:border-amber-400/20 hover:text-amber-300"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Driver Portal</span>
            </a>
            <button
              onClick={() => setAddModal(true)}
              className="flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 sm:px-5 sm:py-3"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Driver</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        {/* Driver cards grid */}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {drivers.map((driver) => (
            <DriverCard
              key={driver.id}
              driver={driver}
              onAssignJob={setAssignModal}
              onUpdateStatus={handleUpdateStatus}
              onEdit={setEditModal}
              onDelete={setDeleteModal}
            />
          ))}
          {drivers.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-16">
              <Car className="mb-3 h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-600">No drivers in the fleet yet.</p>
              <button
                onClick={() => setAddModal(true)}
                className="mt-4 rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-400 transition hover:text-amber-300"
              >
                + Add your first driver
              </button>
            </div>
          )}
        </div>

        {/* Today's scheduled jobs */}
        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Schedule</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Today's Jobs</h2>
              <p className="mt-1 text-sm text-slate-500">
                {todayJobs.length === 0
                  ? "No scheduled jobs for today"
                  : `${todayJobs.length} job${todayJobs.length > 1 ? "s" : ""} scheduled`}
              </p>
            </div>
            <button
              onClick={() => navigate("/dispatch")}
              className="min-h-[36px] px-2 text-xs text-slate-500 transition hover:text-amber-300"
            >
              Full dispatch board →
            </button>
          </div>

          {todayJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-12">
              <MapPin className="mb-3 h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-600">No pickups with a scheduled time for today.</p>
              <button
                onClick={() => navigate("/dispatch")}
                className="mt-4 rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-400 transition hover:text-amber-300"
              >
                Go to Dispatch Board
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left">
                    {["Time", "Customer", "Route", "Driver", "Price", "Status"].map((h) => (
                      <th
                        key={h}
                        className="pb-3 pr-6 text-[10px] font-normal uppercase tracking-[0.2em] text-slate-600"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {todayJobs.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => navigate("/dispatch")}
                      className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="py-3 pr-6 font-semibold text-white">{b.time}</td>
                      <td className="py-3 pr-6 text-slate-300">{b.customer}</td>
                      <td className="max-w-[180px] truncate py-3 pr-6 text-slate-400">{b.route}</td>
                      <td className="py-3 pr-6 text-slate-300">{b.driver}</td>
                      <td className="py-3 pr-6 font-semibold text-amber-300">{b.price}</td>
                      <td className="py-3">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${bookingStatusColor(b.status)}`}
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
