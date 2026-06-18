import { GoogleGenAI, Type } from "@google/genai";
import { EduContent, SlideContent, WorksheetSection, ReadingProgram, LessonPlan, WeeklyPlan } from "../types";

// The platform injects GEMINI_API_KEY into the process.env at runtime.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

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

export interface EduOptions {
  yearGroup: string;
  lexileLevel: string;
  subject: string;
  overallTopic?: string;
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
- Computing (0059/0860)

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

Cambridge Primary: Art & Design (0067), Computing (0059), Digital Literacy (0072), English (0058), English as a Second Language (0057), Global Perspectives (0838), Humanities (0065), Mathematics (0096), Modern Foreign Language (0064), Music (0068), Physical Education (0069), Science (0097), Wellbeing (0034).
Cambridge Lower Secondary: Art & Design (0073), Computing (0860), Digital Literacy (0082), English (0861), English as a Second Language (0876), Global Perspectives (1129), Humanities (0896), Mathematics (0862), Modern Foreign Language (0897), Music (0078), Physical Education (0081), Science (0893), Wellbeing (0859).
Cambridge IGCSE / Upper Secondary: Physics (0625), Biology (0610), Chemistry (0620), Mathematics (0580), etc.
`;

export async function generateSlides(lessonInput: string, options: EduOptions): Promise<{ slides: SlideContent[], metadata: { description: string, methodology: string } }> {
  try {
    const contents: any[] = [];
    if (options.fileContext) {
      contents.push({ inlineData: options.fileContext });
    }

    let mainPrompt = options.templateMode === 'strict'
      ? `As an expert Cambridge Educator, generate educational slides for the topic: "${lessonInput}". Subject: ${options.subject}, Year Group: ${options.yearGroup}.`
      : `As an expert Cambridge Educator, generate exactly ${options.numSlides} educational slides for: "${lessonInput}". Subject: ${options.subject}, Year Group: ${options.yearGroup}, ${options.lexileLevel !== 'None' ? `Lexile: ${options.lexileLevel}` : ''}.`;

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

    contents.push(mainPrompt);
    contents.push(`Format: JSON object with "slides" (array of {title, type, content, illustrationPrompt}) AND "metadata" (object with "description": string, "methodology": string).
    "methodology": ONE to TWO sentences (MAX 45 words) on the pedagogical approach, mentioning the Cambridge subject code. Be concise — do NOT write a paragraph.
    "description": ONE sentence (MAX 25 words) high-level overview.
    "type" for slides: one of title, content, activity, quiz.
    "content": 3-4 SHORT bullet points, each a concise phrase (MAX 14 words). Do NOT write long sentences or paragraphs.
    "illustrationPrompt": 3-5 search keywords only.
    "layoutType": (OPTIONAL) suggest one of 'infographic-cards', 'infographic-flow', 'infographic-grid', 'infographic-bubbles' if the content suits a non-list layout, otherwise 'standard'.
    IMPORTANT:
    1. Do NOT repeat the slide "title" as any item in the "content" array.
    2. Each content point is unique, informative, distinct from the title, and brief.
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
    const CHUNK = 5;
    if (options.templateMode === "strict" || total <= CHUNK + 1 || total === 0) {
      const response = await generateContentWithRetry({
        contents: { parts: baseParts },
        config: {
          thinkingConfig: { thinkingBudget: 128 },
          responseMimeType: "application/json",
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

    // Metadata + every chunk run concurrently (concurrency-capped via retry helper).
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
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            methodology: { type: Type.STRING },
          },
          required: ["description", "methodology"],
        },
      },
    }).then((r) => {
      try {
        return JSON.parse(r.text || "{}");
      } catch {
        return { description: "", methodology: "" };
      }
    });

    const chunkPromises = ranges.map((rg) =>
      generateContentWithRetry({
        contents: {
          parts: [
            ...baseParts,
            {
              text: `${planNote}\n\nGenerate EXACTLY ${rg.count} slides — these are slides ${rg.start} to ${rg.start + rg.count - 1} of ${total} (part ${rg.idx + 1} of ${chunkCount}). Return ONLY a "slides" array (no metadata). Keep each slide concise.`,
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingBudget: 128 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { slides: { type: Type.ARRAY, items: slideItemSchema } },
            required: ["slides"],
          },
        },
      }).then((r) => {
        try {
          return { idx: rg.idx, slides: JSON.parse(r.text || "{}").slides || [] };
        } catch {
          return { idx: rg.idx, slides: [] };
        }
      }),
    );

    const [metadata, ...chunks] = await Promise.all([
      metaPromise,
      ...chunkPromises,
    ]);
    const slides = chunks
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
  "multiple-choice": "Multiple Choice",
  "true-false": "True or False",
  "fill-in-the-blanks": "Fill in the Blanks",
  matching: "Matching",
  sorting: "Sorting",
  "cut-and-paste": "Cut and Paste",
  scenario: "Scenario Questions",
  "short-answer": "Short Answer",
  drawing: "Drawing",
};
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

