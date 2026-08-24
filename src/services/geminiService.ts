import { GoogleGenAI, Type } from "@google/genai";
import { EduContent, SlideContent, WorksheetSection, ReadingProgram, LessonPlan, WeeklyPlan, LessonActivityPack } from "../types";

/* ── The Gemini client ────────────────────────────────────────────────────
   Built on first use, never at import, and never in the browser.

   This module is bundled twice: once for the browser and once (by
   scripts/build-api.mjs) for the Vercel functions. Constructing the client at
   import meant the key had to exist at import in BOTH — so vite.config.ts
   inlined it into the browser bundle, where anyone could read it out of
   devtools. It is a billable key with no per-origin restriction, so that was
   a real exposure, not a theoretical one.

   Nothing in the browser needs it: every generator goes through /api/ai/*,
   and the one direct Gemini call left (the image fallback below) is reached
   only after generatePosterImage has already returned for window callers.
   Reading the key lazily lets the browser bundle carry this code without
   carrying the secret. */
/** `process` does not exist in the browser, and these values are deliberately
 *  no longer inlined into the bundle — every generator runs server-side, so
 *  the browser has no use for them. Reading them through this keeps the module
 *  LOADABLE in both places: the Node bundles under api/ find real values, the
 *  browser gets "".
 *
 *  Without the guard, `process.env.GROQ_API_KEY` at module scope threw
 *  ReferenceError as soon as the browser evaluated this file, which took the
 *  whole app down to a blank page before React could mount. */
const fromEnv = (name: string): string => {
  try {
    return (typeof process !== "undefined" && process.env?.[name]) || "";
  } catch {
    return "";
  }
};

let geminiClient: GoogleGenAI | null = null;

function gemini(): GoogleGenAI {
  const key = fromEnv("GEMINI_API_KEY");
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set on the server. Add it to .env locally, or to " +
        "the Vercel project's environment variables, and redeploy.",
    );
  }
  return (geminiClient ||= new GoogleGenAI({ apiKey: key }));
}

// Utility to call the server-side proxy (Fallback if frontend key fails)
async function callAiProxy(type: string, lessonInput: string, options: any) {
  try {
    const response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, lessonInput, options })
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server error: ${response.statusText}`);
    }
    
    return response.json();
  } catch (err: any) {
    console.error("AI Proxy Error:", err);
    throw err;
  }
}

// Streaming variant of the proxy: POSTs to the SSE endpoint and invokes
// onPartial for each progress event, resolving with the final result. Used for
// worksheets so the browser shows "questions 8/20…" even though generation runs
// server-side. Falls back to the plain proxy if streaming isn't available.
async function callAiProxyStream(
  type: string,
  lessonInput: string,
  options: any,
  onPartial?: (partial: any) => void,
): Promise<any> {
  let response: Response;
  try {
    response = await fetch("/api/ai/generate-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, lessonInput, options }),
    });
  } catch {
    return callAiProxy(type, lessonInput, options);
  }
  // No stream support (older deploy, buffering proxy) → use the normal endpoint.
  if (!response.ok || !response.body) {
    return callAiProxy(type, lessonInput, options);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let final: any;
  let sawError = "";
  // Parse "data: {...}\n\n" SSE frames as they arrive.
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const line = frame.replace(/^data:\s?/, "").trim();
      if (!line) continue;
      let obj: any;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      if (obj.event === "partial" && onPartial) onPartial(obj.partial);
      else if (obj.event === "result") final = obj.result;
      else if (obj.event === "error") sawError = obj.error || "stream error";
    }
  }
  if (final !== undefined) return final;
  // Stream ended without a result — fall back so the user still gets output.
  if (sawError) throw new Error(sawError);
  return callAiProxy(type, lessonInput, options);
}

// When the chosen subject is Bahasa Melayu, every part of the generated content
// (questions, options, instructions, passages, titles) must be written in Malay.
// Returns a directive to append to generation prompts, or "" for other subjects.
function bahasaMelayuDirective(subject?: string): string {
  if (!subject || !/bahasa\s*melayu/i.test(subject)) return "";
  return `\n\nLANGUAGE (MANDATORY): The subject is Bahasa Melayu. Write ALL output entirely in standard Bahasa Melayu (Malay) — every question, all answer options, every instruction/heading, the title, and any reading passage MUST be in Bahasa Melayu. Do NOT use English anywhere (no English words, glosses, or translations in brackets). Use natural, grammatically correct Malay appropriate for the year group.`;
}

// Structural format guide for a Bahasa Melayu language paper. Unlike the generic
// worksheet, a BM paper is organised into labelled grammar sections ("Bahagian")
// using cloze multiple-choice items, plus sentence-building and comprehension
// passages. Returns "" for non-BM subjects. Inject into worksheet-generation
// prompts only (not the after-reading "leveled" flow).
function bahasaMelayuFormatGuide(subject?: string): string {
  if (!subject || !/bahasa\s*melayu/i.test(subject)) return "";
  return `\n\nBAHASA MELAYU PAPER FORMAT (follow this structure and style closely):
- Organise the paper into clearly labelled sections, each a "section.title" like "Bahagian A: Kata Kerja", "Bahagian B: Kata Adjektif", etc. Each section focuses on ONE Malay language skill. Common sections for a primary BM paper: Kata Kerja, Kata Adjektif, Kata Hubung, Penjodoh Bilangan, Kata Sendi Nama, Kata Arah, Membina Ayat, and Pemahaman Petikan. Pick the sections that fit the given topic/description — if the teacher specified ONE skill (e.g. only Kata Kerja), build the paper mainly around that skill.
- MOST items are CLOZE multiple-choice: a short everyday Malay sentence containing exactly ONE "____" blank, with EXACTLY 4 options (A–D) — never fewer. Exactly ONE option is correct; the other three are plausible but clearly WRONG.
- WORD-CLASS RULE (critical): every option in a section MUST belong to that section's word class, and ONLY the correct one fits the sentence. Do NOT mix word classes, and do NOT make two options both correct (e.g. avoid both "cantik" and "indah" as choices when either fits). The blank must not already be answered elsewhere in the sentence.
- WORD BANKS by section (draw all four options for an item from the SAME bank):
   • Kata Kerja → verbs only: membaca, menulis, memasak, bermain, menyiram, melukis, menyanyi, berlari, menanam, membasuh…
   • Kata Adjektif → adjectives only: manis, masam, besar, kecil, tinggi, rendah, rajin, malas, cantik, garang, bersih, berat… (NOT intensifiers like sangat/terlalu/cukup, and NOT verbs).
   • Kata Hubung → conjunctions only: dan, atau, tetapi, kerana, lalu, manakala, supaya, untuk, sambil, kemudian, walaupun. The blank MUST be a conjunction. NEVER use aspect/time markers (telah, sedang, belum, sudah, akan, masih) or any non-conjunction as options here — that is a common mistake and is BANNED.
   • Penjodoh Bilangan → classifiers only: ekor, batang, biji, buah, helai, keping, orang, kaki, tangkai, ketul…
   • Kata Sendi Nama → prepositions only: di, ke, dari, kepada, pada, untuk, dengan, daripada…
   • Kata Arah → direction words only: atas, bawah, dalam, luar, depan, belakang, tepi, sebelah, antara…
- Examples (style to imitate):
   • "Aisyah sedang ____ buku cerita di perpustakaan." → ["membaca","tidur","mandi","menyapu"] (Kata Kerja)
   • "Air sirap itu sangat ____." → ["manis","tinggi","laju","besar"] (Kata Adjektif)
   • "Saya suka makan epal ____ oren." → ["dan","tetapi","kerana","atau"] (Kata Hubung)
   • "Hani tidak hadir ke sekolah ____ demam." → ["kerana","dan","atau","lalu"] (Kata Hubung)
   • "Ibu memasak ____ kakak mengemas meja." → ["manakala","kerana","supaya","lalu"] (Kata Hubung)
   • "Pak Ali memelihara lima ____ ayam." → ["ekor","batang","helai","buah"] (Penjodoh Bilangan)
   • "Buku itu terletak ____ atas meja." → ["di","ke","dari","kepada"] (Kata Sendi Nama)
   • "Kucing itu berada di ____ meja." → ["bawah","atas","depan","belakang"] (Kata Arah)
- For a "Membina Ayat" section: each item is an open-response (type "open-response", NO options) that gives a short picture description in Malay and asks the pupil to write one complete sentence, e.g. "Gambar seorang murid membaca buku. Bina satu ayat yang lengkap."
- For a "Pemahaman Petikan" section: write a short Malay passage (3–6 simple sentences about an everyday scene) and put the FULL passage text in that section's "instructions" field (begin it with "Baca petikan di bawah."). Then the section's questions ask about that passage — mix multiple-choice (e.g. "Bilakah …?", "Di manakah …?") and open-response (e.g. "Mengapakah …?", "Nyatakan satu kata kerja dalam petikan."). Do NOT ask comprehension questions without a passage. You may include one or two such passage sections.
- Use simple, correct, age-appropriate Malay names and contexts (Aisyah, Amir, Faris, ibu, nenek, perpustakaan, padang, dapur…). Keep every sentence short and natural.`;
}

// Mandarin here is taught bilingually — the class works from the English and
// the Chinese together — so a Mandarin worksheet, deck or handout carries both
// rather than picking one. Returns "" for every other subject.
function isMandarin(subject?: string): boolean {
  return !!subject && /mandarin|chinese|华文|中文/i.test(subject);
}

// A teacher who has explicitly chosen a language for this piece of work meant
// it, and that choice outranks the subject's bilingual default (languageDirective
// then asks for that language alone).
function mandarinDualLanguage(
  subject?: string,
  language?: string,
  kind: "worksheet" | "slides" | "notes" = "worksheet",
): string {
  if (!isMandarin(subject)) return "";
  const chosen = (language || "").trim();
  if (chosen && !/^english/i.test(chosen)) return "";

  const core = `\n\nDUAL LANGUAGE — ENGLISH + MANDARIN (MANDATORY): The subject is Mandarin Chinese and this class works bilingually. EVERY piece of text you write must appear in BOTH English and Simplified Chinese — never one without the other. Put the English first, then its Chinese translation immediately after, inside full-width parentheses（）, in the SAME field/string.
- Translate faithfully: the Chinese must say exactly what the English says, so a pupil reading either half arrives at the same answer. Never let the two halves differ in meaning.
- Use Simplified Chinese characters. Do NOT add pinyin, romanisation, or any third version.
- Keep both halves short and age-appropriate; do not pad the English to match the Chinese or vice versa.
- Never leave a field English-only or Chinese-only.`;

  if (kind === "slides") {
    return `${core}
- This applies to every slide title and every bullet in "content". Keep the bullet's "key phrase — explanation" shape and make BOTH halves bilingual, e.g. "Water cycle（水循环）— Water moves between the sea, sky and land in a never-ending loop.（水在海洋、天空和陆地之间不断循环流动。）".
- "illustrationPrompt" is a search query, not pupil-facing: keep it English-only.
- The "description" and "methodology" metadata are for the teacher: keep them English-only.`;
  }

  if (kind === "notes") {
    return `${core}
- Headings carry both languages on one line, e.g. "## Learning Objectives（学习目标）".
- For body prose, write the English paragraph or bullet first and put its Chinese translation on the NEXT line (or as the next bullet) instead of using parentheses — a whole paragraph in brackets is unreadable.
- In the vocabulary table, give the Chinese beside the English term and translate the definition and the example sentence too.`;
  }

  return `${core}
- This applies to the title, every section title, every instruction, every question, EVERY answer option, any word bank, and any reading passage.
- Examples — title: "Animals and Their Homes（动物和它们的家）"; question: "Which animal lives in a nest?（哪种动物住在鸟巢里？）"; option: "Bird（鸟）".
- Fill-in-the-blank and cloze items keep the "____" blank in BOTH halves, in the same place in the sentence.
- The Chinese half must not reveal an answer the English half hides.
- For a reading passage, write the English paragraph first and its Chinese translation as the NEXT paragraph (blank line between) rather than in parentheses.`;
}

export interface EduOptions {
  /** The language the work is written in, e.g. "Mandarin Chinese (Simplified)".
   *  Empty or English keeps the British-English house style. Anything else
   *  replaces it — a Mandarin paper insisting on -ise endings is nonsense. */
  language?: string;
  /** Days the subject is taught each week, e.g. ["Monday","Wednesday"].
   *  When given, each week comes back with one lesson per day instead of a
   *  single lesson for the whole week. */
  days?: string[];
  yearGroup: string;
  lexileLevel: string;
  subject: string;
  overallTopic?: string;
  /** Text of a lesson plan or scheme of work the teacher uploaded. Suggestions
   *  must fit THEIR document, not the subject in general. */
  sourceDocument?: string;
  /** What the plan already says for the week being suggested for. */
  weekContext?: string;
  numSlides: number;
  numQuestions: number;
  questionTypes: string[];
  // Optional per-type counts, e.g. { "Multiple Choice": 5, "Short Answer": 3 }.
  typeCounts?: Record<string, number>;
  includeStory?: boolean;
  readingPassageOnly?: boolean;
  readingProgramOnly?: boolean;
  templateMode?: 'strict' | 'custom';
  metadataHints?: { description?: string, methodology?: string };
  worksheetContext?: {
    title: string;
    readingPassage?: string;
    description?: string;
    methodology?: string;
    sections: WorksheetSection[];
  };
  /** The week of the teacher's own lesson plan these slides must teach. The
   *  plan is the source of truth — without this the slides are written from
   *  the topic string alone and ignore what the teacher actually planned. */
  lessonPlanContext?: {
    overallTopic?: string;
    week?: number;
    unit?: string;
    topic?: string;
    subTopic?: string;
    strand?: string;
    learningObjective?: string;
    introduction?: string;
    activities?: string;
    assessment?: string;
    resources?: string;
    successCriteria?: string;
    essentialQuestions?: string;
    /** The other weeks' topics, so this deck doesn't wander into them. */
    otherWeekTopics?: string[];
  };
  fileContext?: {
    mimeType: string;
    data: string;
  };
  // Lesson plan specific
  term?: string;
  duration?: string;
  date?: string;
  academicYear?: string;
  class?: string;
  preparedBy?: string;
  checkedBy?: string;
  unit?: string[];
  topics?: string[];
  targetWordCount?: string;
}

const CAMBRIDGE_CURRICULUM_INFO = `
Cambridge Primary (Stages 1–6) & Lower Secondary (Stages 7–9) SUBJECT CODES:
- English (0058/0861)
- Mathematics (0096/0862)
- Science (0097/0893)
- Digital Literacy (0072/0082)
- Information and Communication Technology (0059/0860)

OFFICIAL LEARNING OBJECTIVE (LO) CODE FORMAT:
Objectives MUST follow the [Stage][Strand].[Number] format. 
Example for Stage 3 Digital Literacy: 3TC.01

STRAND INITIALS BY SUBJECT:
1. Digital Literacy (0072/0082):
   - Tools and Content Creation (TC)
   - Safety and Wellbeing (SW)
   - The Digital World (DW)
   *Correct Examples: 3TC.01, 3SW.02, 3DW.04*

2. English (0058/0861):
   - Reading (Rf)
   - Writing (Wv)
   - Speaking and Listening (SL)
   *Correct Examples: 3Rf.01, 3Wv.05*

3. Mathematics (0096/0862):
   - Number (N)
   - Geometry and Measure (G)
   - Statistics and Probability (S)
   - Thinking and Working Mathematically (TWM)
   *Correct Examples: 3N.01, 3G.05*

4. Science (0097/0893):
   - Thinking and Working Scientifically (TW)
   - Biology (Bs)
   - Chemistry (Cs)
   - Physics (Ps)
   - Earth and Space (Es)
   *Correct Examples: 3TW.01, 3Bs.02*

Cambridge Primary: Art & Design (0067), Information and Communication Technology (0059), Digital Literacy (0072), English (0058), English as a Second Language (0057), Global Perspectives (0838), Humanities (0065), Mathematics (0096), Modern Foreign Language (0064), Music (0068), Physical Education (0069), Science (0097), Wellbeing (0034).
Cambridge Lower Secondary: Art & Design (0073), Information and Communication Technology (0860), Digital Literacy (0082), English (0861), English as a Second Language (0876), Global Perspectives (1129), Humanities (0896), Mathematics (0862), Modern Foreign Language (0897), Music (0078), Physical Education (0081), Science (0893), Wellbeing (0859).
Cambridge IGCSE / Upper Secondary: Physics (0625), Biology (0610), Chemistry (0620), Mathematics (0580), Physical Education (0413), Music (0410), Global Perspectives (0457), Chinese as a First Language (0509), Chinese as a Second Language (0523), Chinese as a Foreign Language (0547), Malay as a Foreign Language (0546), etc.

CRITICAL — DO NOT INVENT LEARNING OBJECTIVE CODES:
- The lists above give ONLY subject codes, strand initials, and the code FORMAT. They do NOT contain the actual objective numbers (the ".01", ".02" part) or what each code means.
- Therefore you must NOT guess, fabricate, or approximate a specific LO code such as "3Ps.01". Inventing a plausible-looking code that maps to the wrong topic is a serious error.
- Only cite a specific LO code when it comes directly from an uploaded Scheme of Work / framework document, or when you are genuinely certain it is the exact official Cambridge code for that precise subject, stage and objective.
- If you are not certain of the exact official code, DO NOT attach one. Write the learning objective in clear plain language WITHOUT any code. A correct plain-language objective with no code is REQUIRED over an objective with an incorrect code.
- When you do cite a code, use the exact strand capitalisation shown above (e.g. "Ps", "Rf", "TC" — never "PS"). Make sure the strand matches the subject (a Science code on a Wellbeing topic is invalid).
`;

/* ── Writing for the age in front of you ─────────────────────────────────
   A Year 1 class and a Year 9 class cannot be handed the same sentence. The
   year group is already known from the lesson plan, so it is turned into
   explicit, checkable writing rules rather than left as a hint the model may
   or may not act on. Anything projected to children goes through this. */

/** Pull the school year out of "Year 3", "Grade 4", "Y5", "Stage 2"… */
export function yearNumberOf(yearGroup?: string): number | null {
  if (!yearGroup) return null;
  const m = String(yearGroup).match(/(\d{1,2})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 13 ? n : null;
}

/** Explicit rules for writing to a year group — dropped into every prompt
 *  whose output a class will actually read. */
export function ageGuidance(yearGroup?: string): string {
  const y = yearNumberOf(yearGroup);
  const label = yearGroup || "this year group";
  // Unknown year group: stay deliberately plain rather than guess upward.
  if (y === null) {
    return `AGE-APPROPRIATE LANGUAGE (${label}):
- Write in plain, concrete language. Short sentences, one idea each.
- Explain any subject term the first time it appears.`;
  }
  if (y <= 2) {
    return `AGE-APPROPRIATE LANGUAGE — THIS IS ${label.toUpperCase()} (children aged about ${y + 4}–${y + 5}). THIS IS THE MOST IMPORTANT CONSTRAINT:
- Many children this age are still learning to read. Sentences MUST be 8 words or fewer, one idea per line, and readable aloud by the teacher.
- Use only everyday words a young child already says. No subject jargon, no abstract nouns ("process", "system", "factor", "represents"), no passive voice.
- Talk about things children can see, touch, or do — objects, animals, family, play, the classroom. Never hypothetical or historical reasoning.
- Ask "what", "which", "who" and "what happens if". Avoid "explain why", "compare", "evaluate", "justify" — these are beyond this age.
- Counting and numbers stay within 20 unless the plan says otherwise.
- Each slide holds at most 3 short lines. A wall of text is a failure at this age.`;
  }
  if (y <= 4) {
    return `AGE-APPROPRIATE LANGUAGE — THIS IS ${label.toUpperCase()} (children aged about ${y + 4}–${y + 5}):
- Sentences of 12 words or fewer, one idea each. Familiar everyday vocabulary.
- Introduce a subject word only when the plan uses it, and gloss it in plain words the first time.
- One-step reasoning only ("what happens if…", "which one and why"). No multi-step or abstract argument.
- Keep examples concrete and close to a child's own experience.
- At most 4 short lines on a slide.`;
  }
  if (y <= 6) {
    return `AGE-APPROPRIATE LANGUAGE — THIS IS ${label.toUpperCase()} (children aged about ${y + 4}–${y + 5}):
- Sentences of 16 words or fewer. Clear, direct, active voice.
- Subject vocabulary is expected, but define each new term in plain language when it first appears.
- Two-step reasoning is fine ("compare these two and say which works better, and why").
- At most 5 lines on a slide.`;
  }
  if (y <= 9) {
    return `AGE-APPROPRIATE LANGUAGE — THIS IS ${label.toUpperCase()} (students aged about ${y + 4}–${y + 5}):
- Full sentences and correct subject terminology, used precisely.
- Multi-step reasoning, comparison and justification are appropriate.
- Keep slide text tight — phrases, not paragraphs.`;
  }
  return `AGE-APPROPRIATE LANGUAGE — THIS IS ${label.toUpperCase()} (students aged about ${y + 4}–${y + 5}):
