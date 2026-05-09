import { GoogleGenAI, Type } from "@google/genai";
import { EduContent, SlideContent, WorksheetSection, PosterContent, LessonPlan, WeeklyPlan } from "../types";

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
  includeStory?: boolean;
  posterOnly?: boolean;
  templateMode?: 'strict' | 'custom';
  metadataHints?: { description?: string, methodology?: string };
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
}

export async function generateSlides(lessonInput: string, options: EduOptions): Promise<{ slides: SlideContent[], metadata: { description: string, methodology: string } }> {
  try {
    const contents: any[] = [];
    if (options.fileContext) {
      contents.push({ inlineData: options.fileContext });
    }

    let mainPrompt = options.templateMode === 'strict'
      ? `Generate educational slides for the topic: "${lessonInput}". Subject: ${options.subject}, Year Group: ${options.yearGroup}.`
      : `Generate exactly ${options.numSlides} educational slides for: "${lessonInput}". Subject: ${options.subject}, Year Group: ${options.yearGroup}, ${options.lexileLevel !== 'None' ? `Lexile: ${options.lexileLevel}` : ''}.`;

    if (options.metadataHints?.description) {
      mainPrompt += `\nLesson Description/Goal: ${options.metadataHints.description}`;
    }
    if (options.metadataHints?.methodology) {
      mainPrompt += `\nPedagogical Methodology to follow: ${options.metadataHints.methodology}`;
    }

    contents.push(mainPrompt);
    contents.push(`Format: JSON object with "slides" (array of {title, type, content, illustrationPrompt}) AND "metadata" (object with "description": string, "methodology": string).
    "methodology": A concise string describing the lesson focus and pedagogical approach. IF methodology hints were provided in the prompt, expand on them while adhering to them strictly.
    "description": A high-level overview. IF description hints were provided, incorporate them.
    "type" for slides: one of title, content, activity, quiz.
    "illustrationPrompt": A concise string of 3-5 high-quality search keywords for an image.
    "layoutType": (OPTIONAL) suggest one of 'infographic-cards', 'infographic-flow', 'infographic-grid', 'infographic-bubbles' if the content suits a non-list layout, otherwise 'standard'.
    IMPORTANT: 
    1. Do NOT repeat the slide "title" as the first item or any item in the "content" array.
    2. Each content point should be unique, informative, and distinct from the title.`);

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents.map(c => typeof c === 'string' ? { text: c } : c) },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            metadata: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                methodology: { type: Type.STRING }
              },
              required: ["description", "methodology"]
            },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  type: { type: Type.STRING },
                  content: { type: Type.ARRAY, items: { type: Type.STRING } },
                  illustrationPrompt: { type: Type.STRING },
                  layoutType: { type: Type.STRING }
                },
                required: ["title", "type", "content", "illustrationPrompt"]
              }
            }
          },
          required: ["metadata", "slides"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text);
  } catch (err: any) {
    if (typeof window !== 'undefined' && (err.message?.includes('API Key') || err.message?.includes('configured'))) {
      return callAiProxy('slides', lessonInput, options);
    }
    throw err;
  }
}

