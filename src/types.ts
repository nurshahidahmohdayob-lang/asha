export interface SlideImage {
  id: string;
  url?: string;
  shape?: 'square' | 'circle' | 'triangle' | 'star';
  color?: string;
  x: number;
  y: number;
  size: number;
  rotation?: number;
}

export interface SlideContent {
  type: 'title' | 'content' | 'objective' | 'activity' | 'assessment';
  layoutType?: 'standard' | 'infographic-cards' | 'infographic-flow' | 'infographic-grid' | 'infographic-bubbles';
  title: string;
  titleSettings?: FontSettings;
  content: string[];
  bulletSettings?: FontSettings;
  individualBulletSettings?: (FontSettings | undefined)[];
  description?: string;
  illustrationPrompt?: string;
  imageUrl?: string;
  backgroundColor?: string;
  backgroundWallpaper?: string;
  images?: SlideImage[];
}

/** One question in the projected mini quiz. Unlike worksheet questions these
 *  record which option is right, so the class can be marked on the board. */
export interface QuizQuestion {
  text: string;
  options: string[];
  /** Index into `options` of the correct choice. */
  correctIndex: number;
  /** One line the teacher can read out after the answer is revealed. */
  why?: string;
}

/** A labelled picture tile — the deck's unit of "show, don't write". */
export interface LessonTile {
  /** A single emoji. Read from the back of a classroom; never fails to load. */
  emoji: string;
  label: string;
  /** An uploaded picture shown instead of the emoji. A URL, never base64. */
  image?: string;
}

/** One concept, taught on its own slide — the substance of the lesson. This
 *  is what makes the deck teachable rather than a list of games: a big
 *  picture, the point in child's words, examples, and a question to the class. */
export interface LessonTeachPoint {
  emoji: string;
  /** A picture to show instead of the emoji. A URL, never base64 — the pack
   *  is saved with the project and an inline image would blow the document
   *  size limit. */
  image?: string;
  /** "I Feel Happy!" — spoken in the child's own voice where it suits. */
  title: string;
  /** 1-3 sentences that actually teach the point. */
  lines: string[];
  /** Optional supporting pictures: what to do, examples, non-examples. */
  tiles?: LessonTile[];
  /** "What makes YOU happy?" — turns the slide over to the class. */
  ask?: string;
}

/** Everything class-facing for one week of the plan: what to discuss, a story
 *  to tell, things to do, and a quiz to check it landed. Generated once and
 *  kept with the project, so the same lesson projects the same way twice.
 *  Every part is optional except the quiz and discussion — a lesson that
 *  suits no story simply gets no story slide. */
export interface LessonActivityPack {
  /** Which week of the plan this was built for. */
  week: number;
  discussion: string[];
  questions: QuizQuestion[];
  /** The handful of things being taught, as picture tiles. */
  keyIdeas?: LessonTile[];
  /** "What are feelings?" — the idea stated once, plainly, before the detail. */
  bigIdea?: { title: string; explain: string; image?: string };
  /** The teaching itself: one slide per concept. */
  teach?: LessonTeachPoint[];
  /** An ordered change or process — "sad → calm → happy", "seed → sprout → tree". */
  sequence?: { title: string; steps: LessonTile[]; line?: string };
  /** The well-done slide the lesson ends on. */
  celebrate?: { title: string; line: string };
  /** A short story that carries the idea, told a scene at a time. */
  story?: {
    title: string;
    scenes: LessonTile[];
    /** Asked after the story; answers revealed on tap. */
    questions: { q: string; a: string }[];
  };
  /** Tap a word, tap its picture. */
  matching?: { title: string; instruction: string; pairs: LessonTile[] };
  /** Something to perform, picked at random by the spinner. */
  actOut?: { title: string; steps: string[]; items: LessonTile[] };
  /** Draw it — a prompt plus a few example pictures round the edge. */
  draw?: { title: string; instruction: string; examples: string[] };
  /** "What can I do" — strategies the class can practise together. */
  strategies?: { title: string; items: LessonTile[] };
  /** Three closing recall questions for the review slide. */
  review?: string[];
}

/** One piece of evidence that a teacher attended training — the certificate,
 *  photo or letter they were given. Stored as a link to the share host, never
 *  inline, so a year of certificates doesn't bloat the record. */
