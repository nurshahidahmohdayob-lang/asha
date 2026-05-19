import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing
  app.use(express.json({ limit: '50mb' }));

  // API Route for AI Generation (Server-side to protect keys)
  app.post("/api/ai/generate", async (req, res) => {
    const { type, lessonInput, options } = req.body;
    
    const keyNames = ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'VITE_GEMINI_API_KEY', 'API_KEY'];
    let key = "";
    
    for (const name of keyNames) {
      if (process.env[name] && process.env[name] !== "MY_GEMINI_API_KEY" && process.env[name] !== "undefined") {
        key = process.env[name]!;
        break;
      }
    }

    if (!key) {
      console.error("AI Key Missing. Environment contains:", Object.keys(process.env).filter(k => k.includes('KEY') || k.includes('API') || k.includes('GEMINI')));
      return res.status(500).json({ 
        error: "GEMINI_API_KEY is not configured.",
        details: "Action Required: Please click on 'Settings' (gear icon) -> 'Secrets' and add a new secret called 'GEMINI_API_KEY' with your Gemini API key."
      });
    }

    try {
      const { generateSlides, generateWorksheet, generateReadingProgram, generateLessonPlan, generateSessionPlan, generateWeeklyPlan, generateEduContent, suggestWeeklyInput, generateEduNotes } = await import("./src/services/geminiService.ts");
      
      let result;
      switch (type) {
        case 'slides': result = await generateSlides(lessonInput, options); break;
        case 'worksheet': result = await generateWorksheet(lessonInput, options); break;
        case 'readingProgram': result = await generateReadingProgram(lessonInput, options); break;
        case 'sessionPlan': result = await generateSessionPlan(lessonInput, options.subtopics, options.weeks, options); break;
        case 'lessonPlan': result = await generateLessonPlan(lessonInput, options); break;
        case 'weeklyPlan': result = await generateWeeklyPlan(lessonInput, options.weekNum, options, options.unit, options.topic); break;
        case 'notes': result = await generateEduNotes(lessonInput, options); break;
        case 'suggest': result = await suggestWeeklyInput(lessonInput as any, options, options.weekNum); break;
        case 'all': result = await generateEduContent(lessonInput, options); break;
        default: throw new Error(`Unknown generation type: ${type}`);
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Server-side generation error:", error);
      res.status(500).json({ error: error.message || "Internal server error during AI generation" });
    }
  });

  // Image Proxy to solve CORS issues
  app.get("/api/proxy", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).send("URL parameter is required");
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).send(`Error fetching image: ${response.statusText}`);
      }
      
      const contentType = response.headers.get("content-type");
      const buffer = await response.arrayBuffer();

      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Error fetching image");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