- Exam-standard precision and terminology; expect extended reasoning and evaluation.
- Keep projected text concise — the depth belongs in what is said, not on the slide.`;
}

/** Younger classes cope with fewer choices on the board. */
function quizOptionCount(yearGroup?: string): number {
  const y = yearNumberOf(yearGroup);
  return y !== null && y <= 2 ? 3 : 4;
}

export async function generateSlides(lessonInput: string, options: EduOptions): Promise<{ slides: SlideContent[], metadata: { description: string, methodology: string } }> {
  try {
    const contents: any[] = [];
    if (options.fileContext) {
      contents.push({ inlineData: options.fileContext });
    }

    let mainPrompt = options.templateMode === 'strict'
      ? `As an expert Cambridge Educator, generate educational slides for the topic: "${lessonInput}". Subject: ${options.subject}, Year Group: ${options.yearGroup}.`
      : `As an expert Cambridge Educator, generate exactly ${options.numSlides} educational slides for: "${lessonInput}". Subject: ${options.subject}, Year Group: ${options.yearGroup}, ${options.lexileLevel !== 'None' ? `Lexile: ${options.lexileLevel}` : ''}.`;

    // The year group is not a hint — these slides go on a wall in front of
    // children of a specific age, so the rules are stated outright.
    mainPrompt += `\n\n${ageGuidance(options.yearGroup)}
    - Every slide title, bullet, activity and question below must obey these rules. Re-read them before writing each slide.`;

    mainPrompt += `\n\nCURRICULUM ALIGNMENT:
    - Align with Cambridge International Framework, Scheme of Work, and official textbooks/references.
    - Reference relevant subject codes and use the OFFICIAL LO CODE FORMAT (Stage+Strand+Number, e.g., 3TC.01) from the following list: ${CAMBRIDGE_CURRICULUM_INFO}
    - Ensure logical progression and high academic terminology consistent with Cambridge standards.
    - CRITICAL: Use the provided subject "${options.subject}" exactly as given. Do not substitute it with a similar subject (e.g. do not change Digital Literacy to Computer Science).`;

    if (options.metadataHints?.description) {
      mainPrompt += `\nLesson Description/Goal: ${options.metadataHints.description}`;
    }
    if (options.metadataHints?.methodology) {
      mainPrompt += `\nPedagogical Methodology to follow: ${options.metadataHints.methodology}`;
    }

    // The teacher's plan outranks everything else here. These slides are the
    // board-facing half of a lesson they have already written and had
    // approved, so the deck has to teach THAT lesson — not the topic in
    // general.
    if (options.lessonPlanContext) {
      const p = options.lessonPlanContext;
      const line = (label: string, v?: string) =>
        v && String(v).trim() ? `\n    - ${label}: ${String(v).trim()}` : "";
      mainPrompt += `\n\nBUILD THESE SLIDES FROM THE TEACHER'S OWN LESSON PLAN — THIS IS THE PRIMARY SOURCE:
    - The teacher has already written this lesson. Your job is to turn THEIR plan into slides a class can read off the board, not to invent a different lesson on the same topic.
    - Cover the plan's learning objective and teach it in the order the plan sets out: introduction first, then the activities, then the assessment/check.
    - Reuse the plan's own wording, examples and terminology wherever it gives any. Do not replace them with your own.
    - Do NOT teach material that belongs to the plan's other weeks.${line("Scheme topic (whole plan)", p.overallTopic)}${line("Week", p.week ? String(p.week) : "")}${line("Unit", p.unit)}${line("This week's topic", p.topic)}${line("Sub-topic", p.subTopic)}${line("Strand", p.strand)}${line("Learning objective", p.learningObjective)}${line("Success criteria", p.successCriteria)}${line("Essential questions", p.essentialQuestions)}${line("Planned introduction / starter", p.introduction)}${line("Planned activities", p.activities)}${line("Planned assessment", p.assessment)}${line("Resources the teacher listed", p.resources)}${
        p.otherWeekTopics?.length
          ? `\n    - Topics covered by OTHER weeks (stay off these): ${p.otherWeekTopics.join("; ")}`
          : ""
      }
    - Slide flow to follow: a title slide for this week's topic; a slide stating the learning objective/success criteria in child-friendly words; content slides that teach the introduction and each planned activity; an activity slide the class actually does; and a quiz slide that checks the planned assessment.`;
    }

    if (options.worksheetContext) {
      mainPrompt += `\n\nCOHESIVE LESSON SEQUENCING FROM ASSESSMENT:
      - This presentation has been triggered directly to convert a generated assessment/worksheet into a comprehensive set of instructional slides.
      - Make sure the slides structure builds up to this assessment!
      - Assessment Title: ${options.worksheetContext.title}
      - Assessment Overview/Description: ${options.worksheetContext.description || "N/A"}
      - Assessment Methodology: ${options.worksheetContext.methodology || "N/A"}
      - Reading Passage (if any) to integrate into early/content slides: ${options.worksheetContext.readingPassage || "None"}
      - Incorporate key concepts, exercises, quiz questions, or activities from the assessment's sections and questions into the slide content where relevant:
      ${JSON.stringify(options.worksheetContext.sections, null, 2)}`;
    }

    mainPrompt += `\n\nCONTENT BRANDING RESTRICTION:
    - DO NOT include or reference "Zera", "Zera Education", "Zera International School", or any Zera brand-specific taglines (such as "From a seed to a mighty tree") or slogans inside the slide titles, bullet points, activities, or descriptions.
    - All generated text, exercises, quiz questions, and activities must be entirely general, neutral, and strictly follow Cambridge Framework standards.
    - The slide templates/design styles handle aesthetic branding, but the actual content itself must be standard and fully universal.`;

    mainPrompt += mandarinDualLanguage(options.subject, options.language, "slides");

    contents.push(mainPrompt);
    contents.push(`Format: JSON object with "slides" (array of {title, type, content, illustrationPrompt}) AND "metadata" (object with "description": string, "methodology": string).
    "methodology": ONE to TWO sentences (MAX 45 words) on the pedagogical approach, mentioning the Cambridge subject code. Be concise — do NOT write a paragraph.
    "description": ONE sentence (MAX 25 words) high-level overview.
    "type" for slides: one of title, content, activity, quiz.
    "content": a FEW (3-4) main points, each with a short description. Format each bullet as "Main point — its description": a short key phrase (about 2-6 words), then an em dash or colon, then ONE clear sentence (about 12-25 words) that explains or gives an example so students understand it. Do NOT write the literal words "key point" / "main point" as a label, and do NOT repeat or restate the key phrase inside its own description. Do NOT give bare labels with no explanation, and do NOT use HTML or markdown tags (plain text only).
    "illustrationPrompt": 3-5 search keywords only.
    "layoutType": (OPTIONAL) suggest one of 'infographic-cards', 'infographic-flow', 'infographic-grid', 'infographic-bubbles' if the content suits a non-list layout, otherwise 'standard'.
    IMPORTANT:
    1. Do NOT repeat the slide "title" as any item in the "content" array.
    2. Each content point is unique, informative, distinct from the title, and includes its own explanation.
    3. Reference the Cambridge Subject Code (from the provided list) in the methodology.`);

    const slideItemSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        type: { type: Type.STRING },
        content: { type: Type.ARRAY, items: { type: Type.STRING } },
        illustrationPrompt: { type: Type.STRING },
        layoutType: { type: Type.STRING },
      },
      required: ["title", "type", "content", "illustrationPrompt"],
    };
    const fullSchema = {
      type: Type.OBJECT,
      properties: {
        metadata: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            methodology: { type: Type.STRING },
          },
          required: ["description", "methodology"],
        },
        slides: { type: Type.ARRAY, items: slideItemSchema },
      },
      required: ["metadata", "slides"],
    };
    const baseParts = contents.map((c) =>
      typeof c === "string" ? { text: c } : c,
    );

    // SPEED: a single call to generate many slides is dominated by output-token
    // generation. For larger decks we split the slides into chunks generated
    // CONCURRENTLY (each call produces far less, and they overlap), then merge —
    // roughly the wall-time of one chunk instead of the whole deck.
    const total = options.numSlides || 0;
    const CHUNK = 6;
    // On Groq a single request is FAST (high tokens/sec) and — crucially — sends
    // the large prompt (curriculum info, worksheet/file context) only ONCE.
    // Chunking re-sends that prompt per chunk, which on rate-limited tiers trips
    // 429s whose backoff dominates wall-time (the "still generating forever"
    // symptom). So only split genuinely large decks; everything else is one call.
    const SINGLE_CALL_MAX = 16;
    if (
      options.templateMode === "strict" ||
      total === 0 ||
      total <= SINGLE_CALL_MAX
    ) {
      const response = await generateContentWithRetry({
        contents: { parts: baseParts },
        config: {
          thinkingConfig: { thinkingBudget: 128 },
          responseMimeType: "application/json",
          // Size the budget to the deck so we don't reserve (and meter) more
          // tokens than needed; leave it open when the count is unknown.
          maxOutputTokens: total > 0 ? Math.min(7000, total * 300 + 900) : undefined,
          responseSchema: fullSchema,
        },
      });
      const text = response.text;
      if (!text) throw new Error("Empty response");
      return JSON.parse(text);
    }

    // Build chunk ranges, e.g. 12 → [1-4][5-8][9-12]
    const chunkCount = Math.ceil(total / CHUNK);
    const per = Math.ceil(total / chunkCount);
    const ranges: { start: number; count: number; idx: number }[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const start = i * per + 1;
      const count = Math.min(per, total - (start - 1));
      if (count > 0) ranges.push({ start, count, idx: i });
    }
    const planNote = `This is ONE coherent ${total}-slide lesson split into ${chunkCount} parts for assembly. Part 1 opens with the title and foundational ideas; middle parts develop the core content with increasing depth; the final part covers application, an activity, and a summary/quiz. Produce slides that fit this overall flow and do NOT duplicate the other parts.`;

    // The metadata call is small and runs alongside the chunks.
    const metaPromise = generateContentWithRetry({
      contents: {
        parts: [
          ...baseParts,
          {
            text: `Return ONLY the "metadata" object for this ${total}-slide lesson. "description": ONE sentence (max 25 words). "methodology": ONE to TWO sentences (max 45 words) mentioning the Cambridge subject code. Be concise — no paragraphs. No slides.`,
          },
        ],
      },
      config: {
        thinkingConfig: { thinkingBudget: 64 },
        responseMimeType: "application/json",
        maxOutputTokens: 400,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            methodology: { type: Type.STRING },
          },
          required: ["description", "methodology"],
        },
      },
    })
      .then((r) => {
        try {
          return JSON.parse(r.text || "{}");
        } catch {
          return { description: "", methodology: "" };
        }
      })
      .catch(() => ({ description: "", methodology: "" }));

    // Chunks run with a CONCURRENCY CAP (not all at once): firing every chunk
    // simultaneously makes Groq rate-limit (429), and the backoff that follows is
    // what made decks feel like they "hang". A small cap + a tight per-chunk
    // token budget keeps total throughput high. Each chunk soft-fails to an empty
    // array so one bad chunk never sinks the whole deck.
    const SLIDE_CHUNK_CONCURRENCY = 3;
    const chunks = await mapLimit(ranges, SLIDE_CHUNK_CONCURRENCY, async (rg) => {
      try {
        const r = await generateContentWithRetry({
          contents: {
            parts: [
              ...baseParts,
              {
                text: `${planNote}\n\nGenerate EXACTLY ${rg.count} slides — these are slides ${rg.start} to ${rg.start + rg.count - 1} of ${total} (part ${rg.idx + 1} of ${chunkCount}). Return ONLY a "slides" array (no metadata). Every bullet in "content" must still be a main point followed by a one-sentence description, as described above — do NOT write the words "key point" and do NOT repeat the point inside its explanation.`,
              },
            ],
          },
          config: {
            thinkingConfig: { thinkingBudget: 128 },
            responseMimeType: "application/json",
            // ~5 short slides of JSON fit comfortably here; a tight cap keeps
            // per-minute token use low so chunks don't trip rate limits.
            maxOutputTokens: Math.min(3200, rg.count * 520 + 400),
            responseSchema: {
              type: Type.OBJECT,
              properties: { slides: { type: Type.ARRAY, items: slideItemSchema } },
              required: ["slides"],
            },
          },
        });
        return { idx: rg.idx, slides: JSON.parse(r.text || "{}").slides || [] };
      } catch {
        return { idx: rg.idx, slides: [] };
      }
    });

    const metadata = await metaPromise;
    const slides = chunks
      .slice()
      .sort((a, b) => a.idx - b.idx)
      .flatMap((c) => c.slides);
    if (slides.length === 0) throw new Error("Empty response");
    return { slides, metadata };
  } catch (err: any) {
    if (typeof window !== 'undefined' && (err.message?.includes('API Key') || err.message?.includes('configured'))) {
      return callAiProxy('slides', lessonInput, options);
    }
    throw err;
  }
}

// Enforce the requested question count: never return MORE questions than the
// user asked for. Walks sections in order, keeps questions until the total
// reaches `max`, then drops the rest (and any now-empty trailing sections).
function capWorksheetQuestions<T extends { sections?: any[] }>(ws: T, max: number): T {
  if (!ws || !Array.isArray(ws.sections) || !max || max <= 0) return ws;
  let count = 0;
  const sections: any[] = [];
  for (const s of ws.sections) {
    if (count >= max) break;
    const qs = Array.isArray(s?.questions) ? s.questions : [];
    const kept = qs.slice(0, max - count);
    count += kept.length;
    sections.push({ ...s, questions: kept });
  }
  return { ...ws, sections };
}

// Reorganize an assessment so questions are MIXED across topics and GROUPED by
// type in a fixed order (multiple-choice, true/false, fill-in, matching,
// sorting, cut-and-paste, short-answer, scenario, drawing) — one section per
// type, no topic-based sections.
const QTYPE_ORDER = [
  "multiple-choice",
  "true-false",
  "fill-in-the-blanks",
  "matching",
  "sorting",
  "cut-and-paste",
  "scenario",
  "short-answer",
  "drawing",
];
const QTYPE_TITLE: Record<string, string> = {
  "multiple-choice": "Multiple Choice Questions",
  "true-false": "True or False",
  "fill-in-the-blanks": "Fill in the Blanks",
  matching: "Matching Questions",
  sorting: "Sorting",
  "cut-and-paste": "Cut and Paste",
  scenario: "Scenario Questions",
  "short-answer": "Short Answer Questions",
  drawing: "Drawing",
};
// Per-section exam instructions (shown under the "Section X:" heading).
const QTYPE_INSTRUCTION: Record<string, string> = {
  "multiple-choice": "Choose the best answer.",
  "true-false": "Write T for True or F for False.",
  "fill-in-the-blanks": "Fill in the blanks using the words from the Word Bank above.",
  matching: "Match each item to the correct answer.",
  sorting: "Sort each item into the correct group.",
  "cut-and-paste": "Cut out each item and paste it in the correct place.",
  scenario: "Read each situation and answer the question.",
  "short-answer": "Answer each question in the space provided.",
  drawing: "Draw your answer in the box.",
};
/* The section scaffolding — "Section A", "(3 Marks)", the type names and their
   instructions — is assembled HERE, in code, not by the model. So a Mandarin
   paper came back with Chinese questions under English headings. These are the
   same labels in each language the picker offers.

   Adding a language is this table plus one line in the Assessment Hub's list;
   anything not listed falls back to English scaffolding, which is wrong-looking
   but never breaks a paper. */
type SectionLabels = {
  section: string;
  mark: string;
  marks: string;
  titles: Record<string, string>;
  instructions: Record<string, string>;
  trueFalse: [string, string];
};

const LOCALISED: Record<string, SectionLabels> = {
  // A Mandarin paper is bilingual: the headings carry the English a pupil is
  // learning from and the Chinese they already read, the same way the questions
  // themselves do. "Section"/"Marks" stay English so the generic head builder
  // below produces "Section A: Multiple Choice Questions（选择题）(5 Marks)".
  enZh: {
    section: "Section",
    mark: "Mark",
    marks: "Marks",
    titles: {
      "multiple-choice": "Multiple Choice Questions（选择题）",
      "true-false": "True or False（判断题）",
      "fill-in-the-blanks": "Fill in the Blanks（填空题）",
      matching: "Matching Questions（配对题）",
      sorting: "Sorting（分类题）",
      "cut-and-paste": "Cut and Paste（剪贴题）",
      scenario: "Scenario Questions（情境题）",
      "short-answer": "Short Answer Questions（简答题）",
      drawing: "Drawing（绘图题）",
    },
    instructions: {
      "multiple-choice": "Choose the best answer.（选出最合适的答案。）",
      "true-false": "Write T for True or F for False.（正确写 T，错误写 F。）",
      "fill-in-the-blanks":
        "Fill in the blanks using the words from the Word Bank above.（用上面词库中的词语填空。）",
      matching: "Match each item to the correct answer.（把每一项与正确的答案配对。）",
      sorting: "Sort each item into the correct group.（把每一项归入正确的类别。）",
      "cut-and-paste":
        "Cut out each item and paste it in the correct place.（剪下每一项并贴到正确的位置。）",
      scenario: "Read each situation and answer the question.（阅读每个情境并回答问题。）",
      "short-answer": "Answer each question in the space provided.（在横线上回答每个问题。）",
      drawing: "Draw your answer in the box.（在方框中画出你的答案。）",
    },
    trueFalse: ["True（对）", "False（错）"],
  },
  zh: {
    section: "第",
    mark: "分",
    marks: "分",
    titles: {
      "multiple-choice": "选择题",
      "true-false": "判断题",
      "fill-in-the-blanks": "填空题",
      matching: "配对题",
      sorting: "分类题",
      "cut-and-paste": "剪贴题",
      scenario: "情境题",
      "short-answer": "简答题",
      drawing: "绘图题",
    },
    instructions: {
      "multiple-choice": "选出最合适的答案。",
      "true-false": "正确写「对」，错误写「错」。",
      "fill-in-the-blanks": "用上面词库中的词语填空。",
      matching: "把每一项与正确的答案配对。",
      sorting: "把每一项归入正确的类别。",
      "cut-and-paste": "剪下每一项并贴到正确的位置。",
      scenario: "阅读每个情境并回答问题。",
      "short-answer": "在横线上回答每个问题。",
      drawing: "在方框中画出你的答案。",
    },
    trueFalse: ["对", "错"],
  },
  zhTW: {
    section: "第",
    mark: "分",
    marks: "分",
    titles: {
      "multiple-choice": "選擇題",
      "true-false": "判斷題",
      "fill-in-the-blanks": "填空題",
      matching: "配對題",
      sorting: "分類題",
      "cut-and-paste": "剪貼題",
      scenario: "情境題",
      "short-answer": "簡答題",
      drawing: "繪圖題",
    },
    instructions: {
      "multiple-choice": "選出最合適的答案。",
      "true-false": "正確寫「對」，錯誤寫「錯」。",
      "fill-in-the-blanks": "用上面詞庫中的詞語填空。",
      matching: "把每一項與正確的答案配對。",
      sorting: "把每一項歸入正確的類別。",
      "cut-and-paste": "剪下每一項並貼到正確的位置。",
      scenario: "閱讀每個情境並回答問題。",
      "short-answer": "在橫線上回答每個問題。",
      drawing: "在方框中畫出你的答案。",
    },
    trueFalse: ["對", "錯"],
  },
  ms: {
    section: "Bahagian",
    mark: "Markah",
    marks: "Markah",
    titles: {
      "multiple-choice": "Soalan Aneka Pilihan",
      "true-false": "Betul atau Salah",
      "fill-in-the-blanks": "Isi Tempat Kosong",
      matching: "Soalan Padanan",
      sorting: "Pengelasan",
      "cut-and-paste": "Gunting dan Tampal",
      scenario: "Soalan Situasi",
      "short-answer": "Soalan Jawapan Pendek",
      drawing: "Lukisan",
    },
    instructions: {
      "multiple-choice": "Pilih jawapan yang paling tepat.",
      "true-false": "Tulis B untuk Betul atau S untuk Salah.",
      "fill-in-the-blanks": "Isi tempat kosong menggunakan perkataan di dalam Bank Perkataan di atas.",
      matching: "Padankan setiap item dengan jawapan yang betul.",
      sorting: "Kelaskan setiap item ke dalam kumpulan yang betul.",
      "cut-and-paste": "Gunting setiap item dan tampalkan di tempat yang betul.",
      scenario: "Baca setiap situasi dan jawab soalan.",
      "short-answer": "Jawab setiap soalan di ruang yang disediakan.",
      drawing: "Lukis jawapan anda di dalam kotak.",
    },
    trueFalse: ["Betul", "Salah"],
  },
};

/** Which label set a chosen language uses, or null for English. A Mandarin
 *  subject with no language picked is bilingual, matching its questions. */
function labelsFor(language?: string, subject?: string): SectionLabels | null {
  const l = (language || "").toLowerCase();
  if (!l || l.startsWith("english"))
    return isMandarin(subject) ? LOCALISED.enZh : null;
  // Traditional gets its own labels; serving simplified forms to a
  // traditional paper is the same kind of wrong as serving English.
  if (/traditional|繁體/.test(l)) return LOCALISED.zhTW;
  if (/mandarin|chinese|中文/.test(l)) return LOCALISED.zh;
  if (/melayu|malay|bahasa/.test(l)) return LOCALISED.ms;
  return null;
}

function normQType(t: any): string {
  const s = String(t || "short-answer").toLowerCase();
  if (s.includes("multiple") || s.includes("mcq") || s.includes("choice")) return "multiple-choice";
  if (s.includes("true") || s.includes("false")) return "true-false";
  if (s.includes("fill") || s.includes("blank")) return "fill-in-the-blanks";
  if (s.includes("match")) return "matching";
  if (s.includes("sort")) return "sorting";
  if (s.includes("cut") || s.includes("paste")) return "cut-and-paste";
  if (s.includes("scenario")) return "scenario";
  if (s.includes("draw")) return "drawing";
  return "short-answer";
}
// Best-effort recovery of question objects from a possibly-truncated JSON string.
// Groq can cut a response off at max_tokens, leaving invalid JSON; rather than
// lose the whole batch we extract every complete {"text":...,"type":...} object.
function salvageQuestions(text: string): any[] {
  if (!text) return [];
  try {
    const obj = JSON.parse(text);
    if (Array.isArray(obj?.questions)) return obj.questions;
    if (Array.isArray(obj?.sections))
      return obj.sections.flatMap((s: any) => s?.questions || []);
  } catch {
    /* fall through to regex salvage below */
  }
  const out: any[] = [];
  // Question objects have no nested objects (options is a flat array), so a
  // brace-balanced-free match is safe.
  const re = /\{[^{}]*?"text"\s*:\s*"(?:[^"\\]|\\.)*"[^{}]*?\}/g;
  for (const m of text.match(re) || []) {
    try {
      out.push(JSON.parse(m));
    } catch {
      /* skip a malformed fragment */
    }
  }
  return out;
}

