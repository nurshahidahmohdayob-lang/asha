/* ═══════════ How to register and sign in ═══════════════════════════════════
   Shown from the sign-in screen, for a teacher opening the app for the first
   time. Each step carries a picture of the screen it is talking about, with
   the field being described circled — so it can be followed without already
   knowing what anything is called.

   The pictures are drawn here rather than pasted in as screenshots: they use
   the same colours and shapes as the real form, so they cannot go stale when
   the form is restyled, and they add nothing to the download size. */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  LayoutGrid,
  Lock,
  Mail,
  ShieldQuestion,
  User,
  X,
} from "lucide-react";

/* ── Pieces of the real form, redrawn ─────────────────────────────────────
   Kept deliberately close to the sign-in screen's own styling: the same
   #F0FDF4 fields, #D1FAE5 borders and #059669 labels. */

const Field = ({
  label,
  value,
  icon,
  focus,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  /** The field this step is about — drawn as if the teacher just tapped it. */
  focus?: boolean;
}) => (
  <div className="space-y-1">
    <span className="block text-[8px] font-black uppercase text-[#059669] ml-2">
      {label}
    </span>
    <div
      className={`relative flex items-center h-9 rounded-xl border-2 bg-[#F0FDF4] transition-all ${
        focus
          ? "border-[#059669] ring-4 ring-[#FACC15]/40"
          : "border-[#D1FAE5]"
      }`}
    >
      <span className="absolute left-2.5 text-[#059669]/50">{icon}</span>
      <span
        className={`pl-8 text-[11px] font-bold ${
          value ? "text-[#064E3B]" : "text-[#064E3B]/30"
        }`}
      >
        {value || "—"}
      </span>
    </div>
  </div>
);

