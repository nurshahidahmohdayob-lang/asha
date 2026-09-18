/* ═══════════ What the deck says in its own voice ═════════════════════════
   Translating a lesson translates the lesson — the plan, the week, the pack,
   the teacher's own words. It cannot translate the words the DECK writes for
   itself, because those are not data: "Week 5", "Term 1", "Story time",
   "Before we go", the sentence offered when a teacher left the Do Now blank.
   Those are literals inside buildWeekSlides, so a deck switched to Bahasa
   Melayu came out as Malay content wearing English furniture.

   They live here instead, in each language the deck can be taught in. A fixed
   set of labels is a dictionary, not a translation job: it is instant, costs
   nothing, cannot fail halfway, and cannot come back different on Tuesday.

   The counted ones are functions rather than words to glue together, because
   the glue is not the same in every language. "Week 5" is 第 5 周 — the number
   sits INSIDE the phrase, and no amount of `${week} ${n}` produces that. */

export type DeckLangId = "zh" | "ms";

export type DeckLabels = {
  /* Counted furniture. Functions, so each language places its own number. */
  week: (n: number | string) => string;
  term: (n: number | string) => string;
  activity: (i: number, total: number) => string;
  miniQuiz: (i: number, total: number) => string;
  /** "Teaching 2 of 3" — the label varies, so it is passed in. */
  countOf: (label: string, i: number, total: number) => string;

  /* Slide kickers, in the order the deck uses them. */
  letsBegin: string;
  ourLearningToday: string;
  whatWeAreLearning: string;
  askYourPartner: string;
  storyTime: string;
  thinkAboutTheStory: string;
  actItOut: string;
  drawIt: string;
  matchIt: string;
  whatCanWeDo: string;
  letsRemember: string;
  beforeWeGo: string;
  wellDone: string;
  moreThanTheLesson: string;
  letsLearn: string;

  /* Section labels. */
  teaching: string;
  assessment: string;
  doNow: string;
  ourValue: string;
  competency: string;

  /* Prose the deck writes when the teacher left a field blank. */
  doNowYoung: (focus: string) => string;
  doNowOlder: (focus: string) => string;
  likeAbout: (thing: string) => string;
  thinkAbout: (thing: string) => string;
  feelingToday: string;
  areYouOkay: string;
  madeYouSmile: string;
  getBetterAt: string;

  /* Exit ticket. */
  todayILearned: string;
  iLiked: string;
  nextTimeIWantToTry: string;
  iShowed: (competency: string) => string;
  oneThingToImprove: string;
  somethingTricky: string;

  /* Headings and captions written into the slides themselves. These are the
     biggest words on a projected board, so leaving them English undoes most of
     the point of translating the lesson at all. */
  talkTime: string;
  today: string;
  whatWereLearning: string;
  knowWhenDone: string;
  tapEachOne: string;
  turnToYourPartner: string;
  tapAQuestion: string;
  thinkAboutIt: string;
  letsThinkAboutStory: string;
  draw: string;
  tryIt: string;
  finishOneOfThese: string;
  whatWeGrewToday: string;
  notJustWhatWeLearned: string;
  questionLabel: string;
  sentenceLabel: string;

  /** The scheme of work's competency and value names. Empty for English,
   *  where the name already IS the English name. */
  vocab: Record<string, string>;
};

const EN: DeckLabels = {
  week: (n) => `Week ${n}`,
  term: (n) => `Term ${n}`,
  activity: (i, total) => `Activity ${i} of ${total}`,
  miniQuiz: (i, total) => `Mini quiz · ${i} of ${total}`,
  countOf: (label, i, total) => `${label} ${i} of ${total}`,

  letsBegin: "Let's begin",
  ourLearningToday: "Our learning today",
  whatWeAreLearning: "What we are learning",
  askYourPartner: "Ask your partner",
  storyTime: "Story time",
  thinkAboutTheStory: "Think about the story",
  actItOut: "Act it out",
  drawIt: "Draw it",
  matchIt: "Match it",
  whatCanWeDo: "What can we do?",
  letsRemember: "Let's remember",
  beforeWeGo: "Before we go",
  wellDone: "Well done",
  moreThanTheLesson: "More than the lesson",
  letsLearn: "Let's learn",

  teaching: "Teaching",
  assessment: "Assessment",
  doNow: "Do now",
  ourValue: "Our value",
  competency: "Competency",

  doNowYoung: (focus) =>
    `Today we are learning about ${focus}. Tell your partner one thing you know.`,
  doNowOlder: (focus) =>
    `Think about today's topic — "${focus}". Tell your partner one thing you already know, or one thing you'd like to find out.`,
  likeAbout: (thing) => `Tell me what you like about ${thing}.`,
  thinkAbout: (thing) => `What do you think about ${thing}?`,
  feelingToday: "How are you feeling today?",
  areYouOkay: "Are you okay?",
  madeYouSmile: "What made you smile today?",
  getBetterAt: "What would you like to get better at?",

  todayILearned: "Today I learned…",
  iLiked: "I liked…",
  nextTimeIWantToTry: "Next time I want to try…",
  iShowed: (c) => `I showed ${c} today when I…`,
  oneThingToImprove: "One thing I want to get better at is…",
  somethingTricky: "Something I found tricky was… and I kept going by…",

  talkTime: "Talk time",
  today: "Today",
  whatWereLearning: "What we're learning",
  knowWhenDone: "We'll know we've done it when…",
  tapEachOne: "tap each one as we get there",
  turnToYourPartner: "Turn to your partner",
  tapAQuestion: "Tap a question and ask them. Listen to their answer, then swap over.",
  thinkAboutIt: "Think about it",
  letsThinkAboutStory: "Let's think about the story",
  draw: "Draw",
  tryIt: "Try it",
  finishOneOfThese: "Finish one of these sentences out loud or in your journal.",
  whatWeGrewToday: "What we grew today",
  notJustWhatWeLearned: "Not just what we learned — what we practised being",
  questionLabel: "question",
  sentenceLabel: "sentence",

  vocab: {},
};

