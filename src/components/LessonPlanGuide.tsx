/* ═══════════ Teacher's guide to building a lesson plan ═══════════════════
   A walkthrough of the Lesson Design page in the order a teacher actually
   works: set up the plan, choose how to build it, generate, edit what came
   back, then turn it into the week's teaching. Every step names the button
   it is talking about, so the guide can be followed with the page open
   beside it. */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Check,
  CheckCircle,
  ChevronDown,
  FileCode,
  FileText,
  LayoutGrid,
  Lightbulb,
  Mail,
  Plus,
  Presentation,
  Save,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";

type Step = {
  n: number;
  title: string;
  lead: string;
  icon: typeof BookOpen;
  /** Named controls on the page, so the teacher knows what to look for. */
  points: { label: string; text: string }[];
  /** The one thing that most often trips people up on this step. */
  tip?: string;
};

const STEPS: Step[] = [
  {
    n: 1,
    title: "Start a plan",
    lead: "Every lesson plan lives in your own workspace. Open an existing one or begin a fresh one.",
    icon: LayoutGrid,
    points: [
      {
        label: "My Lesson Plans",
        text: "The board of everything you've saved. Open one to keep working on it.",
      },
      {
        label: "New Lesson",
        text: "Clears the workspace and starts an empty plan.",
      },
      {
        label: "Panel",
        text: "Shows or hides the Lesson Workspace on the left, where all the settings live. If the page looks bare, the panel is hidden — click Panel to bring it back.",
      },
    ],
  },
  {
    n: 2,
    title: "Fill in the plan details",
    lead: "Open Plan Details in the Lesson Workspace. These are the facts the whole plan is written from, so set them before you generate anything.",
    icon: FileText,
    points: [
      {
        label: "Year Group",
        text: "The class this plan is for, from Year 1 to Year 11. Everything the plan produces — objectives, activities and wording — is pitched at that year.",
      },
      {
        label: "Subject",
        text: "Pick the Cambridge subject. The plan is aligned to that framework and quotes its objective codes.",
      },
      {
        label: "Term, Duration, Date, Academic Year",
        text: "These appear on the printed plan and on what you submit to your Head of Department.",
      },
    ],
    tip: "Set the Year Group and Subject first. Change them later and the wording you've already generated won't rewrite itself.",
  },
  {
    n: 3,
    title: "Choose how to build it",
    lead: "Open Generate and pick the way that matches how you plan.",
    icon: Wand2,
    points: [
      {
        label: "Whole Term",
        text: "Describe the term's topic and how many weeks, and get the full scheme in one go. Best when you're starting from a blank term.",
      },
      {
        label: "Week By Week",
        text: "One card per week — Unit, Topic, Subtopic and any activities you want. Generate a single week at a time. Best when you already know the shape of the term.",
      },
      {
        label: "Instructions (optional)",
        text: "In Whole Term, this is where you say what matters to you — more hands-on work, a weekly assessment, a textbook to follow, pacing notes.",
      },
      {
        label: "Lesson Focus / Methodology",
        text: "In Whole Term, under Instructions. One line about how you teach — active learning, inquiry, textbook-led. In Week By Week each week card has its own Activities & Lesson Focus box instead.",
      },
    ],
    tip: "Leave a week's Activities box blank and the AI chooses them. Fill it in and it follows what you wrote.",
  },
  {
    n: 4,
    title: "Let it draft, then make it yours",
    lead: "Generate Lesson Package at the bottom of the panel writes the plan. Small Suggest links sit next to the Unit, Topic, Subtopic and Activities boxes if you only want a nudge.",
    icon: Sparkles,
    points: [
      {
        label: "Generate Lesson Package",
        text: "Builds the whole plan from everything you've set.",
      },
      {
        label: "Generate Week N",
        text: "On a week card in Week By Week mode — writes just that week.",
      },
      {
        label: "AI Suggestions panel",
        text: "Ideas only. They appear on the right with a Copy button; nothing goes into your plan until you put it there.",
      },
    ],
    tip: "The draft is a first draft. Every field in the plan document is editable — click into it and type. What you write is what your class gets.",
  },
  {
    n: 5,
    title: "Turn a week into teaching",
    lead: "Each week in the plan has its own buttons. This is where a plan becomes something you can stand in front of a class with.",
    icon: Presentation,
    points: [
      {
        label: "Project Lesson",
        text: "Builds and projects the whole week — do now, learning goals, activities, share back, check and exit ticket — with a timer, random picker and poll built in.",
      },
      {
        label: "Worksheet",
        text: "Writes an assessment for that week's objective.",
      },
      {
        label: "Slide Studio",
        text: "In the workflow rail on the left. Opens the editable slides for the week you're on, built from this plan.",
      },
    ],
    tip: "Slide Studio builds from the plan you have open. Generate the plan first and the slides follow it; open Slide Studio with nothing planned and it has only the topic to work from.",
  },
  {
    n: 6,
    title: "Save, share and download",
    lead: "In the Lesson Workspace under Share & Save.",
    icon: Save,
    points: [
      {
        label: "Save",
        text: "Keeps the plan in My Lesson Plans. Do this before you close the page.",
      },
      {
        label: "Email",
        text: "Publishes the plan and emails a link to it.",
      },
      {
        label: "HTML",
        text: "Downloads the plan as a file you can still edit.",
      },
      {
        label: "Download (Slide Studio)",
        text: "The projected lesson as a PDF or a PowerPoint, or just the editable slides.",
      },
    ],
  },
  {
    n: 7,
    title: "Submit to your Head of Department",
    lead: "Under Submit to Admin. Choose the week the plan is for first — that's what your HOD sees it filed under.",
    icon: CheckCircle,
    points: [
      {
        label: "Submit This Plan",
        text: "Sends the open plan for the selected week.",
      },
      {
        label: "Submit All",
        text: "Sends every plan you've saved, across all year groups, at once. The number on the button is how many that is.",
      },
      {
        label: "If it comes back",
        text: "A plan sent back for changes shows the reason and a Fix & Resubmit button. Make the changes and submit again — it returns to the same person.",
      },
    ],
  },
];

