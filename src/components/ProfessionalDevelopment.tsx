/* ═══════════ Professional Development ════════════════════════════════════
   A teacher's own record of the training they have done: what they attended,
   when, how many hours it counted for, and the certificate to prove it.

   Two dates are kept deliberately. `dateAttended` is when the training
   happened; `dateSubmitted` is when the evidence was actually filed. They are
   rarely the same day, and it is the gap between them that a coordinator
   chases — so a record with no evidence is shown as outstanding rather than
   quietly counted. Only hours with evidence attached count toward the target. */

import { useMemo, useRef, useState } from "react";
import {
  Award,
  CalendarDays,
  Check,
  FileUp,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { PDEvidenceFile, PDLog, PDRecord } from "../types";

const KINDS: { id: PDRecord["kind"]; label: string }[] = [
  { id: "course", label: "Course" },
  { id: "workshop", label: "Workshop" },
  { id: "webinar", label: "Webinar" },
  { id: "conference", label: "Conference" },
  { id: "in-house", label: "In-house training" },
  { id: "other", label: "Other" },
];

const today = () => new Date().toISOString().slice(0, 10);

/** dd/mm/yyyy — the school runs on UK conventions. */
const showDate = (iso?: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

const blankRecord = (): PDRecord => ({
  id: `pd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: "",
  provider: "",
  kind: "workshop",
  hours: 1,
  dateAttended: today(),
  dateSubmitted: "",
  evidence: [],
  notes: "",
});

export default function ProfessionalDevelopment({
  log,
  onChange,
  onUpload,
  teacherName,
}: {
  log: PDLog;
  onChange: (next: PDLog) => void;
  /** Puts a file on the share host and returns its link. */
  onUpload: (file: File) => Promise<string>;
  teacherName?: string;
}) {
  const [editing, setEditing] = useState<PDRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => {
    // Evidence is the point of the record, so unevidenced hours are counted
    // separately rather than toward the target — otherwise the progress bar
    // says a teacher is done when nothing has been proven.
    const done = log.records.filter((r) => r.evidence.length > 0);
    const counted = done.reduce((n, r) => n + (Number(r.hours) || 0), 0);
    const awaiting = log.records
      .filter((r) => r.evidence.length === 0)
      .reduce((n, r) => n + (Number(r.hours) || 0), 0);
    const target = Number(log.targetHours) || 0;
    return {
      counted,
      awaiting,
      target,
      remaining: Math.max(0, target - counted),
      pct: target > 0 ? Math.min(100, Math.round((counted / target) * 100)) : 0,
      complete: target > 0 && counted >= target,
      outstanding: log.records.filter((r) => r.evidence.length === 0).length,
    };
  }, [log]);

  const save = (rec: PDRecord) => {
    const clean: PDRecord = {
      ...rec,
      title: rec.title.trim() || "Untitled training",
      hours: Math.max(0, Number(rec.hours) || 0),
      // Filing evidence is what "submitted" means, so stamp the date the first
      // time a file is attached rather than making the teacher remember.
      dateSubmitted:
        rec.evidence.length > 0 ? rec.dateSubmitted || today() : "",
    };
    const exists = log.records.some((r) => r.id === clean.id);
    onChange({
      ...log,
      records: exists
        ? log.records.map((r) => (r.id === clean.id ? clean : r))
        : [clean, ...log.records],
    });
    setEditing(null);
  };

  const remove = (id: string) => {
    const rec = log.records.find((r) => r.id === id);
    if (!rec) return;
    if (!window.confirm(`Remove "${rec.title}" from your record?`)) return;
    onChange({ ...log, records: log.records.filter((r) => r.id !== id) });
  };

  /** Attach files to a record that already exists in the log. */
  const attach = async (rec: PDRecord, files: FileList | null) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setBusyId(rec.id);
    try {
      const added: PDEvidenceFile[] = [];
      for (const file of list) {
        const url = await onUpload(file);
        added.push({
          id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          url,
          size: file.size,
          uploadedAt: Date.now(),
        });
      }
      const next: PDRecord = {
        ...rec,
        evidence: [...rec.evidence, ...added],
        dateSubmitted: rec.dateSubmitted || today(),
      };
      onChange({
        ...log,
        records: log.records.map((r) => (r.id === rec.id ? next : r)),
      });
      if (editing?.id === rec.id) setEditing(next);
    } catch (e: any) {
      alert(`That evidence could not be uploaded:\n\n${e?.message || e}`);
    } finally {
      setBusyId(null);
    }
  };

  const detach = (rec: PDRecord, fileId: string) => {
    const next: PDRecord = {
      ...rec,
      evidence: rec.evidence.filter((f) => f.id !== fileId),
    };
    // Removing the last file makes the record outstanding again.
    if (next.evidence.length === 0) next.dateSubmitted = "";
    onChange({
      ...log,
      records: log.records.map((r) => (r.id === rec.id ? next : r)),
    });
    if (editing?.id === rec.id) setEditing(next);
  };

  const startNew = () => {
    setEditing(blankRecord());
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  return (
    <main className="flex-1 overflow-y-auto bg-[#F9F9F4] p-8 custom-scrollbar">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* ── Progress toward the year's hours ── */}
        <section className="rounded-3xl border-2 border-[#D1FAE5] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Award className="text-[#059669]" size={22} />
                <h2 className="text-xl font-black text-[#064E3B]">
                  Professional Development
                </h2>
              </div>
              <p className="mt-1 text-xs font-bold text-[#064E3B]/50">
                {teacherName ? `${teacherName} · ` : ""}Training record for{" "}
                <input
                  value={log.cycle}
                  onChange={(e) => onChange({ ...log, cycle: e.target.value })}
                  className="w-24 rounded-md bg-[#F0FDF4] px-2 py-0.5 font-black text-[#064E3B] outline-none focus:ring-2 focus:ring-[#059669]/30"
                  aria-label="Cycle"
                />
              </p>
            </div>
            <button
              onClick={startNew}
              className="flex items-center gap-2 rounded-xl bg-[#059669] px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-sm transition-all hover:bg-[#047857] active:scale-95"
            >
              <Plus size={14} /> Add training
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[#064E3B]/40">
                Hours evidenced
              </p>
              <p className="text-3xl font-black tabular-nums text-[#064E3B]">
                {stats.counted}
                <span className="text-lg text-[#064E3B]/40">
                  {" / "}
                  <input
                    type="number"
                    min={0}
                    value={log.targetHours}
                    onChange={(e) =>
                      onChange({ ...log, targetHours: Number(e.target.value) || 0 })
                    }
                    className="w-16 rounded-md bg-[#F0FDF4] px-1 text-center font-black text-[#064E3B] outline-none focus:ring-2 focus:ring-[#059669]/30"
                    aria-label="Target hours"
                  />
                  h
                </span>
              </p>
            </div>
            {stats.awaiting > 0 && (
              <p className="rounded-full bg-[#FEF9C3] px-3 py-1 text-xs font-bold text-[#854D0E]">
                {stats.awaiting}h logged without evidence
              </p>
            )}
            <p className="text-xs font-bold text-[#064E3B]/50">
              {stats.complete
                ? "🎉 Target met"
                : `${stats.remaining}h still to complete`}
            </p>
          </div>

          <div className="mt-3 h-4 overflow-hidden rounded-full bg-[#F0FDF4] ring-1 ring-[#D1FAE5]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                stats.complete ? "bg-[#059669]" : "bg-[#FACC15]"
              }`}
              style={{ width: `${stats.pct}%` }}
            />
          </div>
          {stats.outstanding > 0 && (
            <p className="mt-3 text-xs font-bold text-[#B45309]">
              {stats.outstanding} record{stats.outstanding === 1 ? "" : "s"} still
              need evidence attaching.
            </p>
          )}
        </section>

        {/* ── Add / edit a record ── */}
        {editing && (
          <section
            ref={formRef}
            className="rounded-3xl border-2 border-[#059669] bg-white p-6 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-[#064E3B]">
                {log.records.some((r) => r.id === editing.id)
                  ? "Edit training"
                  : "New training"}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg p-1 text-[#064E3B]/40 hover:bg-[#F0FDF4] hover:text-[#064E3B]"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-[10px] font-black uppercase text-[#064E3B]/40">
                  What was it?
                </span>
                <input
                  autoFocus
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="e.g. Cambridge Primary Science — teaching enquiry skills"
                  className="mt-1 w-full rounded-xl border-2 border-[#D1FAE5] bg-[#F9F8F0] p-2.5 text-sm font-bold outline-none focus:border-[#059669]"
                />
              </label>
              <label>
                <span className="text-[10px] font-black uppercase text-[#064E3B]/40">
                  Provider (optional)
                </span>
                <input
                  value={editing.provider || ""}
                  onChange={(e) => setEditing({ ...editing, provider: e.target.value })}
                  placeholder="e.g. Cambridge International"
                  className="mt-1 w-full rounded-xl border-2 border-[#D1FAE5] bg-[#F9F8F0] p-2.5 text-sm font-bold outline-none focus:border-[#059669]"
                />
              </label>
              <label>
                <span className="text-[10px] font-black uppercase text-[#064E3B]/40">
                  Type
                </span>
                <select
                  value={editing.kind}
                  onChange={(e) =>
                    setEditing({ ...editing, kind: e.target.value as PDRecord["kind"] })
                  }
                  className="mt-1 w-full rounded-xl border-2 border-[#D1FAE5] bg-[#F9F8F0] p-2.5 text-sm font-bold outline-none focus:border-[#059669]"
                >
                  {KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-[10px] font-black uppercase text-[#064E3B]/40">
                  Date attended
                </span>
                <input
                  type="date"
                  value={editing.dateAttended}
                  onChange={(e) =>
                    setEditing({ ...editing, dateAttended: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border-2 border-[#D1FAE5] bg-[#F9F8F0] p-2.5 text-sm font-bold outline-none focus:border-[#059669]"
                />
              </label>
              <label>
                <span className="text-[10px] font-black uppercase text-[#064E3B]/40">
                  Hours
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={editing.hours}
                  onChange={(e) =>
                    setEditing({ ...editing, hours: Number(e.target.value) || 0 })
                  }
                  className="mt-1 w-full rounded-xl border-2 border-[#D1FAE5] bg-[#F9F8F0] p-2.5 text-sm font-bold outline-none focus:border-[#059669]"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-[10px] font-black uppercase text-[#064E3B]/40">
                  What did you take from it? (optional)
                </span>
                <textarea
                  value={editing.notes || ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  placeholder="One or two lines on what you will change in your teaching."
                  className="mt-1 h-20 w-full resize-none rounded-xl border-2 border-[#D1FAE5] bg-[#F9F8F0] p-2.5 text-sm font-medium outline-none focus:border-[#059669]"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded-xl border-2 border-[#D1FAE5] bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-[#064E3B]/60 hover:border-[#059669]"
              >
                Cancel
              </button>
              <button
                onClick={() => save(editing)}
                className="rounded-xl bg-[#059669] px-5 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-[#047857]"
              >
                Save
              </button>
            </div>
            <p className="mt-3 text-[11px] font-bold text-[#064E3B]/40">
              Save it first, then attach your certificate to the record below.
            </p>
          </section>
        )}

        {/* ── The record itself ── */}
        <section className="space-y-3">
          {log.records.length === 0 && !editing && (
            <div className="rounded-3xl border-2 border-dashed border-[#D1FAE5] bg-white p-10 text-center">
              <Award className="mx-auto text-[#064E3B]/20" size={40} />
              <p className="mt-3 font-bold text-[#064E3B]/60">
                No training recorded yet.
              </p>
              <p className="mt-1 text-xs font-bold text-[#064E3B]/40">
                Add each course, workshop or webinar you attend, then attach the
                certificate as evidence.
              </p>
              <button
                onClick={startNew}
                className="mt-4 rounded-xl bg-[#059669] px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-[#047857]"
              >
                Add your first training
              </button>
            </div>
          )}

          {log.records.map((r) => {
            const evidenced = r.evidence.length > 0;
            return (
              <article
                key={r.id}
                className={`rounded-3xl border-2 bg-white p-5 shadow-sm transition-all ${
                  evidenced ? "border-[#D1FAE5]" : "border-[#FDE68A]"
                }`}
              >
                <div className="flex flex-wrap items-start gap-4">
                  {/* Ticked only when the evidence is actually attached. */}
                  <span
                    className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      evidenced
                        ? "bg-[#059669] text-white"
                        : "bg-[#FEF9C3] text-[#B45309]"
                    }`}
                    title={evidenced ? "Evidence attached" : "Evidence still needed"}
                  >
                    {evidenced ? <Check size={18} /> : <Paperclip size={16} />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-black text-[#064E3B]">{r.title}</h4>
                      <span className="rounded-full bg-[#F0FDF4] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#059669]">
                        {KINDS.find((k) => k.id === r.kind)?.label || r.kind}
                      </span>
                      <span className="rounded-full bg-[#064E3B] px-2.5 py-0.5 text-[10px] font-black text-white tabular-nums">
                        {r.hours}h
                      </span>
                    </div>
                    {r.provider && (
                      <p className="mt-0.5 text-xs font-bold text-[#064E3B]/50">
                        {r.provider}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold text-[#064E3B]/60">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={13} className="text-[#059669]" />
                        Attended {showDate(r.dateAttended)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <FileUp size={13} className={evidenced ? "text-[#059669]" : "text-[#B45309]"} />
                        {evidenced
                          ? `Evidence submitted ${showDate(r.dateSubmitted)}`
                          : "Evidence not submitted"}
                      </span>
                    </div>

                    {r.notes && (
                      <p className="mt-2 rounded-xl bg-[#F9F8F0] px-3 py-2 text-xs leading-relaxed text-[#064E3B]/70">
                        {r.notes}
                      </p>
                    )}

                    {r.evidence.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {r.evidence.map((f) => (
                          <span
                            key={f.id}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#D1FAE5] bg-[#F0FDF4] py-1 pl-2 pr-1"
                          >
                            <Paperclip size={11} className="shrink-0 text-[#059669]" />
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className="max-w-[200px] truncate text-[11px] font-bold text-[#064E3B] hover:underline"
                            >
                              {f.name}
                            </a>
                            <button
                              onClick={() => detach(r, f.id)}
                              title="Remove this file"
                              className="shrink-0 rounded p-0.5 text-[#064E3B]/30 transition-colors hover:bg-red-50 hover:text-red-500"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <label
                      className={`flex cursor-pointer items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-[10px] font-black uppercase transition-all ${
                        evidenced
                          ? "border-[#D1FAE5] bg-white text-[#064E3B] hover:border-[#059669]"
                          : "border-transparent bg-[#FACC15] text-[#064E3B] hover:bg-yellow-400"
                      } ${busyId === r.id ? "opacity-60" : ""}`}
                    >
                      {busyId === r.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <FileUp size={12} />
                      )}
                      {busyId === r.id
                        ? "Uploading…"
                        : evidenced
                          ? "Add more"
                          : "Upload evidence"}
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        disabled={busyId !== null}
                        onChange={(e) => {
                          attach(r, e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      onClick={() => setEditing(r)}
                      title="Edit"
                      className="grid h-8 w-8 place-items-center rounded-lg bg-[#F0FDF4] text-[#059669] hover:bg-[#D1FAE5]"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      title="Remove"
                      className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