/** The scheme of work's twelve names, so a competency badge reads in the same
 *  language as the slide it sits on. Kept beside the labels because they are
 *  the same kind of thing: a fixed vocabulary the school owns, not prose. */
const VOCAB_MS: Record<string, string> = {
  Communication: "Komunikasi",
  "Learning to Learn": "Belajar untuk Belajar",
  Authenticity: "Keaslian",
  Resilience: "Daya Tahan",
  Collaboration: "Kolaborasi",
  "Social Responsibility": "Tanggungjawab Sosial",
  "Open-mindedness": "Keterbukaan Minda",
  Sustainability: "Kelestarian",
  "Critical Thinking": "Pemikiran Kritis",
  "Creative Thinking": "Pemikiran Kreatif",
  Excellence: "Kecemerlangan",
  Zealous: "Bersemangat",
};

const VOCAB_ZH: Record<string, string> = {
  Communication: "沟通",
  "Learning to Learn": "学会学习",
  Authenticity: "真诚",
  Resilience: "韧性",
  Collaboration: "协作",
  "Social Responsibility": "社会责任",
  "Open-mindedness": "开放心态",
  Sustainability: "可持续发展",
  "Critical Thinking": "批判性思维",
  "Creative Thinking": "创造性思维",
  Excellence: "卓越",
  Zealous: "热忱",
};

const MS: DeckLabels = {
  week: (n) => `Minggu ${n}`,
  term: (n) => `Penggal ${n}`,
  activity: (i, total) => `Aktiviti ${i} daripada ${total}`,
  miniQuiz: (i, total) => `Kuiz mini · ${i} daripada ${total}`,
  countOf: (label, i, total) => `${label} ${i} daripada ${total}`,

  letsBegin: "Mari kita mula",
  ourLearningToday: "Pembelajaran kita hari ini",
  whatWeAreLearning: "Apa yang kita pelajari",
  askYourPartner: "Tanya rakan anda",
  storyTime: "Masa bercerita",
  thinkAboutTheStory: "Fikirkan tentang cerita itu",
  actItOut: "Lakonkan",
  drawIt: "Lukiskan",
  matchIt: "Padankan",
  whatCanWeDo: "Apa yang boleh kita lakukan?",
  letsRemember: "Mari kita ingat",
  beforeWeGo: "Sebelum kita tamat",
  wellDone: "Syabas",
  moreThanTheLesson: "Lebih daripada pelajaran",
  letsLearn: "Mari kita belajar",

  teaching: "Pengajaran",
  assessment: "Pentaksiran",
  doNow: "Buat sekarang",
  ourValue: "Nilai kita",
  competency: "Kompetensi",

  doNowYoung: (focus) =>
    `Hari ini kita belajar tentang ${focus}. Beritahu rakan anda satu perkara yang anda tahu.`,
  doNowOlder: (focus) =>
    `Fikirkan tentang topik hari ini — "${focus}". Beritahu rakan anda satu perkara yang anda sudah tahu, atau satu perkara yang anda ingin tahu.`,
  likeAbout: (thing) => `Beritahu saya apa yang anda suka tentang ${thing}.`,
  thinkAbout: (thing) => `Apa pendapat anda tentang ${thing}?`,
  feelingToday: "Bagaimana perasaan anda hari ini?",
  areYouOkay: "Adakah anda okey?",
  madeYouSmile: "Apa yang membuat anda tersenyum hari ini?",
  getBetterAt: "Apa yang anda ingin perbaiki?",

  todayILearned: "Hari ini saya belajar…",
  iLiked: "Saya suka…",
  nextTimeIWantToTry: "Lain kali saya mahu cuba…",
  iShowed: (c) => `Saya menunjukkan ${c} hari ini apabila saya…`,
  oneThingToImprove: "Satu perkara yang saya mahu perbaiki ialah…",
  somethingTricky: "Sesuatu yang saya rasa sukar ialah… dan saya terus mencuba dengan…",

  talkTime: "Masa berbual",
  today: "Hari ini",
  whatWereLearning: "Apa yang kita pelajari",
  knowWhenDone: "Kita tahu kita berjaya apabila…",
  tapEachOne: "ketik setiap satu apabila kita sampai",
  turnToYourPartner: "Berpaling kepada rakan anda",
  tapAQuestion: "Ketik satu soalan dan tanya mereka. Dengar jawapan mereka, kemudian bertukar.",
  thinkAboutIt: "Fikirkannya",
  letsThinkAboutStory: "Mari kita fikirkan cerita itu",
  draw: "Lukis",
  tryIt: "Cuba",
  finishOneOfThese: "Lengkapkan salah satu ayat ini dengan kuat atau dalam jurnal anda.",
  whatWeGrewToday: "Apa yang kita kembangkan hari ini",
  notJustWhatWeLearned: "Bukan sekadar apa yang kita pelajari — tetapi apa yang kita amalkan",
  questionLabel: "soalan",
  sentenceLabel: "ayat",

  vocab: VOCAB_MS,
};