// A "fingerprint" of a question for duplicate detection — lowercased, stripped
// of punctuation/blanks and common filler words, so near-identical questions
// ("What is a CPU?" vs "What is the CPU?") collapse to the same key.
function questionFingerprint(text: string): string {
  const STOP = new Set([
    "the", "a", "an", "is", "are", "was", "were", "to", "of", "in", "on", "at",
    "for", "and", "or", "what", "which", "who", "when", "where", "why", "how",
    "do", "does", "did", "we", "you", "your", "our", "it", "this", "that",
    "with", "as", "be", "can", "should", "following", "into",
  ]);
  return String(text || "")
    .toLowerCase()
    .replace(/_{2,}/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .sort()
    .join(" ")
    .trim();
}
// Dedupe questions GLOBALLY across all sections (top-ups can repeat a question).
// Drops both exact repeats and near-identical reworded questions.
function dedupeSections(sections: any[]): any[] {
  const seen = new Set<string>();
  return (sections || []).map((s: any) => ({
    ...s,
    questions: (s?.questions || []).filter((q: any) => {
      const exact = String(q?.text || "").toLowerCase().replace(/\s+/g, " ").trim();
      const fp = questionFingerprint(q?.text);
      if (!exact || seen.has(exact) || (fp && seen.has("fp:" + fp))) return false;
      seen.add(exact);
      if (fp) seen.add("fp:" + fp);
      return true;
    }),
  }));
}

// Safety net: a multiple-choice item should never carry True/False-style
// options (that means the model wrote a true-false item by mistake). Strip those
// pseudo-options when real answer choices remain.
function cleanMultipleChoice<T extends { sections?: any[] }>(ws: T): T {
  if (!ws || !Array.isArray(ws.sections)) return ws;
  const JUNK = new Set(["true", "false", "maybe", "unknown", "none", "n/a"]);
  const BLANK = "__________";
  for (const sec of ws.sections) {
    for (const q of sec?.questions || []) {
      if (normQType(q?.type) !== "multiple-choice") continue;
      if (!Array.isArray(q?.options)) continue;
      const filtered = q.options.filter(
        (o: any) => !JUNK.has(String(o || "").trim().toLowerCase()),
      );
      if (filtered.length >= 2) q.options = filtered;
      // Remove duplicate options WITHIN the question (case-insensitive) so the
      // same choice never appears twice.
      const seenOpt = new Set<string>();
      q.options = (q.options || []).filter((o: any) => {
        const key = String(o || "").trim().toLowerCase();
        if (!key || seenOpt.has(key)) return false;
        seenOpt.add(key);
        return true;
      });

      // Normalize any existing blank to a consistent line length first.
      let text = String(q?.text || "").replace(/_{2,}/g, BLANK);
      // Strip the banned repetitive listing prefix ("A computer has X, Y and Z.")
      // when a real question/stem follows — leaves genuine scenario context
      // ("Adam wants to type a story…") untouched (no has/have/contains + list).
      const listPrefix = text.match(
        /^[A-Z][^.?!]*\b(?:has|have|contains?|includes?|consists?\s+of)\b[^.?!]*,[^.?!]*\.\s+(\S[\s\S]*)$/i,
      );
      if (listPrefix && listPrefix[1] && listPrefix[1].trim().length > 8) {
        text = listPrefix[1].trim();
      }
      // If the question is a "complete the sentence" statement that SHOWS the
      // answer (an option appears verbatim in the stem), blank it out so the
      // student must choose the option that completes it. Real questions (no
      // option in the stem) and items already containing a blank are untouched.
      if (!text.includes(BLANK)) {
        const byLen = [...q.options]
          .map((o: any) => String(o || "").trim())
          .filter((o: string) => o.length >= 4)
          .sort((a: string, b: string) => b.length - a.length);
        for (const o of byLen) {
          const idx = text.toLowerCase().indexOf(o.toLowerCase());
          if (idx >= 0) {
            text =
              text.slice(0, idx) + BLANK + text.slice(idx + o.length);
            // tidy spacing/punctuation around the inserted blank
            text = text
              .replace(/\s{2,}/g, " ")
              .replace(/\s+([.?!,;:])/g, "$1")
              .trim();
            break;
          }
        }
      }
      q.text = text;
    }
  }
  return ws;
}

// Tidy sorting questions: strip a stray "Sorting:" / "Sort:" prefix the model
// sometimes adds before the real "Sort the following into: …" instruction.
function normalizeSorting<T extends { sections?: any[] }>(ws: T): T {
  if (!ws || !Array.isArray(ws.sections)) return ws;
  for (const sec of ws.sections) {
    for (const q of sec?.questions || []) {
      if (normQType(q?.type) !== "sorting") continue;
      q.text = String(q?.text || "")
        .replace(/^\s*(sorting|sort)\s*[:\-–]\s*/i, "")
        .trim();
    }
  }
  return ws;
}

// Make sure every fill-in-the-blank sentence keeps ONE clean blank to complete.
// This is NON-DESTRUCTIVE: it never reorders words (which would break grammar).
// It only normalizes the underscores, and — if the sentence somehow has no blank
// — replaces the correct answer word in place so the gap lands mid-sentence.
function normalizeFillBlanks<T extends { sections?: any[] }>(ws: T): T {
  if (!ws || !Array.isArray(ws.sections)) return ws;
  const BLANK = "____";
  for (const sec of ws.sections) {
    for (const q of sec?.questions || []) {
      if (normQType(q?.type) !== "fill-in-the-blanks") continue;
      let text = String(q?.text || "").replace(/_{2,}/g, BLANK).trim();
      const answer = String((q?.options && q.options[0]) || "").trim();

      // No blank at all? Replace the answer word in place (stays mid-sentence).
      if (!text.includes(BLANK) && answer) {
        const re = new RegExp(`\\b${answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (re.test(text)) text = text.replace(re, BLANK);
      }

      // Collapse any extra blanks down to the first one only.
      let seen = false;
      text = text.replace(/____/g, () => (seen ? "" : ((seen = true), BLANK)));

      // Ensure a single space on each side of the blank (fixes "of____ head"),
      // then tidy spaces and remove a space before punctuation.
      text = text
        .replace(/\s*____\s*/g, " ____ ")
        .replace(/\s+([.?!,;:])/g, "$1")
        .replace(/\s{2,}/g, " ")
        .trim();
      q.text = text;
    }
  }
  return ws;
}
function organizeByType<T extends { sections?: any[] }>(ws: T, language?: string, subject?: string): T {
  if (!ws || !Array.isArray(ws.sections)) return ws;
  const all = ws.sections.flatMap((s: any) => s?.questions || []);
  if (!all.length) return ws;
  const groups: Record<string, any[]> = {};
  for (const q of all) {
    const k = normQType(q?.type);
    (groups[k] ||= []).push(q);
  }
  // Build exam-style sections: "Section A: Multiple Choice Questions (N Marks)"
  // with a per-section instruction and 1 mark per question.
  const LETTERS = "ABCDEFGHIJ";
  const ordered: string[] = [];
  for (const k of QTYPE_ORDER) if (groups[k]?.length) ordered.push(k);
  for (const k of Object.keys(groups)) if (!QTYPE_ORDER.includes(k)) ordered.push(k);
  const L = labelsFor(language, subject);
  const sections = ordered.map((k, i) => {
    const qs = groups[k];
    const marks = qs.length;
    const letter = LETTERS[i] || String(i + 1);
    if (L) {
      const name = L.titles[k] || L.titles["short-answer"];
      // Chinese numbers its sections 第一部分 rather than "Section A".
      const head =
        L.section === "第"
          ? `第${"一二三四五六七八九十"[i] || i + 1}部分：${name}（${marks}${L.marks}）`
          : `${L.section} ${letter}: ${name} (${marks} ${marks === 1 ? L.mark : L.marks})`;
      return {
        title: head,
        instructions: L.instructions[k] || "",
        // The model was told to answer in the target language but writes the
        // fixed True/False pair in English often enough to be worth mapping.
        questions: qs.map((q: any) =>
          k === "true-false" && Array.isArray(q?.options)
            ? {
                ...q,
                options: q.options.map((o: any) =>
                  /^true$/i.test(String(o).trim())
                    ? L.trueFalse[0]
                    : /^false$/i.test(String(o).trim())
                      ? L.trueFalse[1]
                      : o,
                ),
                answer: /^true$/i.test(String(q.answer).trim())
                  ? L.trueFalse[0]
                  : /^false$/i.test(String(q.answer).trim())
                    ? L.trueFalse[1]
                    : q.answer,
              }
            : q,
        ),
      };
    }
    const name = QTYPE_TITLE[k] || "Questions";
    return {
      title: `Section ${letter}: ${name} (${marks} ${marks === 1 ? "Mark" : "Marks"})`,
      instructions: QTYPE_INSTRUCTION[k] || "",
      questions: qs,
    };
  });
  return { ...ws, sections };
}

// Cap to the per-type counts the user chose (e.g. at most 5 multiple-choice,
// 3 short-answer). Returns a single flat section; organizeByType regroups it.
function capByTypeCounts<T extends { sections?: any[] }>(
  ws: T,
  typeCounts: Record<string, number> | undefined,
  totalMax: number,
): T {
  if (!ws || !Array.isArray(ws.sections)) return ws;
  const canon: Record<string, number> = {};
  if (typeCounts)
    for (const [k, v] of Object.entries(typeCounts)) {
      const c = normQType(k);
      canon[c] = (canon[c] || 0) + (Number(v) || 0);
    }
  if (Object.keys(canon).length === 0) return capWorksheetQuestions(ws, totalMax);
  const used: Record<string, number> = {};
  const kept: any[] = [];
  for (const q of ws.sections.flatMap((s: any) => s?.questions || [])) {
    const t = normQType(q?.type);
    if ((used[t] || 0) < (canon[t] || 0)) {
      used[t] = (used[t] || 0) + 1;
      kept.push(q);
    }
  }
  return { ...ws, sections: [{ title: "Questions", instructions: "", questions: kept }] };
}

// Drop any question whose type wasn't among the user's selected types, so the
// worksheet only ever contains the question types that were requested.
function filterWorksheetTypes<T extends { sections?: any[] }>(ws: T, allowed: Set<string>): T {
  if (!ws || !Array.isArray(ws.sections) || allowed.size === 0) return ws;
  const sections = ws.sections.map((s: any) => ({
    ...s,
    questions: (s?.questions || []).filter((q: any) => allowed.has(normQType(q?.type))),
  }));
  return { ...ws, sections };
}

/** Restates the chosen language next to the task. Returns "" for English or
 *  when nothing was chosen, which leaves every existing prompt untouched. */
function languageDirective(language?: string): string {
  const l = (language || "").trim();
  if (!l || /^english/i.test(l)) return "";
  return `\n\nLANGUAGE (MANDATORY): Write EVERY part of this worksheet in ${l} — the title, the section headings, the instructions, the questions, all answer options and any reading passage. Do not produce English text anywhere except proper nouns with no accepted translation.`;
}

function isBahasaMelayu(subject?: string): boolean {
  return !!subject && /bahasa\s*melayu/i.test(subject);
}

// Question types are OPTIONAL. When the teacher selects none, the model chooses
// a suitable mix automatically; otherwise it is restricted to the chosen types.
function allowedTypesClause(options: EduOptions, lessonInput: string): string {
  const types = (options.questionTypes || []).filter(Boolean);
  if (types.length) return `Allowed Types: ${types.join(", ")}.`;
  return `Question types are AUTOMATIC — the teacher did not choose any specific type. Select a suitable MIX of common question types (e.g. multiple-choice, short-answer, true-false, fill-in-the-blanks, matching) that best fits the topic "${lessonInput}" and ${options.yearGroup}; use sensible variety rather than only one type.`;
}

// Approximate the numeric Lexile for a band id/label ("BR99-100", "300-400",
// "740L", "AD580L"). Beginning-Reader (BR) codes sit below 0L. Returns NaN when
// no level / "None".
function lexileApprox(levelRaw: string): number {
  const level = (levelRaw || "").trim();
  if (!level || level === "None") return NaN;
  if (/^BR/i.test(level)) return -50; // Beginning Reader, below 0L
  const range = level.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) return (parseInt(range[1], 10) + parseInt(range[2], 10)) / 2;
  const num = level.match(/(\d+)/);
  return num ? parseInt(num[1], 10) : NaN;
}

// Concrete, prescriptive writing rules that make a passage actually MEASURE at
// the requested Lexile band — sentence length, structure, and vocabulary. A
// plain "match this Lexile" instruction is too vague; the model needs hard
// numbers, especially for low/Beginning-Reader levels.
function lexilePassageGuidance(levelRaw: string): string {
  const level = (levelRaw || "").trim();
  const approx = lexileApprox(level);
  if (isNaN(approx)) return "";
  let rules: string;
  if (approx < 100) {
    rules = `This is a BEGINNING-READER level. Match this EXACT style and simplicity (this is the required template):
"""
John has a bag.
He has food.
He has water.
He has a map.
John walks in the woods.
He sees a tree.
He sees a flower.
He sees a small stream.
John sits on a rock.
He eats his food.
Then he walks again.
He climbs a hill.
John sees the woods below.
He is happy.
"""
STRICT RULES: ONE simple idea per sentence; 3-5 words per sentence MAXIMUM; use only the most common one-syllable words; present tense; plain Subject-Verb-Object order; repeat names and sentence patterns (e.g. "He has …", "He sees …"). Write about 12-16 such tiny sentences. Do NOT join ideas with commas, "and", "but", "so", or any clause. FORMAT (critical): put EACH sentence on its OWN line — separate EVERY sentence with a blank line so each sentence sits alone on its own line, exactly like the template above.`;
  } else if (approx < 200) {
    rules = `Very early reader. 4-7 words per sentence. Only common, familiar one- and two-syllable words. Simple subject-verb-object sentences, ONE idea each. Avoid clauses and conjunctions beyond a rare "and".`;
  } else if (approx < 300) {
    rules = `Early reader. 5-8 words per sentence. Mostly common words. Mostly simple sentences with only an occasional "and"/"but". One clear idea per sentence.`;
  } else if (approx < 400) {
    rules = `Simple sentences of 6-10 words, with some short compound sentences joined by "and", "but", or "so". Familiar everyday vocabulary; keep ideas concrete.`;
  } else if (approx < 500) {
    rules = `A mix of simple and compound sentences, 8-12 words. Some descriptive adjectives. Mostly familiar vocabulary with a few new words shown in context.`;
  } else if (approx < 600) {
    rules = `Compound sentences with the occasional complex sentence, 10-14 words. Broader vocabulary including some multi-syllable words.`;
  } else if (approx < 700) {
    rules = `Compound-complex sentences with subordinate clauses, 12-16 words. Varied, more precise vocabulary.`;
  } else if (approx < 800) {
    rules = `Complex sentences with multiple clauses, 14-18 words. Richer, precise vocabulary and some abstract ideas.`;
  } else if (approx < 900) {
    rules = `Sophisticated multi-clause sentences, 16-20 words. Advanced vocabulary and abstract concepts.`;
  } else {
    rules = `Sophisticated, varied sentences of 18-24 words with layered clauses. Academic, precise vocabulary and nuanced ideas.`;
  }
  return ` LEXILE (MANDATORY) — target ${level}: ${rules} Keep the ENTIRE passage consistently at this level; do NOT drift easier or harder.`;
}

export async function generateWorksheet(lessonInput: string, options: EduOptions, slideContext?: SlideContent[], onPartial?: (partial: { phase: string; title: string; readingPassage?: string; description?: string; methodology?: string; sections: WorksheetSection[]; done: number; total: number }) => void): Promise<{ title: string; readingPassage?: string; leveledPassages?: Record<string, string>; description?: string; methodology?: string; sections: WorksheetSection[] }> {
  try {
    const contents: any[] = [];
    if (options.fileContext) {
      contents.push({ inlineData: options.fileContext });
    }
    
    const requestedWordCount = options.targetWordCount ? `${options.targetWordCount} words` : "300-500 words";
    const requestedWorksheetPassageWordCount = options.targetWordCount ? `${options.targetWordCount} words` : "500-800 words";

    const storyPrompt = options.includeStory
      ? `IMPORTANT: Start by writing a short story or reading passage (around ${requestedWordCount}) about "${lessonInput}" suitable for ${options.yearGroup} students. Include this story in the "readingPassage" field.`
      : "DO NOT include a reading passage. Leave the 'readingPassage' field as an empty string \"\".";

    // READING-PASSAGE-ONLY: a dedicated, focused path. The general worksheet
    // prompt below is dominated by question-writing instructions, which made the
    // model emit a section and leave "readingPassage" EMPTY (nothing appeared in
    // the Reading Program). Here we ask ONLY for the passage and state the exact
    // JSON shape (Groq ignores responseSchema, so the field must be explicit).
    if (options.readingPassageOnly) {
      const lexileDirective = lexilePassageGuidance(options.lexileLevel);
      // Low/Beginning-Reader levels must stay SHORT — a long passage of choppy
      // 4-word sentences both reads badly and drifts the level upward. Cap the
      // length for low Lexiles unless the user set an explicit small target.
      const approxLx = lexileApprox(options.lexileLevel);
      let passageWordCount = requestedWorksheetPassageWordCount;
      if (!isNaN(approxLx) && approxLx < 500) {
        if (approxLx < 100) passageWordCount = "40-80 words";
        else if (approxLx < 200) passageWordCount = "60-110 words";
        else if (approxLx < 300) passageWordCount = "90-160 words";
        else passageWordCount = "150-300 words";
      }
      const passagePrompt = `As an expert Cambridge Educator and reading-level specialist, write ONE engaging, age-appropriate reading passage (around ${passageWordCount}) about "${lessonInput}" for ${options.yearGroup} students. Subject: ${options.subject}.${lexileDirective}

STORY ONLY: output the passage prose and NOTHING else. Do NOT include, anywhere in the output, any of the following: a vocabulary list, glossary, word bank, word definitions or meanings, comprehension or discussion questions, an answer key, quizzes, exercises, activities, headings, section titles, labels, bullet points, or lines such as "Vocabulary:", "Questions:", "Answers:", or "Key words:". Just the story/informational text in plain paragraphs.${bahasaMelayuDirective(options.subject)}${mandarinDualLanguage(options.subject, options.language)}

Return ONLY a JSON object in exactly this shape: {"title": "<a short, fitting passage title>", "readingPassage": "<the FULL passage text as a single string, paragraphs separated by \\n\\n>"}. The "readingPassage" value MUST contain ONLY the story prose — no vocabulary, no questions, no answers, no headings.`;
      const resp = await generateContentWithRetry({
        contents: {
          parts: [
            ...(options.fileContext ? [{ inlineData: options.fileContext }] : []),
            { text: passagePrompt },
          ],
        },
        config: {
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
          language: options.language,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              readingPassage: { type: Type.STRING },
            },
            required: ["readingPassage"],
          },
        },
      });
      let passage = "";
      let title = lessonInput;
      try {
        const p = JSON.parse(resp.text || "{}");
        passage = String(p.readingPassage || "").trim();
        title = String(p.title || lessonInput).trim() || lessonInput;
      } catch {
        // Not valid JSON — salvage the raw text as the passage rather than fail.
        passage = String(resp.text || "")
          .replace(/^[^{]*\{/, "")
          .replace(/"?readingPassage"?\s*:\s*"?/i, "")
          .trim();
        if (!passage) passage = String(resp.text || "").trim();
      }
      if (!passage) throw new Error("Empty reading passage");
      // BEGINNING-READER: force one sentence per line (blank line between each)
      // so the output always matches the required template, no matter how the
      // model formatted it.
      if (!isNaN(approxLx) && approxLx < 100) {
        const sentences = passage
          .replace(/\s*\n+\s*/g, " ")
          .match(/[^.!?]+[.!?]+/g);
        if (sentences && sentences.length > 1) {
          passage = sentences.map((s) => s.trim()).filter(Boolean).join("\n\n");
        }
      }
      return {
        title,
        readingPassage: passage,
        description: "",
        methodology: "",
        sections: [{ title: "Reading Passage", instructions: "", questions: [] }],
      };
    }

    // Per-type breakdown (e.g. "5 Multiple Choice, 3 Short Answer") when the
    // user chose counts per type; otherwise a plain total.
    const typeBreakdown = options.typeCounts
      ? Object.entries(options.typeCounts)
          .filter(([, n]) => (n as number) > 0)
          .map(([t, n]) => `${n} ${t}`)
          .join(", ")
      : "";
    const countSpec = typeBreakdown
      ? `Produce EXACTLY this breakdown of question types: ${typeBreakdown} (${options.numQuestions} questions in total). Use ONLY these question types in these amounts — keep writing until every count is met.`
      : `You MUST produce a FULL set of ${options.numQuestions} questions IN TOTAL across all sections — keep writing questions until you reach ${options.numQuestions}; do not stop early. (A few extra is acceptable; we keep the first ${options.numQuestions}.) ${allowedTypesClause(options, lessonInput)}`;

    if (slideContext) {
      contents.push(`CONTEXT FROM SLIDES: ${JSON.stringify(slideContext.map(s => ({ title: s.title, content: s.content })))}`);
      contents.push(`IMPORTANT: The worksheet should directly complement and assess the material presented in these slides.`);
    }

    let mainPrompt = options.readingPassageOnly
      ? `As an expert Cambridge Educator, generate a high-quality READING PASSAGE only (around ${requestedWorksheetPassageWordCount}) for: "${lessonInput}". 
         Subject: ${options.subject}, Year Group: ${options.yearGroup}, Lexile: ${options.lexileLevel}.
         The passage should be informative, engaging, and strictly follow the Lexile level complexity. 
         DO NOT generate any assessment questions or sections. Return exactly one empty section to satisfy the schema.`
      : `As an expert Cambridge Educator, generate a worksheet for: "${lessonInput}". ${countSpec} Subject: ${options.subject}, Year Group: ${options.yearGroup}. ${storyPrompt}`;

    mainPrompt += `\n\nQUESTION QUALITY (MANDATORY):
    - Align with the Cambridge International Framework; keep terminology age-appropriate for ${options.yearGroup}. Use the subject "${options.subject}" exactly as given (do not substitute a similar subject).
    - Produce the FULL requested number of questions — do NOT stop early. ${countSpec}
    - EVERY question MUST be directly about the topic "${lessonInput}" — do not drift to a loosely related subject.
    - Every question must be FACTUALLY CORRECT, logically sound, unambiguous, and exam-style (like Cambridge textbooks/past papers).
    - For "multiple-choice", write the text either as a question ending in "?" or as a "complete the sentence" statement with a "____" blank where the answer goes; EXACTLY ONE option is correct, the others clearly WRONG (e.g. do NOT ask "What is a robot used for in the home?" with both "clean the house" and "cook meals" as options). The text must NEVER contain or reveal the correct answer (if it is a completing sentence, put "____" in place of the answer). Vary the wording; never give True/False options for multiple-choice.
    - For "true-false", write each item as a declarative STATEMENT that is verifiably true or false (e.g. "The Sun is a star."), NOT as an "Is it true that…?" question.
    - Every question MUST be TOTALLY DIFFERENT from the others — different fact/idea/sub-topic of "${lessonInput}", AND a different sentence structure. Do NOT reuse the same template or opening for multiple questions (e.g. not "A computer has …. What is the purpose of …?" repeated). Do not ask the same thing twice with different wording. Cover a wide range of sub-topics.
    - ANSWERS must not be repetitive: the choices within a question must all differ, and do NOT reuse the same correct answer or the same set of options across questions. Each question should have fresh, distinct answer choices.`;

    if (options.metadataHints?.description) {
      mainPrompt += `\nIntegration Goal: ${options.metadataHints.description}`;
    }
    if (options.metadataHints?.methodology) {
      mainPrompt += `\nPedagogical Focus: ${options.metadataHints.methodology}`;
    }
    mainPrompt += bahasaMelayuDirective(options.subject);
    mainPrompt += bahasaMelayuFormatGuide(options.subject);
    mainPrompt += mandarinDualLanguage(options.subject, options.language);
    // Said in the prompt as well as the system rule: the model follows a
    // language instruction far more reliably when it appears beside the task.
    mainPrompt += languageDirective(options.language);

    // When a file was uploaded, its text is included below as "UPLOADED DOCUMENT
    // CONTENT". Override the generic "about the topic <filename>" instructions
    // above so the questions are based on the ACTUAL document, not the filename.
    if (options.fileContext) {
      mainPrompt += `\n\nUPLOADED SOURCE (CRITICAL — HIGHEST PRIORITY): An uploaded document is included below as "UPLOADED DOCUMENT CONTENT". Base EVERY question and answer STRICTLY on that document's actual content — its topics, facts, definitions, examples, and vocabulary. The questions must assess understanding of THAT document. IGNORE the filename as a topic; do NOT invent unrelated questions. If the document already contains questions/exercises, use or closely adapt them.`;
    }

    const encodingRules = `QUESTION "type" FIELD — set it to one of these exact lowercase values based on the question, and follow the encoding rules for each:
- "multiple-choice": "options" are 3-4 short answer choices (exactly one correct, the rest clearly wrong, correct one in a varying position). The options within a question must ALL be different from each other (no repeated choices), and across questions DO NOT keep reusing the same answer choices — vary them. NEVER use "True"/"False"/"Maybe" as options here. The "text" must be written in ONE of these two forms, and MUST NEVER contain or reveal the correct answer:
   (1) a QUESTION ending in "?" — e.g. {"text":"Which planet is closest to the Sun?","options":["Mercury","Venus","Earth","Mars"]};
   (2) a "complete the sentence" statement with a "____" blank EXACTLY where the answer goes — e.g. {"text":"We should hold our device ____ to avoid eye strain.","options":["Very close to our face","Far away from our face","At a comfortable distance"]}. The student picks the option that fills the blank.
  NEVER write the correct answer inside the sentence. CRITICAL — EACH QUESTION MUST BE STRUCTURED DIFFERENTLY. NEVER reuse the same sentence template. In particular, do NOT begin questions with a list of parts like "A computer has X, Y and Z. What is the purpose of …?" — this is BANNED and must not appear even once. Instead vary like these good examples (notice each is different — a different scenario, person, or phrasing):
   {"text":"Adam wants to type a story on the computer. Which device helps him enter words?","options":["Monitor","Keyboard","Speaker","Printer"]}
   {"text":"Sarah moves a small device on the table to control the pointer on screen. What is she using?","options":["Mouse","Scanner","Speaker","Webcam"]}
   {"text":"The brain of the computer that processes information is the ____.","options":["CPU","Monitor","Mouse","Speaker"]}
   {"text":"Which part of the computer displays pictures and text?","options":["Monitor","Keyboard","Hard drive","Microphone"]}
   {"text":"Why do we save our work before closing a program?","options":["To keep our changes","To delete the file","To turn off the screen","To print it"]}
  Mix short real-life scenarios (with different names/situations), direct "What/Which/Why/Where/How" questions, and blank-completion stems — but never twice the same shape.
- "true-false": write a clear declarative STATEMENT (NOT a question) that is plainly true or false — e.g. "A search engine is used to find information on the internet." Do NOT phrase it as "Is it true that…?" and do NOT put "True or False" inside the text. Put exactly ["True","False"] in "options".
- "fill-in-the-blanks": a short, concise exam-style sentence (8-14 words) with exactly one "____" blank and a normal space around it. The FIRST option is the correct answer and MUST be a SINGLE WORD (at most two words; use DIGITS for numbers) — NEVER a phrase, clause, or full sentence, because it is displayed in a Word Bank. Add 1-2 short single-word distractors. Each fill-in must have a different answer.
- "short-answer" / "scenario": an open written response; leave "options" empty.
- "matching": a left-to-right matching task; leave "options" empty.
- "drawing": a creative DRAWING task — the student draws their answer in an empty box. Write a clear drawing instruction in "text" and DO NOT provide "options".
- "sorting": a sorting task. The "text" MUST be EXACTLY "Sort the following into: <Category 1> and <Category 2>." (name 2-4 categories; do NOT prefix it with "Sorting:" or anything else). ALSO set "categories" to the exact list of those category names (the column headers), e.g. ["Input Devices","Output Devices"] — these are shown as the column titles, so they must be real, descriptive names, never "Group 1"/"Group 2". "options" MUST be a list of 6-8 specific ITEMS to sort into those categories — the items are the words the student places into the groups, and they must NOT be the category names. Example: {"text":"Sort the following into: Input Devices and Output Devices.","type":"sorting","categories":["Input Devices","Output Devices"],"options":["Keyboard","Mouse","Monitor","Printer","Microphone","Speaker"]}. NEVER produce a sorting task with an empty "options" list.
- "cut-and-paste": a cut-and-paste task, encoded EXACTLY like "sorting". Set "categories" to the column headings (2-4 real, descriptive names such as ["Happy Feelings","Sad Feelings"] — never "Group 1"/"Group 2"), and put the individual items the student cuts out in "options". The "text" MUST NAME THE CATEGORIES, e.g. "Cut out the words and paste them under: Happy Feelings and Sad Feelings." CRITICAL: never list the items themselves in "text" — writing "paste them into the correct box: happy, sad, excited" leaves the child with no categories to sort into, and the same words end up as both the columns and the cut-outs. The items in "options" and the names in "categories" must share nothing.
Only use the types that appear in the "Allowed Types" list above.`;
    contents.push(mainPrompt);
    contents.push(`Format: JSON object with "title", "readingPassage" (The main content if readingPassageOnly, or the context story if includeStory), "description" (ONE sentence, max 25 words), "methodology" (ONE to TWO sentences, max 45 words, MUST include the Cambridge Subject Code — do NOT write a paragraph), and "sections" (array of {title, instructions, questions: array of {text, type, options}}). Keep every question concise and direct. If readingPassageOnly is true, sections should contain exactly one placeholder entry if necessary to satisfy the schema, and no questions.`);
    contents.push(encodingRules);

    const questionItemSchema = {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        type: { type: Type.STRING },
        options: { type: Type.ARRAY, items: { type: Type.STRING } },
        categories: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            "Sorting questions ONLY: the 2-4 category/column names items are sorted into (e.g. [\"Input Devices\",\"Output Devices\"]). Leave empty for other question types.",
        },
      },
      required: ["text", "type"],
    };
    const sectionItemSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        instructions: { type: Type.STRING },
        questions: { type: Type.ARRAY, items: questionItemSchema },
      },
      required: ["title", "instructions", "questions"],
    };
    const fullWsSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        readingPassage: { type: Type.STRING },
        description: { type: Type.STRING },
        methodology: { type: Type.STRING },
        sections: { type: Type.ARRAY, items: sectionItemSchema },
      },
      required: ["title", "sections"],
    };

    const total = options.numQuestions || 0;
    const CHUNK = 5;
    // SINGLE-CALL MODE: build the whole worksheet in ONE API request so we stay
    // well under the Gemini free-tier per-minute request cap (~20 req/min).
    // To re-enable faster parallel-batch generation on a paid/higher-limit key,
    // restore the commented condition below.
    const canChunk: boolean = false;
    // const canChunk =
    //   !options.readingPassageOnly &&
    //   !options.fileContext &&
    //   !slideContext &&
    //   total > CHUNK + 1;
    void CHUNK;

    if (!canChunk) {
      const response = await generateContentWithRetry({
        contents: { parts: contents.map(c => typeof c === 'string' ? { text: c } : c) },
        config: {
          // Structured generation, not deep reasoning — disable "thinking"
          // entirely to minimise latency.
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
          language: options.language,
          responseSchema: fullWsSchema,
        },
      });
      const text = response.text;
      if (!text) throw new Error("Empty response");
      // Only keep the question types the user actually selected (the model can
      // slip in extra types like drawing).
      const allowedTypes = new Set(
        (options.questionTypes || []).map((x) => normQType(x)),
      );
      // The response can be truncated at max_tokens (large counts) leaving
      // invalid JSON — salvage whatever questions we can instead of failing.
      let parsed: any;
      try {
        parsed = JSON.parse(text);
        if (!Array.isArray(parsed?.sections) || !parsed.sections.length) {
          const qs = salvageQuestions(text);
          if (qs.length) parsed.sections = [{ title: "Questions", instructions: "", questions: qs }];
        }
      } catch {
        const titleM = text.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const passM = text.match(/"readingPassage"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        parsed = {
          title: titleM ? titleM[1] : (lessonInput || "Worksheet"),
          readingPassage: passM ? passM[1] : "",
          sections: [{ title: "Questions", instructions: "", questions: salvageQuestions(text) }],
        };
      }
      let ws: any = filterWorksheetTypes(parsed, allowedTypes);
      // Remove duplicate questions from the very first response too (the top-up
      // loop dedupes as it adds, but the initial batch was not deduped before).
      ws = { ...ws, sections: dedupeSections(ws.sections || []) };
      const want = options.numQuestions || 0;

      // Progress for the UI: the title/passage + first batch land immediately,
      // then each top-up round reports how many questions are ready so far.
      const emitPartial = (phase: string, w: any) => {
        if (!onPartial) return;
        const cnt = (w?.sections || []).reduce(
          (n: number, s: any) => n + (s?.questions?.length || 0),
          0,
        );
        onPartial({
          phase,
          title: w?.title || lessonInput,
          readingPassage: w?.readingPassage || "",
          description: w?.description || "",
          methodology: w?.methodology || "",
          sections: w?.sections || [],
          done: cnt,
          total: want || cnt,
        });
      };
      emitPartial("header", ws);

      // Desired count per CANONICAL type (when the user chose per-type counts).
      const desiredByType: Record<string, number> = {};
      if (options.typeCounts)
        for (const [k, v] of Object.entries(options.typeCounts)) {
          const c = normQType(k);
          desiredByType[c] = (desiredByType[c] || 0) + (Number(v) || 0);
        }
      const hasTypeCounts = Object.keys(desiredByType).length > 0;

      const countByType = (w: any) => {
        const m: Record<string, number> = {};
        for (const q of (w?.sections || []).flatMap((s: any) => s?.questions || [])) {
          const t = normQType(q?.type);
          m[t] = (m[t] || 0) + 1;
        }
        return m;
      };
      const countTotal = (w: any) =>
        (w?.sections || []).reduce((n: number, s: any) => n + (s?.questions?.length || 0), 0);

      // Compute what's still missing. With per-type counts we top up EACH short
      // type specifically (so capByTypeCounts won't trim away the wrong types);
      // otherwise we just chase the total.
      const computeDeficit = (): { byType: Record<string, number>; total: number } => {
        if (hasTypeCounts) {
          const cur = countByType(ws);
          const byType: Record<string, number> = {};
          let total = 0;
          for (const [t, n] of Object.entries(desiredByType)) {
            const miss = n - (cur[t] || 0);
            if (miss > 0) {
              byType[t] = miss;
              total += miss;
            }
          }
          return { byType, total };
        }
        return { byType: {}, total: Math.max(0, want - countTotal(ws)) };
      };

      // The model usually stops short on large counts (token cap). Top up the
      // shortfall in SAFE-SIZED batches (each small enough to return complete
      // JSON) until every requested count is met, then cap to the exact numbers.
      const BATCH = 12; // questions per top-up call — stays well under the token cap
      const maxTopups = want > 0 ? Math.ceil(want / BATCH) + 6 : 0;
      let topups = 0;
      let dry = 0;

      // One top-up batch: ask for `breakdownLine` more questions, avoiding the
      // `existing` texts. Returns the accepted (allowed-type, still-needed)
      // questions, or [] on failure so a round can keep its other batches.
      const runTopupBatch = async (
        breakdownLine: string,
        existing: string[],
        deficitByType: Record<string, number>,
      ): Promise<any[]> => {
        try {
          const more = await generateContentWithRetry({
            contents: {
              parts: [
                {
                  text: `As an expert Cambridge Educator, write EXACTLY these ADDITIONAL distinct, exam-style assessment questions STRICTLY about the topic "${lessonInput}" (Subject: ${options.subject}, Year Group: ${options.yearGroup}): ${breakdownLine}. EVERY question must be directly about "${lessonInput}" — do not drift off-topic. Use ONLY these exact lowercase "type" values. Every question must be factually accurate, logically sound, and aligned with Cambridge textbooks/past papers, with a clearly correct answer. For multiple-choice, EXACTLY ONE option may be correct — the other options must be clearly WRONG (never also-true or partially-correct) so the student can pick a single unambiguous answer; vary the wording (not all "What/Which/When"). For true-false, write a declarative STATEMENT (not an "Is it true…?" question). They MUST be COMPLETELY different from each other and from these existing questions — different sub-topic, different sentence structure, and different answer choices; do NOT reuse the same template/opening: ${JSON.stringify(existing)}.\n${encodingRules}${bahasaMelayuDirective(options.subject)}${bahasaMelayuFormatGuide(options.subject)}${mandarinDualLanguage(options.subject, options.language)}\nReturn ONLY JSON: {"questions": [{"text","type","options"}]}`,
                },
              ],
            },
            config: {
              thinkingConfig: { thinkingBudget: 0 },
              responseMimeType: "application/json",
          language: options.language,
              // A 12-question batch fits comfortably; a tight cap keeps these
              // snappy so parallel batches don't trip rate limits.
              maxOutputTokens: 2400,
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  questions: { type: Type.ARRAY, items: questionItemSchema },
                },
                required: ["questions"],
              },
            },
          });
          // Salvage handles truncated top-up responses too. When per-type counts
          // are set, only accept types we still need (so we converge).
          return salvageQuestions(more.text || "").filter((q: any) => {
            const t = normQType(q?.type);
            if (!allowedTypes.has(t)) return false;
            return hasTypeCounts ? (deficitByType[t] || 0) > 0 : true;
          });
        } catch {
          return []; // network/parse failure — try another batch rather than give up
        }
      };

      while (want > 0 && topups < maxTopups && dry < 3) {
        const deficit = computeDeficit();
        if (deficit.total <= 0) break;

        // Build the batch request — fill the shortest types first, up to BATCH.
        let breakdownLine = `${Math.min(deficit.total, BATCH)} questions`;
        if (hasTypeCounts) {
          const parts: string[] = [];
          let budget = BATCH;
          for (const [t, miss] of Object.entries(deficit.byType)) {
            if (budget <= 0) break;
            const take = Math.min(miss, budget);
            parts.push(`${take} "${t}"`);
            budget -= take;
          }
          breakdownLine = parts.join(", ") || breakdownLine;
        }

        const existing = (ws?.sections || [])
          .flatMap((s: any) => s?.questions || [])
          .map((q: any) => q?.text)
          .filter(Boolean)
          .slice(-25);

        // Fire several batches CONCURRENTLY this round (cap 3): a large shortfall
        // fills in roughly the time of ONE batch instead of N sequential
        // round-trips — the main cause of "worksheet takes so long". Overlap
        // across batches is removed by dedupeSections.
        const roundBatches = Math.max(1, Math.min(3, Math.ceil(deficit.total / BATCH)));
        topups += roundBatches;
        const batched = await mapLimit(
          Array.from({ length: roundBatches }, (_, i) => i),
          3,
          () => runTopupBatch(breakdownLine, existing, deficit.byType),
        );
        const extra = batched.flat();
        if (!extra.length) {
          dry++;
          continue;
        }
        dry = 0;
        const secs =
          ws?.sections && ws.sections.length
            ? ws.sections
            : [{ title: "More Questions", instructions: "", questions: [] }];
        secs[secs.length - 1].questions = [
          ...(secs[secs.length - 1].questions || []),
          ...extra,
        ];
        ws = { ...ws, sections: dedupeSections(secs) };
        emitPartial("questions", ws);
      }
      // Bahasa Melayu papers keep the model's own "Bahagian" sections (grammar
      // topic / comprehension), so DON'T regroup by question type (which would
      // overwrite them with English type-named sections). Other subjects get the
      // standard exam-style "Section A: Multiple Choice…" grouping.
      const capped = isBahasaMelayu(options.subject)
        ? capWorksheetQuestions(ws, want)
        : organizeByType(
            capByTypeCounts(ws, options.typeCounts, want),
            options.language,
            options.subject,
          );
      return normalizeSorting(cleanMultipleChoice(normalizeFillBlanks(capped)));
    }

    // SPEED: generate the questions in CONCURRENT batches (each call produces
    // far fewer questions, and they overlap), then merge — roughly the wall
    // time of one batch instead of the whole worksheet.
    const chunkCount = Math.ceil(total / CHUNK);
    const per = Math.ceil(total / chunkCount);
    const ranges: { count: number; idx: number }[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const count = Math.min(per, total - i * per);
      if (count > 0) ranges.push({ count, idx: i });
    }
    const lex =
      options.lexileLevel && options.lexileLevel !== "None"
        ? `, Lexile: ${options.lexileLevel}`
        : "";
    // SPEED: the full ~1.8k-char curriculum list only matters for the header
    // call (which writes the methodology + Cambridge LO code). Keep it OUT of
    // the parallel question batches so each batch sends far fewer input tokens
    // and returns faster — the batches just need the topic/subject/year.
    const sharedCtx = `As an expert Cambridge Educator preparing a worksheet on "${lessonInput}". Subject: ${options.subject}, Year Group: ${options.yearGroup}${lex}.
Use the subject "${options.subject}" exactly. Keep all content neutral and brand-free, and keep every question concise and direct.${bahasaMelayuDirective(options.subject)}${bahasaMelayuFormatGuide(options.subject)}${mandarinDualLanguage(options.subject, options.language)}`;
    const curriculumNote = `\nCURRICULUM ALIGNMENT: Align with the Cambridge International Framework and Scheme of Work; where natural reference one official LO code (Stage+Strand+Number, e.g. 3TC.01) using: ${CAMBRIDGE_CURRICULUM_INFO}`;

    // Header: title + (optional) passage + short description/methodology.
    const headerPromise = generateContentWithRetry({
      contents: {
        parts: [
          ...(options.fileContext ? [{ inlineData: options.fileContext }] : []),
          {
            text: `${sharedCtx}${curriculumNote}
${options.includeStory ? `Write a short reading passage (around ${requestedWordCount}) about "${lessonInput}" for ${options.yearGroup} students and put it in "readingPassage".` : `Leave "readingPassage" as an empty string.`}
Return ONLY: "title" (a concise worksheet title), "readingPassage" (as above), "description" (ONE sentence, max 25 words), "methodology" (ONE to TWO sentences, max 45 words, include the Cambridge subject code). NO sections.`,
          },
        ],
      },
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
          language: options.language,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            readingPassage: { type: Type.STRING },
            description: { type: Type.STRING },
            methodology: { type: Type.STRING },
          },
          required: ["title"],
        },
      },
    }).then((r) => {
      try {
        return JSON.parse(r.text || "{}");
      } catch {
        return {};
      }
    });

    const makeBatch = (rg: { count: number; idx: number }, passage: string) =>
      generateContentWithRetry({
        contents: {
          parts: [
            {
              text: `${sharedCtx}
Generate EXACTLY ${rg.count} questions as ONE worksheet section (give the section a fitting title and a brief instruction line). This is part ${rg.idx + 1} of ${chunkCount} of a ${total}-question worksheet — cover a DISTINCT sub-area and do NOT duplicate the other parts. ${allowedTypesClause(options, lessonInput)}${passage ? `\nBase the questions on this reading passage:\n"""${passage}"""` : ""}
${encodingRules}
Return ONLY a "sections" array containing exactly ONE section with exactly ${rg.count} questions.`,
            },
          ],
        },
        config: {
          // Question batches are structured generation, not deep reasoning —
          // disable thinking to minimise latency per batch.
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
          language: options.language,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sections: { type: Type.ARRAY, items: sectionItemSchema },
            },
            required: ["sections"],
          },
        },
      }).then((r) => {
        try {
          return { idx: rg.idx, sections: JSON.parse(r.text || "{}").sections || [] };
        } catch {
          return { idx: rg.idx, sections: [] as WorksheetSection[] };
        }
      });

    // PHASED STREAMING: report each phase to the caller the moment it lands —
    // header (title + passage) first, then each question batch as it resolves —
    // so the UI fills in progressively instead of waiting for the whole thing.
    let header: any = {
      title: lessonInput,
      readingPassage: "",
      description: "",
      methodology: "",
    };
    let headerReady = false;
    const collected = new Map<number, WorksheetSection[]>();
    const orderedSections = () =>
      ranges
        .map((r) => r.idx)
        .sort((a, b) => a - b)
        .flatMap((idx) => collected.get(idx) || []);
    const emit = (phase: string) => {
      if (!onPartial) return;
      onPartial({
        phase,
        title: header.title || lessonInput,
        readingPassage: header.readingPassage || "",
        description: header.description || "",
        methodology: header.methodology || "",
        sections: orderedSections(),
        done: collected.size,
        total: ranges.length,
      });
    };

    const hp = headerPromise.then((h) => {
      header = { ...header, ...h };
      headerReady = true;
      emit("header");
    });
    const runBatch = (rg: { count: number; idx: number }, passage: string) =>
      makeBatch(rg, passage).then((b) => {
        collected.set(b.idx, b.sections);
        emit("questions");
      });

    if (options.includeStory) {
      // Questions reference the passage → write the passage first, then fan out.
      await hp;
      await Promise.all(
        ranges.map((rg) => runBatch(rg, header.readingPassage || "")),
      );
    } else {
      // No passage dependency → header + all batches fully concurrent.
      await Promise.all([hp, ...ranges.map((rg) => runBatch(rg, ""))]);
    }
    const sections = orderedSections();
    if (sections.length === 0) throw new Error("Empty response");
    emit("done");
    return {
      title: header.title || lessonInput,
      readingPassage: header.readingPassage || "",
      description: header.description || "",
      methodology: header.methodology || "",
      sections,
    };
  } catch (err: any) {
    // In the browser, ALWAYS fall back to the server proxy on ANY failure
    // (empty response, network, model unavailable, missing key, etc.). The
    // server has the API key + model fallback chain and reliably returns a
    // populated worksheet — this prevents a silent empty generation.
    if (typeof window !== 'undefined') {
      try {
        // Stream when the caller wants progress (so the UI can show questions
        // landing batch by batch); otherwise use the plain proxy.
        const viaProxy = onPartial
          ? await callAiProxyStream('worksheet', lessonInput, { ...options, slideContext }, onPartial)
          : await callAiProxy('worksheet', lessonInput, { ...options, slideContext });
        if (viaProxy && (viaProxy as any).sections && (viaProxy as any).sections.length > 0) {
          return viaProxy;
        }
      } catch (proxyErr: any) {
        console.error('Worksheet proxy fallback failed:', proxyErr);
        // The proxy's message (e.g. "GROQ_API_KEY is not set in this
        // deployment — add it in Vercel…") is far more accurate than the
        // browser's generic "not configured", so surface it instead.
        if (proxyErr?.message) throw proxyErr;
      }
    }
    throw err;
  }
}

