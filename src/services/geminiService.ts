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

export async function generateWorksheet(lessonInput: string, options: EduOptions, slideContext?: SlideContent[]): Promise<{ title: string; readingPassage?: string; leveledPassages?: Record<string, string>; description?: string; methodology?: string; sections: WorksheetSection[] }> {
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

    if (slideContext) {
      contents.push(`CONTEXT FROM SLIDES: ${JSON.stringify(slideContext.map(s => ({ title: s.title, content: s.content })))}`);
      contents.push(`IMPORTANT: The worksheet should directly complement and assess the material presented in these slides.`);
    }

    let mainPrompt = options.readingPassageOnly
      ? `As an expert Cambridge Educator, generate a high-quality READING PASSAGE only (around ${requestedWorksheetPassageWordCount}) for: "${lessonInput}". 
         Subject: ${options.subject}, Year Group: ${options.yearGroup}, Lexile: ${options.lexileLevel}.
         The passage should be informative, engaging, and strictly follow the Lexile level complexity. 
         DO NOT generate any assessment questions or sections. Return exactly one empty section to satisfy the schema.`
      : `As an expert Cambridge Educator, generate a worksheet for: "${lessonInput}" with ${options.numQuestions} questions. Subject: ${options.subject}, Year Group: ${options.yearGroup}. Allowed Types: ${options.questionTypes.join(", ")}. ${storyPrompt}`;

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
    contents.push(`Format: JSON object with "title", "readingPassage" (The main content if readingPassageOnly, or the context story if includeStory), "description" (A concise single-sentence summary), "methodology" (MUST include Cambridge Subject Code), and "sections" (array of {title, instructions, questions: array of {text, type, options}}). If readingPassageOnly is true, sections should contain exactly one placeholder entry if necessary to satisfy the schema, and no questions.`);

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
      return callAiProxy('sessionPlan', topic, { ...options, subtopics, weeks });
    }
    throw err;
  }
}

export async function generateLessonPlan(lessonInput: string, options: EduOptions): Promise<LessonPlan> {
  try {
    const contents: any[] = [];
    const weekCount = options.topics?.length || 6;
    const mainPrompt = `As an expert Cambridge Educator, create a professional, detailed ${weekCount}-WEEK Lesson Plan for a ${options.yearGroup} class.
      
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
      model: "gemini-3-flash-preview",
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

export async function relevelReadingPassage(passage: string, targetLexile: string, subject: string, yearGroup: string, targetWordCount?: string): Promise<{ readingPassage: string }> {
  try {
    let mainPrompt = `You are an expert Cambridge Educator and literacy developer.
    We have an existing reading passage on a specific topic.
    We need you to rewrite this EXACT SAME reading passage so that it aligns strictly with a different Lexile level and target audience.

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
    4. Do not include any introduction, notes, or extra sections, just the rewritten reading passage text itself. Keep safety and educational standards high.
    5. HTML formatting can be used for paragraphs if the source passage had HTML structure, but standard text or HTML formatting is expected.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [{ text: mainPrompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            readingPassage: { type: Type.STRING, description: "The complete rewritten reading passage text matching the target Lexile complexity." }
          },
          required: ["readingPassage"]
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
