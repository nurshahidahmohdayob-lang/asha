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

export interface WeeklyPlan {
  week: number;
  unit: string;
  topic: string;
  learningObjective: string;
  strand: string;
  introduction: string;
  activities: string;
  assessment: string;
  resources: string;
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
    | 'candy';
  /** Title color override for designs where the title sits on a colored
   *  surface (e.g. the band header). Falls back to accentColor. */
  titleColor?: string;
}