export async function generateWorksheet(lessonInput: string, options: EduOptions, slideContext?: SlideContent[]): Promise<{ title: string; readingPassage?: string; description?: string; methodology?: string; sections: WorksheetSection[] }> {
  try {
    const contents: any[] = [];
    if (options.fileContext) {
      contents.push({ inlineData: options.fileContext });
    }
    
    const storyPrompt = options.includeStory 
      ? `IMPORTANT: Start by writing a short story or reading passage (around 300-500 words) about "${lessonInput}" suitable for ${options.yearGroup} students. Include this story in the "readingPassage" field.`
      : "";

    if (slideContext) {
      contents.push(`CONTEXT FROM SLIDES: ${JSON.stringify(slideContext.map(s => ({ title: s.title, content: s.content })))}`);
      contents.push(`IMPORTANT: The worksheet should directly complement and assess the material presented in these slides.`);
    }

    let mainPrompt = `Generate a worksheet for: "${lessonInput}" with ${options.numQuestions} questions. Subject: ${options.subject}, Year Group: ${options.yearGroup}. Allowed Types: ${options.questionTypes.join(", ")}. ${storyPrompt}`;

    if (options.metadataHints?.description) {
      mainPrompt += `\nIntegration Goal: ${options.metadataHints.description}`;
    }
    if (options.metadataHints?.methodology) {
      mainPrompt += `\nPedagogical Focus: ${options.metadataHints.methodology}`;
    }

    contents.push(mainPrompt);
    contents.push(`Format: JSON object with "title", "readingPassage" (ONLY include this if the topic requires a story or if explicitly requested, otherwise return an empty string ""), "description" (A concise single-sentence summary of the worksheet's theme), "methodology" (A concise string describing the lesson focus and pedagogical methodology), and "sections" (array of {title, instructions, illustrationPrompt: (ONLY include if relevant), questions: array of {text, type, options: string array or null}}). Incorporation of hints provided in the prompt is mandatory.`);

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents.map(c => typeof c === 'string' ? { text: c } : c) },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            readingPassage: { type: Type.STRING },
            description: { type: Type.STRING },
            methodology: { type: Type.STRING },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  instructions: { type: Type.STRING },
                  illustrationPrompt: { type: Type.STRING },
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        text: { type: Type.STRING },
                        type: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } }
                      },
                      required: ["text", "type"]
                    }
                  }
                },
                required: ["title", "instructions", "questions"]
              }
            }
          },
          required: ["title", "sections"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text);
  } catch (err: any) {
    if (typeof window !== 'undefined' && (err.message?.includes('API Key') || err.message?.includes('configured'))) {
      return callAiProxy('worksheet', lessonInput, { ...options, slideContext });
    }
    throw err;
  }
}

export async function generatePoster(lessonInput: string, description: string, options: EduOptions): Promise<PosterContent> {
  try {
    const contents: any[] = [];
    contents.push(`As a world-class graphic designer for educational media (e.g., Book Week posters, Earth Day campaigns), generate content for a STUNNING, MULTI-LAYERED classroom poster about: "${lessonInput}".
      Style: "${description}".
      
      CRITICAL DESIGN REQUIREMENTS:
      1. Title: Large, bold, and iconic.
      2. SubTitle: A catchy secondary hook.
      3. KeyPoints: 4 punchy, informative points (max 6 words each).
      4. Summary: A short (1 sentence) inspiring takeaway.
      5. CtaText: A bold call to action (e.g., "READ. DREAM. DISCOVER" or "LET'S SAVE OUR PLANET").
      6. IllustrationPrompt: Describe a FULL SCENE. Request "no text" in the image. Use keywords: "whimsical illustration", "high-end digital art", "textured watercolor", "vibrant collage", "multiple focal points".
      7. ColorPalette: 5 high-contrast, trendy HEX codes.
      
      Format: JSON {title, subTitle, keyPoints, summary, ctaText, illustrationPrompt, colorPalette}.`);

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents.map(c => ({ text: c })) },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subTitle: { type: Type.STRING },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary: { type: Type.STRING },
            ctaText: { type: Type.STRING },
            illustrationPrompt: { type: Type.STRING },
            colorPalette: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "keyPoints", "summary", "illustrationPrompt", "colorPalette"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text);
  } catch (err: any) {
    if (typeof window !== 'undefined' && (err.message?.includes('API Key') || err.message?.includes('configured'))) {
      return callAiProxy('poster', lessonInput, options);
    }
    throw err;
  }
}