export default function LessonPlanGuide({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<number | null>(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock the page behind the guide so scrolling stays inside it.
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
      aria-label="Lesson plan guide for teachers"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#064E3B]/40 backdrop-blur-sm p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-full flex flex-col bg-white rounded-[2rem] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 bg-[#064E3B] text-white px-7 py-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FACC15]">
              Teacher's guide
            </p>
            <h2 className="mt-1 text-2xl font-black leading-tight">
              Building a lesson plan
            </h2>
            <p className="mt-2 text-sm font-medium text-white/70 leading-snug">
              Seven steps, in the order you'll work through them. Keep this open
              beside the page — every step names the button it means.
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

        {/* Steps */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-7 space-y-3 bg-[#F0FDF4]/40">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isOpen = open === step.n;
            return (
              <div
                key={step.n}
                className={`rounded-2xl border-2 bg-white transition-all ${
                  isOpen
                    ? "border-[#059669] shadow-sm"
                    : "border-[#D1FAE5] hover:border-[#A7F3D0]"
                }`}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : step.n)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                >
                  <span
                    className={`shrink-0 w-8 h-8 rounded-xl grid place-items-center text-xs font-black ${
                      isOpen
                        ? "bg-[#059669] text-white"
                        : "bg-[#F0FDF4] text-[#064E3B]"
                    }`}
                  >
                    {step.n}
                  </span>
                  <Icon size={16} className="shrink-0 text-[#059669]" />
                  <span className="flex-1 text-sm font-black text-[#064E3B] uppercase tracking-wide">
                    {step.title}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-[#064E3B]/40 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pl-[3.75rem] space-y-3">
                    <p className="text-[13px] font-medium leading-relaxed text-[#064E3B]/80">
                      {step.lead}
                    </p>
                    <ul className="space-y-2">
                      {step.points.map((p) => (
                        <li
                          key={p.label}
                          className="flex gap-2.5 text-[13px] leading-relaxed"
                        >
                          <Check
                            size={14}
                            className="shrink-0 mt-1 text-[#059669] stroke-[3]"
                          />
                          <span className="text-[#064E3B]/75">
                            <span className="font-black text-[#064E3B]">
                              {p.label}
                            </span>{" "}
                            — {p.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {step.tip && (
                      <div className="flex gap-2.5 rounded-xl bg-[#FEFCE8] border border-[#FDE68A] px-3.5 py-3">
                        <Lightbulb
                          size={15}
                          className="shrink-0 mt-0.5 text-[#854D0E]"
                        />
                        <p className="text-[12px] font-medium leading-relaxed text-[#854D0E]">
                          {step.tip}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Where things live — a map for anyone who lost a button. */}
          <div className="rounded-2xl border-2 border-[#D1FAE5] bg-white p-5 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#064E3B]/60">
              Where everything lives
            </h3>
            <div className="grid sm:grid-cols-2 gap-2.5 text-[12px] leading-snug">
              {[
                {
                  icon: LayoutGrid,
                  where: "Left rail",
                  what: "My Lesson Plans, and quick icons for email, HTML, save and submit when the panel is hidden.",
                },
                {
                  icon: BookOpen,
                  where: "Lesson Workspace",
                  what: "Plan Details and Generate — and Generate Lesson Package pinned at the bottom.",
                },
                {
                  icon: Sparkles,
                  where: "Right panel",
                  what: "AI Suggestions, when there are any. Copy from here into your plan.",
                },
                {
                  icon: FileText,
                  where: "Middle",
                  what: "The plan itself, week by week. Every field is editable.",
                },
                {
                  icon: Presentation,
                  where: "On each week",
                  what: "Project Lesson and Worksheet.",
                },
                {
                  icon: Plus,
                  where: "Workflow rail",
                  what: "Lesson Design → Slide Studio → Assessment Hub → Reading Program → Journal → PD.",
                },
              ].map((row) => {
                const RowIcon = row.icon;
                return (
                  <div
                    key={row.where}
                    className="flex gap-2.5 rounded-xl bg-[#F0FDF4]/60 px-3 py-2.5"
                  >
                    <RowIcon size={14} className="shrink-0 mt-0.5 text-[#059669]" />
                    <span className="text-[#064E3B]/75">
                      <span className="font-black text-[#064E3B]">
                        {row.where}
                      </span>{" "}
                      — {row.what}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-center text-[11px] font-bold text-[#064E3B]/40 pt-1">
            Reopen this any time from the Guide button on the Lesson Design page.
          </p>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t-2 border-[#D1FAE5] bg-white px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#064E3B]/50">
            <Mail size={14} />
            <FileCode size={14} />
            <Save size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Save before you close
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-[#059669] text-white font-black text-xs uppercase tracking-widest hover:bg-[#047857] transition-all active:scale-95 shadow-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