// Dedupe questions GLOBALLY across all sections (top-ups can repeat a question).
function dedupeSections(sections: any[]): any[] {
  const seen = new Set<string>();
  return (sections || []).map((s: any) => ({
    ...s,
    questions: (s?.questions || []).filter((q: any) => {
      const k = String(q?.text || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    }),
  }));
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
function organizeByType<T extends { sections?: any[] }>(ws: T): T {
  if (!ws || !Array.isArray(ws.sections)) return ws;
  const all = ws.sections.flatMap((s: any) => s?.questions || []);
  if (!all.length) return ws;
  const groups: Record<string, any[]> = {};
  for (const q of all) {
    const k = normQType(q?.type);
    (groups[k] ||= []).push(q);
  }
  const sections: any[] = [];
  for (const k of QTYPE_ORDER) {
    if (groups[k]?.length)
      sections.push({ title: QTYPE_TITLE[k], instructions: "", questions: groups[k] });
  }
  for (const k of Object.keys(groups)) {
    if (!QTYPE_ORDER.includes(k))
      sections.push({ title: QTYPE_TITLE[k] || "Questions", instructions: "", questions: groups[k] });
  }
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
      : `You MUST produce a FULL set of ${options.numQuestions} questions IN TOTAL across all sections — keep writing questions until you reach ${options.numQuestions}; do not stop early. (A few extra is acceptable; we keep the first ${options.numQuestions}.) Allowed Types: ${options.questionTypes.join(", ")}.`;

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
    - For "multiple-choice", EXACTLY ONE option may be correct — the other options must be clearly WRONG, never also-true or partially-correct (e.g. do NOT ask "What is a robot used for in the home?" with both "clean the house" and "cook meals" as options). Make the question specific enough that only ONE option is right. For "true-false", the statement must be verifiably true or false.
    - Do NOT repeat questions; keep them distinct.`;

    if (options.metadataHints?.description) {
      mainPrompt += `\nIntegration Goal: ${options.metadataHints.description}`;
    }
    if (options.metadataHints?.methodology) {
      mainPrompt += `\nPedagogical Focus: ${options.metadataHints.methodology}`;
    }

    const encodingRules = `QUESTION "type" FIELD — set it to one of these exact lowercase values based on the question, and follow the encoding rules for each:
- "multiple-choice": put 3-4 answer choices in "options". EXACTLY ONE option may be correct — the other options must be clearly WRONG, never also-true or partially-correct. Do not write options where more than one could be a valid answer; the student must be able to pick a single, unambiguous answer. Place the correct option in a VARYING position (not always first).
- "true-false": put exactly ["True","False"] in "options".
- "fill-in-the-blanks": a short, concise exam-style sentence (8-14 words) with exactly one "____" blank and a normal space around it. The FIRST option is the correct answer (ONE or TWO words; use DIGITS for numbers); add 1-2 short distractors. Each fill-in must have a different answer.
- "short-answer" / "scenario": an open written response; leave "options" empty.
- "matching": a left-to-right matching task; leave "options" empty.
- "drawing": a creative DRAWING task — the student draws their answer in an empty box. Write a clear drawing instruction in "text" and DO NOT provide "options".
- "sorting": a sorting task. Name the 2-4 categories inside "text" (e.g. "Sort these into Mammals and Birds"), and put the individual items to be sorted in "options".
- "cut-and-paste": a cut-and-paste task. Describe the target slots/categories inside "text", and put the individual items the student cuts out and pastes in "options".
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
      const want = options.numQuestions || 0;

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
      while (want > 0 && topups < maxTopups && dry < 3) {
        const deficit = computeDeficit();
        if (deficit.total <= 0) break;
        topups++;

        // Build the batch request — fill the shortest types first, up to BATCH.
        let need = Math.min(deficit.total, BATCH);
        let breakdownLine = `${need} questions`;
        if (hasTypeCounts) {
          const parts: string[] = [];
          let budget = BATCH;
          for (const [t, miss] of Object.entries(deficit.byType)) {
            if (budget <= 0) break;
            const take = Math.min(miss, budget);
            parts.push(`${take} "${t}"`);
            budget -= take;
          }
          need = BATCH - budget;
          breakdownLine = parts.join(", ");
        }

        const existing = (ws?.sections || [])
          .flatMap((s: any) => s?.questions || [])
          .map((q: any) => q?.text)
          .filter(Boolean)
          .slice(-25);
        let extra: any[] = [];
        try {
          const more = await generateContentWithRetry({
            contents: {
              parts: [
                {
                  text: `As an expert Cambridge Educator, write EXACTLY these ADDITIONAL distinct, exam-style assessment questions STRICTLY about the topic "${lessonInput}" (Subject: ${options.subject}, Year Group: ${options.yearGroup}): ${breakdownLine}. EVERY question must be directly about "${lessonInput}" — do not drift off-topic. Use ONLY these exact lowercase "type" values. Every question must be factually accurate, logically sound, and aligned with Cambridge textbooks/past papers, with a clearly correct answer. For multiple-choice, EXACTLY ONE option may be correct — the other options must be clearly WRONG (never also-true or partially-correct) so the student can pick a single unambiguous answer. Fill-in-the-blank answers must be SHORT (one or two words). They MUST be different from these existing questions: ${JSON.stringify(existing)}.\n${encodingRules}\nReturn ONLY JSON: {"questions": [{"text","type","options"}]}`,
                },
              ],
            },
            config: {
              thinkingConfig: { thinkingBudget: 0 },
              responseMimeType: "application/json",
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
          extra = salvageQuestions(more.text || "").filter((q: any) => {
            const t = normQType(q?.type);
            if (!allowedTypes.has(t)) return false;
            return hasTypeCounts ? (deficit.byType[t] || 0) > 0 : true;
          });
        } catch {
          extra = []; // network/parse failure — try another batch rather than give up
        }
        void need;
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
      }
      return normalizeFillBlanks(organizeByType(capByTypeCounts(ws, options.typeCounts, want)));
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
Use the subject "${options.subject}" exactly. Keep all content neutral and brand-free, and keep every question concise and direct.`;
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
Generate EXACTLY ${rg.count} questions as ONE worksheet section (give the section a fitting title and a brief instruction line). This is part ${rg.idx + 1} of ${chunkCount} of a ${total}-question worksheet — cover a DISTINCT sub-area and do NOT duplicate the other parts. Allowed Types: ${options.questionTypes.join(", ")}.${passage ? `\nBase the questions on this reading passage:\n"""${passage}"""` : ""}
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
        const viaProxy = await callAiProxy('worksheet', lessonInput, { ...options, slideContext });
        if (viaProxy && (viaProxy as any).sections && (viaProxy as any).sections.length > 0) {
          return viaProxy;
        }
      } catch (proxyErr) {
        console.error('Worksheet proxy fallback failed:', proxyErr);
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

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
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
        - "strand": string (the curriculum strand)
        - "learningObjective": string (one clear, numbered learning objective)
        - "introduction": string (detailed overview)
        - "activities": string (specific activities)
        - "assessment": string (assessment method)
        - "resources": string (Include relevant Cambridge Learning Standard codes)
    `;
    contents.push(mainPrompt);

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
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
            weeklyBreakdown: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  week: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  strand: { type: Type.STRING },
                  learningObjective: { type: Type.STRING },
                  introduction: { type: Type.STRING },
                  activities: { type: Type.STRING },
                  assessment: { type: Type.STRING },
                  resources: { type: Type.STRING }
                },
                required: ["week", "unit", "topic", "strand", "learningObjective", "introduction", "activities", "assessment", "resources"]
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
    const mainPrompt = `As an expert Cambridge Educator, create a professional, detailed ${weekCount}-WEEK Lesson Plan for a ${options.yearGroup} class.
      ${options.fileContext ? `
      UPLOADED CURRICULUM DOCUMENTS (HIGHEST PRIORITY):
      - The attached file(s) contain the official Scheme of Work and/or subject Framework for this class.
      - Treat the attached document(s) as the PRIMARY SOURCE OF TRUTH. Derive the units, topics, strands, learning objectives, sequence/progression, and assessment guidance directly from them.
      - Match the weekly breakdown to the order and content of the uploaded scheme of work. Use its exact unit titles, objective codes, and terminology wherever provided.
      - Only fall back to general Cambridge curriculum knowledge to fill gaps the document does not cover.
      ` : ''}
      STANDARDS & FRAMEWORK:
      - Use the provided subject "${options.subject}" exactly as given. Do not substitute it with a similar subject (e.g. do not change Digital Literacy to Computer Science).
      - Base the content strictly on the Cambridge International Curriculum (CAIE/Cambridge Primary/Lower Secondary).
      - Align objectives with official Cambridge Framework Learning Objectives using the Stage+Strand+Number format (e.g., 3TC.01, 3Rf.04).
      - Incorporate methodology consistent with Cambridge Schemes of Work (SoW).
      - Reference relevant subject codes and strand initials from the following list: ${CAMBRIDGE_CURRICULUM_INFO}
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
      - "weeklyBreakdown": Array of exactly ${weekCount} objects, each with:
        - "week": number (1-${weekCount})
        - "unit": string (The Cambridge curriculum unit number and title)
        - "topic": string (based on the weekly topics provided)
        - "strand": string (the curriculum strand)
        - "learningObjective": string (one clear, numbered learning objective, e.g., "1. Identify the parts of a plant")
        - "introduction": string (detailed overview of what this topic is about)
        - "activities": string (specific activities that the teacher can do for this topic. Be very detailed and write complete sentences.)
        - "assessment": string (what worksheet, quiz, exam or activity for this topic. Be very detailed and write complete sentences.)
        - "resources": string (Include relevant Cambridge Learning Standard codes)
    `;
    contents.push(mainPrompt);

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
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
            weeklyBreakdown: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  week: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  strand: { type: Type.STRING },
                  learningObjective: { type: Type.STRING },
                  introduction: { type: Type.STRING },
                  activities: { type: Type.STRING },
                  assessment: { type: Type.STRING },
                  resources: { type: Type.STRING }
                },
                required: ["week", "unit", "topic", "strand", "learningObjective", "introduction", "activities", "assessment", "resources"]
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

export async function suggestWeeklyInput(type: 'unit' | 'topic' | 'activity', options: EduOptions, weekNum: number): Promise<string> {
  const prompt = `As an expert Cambridge Educator, suggest a creative and curriculum-aligned ${type.toUpperCase()} for Week ${weekNum} of a ${options.yearGroup} ${options.subject} class.
    
    CONTEXT:
    - Subject: ${options.subject}
    - Grade: ${options.yearGroup}
    - Overall Lesson Topic: ${options.overallTopic || 'General ' + options.subject}
    
    CURRICULUM ALIGNMENT:
    - Use the provided subject "${options.subject}" exactly as given. Do not substitute it with a similar subject (e.g. do not change Digital Literacy to Computer Science).
    - Align with Cambridge International Framework (Primary, Lower Secondary, or IGCSE as appropriate for ${options.yearGroup}).
    - Use relevant subject codes and official strand-based LO codes (e.g., 3TC.01) from this information: ${CAMBRIDGE_CURRICULUM_INFO}
    
    TASK:
    Return ONLY a single concise ${type} suggestion. No explanation, no quotes.
    ${type === 'activity' ? 'Ensure the activity is hands-on or highly engaging for this age group.' : ''}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ parts: [{ text: prompt }] }]
    });

    return response.text?.trim() || "";
  } catch (err: any) {
    if (typeof window !== 'undefined' && (err.message?.includes('API Key') || err.message?.includes('configured'))) {
      return callAiProxy('suggest', type, { ...options, weekNum });
    }
    throw err;
  }
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
      PRIMARY ACTIVITY PROVIDED BY TEACHER:
      "${activity}"

      YOUR TASK:
      Based on the teacher's input${unit || topic ? ` (especially the specific unit/topic provided)` : ''}, generate a complete weekly plan entry.
      
      Format the response as a JSON object with:
      - "week": ${weekNum}
      - "unit": string (${unit ? `Return exactly or expand upon: ${unit}` : 'The Cambridge curriculum unit number and title'})
      - "topic": string (${topic ? `Return exactly or expand upon: ${topic}` : 'A concise title for the week\'s lesson'})
      - "strand": string (the curriculum strand)
      - "learningObjective": string (one clear, numbered learning objective)
      - "introduction": string (detailed overview of what this topic is about)
      - "activities": string (incorporate the teacher's activity "${activity}" and expand on it)
      - "assessment": string (what worksheet, quiz, or exam activity for this topic)
      - "resources": string (Unit #, Learning Standard code, etc.)
    `;
    contents.push(mainPrompt);

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: contents.map(c => typeof c === 'string' ? { text: c } : c) },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            week: { type: Type.NUMBER },
            unit: { type: Type.STRING },
            topic: { type: Type.STRING },
            strand: { type: Type.STRING },
            learningObjective: { type: Type.STRING },
            introduction: { type: Type.STRING },
            activities: { type: Type.STRING },
            assessment: { type: Type.STRING },
            resources: { type: Type.STRING }
          },
          required: ["week", "unit", "topic", "strand", "learningObjective", "introduction", "activities", "assessment", "resources"]
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
    `;

    contents.push(mainPrompt);
    contents.push(`Format: JSON object with "notes" (a long string containing the markdown formatted notes).`);

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
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

      OUTPUT: Return ONLY the clean Markdown handout — no JSON, no code fences, no preamble or closing remarks.`;

  parts.push({ text: mainPrompt });

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-3.5-flash",
      contents: { parts },
    });
    let full = "";
    for await (const chunk of stream) {
      const t = chunk.text;
      if (t) {
        full += t;
        onChunk(full);
      }
    }
    if (!full) throw new Error("Empty response");
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

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [{ text: mainPrompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            readingPassage: { type: Type.STRING, description: "The complete rewritten reading passage text matching the target Lexile complexity." },
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
              },
              description: "An array of 3-5 key vocabulary words from the rewritten text adapted to the target level."
            },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING }
                },
                required: ["question", "answer"]
              },
              description: "An array of 3-5 key comprehension questions and answers for this target level adaptation."
            }
          },
          required: ["readingPassage", "vocabulary", "questions"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text);
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