const ZH: DeckLabels = {
  // The number sits inside the phrase, which is the whole reason these are
  // functions and not words glued together.
  week: (n) => `第 ${n} 周`,
  term: (n) => `第 ${n} 学期`,
  activity: (i, total) => `活动 ${i} / ${total}`,
  miniQuiz: (i, total) => `小测验 · ${i} / ${total}`,
  countOf: (label, i, total) => `${label} ${i} / ${total}`,

  letsBegin: "开始吧",
  ourLearningToday: "我们今天的学习",
  whatWeAreLearning: "我们在学什么",
  askYourPartner: "问问你的同伴",
  storyTime: "故事时间",
  thinkAboutTheStory: "想一想这个故事",
  actItOut: "演出来",
  drawIt: "画出来",
  matchIt: "配对",
  whatCanWeDo: "我们能做什么？",
  letsRemember: "我们来回顾",
  beforeWeGo: "结束之前",
  wellDone: "做得好",
  moreThanTheLesson: "不只是这堂课",
  letsLearn: "我们来学习",

  teaching: "教学",
  assessment: "评估",
  doNow: "现在就做",
  ourValue: "我们的价值观",
  competency: "能力",

  doNowYoung: (focus) => `今天我们学习${focus}。告诉你的同伴一件你知道的事。`,
  doNowOlder: (focus) =>
    `想一想今天的主题——“${focus}”。告诉你的同伴一件你已经知道的事，或者一件你想知道的事。`,
  likeAbout: (thing) => `告诉我你喜欢${thing}的什么。`,
  thinkAbout: (thing) => `你觉得${thing}怎么样？`,
  feelingToday: "你今天感觉怎么样？",
  areYouOkay: "你还好吗？",
  madeYouSmile: "今天什么让你微笑了？",
  getBetterAt: "你想在哪方面进步？",

  todayILearned: "今天我学到了…",
  iLiked: "我喜欢…",
  nextTimeIWantToTry: "下次我想试试…",
  iShowed: (c) => `今天我展现了${c}，当我…`,
  oneThingToImprove: "我想进步的一件事是…",
  somethingTricky: "我觉得有点难的是…，我靠…坚持了下来",

  talkTime: "交流时间",
  today: "今天",
  whatWereLearning: "我们在学什么",
  knowWhenDone: "当我们做到这些时，就知道学会了…",
  tapEachOne: "做到一项就点一下",
  turnToYourPartner: "转向你的同伴",
  tapAQuestion: "点一个问题问问他们。听听他们的回答，然后交换。",
  thinkAboutIt: "想一想",
  letsThinkAboutStory: "我们来想一想这个故事",
  draw: "画一画",
  tryIt: "试一试",
  finishOneOfThese: "大声说出或在日记本上完成其中一个句子。",
  whatWeGrewToday: "今天我们的成长",
  notJustWhatWeLearned: "不只是我们学到了什么——还有我们练习成为什么样的人",
  questionLabel: "问题",
  sentenceLabel: "句子",

  vocab: VOCAB_ZH,
};

const BY_ID: Record<DeckLangId, DeckLabels> = { zh: ZH, ms: MS };

/** The deck's own words in the language it is being taught in. An unknown or
 *  absent language is English — the language the lesson was written in. */
export function deckLabels(lang?: string | null): DeckLabels {
  return (lang && BY_ID[lang as DeckLangId]) || EN;
}

/** One scheme-of-work name — a competency or a value — in the deck's language.
 *  Anything the vocabulary does not know is returned untouched, which is what
 *  keeps a teacher's own wording safe. */
export function schemeName(name: string, labels: DeckLabels): string {
  return labels.vocab[name.trim()] || name;
}

/** A whole Curriculum Link line, translated name by name.
 *
 *  It has to be rebuilt from the ORIGINAL English rather than translated as a
 *  sentence: the line is looked up from the scheme by subject, and once the
 *  subject itself reads "Kompetensi Hidup" that lookup matches nothing and the
 *  line comes back empty. So the deck keeps the English subject for the
 *  lookup and translates the names here. */
export function schemeLine(line: string, labels: DeckLabels): string {
  return line
    .split(" · ")
    .map((group) =>
      group
        .split(", ")
        .map((name) => schemeName(name, labels))
        .join(labels === ZH ? "、" : ", "),
    )
    .join(" · ");
}