export async function generateReadingProgram(lessonInput: string, options: EduOptions): Promise<ReadingProgram> {
  try {
    const contents: any[] = [];
    
    let passageDetails = "";
    const activePassage = options.worksheetContext?.readingPassage || "";
    if (activePassage) {
      passageDetails = `Here is the READING PASSAGE generated for this topic:\n"${activePassage}"\n\n`;
    }
    
    contents.push(`As an expert Literacy Specialist and Cambridge Educator, generate a comprehensive STRATEGIC READING PLAN for ${options.yearGroup} ${options.subject} based on the topic: "${lessonInput}".

      ${passageDetails}
      
      THE STRATEGIC PLAN MUST CONTAIN:
      1. A clear title and description.
      2. A specific focus area (e.g., Reading Comprehension, Active Analysis, Narrative Interpretation, Class Inquiry).
      3. A duration (specifically "1 Day" or "Single Session" for this passage).
      4. 2-3 specific strategic goals of analyzing this passage.
      5. To maintain compatibility with existing structures, populate "recommendedBooks" with a single record describing the topic or passage itself, and "milestones" with a single milestone representing this 1-day study activity.
      6. A "oneDayPlan" object specifically designed for studying the generated passage containing:
         - "dayTopic": A specific main topic/theme of the day.
         - "passageObjective": The targeted learning outcome for studying the generated passage.
         - "vocabulary": An array of 3-5 vocabulary words SELECTED FROM THE GENERATED PASSAGE, each with its definition and an example context sentence from or related to the passage context.
         - "questions": An array of 3-5 comprehension and analytical discussion questions based strictly on the narrative/details of the generated passage, with brief answer guidance.
         - "activities": An array of 3 actionable, engaging follow-up activities to do in class based on the passage (e.g., student roleplay, creative drawing, group discussion, short sentence-building), with titles, description, and planned duration (e.g. "15 minutes").

      Format: JSON object matching the defined schema.`);

    const response = await generateContentWithRetry({
      contents: { parts: contents.map(c => typeof c === 'string' ? { text: c } : c) },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            gradeLevel: { type: Type.STRING },
            focusArea: { type: Type.STRING },
            duration: { type: Type.STRING },
            weeklyGoals: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendedBooks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  author: { type: Type.STRING },
                  lexileLevel: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  themes: { type: Type.ARRAY, items: { type: Type.STRING } },
                  vocabulary: { type: Type.ARRAY, items: { type: Type.STRING } },
                  comprehensionQuestions: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["title", "author", "summary", "lexileLevel"]
              }
            },
            milestones: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  week: { type: Type.NUMBER },
                  objective: { type: Type.STRING },
                  task: { type: Type.STRING }
                },
                required: ["week", "objective", "task"]
              }
            },
            oneDayPlan: {
              type: Type.OBJECT,
              properties: {
                dayTopic: { type: Type.STRING },
                passageObjective: { type: Type.STRING },
                vocabulary: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      word: { type: Type.STRING },
                      definition: { type: Type.STRING },
                      contextSentence: { type: Type.STRING }
                    },
                    required: ["word", "definition", "contextSentence"]
                  }
                },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      answer: { type: Type.STRING }
                    },
                    required: ["question"]
                  }
                },
                activities: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      duration: { type: Type.STRING }
                    },
                    required: ["title", "description", "duration"]
                  }
                }
              },
              required: ["dayTopic", "passageObjective", "vocabulary", "questions", "activities"]
            }
          },
          required: ["title", "description", "weeklyGoals", "recommendedBooks", "milestones", "oneDayPlan"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text);
  } catch (err: any) {
    if (typeof window !== 'undefined' && (err.message?.includes('API Key') || err.message?.includes('configured'))) {
      return callAiProxy('readingProgram', lessonInput, options);
    }
    throw err;
  }
}

export async function generateSessionPlan(topic: string, subtopics: string, weeks: 10 | 12, options: EduOptions): Promise<LessonPlan> {
  try {
    const contents: any[] = [];
    const mainPrompt = `As an expert Cambridge Educator, create a professional, detailed ${weeks}-WEEK Session Plan.
      
      TOPIC: ${topic}
      SUBTOPICS: ${subtopics}
      ${options.metadataHints?.description ? `
      TEACHER INSTRUCTIONS (HIGHEST PRIORITY):
      - The teacher has given the following specific instructions for this term program. Follow them closely when building every week of the plan:
      "${options.metadataHints.description}"
      ` : ''}
      STANDARDS & FRAMEWORK:
      - Use the provided subject "${options.subject}" exactly as given.
      - Base the content strictly on the Cambridge International Curriculum.
      - Align objectives with official Cambridge Framework Learning Objectives using the Stage+Strand+Number format (e.g., 3TC.01, 3Rf.04).
      - Incorporate methodology consistent with Cambridge Schemes of Work (SoW).
      - Follow the official framework, scheme of work, and textbook/reference materials.
      
      ${weeks}-WEEK OVERVIEW:
      Generate a logical, curriculum-appropriate progression for exactly ${weeks} weeks based on the provided topic and subtopics.
      
      Format the response as a JSON object with:
      - "term": "${options.term || ''}"
      - "subject": string (MUST include Cambridge Code, e.g., "Science (0097)")
      - "duration": "${options.duration || ''}"
      - "date": "${options.date || ''}"
      - "academicYear": "${options.academicYear || ''}"
      - "class": "${options.class || ''}"
      - "preparedBy": "${options.preparedBy || ''}"
      - "checkedBy": "${options.checkedBy || ''}"
      - "overallTopic": "${topic}"
      - "weeklyBreakdown": Array of exactly ${weeks} objects, each with:
        - "week": number (1-${weeks})
        - "unit": string (The Cambridge curriculum unit number and title)
        - "topic": string (A specific focus for this week)
        - "subTopic": string (ONE narrower slice of that week's topic — teachable in a lesson or two, e.g. topic "Electricity" -> subTopic "Series and parallel circuits")
        - "strand": string (the curriculum strand)
        - "learningObjective": string (one clear, numbered learning objective)
        - "introduction": string (detailed overview)
        - "activities": string (specific activities)
        - "assessment": string (assessment method)
        - "resources": string (teaching materials and references; include a Cambridge Learning Standard code ONLY if it is from an uploaded scheme of work or you are certain it is the exact official code — never fabricate one)
    `;
    contents.push(mainPrompt);

    const response = await generateContentWithRetry({
      contents: { parts: contents.map(c => typeof c === 'string' ? { text: c } : c) },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            term: { type: Type.STRING },
            subject: { type: Type.STRING },
            duration: { type: Type.STRING },
            date: { type: Type.STRING },
            academicYear: { type: Type.STRING },
            class: { type: Type.STRING },
            preparedBy: { type: Type.STRING },
            checkedBy: { type: Type.STRING },
            overallTopic: { type: Type.STRING },
            subTopic: { type: Type.STRING },
            strandSummary: { type: Type.STRING },
            learningObjectiveSummary: { type: Type.ARRAY, items: { type: Type.STRING } },
            successCriteria: { type: Type.ARRAY, items: { type: Type.STRING } },
            essentialQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyCompetencies: { type: Type.ARRAY, items: { type: Type.STRING } },
            portfolioEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
            weeklyBreakdown: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  week: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  subTopic: { type: Type.STRING },
                  strand: { type: Type.STRING },
                  learningObjective: { type: Type.STRING },
                  introduction: { type: Type.STRING },
                  activities: { type: Type.STRING },
                  assessment: { type: Type.STRING },
                  resources: { type: Type.STRING }
                },
                required: ["week", "unit", "topic", "subTopic", "strand", "learningObjective", "introduction", "activities", "assessment", "resources"]
              }
            }
          },
          required: ["overallTopic", "weeklyBreakdown"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text);
  } catch (err: any) {
    if (typeof window !== 'undefined' && (err.message?.includes('API Key') || err.message?.includes('configured'))) {
      return callAiProxy('sessionPlan', topic, { ...options, subtopics, weeks });
    }
    throw err;
  }
}

