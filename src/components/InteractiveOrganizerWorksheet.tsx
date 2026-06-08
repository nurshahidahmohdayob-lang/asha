import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, Star, CheckCircle, HelpCircle, RefreshCw, Printer, ArrowRight,
  Heart, Trash2, Scissors, Paintbrush, Smile, Award, ShieldAlert, Check, Play, Volume2
} from "lucide-react";

// Definitions of the 11 interactive elements required:
// • Matching pictures (Interactive connecting lines or select-pairings)
// • Cut-and-paste activities (Digital inventory pool to drag/click and paste into frames)
// • Coloring tasks (SVG or canvas colouring)
// • Labeling pictures (Diagram labeling box drop downs or input fields)
// • Circle the correct answer (Interactive custom rounded selection highlighting)
// • Multiple-choice questions (Pill inputs with response animation)
// • Drag-and-drop matching (Matching key terminology/definitions)
// • Fill-in-the-blanks (Click-to-drop vocabulary elements or typing inputs)
// • True or False (Thumbs-up / Thumbs-down button checks)
// • Click-the-picture activities (Highlight correct illustrated option)
// • Short answer questions (Cute notebook mock text-bubble)
// • Student Name and Date section

interface ThemeContent {
  id: string;
  emoji: string;
  name: string;
  tagline: string;
  bgColor: string;
  accentBg: string; // Tailwind color classes
  borderColor: string;
  textColor: string;
  headerIllustration: string; // Emoji-based illustration grid
  
  // 1. Picture Matching (Key matching)
  pictureMatch: {
    title: string;
    description: string;
    items: { id: string; emoji: string; label: string; matchId: string }[];
    targets: { id: string; label: string }[];
  };

  // 2. Cut and Paste Activity
  cutAndPaste: {
    title: string;
    description: string;
    slots: { id: string; label: string; icon: string; expectedTag: string }[];
    scissorsPool: { id: string; label: string; icon: string; tag: string }[];
  };

  // 3. Coloring Task
  coloring: {
    title: string;
    description: string;
    presetDrawnBorderSvg: string; // We can draw an interactive Canvas or SVG target!
    palette: string[];
  };

  // 4. Diagram Labeling
  labeling: {
    title: string;
    description: string;
    backgroundEmoji: string;
    labelDiagramTitle: string;
    targets: { id: string; name: string; x: string; y: string; answer: string }[];
    optionsPool: string[];
  };

  // 5. Circle Correct Answer
  circleAnswer: {
    title: string;
    question: string;
    options: { text: string; correct: boolean }[];
  };

  // 6. Multiple Choice (MCQ)
  mcq: {
    title: string;
    question: string;
    options: { text: string; isCorrect: boolean }[];
  };

  // 7. Drag-and-drop Term matching
  dragMatching: {
    title: string;
    leftTerms: { id: string; text: string; linkId: string }[];
    rightTerms: { id: string; text: string }[];
  };

  // 8. Fill in the blanks
  fillBlanks: {
    title: string;
    textBefore: string;
    textAfter: string;
    expected: string;
    choices: string[];
  };

  // 9. True or False
  trueFalse: {
    title: string;
    statement: string;
    isTrue: boolean;
  };

  // 10. Click the Picture
  clickPicture: {
    title: string;
    prompt: string;
    options: { id: string; emoji: string; label: string; isCorrect: boolean }[];
  };

  // 11. Short Answer
  shortAnswer: {
    title: string;
    prompt: string;
    placeholder: string;
  };
}