export interface PDEvidenceFile {
  id: string;
  name: string;
  url: string;
  size: number;
  uploadedAt: number;
}

/** One professional development activity a teacher has completed. */
export interface PDRecord {
  id: string;
  title: string;
  provider?: string;
  kind: 'course' | 'workshop' | 'webinar' | 'conference' | 'in-house' | 'other';
  /** Hours of training this counted for. */
  hours: number;
  /** ISO yyyy-mm-dd. When the training actually happened. */
  dateAttended: string;
  /** ISO yyyy-mm-dd. When the teacher filed the evidence — blank until they do,
   *  which is what makes a record outstanding. */
  dateSubmitted?: string;
  evidence: PDEvidenceFile[];
  notes?: string;
}

/** A teacher's professional development file for the year. */
export interface PDLog {
  /** Hours the school expects in the cycle. */
  targetHours: number;
  /** e.g. "2026" or "2026/27" — what the target is counted against. */
  cycle: string;
  records: PDRecord[];
}

export interface WorksheetSection {
  title: string;
  instructions: string;
  illustrationPrompt?: string;
  imageUrl?: string;
  questions: {
    text: string;
    type:
      | 'short-answer'
      | 'multiple-choice'
      | 'true-false'
      | 'matching'
      | 'fill-in-the-blanks'
      | 'drawing'
      | 'sorting'
      | 'cut-and-paste'
      | 'scenario';
    options?: string[];
    // Sorting questions: the category/column names items are sorted into.
    categories?: string[];
  }[];
}

export interface FontSettings {
  family?: string;
  size?: number;
  color?: string;
  weight?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  isVisible?: boolean;
  rotation?: number;
}

export interface Sticker {
  id: string;
  url?: string;
  text?: string;
  shape?: 'square' | 'circle' | 'triangle' | 'star';
  color?: string;
  x: number;
  y: number;
  size: number;
  rotation?: number;
  fontSettings?: FontSettings;
}

export interface ReadingBook {
  title: string;
  author: string;
  lexileLevel: string;
  summary: string;
  themes: string[];
  vocabulary: string[];
  comprehensionQuestions: string[];
}

export interface OneDayActivity {
  title: string;
  description: string;
  duration: string;
}

export interface OneDayVocab {
  word: string;
  definition: string;
  contextSentence: string;
}

export interface OneDayPlan {
  dayTopic: string;
  passageObjective: string;
  questions: { question: string; answer?: string }[];
  vocabulary: OneDayVocab[];
  activities: OneDayActivity[];
}

export interface ReadingProgram {
  title: string;
  description: string;
  gradeLevel: string;
  focusArea: string; // e.g., Phonics, Comprehension, Fluency
  duration: string; // e.g., 4 weeks
  weeklyGoals: string[];
  recommendedBooks: ReadingBook[];
  milestones: {
    week: number;
    objective: string;
    task: string;
  }[];
  readingPassage?: string;
  passageTitle?: string;
  /** The story picture (data URL) used in the interactive HTML — AI-generated,
   *  uploaded, or cropped/edited by the user. */
  passageImage?: string;
  leveledPassages?: Record<string, string>;
  leveledVocabulary?: Record<string, OneDayVocab[]>;
  leveledQuestions?: Record<string, { question: string; answer?: string }[]>;
  /** Differentiated worksheet pack: the SAME questions (same skill, intent
   *  and answer) worded once per Lexile band — no passage, students read
   *  their own book. */
  differentiatedQuestionSets?: {
    book: string;
    levels: string[];
    questions: {
      skill?: string;
      type?: string; // multiple-choice | open-response | drawing | matching
      versions: {
        lexile: string;
        text: string;
        options?: string[];
        pairs?: { left: string; right: string }[];
      }[];
    }[];
  };
  oneDayPlan?: OneDayPlan;
}

export interface LessonResourceAttachment {
  id: string;
  name: string;
  url: string;
  /** Storage path, kept so the file can be deleted when removed. */
  path: string;
  contentType: string;
  size: number;
  uploadedAt: number;
}

/** One taught lesson inside a week.
 *
 *  A subject timetabled three times a week has three of these. The week around
 *  them still carries what they share — unit, topic, learning objective,
 *  curriculum link — so a teacher writes that once rather than three times. */
