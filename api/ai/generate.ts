// Vercel serverless function: the SAME AI generation backend the local Express
// server exposes at POST /api/ai/generate. Without this, the deployed site has
// NO backend, so the browser can only fall back to the slow client-side Gemini
// key baked into the bundle — which is why generation is fast locally (Groq via
// the Express server) but slow on Vercel. This runs the fast Groq path
// server-side using the GROQ_API_KEY set in the Vercel project's env vars.
//
// Required Vercel env vars (Project → Settings → Environment Variables):
//   GROQ_API_KEY   — primary text generation (fast)
//   GEMINI_API_KEY — optional, used only by legacy/image paths
//   CLOUDFLARE_*   — optional, image generation worker

// geminiService is pre-bundled (esbuild) into api/_lib/geminiService.js by the
// build step. We import THAT self-contained file rather than the TS source in
// src/, because Vercel only transpiles api functions (it doesn't bundle the
// cross-directory src import), which left a bare ESM import that failed at
// runtime with "Cannot find module". The _lib/ prefix keeps Vercel from
// treating the file as an endpoint. (Generated at build → ts-ignored here.)
// @ts-ignore
import * as geminiService from "../_lib/geminiService.js";

// Allow up to 60s (Groq is fast, but large chunked decks / worksheets can run
// longer than the 10s default).
export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { type, lessonInput, options } = req.body || {};

  // Text generation runs on Groq, so GROQ_API_KEY must be set in THIS
  // deployment's env (images can use Gemini/Cloudflare). Checking it
  // specifically avoids a misleading "add it to .env" error when only a Gemini
  // key happens to be present.
  const hasGroq =
    !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "undefined";
  if (!hasGroq && type !== "image") {
    res.status(500).json({
      error: "GROQ_API_KEY is not set in this deployment.",
      details:
        "Add GROQ_API_KEY in Vercel → Settings → Environment Variables (Production + Preview), then redeploy.",
    });
    return;
  }

  try {
    const gs: any = geminiService;
    const {
      generateSlides,
      generateWorksheet,
      generateReadingProgram,
      generateLessonPlan,
      generateSessionPlan,
      generateWeeklyPlan,
      generateLessonActivities,
      generateEduContent,
      suggestWeeklyInput,
      generateEduNotes,
      relevelReadingPassage,
      generateInteractiveSortingGame,
      askAI,
      generatePosterImage,
      generateLeveledQuestions,
      relevelWorksheet,
    } = gs as any;

    let result;
    switch (type) {
      case "slides":
        result = await generateSlides(lessonInput, options);
        break;
      case "worksheet":
        result = await generateWorksheet(lessonInput, options);
        break;
      case "interactiveSorting":
        result = await generateInteractiveSortingGame(
          lessonInput,
          options.subject,
          options.yearGroup,
        );
        break;
      case "readingProgram":
        result = await generateReadingProgram(lessonInput, options);
        break;
      case "sessionPlan":
        result = await generateSessionPlan(
          lessonInput,
          options.subtopics,
          options.weeks,
          options,
        );
        break;
      case "lessonPlan":
        result = await generateLessonPlan(lessonInput, options);
        break;
      case "weeklyPlan":
        result = await generateWeeklyPlan(
          lessonInput,
          options.weekNum,
          options,
          options.unit,
          options.topic,
        );
        break;
      case "lessonActivities":
        result = await generateLessonActivities(
          JSON.parse(lessonInput),
          options.plan,
          options,
          options.half || "both",
        );
        break;
      case "notes":
        result = await generateEduNotes(lessonInput, options);
        break;
      case "suggest":
        result = await suggestWeeklyInput(lessonInput, options, options.weekNum);
        break;
      case "all":
        result = await generateEduContent(lessonInput, options);
        break;
      case "relevelPassage":
        result = await relevelReadingPassage(
          lessonInput,
          options.targetLexile,
          options.subject,
          options.yearGroup,
        );
        break;
      case "leveledQuestions":
        result = await generateLeveledQuestions(lessonInput, options.levels, {
          yearGroup: options.yearGroup,
          subject: options.subject,
          numQuestions: options.numQuestions,
          sourceContent: options.sourceContent,
        });
        break;
      case "relevelWorksheet":
        result = await relevelWorksheet(
          JSON.parse(lessonInput),
          options.targetLexile,
          options.subject,
          options.yearGroup,
        );
        break;
      case "chat":
        result = await askAI(lessonInput, options.history || []);
        break;
      case "image":
        result = await generatePosterImage(lessonInput);
        break;
      default:
        throw new Error(`Unknown generation type: ${type}`);
    }

    res.status(200).json(result);
  } catch (error: any) {
    console.error("Serverless generation error:", error);
    res
      .status(500)
      .json({ error: error?.message || "Internal server error during AI generation" });
  }
}