export async function generateLessonPlan(lessonInput: string, options: EduOptions): Promise<LessonPlan> {
  try {
    const contents: any[] = [];
    if (options.fileContext) {
      contents.push({ inlineData: options.fileContext });
    }
    const weekCount = options.topics?.length || 6;
    // Cambridge Life Competencies is a cross-curricular FRAMEWORK, not a coded
    // syllabus, so its objectives must never carry Stage+Strand+Number codes.
    const isLifeCompetencies = /life\s*competenc/i.test(options.subject || "");
    /* One lesson per taught day. Teachers tick the days a subject is on the
       timetable; without that the model writes one lesson for the whole week,
       which is what a three-lessons-a-week subject could not express. */
    const chosenDays = (options.days || []).filter(Boolean);
    const dayClause = chosenDays.length
      ? `
        - "lessons": Array of EXACTLY ${chosenDays.length} objects, one per taught day, in this order: ${chosenDays.join(", ")}. Each with:
          - "day": string (exactly one of: ${chosenDays.join(", ")})
          - "focus": string (what THIS lesson covers — a distinct slice of the week's topic)
          - "introduction": string (how this particular lesson starts)
          - "activities": string (what the class does in THIS lesson only — detailed, complete sentences, EACH STEP ON ITS OWN LINE separated by a newline; do NOT put a whole week of activities here)
          - "assessment": string (how this lesson is checked)
        The lessons must be DIFFERENT from one another and build across the week towards the week's learning objective. Do not repeat the same activity on each day. The week's own "introduction"/"activities"/"assessment" stay as a summary of the whole week.`
      : "";

    const mainPrompt = `As an expert Cambridge Educator, create a professional, detailed ${weekCount}-WEEK Lesson Plan for a ${options.yearGroup} class.
      ${options.fileContext ? `
      THE TEACHER HAS UPLOADED THEIR OWN DOCUMENT — IT OUTRANKS EVERYTHING ELSE IN THIS PROMPT:
      - It is either their own lesson plan or their scheme of work. Read it first and work out which.
      - IF IT IS A LESSON PLAN: reproduce it. Keep its weeks in its order, its unit and topic titles word for word, its learning objectives, its activities and its assessments. You are formatting and completing THEIR plan, not writing a better one. Do not renumber the weeks, do not resequence the topics, do not substitute your own activities for theirs, and do not "improve" wording that is already there.
      - IF IT IS A SCHEME OF WORK: derive the units, topics, strands, objectives, sequence and assessment guidance from it, matching its order and using its exact unit titles, objective codes and terminology.
      - EITHER WAY: only add content where the document is genuinely silent, and say nothing that contradicts it. If the document covers fewer weeks than requested, keep its weeks as they are and continue the same progression afterwards.
      - If the document and the fields below disagree, the document wins — except for the class, term and teacher names, which come from the fields.
      ` : ''}
      STANDARDS & FRAMEWORK:
      - Use the provided subject "${options.subject}" exactly as given. Do not substitute it with a similar subject (e.g. do not change Digital Literacy to Computer Science).
      - Base the content strictly on the Cambridge International Curriculum (CAIE/Cambridge Primary/Lower Secondary).
      ${isLifeCompetencies ? `
      - IMPORTANT: "Life Competencies" is the Cambridge Life Competencies FRAMEWORK, NOT a coded subject/syllabus. It has NO Stage+Strand+Number objective codes.
      - Do NOT output any code (no "3TC.01"-style codes, no "resources" codes) anywhere in this plan.
      - Write each "learningObjective" in plain language only. For "strand", use one of the six Cambridge Life Competencies areas: Creative Thinking, Critical Thinking, Learning to Learn and Metacognition, Communication, Collaboration, Social Responsibilities.
      ` : `
      - Align objectives with official Cambridge Framework Learning Objectives using the Stage+Strand+Number format (e.g., 3TC.01, 3Rf.04).
      - Reference relevant subject codes and strand initials from the following list: ${CAMBRIDGE_CURRICULUM_INFO}
      `}
      - Incorporate methodology consistent with Cambridge Schemes of Work (SoW).
      - Follow the official framework, scheme of work, and textbook/reference materials.

      ${weekCount}-WEEK TERM OVERVIEW:
      The teacher may have provided some specific units/topics. For any week left blank or marked 'Auto-assign', you MUST generate a logical, curriculum-appropriate progression based on the overall subject and description.
      
      Provided Inputs:
      ${Array.from({ length: weekCount }).map((_, i) => {
        const u = options.unit?.[i];
        const t = options.topics?.[i];
        return `Week ${i + 1}: ${u ? `[Unit: ${u}]` : '[Unit: Auto-assign]'} ${t ? `Topic: ${t}` : 'Topic: Auto-assign'}`;
      }).join('\n')}

      ADDITIONAL DESCRIPTION/GOALS:
      ${lessonInput}

      Format the response as a JSON object with:
      - "term": "${options.term || ''}"
      - "subject": string (MUST include Cambridge Code, e.g., "Science (0097)")
      - "duration": "${options.duration || ''}"
      - "date": "${options.date || ''}"
      - "academicYear": "${options.academicYear || ''}"
      - "class": "${options.class || ''}"
      - "preparedBy": "${options.preparedBy || ''}"
      - "checkedBy": "${options.checkedBy || ''}"
      - "overallTopic": A comprehensive title for the ${weekCount}-week term unit
      - "subTopic": string (a short sub-topic / focus for this unit, e.g. "All About Me")
      - "strandSummary": string (the main strand(s) this whole unit develops, comma-separated${isLifeCompetencies ? '; use the Cambridge Life Competencies areas' : ''})
      - "learningObjectiveSummary": array of 2-4 short strings (the overarching learning objectives for the whole unit, plain language${isLifeCompetencies ? ', NO codes' : ''})
      - "successCriteria": array of 2-4 short strings phrased as "I can..." statements (child-friendly)
      - "essentialQuestions": array of 4-6 short big-picture questions that frame the unit
      - "keyCompetencies": array of 6-10 short competency words/phrases developed across the unit (e.g. Self-awareness, Communication, Collaboration)
      - "portfolioEvidence": array of 6-12 short suggested pieces of student evidence for a portfolio
      - "weeklyBreakdown": Array of exactly ${weekCount} objects, each with:
        - "week": number (1-${weekCount})
        - "unit": string (The Cambridge curriculum unit number and title)
        - "topic": string (based on the weekly topics provided)
        - "subTopic": string (ONE narrower slice of that week's topic — teachable in a lesson or two)
        - "strand": string (the curriculum strand)
        - "learningObjective": string (one clear, numbered learning objective, e.g., "1. Identify the parts of a plant")
        - "introduction": string (detailed overview of what this topic is about)
        - "activities": string (specific activities that the teacher can do for this topic. Be very detailed and write complete sentences. Put EACH numbered step on its own line, separated by a newline, so it reads as a list rather than a paragraph.)
        - "assessment": string (what worksheet, quiz, exam or activity for this topic. Be very detailed and write complete sentences.)
        - "resources": string (teaching materials and references; include a Cambridge Learning Standard code ONLY if it is from an uploaded scheme of work or you are certain it is the exact official code — never fabricate one)${dayClause}
    `;
    contents.push(mainPrompt);

    const response = await generateContentWithRetry({
      contents: { parts: contents.map(c => typeof c === 'string' ? { text: c } : c) },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            term: { type: Type.STRING },
            subject: { type: Type.STRING },
            duration: { type: Type.STRING },
            date: { type: Type.STRING },
            academicYear: { type: Type.STRING },
            class: { type: Type.STRING },
            preparedBy: { type: Type.STRING },
            checkedBy: { type: Type.STRING },
            overallTopic: { type: Type.STRING },
            subTopic: { type: Type.STRING },
            strandSummary: { type: Type.STRING },
            learningObjectiveSummary: { type: Type.ARRAY, items: { type: Type.STRING } },
            successCriteria: { type: Type.ARRAY, items: { type: Type.STRING } },
            essentialQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyCompetencies: { type: Type.ARRAY, items: { type: Type.STRING } },
            portfolioEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
            weeklyBreakdown: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  week: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  subTopic: { type: Type.STRING },
                  strand: { type: Type.STRING },
                  learningObjective: { type: Type.STRING },
                  introduction: { type: Type.STRING },
                  activities: { type: Type.STRING },
                  assessment: { type: Type.STRING },
                  resources: { type: Type.STRING },
                  // One entry per taught day. Not required: a week without it
                  // is read as a single lesson, exactly like every plan
                  // written before this existed.
                  lessons: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        day: { type: Type.STRING },
                        focus: { type: Type.STRING },
                        introduction: { type: Type.STRING },
                        activities: { type: Type.STRING },
                        assessment: { type: Type.STRING }
                      },
                      required: ["day", "activities"]
                    }
                  }
                },
                required: ["week", "unit", "topic", "subTopic", "strand", "learningObjective", "introduction", "activities", "assessment", "resources"]
              }
            }
          },
          required: ["overallTopic", "weeklyBreakdown"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text);
  } catch (err: any) {
    if (typeof window !== 'undefined' && (err.message?.includes('API Key') || err.message?.includes('configured'))) {
      return callAiProxy('lessonPlan', lessonInput, options);
    }
    throw err;
  }
}

export async function suggestWeeklyInput(type: 'unit' | 'topic' | 'subtopic' | 'activity', options: EduOptions, weekNum: number): Promise<string> {
  const prompt = `As an expert Cambridge Educator, suggest a creative and curriculum-aligned ${type.toUpperCase()} for Week ${weekNum} of a ${options.yearGroup} ${options.subject} class.
    
    CONTEXT:
    - Subject: ${options.subject}
    - Grade: ${options.yearGroup}
    - Overall Lesson Topic: ${options.overallTopic || 'General ' + options.subject}
    ${options.weekContext ? `- The plan already says this for Week ${weekNum}: ${options.weekContext}. Your suggestion must sit alongside that, not repeat or contradict it.` : ''}
    ${options.sourceDocument ? `
    THE TEACHER'S OWN PLANNING DOCUMENT — TAKE THE SUGGESTION FROM THIS:
    <<<
    ${options.sourceDocument.slice(0, 6000)}
    >>>
    - Find what this document says about Week ${weekNum} and suggest the ${type} ITS plan calls for.
    - Use its wording, its units, its topics and its sequence. Do not send the week in a different direction.
    - Only if it genuinely says nothing about this week, fall back to Cambridge knowledge that continues its progression.
    ` : ''}
    
    CURRICULUM ALIGNMENT:
    - Use the provided subject "${options.subject}" exactly as given. Do not substitute it with a similar subject (e.g. do not change Digital Literacy to Computer Science).
    - Align with Cambridge International Framework (Primary, Lower Secondary, or IGCSE as appropriate for ${options.yearGroup}).
    - Use relevant subject codes and official strand-based LO codes (e.g., 3TC.01) from this information: ${CAMBRIDGE_CURRICULUM_INFO}
    
    TASK:
    Return ONLY a single concise ${type} suggestion. No explanation, no quotes.
    ${type === 'activity' ? 'Ensure the activity is hands-on or highly engaging for this age group.' : ''}
    ${type === 'subtopic' ? 'A subtopic is one focused slice of the week\'s topic — narrower than the topic itself, teachable in a lesson or two (e.g. topic "Electricity" → subtopic "Series and parallel circuits").' : ''}
  `;

  try {
    const response = await generateContentWithRetry({
      contents: { parts: [{ text: prompt }] },
      // A suggestion is a phrase, not an essay. The output cap counts towards
      // the per-minute allowance, so reserving the default 7,000 tokens for a
      // one-line answer was on its own enough to rule out every model but the
      // largest — and to fail once that one was busy. Asking for what it
      // actually needs puts the whole fallback chain back in play.
      config: { maxOutputTokens: 300 },
    });

    return response.text?.trim() || "";
  } catch (err: any) {
    if (typeof window !== 'undefined' && (err.message?.includes('API Key') || err.message?.includes('configured'))) {
      return callAiProxy('suggest', type, { ...options, weekNum });
    }
    throw err;
  }
}

/** Turn a lesson plan the teacher already wrote into a plan this app can hold.
 *
 *  Teachers arrive with terms of planning in Word, Excel or PDF, and retyping
 *  it into the board just to be able to submit it is work that produces
 *  nothing new. This reads the document and fills the same structure the
 *  board's own drafts use, so an imported plan is indistinguishable from one
 *  written here — it opens in the editor, and Submit goes through unchanged.
 *
 *  It TRANSCRIBES, it does not write. The teacher's wording, sequence and week
 *  numbering are what get filed under their name and reviewed by a Head of
 *  Department, so inventing content would put words they never wrote into
 *  their submission. Anything the document does not say is left empty for them
 *  to fill in. */