const RoleChips = ({ focus }: { focus?: boolean }) => (
  <div className="space-y-1">
    <span className="block text-[8px] font-black uppercase text-[#059669] ml-2">
      Select Access Roles
    </span>
    <div
      className={`flex gap-2 rounded-xl ${
        focus ? "ring-4 ring-[#FACC15]/40 p-1 -m-1" : ""
      }`}
    >
      <span className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-[#059669] text-white text-[9px] font-bold shadow-sm">
        <BookOpen size={10} /> Educator
      </span>
      <span className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-white border-2 border-[#D1FAE5] text-[#059669]/50 text-[9px] font-bold">
        <LayoutGrid size={10} /> Admin
      </span>
    </div>
  </div>
);

const Btn = ({ children, focus }: { children: React.ReactNode; focus?: boolean }) => (
  <div
    className={`h-10 rounded-xl bg-[#059669] text-white grid place-items-center text-[11px] font-black uppercase tracking-widest shadow-md ${
      focus ? "ring-4 ring-[#FACC15]/50" : ""
    }`}
  >
    {children}
  </div>
);

/** The sign-in card, as the teacher sees it. */
const Screen = ({
  title,
  children,
  footer,
  footerFocus,
}: {
  title: string;
  children: React.ReactNode;
  footer: string;
  footerFocus?: boolean;
}) => (
  <div className="w-full max-w-[260px] mx-auto rounded-2xl bg-white shadow-xl border border-[#D1FAE5] p-4 space-y-3 select-none">
    <div className="text-center space-y-0.5">
      <div className="flex items-center justify-center gap-1.5">
        <span className="grid place-items-center w-5 h-5 rounded bg-[#064E3B] text-white text-[9px] font-black">
          Z
        </span>
        <span className="text-[13px] font-black text-[#064E3B]">zera</span>
        <span className="text-[9px] font-bold text-[#064E3B]/50">Education</span>
      </div>
      <p className="text-[13px] font-black uppercase text-[#064E3B] tracking-tight">
        {title}
      </p>
    </div>
    {children}
    <p
      className={`text-center text-[9px] font-bold text-[#059669] pt-1 ${
        footerFocus ? "bg-[#FACC15]/30 rounded-lg py-1 -mx-1" : ""
      }`}
    >
      {footer}
    </p>
  </div>
);

type Step = {
  n: number;
  title: string;
  body: string;
  points?: string[];
  /** Watch out for — the thing that most often goes wrong on this step. */
  note?: string;
  art: React.ReactNode;
};

const STEPS: Step[] = [
  {
    n: 1,
    title: "Open the register form",
    body: "On the sign-in screen, tap the line at the very bottom of the card. The heading changes from Welcome Back to Create Account, and two extra boxes appear.",
    art: (
      <Screen
        title="Welcome Back"
        footer="Don't have an account? Register here"
        footerFocus
      >
        <Field label="Email Address" value="teacher@school.com" icon={<Mail size={12} />} />
        <Field label="Password" value="••••••••" icon={<Lock size={12} />} />
        <Btn>Sign In</Btn>
      </Screen>
    ),
  },
  {
    n: 2,
    title: "Type your full name",
    body: "This is the name that appears on every lesson plan you submit, and the name your Head of Department sees in their list.",
    note: "Please fill in your full name.",
    art: (
      <Screen title="Create Account" footer="Already have an account? Sign In">
        <Field label="Full Name" value="Aisyah binti Rahman" icon={<User size={12} />} focus />
        <RoleChips />
        <Field label="Email Address" value="" icon={<Mail size={12} />} />
        <Btn>Register Account</Btn>
      </Screen>
    ),
  },
  {
    n: 3,
    title: "Leave the role on Educator",
    body: "Educator is already chosen and is the right one for teaching staff. It gives you lesson plans, slides, assessments, reading programs and handouts.",
    points: [
      "Admin is for Heads of Department and coordinators who review submitted plans.",
      "Only email addresses already on the school roster can register as Admin — choosing it with any other email stops the registration with a message.",
    ],
    art: (
      <Screen title="Create Account" footer="Already have an account? Sign In">
        <Field label="Full Name" value="Aisyah binti Rahman" icon={<User size={12} />} />
        <RoleChips focus />
        <Field label="Email Address" value="" icon={<Mail size={12} />} />
        <Btn>Register Account</Btn>
      </Screen>
    ),
  },
  {
    n: 4,
    title: "Enter your school email and a password",
    body: "Use your school email address. Your password must be at least 6 characters — anything shorter is refused.",
    note: "If it says the email is already registered, you have an account: go back and sign in instead, or use Forgot password?",
    art: (
      <Screen title="Create Account" footer="Already have an account? Sign In">
        <Field label="Full Name" value="Aisyah binti Rahman" icon={<User size={12} />} />
        <Field label="Email Address" value="aisyah.r@zera.edu.my" icon={<Mail size={12} />} focus />
        <Field label="Password" value="••••••••" icon={<Lock size={12} />} focus />
        <Btn>Register Account</Btn>
      </Screen>
    ),
  },
  {
    n: 5,
    title: "Tap Register Account",
    body: "Your account is created and you are taken straight in — there is no email to confirm and nothing to wait for.",
    art: (
      <Screen title="Create Account" footer="Already have an account? Sign In">
        <Field label="Full Name" value="Aisyah binti Rahman" icon={<User size={12} />} />
        <Field label="Email Address" value="aisyah.r@zera.edu.my" icon={<Mail size={12} />} />
        <Field label="Password" value="••••••••" icon={<Lock size={12} />} />
        <Btn focus>Register Account</Btn>
      </Screen>
    ),
  },
  {
    n: 6,
    title: "Signing in after that",
    body: "Every time after this, fill in the same email and password and tap Sign In. Forgotten it? Tap Forgot password? and a reset link is emailed to you.",
    art: (
      <Screen title="Welcome Back" footer="Don't have an account? Register here">
        <Field label="Email Address" value="aisyah.r@zera.edu.my" icon={<Mail size={12} />} />
        <Field label="Password" value="••••••••" icon={<Lock size={12} />} />
        <Btn focus>Sign In</Btn>
      </Screen>
    ),
  },
  {
    n: 7,
    title: "Where you land",
    body: "You arrive at the home screen. Tap Educator Studio to start — that is where lesson plans, slides and assessments live.",
    points: [
      "Educator Studio → Lesson Plan is the usual place to begin.",
      "Once inside, a Guide button on the Lesson Design page walks you through building a plan.",
    ],
    art: (
      <div className="w-full max-w-[260px] mx-auto rounded-2xl bg-[#F9FCFA] shadow-xl border border-[#D1FAE5] p-4 space-y-3 select-none">
        <div className="flex items-center justify-center gap-1.5">
          <span className="grid place-items-center w-5 h-5 rounded bg-[#064E3B] text-white text-[9px] font-black">
            Z
          </span>
          <span className="text-[13px] font-black text-[#064E3B]">zera</span>
        </div>
        <p className="text-center text-[9px] font-bold text-[#064E3B]/60">
          Welcome, Aisyah.
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="rounded-xl bg-[#064E3B] p-3 text-center ring-4 ring-[#FACC15]/50">
            <BookOpen size={16} className="mx-auto text-[#FACC15]" />
            <p className="mt-1 text-[9px] font-black text-white leading-tight">
              Educator Studio
            </p>
          </div>
          <div className="rounded-xl bg-white border-2 border-[#D1FAE5] p-3 text-center">
            <LayoutGrid size={16} className="mx-auto text-[#064E3B]/40" />
            <p className="mt-1 text-[9px] font-black text-[#064E3B]/50 leading-tight">
              Admin Portal
            </p>
          </div>
        </div>
      </div>
    ),
  },
];

export default function RegisterGuide({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((c) => Math.min(STEPS.length - 1, c + 1));
      if (e.key === "ArrowLeft") setI((c) => Math.max(0, c - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How to register and sign in"
      /* z-[2100] clears the sign-in screen's own z-[2000] — anything lower
         opens behind it, which looks exactly like the button doing nothing. */
      className="fixed inset-0 z-[2100] flex items-center justify-center bg-[#064E3B]/50 backdrop-blur-sm p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-full flex flex-col bg-white rounded-[2rem] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 bg-[#064E3B] text-white px-7 py-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FACC15]">
              First time here?
            </p>
            <h2 className="mt-0.5 text-2xl font-black leading-tight">
              How to register
            </h2>
            <p className="mt-1 text-sm font-medium text-white/70">
              Seven steps, with a picture of each screen. Takes about a minute.
            </p>
          </div>
          <button
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close the guide"
            className="shrink-0 p-2 rounded-xl bg-white/15 hover:bg-white/25 transition-colors active:scale-90"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#F0FDF4]/40 p-5 sm:p-7">
          <div className="grid md:grid-cols-[1fr_280px] gap-6 items-start">
            <div className="space-y-3 min-w-0">
              <div className="flex items-center gap-3">
                <span className="shrink-0 w-9 h-9 rounded-xl bg-[#059669] text-white grid place-items-center text-sm font-black">
                  {step.n}
                </span>
                <h3 className="text-lg font-black text-[#064E3B] leading-tight">
                  {step.title}
                </h3>
              </div>
              <p className="text-[14px] leading-relaxed text-[#064E3B]/80 font-medium">
                {step.body}
              </p>
              {step.points && (
                <ul className="space-y-2 pt-1">
                  {step.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-[13px] leading-relaxed">
                      <Check size={14} className="shrink-0 mt-1 text-[#059669] stroke-[3]" />
                      <span className="text-[#064E3B]/75">{p}</span>
                    </li>
                  ))}
                </ul>
              )}
              {step.note && (
                <div className="flex gap-2.5 rounded-xl bg-[#FEFCE8] border border-[#FDE68A] px-3.5 py-3">
                  <ShieldQuestion size={15} className="shrink-0 mt-0.5 text-[#854D0E]" />
                  <p className="text-[12px] font-medium leading-relaxed text-[#854D0E]">
                    {step.note}
                  </p>
                </div>
              )}
            </div>

            {/* The screen this step is about, with the field highlighted. */}
            <div className="md:sticky md:top-0">{step.art}</div>
          </div>
        </div>

        {/* Footer — step dots and paging */}
        <div className="shrink-0 border-t-2 border-[#D1FAE5] bg-white px-5 py-4 flex items-center justify-between gap-3">
          <button
            onClick={() => setI((c) => Math.max(0, c - 1))}
            disabled={i === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border-2 border-[#D1FAE5] text-[#064E3B] font-black text-[10px] uppercase tracking-widest hover:border-[#059669] transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} /> Back
          </button>

          <div className="flex items-center gap-1.5">
            {STEPS.map((s, idx) => (
              <button
                key={s.n}
                onClick={() => setI(idx)}
                aria-label={`Step ${s.n}: ${s.title}`}
                title={s.title}
                className={`h-2.5 rounded-full transition-all ${
                  idx === i
                    ? "w-7 bg-[#059669]"
                    : idx < i
                      ? "w-2.5 bg-[#059669]/40"
                      : "w-2.5 bg-[#D1FAE5]"
                }`}
              />
            ))}
          </div>

          {i === STEPS.length - 1 ? (
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-[#059669] text-white font-black text-[10px] uppercase tracking-widest hover:bg-[#047857] transition-all active:scale-95 shadow-sm"
            >
              Got It
            </button>
          ) : (
            <button
              onClick={() => setI((c) => Math.min(STEPS.length - 1, c + 1))}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#064E3B] text-white font-black text-[10px] uppercase tracking-widest hover:bg-[#0B6B4F] transition-all active:scale-95"
            >
              Next <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The link that opens this guide — sits under the sign-in card. */
export const RegisterGuideLink = ({ onOpen }: { onOpen: () => void }) => (
  <button
    type="button"
    onClick={onOpen}
    className="w-full mt-3 inline-flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-[#D1FAE5] text-[#059669] font-bold text-xs hover:border-[#059669] hover:bg-[#F0FDF4] transition-all active:scale-[0.98]"
  >
    <HelpCircle size={15} />
    New here? See how to register
  </button>
);