const THEMES: ThemeContent[] = [
  {
    id: "ocean",
    emoji: "🌊",
    name: "Deep Blue Ocean Adventure",
    tagline: "Explore the magical levels of the coral reef and undersea life!",
    bgColor: "bg-amber-50",
    accentBg: "bg-[#E0F2FE]",
    borderColor: "border-[#0284C7]",
    textColor: "text-[#0369A1]",
    headerIllustration: "🐋 🐠 🐙 🦀 🐚 🐬 🐢 🏝️ 🐳 🌊 🐠 🐬 🦑 🐡 🦐",
    
    pictureMatch: {
      title: "🐚 Undersea Picture Match-Up",
      description: "Click a cute ocean dweller on the left, then click its special superpower role on the right!",
      items: [
        { id: "p1", emoji: "🐙", label: "Octopus", matchId: "m1" },
        { id: "p2", emoji: "🐢", label: "Sea Turtle", matchId: "m2" },
        { id: "p3", emoji: "🦈", label: "Great Shark", matchId: "m3" },
      ],
      targets: [
        { id: "m2", label: "Splashes through waves to lay eggs on warm sand" },
        { id: "m3", label: "Apex swimmer with sharp senses and dorsal fin" },
        { id: "m1", label: "Smart explorer with eight arms and clever ink tricks" },
      ]
    },

    cutAndPaste: {
      title: "✂️ Ocean Food Web - Cut & Paste",
      description: "Click an organic item from the Scissor Pool below, then click the correct level bubble to paste it!",
      slots: [
        { id: "s1", label: "Primary Producer (Creates own energy!)", icon: "☀️", expectedTag: "plant" },
        { id: "s2", label: "Big Herbivore (Eats seagrass)", icon: "🌱", expectedTag: "grazer" },
        { id: "s3", label: "Apex Predator (Top of reef!)", icon: "👑", expectedTag: "carnivore" }
      ],
      scissorsPool: [
        { id: "sc1", label: "Scurrying Coral Crab", icon: "🦀", tag: "grazer" },
        { id: "sc2", label: "Undersea Kelp Forest", icon: "🌿", tag: "plant" },
        { id: "sc3", label: "Fierce Megalodon Shark", icon: "🦈", tag: "carnivore" }
      ]
    },

    coloring: {
      title: "🎨 Rainbow Coral Coloring",
      description: "Choose a bright marker below, then click any section of the coral structure to paint it beautifully!",
      presetDrawnBorderSvg: "coral",
      palette: ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#8B5CF6", "#14B8A6"]
    },

    labeling: {
      title: "🐬 Cute Dolphin Anatomy",
      description: "Match the labels to point out the scientific names of a dolphin's body parts:",
      backgroundEmoji: "🐬",
      labelDiagramTitle: "Dolphin Explorer Map",
      targets: [
        { id: "t1", name: "Blowhole (For breathing air!)", x: "28%", y: "22%", answer: "Blowhole" },
        { id: "t2", name: "Dorsal Fin (Keeps underwater balance!)", x: "55%", y: "15%", answer: "Dorsal Fin" },
        { id: "t3", name: "Fluke tail (Pushes swimming force!)", x: "85%", y: "45%", answer: "Tail Fluke" }
      ],
      optionsPool: ["Blowhole", "Dorsal Fin", "Tail Fluke"]
    },

    circleAnswer: {
      title: "⭕ Circle the Liquid Gold",
      question: "Which of these takes up over 70% of the active surface area of planet Earth?",
      options: [
        { text: "Saltwater Oceans & Seas", correct: true },
        { text: "Rocky Desert Sand dunes", correct: false },
        { text: "Giant Arctic Ice Caps", correct: false }
      ]
    },

    mcq: {
      title: "🏆 Ocean General Knowledge Challenge",
      question: "What is the largest living mammal that has ever swum in our ocean depths?",
      options: [
        { text: "The Great Blue Whale", isCorrect: true },
        { text: "The Giant Box Jellyfish", isCorrect: false },
        { text: "The Ancient Whale Shark", isCorrect: false },
        { text: "The Orca Killer Whale", isCorrect: false }
      ]
    },

    dragMatching: {
      title: "🔗 Marine Habitat Connectors",
      leftTerms: [
        { id: "l1", text: "Deep Abyssal Zone", linkId: "r3" },
        { id: "l2", text: "Shallow Coral Reef", linkId: "r1" },
        { id: "l3", text: "Sandy Tide Pools", linkId: "r2" }
      ],
      rightTerms: [
        { id: "r1", text: "Warm sunny zones packed with fish, seaweeds, and bright anemones" },
        { id: "r2", text: "Coastal areas where tide cycles constantly splash the shore" },
        { id: "r3", text: "Pitch black, freezing deep waters with glowing lantern fish" }
      ]
    },

    fillBlanks: {
      title: "✏️ Sea Water Secret Formula",
      textBefore: "Unlike freshwater in garden lakes, sea water tastes extremely",
      textAfter: "because of high concentrations of dissolved sodium minerals.",
      expected: "Salty",
      choices: ["Sweet", "Salty", "Spicy", "Sour"]
    },

    trueFalse: {
      title: "👍 Undersea Fact Analyzer",
      statement: "Baby dolphins are born underwater and can swim almost immediately after birth.",
      isTrue: true
    },

    clickPicture: {
      title: "👁️ Tap-to-Watch: Spotting Mammals",
      prompt: "Find and click the mammal among the sea creatures listed below:",
      options: [
        { id: "c1", emoji: "🐠", label: "Clownfish (Breathes with gills)", isCorrect: false },
        { id: "c2", emoji: "🐳", label: "Blue Whale (Breaths air with lungs)", isCorrect: true },
        { id: "c3", emoji: "🦀", label: "Tide Pool Crab (Exoskeleton)", isCorrect: false }
      ]
    },

    shortAnswer: {
      title: "✍️ Write Your Explorer Journal",
      prompt: "If you could board a yellow submarine to explore the bottom of the Ocean, what mystery monster would you hope to take a selfie with?",
      placeholder: "I would love to search for a giant neon squid that glows in the dark..."
    }
  },
  {
    id: "space",
    emoji: "🚀",
    name: "Outer Space Explorer Quest",
    tagline: "Blast off past the Earth's atmosphere onto high-gravity solar system orbits!",
    bgColor: "bg-indigo-50/70",
    accentBg: "bg-indigo-100",
    borderColor: "border-indigo-600",
    textColor: "text-indigo-800",
    headerIllustration: "🪐 🚀 💫 ☄️ 🛸 🌟 🌠 🌎 🔭 👨‍🚀 🌔 🛰️ 🛸 🔭 🌌",
    
    pictureMatch: {
      title: "🪐 Solar System Orbit Matching",
      description: "Match the interstellar bodies with their famous atmospheric descriptions!",
      items: [
        { id: "p1", emoji: "☀️", label: "The Sun", matchId: "m1" },
        { id: "p2", emoji: "🪐", label: "Saturn", matchId: "m2" },
        { id: "p3", emoji: "🌙", label: "The Earth's Moon", matchId: "m3" },
      ],
      targets: [
        { id: "m2", label: "Famous giant ring systems made of millions of floating ice chunks" },
        { id: "m3", label: "Glows gently at night by reflecting sunlight and controls ocean tides" },
        { id: "m1", label: "Ultra-hot thermonuclear powerhouse of light at the center of orbit" },
      ]
    },

    cutAndPaste: {
      title: "✂️ Cut-and-Paste Celestial Classes",
      description: "Classify space objects by snapping them into the correct conceptual orbit category below!",
      slots: [
        { id: "s1", label: "Gas Giant Planet", icon: "🎈", expectedTag: "gas" },
        { id: "s2", label: "Rocky Inner Planet", icon: "⛰️", expectedTag: "rocky" },
        { id: "s3", label: "Shiny Star System", icon: "✨", expectedTag: "star" }
      ],
      scissorsPool: [
        { id: "sc1", label: "Hot Red Planet Mars", icon: "🔴", tag: "rocky" },
        { id: "sc2", label: "Giant Cold Jupiter", icon: "🌀", tag: "gas" },
        { id: "sc3", label: "Brilliant North Star Polaris", icon: "⭐", tag: "star" }
      ]
    },

    coloring: {
      title: "🎨 Rocket Ship Comic Sketcher",
      description: "Pick your astronaut flag marker colors and turn this heavy rocket booster colorful!",
      presetDrawnBorderSvg: "rocket",
      palette: ["#EF4444", "#3B82F6", "#F59E0B", "#10B981", "#EC4899", "#EAB308", "#374151"]
    },

    labeling: {
      title: "👨‍🚀 Astronaut Spacesuit Labels",
      description: "Can you help our astronauts catalog their safety spacesuit design parts?",
      backgroundEmoji: "👨‍🚀",
      labelDiagramTitle: "Spacesuit Safety Map",
      targets: [
        { id: "t1", name: "Gold Visor (Shields cosmic solar rays)", x: "32%", y: "15%", answer: "Visor" },
        { id: "t2", name: "Oxygen Pack (Supplies breathable air flow)", x: "65%", y: "30%", answer: "Atmosphere Unit" },
        { id: "t3", name: "Magnetic Gravity Boots (Keeps feet attached!)", x: "45%", y: "80%", answer: "Magnetic Boots" }
      ],
      optionsPool: ["Visor", "Atmosphere Unit", "Magnetic Boots"]
    },

    circleAnswer: {
      title: "⭕ Orbit Gravity Circle",
      question: "Which of these is the main holding force keeping the solar system planets orbiting nicely around the Sun?",
      options: [
        { text: "Universal Gravitational Pull", correct: true },
        { text: "Solar Wind Magnetic Waves", correct: false },
        { text: "Asteroid belt bumper impacts", correct: false }
      ]
    },

    mcq: {
      title: "🏆 Astronaut Knowledge Trivia",
      question: "Which solar system planet is famous for being incredibly scorching hot and covered in toxic greenhouse gas?",
      options: [
        { text: "Mercury (closest, but thin atmosphere)", isCorrect: false },
        { text: "Venus (trapped heat blankets)", isCorrect: true },
        { text: "Neptune (icy far ranges)", isCorrect: false },
        { text: "Pluto (dwarf outer status)", isCorrect: false }
      ]
    },

    dragMatching: {
      title: "🔗 Gravity Scale Alignments",
      leftTerms: [
        { id: "l1", text: "Zero Gravity Space", linkId: "r2" },
        { id: "l2", text: "Great Sun Orbit", linkId: "r1" },
        { id: "l3", text: "Earth Gravity Scale", linkId: "r3" }
      ],
      rightTerms: [
        { id: "r1", text: "Extremely high density holding multiple massive planets together over billions of miles" },
        { id: "r2", text: "Where astronauts float around weightless because there are no nearby strong fields" },
        { id: "r3", text: "Comfortable standard pull that keeps tree foliage, waters, and human bodies grounded safely" }
      ]
    },

    fillBlanks: {
      title: "✏️ The Milky Way galaxy",
      textBefore: "Our solar neighborhood resides inside a massive spiral cosmic shape named",
      textAfter: "Galaxy, containing hundreds of billions of shining stars.",
      expected: "Milky Way",
      choices: ["Andromeda", "Milky Way", "Orion Nebula", "Black Hole"]
    },

    trueFalse: {
      title: "👍 Cosmic Soundwave Scanner",
      statement: "Sound waves can travel through vaccum spaces to trigger loud explosions we can hear.",
      isTrue: false
    },

    clickPicture: {
      title: "👁️ Click the Celestial Giant",
      prompt: "Find and click the item representing our solar system's absolute center star:",
      options: [
        { id: "c1", emoji: "🌎", label: "Our Blue Earth", isCorrect: false },
        { id: "c2", emoji: "☀️", label: "The Giant Sun Center", isCorrect: true },
        { id: "c3", emoji: "☄️", label: "Flying Snowy Comet", isCorrect: false }
      ]
    },

    shortAnswer: {
      title: "✍️ Astronaut Log Book entry",
      prompt: "Imagine you discover a green friendly alien living on Mars. What is the very first food or Earth toy you would share with them?",
      placeholder: "I would share a pepperoni pizza slice and a light-up spinning fidget spinner..."
    }
  },
  {
    id: "safari",
    emoji: "🦁",
    name: "Wild Jungle Safari Explorer",
    tagline: "Explore rainforest canopy layers and active African grasslands wildlife!",
    bgColor: "bg-emerald-50",
    accentBg: "bg-emerald-100",
    borderColor: "border-emerald-600",
    textColor: "text-emerald-800",
    headerIllustration: "🦁 🐯 🦒 🐘 🦓 🐒 🦎 🦜 🦛 🐆 🌳 🦋 🐍 🌿 🌴",
    
    pictureMatch: {
      title: "🦁 Grassland Predator Match-Up",
      description: "Align the savannah creatures with their specialized physical traits!",
      items: [
        { id: "p1", emoji: "🦒", label: "Giraffe", matchId: "m1" },
        { id: "p2", emoji: "🐆", label: "Cheetah", matchId: "m2" },
        { id: "p3", emoji: "🐘", label: "Acre Elephant", matchId: "m3" },
      ],
      targets: [
        { id: "m2", label: "Lightning speed sprints enabled by flexible spine and spotted coat" },
        { id: "m3", label: "Huge prehensile trunk used for drinking water and trumpeting calls" },
        { id: "m1", label: "Extremely tall neck designed to nibble nutrient acacia tree crowns" },
      ]
    },

    cutAndPaste: {
      title: "✂️ Jungle Tropic Ecosystem Categories",
      description: "Classify jungle organisms into their correct ecological niche compartments below!",
      slots: [
        { id: "s1", label: "Canopy Tier Dweller", icon: "🦜", expectedTag: "canopy" },
        { id: "s2", label: "Understory Crawlers", icon: "🐜", expectedTag: "understory" },
        { id: "s3", label: "Freshwater Apex", icon: "🐊", expectedTag: "river" }
      ],
      scissorsPool: [
        { id: "sc1", label: "Emerald Canopy Parrot", icon: "🦜", tag: "canopy" },
        { id: "sc2", label: "Leaf Cutter Ant Colony", icon: "🐜", tag: "understory" },
        { id: "sc3", label: "African River Crocodile", icon: "🐊", tag: "river" }
      ]
    },

    coloring: {
      title: "🎨 Wild Chameleon Watercolor",
      description: "Paint our camouflaged chameleon with dazzling tropical rainbow shades!",
      presetDrawnBorderSvg: "chameleon",
      palette: ["#10B981", "#14B8A6", "#10B981", "#EC4899", "#8B5CF6", "#F59E0B", "#EF4444"]
    },

    labeling: {
      title: "🌳 Rainforest Layer Mapping",
      description: "Help our expedition team map out the four official layered tiers of the jungle:",
      backgroundEmoji: "🌳",
      labelDiagramTitle: "Jungle Canopy Map",
      targets: [
        { id: "t1", name: "Emergent Layer (Giant crowns kissing the blue sky)", x: "45%", y: "10%", answer: "Emergent" },
        { id: "t2", name: "Canopy Roof (Dense leaves blocking rain storms)", x: "32%", y: "35%", answer: "Canopy" },
        { id: "t3", name: "Forest Floor (Dark damp soil with recycling bugs)", x: "55%", y: "82%", answer: "Forest Floor" }
      ],
      optionsPool: ["Emergent", "Canopy", "Forest Floor"]
    },

    circleAnswer: {
      title: "⭕ Photosynthesis Sunlight Source",
      question: "Which of these is the main fuel jungle flora use to create sugars and release breathing oxygen?",
      options: [
        { text: "Radiant Golden Sunlight", correct: true },
        { text: "Nighttime Silver Moon waves", correct: false },
        { text: "Volcanic underground heat waves", correct: false }
      ]
    },

    mcq: {
      title: "🏆 Jungle Biodiversity Trivia",
      question: "Which biome on Earth houses over half of the entire planet's wildlife species?",
      options: [
        { text: "Tropical Rainforest Biomes", isCorrect: true },
        { text: "Scorching Sahara Desert dunes", isCorrect: false },
        { text: "Frozen Siberian Pine Tundras", isCorrect: false },
        { text: "Domestic Urban City parks", isCorrect: false }
      ]
    },

    dragMatching: {
      title: "🔗 Adaptations Sync-Up",
      leftTerms: [
        { id: "l1", text: "Chameleon Skin", linkId: "r2" },
        { id: "l2", text: "Monkey Prehensile Tail", linkId: "r1" },
        { id: "l3", text: "Spiky Porcupine Quills", linkId: "r3" }
      ],
      rightTerms: [
        { id: "r1", text: "Acts as a strong fifth limb to grip woody branches while leaping" },
        { id: "r2", text: "Dynamically shifts active pigment patterns to camouflage with green canopy" },
        { id: "r3", text: "Sturdy sharp needles that inflate to protect against charging predators" }
      ]
    },

    fillBlanks: {
      title: "✏️ Green Oxygen Factories",
      textBefore: "Jungle trees breathe in heat-trapping Carbon Dioxide and deliver breathable",
      textAfter: "gas back to support land animal respiration.",
      expected: "Oxygen",
      choices: ["Nitrogen", "Oxygen", "Helium", "Methane"]
    },

    trueFalse: {
      title: "👍 Jungle Soundwaves",
      statement: "All frogs can change colors like wood chameleons to look like toxic dart leaves.",
      isTrue: false
    },

    clickPicture: {
      title: "👁️ Spot the Herbivore",
      prompt: "Find and click the gentle primary herbivore among these beasts:",
      options: [
        { id: "c1", emoji: "🐆", label: "Cheetah (Carnivorous)", isCorrect: false },
        { id: "c2", emoji: "🦒", label: "Tall Herbivorous Giraffe", isCorrect: true },
        { id: "c3", emoji: "🐊", label: "River Crocodile (Apex)", isCorrect: false }
      ]
    },

    shortAnswer: {
      title: "✍️ Expedition Diary Note",
      prompt: "If you could communicate with a wild chimpanzee in the canopy for 5 minutes, what secret question would you ask them?",
      placeholder: "I would ask them which tropical fruit tastes the absolute sweetest..."
    }
  }
];