export async function importLessonPlan(
  documentText: string,
  options: { subject?: string; yearGroup?: string; teacherName?: string } = {},
): Promise<LessonPlan> {
  const text = (documentText || "").trim();
  if (!text) throw new Error("That file had no readable text in it.");

  // The browser holds no AI key, so the work happens server-side. Going
  // straight to the proxy rather than failing first and catching keeps the
  // one slow call to one round trip.
  if (typeof window !== "undefined") {
    return callAiProxy("importPlan", text, options);
  }

  const weekFields = {
    week: { type: Type.NUMBER },
    unit: { type: Type.STRING },
    topic: { type: Type.STRING },
    subTopic: { type: Type.STRING },
    learningObjective: { type: Type.STRING },
    strand: { type: Type.STRING },
    introduction: { type: Type.STRING },
    activities: { type: Type.STRING },
    assessment: { type: Type.STRING },
    resources: { type: Type.STRING },
    // A week timetabled more than once has a row per day, not one row per week.
    lessons: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING },
          period: { type: Type.STRING },
          focus: { type: Type.STRING },
          introduction: { type: Type.STRING },
          activities: { type: Type.STRING },
          assessment: { type: Type.STRING },
          resources: { type: Type.STRING },
        },
      },
    },
  };

  const prompt = `You are transcribing a teacher's EXISTING lesson plan into a structured form. This is a transcription task, not a writing task.

RULES — these matter more than completeness:
- Use the teacher's OWN words, headings and sequence. Copy them across.
- Do NOT invent units, topics, objectives, activities or assessments. If the document does not say something, return an empty string for that field.
- Keep the document's own week numbering. If it covers weeks 3 to 8, return weeks 3 to 8 — do not renumber them from 1.
- One entry in weeklyBreakdown per week the document covers, in the document's order.
- Where the document uses a table, each row is usually one week.
- Bullet lists stay as separate lines within the field (newline-separated).
- subject, class, term, duration, academicYear and preparedBy are usually in a
  HEADER line or a small box at the TOP of the document, not in the weekly
  rows. Read them from there. "Year 3", "Grade 3", "Y3" and "Stage 3" all mean
  the class is "Year 3".
- overallTopic is the unit or theme the whole plan covers, if it names one.
- Most plans carry a SUMMARY BLOCK between the header and the weekly table —
  rows labelled Strand, Topic, Subtopic, Learning Objective, Success criteria
  ("I can…"), Essential Questions, Key Competencies, Portfolio Evidence. These
  describe the WHOLE plan, so put them in strandSummary, overallTopic, subTopic,
  learningObjectiveSummary, successCriteria, essentialQuestions, keyCompetencies
  and portfolioEvidence — NOT in the weekly rows. Missing this block is the most
  common way an imported plan comes back half empty, so look for it.
- A Reflection or Evaluation section, usually at the very end, goes in reflection.
- A weekly row labelled "Curriculum Link", "Framework", "LO code" or "Standard"
  is that week's strand — put it in "strand", never in learningObjective.
- Where a week names the days it is taught (a "Day" column, or Monday/Tuesday
  rows inside one week), give that week a "lessons" entry per day, each with its
  own introduction, activities, assessment and resources. A week taught once
  needs no "lessons" — its own fields are enough.
${options.subject ? `- The teacher says this plan is for: ${options.subject}. Use it unless the document clearly names a different subject.` : ""}
${options.yearGroup ? `- The teacher says the class is: ${options.yearGroup}. Use it unless the document clearly names a different class.` : ""}

THE DOCUMENT:
<<<
${text.slice(0, 24000)}
>>>

Return the plan as JSON. Leave any field the document does not cover as "".`;

  const response = await generateContentWithRetry({
    contents: { parts: [{ text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          term: { type: Type.STRING },
          subject: { type: Type.STRING },
          duration: { type: Type.STRING },
          date: { type: Type.STRING },
          academicYear: { type: Type.STRING },
          class: { type: Type.STRING },
          preparedBy: { type: Type.STRING },
          overallTopic: { type: Type.STRING },
          subTopic: { type: Type.STRING },
          strandSummary: { type: Type.STRING },
          learningObjectiveSummary: { type: Type.STRING },
          successCriteria: { type: Type.STRING },
          essentialQuestions: { type: Type.STRING },
          keyCompetencies: { type: Type.STRING },
          portfolioEvidence: { type: Type.STRING },
          reflection: { type: Type.STRING },
          weeklyBreakdown: {
            type: Type.ARRAY,
            items: { type: Type.OBJECT, properties: weekFields },
          },
        },
      },
    },
  });

  const raw = response.text;
  if (!raw) throw new Error("Nothing came back from the import.");
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "The plan could not be read as a structured document. It may be a scan, or laid out in a way this cannot follow yet.",
    );
  }

  const str = (v: any): string => (typeof v === "string" ? v.trim() : "");
  const weeks = Array.isArray(parsed?.weeklyBreakdown) ? parsed.weeklyBreakdown : [];

  // A plan with no weeks would show as an empty card the teacher cannot tell
  // apart from a blank draft, so say so instead of filing it.
  if (!weeks.length) {
    throw new Error(
      "No weekly rows could be found in that document. Check it contains a plan table or week-by-week sections.",
    );
  }

  const mapped = weeks.map((w: any, i: number) => {
    const lessons = (Array.isArray(w?.lessons) ? w.lessons : [])
      .map((l: any) => ({
        day: str(l?.day),
        period: str(l?.period),
        focus: str(l?.focus),
        introduction: str(l?.introduction),
        activities: str(l?.activities),
        assessment: str(l?.assessment),
        resources: str(l?.resources),
      }))
      // A "lesson" with nothing in it prints as an empty day card, which is
      // worse than no day at all.
      .filter((l: any) => l.day || l.introduction || l.activities || l.assessment);
    return {
      week: Number(w?.week) > 0 ? Number(w.week) : i + 1,
      unit: str(w?.unit),
      topic: str(w?.topic),
      subTopic: str(w?.subTopic),
      learningObjective: str(w?.learningObjective),
      strand: str(w?.strand),
      introduction: str(w?.introduction),
      activities: str(w?.activities),
      assessment: str(w?.assessment),
      resources: str(w?.resources),
      ...(lessons.length ? { lessons } : {}),
    };
  });

  /* The plan document shows the summary block (Strand / Topic / Subtopic /
     Learning Objective) above the weeks, while the week cards show their own
     copy of the same three fields. A teacher's document usually fills only ONE
     of the two — the objective sits at the top OR in the week row — and
     whichever it is, the other view came back blank.

     So for a SINGLE-week plan the two are the same thing and are mirrored. This
     copies the teacher's own words between two views of one field; it never
     writes anything the document did not say. Multi-week plans are left alone:
     each week there has its own objective, and pasting the summary into all of
     them would put the wrong text under most weeks. */
  const one = mapped.length === 1 ? mapped[0] : null;
  const both = (summary: string, weekly: string) => summary || weekly;
  const strandSummary = one
    ? both(str(parsed.strandSummary), one.strand)
    : str(parsed.strandSummary);
  const learningObjectiveSummary = one
    ? both(str(parsed.learningObjectiveSummary), one.learningObjective)
    : str(parsed.learningObjectiveSummary);
  const subTopic = one ? both(str(parsed.subTopic), one.subTopic) : str(parsed.subTopic);
  const overallTopic = one
    ? both(str(parsed.overallTopic), one.topic)
    : str(parsed.overallTopic);
  if (one) {
    one.strand = one.strand || strandSummary;
    one.learningObjective = one.learningObjective || learningObjectiveSummary;
    one.subTopic = one.subTopic || subTopic;
    one.topic = one.topic || overallTopic;
  }

  return {
    term: str(parsed.term) || "1",
    subject: str(parsed.subject) || options.subject || "",
    duration: str(parsed.duration) || "60 mins",
    date: str(parsed.date) || new Date().toISOString().split("T")[0],
    academicYear:
      str(parsed.academicYear) ||
      `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
    class: str(parsed.class) || options.yearGroup || "",
    preparedBy: options.teacherName || str(parsed.preparedBy),
    checkedBy: "",
    overallTopic,
    subTopic,
    strandSummary,
    learningObjectiveSummary,
    successCriteria: str(parsed.successCriteria),
    essentialQuestions: str(parsed.essentialQuestions),
    keyCompetencies: str(parsed.keyCompetencies),
    portfolioEvidence: str(parsed.portfolioEvidence),
    reflection: str(parsed.reflection),
    weeklyBreakdown: mapped,
  } as LessonPlan;
}

export async function generateWeeklyPlan(activity: string, weekNum: number, options: EduOptions, unit?: string, topic?: string): Promise<WeeklyPlan> {
  try {
    const contents: any[] = [];
    const mainPrompt = `As an expert Cambridge Educator, create a professional weekly lesson plan for WEEK ${weekNum} of a ${options.yearGroup} class.
      
      STANDARDS & FRAMEWORK:
      - Use the provided subject "${options.subject}" exactly as given. Do not substitute it with a similar subject (e.g. do not change Digital Literacy to Computer Science).
      - Base the content strictly on the Cambridge International Curriculum.
      - Align objectives with official Cambridge Framework Learning Objectives using the Stage+Strand+Number format (e.g., 3TC.01, 3Rf.04).
      - Incorporate methodology consistent with Cambridge Schemes of Work (SoW).
      - Reference relevant subject codes and strand initials from the following list: ${CAMBRIDGE_CURRICULUM_INFO}
      - Follow the official framework, scheme of work, and textbook/reference materials.
      
      ${unit ? `TARGET UNIT: "${unit}"` : ''}
      ${topic ? `TARGET TOPIC: "${topic}"` : ''}
      ${activity.trim()
        ? `PRIMARY ACTIVITY PROVIDED BY TEACHER:\n      "${activity}"`
        : `The teacher has not described an activity — choose activities yourself that suit ${unit || topic ? 'this unit/topic' : `${options.subject} at ${options.yearGroup}`}.`}

      YOUR TASK:
      ${activity.trim()
        ? `Based on the teacher's input${unit || topic ? ` (especially the specific unit/topic provided)` : ''}, generate`
        : `${unit || topic ? 'Working from the unit/topic above, generate' : `Choose a sensible next topic for ${options.subject} at ${options.yearGroup} and generate`}`} a complete weekly plan entry.

      Format the response as a JSON object with:
      - "week": ${weekNum}
      - "unit": string (${unit ? `Return exactly or expand upon: ${unit}` : 'The Cambridge curriculum unit number and title'})
      - "topic": string (${topic ? `Return exactly or expand upon: ${topic}` : 'A concise title for the week\'s lesson'})
      - "subTopic": string (ONE narrower slice of the week's topic — teachable in a lesson or two)
      - "strand": string (the curriculum strand)
      - "learningObjective": string (one clear, numbered learning objective)
      - "introduction": string (detailed overview of what this topic is about)
      - "activities": string (${activity.trim() ? `incorporate the teacher's activity "${activity}" and expand on it` : 'suitable classroom activities for this week'})
      - "assessment": string (what worksheet, quiz, or exam activity for this topic)
      - "resources": string (Unit #, Learning Standard code, etc.)
    `;
    contents.push(mainPrompt);

    const response = await generateContentWithRetry({
      contents: { parts: contents.map(c => typeof c === 'string' ? { text: c } : c) },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            week: { type: Type.NUMBER },
            unit: { type: Type.STRING },
            topic: { type: Type.STRING },
            subTopic: { type: Type.STRING },
            strand: { type: Type.STRING },
            learningObjective: { type: Type.STRING },
            introduction: { type: Type.STRING },
            activities: { type: Type.STRING },
            assessment: { type: Type.STRING },
            resources: { type: Type.STRING }
          },
          required: ["week", "unit", "topic", "subTopic", "strand", "learningObjective", "introduction", "activities", "assessment", "resources"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text);
  } catch (err: any) {
    if (typeof window !== 'undefined' && (err.message?.includes('API Key') || err.message?.includes('configured'))) {
      return callAiProxy('weeklyPlan', activity, { ...options, weekNum, unit, topic });
    }
    throw err;
  }
}

/** The whole class-facing lesson for ONE week of a plan: talk prompts, a story,
 *  things to do, a matching game, something to draw, and a quiz to check it
 *  landed. Everything is drawn from what the teacher actually wrote in that
 *  week — its topic, objective, activities and assessment — so the class is
 *  taught and quizzed on that lesson and nothing else. */
export async function generateLessonActivities(
  week: WeeklyPlan,
  plan: Pick<LessonPlan, "subject" | "class" | "overallTopic">,
  options: EduOptions,
  half: "teaching" | "games" | "both" = "both",
): Promise<LessonActivityPack> {
  try {
    return await generateLessonActivitiesDirect(week, plan, options, half);
  } catch (err: any) {
    // In the browser there is no API key — Vite only injects GEMINI_API_KEY,
    // and the wrapper needs GROQ_API_KEY — so the call is made server side
    // instead, exactly as every other generator here does.
    if (
      typeof window !== "undefined" &&
      (err?.message?.includes("API Key") || err?.message?.includes("configured"))
    ) {
      return callAiProxy("lessonActivities", JSON.stringify(week), { ...options, plan, half });
    }
    throw err;
  }
}

/** The teaching slides only — what the lesson cannot start without. Roughly
 *  half the wait, so the class can be looking at slide one while the games
 *  are still being written. */
export const generateLessonTeaching = (
  week: WeeklyPlan,
  plan: Pick<LessonPlan, "subject" | "class" | "overallTopic">,
  options: EduOptions,
) => generateLessonActivities(week, plan, options, "teaching");

/** The story, games, quiz and review — everything that comes after the
 *  teaching, fetched while the teacher is still on the early slides. */
export const generateLessonGames = (
  week: WeeklyPlan,
  plan: Pick<LessonPlan, "subject" | "class" | "overallTopic">,
  options: EduOptions,
) => generateLessonActivities(week, plan, options, "games");

async function generateLessonActivitiesDirect(
  week: WeeklyPlan,
  plan: Pick<LessonPlan, "subject" | "class" | "overallTopic">,
  options: EduOptions,
  /** Generate only part of the lesson, so the deck can open on the first half
   *  while the second is still being written. */
  half: "teaching" | "games" | "both" = "both",
): Promise<LessonActivityPack> {
  // What is this lesson ABOUT? Not the school subject — "Life Competencies"
  // is a timetable label, and a lesson generated about it teaches nothing.
  // The thing being taught is the week's topic, and the plan hides it in
  // whichever field the teacher happened to fill in.
  const placeholder = /^(introduction|intro|topic|untitled|tbd|n\/?a|auto[- ]?assign(ed)?|week\s*\d+|lesson\s*\d+|-+)$/i;
  // "Unit 1 – Introduction" names a position in the scheme, not a topic;
  // strip the numbering and see whether anything real is left.
  const unitTopic = (week.unit || "")
    .replace(/^\s*(unit|chapter|module|topic)\s*\d+\s*[-–—:.]?\s*/i, "")
    .trim();
  const pick = (...xs: (string | undefined)[]) =>
    xs.map((x) => x?.trim()).find((x) => x && !placeholder.test(x)) || "";
  const focus =
    pick(
      // Most specific first: a subtopic beats a topic beats a unit heading.
      week.subTopic,
      week.topic,
      plan.overallTopic,
      unitTopic,
      week.learningObjective,
    ) ||
    // Deliberately NOT plan.subject. If the plan says nothing about what is
    // being taught, the objective is still closer to a lesson than the name
    // of the subject is.
    week.learningObjective?.trim() ||
    plan.overallTopic ||
    plan.subject;
  const source = [
    week.unit && `UNIT: ${week.unit}`,
    `TOPIC: ${focus}`,
    week.learningObjective && `LEARNING OBJECTIVE: ${week.learningObjective}`,
    week.introduction && `INTRODUCTION / DO NOW: ${week.introduction}`,
    week.activities && `ACTIVITIES: ${week.activities}`,
    week.assessment && `ASSESSMENT: ${week.assessment}`,
  ].filter(Boolean).join("\n");

  const yearGroup = plan.class || options.yearGroup;
  const optionCount = quizOptionCount(yearGroup);
  const young = (yearNumberOf(yearGroup) ?? 99) <= 2;

  // The lesson is generated in two halves. One request for all of it exceeds
  // the model's output ceiling and comes back as truncated, invalid JSON —
  // so the teaching content and the activities are asked for separately and
  // merged. They also run in parallel, so it is no slower.
  const preamble = `You are preparing the on-screen part of a lesson that will be projected to a ${yearGroup} class.

★★★ THIS LESSON IS ABOUT: ${focus} ★★★

Every slide, sentence, picture, question and game must be about ${focus} and nothing else.

The class's timetable subject is "${plan.subject}". That is only the name of the lesson slot — it is NOT what you are teaching. Do not write about ${plan.subject} as a subject, do not define it, do not name it on a slide, and do not produce content that would suit any other week of ${plan.subject}. A child leaving this lesson should be able to say what they learned about ${focus}.

THE TEACHER'S OWN PLAN FOR THIS WEEK:
"""
${source}
"""

${ageGuidance(yearGroup)}

You are building a real classroom lesson that will be taught from the board for the whole period — not a summary of the plan and not a set of bullet-point slides. The class should SEE, THINK, TALK, MOVE, ACT, DRAW and REFLECT.

Produce JSON only. Everything must be strictly about that topic — never general knowledge, never anything the plan does not cover — and must obey the age rules above.

BE SPECIFIC TO THIS LESSON — this is what most often goes wrong:
- Every question must name something concrete from the plan above: the actual thing being studied, an object, an action the children will do, a word from the objective.
- A question that would still make sense in a completely different lesson is WRONG. "What do you know about this topic?", "What would you like to find out?", "Tell your partner one thing you noticed" are all FAILURES — they say nothing about ${focus}.
- Never use the words "Introduction", "topic", "this lesson" or "the activity" as if they were the thing being studied. Name the thing itself.
- Write as if the children have just been taught this specific content and you are checking that exact learning.

- Write as if the children have just been taught this specific content.
`;

  const activityPrompt = `${preamble}

1. "discussion": 3 things one child SAYS TO THEIR PARTNER, turning to the person sitting next to them.
   - These are spoken to a real person, in the second person, and are about that person: "How are you feeling today?", "Are you okay?", "What made you smile today?"
   - They are NOT questions about the topic in the abstract. "What do you know about feelings?" or "What would you like to find out?" are FAILURES — those talk ABOUT the lesson instead of using it to talk TO each other.
   - Use what has just been taught as the reason to ask. The partner answers, and the asker listens and can answer back.
   - Where the topic is not about people, still address the partner directly and make it about them and their work: "Show me your triangle — how many corners can you count?", "Which one did you choose, and why that one?"
   - NEVER put a child's name in them ("Are you okay, Emma?" is WRONG). The same words are on the board for every pair in the room, and each child's partner is someone different.
   - ${young ? "Each one 8 words or fewer, and easy to say out loud." : "Each one short enough to say in one breath."} A ${yearGroup} child must be able to read them off the board and say them to a friend.

2. "questions": 3 mini-quiz questions checking whether the class understood THIS lesson.
   - Each has "text", "options" (exactly ${optionCount} short choices), "correctIndex" (0-${optionCount - 1}, the index of the correct choice — vary its position across the three questions), and "why" (one short sentence explaining the answer, for the teacher to read out).
   - Exactly one option is correct; the others must be clearly wrong to someone who understood the lesson, but plausible to someone who did not.
   - Never put the answer in the question text. ${
     young
       ? "Each question 8 words or fewer; each option 3 words or fewer."
       : "Keep every option under 10 words."
   }
   - Order the three from easiest to hardest.

3. "story": a very short story that carries the idea, told in 4 scenes. Give it a "title", 4 "scenes", and 3 "questions" (each a "q" the teacher asks and a short "a" revealed after the class answers).
   - Each scene's "label" MUST be a complete sentence the teacher reads aloud, about 8-12 words. A title or caption like "Sunny Day" or "Happy Emily" is WRONG — write "Emily walks to school and smiles at her friend."
   - The four scenes must run in order and tell one continuous story: something happens, it causes a difficulty, someone helps, and it ENDS WELL. Never finish on the sad or unresolved scene.
   - Name a child and let what happens to them show ${focus} in action. Keep it warm and safe — nothing frightening.

4. "matching": a tap-the-pair game. "title", a one-line "instruction", and 4-5 "pairs" of emoji + label drawn from this lesson's content.

5. "actOut": something the children perform. "title", 3 short "steps", and 4-5 "items" (emoji + label) for the spinner to land on. If performing makes no sense for this topic, make it a "show me with your hands / your body" task instead.

6. "draw": "title", one "instruction" sentence telling them what to draw, and 3-4 "examples" — single emoji only — to show round the edge.

7. "strategies": 3-4 things the children can DO with what they have learned — "title" plus "items" of emoji + label. For a feelings lesson these are calming strategies; for a science lesson they are steps to try; for a language lesson they are ways to practise.

8. "review": 3 short closing questions for the whole class, each answerable out loud in a few words.

EMOJI RULES: exactly one emoji per tile, and it must genuinely depict the label — a child pointing at the picture must be able to say the label. 👍 for "Surprised" is WRONG (use 😲); 🌿 for "Deep breaths" is WRONG (use 🫁). Never use a letter, digit, or punctuation as an emoji. If no emoji truly fits a label, choose a different label.

LABEL RULES: a label names the thing itself — "Happy", not "Happy Face". Do not append "face", "picture" or "icon" to every label.

If a section genuinely cannot be made to fit this topic, omit that whole section rather than padding it with something generic.`;

  const teachPrompt = `${preamble}

You are writing the TEACHING slides — the part the teacher actually teaches from, standing at the board. Not activities, not questions: the content itself.

1. "keyIdeas": 3-5 picture tiles naming the things this lesson teaches — the emotions, the shapes, the materials, whatever ${focus} is made of. Each is one emoji plus a label of 1-3 words.

2. "bigIdea": the whole idea said once, plainly, before any detail — a "title" (e.g. "What Are Feelings?") and one "explain" sentence a child would understand (e.g. "Feelings are how we feel inside.").

3. "teach": THE MOST IMPORTANT SECTION. One entry for EACH thing in keyIdeas — so 3-5 entries, in the same order. Each entry has:
   - "emoji": the big picture for that concept.
   - "title": what the slide is called, in the child's own voice where it suits — "I Feel Happy!", "This Is A Triangle", "Water Turns To Ice".
   - "lines": 1-3 short sentences that TEACH the point with a concrete example from a child's life — "I may feel happy when I play with my friends." Not a definition of the word; a real example a 6-year-old recognises.
   - "tiles": 0-4 supporting pictures where they help — what to DO about it, or more examples. For a difficult feeling these are the coping strategies; for a shape they are things of that shape.
   - "ask": one question that turns the slide over to the class — "What makes YOU happy?"
   Do not skip this section and do not merge the concepts into one slide. A lesson with five concepts needs five teaching slides.

4. "sequence": ONLY if this topic has a natural order or change — feelings changing, a life cycle, steps of a method. Give a "title", 3-4 ordered "steps" (emoji + short label) and one "line" explaining it. Omit entirely if the topic has no sequence.

5. "celebrate": the slide the lesson ends on — a "title" like "Great job! 🌟" and one "line" telling the children what they can now do, naming the actual learning.

EMOJI RULES: exactly one emoji per tile, and it must genuinely depict the label. 👍 for "Surprised" is WRONG (use 😲); 🌿 for "Deep breaths" is WRONG (use 🫁). Never use a letter, digit, or punctuation as an emoji.

LABEL RULES: a label names the thing itself — "Happy", not "Happy Face". Do not append "face", "picture" or "icon" to every label.`;

  const tileSchema = {
    type: Type.OBJECT,
    properties: { emoji: { type: Type.STRING }, label: { type: Type.STRING } },
    required: ["emoji", "label"],
  };

  const teachSchema = {
    type: Type.OBJECT,
    properties: {
      keyIdeas: { type: Type.ARRAY, items: tileSchema },
      bigIdea: {
        type: Type.OBJECT,
        properties: { title: { type: Type.STRING }, explain: { type: Type.STRING } },
        required: ["title", "explain"],
      },
      teach: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            emoji: { type: Type.STRING },
            title: { type: Type.STRING },
            lines: { type: Type.ARRAY, items: { type: Type.STRING } },
            tiles: { type: Type.ARRAY, items: tileSchema },
            ask: { type: Type.STRING },
          },
          required: ["emoji", "title", "lines"],
        },
      },
      sequence: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          steps: { type: Type.ARRAY, items: tileSchema },
          line: { type: Type.STRING },
        },
        required: ["title", "steps"],
      },
      celebrate: {
        type: Type.OBJECT,
        properties: { title: { type: Type.STRING }, line: { type: Type.STRING } },
        required: ["title", "line"],
      },
    },
    required: ["keyIdeas", "teach"],
  };

  const activitySchema = {
        type: Type.OBJECT,
        properties: {
          discussion: { type: Type.ARRAY, items: { type: Type.STRING } },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.NUMBER },
                why: { type: Type.STRING },
              },
              required: ["text", "options", "correctIndex"],
            },
          },
          story: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              scenes: { type: Type.ARRAY, items: tileSchema },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { q: { type: Type.STRING }, a: { type: Type.STRING } },
                  required: ["q", "a"],
                },
              },
            },
            required: ["title", "scenes", "questions"],
          },
          matching: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              instruction: { type: Type.STRING },
              pairs: { type: Type.ARRAY, items: tileSchema },
            },
            required: ["title", "pairs"],
          },
          actOut: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              steps: { type: Type.ARRAY, items: { type: Type.STRING } },
              items: { type: Type.ARRAY, items: tileSchema },
            },
            required: ["title", "items"],
          },
          draw: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              instruction: { type: Type.STRING },
              examples: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["title", "instruction"],
          },
          strategies: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              items: { type: Type.ARRAY, items: tileSchema },
            },
            required: ["title", "items"],
          },
          review: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["discussion", "questions"],
  };

  const ask = async (text: string, schema: any) => {
    const r = await generateContentWithRetry({
      contents: { parts: [{ text }] },
      config: { responseMimeType: "application/json", responseSchema: schema },
    });
    if (!r.text) throw new Error("Empty response");
    return JSON.parse(r.text);
  };

  // Deliberately sequential. Run in parallel these two blow through Groq's
  // per-minute token budget, the call falls back to the 8B model, and that
  // 429s as well ("Limit 6000, Used 4501, Requested 4383") — which shows up
  // as a lesson with teaching slides but no story, games or quiz. Teaching
  // content goes first because it is the half the lesson cannot do without.
  const teachPart = half === "games" ? {} : await ask(teachPrompt, teachSchema);
  const activityPart =
    half === "teaching"
      ? { discussion: [], questions: [] }
      : await ask(activityPrompt, activitySchema).catch((e) => {
          console.error("Lesson activities half failed:", e);
          return { discussion: [], questions: [] };
        });
  const parsed = { ...activityPart, ...teachPart } as Omit<LessonActivityPack, "week">;

  // Everything below is defensive. A malformed section is dropped rather than
  // projected: a quiz that cannot be marked, or a tile with a letter where the
  // picture should be, is worse in front of a class than one slide fewer.
  const okTile = (t: any) =>
    t && typeof t.emoji === "string" && typeof t.label === "string" && t.label.trim() &&
    // One picture, not a letter or a word. Emoji are outside the BMP or in the
    // symbol blocks; anything ASCII is a mistake.
    t.emoji.trim().length > 0 && !/^[\w\d.,!?'"()-]+$/.test(t.emoji.trim());
  const tiles = (xs: any): LessonActivityPack["keyIdeas"] =>
    Array.isArray(xs) ? xs.filter(okTile).map((t: any) => ({ emoji: t.emoji.trim(), label: t.label.trim() })) : [];
  const strings = (xs: any) =>
    Array.isArray(xs) ? xs.filter((s: any) => typeof s === "string" && s.trim()).map((s: string) => s.trim()) : [];

  const questions = (parsed.questions || []).filter(
    (q) =>
      q &&
      typeof q.text === "string" &&
      Array.isArray(q.options) &&
      q.options.length >= 2 &&
      Number.isInteger(q.correctIndex) &&
      q.correctIndex >= 0 &&
      q.correctIndex < q.options.length,
  );

  const story = parsed.story && tiles(parsed.story.scenes).length >= 2
    ? {
        title: parsed.story.title || "Story time",
        scenes: tiles(parsed.story.scenes)!,
        questions: (parsed.story.questions || []).filter(
          (x: any) => x && typeof x.q === "string" && typeof x.a === "string" && x.q.trim(),
        ),
      }
    : undefined;

  const matchPairs = tiles(parsed.matching?.pairs) || [];
  const actItems = tiles(parsed.actOut?.items) || [];
  const strategyItems = tiles(parsed.strategies?.items) || [];

  return {
    week: week.week,
    discussion: strings(parsed.discussion),
    questions,
    keyIdeas: tiles(parsed.keyIdeas),
    bigIdea: parsed.bigIdea?.explain?.trim()
      ? { title: parsed.bigIdea.title?.trim() || `What is ${focus}?`, explain: parsed.bigIdea.explain.trim() }
      : undefined,
    // The teaching slides. A point with no sentences teaches nothing, so it
    // is dropped rather than projected as a bare heading.
    teach: (parsed.teach || [])
      .filter((p: any) => p && p.title?.trim() && strings(p.lines).length > 0)
      .map((p: any) => ({
        emoji: okTile({ emoji: p.emoji, label: p.title }) ? p.emoji.trim() : "•",
        title: p.title.trim(),
        lines: strings(p.lines).slice(0, 3),
        tiles: tiles(p.tiles)?.slice(0, 4),
        ask: typeof p.ask === "string" && p.ask.trim() ? p.ask.trim() : undefined,
      })),
    sequence: tiles(parsed.sequence?.steps)!.length >= 2
      ? {
          title: parsed.sequence!.title || "How it changes",
          steps: tiles(parsed.sequence!.steps)!.slice(0, 4),
          line: parsed.sequence!.line?.trim(),
        }
      : undefined,
    celebrate: parsed.celebrate?.line?.trim()
      ? { title: parsed.celebrate.title?.trim() || "Great job! 🌟", line: parsed.celebrate.line.trim() }
      : undefined,
    story,
    // A matching game needs at least two pairs to be a game at all.
    matching: matchPairs.length >= 2
      ? { title: parsed.matching!.title || "Match it", instruction: parsed.matching!.instruction || "Tap a word, then tap its picture.", pairs: matchPairs }
      : undefined,
    actOut: actItems.length >= 2
      ? { title: parsed.actOut!.title || "Act it out", steps: strings(parsed.actOut!.steps), items: actItems }
      : undefined,
    draw: parsed.draw?.instruction
      ? { title: parsed.draw.title || "Draw it", instruction: parsed.draw.instruction, examples: strings(parsed.draw.examples).slice(0, 4) }
      : undefined,
    strategies: strategyItems.length >= 2
      ? { title: parsed.strategies!.title || "What can I do?", items: strategyItems }
      : undefined,
    review: strings(parsed.review).slice(0, 3),
  };
}

export async function generateEduContent(lessonInput: string, options: EduOptions): Promise<EduContent | null> {
  try {
    // Parallel generation for maximum speed
    const [slidesRes, worksheet, readingProgram] = await Promise.all([
      generateSlides(lessonInput, options),
      generateWorksheet(lessonInput, options),
      generateReadingProgram(lessonInput, options)
    ]);

    return {
      // Use the AI-generated worksheet title as the display title so the raw
      // user prompt never surfaces in the assessment / slides / exports.
      lessonTitle: worksheet?.title || lessonInput,
      subject: options.subject,
      gradeLevel: options.yearGroup,
      slides: slidesRes.slides,
      slidesMetadata: slidesRes.metadata,
      worksheet,
      readingProgram,
      metadata: { yearGroup: options.yearGroup, lexileLevel: options.lexileLevel, subject: options.subject }
    };
  } catch (error: any) {
    console.error("Error in generateEduContent:", error);
    if (typeof window !== 'undefined' && (error.message?.includes('API Key') || error.message?.includes('configured'))) {
      return callAiProxy('all', lessonInput, options);
    }
    return null;
  }
}

export async function generateEduNotes(lessonInput: string, options: EduOptions): Promise<{ notes: string }> {
  try {
    const contents: any[] = [];
    if (options.fileContext) {
      contents.push({ inlineData: options.fileContext });
    }

    const mainPrompt = `As an expert Cambridge Educator, generate a professional, comprehensive, and well-structured Student Revision Handout for the EXACT topic: "${lessonInput}".
      Subject: ${options.subject}, Year Group: ${options.yearGroup}.

      STRICT TOPICAL BOUNDARY (CRITICAL):
      - ONLY generate information related to "${lessonInput}". 
      - DO NOT include unrelated grammar, punctuation, or different subject matter. If the topic is "Prepositions", do not mention commas, full stops, or verbs unless they are directly part of a prepositional phrase example.
      - If you include unrelated information, the handout will be rejected.

      CONTENT DEPTH & ELABORATION:
      - Requested Focus: "${options.metadataHints?.description || "Comprehensive overview"}". 
      - MISSION: Provide an exhaustive, detailed academic explanation.
      - ELABORATE: For every concept, explain the "What", the "Why", and provide 3-5 distinct examples.
      - ADAPTATION: Align strictly with the academic rigor of Cambridge International Framework Stage ${options.yearGroup || ''}.

      FORMATTING FOR WORD DOCUMENT:
      - Use standard Markdown headings (# Title, ## Section, ### Sub-section).
      - Use **bold** for key terms.
      - Use bullet points for lists.
      - DO NOT use decorative symbols like ~ or =; use only clean markdown.

      STRUCTURE:
      1. Formal Title: ${lessonInput}
      2. Comprehensive Learning Objectives
      3. Detailed Conceptual Breakdown (This must be the most substantial part)
      4. Vocabulary Table (Term | Detailed Definition | Example Sentence)
      5. Practical Applications / Examples
      6. Student Revision Checklist
    ` + mandarinDualLanguage(options.subject, options.language, "notes");

    contents.push(mainPrompt);
    contents.push(`Format: JSON object with "notes" (a long string containing the markdown formatted notes).`);

    const response = await generateContentWithRetry({
      contents: { parts: contents.map(c => typeof c === 'string' ? { text: c } : c) },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            notes: { type: Type.STRING }
          },
          required: ["notes"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text);
  } catch (err: any) {
    if (typeof window !== 'undefined' && (err.message?.includes('API Key') || err.message?.includes('configured'))) {
      return callAiProxy('notes', lessonInput, options);
    }
    throw err;
  }
}

// Streaming version of generateEduNotes — emits markdown progressively so the
// handout appears as it is written (far faster perceived speed). Outputs plain
// Markdown (no JSON wrapper), which is also genuinely quicker to generate.
export async function generateEduNotesStream(
  lessonInput: string,
  options: EduOptions,
  onChunk: (fullText: string) => void,
): Promise<{ notes: string }> {
  const parts: any[] = [];
  if (options.fileContext) {
    parts.push({ inlineData: options.fileContext });
  }

  const mainPrompt = `As an expert Cambridge Educator, generate a professional, comprehensive, and well-structured Student Revision Handout for the EXACT topic: "${lessonInput}".
      Subject: ${options.subject}, Year Group: ${options.yearGroup}.

      STRICT TOPICAL BOUNDARY (CRITICAL):
      - ONLY generate information related to "${lessonInput}".
      - DO NOT include unrelated grammar, punctuation, or different subject matter.

      CONTENT DEPTH & ELABORATION:
      - Requested Focus: "${options.metadataHints?.description || "Comprehensive overview"}".
      - Provide a detailed academic explanation: for key concepts explain the "What", the "Why", and give 2-3 clear examples.
      - Align with the academic rigor of Cambridge International Framework Stage ${options.yearGroup || ''}.

      FORMATTING:
      - Use standard Markdown headings (# Title, ## Section, ### Sub-section), **bold** for key terms, and bullet points for lists.
      - Do NOT use decorative symbols like ~ or =.

      STRUCTURE:
      1. Formal Title: ${lessonInput}
      2. Comprehensive Learning Objectives
      3. Detailed Conceptual Breakdown (the most substantial part)
      4. Vocabulary Table (Term | Detailed Definition | Example Sentence)
      5. Practical Applications / Examples
      6. Student Revision Checklist

      OUTPUT: Return ONLY the clean Markdown handout — no JSON, no code fences, no preamble or closing remarks.` +
    mandarinDualLanguage(options.subject, options.language, "notes");

  parts.push({ text: mainPrompt });

  try {
    // Run on Groq (fast) instead of client-side Gemini streaming. We lose the
    // token-by-token reveal but gain speed; in the browser there's no Groq key
    // so this throws "not configured" and the catch routes to the /notes proxy
    // (server-side Groq) — fast on Vercel too.
    const response = await generateContentWithRetry({ contents: { parts } });
    const full = response.text || "";
    if (!full) throw new Error("Empty response");
    onChunk(full);
    return { notes: full };
  } catch (err: any) {
    // No client key / streaming unavailable → fall back to the non-streaming proxy.
    if (typeof window !== 'undefined' && (err.message?.includes('API Key') || err.message?.includes('configured'))) {
      const res = await callAiProxy('notes', lessonInput, options);
      if (res?.notes) onChunk(res.notes);
      return res;
    }
    throw err;
  }
}

export async function relevelReadingPassage(
  passage: string,
  targetLexile: string,
  subject: string,
  yearGroup: string,
  targetWordCount?: string
): Promise<{
  readingPassage: string;
  vocabulary: { word: string; definition: string; contextSentence: string }[];
  questions: { question: string; answer: string }[];
}> {
  try {
    let mainPrompt = `You are an expert Cambridge Educator and literacy developer.
    We have an existing reading passage on a specific topic.
    We need you to perform a dual task:
    1. Rewrite this EXACT SAME reading passage so that it aligns strictly with a different target Lexile level: ${targetLexile} and target audience. Keep sentence complexity and syntax in perfect alignment with the target Lexile.
    2. Extract and define 3-5 key vocabulary words directly from your newly written passage that are appropriate learning targets for a student at the ${targetLexile} Lexile level.
    3. Formulate 3-5 level-appropriate comprehension questions based strictly on the details of your adapted passage.

    Original Reading Passage:
    """
    ${passage}
    """

    Target Requirements:
    - Subject: ${subject}
    - Target Year Group/Grade: ${yearGroup}
    - New Target Lexile Level: ${targetLexile}`;

    if (targetWordCount) {
      mainPrompt += `\n    - Targeted Word Count: Around ${targetWordCount} words`;
    }

    mainPrompt += `

    Instructions:
    1. Retain the core content, characters, concepts, facts, and structure of the original passage.
    2. Adjust sentence complexity, word choice, vocabulary density, and syntax to perfectly match the target Lexile level: ${targetLexile}.
    3. Ensure the result is of high-quality educational value.
    4. Provide 3-5 vocabulary words selecting from the adapted passage, giving a definition and context sentence for each word.
    5. Provide 3-5 level-appropriate comprehension questions with concise answers based on the adapted passage.
    6. HTML formatting can be used for paragraphs if the source passage had HTML structure, but standard text or HTML formatting is expected.
    `;

    mainPrompt += `

    OUTPUT FORMAT — return ONLY a single valid JSON object in EXACTLY this shape (no markdown, no commentary):
    {"readingPassage":"<the full rewritten passage as one string>","vocabulary":[{"word":"","definition":"","contextSentence":""}],"questions":[{"question":"","answer":""}]}
    Put the ENTIRE rewritten passage in "readingPassage". Include 3-5 vocabulary items and 3-5 questions.`;

    // Use the resilient shared path (retry + model fallback) instead of a single
    // direct gemini-3.5-flash call, which had NO fallback and failed whenever
    // that model was overloaded (503) — breaking every level adaptation.
    const response = await generateContentWithRetry({
      contents: { parts: [{ text: mainPrompt }] },
      config: { responseMimeType: "application/json" },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Salvage the passage if the model wrapped or slightly malformed the JSON.
      const m = text.match(/"readingPassage"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      parsed = m
        ? { readingPassage: m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') }
        : { readingPassage: text };
    }
    const out = {
      readingPassage: String(parsed.readingPassage || "").trim(),
      vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    };
    if (!out.readingPassage) throw new Error("Empty reading passage");
    return out;
  } catch (err: any) {
    if (typeof window !== 'undefined' && (err.message?.includes('API Key') || err.message?.includes('configured'))) {
      return callAiProxy('relevelPassage', passage, { targetLexile, subject, yearGroup });
    }
    throw err;
  }
}

// Retries a generateContent call on transient errors (503 model overloaded,
// 429 rate limit) with backoff, then falls back to the next model in the list.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Run async tasks with a concurrency cap. Firing every chunk at once makes Groq
// rate-limit (429) and then we burn time on backoff — capping parallelism keeps
// throughput high and wall-time low. Results preserve input order.
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

// ===== Groq (OpenAI-compatible) text generation =====
// The app's text generation now runs on Groq instead of Google Gemini.
// We translate the existing Gemini-style request ({contents:{parts}, config})
// into a Groq chat completion and return an object exposing `.text`, so every
// existing caller keeps working unchanged. The key stays SERVER-SIDE (it is not
// injected into the browser bundle); the browser falls back to the /api/ai
// proxy which holds the key.
const GROQ_API_KEY = fromEnv("GROQ_API_KEY");
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/* The models this account can actually reach, biggest first so the fallback is
   a smaller model rather than a different family. Groq retired the Llama chat
   models — llama-3.3-70b-versatile and llama-3.1-8b-instant both 404 now, which
   surfaced to teachers as "AI Error: Groq 404" the moment the second one went
   too. Re-check the list with:
     curl -s https://api.groq.com/openai/v1/models \
       -H "Authorization: Bearer $GROQ_API_KEY"
   qwen3.6-27b is deliberately not here: it writes its <think> reasoning into
   the message content, which would end up inside teachers' lesson plans.

   ORDER MATTERS, and it is about allowances rather than quality. On this tier
   the gpt-oss models allow 8,000 tokens per minute, and a real lesson-plan
   prompt runs to roughly 9,000-10,000 — so they answer "413 Request too large"
   for most of the work this app actually does. compound-mini allows 70,000 and
   has taken a 10,092-token prompt in testing, so it leads; the gpt-oss models
   sit behind it for when it is busy. Full groq/compound is NOT here: it shares
   the 70,000 allowance but refused that same prompt outright. */
const GROQ_MODELS = [
  "groq/compound-mini",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
];

/** Errors meaning THIS model cannot serve THIS request: retrying it is
 *  pointless, but the next model in the list may take it. A 404 is a retired
 *  model. A 413 is the request overflowing the model's per-minute allowance on
 *  the current tier — which is precisely what a model with a bigger allowance
 *  can still handle, and which used to be thrown straight at the teacher
 *  instead of falling through. */
const modelCannotServe = (msg: string): boolean => {
  const lower = msg.toLowerCase();
  return (
    msg.includes("404") ||
    lower.includes("not found") ||
    lower.includes("decommission") ||
    lower.includes("does not exist") ||
    msg.includes("413") ||
    lower.includes("too large") ||
    lower.includes("request_too_large") ||
    lower.includes("tokens per minute")
  );
};

/** British English, everywhere.
 *
 *  This is a Cambridge International school: lesson plans, slides, worksheets
 *  and marking all have to read as UK English, and a stray "color" or
 *  "memorize" in front of a class undermines the spelling being taught. The
 *  models default to US English, so the rule is applied at the single point
 *  every text generation passes through rather than repeated in each prompt,
 *  where one missed prompt would leak American spelling into a document. */
const UK_ENGLISH = `WRITE IN BRITISH ENGLISH (UK). This is not optional — the work is for a Cambridge International school and every word is read by children learning to spell.
- -ise / -isation, never -ize / -ization: organise, recognise, realise, apologise, summarise, categorise, memorise, organisation, visualise. (Exceptions that are correct in UK English: capsize, seize, size.)
- -our, not -or: colour, behaviour, favourite, neighbour, humour, labour, flavour.
- -re, not -er: centre, metre, litre, theatre, fibre.
- -lled / -lling / -ller: travelled, labelled, modelling, cancelled, marvellous, skilful (one l), fulfil (one l).
- -ce for the noun, -se for the verb: practice (noun) / practise (verb); licence (noun) / license (verb). "The children practise their handwriting."
- -ogue: catalogue, dialogue, analogue. And: grey not gray, tyre not tire, kerb not curb, plough, draught, cheque, aeroplane, jewellery, aluminium, programme (except a computer program), storey (of a building), maths not math, learnt/spelt/burnt are fine.
- Vocabulary: Year 1 (not first grade), timetable (not schedule), holiday (not vacation), rubber (not eraser), marker pen, whiteboard, break time, tick (not check mark), full stop (not period), rubbish (not trash), pupils or children (not kids).
- Punctuation: single quotes for speech where quoting, and place punctuation outside the closing quote unless it belongs to the quoted words. Use dd/mm/yyyy dates and metric units.
- Grammar: collective nouns may take a plural verb ("the class are working"). Use "have got" naturally. Do not use American date order or American idiom.`;
// Max time to wait for a single Groq call before aborting it as a timeout.
// Groq is fast (a full worksheet batch returns in a few seconds); anything past
// this is a stalled connection, so abort and let the retry logic take over.
const GROQ_CALL_TIMEOUT_MS = 60000;

/** Which language rule goes in the system prompt.
 *
 *  British English is the house style for a Cambridge school, but it is the
 *  wrong instruction for a Mandarin or Malay paper — telling the model to write
 *  "colour, not color" while it writes Chinese is at best noise and at worst
 *  pulls the output back towards English. So a chosen language replaces the
 *  English rule rather than sitting beside it. */
function languageRule(language?: string): string {
  const l = (language || "").trim();
  if (!l || /^english/i.test(l)) return UK_ENGLISH;
  return `WRITE ENTIRELY IN ${l.toUpperCase()}. This is not optional — the work is for a class taught in ${l}, and every word a pupil reads must be in that language.
- EVERY part of the output: titles, headings, section names, instructions, questions, answer options, reading passages, explanations and any worked examples.
- Do NOT mix in English. The only exceptions are proper nouns with no accepted translation, and technical notation such as numerals or formulae.
- Use the natural register a teacher of ${l} would use for this year group — not translated-sounding English.
- If the topic was given to you in English, translate it and answer in ${l} regardless.`;
}

// Groq ignores Gemini's responseSchema, so we derive a compact JSON skeleton
// from it and put that in the prompt — this keeps the output shape correct for
// callers that were written against a Gemini responseSchema (reading programs,
// lesson/session/weekly plans, sorting games, notes…). Returns an example
// value mirroring the schema's structure.
function schemaToHint(schema: any): any {
  if (!schema || typeof schema !== "object") return "string";
  const t = String(schema.type || "").toUpperCase();
  if (t === "OBJECT") {
    const o: any = {};
    const props = schema.properties || {};
    for (const k of Object.keys(props)) o[k] = schemaToHint(props[k]);
    return o;
  }
  if (t === "ARRAY") return [schemaToHint(schema.items)];
  if (t === "NUMBER" || t === "INTEGER") return 0;
  if (t === "BOOLEAN") return false;
  // STRING / unknown — surface the description so the model knows what to write.
  return schema.description ? `string — ${schema.description}` : "string";
}

/** The user-role prompt exactly as it will be sent.
 *
 *  Split out of groqGenerate so the model chooser can measure the very text
 *  that goes out. Estimating from anything else drifts, and a size estimate
 *  that disagrees with the real request is worse than none: it picks a model
 *  that then answers 413. */
function groqPromptText(request: { contents: any; config?: any }): string {
  const rawParts = request?.contents?.parts;
  const parts = Array.isArray(rawParts) ? rawParts : rawParts ? [rawParts] : [];
  let promptText = parts
    .map((p: any) => {
      if (typeof p === "string") return p;
      if (p?.text) return p.text;
      // An uploaded file is passed as Gemini-style inlineData. Groq can't read
      // inlineData, so a TEXT file (pptx/docx/xlsx/csv/txt/md/html… — all
      // extracted to text/plain upstream) would be silently dropped and the
      // output would ignore the document. Decode it into the prompt so the
      // model actually uses the uploaded content. (Binary image/PDF can't be
      // decoded to text here and is skipped — those need a vision/OCR path.)
      const inl = p?.inlineData;
      if (inl?.data && /^text\//i.test(inl.mimeType || "")) {
        let decoded = "";
        try {
          decoded =
            typeof Buffer !== "undefined"
              ? Buffer.from(inl.data, "base64").toString("utf-8")
              : decodeURIComponent(escape(atob(inl.data)));
        } catch {
          decoded = "";
        }
        decoded = decoded.trim();
        if (decoded)
          return `UPLOADED DOCUMENT CONTENT (base ALL questions/answers strictly on this):\n"""\n${decoded.slice(
            0,
            14000,
          )}\n"""`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
  const wantsJson = request?.config?.responseMimeType === "application/json";
  // If the caller supplied a responseSchema (for Gemini), describe the required
  // JSON shape in the prompt since Groq can't read the schema directly.
  const schema = request?.config?.responseSchema;
  if (wantsJson && schema) {
    try {
      promptText += `\n\nReturn ONLY a single JSON object with EXACTLY this structure (same keys and nesting; replace the placeholder values with real content, keep arrays as arrays):\n${JSON.stringify(
        schemaToHint(schema),
        null,
        2,
      )}`;
    } catch {
      /* schema too exotic to serialise — json_object mode still applies */
    }
  }
  return promptText;
}

/** Tokens per minute each model allows on this tier.
 *
 *  A request larger than the allowance is refused with 413 however many times
 *  it is retried, so the chooser skips such a model rather than spending an
 *  attempt proving it. This is what turned a busy leader into "AI Error: Groq
 *  413" in front of a class: the chain fell through to the small models, both
 *  refused a 9,000-token lesson-plan prompt, and the last refusal — naming
 *  gpt-oss-20b, a model that never had a chance — was the one the teacher saw.
 *
 *  Unlisted models are assumed small, which errs towards not sending. */
const GROQ_MODEL_TPM: Record<string, number> = {
  "groq/compound-mini": 70000,
  "openai/gpt-oss-120b": 8000,
  "openai/gpt-oss-20b": 8000,
};
const GROQ_DEFAULT_TPM = 8000;

const tpmFor = (model: string): number =>
  GROQ_MODEL_TPM[model] ?? GROQ_DEFAULT_TPM;

/** Roughly four characters to the token for English prose. This only has to
 *  separate a 9,000-token prompt from a 3,000-token one. */
const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

/** The models that could actually hold this request, biggest allowance first.
 *
 *  The allowance covers input AND the reply, so the output cap counts too.
 *  When nothing fits, the largest is returned anyway — a long shot beats
 *  refusing to try, and its error is at least the honest one. */
function groqModelsFor(models: string[], neededTokens: number): string[] {
  const viable = models.filter((m) => tpmFor(m) >= neededTokens);
  if (viable.length) return viable;
  return [[...models].sort((a, b) => tpmFor(b) - tpmFor(a))[0]].filter(Boolean);
}

async function groqGenerate(
  request: { contents: any; config?: any },
  model: string,
): Promise<{ text: string }> {
  const promptText = groqPromptText(request);
  const wantsJson = request?.config?.responseMimeType === "application/json";
  const messages: any[] = [];
  // Applied to every generation, JSON or not, so no prompt can miss it.
  messages.push({
    role: "system",
    content: wantsJson
      ? `You are an expert Cambridge educator. Respond with a SINGLE valid JSON object only — no markdown, no code fences, no commentary.\n\n${languageRule(request?.config?.language)}`
      : `You are an expert Cambridge educator.\n\n${languageRule(request?.config?.language)}`,
  });
  messages.push({ role: "user", content: promptText });
  // Give enough room for large worksheets (e.g. 50 questions). The 70B model
  // has a high per-minute token budget; the small fallback model has a tighter
  // one, so we use a smaller cap only for that model (see model loop).
  // The 8B fallback has a tight 6000 TPM budget; keep input+output under it so
  // it can actually serve as a fallback (a larger cap returns 413 every time).
  // Callers can cap output tokens per request (config.maxOutputTokens). Smaller
  // caps reduce per-minute token pressure, so more calls run in parallel before
  // Groq rate-limits (429) — important for chunked work like slide decks. We
  // still clamp to each model's safe ceiling.
  const ceiling = /8b|instant/i.test(model) ? 2600 : 7000;
  const requested = Number(request?.config?.maxOutputTokens) || 0;
  const maxTokens = requested > 0 ? Math.min(requested, ceiling) : ceiling;
  const body: any = { model, messages, temperature: 0.7, max_tokens: maxTokens };
  if (wantsJson) body.response_format = { type: "json_object" };
  // Hard per-call timeout: without it a stalled connection hangs the whole
  // generation forever (the user sees "still generating" indefinitely). On
  // abort we throw a "timeout" error so generateContentWithRetry treats it as
  // transient and retries / falls back instead of waiting endlessly.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROQ_CALL_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError" || controller.signal.aborted) {
      throw new Error(`Groq request timeout after ${GROQ_CALL_TIMEOUT_MS}ms (model ${model})`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${errBody.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Empty response");
  return { text };
}

/** How long to wait before retrying a transient failure.
 *
 *  Groq's 429 says exactly how long to wait ("Please try again in 28.84s").
 *  The old fixed 4s/8s backoff ignored that, so every retry fired while still
 *  limited, both models 429'd, and the caller got nothing — which showed up as
 *  a projected lesson with teaching slides but no quiz or games. */
function backoffMs(message: string, isRateLimit: boolean, attempt: number): number {
  const asked = /try again in ([\d.]+)\s*s/i.exec(message || "");
  if (isRateLimit && asked) {
    const wait = Math.ceil(parseFloat(asked[1]) * 1000) + 500;
    // Cap it: a minute-long stall in front of a class is worse than failing.
    return Math.min(Math.max(wait, 1000), 35000);
  }
  return Math.min((isRateLimit ? 4000 : 800) * (attempt + 1), 8000);
}

/** Gemini's free tier, as a second pool behind Groq.
 *
 *  Groq's free allowance is per-minute and shared across the school, so at
 *  9am on a planning day it runs out and a teacher gets an error for no
 *  reason they can see or fix. Gemini's free tier has its own separate quota,
 *  so the two are very unlikely to be exhausted at the same moment.
 *
 *  Server-side only. The browser holds no Gemini key by design and reaches
 *  generation through /api/ai/* anyway, where this runs. */
async function geminiFallback(
  systemInstruction: string,
  promptText: string,
  wantsJson: boolean,
): Promise<string> {
  const res: any = await gemini().models.generateContent({
    model: "gemini-3.5-flash",
    contents: promptText,
    config: {
      systemInstruction,
      ...(wantsJson ? { responseMimeType: "application/json" } : {}),
    },
  });
  // The SDK exposes .text on newer versions and parts on older ones.
  const direct = typeof res?.text === "string" ? res.text : "";
  if (direct.trim()) return direct.trim();
  const parts = res?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((p: any) => p?.text || "")
    .join("")
    .trim();
}

/** The system prompt, identical on both providers so the house style and the
 *  JSON-only rule do not change with whichever one happens to answer. */
const houseSystemPrompt = (wantsJson: boolean, language?: string): string =>
  wantsJson
    ? `You are an expert Cambridge educator. Respond with a SINGLE valid JSON object only — no markdown, no code fences, no commentary.\n\n${languageRule(language)}`
    : `You are an expert Cambridge educator.\n\n${languageRule(language)}`;

async function generateContentWithRetry(
  request: { contents: any; config?: any },
  models: string[] = GROQ_MODELS,
  attemptsPerModel = 2,
): Promise<any> {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not configured. Add it to .env and restart the server.",
    );
  }
  // Size the request once, then only talk to models that could hold it. The
  // allowance covers the reply as well as the prompt, so the output cap is
  // part of the bill.
  const outputCap =
    Number(request?.config?.maxOutputTokens) > 0
      ? Math.min(Number(request.config.maxOutputTokens), 7000)
      : 7000;
  const needed = estimateTokens(groqPromptText(request)) + outputCap;
  const chain = groqModelsFor(models, needed);
  // With one model left there is nothing to fall through to, so waiting out a
  // rate limit is the only way through — worth more attempts than usual. The
  // backoff already honours the "try again in Xs" Groq sends back.
  const attempts = chain.length === 1 ? Math.max(attemptsPerModel, 4) : attemptsPerModel;

  let lastErr: any;
  for (const model of chain) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await groqGenerate(request, model);
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message || err);
        const lower = msg.toLowerCase();
        // this model cannot serve it → try the next model in the list
        if (modelCannotServe(msg)) break;
        const isRateLimit = msg.includes("429") || lower.includes("rate limit");
        const transient =
          isRateLimit ||
          msg.includes("500") ||
          msg.includes("502") ||
          msg.includes("503") ||
          lower.includes("timeout") ||
          lower.includes("fetch failed") ||
          lower.includes("econnreset");
        if (!transient) throw err;
        await sleep(backoffMs(msg, isRateLimit, attempt));
      }
    }
  }
  // Groq is spent — busy, rate-limited or refusing the size. Before failing,
  // ask the other free provider. A teacher waiting on a suggestion does not
  // care which service answers, only that one does.
  try {
    const text = await geminiFallback(
      houseSystemPrompt(
        request?.config?.responseMimeType === "application/json",
        request?.config?.language,
      ),
      groqPromptText(request),
      request?.config?.responseMimeType === "application/json",
    );
    if (text) return { text };
  } catch {
    // Report the Groq failure rather than this one: it is the limit the
    // teacher actually hit, and the fallback being unconfigured is not news.
  }

  // Both pools are spent. Raw provider JSON in an alert box tells a teacher
  // nothing they can do; say what would actually help.
  if (modelCannotServe(String(lastErr?.message || lastErr || ""))) {
    throw new Error(
      "This is too large for the AI service's current per-minute limit. " +
        "Try generating fewer weeks at once, shortening the input, or waiting " +
        "a minute before trying again.",
    );
  }
  throw lastErr;
}

// Resilient multi-turn chat on Groq. Unlike groqGenerate (which flattens a
// single prompt), this preserves the system instruction AND the full
// conversation history as proper chat messages, then retries on transient
// errors (503/429/500/502/timeout) and falls back to the smaller model — so a
// busy/overloaded provider never throws a raw error at the user.
async function groqChat(
  systemInstruction: string,
  turns: { role: "user" | "model"; text: string }[],
  models: string[] = GROQ_MODELS,
  attemptsPerModel = 2,
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not configured. Add it to .env and restart the server.",
    );
  }
  const messages: any[] = [];
  messages.push({
    role: "system",
    content: systemInstruction ? `${systemInstruction}\n\n${UK_ENGLISH}` : UK_ENGLISH,
  });
  for (const t of turns) {
    if (!t || !t.text) continue;
    messages.push({ role: t.role === "model" ? "assistant" : "user", content: t.text });
  }
  // Same sizing rule as generateContentWithRetry: a chat whose history has
  // grown past a model's allowance is refused outright, so do not spend an
  // attempt on it.
  const needed =
    estimateTokens(messages.map((m: any) => String(m?.content || "")).join("\n")) +
    7000;
  const chain = groqModelsFor(models, needed);
  const attempts = chain.length === 1 ? Math.max(attemptsPerModel, 4) : attemptsPerModel;

  let lastErr: any;
  for (const model of chain) {
    const maxTokens = /8b|instant/i.test(model) ? 2600 : 7000;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GROQ_CALL_TIMEOUT_MS);
      try {
        const res = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: maxTokens }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          throw new Error(`Groq ${res.status}: ${errBody.slice(0, 300)}`);
        }
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content || "";
        if (!text) throw new Error("Empty response");
        return text;
      } catch (err: any) {
        lastErr = err;
        if (err?.name === "AbortError" || controller.signal.aborted) {
          lastErr = new Error(`Groq request timeout after ${GROQ_CALL_TIMEOUT_MS}ms (model ${model})`);
        }
        const msg = String(lastErr?.message || lastErr);
        const lower = msg.toLowerCase();
        if (modelCannotServe(msg)) break; // this model cannot serve it
        const isRateLimit = msg.includes("429") || lower.includes("rate limit");
        const transient =
          isRateLimit ||
          msg.includes("500") ||
          msg.includes("502") ||
          msg.includes("503") ||
          lower.includes("timeout") ||
          lower.includes("fetch failed") ||
          lower.includes("econnreset");
        if (!transient) throw lastErr;
        await sleep(backoffMs(msg, isRateLimit, attempt));
      } finally {
        clearTimeout(timer);
      }
    }
  }
  // Groq is spent. Ask the other free pool before failing the teacher.
  try {
    const text = await geminiFallback(
      systemInstruction ? `${systemInstruction}\n\n${UK_ENGLISH}` : UK_ENGLISH,
      turns
        .filter((t) => t && t.text)
        .map((t) => `${t.role === "model" ? "Assistant" : "Teacher"}: ${t.text}`)
        .join("\n\n"),
      false,
    );
    if (text) return text;
  } catch {
    /* keep the Groq error — it is the one that describes what was hit */
  }
  throw lastErr;
}

// Differentiated after-reading questions: the SAME question (same skill, same
// intent, same expected answer) written once per requested Lexile level, with
// only the language complexity adapted. No passage — students read their own
// book; these are book-response questions.
//
// Speed: one small base call writes the question set, then ALL level
// rewordings run in parallel (thinking budget capped) — wall time is roughly
// two short calls regardless of how many levels are selected.
export async function generateLeveledQuestions(
  bookTitle: string,
  levels: string[],
  options: { yearGroup: string; subject: string; numQuestions: number; sourceContent?: string },
  onProgress?: (message: string) => void,
): Promise<{
  questions: {
    skill: string;
    type?: string;
    versions: {
      lexile: string;
      text: string;
      options?: string[];
      pairs?: { left: string; right: string }[];
    }[];
  }[];
}> {
  const baseSchema = {
    type: Type.OBJECT,
    properties: {
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            skill: { type: Type.STRING, description: "Comprehension skill (e.g. Recall, Inference, Sequencing, Vocabulary, Opinion & Evidence, Visualising)." },
            type: { type: Type.STRING, description: "One of: multiple-choice, open-response, drawing, matching." },
            text: { type: Type.STRING, description: "The question text / instruction." },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3-4 answer options — multiple-choice questions only.",
            },
            pairs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  left: { type: Type.STRING },
                  right: { type: Type.STRING },
                },
                required: ["left", "right"],
              },
              description: "3-5 left/right pairs — matching questions only (e.g. character ↔ trait, cause ↔ effect, word ↔ meaning).",
            },
          },
          required: ["skill", "text", "type"],
        },
      },
    },
    required: ["questions"],
  };

  try {
    // 1. Base question set (concise, fast)
    onProgress?.(
      (options.sourceContent || "").trim()
        ? `Reading the worksheet's questions…`
        : `Writing ${options.numQuestions} shared questions…`,
    );
    const src = (options.sourceContent || "").trim();
    const basePrompt = src
      ? // Re-level an EXISTING worksheet supplied from a URL: extract its
        // questions and normalise them into the base set (reworded per level later).
        `You are an expert Cambridge literacy educator. Below is an existing worksheet for a ${options.yearGroup} class (${options.subject}). Recreate ALL of its questions — ONE entry per question in the worksheet, in the same order, keeping each question's meaning and correct answer. Do not invent extra questions and do not drop any.
For each question provide: "skill" (Recall, Inference, Sequencing, Vocabulary, Opinion & Evidence, or Visualising), "type" (one of "multiple-choice", "true-false", "open-response", "matching", "drawing"), "text", plus "options" (for multiple-choice) or "pairs" (for matching) where relevant.

EXISTING WORKSHEET:
"""
${src.slice(0, 8000)}
"""

Return ONLY a JSON object: {"questions":[{"skill":"...","type":"...","text":"...","options":["..."],"pairs":[{"left":"...","right":"..."}]}, ...]} with one array entry per question in the worksheet above.${bahasaMelayuDirective(options.subject)}${mandarinDualLanguage(options.subject)}`
      : `You are an expert Cambridge literacy educator. A ${options.yearGroup} class (${options.subject}) is reading: "${bookTitle}".
Write exactly ${options.numQuestions} after-reading questions with EXACTLY this mix:
- 1 DRAWING question (type "drawing"): the student draws a scene, character or idea from the book. No options, no pairs — just a clear drawing instruction.
- 1 MATCHING question (type "matching"): 3-5 left/right pairs to connect with a line (e.g. character ↔ trait, cause ↔ effect, word ↔ meaning). Put the pairs in the "pairs" field with the CORRECT pairing.
- The remaining questions split roughly half multiple-choice (type "multiple-choice", 3-4 options) and half open-response (type "open-response").
Label each with its comprehension skill (Recall, Inference, Sequencing, Vocabulary, Opinion & Evidence, Visualising...). If the book is well known, reference its actual content; otherwise write strong generic book-response questions (characters, setting, problem/solution, prediction, opinion with evidence). Keep questions concise.${bahasaMelayuDirective(options.subject)}${mandarinDualLanguage(options.subject)}`;
    const baseRes = await generateContentWithRetry({
      contents: { parts: [{ text: basePrompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: baseSchema,
        thinkingConfig: { thinkingBudget: 128 },
      },
    });
    const baseText = baseRes.text;
    if (!baseText) throw new Error("Empty response");
    const base: { questions: { skill: string; type?: string; text: string; options?: string[]; pairs?: { left: string; right: string }[] }[] } = JSON.parse(baseText);
    if (!base.questions || base.questions.length === 0) throw new Error("No questions generated");

    // 2. Reword in BATCHES: one call rewords for up to 4 Lexile bands at
    // once, and the batches run in parallel — all 10 levels cost just
    // 1 base call + 3 batch calls (fast AND friendly to tight rate limits).
    const baseJson = JSON.stringify(base.questions);
    const CHUNK = 4;
    const chunks: string[][] = [];
    for (let i = 0; i < levels.length; i += CHUNK) {
      chunks.push(levels.slice(i, i + CHUNK));
    }
    onProgress?.(
      `Adapting wording for ${levels.length} Lexile level(s) in ${chunks.length} parallel batch(es)…`,
    );
    let doneCount = 0;
    type LeveledQuestion = {
      skill: string;
      type?: string;
      text: string;
      options?: string[];
      pairs?: { left: string; right: string }[];
    };
    const batchSchema = {
      type: Type.OBJECT,
      properties: {
        sets: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              lexile: {
                type: Type.STRING,
                description:
                  "The Lexile band this question set is worded for — exactly one of the requested bands.",
              },
              questions: (baseSchema as any).properties.questions,
            },
            required: ["lexile", "questions"],
          },
          description: "One complete reworded question set per requested Lexile band.",
        },
      },
      required: ["sets"],
    };
    const leveledResults: { lexile: string; questions: LeveledQuestion[] }[] = [];
    await Promise.all(
      chunks.map(async (chunk) => {
        const rewordPrompt = `You are an expert in differentiated literacy instruction. Below is a fixed set of after-reading questions about "${bookTitle}".
For EACH of these Lexile bands — ${chunk.join(", ")} — produce one complete reworded copy of the ENTIRE question set, so the LANGUAGE matches that band. Lower bands: short sentences, high-frequency words, direct phrasing. Higher bands: richer vocabulary, more complex syntax.
STRICT RULES (apply to every band's copy): keep the same order, the same number of questions, the same "type", the same skill, the same intent and the SAME correct answer for each; multiple-choice questions keep the same number of options in the same order; open-response questions stay open-response (no options); drawing questions stay drawing instructions; matching questions keep the SAME number of pairs in the SAME order with the SAME correct pairing — reword both sides of each pair.
Return exactly ${chunk.length} sets, one per band, with the "lexile" field exactly as given.${bahasaMelayuDirective(options.subject)}${mandarinDualLanguage(options.subject)}

QUESTIONS (JSON):
${baseJson}`;
        const res = await generateContentWithRetry({
          contents: { parts: [{ text: rewordPrompt }] },
          config: {
            responseMimeType: "application/json",
            responseSchema: batchSchema,
            thinkingConfig: { thinkingBudget: 64 },
          },
        });
        const text = res.text;
        if (!text) throw new Error("Empty response");
        const parsed: { sets: { lexile: string; questions: LeveledQuestion[] }[] } =
          JSON.parse(text);
        for (const set of parsed.sets || []) {
          if (set && set.lexile) {
            leveledResults.push({
              lexile: set.lexile,
              questions: set.questions || [],
            });
            doneCount++;
          }
        }
        onProgress?.(
          `Adapting wording for ${levels.length} Lexile level(s)… ${Math.min(doneCount, levels.length)}/${levels.length} done`,
        );
      }),
    );
    // restore the requested level order; fall back to base wording for any
    // band the model failed to return
    const leveled = levels.map((l) => {
      const found = leveledResults.find(
        (r) => r.lexile === l || r.lexile.replace(/L$/i, "") === l,
      );
      return found || { lexile: l, questions: base.questions };
    });

    // 3. Assemble: one entry per base question holding all level versions
    return {
      questions: base.questions.map((bq, i) => ({
        skill: bq.skill,
        type: bq.type,
        versions: leveled.map((lv) => {
          const v = lv.questions[i] || bq;
          const isMcq = !!(bq.options && bq.options.length);
          const isMatch = !!(bq.pairs && bq.pairs.length);
          return {
            lexile: lv.lexile,
            text: v.text || bq.text,
            options: isMcq
              ? v.options && v.options.length === (bq.options || []).length
                ? v.options
                : bq.options
              : undefined,
            pairs: isMatch
              ? v.pairs && v.pairs.length === (bq.pairs || []).length
                ? v.pairs
                : bq.pairs
              : undefined,
          };
        }),
      })),
    };
  } catch (err: any) {
    if (typeof window !== 'undefined' && (err.message?.includes('API Key') || err.message?.includes('configured'))) {
      return callAiProxy('leveledQuestions', bookTitle, { levels, ...options });
    }
    throw err;
  }
}

// Re-level a full worksheet/assessment to a target Lexile band: same topic,
// same questions, same intent and same correct answers — only the language
// complexity of the passage, question text and options changes. Structure
// (sections, question count, types, option count) is preserved exactly.
export async function relevelWorksheet(
  worksheet: {
    title: string;
    description?: string;
    readingPassage?: string;
    sections: WorksheetSection[];
  },
  targetLexile: string,
  subject: string,
  yearGroup: string,
): Promise<{
  title: string;
  description?: string;
  readingPassage?: string;
  sections: WorksheetSection[];
}> {
  const prompt = `You are an expert Cambridge literacy educator specialising in differentiated instruction.

Below is a worksheet/assessment as JSON. Produce a copy of it reworded for the Lexile band ${targetLexile} (Subject: ${subject}, Year Group: ${yearGroup}).

STRICT RULES:
1. Keep the SAME structure exactly: same number of sections in the same order, same number of questions per section in the same order, and the same "type" for every question.
2. Keep the SAME intent and the SAME correct answer for every question. For multiple-choice keep the same number of options in the same order (reword them but keep the same correct choice). For sorting/cut-and-paste keep the same items in "options". Drawing questions stay drawing instructions (no options). Fill-in-the-blanks keep a "____" blank.
3. Only adjust LANGUAGE COMPLEXITY — vocabulary, sentence length and syntax — to match the ${targetLexile} band. Lower bands: short sentences, high-frequency words, direct phrasing. Higher bands: richer vocabulary and more complex syntax.
4. If a reading passage is present, rewrite it at the ${targetLexile} band keeping the same facts and meaning. If absent, return an empty string for readingPassage.
5. Keep the title essentially the same (you may append the level).

WORKSHEET (JSON):
${JSON.stringify(worksheet)}`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      readingPassage: { type: Type.STRING },
      sections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            instructions: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  type: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  categories: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["text", "type"],
              },
            },
          },
          required: ["title", "instructions", "questions"],
        },
      },
    },
    required: ["title", "sections"],
  };

  try {
    const res = await generateContentWithRetry({
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        // Rewording, not deep reasoning — disable thinking to cut latency.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const text = res.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text);
  } catch (err: any) {
    // In the browser, fall back to the server proxy on ANY failure.
    if (typeof window !== 'undefined') {
      try {
        const viaProxy = await callAiProxy('relevelWorksheet', JSON.stringify(worksheet), { targetLexile, subject, yearGroup });
        if (viaProxy && (viaProxy as any).sections) return viaProxy;
      } catch (proxyErr) {
        console.error('Re-level proxy fallback failed:', proxyErr);
      }
    }
    throw err;
  }
}

export async function generateInteractiveSortingGame(
  topic: string,
  subject: string,
  yearGroup: string
): Promise<{
  title: string;
  activityNumber: string;
  instruction: string;
  categories: { id: string; name: string; color: string }[];
  items: { id: string; name: string; category: string; description?: string; iconName?: string }[];
  footerNote?: string;
}> {
  try {
    let mainPrompt = `You are an expert children's worksheet and interactive learning developer.
    We need you to design an attractive, kid-friendly "Category Sorting Activity" based on the topic: "${topic}".
    The subject is "${subject}" and the grade group is "${yearGroup}".

    GUIDELINES:
    1. Identify interest-inducing columns or categories (usually exactly 2 categories, e.g., "MAMMAL" vs "REPTILE", or "COLD BLOODED" vs "WARM BLOODED", or "FILE" vs "NOT A FILE", or "CONDUCTOR" vs "INSULATOR", or "NOUN" vs "VERB").
    2. Suggest 6 to 10 typical, highly relatable items that kids can sort into these columns/categories.
    3. Provide clear instructions (e.g., "Cut out the pictures and paste them into the correct column", "Sort the items to match their category").
    4. Choose a clean children-appropriate name (e.g. "Activity 2: File or Not a File?", "Activity 1: Noun or Verb Quest!").
    5. Ensure the item descriptions are super playful, simple, and explain the object's role/meaning.
    6. Assign a standard Lucide icon name for each item to render as a cute illustration.
       Choose ONLY from the following list of valid Lucide icon names:
       'FileText', 'Image', 'Video', 'Folder', 'MousePointer', 'Keyboard', 'Tv', 'Headphones', 'Activity', 'Sparkles', 'Zap', 'Flame', 'Apple', 'Compass', 'BookOpen', 'Lightbulb', 'Cpu', 'Atom', 'Coins', 'Anchor', 'CloudRain', 'Smile', 'Scissors', 'Wind', 'Glasses', 'PenTool', 'Music', 'CheckCircle', 'MessageSquare', 'Target', 'LifeBuoy'
    7. Specify pleasant colors for each category (e.g. "emerald", "rose", "sky", "amber", "violet", "indigo"). For opposite categories, use distinct colors (e.g., emerald for column A, and rose or amber for column B).
    8. Add a playful summary footnote at the bottom (e.g., "Remember: Files are saved on computer drives. Other devices help us query and command them!").
    `;

    const response = await generateContentWithRetry({
      contents: { parts: [{ text: mainPrompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Friendly title for the activity card, e.g. 'File or Not a File?'" },
            activityNumber: { type: Type.STRING, description: "E.g., 'Activity 2' or 'Challenge 1'" },
            instruction: { type: Type.STRING, description: "A simple child-friendly instruction what to do." },
            categories: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "Unique slug identifier, e.g., 'file' or 'not-a-file'" },
                  name: { type: Type.STRING, description: "Human friendly label, e.g., 'FILE' or 'NOT A FILE'" },
                  color: { type: Type.STRING, description: "Descriptive tailwind/standard/hex color hint, e.g. 'emerald' or 'rose' or 'sky' or 'amber'" }
                },
                required: ["id", "name", "color"]
              }
            },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING, description: "Label for the item, e.g., 'Document', 'Picture File'" },
                  category: { type: Type.STRING, description: "Must match one of the category 'id's defined above." },
                  description: { type: Type.STRING, description: "Kid-friendly context description, e.g., 'A document file stores text writing on a disk.'" },
                  iconName: { type: Type.STRING, description: "Selected Lucide icon name, e.g., 'FileText'" }
                },
                required: ["id", "name", "category", "iconName"]
              }
            },
            footerNote: { type: Type.STRING, description: "A friendly, playful takeaway summary at the bottom." }
          },
          required: ["title", "activityNumber", "instruction", "categories", "items"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text);
  } catch (err: any) {
    if (typeof window !== 'undefined' && (err.message?.includes('API Key') || err.message?.includes('configured'))) {
      return callAiProxy('interactiveSorting', topic, { subject: subject || "English", yearGroup: yearGroup || "Year 3" });
    }
    throw err;
  }
}

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