// ===== Groq (OpenAI-compatible) text generation =====
// The app's text generation now runs on Groq instead of Google Gemini.
// We translate the existing Gemini-style request ({contents:{parts}, config})
// into a Groq chat completion and return an object exposing `.text`, so every
// existing caller keeps working unchanged. The key stays SERVER-SIDE (it is not
// injected into the browser bundle); the browser falls back to the /api/ai
// proxy which holds the key.
const GROQ_API_KEY = (process.env.GROQ_API_KEY as string) || "";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function groqGenerate(
  request: { contents: any; config?: any },
  model: string,
): Promise<{ text: string }> {
  const rawParts = request?.contents?.parts;
  const parts = Array.isArray(rawParts) ? rawParts : rawParts ? [rawParts] : [];
  const promptText = parts
    .map((p: any) => (typeof p === "string" ? p : p?.text || ""))
    .filter(Boolean)
    .join("\n\n");
  const wantsJson = request?.config?.responseMimeType === "application/json";
  const messages: any[] = [];
  if (wantsJson) {
    messages.push({
      role: "system",
      content:
        "You are an expert Cambridge educator. Respond with a SINGLE valid JSON object only — no markdown, no code fences, no commentary.",
    });
  }
  messages.push({ role: "user", content: promptText });
  // Give enough room for large worksheets (e.g. 50 questions). The 70B model
  // has a high per-minute token budget; the small fallback model has a tighter
  // one, so we use a smaller cap only for that model (see model loop).
  // The 8B fallback has a tight 6000 TPM budget; keep input+output under it so
  // it can actually serve as a fallback (a larger cap returns 413 every time).
  const maxTokens = /8b|instant/i.test(model) ? 2600 : 7000;
  const body: any = { model, messages, temperature: 0.7, max_tokens: maxTokens };
  if (wantsJson) body.response_format = { type: "json_object" };
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${errBody.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Empty response");
  return { text };
}

async function generateContentWithRetry(
  request: { contents: any; config?: any },
  models: string[] = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  attemptsPerModel = 2,
): Promise<any> {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not configured. Add it to .env and restart the server.",
    );
  }
  let lastErr: any;
  for (const model of models) {
    for (let attempt = 0; attempt < attemptsPerModel; attempt++) {
      try {
        return await groqGenerate(request, model);
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message || err);
        const lower = msg.toLowerCase();
        // decommissioned / unknown model → try the next model in the list
        if (
          msg.includes("404") ||
          lower.includes("not found") ||
          lower.includes("decommission") ||
          lower.includes("does not exist")
        )
          break;
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
        await sleep(
          Math.min((isRateLimit ? 4000 : 800) * (attempt + 1), 8000),
        );
      }
    }
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
  options: { yearGroup: string; subject: string; numQuestions: number },
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
    onProgress?.(`Writing ${options.numQuestions} shared questions…`);
    const basePrompt = `You are an expert Cambridge literacy educator. A ${options.yearGroup} class (${options.subject}) is reading: "${bookTitle}".
Write exactly ${options.numQuestions} after-reading questions with EXACTLY this mix:
- 1 DRAWING question (type "drawing"): the student draws a scene, character or idea from the book. No options, no pairs — just a clear drawing instruction.
- 1 MATCHING question (type "matching"): 3-5 left/right pairs to connect with a line (e.g. character ↔ trait, cause ↔ effect, word ↔ meaning). Put the pairs in the "pairs" field with the CORRECT pairing.
- The remaining questions split roughly half multiple-choice (type "multiple-choice", 3-4 options) and half open-response (type "open-response").
Label each with its comprehension skill (Recall, Inference, Sequencing, Vocabulary, Opinion & Evidence, Visualising...). If the book is well known, reference its actual content; otherwise write strong generic book-response questions (characters, setting, problem/solution, prediction, opinion with evidence). Keep questions concise.`;
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
Return exactly ${chunk.length} sets, one per band, with the "lexile" field exactly as given.

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

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: mainPrompt,
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
export async function askAI(question: string, history: ChatTurn[] = []): Promise<string> {
  try {
    const systemInstruction = `You are Zera Assistant, a friendly and knowledgeable AI helper built into the Zera Education suite for teachers and school staff.
- Answer clearly, accurately, and concisely.
- Use Markdown formatting (headings, bold, bullet/numbered lists, tables, and code blocks) whenever it makes the answer easier to read.
- For teaching, lesson, assessment, or curriculum questions, give practical, classroom-ready guidance and align with Cambridge International standards where relevant.
- If you are unsure or a request is outside your knowledge, say so honestly.`;

    const contents = [
      ...history
        .filter((h) => h && h.text)
        .map((h) => ({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.text }],
        })),
      { role: 'user', parts: [{ text: question }] },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: { systemInstruction },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    return text;
  } catch (err: any) {
    if (typeof window !== 'undefined' && (err.message?.includes('API Key') || err.message?.includes('configured'))) {
      return callAiProxy('chat', question, { history });
    }
    throw err;
  }
}

