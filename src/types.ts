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
    type: 'short-answer' | 'multiple-choice' | 'matching' | 'fill-in-the-blanks';
    options?: string[];
  }[];
}

export interface FontSettings {
  family?: string;
  size?: number;
  color?: string;
  weight?: string;
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

export interface PosterContent {
  title: string;
  titleSettings?: FontSettings;
  subTitle?: string;
  subTitleSettings?: FontSettings;
  keyPoints: string[];
  summary: string;
  summarySettings?: FontSettings;
  ctaText?: string;
  ctaSettings?: FontSettings;
  illustrationPrompt: string;
  colorPalette?: string[];
  visualStyle?: string;
  icons?: string[];
  customImages?: Record<string, string>;
  stickers?: Sticker[];
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
    description?: string;
    methodology?: string;
    sections: WorksheetSection[];
  };
  poster?: PosterContent;
  lessonPlan?: LessonPlan;
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
}
