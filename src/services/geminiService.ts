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
  includeStory?: boolean;
  readingProgramOnly?: boolean;
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

    contents.push(mainPrompt);
    contents.push(`Format: JSON object with "slides" (array of {title, type, content, illustrationPrompt}) AND "metadata" (object with "description": string, "methodology": string).
    "methodology": A concise string describing the lesson focus and pedagogical approach (mention Cambridge framework alignment and specific subject code). IF methodology hints were provided in the prompt, expand on them while adhering to them strictly.
    "description": A high-level overview. IF description hints were provided, incorporate them.
    "type" for slides: one of title, content, activity, quiz.
    "illustrationPrompt": A concise string of 3-5 high-quality search keywords for an image.
    "layoutType": (OPTIONAL) suggest one of 'infographic-cards', 'infographic-flow', 'infographic-grid', 'infographic-bubbles' if the content suits a non-list layout, otherwise 'standard'.
    IMPORTANT: 
    1. Do NOT repeat the slide "title" as the first item or any item in the "content" array.
    2. Each content point should be unique, informative, and distinct from the title.
    3. Refer to the Cambridge Subject Code (from the provided list) in the methodology or first slide where appropriate.`);

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

    let mainPrompt = `As an expert Cambridge Educator, generate a worksheet for: "${lessonInput}" with ${options.numQuestions} questions. Subject: ${options.subject}, Year Group: ${options.yearGroup}. Allowed Types: ${options.questionTypes.join(", ")}. ${storyPrompt}`;

    mainPrompt += `\n\nCURRICULUM ALIGNMENT:
    - Align with Cambridge International Framework, Scheme of Work, and official textbooks/references.
    - Reference relevant subject codes and use the OFFICIAL LO CODE FORMAT (Stage+Strand+Number, e.g., 3TC.01) from the following list: ${CAMBRIDGE_CURRICULUM_INFO}
    - Ensure logical progression and high academic terminology consistent with Cambridge standards.
    - CRITICAL: Use the provided subject "${options.subject}" exactly as given. Do not substitute it with a similar subject (e.g. do not change Digital Literacy to Computer Science).`;

    if (options.metadataHints?.description) {
      mainPrompt += `\nIntegration Goal: ${options.metadataHints.description}`;
    }
    if (options.metadataHints?.methodology) {
      mainPrompt += `\nPedagogical Focus: ${options.metadataHints.methodology}`;
    }

    contents.push(mainPrompt);
    contents.push(`Format: JSON object with "title", "readingPassage" (ONLY include this if the topic requires a story or if explicitly requested, otherwise return an empty string ""), "description" (A concise single-sentence summary of the worksheet's theme), "methodology" (A concise string describing the lesson focus and pedagogical methodology - MUST include Cambridge Subject Code, e.g. "Science (0097)"), and "sections" (array of {title, instructions, illustrationPrompt: (ONLY include if relevant), questions: array of {text, type, options: string array or null}}). Incorporation of hints provided in the prompt is mandatory.`);

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

export async function generateReadingProgram(lessonInput: string, options: EduOptions): Promise<ReadingProgram> {
  try {
    const contents: any[] = [];
    contents.push(`As an expert Literacy Specialist and Cambridge Educator, generate a comprehensive READING PROGRAM based on the theme: "${lessonInput}".
      Subject: ${options.subject}, Grade Level: ${options.yearGroup}.
      
      THE PROGRAM SHOULD INCLUDE:
      1. A clear title and description.
      2. A specific focus area (e.g., Phonics, Comprehension, Fluency, or Literature Appreciation).
      3. A duration (e.g., 4 weeks).
      4. 4-6 specific weekly goals.
      5. 3-5 recommended books with Lexile levels, summaries, themes, vocabulary, and 3 comprehension questions each.
      6. Weekly milestones (what the students should achieve and specific tasks for each week).
      
      Format: JSON object with "title", "description", "gradeLevel", "focusArea", "duration", "weeklyGoals" (string array), "recommendedBooks" (array of {title, author, lexileLevel, summary, themes, vocabulary, comprehensionQuestions}), and "milestones" (array of {week, objective, task}).`);

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents.map(c => ({ text: c })) },
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
            }
          },
          required: ["title", "description", "weeklyGoals", "recommendedBooks", "milestones"]
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

export async function generateLessonPlan(lessonInput: string, options: EduOptions): Promise<LessonPlan> {
  try {
    const contents: any[] = [];
    const mainPrompt = `As an expert Cambridge Educator, create a professional, detailed 6-WEEK Lesson Plan for a ${options.yearGroup} class.
      
      STANDARDS & FRAMEWORK:
      - Use the provided subject "${options.subject}" exactly as given. Do not substitute it with a similar subject (e.g. do not change Digital Literacy to Computer Science).
      - Base the content strictly on the Cambridge International Curriculum (CAIE/Cambridge Primary/Lower Secondary).
      - Align objectives with official Cambridge Framework Learning Objectives using the Stage+Strand+Number format (e.g., 3TC.01, 3Rf.04).
      - Incorporate methodology consistent with Cambridge Schemes of Work (SoW).
      - Reference relevant subject codes and strand initials from the following list: ${CAMBRIDGE_CURRICULUM_INFO}
      - Follow the official framework, scheme of work, and textbook/reference materials.
      
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
      - "subject": string (MUST include Cambridge Code, e.g., "Science (0097)")
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
        - "resources": string (Include relevant Cambridge Learning Standard codes)
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
    // Parallel generation for maximum speed
    const [slidesRes, worksheet, readingProgram] = await Promise.all([
      generateSlides(lessonInput, options),
      generateWorksheet(lessonInput, options),
      generateReadingProgram(lessonInput, options)
    ]);

    return {
      lessonTitle: lessonInput,
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