// General-purpose assistant: ask a question, get an answer (ChatGPT-style).
// `history` lets the conversation stay contextual across turns.
/* ── Translating finished work ──────────────────────────────────────────
   A Mandarin class plans in English and teaches in Chinese. Rather than
   generating everything twice, a finished worksheet or lesson is handed here
   and comes back in the target language with its shape untouched: same keys,
   same arrays, same order, so the page that rendered it renders the
   translation without knowing anything changed.

   Only human-readable strings travel. A URL, a data URI, an emoji, a number
   or a code like "3TC.01" is left exactly as it was — translating those is how
   a deck loses its pictures. */

const NON_TEXT_KEYS = new Set([
  "image", "images", "img", "src", "url", "href", "poster", "icon", "emoji",
  "mascot", "id", "type", "layoutType", "design", "mimeType", "data",
  "illustrationPrompt", "lexile", "level", "color", "accent", "tone", "kind",
]);

/** Worth sending to a translator? Skips URLs, data URIs, numbers, codes and
 *  strings made only of emoji or punctuation. */
function isTranslatable(v: string): boolean {
  const t = v.trim();
  if (t.length < 2) return false;
  if (/^(https?:|data:|blob:|\/|#|\.\/)/i.test(t)) return false;
  if (/^[\d\s.,:;%+\-/()]+$/.test(t)) return false;
  // "3TC.01", "0547", "Bs.02" — curriculum codes, not prose.
  if (/^[0-9]*[A-Za-z]{1,4}[0-9.]+$/.test(t)) return false;
  // No letters at all (emoji, arrows, dashes) — nothing to translate.
  if (!/[A-Za-z\u00C0-\u024F]/.test(t)) return false;
  return true;
}

/** Every translatable string in the value, in a stable walk order. */
function collectStrings(value: any, out: string[], key = ""): void {
  if (typeof value === "string") {
    if (!NON_TEXT_KEYS.has(key) && isTranslatable(value)) out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out, key);
    return;
  }
  if (value && typeof value === "object") {
    for (const k of Object.keys(value)) collectStrings(value[k], out, k);
  }
}

/** Rebuild the value with each translatable string replaced by its
 *  translation. Walks in the same order as collectStrings, so the two agree. */
function applyStrings(value: any, map: Map<string, string>, key = ""): any {
  if (typeof value === "string") {
    if (!NON_TEXT_KEYS.has(key) && isTranslatable(value)) return map.get(value) ?? value;
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => applyStrings(v, map, key));
  if (value && typeof value === "object") {
    const out: any = {};
    for (const k of Object.keys(value)) out[k] = applyStrings(value[k], map, k);
    return out;
  }
  return value;
}

/** Translate one batch of strings, answering with the same number of strings
 *  in the same order. */
async function translateBatch(texts: string[], language: string): Promise<string[]> {
  const prompt = `Translate each string in the JSON array below into ${language}.

RULES:
- Answer with a JSON object {"items": [...]} whose "items" array holds the SAME number of strings, in the SAME order. Item 1 translates to item 1.
- This is classroom material for children. Translate naturally and simply, the way a teacher would say it, not word by word.
- Keep every "____" blank exactly as it is, in the same place in the sentence.
- Keep numbers, dates, people's names, curriculum codes (e.g. "3TC.01"), and anything already in ${language}, unchanged.
- Keep any emoji exactly where it is.
- Do NOT add, merge, split, explain or omit an item. An item you cannot translate comes back unchanged.
- Do NOT wrap the answer in markdown fences.

${JSON.stringify(texts, null, 0)}`;

  const res = await generateContentWithRetry({
    contents: { parts: [{ text: prompt }] },
    config: {
      responseMimeType: "application/json",
      // An object, not a bare array: Groq's JSON mode rejects a top-level array
      // and the whole batch comes back as a 400.
      responseSchema: {
        type: Type.OBJECT,
        properties: { items: { type: Type.ARRAY, items: { type: Type.STRING } } },
        required: ["items"],
      },
    },
  });
  let out: any;
  try {
    const parsed = JSON.parse((res.text || "").replace(/^```(?:json)?\s*|\s*```$/g, ""));
    out = Array.isArray(parsed) ? parsed : parsed?.items;
  } catch {
    return texts;
  }
  // A batch that came back the wrong length cannot be lined up with its
  // originals, so it is dropped rather than scrambling the material.
  if (!Array.isArray(out) || out.length !== texts.length) return texts;
  return out.map((v: any, i: number) => (typeof v === "string" && v.trim() ? v : texts[i]));
}

/** Translate a finished worksheet, lesson pack, week or slide deck into
 *  another language, keeping its structure exactly. */
export async function translateContent<T>(value: T, language: string): Promise<T> {
  const target = (language || "").trim();
  if (!target || value == null) return value;

  if (typeof window !== "undefined") {
    return callAiProxy("translate", JSON.stringify(value), { targetLanguage: target });
  }

  const found: string[] = [];
  collectStrings(value, found);
  // The same sentence often appears twice (a title and its slide). Translating
  // it once keeps the two copies identical as well as saving the tokens.
  const unique = Array.from(new Set(found));
  if (!unique.length) return value;

  // Batches are sized by characters, not count: forty one-word tiles and forty
  // paragraphs are very different requests.
  const batches: string[][] = [];
  let batch: string[] = [];
  let chars = 0;
  for (const t of unique) {
    if (batch.length >= 40 || chars + t.length > 3000) {
      if (batch.length) batches.push(batch);
      batch = [];
      chars = 0;
    }
    batch.push(t);
    chars += t.length;
  }
  if (batch.length) batches.push(batch);

  const results = await mapLimit(batches, 3, (b) => translateBatch(b, target));
  const map = new Map<string, string>();
  batches.forEach((b, i) => b.forEach((t, j) => map.set(t, results[i][j] ?? t)));
  return applyStrings(value, map) as T;
}

export async function askAI(question: string, history: ChatTurn[] = []): Promise<string> {
  try {
    const systemInstruction = `You are Zera Assistant, a friendly and knowledgeable AI helper built into the Zera Education suite for teachers and school staff.
- Answer clearly, accurately, and concisely.
- Use Markdown formatting (headings, bold, bullet/numbered lists, tables, and code blocks) whenever it makes the answer easier to read.
- For teaching, lesson, assessment, or curriculum questions, give practical, classroom-ready guidance and align with Cambridge International standards where relevant.
- If you are unsure or a request is outside your knowledge, say so honestly.`;

    const turns: { role: "user" | "model"; text: string }[] = [
      ...history
        .filter((h) => h && h.text)
        .map((h) => ({
          role: (h.role === "model" ? "model" : "user") as "user" | "model",
          text: h.text,
        })),
      { role: "user" as const, text: question },
    ];

    // Resilient Groq chat (retry + model fallback). This replaces the previous
    // direct gemini-3.5-flash call, which had NO fallback and surfaced raw 503
    // "high demand" errors to the user whenever the model was overloaded.
    const text = await groqChat(systemInstruction, turns);
    if (!text) throw new Error("Empty response");
    return text;
  } catch (err: any) {
    // In the browser the key isn't available (and the key-less / overloaded
    // cases both benefit from the server proxy, which holds the key and runs
    // the same resilient path). Fall back to it rather than throwing.
    if (typeof window !== "undefined") {
      return callAiProxy("chat", question, { history });
    }
    throw err;
  }
}

// Generate a poster / picture image from a text prompt. Returns a data URL.
// Pass { noText: true } for illustrations that must contain NO writing at all
// (e.g. reading-passage hero art) — otherwise text is allowed and, when present,
// is steered toward correct English spelling.
export async function generatePosterImage(
  prompt: string,
  opts?: { noText?: boolean },
): Promise<{ image: string; text: string }> {
  const directive = opts?.noText
    ? `Create a high-quality, detailed, visually appealing image exactly as described above. CRITICAL: produce a picture and background ONLY — absolutely NO text, letters, words, numbers, captions, titles, labels, signs, speech bubbles, watermarks, or writing of any kind anywhere in the image.`
    : `Create a high-quality, detailed, visually appealing image exactly as described above. If the image includes any text, write it in ENGLISH using the Latin (A–Z) alphabet only, spelled exactly and clearly — no gibberish, no other languages or scripts.`;
  const fullPrompt = `${prompt}

${directive}`;

  // In the browser, route image generation through the server proxy. The
  // provider credentials and API calls live server-side, and these APIs block
  // direct browser (CORS) calls anyway. Send the augmented prompt so the
  // text/no-text directive actually reaches the image model.
  if (typeof window !== "undefined") {
    return callAiProxy("image", fullPrompt, {});
  }

  // Most reliable path: our Cloudflare Worker generates the image via its AI
  // binding (no API token needed, so it can't break when tokens are rolled).
  const WORKER_IMAGE_URL =
    fromEnv("WORKER_IMAGE_URL") ||
    "https://zworksheets.nurshahidahmohdayob.workers.dev/image";
  try {
    const r = await fetch(WORKER_IMAGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: fullPrompt }),
    });
    if (r.ok) {
      const d = await r.json();
      if (d?.image) return { image: d.image, text: "" };
    } else {
      console.error("Worker image failed, falling back:", r.status);
    }
  } catch (e: any) {
    console.error("Worker image error, falling back:", e?.message || e);
  }

  // Fallbacks: OpenAI gpt-image-1, then Cloudflare Flux (token), then Gemini.
  const openaiKey = fromEnv("OPENAI_API_KEY");
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: fullPrompt,
          n: 1,
          size: "1024x1024",
          quality: "medium",
        }),
      });
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (res.ok && b64) return { image: `data:image/png;base64,${b64}`, text: "" };
      console.error(
        "OpenAI image error, falling back:",
        data?.error?.message || res.status,
      );
    } catch (e: any) {
      console.error("OpenAI image call failed, falling back:", e?.message || e);
    }
  }

  // Cloudflare Workers AI (Flux). On ANY failure (bad token, model error, no
  // image) fall through to Gemini instead of throwing — otherwise a misconfigured
  // Cloudflare token (401) blocks the whole chain and image generation never
  // reaches the Gemini fallback.
  const cfAccount = fromEnv("CLOUDFLARE_ACCOUNT_ID");
  const cfToken = fromEnv("CLOUDFLARE_API_TOKEN");
  if (cfAccount && cfToken) {
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt: fullPrompt }),
        },
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Cloudflare image ${res.status}: ${t.slice(0, 220)}`);
      }
      const data = await res.json();
      // flux-1-schnell returns { result: { image: "<base64 jpeg>" } }
      const b64 = data?.result?.image;
      if (b64) return { image: `data:image/jpeg;base64,${b64}`, text: "" };
      throw new Error("Cloudflare did not return an image.");
    } catch (e: any) {
      console.error("Cloudflare image failed, falling back to Gemini:", e?.message || e);
    }
  }

  // Fallback: Gemini image models (always tried if the above providers failed).
  const models = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"];
  let lastErr: any;
  for (const model of models) {
    try {
      const response = await gemini().models.generateContent({
        model,
        contents: fullPrompt,
        config: { responseModalities: ["IMAGE", "TEXT"] },
      });
      const parts = response.candidates?.[0]?.content?.parts || [];
      let image = "";
      let text = "";
      for (const p of parts) {
        if (p.inlineData?.data) {
          image = `data:${p.inlineData.mimeType || "image/png"};base64,${p.inlineData.data}`;
        } else if (p.text) {
          text += p.text;
        }
      }
      if (image) return { image, text };
      lastErr = new Error("The model did not return an image. Please try again.");
    } catch (err: any) {
      lastErr = err;
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("429") || msg.includes("quota") || msg.includes("rate")) break;
    }
  }
  throw lastErr || new Error("Image generation failed");
}