const buildThemeFromWorksheet = (worksheet: any, lessonTitle?: string): ThemeContent => {
  // Extract all questions from sections
  const qList: any[] = [];
  worksheet?.sections?.forEach((section: any) => {
    section?.questions?.forEach((q: any) => {
      qList.push({
        ...q,
        sectionTitle: section.title || "Assessment Task"
      });
    });
  });

  // Find questions with options (MCQs) for mcq, circleAnswer, and clickPicture slots
  const optionsQuestions = qList.filter(q => q.options && q.options.length > 0);
  
  // MCQ
  const qMcq = optionsQuestions[0] || {
    text: `What is the core learning focus of our lesson on ${lessonTitle || "this topic"}?`,
    options: ["Gaining active scientific & logic inquiry skills", "Memorizing facts without understanding", "Waiting for the classroom timer to tick", "Leaving homework papers incomplete"],
    sectionTitle: "Brain Power Quiz"
  };

  // Circle Answer
  const qCircle = optionsQuestions[1] || {
    text: `Identify the true scientific exploration purpose of ${lessonTitle || "this worksheet"}:`,
    options: ["To explore and test ideas through interactive exercises", "To guess randomly without thinking", "To close the worksheet immediately"],
    sectionTitle: "Circle the Fact"
  };

  // Click Picture
  const qClick = optionsQuestions[2] || {
    text: "Spot the item that represents our primary study approach:",
    options: ["Interactive Investigation", "Laying completely dormant", "Daydreaming about lunch"],
    sectionTitle: "Picture Recognition"
  };

  // True/False question
  const qTF = qList.find(q => 
    q.type === "true-false" || 
    q.text.toLowerCase().includes("true") || 
    q.text.toLowerCase().includes("false") || 
    (q.options && q.options.length === 2 && q.options.some((o: string) => o.toLowerCase().includes("true")))
  ) || {
    text: `Working on interactive organizers based on "${lessonTitle || "our lesson"}" helps solidify our active learning memory!`,
    isTrue: true,
    sectionTitle: "Fact Analyzer"
  };

  // Fill Blanks question
  const qFill = qList.find(q => q.type === "fill-in-the-blanks" || q.text.includes("____")) || {
    text: `We always use our critical thinking caps to ____ any educational challenge we find in the classroom.`,
    options: ["solve", "ignore", "sleep through", "skip"],
    sectionTitle: "Vocabulary Fit"
  };

  const rawFillText = qFill.text;
  let textBefore = rawFillText;
  let textAfter = "";
  if (rawFillText.includes("____")) {
    const parts = rawFillText.split(/____+/);
    textBefore = parts[0] || "";
    textAfter = parts[1] || "";
  } else {
    textBefore = rawFillText + " is a very ";
    textAfter = " concept.";
  }

  // Short Answer question
  const qShort = qList.find(q => q.type === "short-answer" || !q.options || q.options.length === 0) || {
    text: `In your own words, what was the most exciting or surprising fact you learned about "${lessonTitle || "our topic"}" today?`,
    sectionTitle: "Reflection Journal"
  };

  // Drag Term matching list
  const keywordsList = [
    { term: "Topic Focus", def: `The central theme of our current worksheet study: "${lessonTitle || "Mastery"}".` },
    { term: "Inquiry", def: "Asking smart questions and searching for proof to explain how things work." },
    { term: "Application", def: "Using standard rules to find solutions to interesting word challenges." }
  ];

  // Picture Matching mapping
  const pmItems = [
    { emoji: "🌟", label: "A4 Core Mission", def: "Completing each exercise with careful attention and care!" },
    { emoji: "🔍", label: "Smart Observation", def: "Reading questions twice before selecting an final answer choice." },
    { emoji: "✏️", label: "Creative Practice", def: "Writing detailed reflection notes using clean display handwriting." }
  ];

  return {
    id: "assessment",
    emoji: "📝",
    name: "My Generated Assessment",
    tagline: `Interactive, kid-friendly assessment matching your "${lessonTitle || "Topic"}" goals!`,
    bgColor: "bg-purple-50",
    accentBg: "bg-purple-100/70",
    borderColor: "border-purple-500",
    textColor: "text-purple-700",
    headerIllustration: "📝 🌟 🔬 📚 🧩 🎒 🎨 ✏️ 🪐 ✨ 🏫 🧬 🧪 💻",

    pictureMatch: {
      title: "🧩 Classroom Habit Matcher",
      description: "Match the cute study habits on the left with their rewarding learning descriptions!",
      items: pmItems.map((itm, idx) => ({
        id: `pm_l_${idx}`,
        emoji: itm.emoji,
        label: itm.label,
        matchId: `pm_r_${idx}`
      })),
      targets: pmItems.map((itm, idx) => ({
        id: `pm_r_${idx}`,
        label: itm.def
      })).sort(() => Math.random() - 0.5)
    },

    cutAndPaste: {
      title: "✂️ Category Sorting Break",
      description: "Sort the key terms into their correct logical classifications below!",
      slots: [
        { id: "cps_1", label: `Essential parts of ${lessonTitle || "our topic"}`, icon: "✨", expectedTag: "core" },
        { id: "cps_2", label: "Secondary details / Extras", icon: "⭐", expectedTag: "extra" }
      ],
      scissorsPool: [
        { id: "cpp_1", label: "Active Understanding", icon: "🧠", tag: "core" },
        { id: "cpp_2", label: "Inquiry Evidence", icon: "🔬", tag: "core" },
        { id: "cpp_3", label: "Silly Distractors", icon: "🎈", tag: "extra" },
        { id: "cpp_4", label: "Random Doodles", icon: "🖍️", tag: "extra" }
      ]
    },

    coloring: {
      title: "🎨 Educational Paint break",
      description: "Take a fast creative break! Paint these cute geometric segments with sweet colors!",
      presetDrawnBorderSvg: "blocks",
      palette: ["#A855F7", "#EC4899", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#374151"]
    },

    labeling: {
      title: "🏷️ Lesson Mind-Map Labels",
      description: "Complete the master plan diagram to organize our main ideas correctly:",
      backgroundEmoji: "🧠",
      labelDiagramTitle: "Key Concept Map",
      targets: [
        { id: "lbl_1", name: "Core Concept", x: "45%", y: "15%", answer: "Core" },
        { id: "lbl_2", name: "Evidence Check", x: "25%", y: "45%", answer: "Proof" },
        { id: "lbl_3", name: "Lesson Goal", x: "65%", y: "65%", answer: "Target" }
      ],
      optionsPool: ["Core", "Proof", "Target"]
    },

    circleAnswer: {
      title: `⭕ ${qCircle.sectionTitle || "Circle Correct Option"}`,
      question: qCircle.text,
      options: qCircle.options.map((opt: string, idx: number) => ({
        text: opt,
        correct: idx === 0
      }))
    },

    mcq: {
      title: `🏆 ${qMcq.sectionTitle || "Multiple Choice"}`,
      question: qMcq.text,
      options: qMcq.options.map((opt: string, idx: number) => ({
        text: opt,
        isCorrect: idx === 0
      }))
    },

    dragMatching: {
      title: `🔗 ${worksheet?.title || "Concept Connectors"}`,
      leftTerms: keywordsList.map((itm, idx) => ({
        id: `dm_l_${idx}`,
        text: itm.term,
        linkId: `dm_r_${idx}`
      })),
      rightTerms: keywordsList.map((itm, idx) => ({
        id: `dm_r_${idx}`,
        text: itm.def
      })).sort(() => Math.random() - 0.5)
    },

    fillBlanks: {
      title: `✏️ ${qFill.sectionTitle || "Fill the Blank Space"}`,
      textBefore,
      textAfter,
      expected: qFill.options?.[0] || "solve",
      choices: qFill.options || ["solve", "ignore", "sleep through", "skip"]
    },

    trueFalse: {
      title: `👍 ${qTF.sectionTitle || "Fact or Fiction"}`,
      statement: qTF.text,
      isTrue: qTF.isTrue !== undefined ? qTF.isTrue : true
    },

    clickPicture: {
      title: `👁️ ${qClick.sectionTitle || "Interactive Spotlight"}`,
      prompt: qClick.text,
      options: qClick.options.slice(0, 3).map((opt: string, idx: number) => {
        const lowerOpt = opt.toLowerCase();
        let emoji = "🧩";
        const miniEmojiMap: Record<string, string> = {
          investigate: "🔬", inquiry: "🔍", check: "✅", math: "📐", ocean: "🌊",
          animal: "🦁", book: "📖", learn: "🏫", brain: "🧠", star: "⭐", fire: "🔥"
        };
        for (const [key, val] of Object.entries(miniEmojiMap)) {
          if (lowerOpt.includes(key)) {
            emoji = val;
            break;
          }
        }
        return {
          id: `cp_${idx}`,
          emoji,
          label: opt,
          isCorrect: idx === 0
        };
      })
    },

    shortAnswer: {
      title: `✍️ ${qShort.sectionTitle || "Reflection Entry"}`,
      prompt: qShort.text,
      placeholder: "Write in your response carefully like a professional class scholar..."
    }
  };
};

export const InteractiveOrganizerWorksheet: React.FC<{
  lessonTitle?: string;
  onClose?: () => void;
  worksheet?: any;
}> = ({ lessonTitle, onClose, worksheet }) => {
  // Students Identity Section
  const [studentName, setStudentName] = useState("");
  const [studentDate, setStudentDate] = useState(new Date().toLocaleDateString());
  
  const dynamicThemes = React.useMemo(() => {
    if (!worksheet) return THEMES;
    const assessmentTheme = buildThemeFromWorksheet(worksheet, lessonTitle);
    return [assessmentTheme, ...THEMES];
  }, [worksheet, lessonTitle]);

  const [selectedThemeId, setSelectedThemeId] = useState(worksheet ? "assessment" : "ocean");
  const activeTheme = dynamicThemes.find(t => t.id === selectedThemeId) || dynamicThemes[0];

  // Activities States - Dynamically reset when theme shifts!
  // 1. Picture Match State
  const [selectedMatchLeft, setSelectedMatchLeft] = useState<string | null>(null);
  const [matchPairings, setMatchPairings] = useState<Record<string, string>>({}); // LeftId -> RightId
  
  // 2. Cut & Paste State
  const [cutAndPasteSlots, setCutAndPasteSlots] = useState<Record<string, { id: string; label: string; icon: string; tag: string } | null>>({});
  const [selectedScissorItem, setSelectedScissorItem] = useState<{ id: string; label: string; icon: string; tag: string } | null>(null);

  // 3. Coloring Task State (Colored sections tracking)
  const [coloredSections, setColoredSections] = useState<Record<string, string>>({});
  const [activeColorMarker, setActiveColorMarker] = useState("#EF4444");

  // 4. Diagram Labeling State
  const [diagramLabels, setDiagramLabels] = useState<Record<string, string>>({}); // TargetId -> Label value

  // 5. Circle Correct Answer State
  const [circledIndex, setCircledIndex] = useState<number | null>(null);

  // 6. MCQ State
  const [selectedMCQIndex, setSelectedMCQIndex] = useState<number | null>(null);

  // 7. Drag Term matching State
  const [dragMatches, setDragMatches] = useState<Record<string, string>>({}); // LeftId -> RightId
  const [selectedDragTermLeft, setSelectedDragTermLeft] = useState<string | null>(null);

  // 8. Fill blanks State
  const [selectedBlankValue, setSelectedBlankValue] = useState("");

  // 9. True or False State
  const [trueFalseAnswer, setTrueFalseAnswer] = useState<boolean | null>(null);

  // 10. Click picture State
  const [clickedPictureId, setClickedPictureId] = useState<string | null>(null);

  // 11. Short Answer State
  const [shortAnswerValue, setShortAnswerValue] = useState("");

  // Score validation & grading trigger
  const [evaluationResult, setEvaluationResult] = useState<{
    correctCount: number;
    totalCount: number;
    starGrade: number;
    submitted: boolean;
  } | null>(null);

  // Sound / Celebration animation triggers
  const [playSuccessSfx, setPlaySuccessSfx] = useState(false);

  // Reset states when changing themes
  useEffect(() => {
    setSelectedMatchLeft(null);
    setMatchPairings({});
    setCutAndPasteSlots({});
    setSelectedScissorItem(null);
    setColoredSections({});
    setDiagramLabels({});
    setCircledIndex(null);
    setSelectedMCQIndex(null);
    setDragMatches({});
    setSelectedDragTermLeft(null);
    setSelectedBlankValue("");
    setTrueFalseAnswer(null);
    setClickedPictureId(null);
    setShortAnswerValue("");
    setEvaluationResult(null);
  }, [selectedThemeId]);

  // Picture Matching interaction handler
  const handleLeftMatchSelect = (leftId: string) => {
    setSelectedMatchLeft(leftId);
  };

  const handleRightMatchSelect = (rightId: string) => {
    if (!selectedMatchLeft) return;
    setMatchPairings(prev => ({
      ...prev,
      [selectedMatchLeft]: rightId
    }));
    setSelectedMatchLeft(null);
  };

  const handleClearMatches = () => {
    setMatchPairings({});
    setSelectedMatchLeft(null);
  };

  // Cut-and-paste selection click handler
  const handleSelectScissor = (item: { id: string; label: string; icon: string; tag: string }) => {
    setSelectedScissorItem(item);
  };

  const handlePlacePasteSlot = (slotId: string) => {
    if (!selectedScissorItem) return;
    setCutAndPasteSlots(prev => ({
      ...prev,
      [slotId]: selectedScissorItem
    }));
    setSelectedScissorItem(null);
  };

  const handleClearPasteSlot = (slotId: string) => {
    setCutAndPasteSlots(prev => ({
      ...prev,
      [slotId]: null
    }));
  };

  // Drag matches connector handler
  const handleDragLeftSelect = (termId: string) => {
    setSelectedDragTermLeft(termId);
  };

  const handleDragRightSelect = (termId: string) => {
    if (!selectedDragTermLeft) return;
    setDragMatches(prev => ({
      ...prev,
      [selectedDragTermLeft]: termId
    }));
    setSelectedDragTermLeft(null);
  };

  // Canvas Coloring preset handler
  const handleSectionColor = (sectionKey: string) => {
    setColoredSections(prev => ({
      ...prev,
      [sectionKey]: activeColorMarker
    }));
  };

  // Evaluate final child scores across all interactive modules
  const handleSubmitWorksheetPlayground = () => {
    let score = 0;
    const totalPossible = 10; // Out of 10 points for standard answers

    // 1. Picture Matching Check (3 keys)
    let pmCorrect = true;
    activeTheme.pictureMatch.items.forEach(itm => {
      const selectedRightId = matchPairings[itm.id];
      if (selectedRightId !== itm.matchId) {
        pmCorrect = false;
      }
    });
    if (pmCorrect && Object.keys(matchPairings).length === activeTheme.pictureMatch.items.length) {
      score += 1;
    }

    // 2. Cut & Paste Check
    let cpCorrect = true;
    activeTheme.cutAndPaste.slots.forEach(slot => {
      const placed = cutAndPasteSlots[slot.id];
      if (!placed || placed.tag !== slot.expectedTag) {
        cpCorrect = false;
      }
    });
    if (cpCorrect) {
      score += 1;
    }

    // 3. Coloring Check (Award 1 point for coloring at least 3 parts)
    if (Object.keys(coloredSections).length >= 3) {
      score += 1;
    }

    // 4. Diagram Labeling Check
    let diagramCorrect = true;
    activeTheme.labeling.targets.forEach(tgt => {
      const labeledValue = diagramLabels[tgt.id];
      if (labeledValue !== tgt.answer) {
        diagramCorrect = false;
      }
    });
    if (diagramCorrect && Object.keys(diagramLabels).length === activeTheme.labeling.targets.length) {
      score += 1;
    }

    // 5. Circle correctness
    const circleTarget = activeTheme.circleAnswer.options.findIndex(o => o.correct);
    if (circledIndex === circleTarget) {
      score += 1;
    }

    // 6. MCQ
    const mcqTarget = activeTheme.mcq.options.findIndex(o => o.isCorrect);
    if (selectedMCQIndex === mcqTarget) {
      score += 1;
    }

    // 7. Drag-and-drop Key align check
    let dragCorrect = true;
    activeTheme.dragMatching.leftTerms.forEach(term => {
      const matchRightId = dragMatches[term.id];
      if (matchRightId !== term.linkId) {
        dragCorrect = false;
      }
    });
    if (dragCorrect && Object.keys(dragMatches).length === activeTheme.dragMatching.leftTerms.length) {
      score += 1;
    }

    // 8. Fill blanks check
    if (selectedBlankValue === activeTheme.fillBlanks.expected) {
      score += 1;
    }

    // 9. True or False Check
    if (trueFalseAnswer === activeTheme.trueFalse.isTrue) {
      score += 1;
    }

    // 10. Click the Picture
    const pictureTarget = activeTheme.clickPicture.options.find(o => o.isCorrect);
    if (clickedPictureId === pictureTarget?.id) {
      score += 1;
    }

    // Deduce Star ratings out of 5 stars
    const starRatio = Math.round((score / totalPossible) * 5);
    const starResult = starRatio < 1 ? 1 : starRatio;

    setEvaluationResult({
      correctCount: score,
      totalCount: totalPossible,
      starGrade: starResult,
      submitted: true,
    });

    setPlaySuccessSfx(true);
    setTimeout(() => {
      setPlaySuccessSfx(false);
    }, 4000);
  };

  // Custom PDF/HTML print triggers
  const handlePrintPlayground = () => {
    window.print();
  };

  return (
    <div className={`rounded-3xl p-6 md:p-10 border-4 ${activeTheme.borderColor} shadow-2xl ${activeTheme.bgColor} transition-all duration-500 max-w-5xl mx-auto text-[#0F172A] relative overflow-hidden select-none print:bg-white print:border-black print:p-0 print:shadow-none print:rounded-none`}>
      
      {/* HEADER WATERMARKS FOR PRINTING AND GRAPHIC ORGANIZER ATMOSPHERE */}
      <div className="absolute top-2 right-4 text-xs font-mono font-black opacity-30 uppercase tracking-widest pointer-events-none print:hidden">
        🎨 GRAPHIC ORGANIZER TEMPLATE • PRIMARY SCHOOL
      </div>

      <div className="flex flex-wrap justify-between items-start gap-4 mb-8 pb-6 border-b-4 border-dashed border-stone-300 print:border-solid">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border-2 border-stone-300 rounded-full text-xs font-black uppercase tracking-wider text-stone-700 shadow-sm print:border-black print:text-black">
            🎒 Year Group & Theme Explorer
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-2 flex items-center gap-2">
            <span>{activeTheme.emoji}</span>
            <span className="bg-gradient-to-r from-stone-900 to-stone-700 bg-clip-text text-transparent print:text-black">
              {activeTheme.name}
            </span>
          </h1>
          <p className="text-sm font-semibold text-stone-600 mt-1">
            {activeTheme.tagline} {lessonTitle && <span className="italic text-indigo-600 font-bold">({lessonTitle})</span>}
          </p>
        </div>

        {/* PRINT & BACK BUTTON CONTROLS */}
        <div className="flex flex-wrap gap-2 print:hidden font-sans">
          <button
            onClick={handlePrintPlayground}
            className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-stone-800 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={13} /> Print to A4
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white text-stone-700 border-2 border-stone-200 rounded-xl text-xs font-black uppercase tracking-wider hover:border-stone-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              Back to Hub
            </button>
          )}
        </div>
      </div>

      {/* THEME SELECTION BANNER */}
      <div className="bg-white/80 p-3.5 rounded-2xl border-2 border-stone-200 mb-8 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
        <span className="text-xs font-black uppercase tracking-widest text-stone-600 flex items-center gap-1">
          <Sparkles className="text-yellow-500 animate-spin-slow" size={14} /> Quick Classroom Topic Switcher:
        </span>
        <div className="flex flex-wrap justify-center gap-2">
          {dynamicThemes.map(theme => {
            const isSelected = selectedThemeId === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => setSelectedThemeId(theme.id)}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border-2 ${
                  isSelected 
                    ? "bg-stone-900 text-white border-stone-900 scale-103 shadow-md"
                    : "bg-white text-stone-700 border-stone-200 hover:border-stone-400 hover:bg-stone-50"
                }`}
              >
                {theme.emoji} {theme.id.toUpperCase()}
              </button>
            )
          })}
        </div>
      </div>

      {/* STUDENT AND DATE BOX (A4 PORTRAIT COMPLIANCE) */}
      <div className="bg-white rounded-2xl p-4 border-2 border-stone-300 md:grid md:grid-cols-2 gap-4 mb-8 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase tracking-widest text-stone-500 shrink-0">Student Name:</span>
          <input
            type="text"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Type your name here..."
            className="flex-1 bg-stone-50 border-b-2 border-dashed border-stone-300 px-2 py-1 text-sm font-black focus:outline-none focus:border-stone-900 transition-all print:border-solid text-stone-800"
          />
        </div>
        <div className="flex items-center gap-3 mt-3 md:mt-0">
          <span className="text-xs font-black uppercase tracking-widest text-stone-500 shrink-0">A4 Date:</span>
          <input
            type="text"
            value={studentDate}
            onChange={(e) => setStudentDate(e.target.value)}
            placeholder="MM/DD/YYYY"
            className="flex-1 bg-stone-50 border-b-2 border-dashed border-stone-300 px-2 py-1 text-sm font-black focus:outline-none focus:border-stone-900 transition-all print:border-solid text-stone-800"
          />
        </div>
      </div>

      {/* GRAPHIC ORGANIZER CENTRAL SCENE (ILLUSTRATED ATMOSPHERE) */}
      <div className="hidden sm:flex overflow-hidden justify-center items-center py-2 bg-gradient-to-r from-stone-900/5 via-stone-900/10 to-stone-900/5 border-y border-dashed border-stone-300 mb-8 select-none text-md font-mono tracking-widest whitespace-nowrap">
        {activeTheme.headerIllustration}
      </div>

      {/* CORE 11 EDUCATIONAL TASK CONTAINER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch mb-8 text-left">
        
        {/* TASK 1: PICTURE MATCHING (Select-to-Match) */}
        <div className="bg-white rounded-3xl p-6 border-2 border-stone-300 shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-md font-black text-stone-800 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              {activeTheme.pictureMatch.title}
            </h3>
            <p className="text-xs font-bold text-stone-600 mb-4">{activeTheme.pictureMatch.description}</p>
            
            <div className="space-y-3">
              {activeTheme.pictureMatch.items.map(itm => {
                const assignedRightId = matchPairings[itm.id];
                const matchedRightItem = activeTheme.pictureMatch.targets.find(r => r.id === assignedRightId);
                const isSelected = selectedMatchLeft === itm.id;

                return (
                  <div key={itm.id} className="flex flex-col gap-1 inline-block w-full">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLeftMatchSelect(itm.id)}
                        className={`p-2.5 px-4 rounded-xl border-2 font-black text-xs flex items-center gap-2 cursor-pointer transition-all ${
                          isSelected 
                            ? "bg-stone-900 text-white border-stone-900 scale-102"
                            : "bg-stone-50 text-stone-800 border-stone-200 hover:border-stone-400"
                        }`}
                      >
                        <span className="text-lg">{itm.emoji}</span>
                        <span>{itm.label}</span>
                      </button>

                      <ArrowRight size={13} className="text-stone-400" />

                      <div className="flex-1">
                        {matchedRightItem ? (
                          <span className="p-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold block truncate">
                            matched: {matchedRightItem.label}
                          </span>
                        ) : (
                          <span className="text-[10px] text-stone-400 font-bold italic">
                            (waiting for selection...)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Match Targets Pool (Clickable once a left item is selected) */}
            {selectedMatchLeft && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-stone-100 border-2 border-dashed border-stone-300 rounded-xl space-y-2 animate-pulse"
              >
                <p className="text-[10px] font-black uppercase text-stone-600">Select special superpower:</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {activeTheme.pictureMatch.targets.map(tgt => (
                    <button
                      key={tgt.id}
                      onClick={() => handleRightMatchSelect(tgt.id)}
                      className="p-1 px-2.5 bg-white hover:bg-stone-900 hover:text-white border border-stone-200 rounded-lg text-left text-xs font-black cursor-pointer transition-all"
                    >
                      ★ {tgt.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          <div className="text-right mt-3 pt-3 border-t border-stone-100">
            <button
              onClick={handleClearMatches}
              className="text-[10px] uppercase font-black text-red-500 hover:text-red-700 cursor-pointer"
            >
              Clear Line pairings
            </button>
          </div>
        </div>

        {/* TASK 2: CUT-AND-PASTE ACTIVITY */}
        <div className="bg-white rounded-3xl p-6 border-2 border-stone-300 shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-md font-black text-stone-800 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <span>{activeTheme.cutAndPaste.title}</span>
            </h3>
            <p className="text-xs font-bold text-stone-600 mb-4">{activeTheme.cutAndPaste.description}</p>

            {/* Designated Paste Slots */}
            <div className="grid grid-cols-1 gap-3.5 mb-4">
              {activeTheme.cutAndPaste.slots.map(slot => {
                const placedItem = cutAndPasteSlots[slot.id];
                return (
                  <div 
                    key={slot.id} 
                    onClick={() => placedItem ? handleClearPasteSlot(slot.id) : handlePlacePasteSlot(slot.id)}
                    className={`p-3 rounded-2xl border-2 border-dashed flex items-center justify-between cursor-pointer transition-all ${
                      placedItem 
                        ? "bg-emerald-50 border-emerald-400 shadow-sm" 
                        : "bg-stone-50 border-stone-200 hover:border-stone-400"
                    }`}
                  >
                    <div className="text-left">
                      <span className="text-[9px] font-mono text-stone-400 uppercase tracking-wider block">Paste Target Slot</span>
                      <p className="text-xs font-black text-stone-700">{slot.label}</p>
                    </div>

                    <div>
                      {placedItem ? (
                        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-emerald-200">
                          <span className="text-lg">{placedItem.icon}</span>
                          <span className="text-[10px] font-black uppercase text-[#1B4332]">{placedItem.label}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-stone-400 font-bold bg-white-70 px-2 py-1 rounded border border-dashed border-stone-300 uppercase tracking-wide">
                          📍 Place here
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Scissor Cut pool indicator */}
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
              <span className="text-[10px] font-black uppercase text-stone-600 block mb-2">
                ✂️ Pool of scissor elements (Click to cut!):
              </span>
              <div className="flex flex-wrap gap-2">
                {activeTheme.cutAndPaste.scissorsPool.map(sc => {
                  const isCut = selectedScissorItem?.id === sc.id;
                  const isPlacedAnywhere = Object.values(cutAndPasteSlots).some(val => val?.id === sc.id);

                  return (
                    <button
                      key={sc.id}
                      onClick={() => handleSelectScissor(sc)}
                      disabled={isPlacedAnywhere}
                      className={`py-1.5 px-3 rounded-xl border-2 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${
                        isCut 
                          ? "bg-amber-100 border-amber-500 scale-103" 
                          : isPlacedAnywhere 
                            ? "bg-stone-200 text-stone-400 border-stone-300 opacity-40 line-through"
                            : "bg-white text-stone-800 border-stone-200 hover:border-stone-400"
                      }`}
                    >
                      <span>{sc.icon}</span>
                      <span>{sc.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* TASK 3: COLORING TASK */}
        <div className="bg-white rounded-3xl p-6 border-2 border-stone-300 shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-md font-black text-stone-800 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <span>{activeTheme.coloring.title}</span>
            </h3>
            <p className="text-xs font-bold text-stone-600 mb-4">{activeTheme.coloring.description}</p>

            {/* COLOR MARKER PALETTE */}
            <div className="flex flex-wrap items-center gap-2 mb-4 p-2 bg-stone-50 border border-stone-200 rounded-xl">
              <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Select Brush Color:</span>
              <div className="flex flex-wrap gap-1">
                {activeTheme.coloring.palette.map(clr => (
                  <button
                    key={clr}
                    onClick={() => setActiveColorMarker(clr)}
                    style={{ backgroundColor: clr }}
                    className={`w-6 h-6 rounded-full border cursor-pointer transition-all ${
                      activeColorMarker === clr ? "scale-125 ring-2 ring-stone-900 border-white" : "border-stone-300"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* ILLUSTRATED ACTIVE VIEW Coloring Interactive Boxes (Chameleon, Rocket or Coral vectors) */}
            <div className="p-3 bg-stone-100 border-2 border-dashed border-stone-300 rounded-2xl flex flex-col gap-2 items-center justify-center min-h-[160px]">
              <span className="text-[10px] font-mono text-stone-400 font-bold tracking-widest">
                🎨 COLOR BY CLICK VECTOR SEGMENTS
              </span>
              
              <div className="grid grid-cols-4 gap-2 w-full max-w-xs mt-2">
                {["Segment A", "Segment B", "Segment C", "Segment D", "Segment E", "Segment F", "Segment G", "Segment H"].map((seg) => {
                  const currColor = coloredSections[seg] || "#FFFFFF";
                  return (
                    <button
                      key={seg}
                      onClick={() => handleSectionColor(seg)}
                      style={{ backgroundColor: currColor }}
                      className="h-10 hover:brightness-95 border-2 border-stone-300 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-inner active:scale-95"
                    >
                      <Paintbrush size={12} className="opacity-15 text-stone-900" />
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-stone-500 font-semibold italic mt-2">
                Click any of the 8 blocks above to fill them with your selected color marker!
              </p>
            </div>
          </div>
        </div>

        {/* TASK 4: LABELING PICTURES */}
        <div className="bg-white rounded-3xl p-6 border-2 border-stone-300 shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-md font-black text-stone-800 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <span>{activeTheme.labeling.title}</span>
            </h3>
            <p className="text-xs font-bold text-stone-600 mb-4">{activeTheme.labeling.description}</p>

            {/* Diagram container with absolute marker bubbles */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 min-h-[180px] relative overflow-hidden flex flex-col items-center justify-center">
              <div className="text-7xl select-none animate-bounce-slow opacity-60">
                {activeTheme.labeling.backgroundEmoji}
              </div>

              {activeTheme.labeling.targets.map(tgt => {
                const filled = diagramLabels[tgt.id] || "";
                return (
                  <div 
                    key={tgt.id} 
                    style={{ left: tgt.x, top: tgt.y }}
                    className="absolute z-10 p-0.5 bg-white border-2 border-stone-500 rounded-lg shadow flex flex-col gap-0.5 max-w-[120px]"
                  >
                    <span className="text-[8px] font-black text-stone-400 block truncate leading-none">
                      {tgt.name}
                    </span>
                    <select
                      value={filled}
                      onChange={(e) => setDiagramLabels(prev => ({ ...prev, [tgt.id]: e.target.value }))}
                      className="p-0.5 bg-stone-50 border border-stone-200 rounded text-[9px] font-black text-stone-800 focus:outline-none"
                    >
                      <option value="">Choose Label</option>
                      {activeTheme.labeling.optionsPool.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* TASK 5: CIRCLE THE CORRECT ANSWER */}
        <div className="bg-white rounded-3xl p-6 border-2 border-stone-300 shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-md font-black text-stone-800 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <span>{activeTheme.circleAnswer.title}</span>
            </h3>
            <p className="text-xs font-black text-stone-700 mb-3">{activeTheme.circleAnswer.question}</p>

            <div className="space-y-2">
              {activeTheme.circleAnswer.options.map((opt, idx) => {
                const isSelected = circledIndex === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setCircledIndex(idx)}
                    className={`w-full p-2.5 px-4 rounded-full border-2 text-left text-xs font-black cursor-pointer transition-all flex items-center justify-between ${
                      isSelected 
                        ? "bg-[#FEFCE8] border-amber-500 ring-2 ring-amber-300" 
                        : "bg-stone-50 border-stone-200 hover:border-amber-200"
                    }`}
                  >
                    <span>{opt.text}</span>
                    {isSelected && <span className="text-amber-600 bg-amber-100 p-0.5 px-2 rounded-full text-[9px] uppercase font-black">Circled!</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* TASK 6: MULTIPLE-CHOICE QUESTIONS */}
        <div className="bg-white rounded-3xl p-6 border-2 border-stone-300 shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-md font-black text-stone-800 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <span>{activeTheme.mcq.title}</span>
            </h3>
            <p className="text-xs font-black text-stone-700 mb-3">{activeTheme.mcq.question}</p>

            <div className="space-y-2">
              {activeTheme.mcq.options.map((option, idx) => {
                const isSelected = selectedMCQIndex === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedMCQIndex(idx)}
                    className={`w-full p-2.5 px-4 rounded-xl border-2 text-left text-xs font-bold transition-all cursor-pointer flex items-center gap-3 ${
                      isSelected 
                        ? "bg-indigo-50 border-indigo-500 scale-101" 
                        : "bg-stone-50 border-stone-200 hover:border-indigo-300"
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-black bg-stone-100 uppercase shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-stone-700 font-semibold">{option.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* TASK 7: DRAG AND DROP MATCHING */}
        <div className="bg-white rounded-3xl p-6 border-2 border-stone-300 shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-md font-black text-stone-800 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <span>{activeTheme.dragMatching.title}</span>
            </h3>
            <p className="text-xs font-bold text-stone-600 mb-4">Click a category word, then select its matching definition definition:</p>

            <div className="space-y-3">
              {activeTheme.dragMatching.leftTerms.map(term => {
                const companionRightId = dragMatches[term.id];
                const rightItem = activeTheme.dragMatching.rightTerms.find(r => r.id === companionRightId);
                const isSelected = selectedDragTermLeft === term.id;

                return (
                  <div key={term.id} className="flex flex-col gap-1.5 inline-block w-full">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDragLeftSelect(term.id)}
                        className={`p-2 px-3 rounded-xl border-2 font-black text-xs cursor-pointer transition-all shrink-0 ${
                          isSelected ? "bg-amber-100 border-amber-500 scale-102" : "bg-stone-50 border-stone-200 hover:border-[#10B981]"
                        }`}
                      >
                        🧬 {term.text}
                      </button>

                      <ArrowRight size={12} className="text-stone-400 shrink-0" />

                      <div className="flex-1">
                        {rightItem ? (
                          <span className="p-1.5 text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl leading-tight font-semibold block">
                            {rightItem.text}
                          </span>
                        ) : (
                          <span className="text-[10px] text-stone-400 font-bold italic">
                            (waiting definition...)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Term choices */}
            {selectedDragTermLeft && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 p-3 bg-stone-50 border-2 border-dashed border-stone-300 rounded-xl space-y-2"
              >
                <p className="text-[10px] font-black uppercase text-stone-500">Pick matching definition definition:</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {activeTheme.dragMatching.rightTerms.map(rt => (
                    <button
                      key={rt.id}
                      onClick={() => handleDragRightSelect(rt.id)}
                      className="p-1.5 px-3 bg-white hover:bg-[#10B981] hover:text-white border border-stone-200 rounded-lg text-left text-[11px] font-bold cursor-pointer transition-all"
                    >
                      💡 {rt.text}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* TASK 8: FILL-IN-THE-BLANKS */}
        <div className="bg-white rounded-3xl p-6 border-2 border-stone-300 shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-md font-black text-stone-800 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <span>{activeTheme.fillBlanks.title}</span>
            </h3>
            <p className="text-xs font-bold text-stone-600 mb-4">Complete the sentences by picking the missing vocabulary:</p>

            <div className="p-3 bg-stone-50 border rounded-xl leading-relaxed text-xs font-semibold text-stone-700 mb-4">
              "{activeTheme.fillBlanks.textBefore}{" "}
              <span className="border-b-2 border-dashed border-stone-900 px-3 py-0.5 mx-1 font-black text-indigo-600 bg-white shadow-inner rounded-md">
                {selectedBlankValue || "_________"}
              </span>{" "}
              {activeTheme.fillBlanks.textAfter}"
            </div>

            {/* Vocabulary pool selection */}
            <div className="flex flex-wrap gap-2 justify-center">
              {activeTheme.fillBlanks.choices.map(choice => (
                <button
                  key={choice}
                  onClick={() => setSelectedBlankValue(choice)}
                  className={`p-1.5 px-3 rounded-lg border-2 text-xs font-black cursor-pointer transition-all ${
                    selectedBlankValue === choice 
                      ? "bg-stone-900 text-white border-stone-900" 
                      : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
                  }`}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* TASK 9: TRUE OR FALSE */}
        <div className="bg-white rounded-3xl p-6 border-2 border-stone-300 shadow-md flex flex-col justify-between font-sans">
          <div>
            <h3 className="text-md font-black text-stone-800 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <span>{activeTheme.trueFalse.title}</span>
            </h3>
            <p className="text-xs font-bold text-stone-700 mb-4">Analyze the statement. Click thumbs up for True, thumbs down for False!</p>

            <div className="p-4 bg-stone-50 rounded-xl leading-relaxed text-xs font-bold italic text-stone-800 mb-4 text-center">
              "{activeTheme.trueFalse.statement}"
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => setTrueFalseAnswer(true)}
                className={`flex-1 max-w-[120px] p-3 rounded-2xl border-2 flex flex-col items-center gap-1 cursor-pointer transition-all ${
                  trueFalseAnswer === true 
                    ? "bg-emerald-50 border-emerald-500 scale-103 shadow" 
                    : "bg-white border-stone-200 hover:border-emerald-300"
                }`}
              >
                <span className="text-2xl">👍</span>
                <span className="text-[10px] font-black uppercase text-emerald-800">True</span>
              </button>
              
              <button
                onClick={() => setTrueFalseAnswer(false)}
                className={`flex-1 max-w-[120px] p-3 rounded-2xl border-2 flex flex-col items-center gap-1 cursor-pointer transition-all ${
                  trueFalseAnswer === false 
                    ? "bg-red-50 border-red-500 scale-103 shadow" 
                    : "bg-white border-stone-200 hover:border-red-300"
                }`}
              >
                <span className="text-2xl">👎</span>
                <span className="text-[10px] font-black uppercase text-red-800">False</span>
              </button>
            </div>
          </div>
        </div>

        {/* TASK 10: CLICK THE PICTURE ACTIVITY */}
        <div className="bg-white rounded-3xl p-6 border-2 border-stone-300 shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-md font-black text-stone-800 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <span>{activeTheme.clickPicture.title}</span>
            </h3>
            <p className="text-xs font-bold text-stone-600 mb-4">{activeTheme.clickPicture.prompt}</p>

            <div className="grid grid-cols-3 gap-3">
              {activeTheme.clickPicture.options.map(opt => {
                const active = clickedPictureId === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setClickedPictureId(opt.id)}
                    className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      active 
                        ? "bg-[#FEFCE8] border-amber-500 scale-103 shadow" 
                        : "bg-stone-50 border-stone-200 hover:border-amber-300"
                    }`}
                  >
                    <span className="text-3xl filter drop-shadow">{opt.emoji}</span>
                    <span className="text-[9px] font-black uppercase text-stone-800 tracking-tight text-center leading-none">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* TASK 11: SHORT ANSWER QUESTION */}
        <div className="bg-white rounded-3xl p-6 border-2 border-stone-300 shadow-md flex flex-col justify-between md:col-span-2">
          <div>
            <h3 className="text-md font-black text-stone-800 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <span>{activeTheme.shortAnswer.title}</span>
            </h3>
            <p className="text-xs font-black text-stone-700 mb-3">{activeTheme.shortAnswer.prompt}</p>

            <textarea
              value={shortAnswerValue}
              onChange={(e) => setShortAnswerValue(e.target.value)}
              placeholder={activeTheme.shortAnswer.placeholder}
              className="w-full min-h-[80px] p-3.5 bg-stone-50 border-2 border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:border-stone-900 focus:bg-white resize-y shadow-inner font-sans"
            />
          </div>
        </div>

      </div>

      {/* FOOTER ACTION CONTROL PANEL */}
      <div className="mt-8 pt-6 border-t-4 border-dashed border-stone-300 flex flex-wrap justify-center gap-4 print:hidden">
        <button
          onClick={() => {
            setCircledIndex(null);
            setSelectedMCQIndex(null);
            setMatchPairings({});
            setCutAndPasteSlots({});
            setColoredSections({});
            setDiagramLabels({});
            setDragMatches({});
            setSelectedBlankValue("");
            setTrueFalseAnswer(null);
            setClickedPictureId(null);
            setShortAnswerValue("");
            setEvaluationResult(null);
          }}
          className="px-6 py-3 bg-white hover:bg-stone-100 border-2 border-stone-300 rounded-2xl font-black text-xs uppercase tracking-widest text-stone-700 cursor-pointer shadow-sm active:scale-95 transition-all"
        >
          <RefreshCw size={14} className="inline mr-1" /> Clear Everything
        </button>

        <button
          onClick={handleSubmitWorksheetPlayground}
          className="px-8 py-3 bg-[#059669] hover:bg-[#047857] text-white rounded-2xl font-black text-xs uppercase tracking-widest cursor-pointer shadow-md active:scale-95 transition-all"
        >
          <Award size={14} className="inline mr-1" /> Submit & Mint Score!
        </button>
      </div>

      {/* EVALUATION RESULTS & REWARD REVELATIONS */}
      {evaluationResult && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-8 p-6 bg-white border-2 border-emerald-400 rounded-3xl text-center shadow-lg max-w-xl mx-auto"
        >
          <div className="flex justify-center gap-1 text-center mb-3 text-2xl text-yellow-500">
            {Array.from({ length: evaluationResult.starGrade }).map((_, i) => (
              <span key={i}>⭐</span>
            ))}
          </div>

          <h3 className="text-xl font-extrabold text-emerald-900 uppercase">
            Excellent Effort, Explorer! 🎉
          </h3>
          <p className="text-xs font-bold text-stone-500 mt-1 uppercase tracking-widest">
            Score: {evaluationResult.correctCount} / {evaluationResult.totalCount} Points Checked!
          </p>

          <p className="text-xs text-stone-600 mt-3 max-w-md mx-auto leading-relaxed">
            Congratulations {studentName || "Class Cadet"}! Your interactive graphic organizer has been graded with {evaluationResult.starGrade} cute stars! Keep reading and exploring topics!
          </p>
        </motion.div>
      )}

      {/* PRINT-ONLY COMPLIANCE SIGNATURE MARGINS */}
      <div className="hidden print:block text-center mt-12 pt-6 border-t border-stone-300 text-[10px] font-mono text-stone-500 font-bold">
        Worksheet generated by Zera Classroom • Printable Classroom-Ready A4 Format Portfolio
      </div>
    </div>
  );
};
