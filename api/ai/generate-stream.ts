// Vercel streaming (SSE) counterpart of api/ai/generate.ts. Emits progress
// events (worksheet batches landing) so the deployed site shows live progress
// instead of a silent spinner. Other types emit a single final result.
// Requires GROQ_API_KEY in the Vercel project's env vars (see api/ai/generate.ts).

export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { type, lessonInput, options } = req.body || {};

  // Text generation runs on Groq → GROQ_API_KEY must be set in this deployment.
  const hasGroq =
    !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "undefined";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  const send = (obj: any) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  if (!hasGroq && type !== "image") {
    send({
      event: "error",
      error:
        "GROQ_API_KEY is not set in this deployment. Add it in Vercel → Settings → Environment Variables, then redeploy.",
    });
    res.end();
    return;
  }

  try {
    const gs: any = await import("../../src/services/geminiService");

    let result;
    if (type === "worksheet") {
      result = await gs.generateWorksheet(
        lessonInput,
        options,
        undefined,
        (partial: any) => send({ event: "partial", partial }),
      );
    } else {
      const dispatch: Record<string, () => Promise<any>> = {
        slides: () => gs.generateSlides(lessonInput, options),
        interactiveSorting: () =>
          gs.generateInteractiveSortingGame(lessonInput, options.subject, options.yearGroup),
        readingProgram: () => gs.generateReadingProgram(lessonInput, options),
        sessionPlan: () =>
          gs.generateSessionPlan(lessonInput, options.subtopics, options.weeks, options),
        lessonPlan: () => gs.generateLessonPlan(lessonInput, options),
        weeklyPlan: () =>
          gs.generateWeeklyPlan(lessonInput, options.weekNum, options, options.unit, options.topic),
        notes: () => gs.generateEduNotes(lessonInput, options),
        suggest: () => gs.suggestWeeklyInput(lessonInput, options, options.weekNum),
        all: () => gs.generateEduContent(lessonInput, options),
        relevelPassage: () =>
          gs.relevelReadingPassage(lessonInput, options.targetLexile, options.subject, options.yearGroup),
        leveledQuestions: () =>
          gs.generateLeveledQuestions(lessonInput, options.levels, {
            yearGroup: options.yearGroup,
            subject: options.subject,
            numQuestions: options.numQuestions,
            sourceContent: options.sourceContent,
          }),
        relevelWorksheet: () =>
          gs.relevelWorksheet(JSON.parse(lessonInput), options.targetLexile, options.subject, options.yearGroup),
        chat: () => gs.askAI(lessonInput, options.history || []),
        image: () => gs.generatePosterImage(lessonInput),
      };
      const fn = dispatch[type];
      if (!fn) throw new Error(`Unknown generation type: ${type}`);
      result = await fn();
    }
    send({ event: "result", result });
  } catch (error: any) {
    console.error("Streaming generation error:", error);
    send({ event: "error", error: error?.message || "Internal server error during AI generation" });
  } finally {
    res.end();
  }
}