export async function generateLessonPlan(lessonInput: string, options: EduOptions): Promise<LessonPlan> {
  try {
    const contents: any[] = [];
    const mainPrompt = `As an expert Cambridge Educator, create a professional, detailed 6-WEEK Lesson Plan for a ${options.yearGroup} class.
      
      STANDARDS & FRAMEWORK:
      - Base the content strictly on the Cambridge International Curriculum (CAIE/Cambridge Primary/Lower Secondary).
      - Align objectives with Cambridge Framework Learning Objectives.
      - Incorporate methodology consistent with Cambridge Schemes of Work (SoW).
      
      6-WEEK TERM OVERVIEW:
      The teacher may have provided some specific units/topics. For any week left blank or marked 'Auto-assign', you MUST generate a logical, curriculum-appropriate progression based on the overall subject and description.
      
      Provided Inputs:
      ${[0, 1, 2, 3, 4, 5].map(i => {
        const u = options.unit?.[i];
        const t = options.topics?.[i];
        return `Week ${i + 1}: ${u ? `[Unit: ${u}]` : '[Unit: Auto-assign]'} ${t ? `Topic: ${t}` : 'Topic: Auto-assign'}`;
      }).join('\n')}

      ADDITIONAL DESCRIPTION/GOALS:
      ${lessonInput}

      Format the response as a JSON object with:
      - "term": "${options.term || ''}"
      - "subject": "${options.subject || ''}"
      - "duration": "${options.duration || ''}"
      - "date": "${options.date || ''}"
      - "academicYear": "${options.academicYear || ''}"
      - "class": "${options.class || ''}"
      - "preparedBy": "${options.preparedBy || ''}"
      - "checkedBy": "${options.checkedBy || ''}"
      - "overallTopic": A comprehensive title for the 6-week term unit
      - "weeklyBreakdown": Array of exactly 6 objects, each with:
        - "week": number (1-6)
        - "unit": string (The Cambridge curriculum unit number and title)
        - "topic": string (based on the weekly topics provided)
        - "strand": string (the curriculum strand)
        - "learningObjective": string (one clear, numbered learning objective, e.g., "1. Identify the parts of a plant")
        - "introduction": string (detailed overview of what this topic is about)
        - "activities": string (specific activities that the teacher can do for this topic. Be very detailed and write complete sentences.)
        - "assessment": string (what worksheet, quiz, exam or activity for this topic. Be very detailed and write complete sentences.)
        - "resources": string (Unit #, Learning Standard code, and placeholders for slide/worksheet links)
    `;
    contents.push(mainPrompt);

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents.map(c => ({ text: c })) },
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
    
    TASK:
    Return ONLY a single concise ${type} suggestion. No explanation, no quotes.
    ${type === 'activity' ? 'Ensure the activity is hands-on or highly engaging for this age group.' : ''}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
      - Base the content strictly on the Cambridge International Curriculum.
      - Align objectives with Cambridge Framework Learning Objectives.
      - Incorporate methodology consistent with Cambridge Schemes of Work (SoW).
      
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
      model: "gemini-3-flash-preview",
      contents: { parts: contents.map(c => ({ text: c })) },
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
    // If poster only, we just generate that
    if (options.posterOnly) {
      const poster = await generatePoster(lessonInput, "Visually engaging classroom poster", options);
      return {
        lessonTitle: lessonInput,
        subject: options.subject,
        gradeLevel: options.yearGroup,
        slides: [],
        worksheet: { title: "", sections: [] },
        poster,
        metadata: { yearGroup: options.yearGroup, lexileLevel: options.lexileLevel, subject: options.subject }
      };
    }

    // Parallel generation for maximum speed
    const [slidesRes, worksheet, poster] = await Promise.all([
      generateSlides(lessonInput, options),
      generateWorksheet(lessonInput, options),
      generatePoster(lessonInput, "Educational poster summarizing the key concepts", options)
    ]);

    return {
      lessonTitle: lessonInput,
      subject: options.subject,
      gradeLevel: options.yearGroup,
      slides: slidesRes.slides,
      slidesMetadata: slidesRes.metadata,
      worksheet,
      poster,
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