export interface DayLesson {
  /** Monday–Friday. Free text rather than an enum so a school running a
   *  Saturday or a double period can still say so. */
  day: string;
  /** Optional period or time, e.g. "Period 3" or "08:40–09:20". */
  period?: string;
  /** What this particular lesson covers, within the week's topic. */
  focus?: string;
  introduction?: string;
  activities?: string;
  assessment?: string;
  resources?: string;
}

export interface WeeklyPlan {
  week: number;
  unit: string;
  topic: string;
  /** A narrower slice of the week's topic. */
  subTopic?: string;
  /** Files attached to this week's resources. */
  attachments?: LessonResourceAttachment[];
  learningObjective: string;
  strand: string;
  introduction: string;
  activities: string;
  assessment: string;
  resources: string;
  /** The individual lessons taught this week, for subjects timetabled more
   *  than once. Absent on every plan written before this existed, which is
   *  read as a single lesson using the fields above — so old plans keep
   *  rendering exactly as they did. */
  lessons?: DayLesson[];
}

export interface LessonPlan {
  term: string;
  subject: string;
  duration: string;
  date: string;
  academicYear: string;
  class: string;
  preparedBy: string;
  checkedBy: string;
  overallTopic: string;
  weeklyBreakdown: WeeklyPlan[];
  // Document-view summary + framework sections (optional so older saved plans
  // still render). Bullet-list fields are stored as newline-separated strings.
  subTopic?: string;
  strandSummary?: string;
  learningObjectiveSummary?: string;
  successCriteria?: string;
  essentialQuestions?: string;
  keyCompetencies?: string;
  portfolioEvidence?: string;
  reflection?: string;
}

export interface HandoutMetadata {
  subject?: string;
  yearGroup?: string;
  topic?: string;
  subtopic?: string;
  methodology?: string;
  description?: string;
}

export interface EduContent {
  lessonTitle: string;
  subject: string;
  gradeLevel: string;
  slides: SlideContent[];
  slidesMetadata?: {
    methodology?: string;
    description?: string;
  };
  worksheet?: {
    title: string;
    readingPassage?: string;
    leveledPassages?: Record<string, string>;
    /** Same topic/questions reworded per Lexile band — one full worksheet per
     *  level, for differentiating the same assessment by student reading level. */
    leveledWorksheets?: Record<
      string,
      {
        title: string;
        description?: string;
        readingPassage?: string;
        sections: WorksheetSection[];
      }
    >;
    description?: string;
    methodology?: string;
    sections: WorksheetSection[];
    interactiveSortingGame?: {
      title: string;
      activityNumber: string;
      instruction: string;
      categories: {
        id: string;
        name: string;
        color: string;
      }[];
      items: {
        id: string;
        name: string;
        category: string;
        description?: string;
        iconName?: string;
      }[];
      footerNote?: string;
    };
  };
  readingProgram?: ReadingProgram;
  lessonPlan?: LessonPlan;
  /** Class-facing activities for the week being projected. */
  lessonPack?: LessonActivityPack;
  teachingJournal?: string;
  studentNotes?: string;
  handoutMetadata?: HandoutMetadata;
  metadata: {
    yearGroup: string;
    lexileLevel: string;
    subject: string;
  };
}

export interface AppTheme {
  id: string;
  name: string;
  bgColor: string;
  cardBg: string;
  textColor: string;
  accentColor: string;
  secondaryColor: string;
  patternType: 'dots' | 'waves' | 'stars' | 'clouds' | 'school';
  emoji: string;
  bgImage?: string;
  /** Which slide design template to render — each is a visually distinct
   *  layout, not just a recolor. Defaults to 'blob'. */
  designType?:
    | 'band'
    | 'doodle'
    | 'paper'
    | 'blob'
    | 'gradient'
    | 'clouds'
    | 'chalk'
    | 'minimal'
    | 'notebook'
    | 'neon'
    | 'sticky'
    | 'memphis'
    | 'botanical'
    | 'origami'
    | 'bubbles'
    | 'candy'
    /** The projected Project Lesson look: a white card floating on a Zera
     *  sub-brand colour, a different colour per slide. */
    | 'deck';
  /** Title color override for designs where the title sits on a colored
   *  surface (e.g. the band header). Falls back to accentColor. */
  titleColor?: string;
}