// Generate a poster / picture image from a text prompt. Returns a data URL.
export async function generatePosterImage(prompt: string): Promise<{ image: string; text: string }> {
  const fullPrompt = `${prompt}

Create a high-quality, detailed, visually appealing image exactly as described above. If the image includes any text, write it in ENGLISH using the Latin (A–Z) alphabet only, spelled exactly and clearly — no gibberish, no other languages or scripts.`;

  // In the browser, route image generation through the server proxy. The
  // provider credentials and API calls live server-side, and these APIs block
  // direct browser (CORS) calls anyway.
  if (typeof window !== "undefined") {
    return callAiProxy("image", prompt, {});
  }

  // Server-side, prefer OpenAI gpt-image-1 (best at rendering text), then fall
  // back to Cloudflare Flux, then Gemini. Any OpenAI failure (e.g. a billing
  // limit) silently falls through so image generation still works.
  const openaiKey = (process.env.OPENAI_API_KEY as string) || "";
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

  // Cloudflare Workers AI (Flux).
  const cfAccount = (process.env.CLOUDFLARE_ACCOUNT_ID as string) || "";
  const cfToken = (process.env.CLOUDFLARE_API_TOKEN as string) || "";
  if (cfAccount && cfToken) {
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
    throw new Error("Cloudflare did not return an image. Please try again.");
  }

  // Fallback: Gemini image models if Cloudflare isn't configured.
  const models = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"];
  let lastErr: any;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
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
