/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard,
  BookOpen,
  Calendar,
  Layers,
  FileText, 
  Presentation, 
  Plus, 
  Minus,
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  Printer,
  Wand2,
  Loader2,
  X,
  Download,
  Zap,
  History,
  Trash2,
  Image as ImageIcon,
  CheckCircle,
  Scissors,
  FileUp,
  Info,
  Search,
  Target,
  Star,
  FileSpreadsheet,
  Type as FontIcon,
  Bold,
  Italic,
  Underline,
  Palette,
  Move,
  Maximize2,
  Minimize2,
  RotateCw,
  PlusCircle,
  Undo,
  Redo,
  MousePointer2,
  Users,
  UserCheck,
  LayoutGrid,
  Square,
  Circle,
  Triangle,
  Type,
  Wallpaper as WallpaperIcon,
  Layout,
  ArrowRight,
  Crop,
  Camera,
  ExternalLink,
  Link as LinkIcon,
  LogIn,
  UserPlus,
  LogOut,
  Mail,
  Lock,
  User,
  RefreshCw,
  Home,
  Folder,
  FolderPlus,
  ArrowRightCircle,
  MoreVertical
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import pptxgen from 'pptxgenjs';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, SectionType } from 'docx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Firebase
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  initializeFirestore,
  getFirestore, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc,
  writeBatch,
  deleteField,
  serverTimestamp,
  getDoc,
  getDocs,
  getDocsFromServer,
  orderBy
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

import { ImageEditor } from './components/ImageEditor';
import { GENERATED_THEMES, THEMES } from './constants';
import { PRESET_WALLPAPERS } from './constants/wallpapers';
import { 
  EduContent, 
  AppTheme,
  PosterContent,
  Sticker,
  SlideContent,
  SlideImage,
  FontSettings
} from './types';
import { 
  generateSlides, 
  generateWorksheet, 
  generatePoster, 
  generateLessonPlan,
  generateEduContent,
  generateWeeklyPlan,
  suggestWeeklyInput
} from './services/geminiService';

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
// Using initializeFirestore with long polling to avoid WebSocket issues in some environments
const db = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

const ADMIN_EMAILS = [
  'nurshahidahmohdayob@gmail.com', 
  'shahidah.a@zera.edu.my', 
  'shahidah.a@zera.edumy',
  'nurshahidah@zera.edu.my'
];

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const RenderShape = ({ shape, color, size }: { shape: string, color?: string, size: number }) => {
  const c = color || '#059669';
  switch (shape) {
    case 'square': return <div style={{ width: size, height: size, backgroundColor: c, borderRadius: '4px' }} />;
    case 'circle': return <div style={{ width: size, height: size, backgroundColor: c, borderRadius: '50%' }} />;
    case 'triangle': return (
      <div style={{ 
        width: 0, height: 0, 
        borderLeft: `${size/2}px solid transparent`,
        borderRight: `${size/2}px solid transparent`,
        borderBottom: `${size}px solid ${c}`
      }} />
    );
    case 'star': return <Star fill={c} stroke="none" size={size} />;
    default: return null;
  }
};

const Pattern = ({ type, color }: { type: AppTheme['patternType'], color: string }) => {
  if (type === 'dots') {
    return (
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `radial-gradient(${color} 2px, transparent 2px)`, backgroundSize: '24px 24px' }} />
    );
  }
  if (type === 'waves') {
    return (
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `radial-gradient(ellipse at 50% -20%, ${color}, transparent), radial-gradient(ellipse at 50% 120%, ${color}, transparent)` }} />
    );
  }
  if (type === 'stars') {
    return (
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="w-full h-full" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 0l2 7h7l-5 4 2 7-6-4-6 4 2-7-5-4h7l2-7z' fill='${encodeURIComponent(color)}' fill-opacity='1'/%3E%3C/svg%3E")`, backgroundSize: '40px 40px' }} />
      </div>
    );
  }
  if (type === 'clouds') {
    return (
      <div className="absolute inset-0 opacity-5 pointer-events-none">
         <div className="w-full h-full" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M45 40a10 10 0 1 1-1.3-19.9 15 15 0 1 1-24.3-3 12 12 0 1 1-1.3 22.9H45z' fill='${encodeURIComponent(color)}' fill-opacity='1'/%3E%3C/svg%3E")`, backgroundSize: '100px 100px' }} />
      </div>
    );
  }
  return null;
};

// --- Main App ---

interface SavedLesson {
  id: string;
  userId: string;
  timestamp: number;
  content: EduContent;
  category: 'lesson-plan' | 'worksheet' | 'slides' | 'poster' | 'all';
  title: string;
  status: 'draft' | 'submitted';
  teacherName: string;
  settings?: {
    posterOnly: boolean;
    includeStory: boolean;
    isTemplateMode: boolean;
    workspaceMode: 'slides' | 'worksheet' | 'poster' | 'lesson-plan';
  }
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerRoles, setRegisterRoles] = useState<string[]>(['educator']);
  const [userRoles, setUserRoles] = useState<string[]>(['educator']);
  const [authError, setAuthError] = useState('');

  // --- Firebase Debugging ---
  useEffect(() => {
    const testConnection = async () => {
      try {
        // Test connection to Firestore
        const { getDocFromServer } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'system', 'connection_test')).catch(() => {
           // We expect failure if doc doesn't exist, but it confirms network connectivity
        });
        console.log("Firebase connection established.");
      } catch (error: any) {
        if (error.message?.includes('offline')) {
          console.error("Firebase is offline. Check your config.");
        }
      }
    };
    testConnection();
  }, []);

  const handleEduError = (err: any, context: string) => {
    console.error(`${context} error:`, err);
    let errorMessage = `Failed to ${context.toLowerCase()}. Please try again.`;
    
    const errorStr = (err.message || String(err)).toLowerCase();
    if (errorStr.includes('api_key') || errorStr.includes('api key')) {
      errorMessage = "AI Service Error: Gemini API Key is missing or invalid. Please check your project secrets.";
    } else if (errorStr.includes('quota') || errorStr.includes('429')) {
      errorMessage = "AI Service Error: Quota exceeded. Please try again in a few minutes.";
    } else if (errorStr.includes('safety') || errorStr.includes('blocked')) {
      errorMessage = "AI Service Error: The model blocked the request due to safety filters (e.g. sensitive topics). Try a different prompt.";
    } else if (errorStr.includes('parsing') || errorStr.includes('json')) {
      errorMessage = "AI Service Error: The model provided an invalid response format. Please try again.";
    } else if (err.message) {
      errorMessage = `AI Error: ${err.message}`;
    }
    
    alert(errorMessage);
  };

  const getFriendlyAuthError = (err: any) => {
    const code = err?.code || '';
    const message = (err?.message || String(err)).toLowerCase();

    if (code === 'auth/weak-password' || message.includes('weak-password')) return 'Password must be at least 6 characters long.';
    if (code === 'auth/email-already-in-use' || message.includes('email-already-in-use')) return 'This email is already registered. Please sign in instead.';
    if (code === 'auth/invalid-email' || message.includes('invalid-email')) return 'Please check your email format.';
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential' || 
        message.includes('user-not-found') || message.includes('wrong-password') || message.includes('invalid-credential')) {
      return 'Invalid email or password. Please check your credentials or register if you do not have an account.';
    }
    if (code === 'auth/operation-not-allowed' || message.includes('operation-not-allowed')) return 'Email/Password sign-in is not enabled. Please contact support.';
    if (code === 'auth/network-request-failed' || message.includes('network-request-failed')) return 'Network error. Please check your internet connection.';
    return err?.message || String(err);
  };

  const [activeTheme, setActiveTheme] = useState<AppTheme>(THEMES[0]);
  const [content, setContent] = useState<EduContent | null>(null);
  const [selectedField, setSelectedField] = useState<'title' | 'subTitle' | 'summary' | 'ctaText' | null>(null);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [selectedSlideElement, setSelectedSlideElement] = useState<{ type: 'title' | 'bullet', index?: number } | null>(null);
  const [selectionFontSize, setSelectionFontSize] = useState<number>(24);
  const [bgGenPrompt, setBgGenPrompt] = useState("");
  const [showBgGenModal, setShowBgGenModal] = useState(false);
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);

  const applySelectionStyle = (property: string, value?: any) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const activeElement = document.activeElement as HTMLElement;

    try {
      // Use execCommand for simple toggles if possible, but for fontSize/color we use our manual span wrapping
      if (property === 'bold' || property === 'italic' || property === 'underline') {
        document.execCommand(property, false, value);
      } else {
        const span = document.createElement("span");
        
        // Get existing styles if we're inside a span already
        let parent = range.commonAncestorContainer;
        if (parent.nodeType !== 1) parent = parent.parentElement as HTMLElement;
        
        const existingStyle = (parent as HTMLElement).style;
        
        // Copy existing styles to combine them if parent is a span
        if (parent && (parent as HTMLElement).tagName === 'SPAN') {
          span.style.cssText = existingStyle.cssText;
        }

        // Apply new property
        if (property === 'fontSize') span.style.fontSize = `${value}px`;
        if (property === 'color') span.style.color = value;
        
        span.style.lineHeight = "1.2";

        const fragment = range.extractContents();
        span.appendChild(fragment);
        range.insertNode(span);

        // Restore selection
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }

      if (activeElement && activeElement.isContentEditable) {
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch (e) {
      console.error("Advanced style application failed", e);
      try {
        document.execCommand(property, false, value);
      } catch (e2) {}
    }
  };
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        let parent = range.commonAncestorContainer;
        if (parent.nodeType !== 1) parent = parent.parentElement as HTMLElement;
        
        const style = window.getComputedStyle(parent as Element);
        const fontSize = parseInt(style.fontSize);
        if (!isNaN(fontSize)) {
          setSelectionFontSize(fontSize);
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const [selectedSlideImageId, setSelectedSlideImageId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string>("Teacher");
  const [activeWallpaperCategory, setActiveWallpaperCategory] = useState<string>('Abstract');
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [imageSearchResults, setImageSearchResults] = useState<{url: string, sourceName: string, sourceLogo: string, title: string}[]>([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [imageSearchPage, setImageSearchPage] = useState(1);

  const imageSearchCategories = [
    { label: 'Clip art', icon: <Palette size={14} />, color: 'bg-orange-50 text-orange-600' },
    { label: 'Graphic', icon: <Layout size={14} />, color: 'bg-blue-50 text-blue-600' },
    { label: 'Animations', icon: <Zap size={14} />, color: 'bg-purple-50 text-purple-600' },
    { label: 'Photos', icon: <Camera size={14} />, color: 'bg-green-50 text-green-600' }
  ];

  const wallpaperCategories = ['Abstract', 'Pastel'];

  const GOOGLE_FONTS = [
    'Inter', 'Bangers', 'Fredoka One', 'Lobster', 'Montserrat', 
    'Playfair Display', 'Space Grotesk', 'Bungee', 'Chewy', 'Pacifico'
  ];
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [imageTab, setImageTab] = useState<'assets' | 'search' | 'backgrounds'>('assets');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [userProjects, setUserProjects] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [isFetchingProjects, setIsFetchingProjects] = useState(false);
  const [isFetchingFolders, setIsFetchingFolders] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isMovingProject, setIsMovingProject] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [lessonInput, setLessonInput] = useState('');
  const [yearGroup, setYearGroup] = useState('Year 3');
  const [subject, setSubject] = useState('');
  const [lexileLevel, setLexileLevel] = useState('400-500');
  const [numSlides, setNumSlides] = useState(10);
  const [numQuestions, setNumQuestions] = useState(8);
  const [includeStory, setIncludeStory] = useState(false);
  const [posterOnly, setPosterOnly] = useState(false);
  const [isTemplateMode, setIsTemplateMode] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});
  const [manualLink, setManualLink] = useState('');

  // Undo/Redo State
  const [historyStack, setHistoryStack] = useState<EduContent[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isInternalUpdate = useRef(false);

  const pushToHistory = (newContent: EduContent) => {
    if (isInternalUpdate.current) return;
    setHistoryStack(prev => {
      const newStack = prev.slice(0, historyIndex + 1);
      newStack.push(JSON.parse(JSON.stringify(newContent)));
      if (newStack.length > 50) newStack.shift();
      return newStack;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  };

  // Auth Handler
   const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setAuthError('Email and password are required.');
      return;
    }

    try {
      if (authMode === 'register') {
        const res = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(res.user, { displayName: registerName });
        // Set teacher name immediately for UI
        setTeacherName(registerName);
        // Create user profile in Firestore
        try {
          await setDoc(doc(db, 'users', res.user.uid), {
            uid: res.user.uid,
            email: res.user.email || cleanEmail,
            teacherName: registerName,
            roles: registerRoles,
            createdAt: new Date().toISOString()
          });
          setUserRoles(registerRoles);
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.WRITE, `users/${res.user.uid}`);
        }
      } else {
        const res = await signInWithEmailAndPassword(auth, cleanEmail, password);
        // Set name from profile immediately if available
        if (res.user.displayName) {
          setTeacherName(res.user.displayName);
        } else if (res.user.email) {
          setTeacherName(res.user.email.split('@')[0]);
        }
      }
    } catch (err: any) {
      setAuthError(getFriendlyAuthError(err));
      console.error("Auth Error:", err);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setTeacherName("Teacher");
    clearWorkspace();
    setCurrentView('home');
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        // Immediate fallback from Auth profile
        const fallbackName = fbUser.displayName || fbUser.email?.split('@')[0] || "Educator";
        setTeacherName(fallbackName);

        // Fetch teacher name from Firestore profile
        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.teacherName) {
              setTeacherName(data.teacherName);
            }
            if (data.roles) {
              // Bootstrap admin check
              const consolidatedRoles = [...data.roles];
              if (ADMIN_EMAILS.includes(fbUser.email?.toLowerCase() || '') && !consolidatedRoles.includes('admin')) {
                consolidatedRoles.push('admin');
              }
              setUserRoles(consolidatedRoles);
            } else if (ADMIN_EMAILS.includes(fbUser.email?.toLowerCase() || '')) {
              setUserRoles(['admin', 'educator']);
            }
          } else if (ADMIN_EMAILS.includes(fbUser.email?.toLowerCase() || '')) {
            // Case where document doesn't exist yet but user is an admin
            setUserRoles(['admin', 'educator']);
          }
        } catch (err: any) {
          if (err.message?.includes('offline')) {
             console.warn("Firestore is offline, using auth profile fallback.");
          } else {
             console.error("Error fetching user profile:", err);
          }
          
          if (ADMIN_EMAILS.includes(fbUser.email?.toLowerCase() || '')) {
            setUserRoles(['admin', 'educator']);
          }
        }
      } else {
        setTeacherName("Guest");
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const undo = () => {
    if (historyIndex > 0) {
      isInternalUpdate.current = true;
      const prevIndex = historyIndex - 1;
      const prevContent = JSON.parse(JSON.stringify(historyStack[prevIndex]));
      setContent(prevContent);
      setHistoryIndex(prevIndex);
      setTimeout(() => { isInternalUpdate.current = false; }, 100);
    }
  };

  const redo = () => {
    if (historyIndex < historyStack.length - 1) {
      isInternalUpdate.current = true;
      const nextIndex = historyIndex + 1;
      const nextContent = JSON.parse(JSON.stringify(historyStack[nextIndex]));
      setContent(nextContent);
      setHistoryIndex(nextIndex);
      setTimeout(() => { isInternalUpdate.current = false; }, 100);
    }
  };

  // Auto-save to history stack with debounce
  const lastSavedContent = useRef<string>("");
  useEffect(() => {
    if (!content || isInternalUpdate.current) return;
    
    const handler = setTimeout(() => {
      const currentStr = JSON.stringify(content);
      if (currentStr !== lastSavedContent.current) {
        pushToHistory(content);
        lastSavedContent.current = currentStr;
      }
    }, 1000); // Debounce 1s

    return () => clearTimeout(handler);
  }, [content]);

  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      // Don't handle paste if it's in an input or textarea (unless it's our specific manualLink field maybe, but better to just let native behavior handle that)
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
        return;
      }

      if (!content) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      let foundImage = false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const base64 = event.target?.result as string;
              addSlideImage(base64);
            };
            reader.readAsDataURL(blob);
            foundImage = true;
            break; // Prioritize image blob over text URL if both present
          }
        }
      }

      if (!foundImage) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type === 'text/plain') {
            items[i].getAsString((text) => {
              const trimmed = text.trim();
              if (trimmed.startsWith('http') || trimmed.startsWith('data:image')) {
                // Simple validation to avoid accidentally pasting long texts that happen to start with http
                if (trimmed.length < 2048) {
                  addSlideImage(trimmed);
                }
              }
            });
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [content, currentSlideIdx]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, historyStack]);
  const [templateUploadMode, setTemplateUploadMode] = useState<'strict' | 'custom'>('strict');
  const [fileContext, setFileContext] = useState<{ mimeType: string, data: string, name: string } | null>(null);
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<string[]>(['Multiple Choice', 'Fill in the Blanks', 'Short Answer']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState("Generating...");

  const [isGeneratingWeek, setIsGeneratingWeek] = useState<{ index: number, type: 'slides' | 'worksheet' | 'plan' } | null>(null);
  const [isSuggesting, setIsSuggesting] = useState<'unit' | 'topic' | 'activity' | null>(null);
  const [selectedGenWeek, setSelectedGenWeek] = useState<number>(1);
  const [customGenUnit, setCustomGenUnit] = useState<string>('');
  const [customGenTopic, setCustomGenTopic] = useState<string>('');
  const [customGenActivity, setCustomGenActivity] = useState<string>('');

  const updateLessonPlanMetadata = (field: keyof NonNullable<EduContent['lessonPlan']>, value: string) => {
    setContent(prev => {
      const base = prev || {
        lessonTitle: lessonInput || "Untitled Lesson",
        subject: subject,
        gradeLevel: yearGroup,
        slides: [],
        slidesMetadata: { description: "", methodology: "" },
        worksheet: { title: "", description: "", methodology: "", sections: [] },
        poster: { title: "", keyPoints: [], summary: "", illustrationPrompt: "" },
        metadata: { yearGroup, lexileLevel, subject }
      };
      
      const lp = base.lessonPlan || {
        overallTopic: base.lessonTitle,
        subject: base.subject,
        term: "",
        duration: "",
        date: "",
        academicYear: "",
        class: "",
        preparedBy: "",
        checkedBy: "",
        weeklyBreakdown: []
      };

      return {
        ...base,
        lessonPlan: {
          ...lp,
          [field]: value
        }
      };
    });
  };

  const updateSlidesMetadata = (field: 'description' | 'methodology', value: string) => {
    setContent(prev => {
      const base = prev || {
        lessonTitle: lessonInput || "Untitled Lesson",
        subject: subject,
        gradeLevel: yearGroup,
        slides: [],
        slidesMetadata: { description: "", methodology: "" },
        worksheet: { title: "", description: "", methodology: "", sections: [] },
        poster: { title: "", keyPoints: [], summary: "", illustrationPrompt: "" },
        metadata: { yearGroup, lexileLevel, subject }
      };
      return {
        ...base,
        slidesMetadata: {
          ...(base.slidesMetadata || { description: "", methodology: "" }),
          [field]: value
        }
      };
    });
  };

  const updateWorksheetMetadata = (field: 'description' | 'methodology' | 'title' | 'readingPassage', value: string) => {
    setContent(prev => {
      const base = prev || {
        lessonTitle: lessonInput || "Untitled Lesson",
        subject: subject,
        gradeLevel: yearGroup,
        slides: [],
        slidesMetadata: { description: "", methodology: "" },
        worksheet: { title: "", description: "", methodology: "", sections: [] },
        poster: { title: "", keyPoints: [], summary: "", illustrationPrompt: "" },
        metadata: { yearGroup, lexileLevel, subject }
      };
      return {
        ...base,
        worksheet: {
          ...(base.worksheet || { title: "", description: "", methodology: "", sections: [] }),
          [field]: value
        }
      };
    });
  };

  const updateWorksheetSection = (sectionIdx: number, field: 'title' | 'instructions', value: string) => {
    setContent(prev => {
      if (!prev || !prev.worksheet) return prev;
      const newSections = [...prev.worksheet.sections];
      newSections[sectionIdx] = { ...newSections[sectionIdx], [field]: value };
      return {
        ...prev,
        worksheet: { ...prev.worksheet, sections: newSections }
      };
    });
  };

  const updateWorksheetQuestion = (sectionIdx: number, questionIdx: number, value: string) => {
    setContent(prev => {
      if (!prev || !prev.worksheet) return prev;
      const newSections = [...prev.worksheet.sections];
      const newQuestions = [...newSections[sectionIdx].questions];
      newQuestions[questionIdx] = { ...newQuestions[questionIdx], text: value };
      newSections[sectionIdx] = { ...newSections[sectionIdx], questions: newQuestions };
      return {
        ...prev,
        worksheet: { ...prev.worksheet, sections: newSections }
      };
    });
  };

  const removeWorksheetSection = (sectionIdx: number) => {
    console.log("🗑️ removeWorksheetSection index:", sectionIdx);
    if (window.confirm("Delete this entire section?")) {
      setContent(prev => {
        if (!prev || !prev.worksheet) return prev;
        const newSections = prev.worksheet.sections.filter((_, i) => i !== sectionIdx);
        return {
          ...prev,
          worksheet: { ...prev.worksheet, sections: newSections }
        };
      });
    }
  };

  const removeWorksheetQuestion = (sectionIdx: number, questionIdx: number) => {
    console.log("🗑️ removeWorksheetQuestion:", sectionIdx, questionIdx);
    if (window.confirm("Delete this question?")) {
      setContent(prev => {
        if (!prev || !prev.worksheet) return prev;
        const newSections = [...prev.worksheet.sections];
        const newQuestions = newSections[sectionIdx].questions.filter((_, i) => i !== questionIdx);
        newSections[sectionIdx] = { ...newSections[sectionIdx], questions: newQuestions };
        return {
          ...prev,
          worksheet: { ...prev.worksheet, sections: newSections }
        };
      });
    }
  };

  const updateWeeklyBreakdown = (index: number, field: string, value: string) => {
    setContent(prev => {
      if (!prev || !prev.lessonPlan) return prev;
      const newBreakdown = [...prev.lessonPlan.weeklyBreakdown];
      newBreakdown[index] = { ...newBreakdown[index], [field]: value };
      return {
        ...prev,
        lessonPlan: {
          ...prev.lessonPlan,
          weeklyBreakdown: newBreakdown
        }
      };
    });
  };

  const removeWeek = (index: number) => {
    if (window.confirm("ARE YOU SURE? This will remove this week from your term schedule.")) {
      setContent(prev => {
        if (!prev || !prev.lessonPlan) return prev;
        const newBreakdown = prev.lessonPlan.weeklyBreakdown.filter((_, i) => i !== index);
        // Also update week numbers if needed, but usually they are managed by index + 1 in view
        return {
          ...prev,
          lessonPlan: { ...prev.lessonPlan, weeklyBreakdown: newBreakdown }
        };
      });
    }
  };

  const sendLessonPlanEmail = () => {
    if (!content?.lessonPlan) return;
    const lp = content.lessonPlan;
    const subjectLine = encodeURIComponent(`Lesson Plan: ${lp.overallTopic}`);
    
    let body = `LESSON PLAN: ${lp.overallTopic}\n`;
    body += `==========================================\n\n`;
    body += `Term: ${lp.term || 'N/A'}\n`;
    body += `Subject: ${lp.subject || 'N/A'}\n`;
    body += `Academic Year: ${lp.academicYear || 'N/A'}\n`;
    body += `Class/Grade: ${lp.class || 'N/A'}\n`;
    body += `Duration: ${lp.duration || 'N/A'}\n`;
    body += `Prepared By: ${lp.preparedBy || 'N/A'}\n\n`;
    
    body += `WEEKLY DETAILS\n`;
    body += `------------------------------------------\n`;
    
    lp.weeklyBreakdown.forEach((w, idx) => {
      body += `WEEK ${w.week} (${w.unit})\n`;
      body += `Topic: ${w.topic}\n`;
      body += `Learning Objective: ${w.learningObjective}\n`;
      body += `Strand: ${w.strand}\n`;
      body += `Introduction: ${w.introduction}\n`;
      body += `Activities: ${w.activities}\n`;
      body += `Assessment: ${w.assessment}\n`;
      body += `Resources: ${w.resources}\n`;
      body += `------------------------------------------\n`;
    });
    
    body += `\nGenerated via EduMagic AI`;
    
    window.location.href = `mailto:?subject=${subjectLine}&body=${encodeURIComponent(body)}`;
  };

  const renderAuth = () => (
    <div className="fixed inset-0 bg-[#059669] flex items-center justify-center p-4 z-[2000]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[3rem] p-8 md:p-12 shadow-2xl w-full max-w-md border-8 border-white/20"
      >
        <div className="flex flex-col items-center gap-6 mb-8">
          <div className="w-20 h-20 bg-[#059669] rounded-2xl flex items-center justify-center transform rotate-12 shadow-lg">
            <BookOpen className="text-white" size={40} />
          </div>
          <div className="text-center">
            <h2 className="text-4xl font-black text-[#064E3B] uppercase tracking-tight">
              {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-[#059669] font-medium">EduMagic AI: Your Teaching Assistant</p>
          </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'register' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#059669] uppercase ml-4">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#059669]/50" size={18} />
                  <input 
                    type="text" 
                    required
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="Ms. Magic"
                    className="w-full h-14 pl-12 pr-6 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-2xl focus:border-[#059669] outline-none font-bold transition-all"
                  />
                </div>
              </div>
              
              <div className="space-y-2 py-2">
                <label className="text-xs font-bold text-[#059669] uppercase ml-4">Select Access Roles</label>
                <div className="flex gap-4 ml-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (registerRoles.includes('educator')) {
                        if (registerRoles.length > 1) setRegisterRoles(registerRoles.filter(r => r !== 'educator'));
                      } else {
                        setRegisterRoles([...registerRoles, 'educator']);
                      }
                    }}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-xl border-2 font-bold text-xs transition-all flex items-center justify-center gap-2",
                      registerRoles.includes('educator') ? "bg-[#059669] border-[#059669] text-white shadow-md" : "bg-white border-[#D1FAE5] text-[#059669]/50 hover:bg-[#F0FDF4]"
                    )}
                  >
                    <BookOpen size={14} /> Educator
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (registerRoles.includes('admin')) {
                        if (registerRoles.length > 1) setRegisterRoles(registerRoles.filter(r => r !== 'admin'));
                      } else {
                        setRegisterRoles([...registerRoles, 'admin']);
                      }
                    }}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-xl border-2 font-bold text-xs transition-all flex items-center justify-center gap-2",
                      registerRoles.includes('admin') ? "bg-[#059669] border-[#059669] text-white shadow-md" : "bg-white border-[#D1FAE5] text-[#059669]/50 hover:bg-[#F0FDF4]"
                    )}
                  >
                    <LayoutGrid size={14} /> Admin
                  </button>
                </div>
                <p className="text-[10px] text-[#059669]/60 font-medium px-4">You can select either or both portals to access.</p>
              </div>
            </>
          )}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#059669] uppercase ml-4">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#059669]/50" size={18} />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@school.com"
                className="w-full h-14 pl-12 pr-6 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-2xl focus:border-[#059669] outline-none font-bold transition-all"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#059669] uppercase ml-4">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#059669]/50" size={18} />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-14 pl-12 pr-6 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-2xl focus:border-[#059669] outline-none font-bold transition-all"
              />
            </div>
          </div>

          {authError && (
            <p className="text-red-500 text-sm font-bold text-center px-4 bg-red-50 py-2 rounded-xl border border-red-100">
              {authError}
            </p>
          )}

          <button 
            type="submit" 
            className="w-full h-16 bg-[#059669] hover:bg-[#047857] text-white rounded-2xl font-black text-xl shadow-[0_8px_0_#064E3B] active:shadow-none active:translate-y-2 transition-all flex items-center justify-center gap-3 uppercase tracking-wider"
          >
            {authMode === 'login' ? <LogIn size={24} /> : <UserPlus size={24} />}
            {authMode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login');
              setAuthError('');
            }}
            className="text-[#059669] font-bold hover:underline"
          >
            {authMode === 'login' ? "Don't have an account? Register here" : "Already have an account? Sign In"}
          </button>
        </div>
      </motion.div>
    </div>
  );

  const generateSlidesForWeek = async (weekIdx: number) => {
    console.log("Generating slides for week:", weekIdx);
    const week = content?.lessonPlan?.weeklyBreakdown[weekIdx];
    if (!week) return;

    setGeneratingMessage(`Generating Slides for Week ${weekIdx + 1}...`);
    setIsGeneratingWeek({ index: weekIdx, type: 'slides' });
    setIsGenerating(true);
    try {
      const topic = (!week.topic || week.topic.toLowerCase().includes('auto-assign')) 
        ? `${content?.lessonPlan?.overallTopic} - Week ${week.week}: ${week.learningObjective}`
        : week.topic;

      const result = await generateSlides(topic, {
        yearGroup: content?.lessonPlan?.class || yearGroup,
        lexileLevel,
        subject: content?.lessonPlan?.subject || subject,
        numSlides: numSlides,
        numQuestions: 8,
        questionTypes: selectedQuestionTypes,
      });

      if (result && result.slides.length > 0) {
        setContent(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            slides: convertSlidesToMovable(result.slides),
            slidesMetadata: result.metadata,
            lessonTitle: topic
          };
        });
        setCurrentSlideIdx(0);
        setWorkspaceMode('slides');
        setCurrentView('slides');
      } else {
        alert("Generated slides were empty. Please try again.");
      }
    } catch (err: any) {
      handleEduError(err, "Generate slides");
    } finally {
      setIsGeneratingWeek(null);
      setIsGenerating(false);
    }
  };

  const generateWorksheetForWeek = async (weekIdx: number) => {
    const week = content?.lessonPlan?.weeklyBreakdown[weekIdx];
    if (!week) return;

    setGeneratingMessage(`Generating Worksheet for Week ${weekIdx + 1}...`);
    setIsGeneratingWeek({ index: weekIdx, type: 'worksheet' });
    setIsGenerating(true);
    try {
      const topic = (!week.topic || week.topic.toLowerCase().includes('auto-assign')) 
        ? `${content?.lessonPlan?.overallTopic} - Week ${week.week}: ${week.learningObjective}`
        : week.topic;

      const result = await generateWorksheet(topic, {
        yearGroup: content?.lessonPlan?.class || yearGroup,
        lexileLevel,
        subject: content?.lessonPlan?.subject || subject,
        numSlides: 0,
        numQuestions: 8,
        questionTypes: selectedQuestionTypes,
      });

      if (result) {
        setContent(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            worksheet: result,
            lessonTitle: topic
          };
        });
        setWorkspaceMode('worksheet');
        setCurrentView('worksheet');
      }
    } catch (err: any) {
      handleEduError(err, "Generate worksheet");
    } finally {
      setIsGeneratingWeek(null);
      setIsGenerating(false);
    }
  };

  const generateSpecificWeek = async () => {
    if (!customGenActivity.trim()) {
      alert("Please enter an activity description.");
      return;
    }
    
    setGeneratingMessage(`Generating Weekly Plan for Week ${selectedGenWeek}...`);
    setIsGeneratingWeek({ index: selectedGenWeek - 1, type: 'plan' });
    setIsGenerating(true);
    try {
      const weekData = await generateWeeklyPlan(customGenActivity, selectedGenWeek, {
        yearGroup: content?.lessonPlan?.class || yearGroup,
        lexileLevel,
        subject: content?.lessonPlan?.subject || subject,
        numSlides: 0,
        numQuestions: 0,
        questionTypes: [],
      }, customGenUnit, customGenTopic);
      
      if (weekData) {
        setContent(prev => {
          // Initialize base content if it's null
          const base = prev || {
            lessonTitle: lessonInput || customGenTopic || "Untitled Lesson",
            subject: subject,
            gradeLevel: yearGroup,
            slides: [],
            slidesMetadata: { description: "", methodology: "" },
            worksheet: { title: "", description: "", methodology: "", sections: [] },
            poster: { title: "", keyPoints: [], summary: "", illustrationPrompt: "" },
            metadata: { yearGroup, lexileLevel, subject }
          };

          const lessonPlan = base.lessonPlan || {
            overallTopic: base.lessonTitle,
            subject: base.subject,
            term: lpTerm,
            duration: lpDuration,
            date: lpDate,
            academicYear: lpAcademicYear,
            class: lpClass,
            preparedBy: lpPreparedBy,
            checkedBy: lpCheckedBy,
            weeklyBreakdown: []
          };
          
          const newBreakdown = [...lessonPlan.weeklyBreakdown];
          const existingIdx = newBreakdown.findIndex(w => w.week === selectedGenWeek);
          
          if (existingIdx >= 0) {
            newBreakdown[existingIdx] = weekData;
          } else {
            newBreakdown.push(weekData);
            newBreakdown.sort((a, b) => a.week - b.week);
          }
          
          return {
            ...base,
            lessonPlan: {
              ...lessonPlan,
              weeklyBreakdown: newBreakdown
            }
          };
        });
        setCustomGenActivity('');
        setCustomGenUnit('');
        setCustomGenTopic('');
        setWorkspaceMode('lesson-plan');
        setCurrentView('lesson-plan');
        
        // Scroll to the lesson plan ref
        setTimeout(() => {
          lessonPlanRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err: any) {
      handleEduError(err, "Generate weekly plan");
    } finally {
      setIsGeneratingWeek(null);
      setIsGenerating(false);
    }
  };

  const handleSuggestInput = async (type: 'unit' | 'topic' | 'activity') => {
    setIsSuggesting(type);
    try {
      const suggestion = await suggestWeeklyInput(type, {
        yearGroup: content?.lessonPlan?.class || yearGroup,
        lexileLevel,
        subject: content?.lessonPlan?.subject || subject,
        overallTopic: content?.lessonPlan?.overallTopic || lessonInput,
        numSlides: 0,
        numQuestions: 0,
        questionTypes: [],
      }, selectedGenWeek);
      
      if (type === 'unit') setCustomGenUnit(suggestion);
      if (type === 'topic') setCustomGenTopic(suggestion);
      if (type === 'activity') setCustomGenActivity(suggestion);
    } catch (err: any) {
      handleEduError(err, `Suggest ${type}`);
    } finally {
      setIsSuggesting(null);
    }
  };

  const downloadLessonPlanExcel = () => {
    if (!content?.lessonPlan) {
      alert("No lesson plan data to export.");
      return;
    }

    const { lessonPlan } = content;
    
    // Prepare metadata rows
    const metadata = [
      ["Cambridge International Lesson Plan"],
      [""],
      ["Subject", lessonPlan.subject || ""],
      ["Class/Grade", lessonPlan.class || ""],
      ["Academic Year", lessonPlan.academicYear || ""],
      ["Term", lessonPlan.term || ""],
      ["Date", lessonPlan.date || ""],
      ["Prepared By", lessonPlan.preparedBy || ""],
      ["Checked By", lessonPlan.checkedBy || ""],
      ["Overall Topic", lessonPlan.overallTopic || ""],
      [""],
      ["Weekly Breakdown"]
    ];

    // Prepare weekly breakdown rows
    const columns = ["Week", "Unit", "Topic", "Strand", "Learning Objective", "Introduction", "Activities", "Assessment", "Resources"];
    const weeklyData = lessonPlan.weeklyBreakdown.map(w => [
      w.week,
      w.unit,
      w.topic,
      w.strand,
      w.learningObjective,
      w.introduction,
      w.activities,
      w.assessment,
      w.resources
    ]);

    // Combine everything
    const wsData = [
      ...metadata,
      columns,
      ...weeklyData
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set some basic column widths
    const wscols = [
      { wch: 6 },  // Week
      { wch: 15 }, // Unit
      { wch: 25 }, // Topic
      { wch: 20 }, // Strand
      { wch: 40 }, // Learning Objective
      { wch: 50 }, // Introduction
      { wch: 50 }, // Activities
      { wch: 30 }, // Assessment
      { wch: 25 }  // Resources
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "Lesson Plan");

    // Download file
    const safeTitle = (lessonPlan.overallTopic || "lesson-plan").replace(/[^a-z0-9]/gi, '-').toLowerCase();
    XLSX.writeFile(wb, `Zera-LessonPlan-${safeTitle}.xlsx`);
  };

  const clearWorkspace = () => {
    setContent(null);
    setCurrentProjectId(prev => {
      // If we are clearing a specific project, we should also clear the history
      setHistoryStack([]);
      setHistoryIndex(-1);
      lastSavedContent.current = "";
      return null;
    });
    
    // Reset Core Config
    setYearGroup('Year 3');
    setSubject('Science');
    setLexileLevel('700L');
    setNumSlides(8);
    setNumQuestions(10);
    
    // Core Inputs
    setLessonInput('');
    
    // Lesson Plan States
    setLpTerm('1');
    setLpSubject('Science');
    setLpDuration('60 mins');
    setLpDate(new Date().toISOString().split('T')[0]);
    setLpAcademicYear(`${new Date().getFullYear()}/${new Date().getFullYear()+1}`);
    setLpClass('');
    setLpPreparedBy(teacherName);
    setLpCheckedBy('');
    setLpUnit(['', '', '', '', '', '']);
    setLpDescription('');
    setLpWeeklyTopics(['', '', '', '', '', '']);
    
    // Poster States
    setPosterCriteria('');
    setPosterDescription('');
    
    // Image Search States
    setImageSearchQuery('');
    setImageSearchResults([]);
    setImageSearchPage(1);
    
    // Tool Generation Suggestions
    setCustomGenUnit('');
    setCustomGenTopic('');
    setCustomGenActivity('');
    
    setFileContext(null);
    setCurrentSlideIdx(0);
    setSelectedSlideImageId(null);
    setSelectedSlideElement(null);
    setSelectedField(null);
    setSelectedStickerId(null);
  };

  const handleAddImageUrl = () => {
    const url = prompt("Paste the image URL from Google Images\n\n1. Search on Google\n2. Right-click the image you want\n3. Select 'Copy image address'\n4. Paste it here:");
    
    if (!url) return;

    if (url.startsWith('http') || url.startsWith('https') || url.startsWith('data:image')) {
      // Check if it's likely a search URL instead of a direct link
      if (url.includes('google.com/search') || url.includes('google.com/imgres')) {
        alert("Wait! It looks like you copied the Google Search page link instead of the image address.\n\nTo get the right link:\n1. Right-click the image itself\n2. Pick 'Copy image address'\n3. Try pasting again!");
        return;
      }
      addSlideImage(url);
    } else {
      alert("Invalid link! Please right-click an image and choose 'Copy image address'.");
    }
  };

  const handleImageSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsSearchingImages(true);
    setImageSearchResults([]);
    setImageSearchPage(1);
    
    try {
      const lowerQuery = query.toLowerCase().trim();
      let searchTags = lowerQuery.replace(/\s+/g, ",");
      
      // Auto-enhance search tags based on common category keywords
      if (lowerQuery.includes('clip art')) searchTags += ',illustration,vector,white-background';
      if (lowerQuery.includes('graphic')) searchTags += ',design,vector,clean';
      if (lowerQuery.includes('animation')) searchTags += ',cartoon,gif,dynamic';
      if (lowerQuery.includes('photo')) searchTags += ',photography,realistic,hd';
      
      const cleanedQuery = encodeURIComponent(searchTags);
      const sources = [
        { name: 'Microsoft', logo: 'https://www.google.com/s2/favicons?domain=microsoft.com&sz=32' },
        { name: 'Computer Hope', logo: 'https://www.google.com/s2/favicons?domain=computerhope.com&sz=32' },
        { name: 'Small Business - Chron', logo: 'https://www.google.com/s2/favicons?domain=chron.com&sz=32' },
        { name: 'W3Scoop', logo: 'https://www.google.com/s2/favicons?domain=w3schools.com&sz=32' },
        { name: 'ny times', logo: 'https://www.google.com/s2/favicons?domain=nytimes.com&sz=32' },
        { name: 'Productive Paths', logo: 'https://www.google.com/s2/favicons?domain=productive.com&sz=32' },
        { name: 'Etsy', logo: 'https://www.google.com/s2/favicons?domain=etsy.com&sz=32' },
        { name: 'Be Connected', logo: 'https://www.google.com/s2/favicons?domain=beconnected.gov.au&sz=32' },
        { name: 'Hitimu Academy', logo: 'https://www.google.com/s2/favicons?domain=hitimu.com&sz=32' }
      ];

      const adjectives = ['Professional', 'Advanced', 'Modern', 'Educational', 'Best', 'Top-rated', 'Latest'];
      
      const results = Array.from({ length: 120 }, (_, i) => {
        const source = sources[i % sources.length];
        const adj = adjectives[i % adjectives.length];
        
        // Define varied search contexts to ensure diversity in results
        const ctx = [
          'photography', 'studio', 'detailed', 'bright', 'clear', '4k'
        ];
        const context = ctx[i % ctx.length];
        
        return {
          // REMOVED /g/ to ensure color images, added /all for strict relevance
          url: `https://loremflickr.com/800/600/${cleanedQuery},${context}/all?lock=${6000 + i}`,
          sourceName: source.name,
          sourceLogo: source.logo,
          title: `${query.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} - ${adj} High Resolution ${source.name} Asset`
        };
      });
      
      await new Promise(r => setTimeout(r, 1200));
      setImageSearchResults(results);
    } catch (error) {
      console.error("Image search failed", error);
    } finally {
      setIsSearchingImages(false);
    }
  };

  const itemsPerPage = 6;
  const paginatedImages = imageSearchResults.slice(
    (imageSearchPage - 1) * itemsPerPage,
    imageSearchPage * itemsPerPage
  );
  const totalPages = Math.ceil(imageSearchResults.length / itemsPerPage);


  const submitToAdmin = async () => {
    if (!user) return;
    
    try {
      if (content) {
        const id = currentProjectId || Date.now().toString();
        await setDoc(doc(db, 'projects', id), {
          id,
          userId: user.uid,
          timestamp: Date.now(),
          content,
          category: workspaceMode,
          title: content.lessonTitle || content.lessonPlan?.overallTopic || "Untitled Project",
          status: 'submitted',
          teacherName: teacherName,
          settings: {
            posterOnly,
            includeStory,
            isTemplateMode,
            workspaceMode
          }
        });
        setCurrentProjectId(id);
      }
      alert("Successfully submitted to Admin Dashboard!");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'projects/current');
    }
  };

  const saveProject = async () => {
    if (!user || !content) return;
    
    try {
      const id = currentProjectId || Date.now().toString();
      const projectData = {
        id,
        userId: user.uid,
        timestamp: Date.now(),
        content,
        category: workspaceMode,
        title: content.lessonTitle || content.lessonPlan?.overallTopic || "Untitled Project",
        status: 'draft',
        teacherName: teacherName,
        settings: {
          posterOnly,
          includeStory,
          isTemplateMode,
          workspaceMode
        }
      };
      await setDoc(doc(db, 'projects', id), projectData);
      setCurrentProjectId(id);
      alert("Project saved successfully!");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `projects/${currentProjectId || 'new'}`);
    }
  };

  const loadProject = (project: any) => {
    setCurrentProjectId(project.id);
    setContent(project.content);
    setWorkspaceMode(project.category || project.settings?.workspaceMode || 'slides');
    setPosterOnly(project.settings?.posterOnly || false);
    setIncludeStory(project.settings?.includeStory || false);
    setIsTemplateMode(project.settings?.isTemplateMode || false);
    
    // Navigate to the correct view
    if (project.category === 'lesson-plan') setCurrentView('lesson-plan');
    else if (project.category === 'slides') setCurrentView('slides');
    else if (project.category === 'worksheet') setCurrentView('worksheet');
    else if (project.category === 'poster') setCurrentView('poster');
    else setCurrentView('slides');
  };

  const deleteProject = async (projectId: string) => {
    if (typeof window !== 'undefined' && !window.confirm("Are you sure you want to delete this project?")) return;
    try {
      await deleteDoc(doc(db, 'projects', projectId));
      if (currentProjectId === projectId) {
        clearWorkspace();
      }
      alert("Project deleted successfully!");
    } catch (err) {
      console.error("Error deleting project:", err);
      handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}`);
    }
  };

  const createFolder = async (name: string) => {
    if (!user || !name.trim()) return;
    try {
      const id = Date.now().toString();
      await setDoc(doc(db, 'folders', id), {
        id,
        userId: user.uid,
        name: name.trim(),
        timestamp: Date.now()
      });
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'folders/new');
    }
  };

  const deleteFolder = async (folderId: string) => {
    if (!confirm("Are you sure? This will NOT delete projects inside, they will move to 'All Projects'.")) return;
    try {
      const projectsToUpdate = userProjects.filter(p => p.folderId === folderId);
      if (projectsToUpdate.length > 0) {
        const batch = writeBatch(db);
        projectsToUpdate.forEach(p => {
          batch.update(doc(db, 'projects', p.id), { folderId: deleteField() });
        });
        await batch.commit();
      }
      await deleteDoc(doc(db, 'folders', folderId));
      if (activeFolderId === folderId) setActiveFolderId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `folders/${folderId}`);
    }
  };

  const moveProjectToFolder = async (projectId: string, folderId: string | null) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        folderId: folderId || deleteField()
      });
      setIsMovingProject(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}`);
    }
  };

  useEffect(() => {
    if (!user) {
      setUserProjects([]);
      setFolders([]);
      return;
    }

    setIsFetchingProjects(true);
    setIsFetchingFolders(true);

    const projectsQ = query(
      collection(db, 'projects'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const foldersQ = query(
      collection(db, 'folders'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeProjects = onSnapshot(projectsQ, (snapshot) => {
      const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUserProjects(projects);
      setIsFetchingProjects(false);
    }, (error) => {
      console.error("Error setting up projects listener:", error);
      setIsFetchingProjects(false);
    });

    const unsubscribeFolders = onSnapshot(foldersQ, (snapshot) => {
      const foldersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFolders(foldersList);
      setIsFetchingFolders(false);
    }, (error) => {
      console.error("Error setting up folders listener:", error);
      setIsFetchingFolders(false);
    });

    return () => {
      unsubscribeProjects();
      unsubscribeFolders();
    };
  }, [user]);

  const updateSlideData = (index: number, field: string, value: any) => {
    setContent(prev => {
      if (!prev || !prev.slides) return prev;
      const newSlides = [...prev.slides];
      newSlides[index] = { ...newSlides[index], [field]: value };
      return { ...prev, slides: newSlides };
    });
  };

  const updateSlideContent = (slideIdx: number, pointIdx: number, value: string) => {
    setContent(prev => {
      if (!prev || !prev.slides) return prev;
      const newSlides = [...prev.slides];
      const newPoints = [...newSlides[slideIdx].content];
      newPoints[pointIdx] = value;
      newSlides[slideIdx] = { ...newSlides[slideIdx], content: newPoints };
      return { ...prev, slides: newSlides };
    });
  };

  const updateSlideFontSettings = (slideIdx: number, type: 'title' | 'bullet', settings: Partial<FontSettings>, elementIdx?: number) => {
    setContent(prev => {
      if (!prev || !prev.slides) return prev;
      const newSlides = [...prev.slides];
      const slide = newSlides[slideIdx];
      
      if (type === 'title') {
        const existingSettings = slide.titleSettings || {};
        newSlides[slideIdx] = { 
          ...slide, 
          titleSettings: { ...existingSettings, ...settings } 
        };
      } else {
        // If elementIdx is provided, update the specific bullet
        if (elementIdx !== undefined) {
          const individualSettings = [...(slide.individualBulletSettings || [])];
          // Ensure the array is long enough
          while (individualSettings.length < slide.content.length) {
            individualSettings.push(undefined);
          }
          const existing = individualSettings[elementIdx] || slide.bulletSettings || {};
          individualSettings[elementIdx] = { ...existing, ...settings };
          newSlides[slideIdx] = { 
            ...slide, 
            individualBulletSettings: individualSettings 
          };
        } else {
          // Update global bullet settings for the slide
          const existingSettings = slide.bulletSettings || {};
          newSlides[slideIdx] = { 
            ...slide, 
            bulletSettings: { ...existingSettings, ...settings } 
          };
        }
      }
      return { ...prev, slides: newSlides };
    });
  };

  // --- Proxy Helper ---
  const getProxiedUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/') || url.includes('localhost')) {
      return url;
    }
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  };

  const addSlideImage = (url: string) => {
    if (!content || !content.slides) return;
    const slide = content.slides[currentSlideIdx];
    
    // Improved staggering logic to prevent overlapping and ensure visibility
    const count = slide.images?.length || 0;
    // Larger grid area for better visibility
    const colCount = 3;
    const rowCount = 3;
    const col = count % colCount;
    const row = Math.floor(count / colCount) % rowCount;
    
    // Add a controlled jitter
    const jitterX = (count % 4) * 20;
    const jitterY = (Math.floor(count / 2) % 3) * 15;
    
    const proxiedUrl = getProxiedUrl(url);
    
    const newImage: SlideImage = {
      id: Math.random().toString(36).substring(2, 9),
      url: proxiedUrl,
      x: 50 + (col * 280) + jitterX,
      y: 50 + (row * 180) + jitterY,
      size: 320, // Increased size for "fuller" view
      rotation: 0
    };
    const updatedSlides = [...content.slides];
    updatedSlides[currentSlideIdx] = {
      ...slide,
      images: [...(slide.images || []), newImage]
    };
    setContent(prev => prev ? ({ ...prev, slides: updatedSlides }) : prev);
    setSelectedSlideImageId(newImage.id);
  };

  const addSlideShape = (shape: 'square' | 'circle' | 'triangle' | 'star') => {
    if (!content || !content.slides) return;
    const slide = content.slides[currentSlideIdx];
    const newShape: SlideImage = {
      id: Math.random().toString(36).substring(2, 9),
      shape,
      color: activeTheme.accentColor,
      x: 400,
      y: 150,
      size: 100,
      rotation: 0
    };
    const updatedSlides = [...content.slides];
    updatedSlides[currentSlideIdx] = {
      ...slide,
      images: [...(slide.images || []), newShape]
    };
    setContent(prev => prev ? ({ ...prev, slides: updatedSlides }) : prev);
    setSelectedSlideImageId(newShape.id);
  };

  const updateSlideImage = (id: string, updates: any) => {
    if (!content || !content.slides) return;
    const slide = content.slides[currentSlideIdx];
    const updatedImages = (slide.images || []).map(img => img.id === id ? { ...img, ...updates } : img);
    const updatedSlides = [...content.slides];
    updatedSlides[currentSlideIdx] = { ...slide, images: updatedImages };
    setContent(prev => prev ? ({ ...prev, slides: updatedSlides }) : prev);
  };

  const removeSlideImage = (id: string | null) => {
    if (!id || !content || !content.slides) return;
    const slide = content.slides[currentSlideIdx];
    const updatedImages = (slide.images || []).filter(img => String(img.id) !== String(id));
    const updatedSlides = [...content.slides];
    updatedSlides[currentSlideIdx] = { ...slide, images: updatedImages };
    setContent(prev => prev ? ({ ...prev, slides: updatedSlides }) : prev);
    if (selectedSlideImageId === id) setSelectedSlideImageId(null);
  };

  const removeSlide = (index: number) => {
    if (!content?.slides || content.slides.length <= 1) {
      alert("A presentation must have at least one slide.");
      return;
    }
    if (window.confirm("ARE YOU SURE? This will permanently delete this slide and its contents. This cannot be undone.")) {
      const oldLength = content.slides.length;
      setContent(prev => {
        if (!prev || !prev.slides) return prev;
        const newSlides = [...prev.slides];
        newSlides.splice(index, 1);
        return { ...prev, slides: newSlides };
      });
      setCurrentSlideIdx(prev => {
        const nextIdx = index >= oldLength - 1 ? index - 1 : index;
        return Math.max(0, nextIdx);
      });
    }
  };

  const resetSlides = () => {
    clearWorkspace();
    setContent({
      lessonTitle: "Untitled Presentation",
      subject: "General",
      gradeLevel: "1",
      slides: [
        {
          type: 'title',
          title: "New Presentation",
          content: ["Add your bullet points here"],
          backgroundColor: "#ffffff"
        }
      ],
      metadata: { yearGroup: "1", lexileLevel: "N/A", subject: "General" }
    });
    setWorkspaceMode('slides');
    setSidebarTab('slides');
    setCurrentView('slides');
  };

  const resetWorksheet = () => {
    clearWorkspace();
    setContent({
      lessonTitle: "Untitled Worksheet",
      subject: "General",
      gradeLevel: "1",
      slides: [],
      worksheet: {
        title: "New Worksheet",
        sections: [
          {
            title: "Getting Started",
            instructions: "Complete the tasks below",
            questions: [{ text: "Enter your question here", type: 'short-answer' }]
          }
        ]
      },
      metadata: { yearGroup: "1", lexileLevel: "N/A", subject: "General" }
    });
    setWorkspaceMode('worksheet');
    setCurrentView('worksheet');
  };

  const resetPoster = () => {
    clearWorkspace();
    setContent({
      lessonTitle: "Untitled Poster",
      subject: "General",
      gradeLevel: "1",
      slides: [],
      poster: {
        title: "New Educational Poster",
        keyPoints: ["Point 1", "Point 2"],
        summary: "Enter a brief summary here",
        illustrationPrompt: "An inspiring education background"
      },
      metadata: { yearGroup: "1", lexileLevel: "N/A", subject: "General" }
    });
    setWorkspaceMode('poster');
    setCurrentView('poster');
  };

  const resetLessonPlan = () => {
    clearWorkspace();
    setContent({
      lessonTitle: "Untitled Lesson Plan",
      subject: "General",
      gradeLevel: "1",
      slides: [],
      lessonPlan: {
        term: "1",
        subject: "General",
        duration: "60 mins",
        date: new Date().toISOString().split('T')[0],
        academicYear: `${new Date().getFullYear()}/${new Date().getFullYear()+1}`,
        class: "",
        preparedBy: teacherName,
        checkedBy: "",
        overallTopic: "New Lesson Plan",
        weeklyBreakdown: [
          {
            week: 1,
            unit: "Unit 1",
            topic: "Introduction",
            learningObjective: "Understand the basics",
            strand: "General",
            introduction: "Opening discussion",
            activities: "Guided practice",
            assessment: "Q&A",
            resources: "Handouts"
          }
        ]
      },
      metadata: { yearGroup: "1", lexileLevel: "N/A", subject: "General" }
    });
    setWorkspaceMode('lesson-plan');
    setCurrentView('lesson-plan');
  };

  const convertSlidesToMovable = (slides: SlideContent[]): SlideContent[] => {
    return slides.map(slide => {
      if (slide.imageUrl && (!slide.images || slide.images.length === 0)) {
        return {
          ...slide,
          images: [
            {
              id: Math.random().toString(36).substring(2, 9),
              url: slide.imageUrl,
              x: 450,
              y: 100,
              size: 300,
              rotation: 0
            }
          ],
          imageUrl: "" // Clear static image
        };
      }
      return slide;
    });
  };

  const generateOnlySlides = async () => {
    const topic = lessonInput.trim() || content?.lessonTitle || content?.lessonPlan?.overallTopic;
    if (!topic) return;
    setGeneratingMessage("Generating Slides...");
    setIsGenerating(true);
    const result = await generateSlides(topic, {
      yearGroup: content?.gradeLevel || yearGroup,
      lexileLevel: content?.metadata?.lexileLevel || lexileLevel,
      subject: content?.subject || subject,
      numSlides,
      numQuestions,
      questionTypes: selectedQuestionTypes,
      metadataHints: content?.slidesMetadata
    });
    if (result) {
      const topicToSave = topic;
      // Convert static imageURLs to movable images for the new slides
      const slidesWithMovableImages = convertSlidesToMovable(result.slides);

      setContent(prev => {
        const base = prev || {
          lessonTitle: topicToSave,
          subject: subject,
          gradeLevel: yearGroup,
          slides: [],
          slidesMetadata: { description: "", methodology: "" },
          worksheet: { title: "", description: "", methodology: "", sections: [] },
          poster: { title: "", keyPoints: [], summary: "", illustrationPrompt: "" },
          metadata: { yearGroup, lexileLevel, subject }
        };
        const updated = {
          ...base,
          slides: slidesWithMovableImages,
          slidesMetadata: {
            description: base.slidesMetadata?.description || result.metadata.description || "",
            methodology: base.slidesMetadata?.methodology || result.metadata.methodology || ""
          }
        };
        // saveToVault('slides', true, updated, topicToSave);
        return updated;
      });
      setCurrentSlideIdx(0);
      setWorkspaceMode('slides');
      setSidebarTab('slides');
      setCurrentView('slides');
    }
    setIsGenerating(false);
  };

  const generateOnlyWorksheet = async (basedOnSlides: boolean = false) => {
    if (!lessonInput.trim() && !basedOnSlides) return;
    setGeneratingMessage("Generating Worksheet...");
    setIsGenerating(true);
    const result = await generateWorksheet(
      lessonInput || (content?.lessonTitle || ""), 
      {
        yearGroup,
        lexileLevel,
        subject,
        numSlides,
        numQuestions,
        questionTypes: selectedQuestionTypes,
        metadataHints: content?.worksheet
      },
      basedOnSlides ? content?.slides : undefined
    );
    if (result) {
      const worksheetData = {
        ...result,
        description: content?.worksheet?.description || result.description || "",
        methodology: content?.worksheet?.methodology || result.methodology || ""
      };
      const eduContent: EduContent = content ? { ...content, worksheet: worksheetData } : {
        lessonTitle: lessonInput || result.title,
        subject,
        gradeLevel: yearGroup,
        slides: [],
        slidesMetadata: { description: "", methodology: "" },
        worksheet: worksheetData,
        poster: { title: "", keyPoints: [], summary: "", illustrationPrompt: "" },
        metadata: { yearGroup, lexileLevel, subject }
      };
      setContent(eduContent);
      setWorkspaceMode('worksheet');
      setCurrentView('worksheet');
      setSidebarTab('history'); // Fallback

      // Auto-save to vault commented out per user request
      // saveToVault('worksheet', true, eduContent, lessonInput || result.title);
    }
    setIsGenerating(false);
  };

  const generateOnlyPoster = async () => {
    if (!lessonInput.trim()) return;
    setGeneratingMessage("Generating Poster...");
    setIsGenerating(true);
    const result = await generatePoster(lessonInput, posterDescription, {
      yearGroup,
      lexileLevel,
      subject,
      numSlides,
      numQuestions: 0,
      questionTypes: [],
    });
    if (result) {
      const eduContent: EduContent = content ? { ...content, poster: result } : {
        lessonTitle: lessonInput,
        subject,
        gradeLevel: yearGroup,
        slides: [],
        worksheet: { title: "", sections: [] },
        poster: result,
        metadata: { yearGroup, lexileLevel, subject }
      };
      setContent(eduContent);
      setWorkspaceMode('poster');

      // Auto-save to vault commented out per user request
      // saveToVault('poster', true, eduContent, lessonInput);
    }
    setIsGenerating(false);
  };

  const generateLP = async () => {
    const focus = lpDescription.trim() || `Produce a comprehensive 6-week Cambridge curriculum-aligned lesson plan for ${yearGroup} ${lpSubject || subject}. Focus on active learning and progressive skill development.`;
    
    setGeneratingMessage("Generating Lesson Plan...");
    setIsGenerating(true);
    try {
      const result = await generateLessonPlan(focus, {
        yearGroup,
        lexileLevel,
        subject: lpSubject,
        numSlides: 0,
        numQuestions: 0,
        questionTypes: [],
        term: lpTerm,
        duration: lpDuration,
        date: lpDate,
        academicYear: lpAcademicYear,
        class: lpClass,
        preparedBy: lpPreparedBy,
        checkedBy: lpCheckedBy,
        unit: lpUnit.map(u => u.trim() || undefined),
        topics: lpWeeklyTopics.map(t => t.trim() || undefined),
      });
      if (result) {
        const eduContent: EduContent = content ? { ...content, lessonPlan: result } : {
          lessonTitle: result.overallTopic || lpDescription,
          subject: lpSubject,
          gradeLevel: yearGroup,
          slides: [],
          worksheet: { title: "", sections: [] },
          poster: { title: "", keyPoints: [], summary: "", illustrationPrompt: "" },
          lessonPlan: result,
          metadata: { yearGroup, lexileLevel, subject: lpSubject }
        };
        setContent(eduContent);
        setWorkspaceMode('lesson-plan');
        setCurrentView('lesson-plan');

        // Auto-save to vault
        // saveToVault('lesson-plan', true, eduContent, result.overallTopic || lpDescription);
      }
    } catch (err: any) {
      handleEduError(err, "Generate lesson plan");
    } finally {
      setIsGenerating(false);
    }
  };

  const QUESTION_TYPES = [
    'Multiple Choice',
    'True/False',
    'Fill in the Blanks',
    'Short Answer',
    'Matching',
    'Vocabulary Check',
    'Scenario Based',
    'Drawing or Creative Task'
  ];
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [imageEditorCallback, setImageEditorCallback] = useState<{ cb: (newUrl: string) => void }>({ cb: () => {} });
  const [currentView, setCurrentView] = useState<'home' | 'educator-suite' | 'lesson-plan' | 'slides' | 'worksheet' | 'poster' | 'admin'>('home');
  const [adminTab, setAdminTab] = useState<'overview' | 'timetable' | 'teachers' | 'plans' | 'members'>('overview');
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  
  useEffect(() => {
    if (adminTab === 'members' && user) {
      fetchMembers();
    }
  }, [adminTab, user]);

  const fetchMembers = async () => {
    setIsLoadingMembers(true);
    setAllMembers([]); // Clear existing list for visual feedback of refresh
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      // Force fetch from server to bypass cache
      const snapshot = await getDocsFromServer(q);
      const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllMembers(members);
      console.log(`Fetched ${members.length} members from server.`);
    } catch (err) {
      console.error("Fetch members failed:", err);
      // Fallback to cache if server is unavailable
      try {
        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllMembers(members);
      } catch (cacheErr) {
        handleFirestoreError(cacheErr, OperationType.GET, 'users');
      }
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const deleteMember = async (memberId: string, e?: React.MouseEvent) => {
    if (!memberId) {
      alert("Invalid member ID.");
      return;
    }

    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    if (!window.confirm("Are you sure you want to delete this member? This will permanently remove their access to the platform.")) return;
    
    console.log("Admin: Initiating delete for member:", memberId);
    try {
      await deleteDoc(doc(db, 'users', memberId));
      console.log("Admin: Delete successful for member:", memberId);
      
      // Update local state first for immediate UI feedback
      setAllMembers(prev => prev.filter(m => m.id !== memberId));
      
      // Force refresh from server to be absolutely sure
      await fetchMembers();
      alert("Success! The member has been removed from the directory.");
    } catch (err: any) {
      console.error("Admin: Member deletion ERROR:", err);
      const isPermissionError = err.code === 'permission-denied' || (err.message && err.message.toLowerCase().includes('permission'));
      
      let msg = `Failed to delete member: ${err.message || 'Unknown error'}`;
      if (isPermissionError) {
        msg = "🚫 Access Denied\n\nYou do not have permission to delete users. Only the system owner has these rights.";
      }
      
      alert(msg);
      handleFirestoreError(err, OperationType.DELETE, `users/${memberId}`);
    }
  };

  const [teachers, setTeachers] = useState<{id: string, name: string, subjects: string[]}[]>(
    Array.from({length: 13}, (_, i) => ({
      id: `t-${i}`,
      name: `Teacher ${i + 1}`,
      subjects: [`Subject ${i % 13 + 1}`]
    }))
  );
  
  const subjects = [
    "English", "Mathematics", "Science", "History", "Geography", 
    "Art", "Music", "Physical Education", "ICT", "Foreign Language",
    "Social Studies", "Moral Education", "Library"
  ];

  const yearGroups = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6", "Year 7", "Year 8", "Year 9", "Year 10"];
  const [sidebarTab, setSidebarTab] = useState<'templates' | 'slides'>('slides');
  const [workspaceMode, setWorkspaceMode] = useState<'slides' | 'poster' | 'worksheet' | 'lesson-plan'>('slides');

  // Clear local storage on initial mount to ensure a fresh start
  useEffect(() => {
    localStorage.removeItem('zera_current_settings');
    localStorage.removeItem('zera_history');
    clearWorkspace();
  }, []);

  // --- State Sync ---
  // History and settings persistence removed as requested for a fresh start every time

  // --- New Lesson Plan State ---
  const [lpTerm, setLpTerm] = useState('');
  const [lpSubject, setLpSubject] = useState('');
  const [lpDuration, setLpDuration] = useState('');
  const [lpDate, setLpDate] = useState('');
  const [lpAcademicYear, setLpAcademicYear] = useState('');
  const [lpClass, setLpClass] = useState('');
  const [lpPreparedBy, setLpPreparedBy] = useState('');
  const [lpCheckedBy, setLpCheckedBy] = useState('');
  const [lpUnit, setLpUnit] = useState<string[]>(['', '', '', '', '', '']);
  const [lpDescription, setLpDescription] = useState('');
  const [lpWeeklyTopics, setLpWeeklyTopics] = useState<string[]>(['', '', '', '', '', '']);
  
  // --- Poster State ---
  const [posterCriteria, setPosterCriteria] = useState('');
  const [posterDescription, setPosterDescription] = useState('');

  const worksheetRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const lessonPlanRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [customThemes, setCustomThemes] = useState<AppTheme[]>([]);

  const renderAdmin = () => {
    const isPrimary = (yg: string) => ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"].includes(yg);
    
    // Time slot generation
    const getSlots = (day: string, yearGroup: string) => {
      const slots = [];
      let current = new Date();
      current.setHours(8, 30, 0, 0);
      
      const isFri = day === "Friday";
      const endHour = isFri ? 13 : (isPrimary(yearGroup) ? 14 : 15);
      const endMin = isFri ? 10 : (isPrimary(yearGroup) ? 30 : 0);
      
      const endTime = new Date();
      endTime.setHours(endHour, endMin, 0, 0);
      
      while (current < endTime) {
        const slotEnd = new Date(current.getTime() + 35 * 60000);
        if (slotEnd > endTime) break;
        
        slots.push({
          start: current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          end: slotEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        current = slotEnd;
      }
      return slots;
    };

    return (
      <div className="flex-1 flex flex-col h-screen bg-[#F0FDF4] overflow-hidden">
        {/* Admin Nav */}
        <header className="h-20 bg-white border-b-2 border-[#D1FAE5] px-12 flex items-center justify-between shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-8">
            <h2 className="text-2xl font-black text-[#064E3B]">Admin Dashboard</h2>
            <nav className="flex gap-4">
              {['overview', 'timetable', 'teachers', 'plans', 'members'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAdminTab(tab as any)}
                  className={cn(
                    "px-4 py-2 rounded-xl font-bold capitalize transition-all",
                    adminTab === tab ? "bg-[#064E3B] text-white" : "text-[#064E3B]/60 hover:bg-[#D1FAE5]"
                  )}
                >
                  {tab === 'plans' ? 'Lesson Plans' : tab}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-3 bg-[#F0FDF4] px-4 py-2 rounded-xl border border-[#D1FAE5]">
              <div className="w-8 h-8 bg-[#064E3B] rounded-full flex items-center justify-center text-white font-black text-xs">
                {teacherName[0]}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-[#059669] uppercase tracking-tight">Member</p>
                <p className="text-sm font-black text-[#064E3B] leading-none">{teacherName}</p>
              </div>
            </div>
            {(userRoles.includes('educator') || userRoles.includes('admin')) && (
              <button 
                onClick={() => setCurrentView('educator-suite')}
                className="flex items-center gap-2 px-4 py-2 bg-[#FACC15] text-[#064E3B] rounded-xl font-bold border-2 border-[#EAB308] hover:shadow-md transition-all shadow-sm"
              >
                <BookOpen size={18} /> Educator Suite
              </button>
            )}
            <button 
              onClick={() => setCurrentView('home')}
              className="flex items-center gap-2 px-4 py-2 bg-white text-[#064E3B] rounded-xl font-bold border-2 border-[#D1FAE5] hover:bg-[#F0FDF4] transition-all shadow-sm"
            >
              <Home size={18} /> Home
            </button>
            <button 
              onClick={handleLogout}
              className="p-2.5 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-100 shadow-sm"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          {adminTab === 'overview' && (
            <div className="max-w-6xl mx-auto space-y-8 pb-20">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: "Total Year Groups", value: yearGroups.length, icon: Users, color: "bg-yellow-400" },
                  { label: "Active Teachers", value: teachers.length, icon: UserCheck, color: "bg-yellow-400" },
                  { label: "Subjects Covered", value: subjects.length, icon: BookOpen, color: "bg-yellow-400" },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-8 rounded-3xl shadow-xl border-b-8 border-black/5 flex items-center gap-6">
                    <div className={cn("p-4 rounded-2xl text-white", stat.color)}>
                      <stat.icon size={32} />
                    </div>
                    <div>
                      <p className="text-[#064E3B]/60 font-bold uppercase text-xs tracking-widest">{stat.label}</p>
                      <p className="text-4xl font-black text-[#064E3B]">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-3xl p-10 shadow-2xl space-y-6">
                <h3 className="text-2xl font-black text-[#064E3B]">School Logistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button onClick={() => setAdminTab('timetable')} className="p-6 rounded-2xl bg-[#D1FAE5] border-2 border-[#10B981]/20 flex items-center gap-4 hover:scale-[1.02] transition-all">
                    <div className="p-3 bg-white rounded-xl shadow-sm"><LayoutGrid className="text-[#059669]" /></div>
                    <div className="text-left">
                      <p className="font-black text-[#064E3B]">Master Timetable</p>
                      <p className="text-xs font-bold text-[#064E3B]/60">Manage student and teacher schedules</p>
                    </div>
                  </button>
                  <button onClick={() => setAdminTab('teachers')} className="p-6 rounded-2xl bg-[#D1FAE5] border-2 border-[#10B981]/20 flex items-center gap-4 hover:scale-[1.02] transition-all">
                    <div className="p-3 bg-white rounded-xl shadow-sm"><Users className="text-[#059669]" /></div>
                    <div className="text-left">
                      <p className="font-black text-[#064E3B]">Teacher Database</p>
                      <p className="text-xs font-bold text-[#064E3B]/60">Assign subjects for auto-scheduling</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {adminTab === 'plans' && (
            <div className="max-w-6xl mx-auto bg-white rounded-[3rem] p-10 shadow-2xl pb-20 border-8 border-white ring-1 ring-black/5">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h3 className="text-3xl font-black text-[#064E3B]">Submitted Lesson Plans</h3>
                  <p className="text-[#064E3B]/60 font-bold mt-1">Review and monitor teacher prep progress</p>
                </div>
              </div>

              <div className="p-20 text-center space-y-6 bg-[#F0FDF4]/30 rounded-[3rem] border-4 border-dashed border-[#D1FAE5]">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto shadow-xl ring-8 ring-[#FEFCE8]/20">
                  <BookOpen size={40} className="text-[#FACC15]" />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-[#064E3B]">Feature Suspended</h4>
                  <p className="text-[#064E3B]/60 font-bold">The Creative Vault and submission tracking have been removed.</p>
                </div>
              </div>
            </div>
          )}

          {adminTab === 'teachers' && (
            <div className="max-w-6xl mx-auto bg-white rounded-3xl p-10 shadow-2xl pb-20">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-3xl font-black text-[#064E3B]">Teacher Directory</h3>
                <button 
                  onClick={() => {
                    const name = prompt("Teacher Name?");
                    if(name) setTeachers([...teachers, { id: `t-${Date.now()}`, name, subjects: [] }]);
                  }}
                  className="bg-[#064E3B] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg"
                >
                  <Plus size={20} /> Add Teacher
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teachers.map(teacher => (
                  <div key={teacher.id} className="p-6 rounded-2xl border-2 border-[#FEFCE8] hover:border-[#FACC15]/30 transition-all flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#064E3B] rounded-xl flex items-center justify-center text-white font-bold">
                          {teacher.name[0]}
                        </div>
                        <div>
                          <p className="font-black text-[#064E3B]">{teacher.name}</p>
                          <p className="text-[10px] font-bold text-[#064E3B]/40 uppercase tracking-widest">{teacher.subjects.length} Subjects</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTeachers(teachers.filter(t => String(t.id) !== String(teacher.id)));
                        }} 
                        className="text-red-400 hover:text-red-600 transition-all cursor-pointer p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {subjects.map(s => (
                        <button 
                          key={s}
                          onClick={() => {
                            const newSubs = teacher.subjects.includes(s) 
                              ? teacher.subjects.filter(ts => ts !== s)
                              : [...teacher.subjects, s];
                            setTeachers(teachers.map(t => t.id === teacher.id ? {...t, subjects: newSubs} : t));
                          }}
                          className={cn(
                            "px-2 py-1 rounded-md text-[9px] font-black uppercase transition-all border",
                            teacher.subjects.includes(s) ? "bg-[#064E3B] text-white border-[#064E3B]" : "bg-gray-50 text-[#064E3B]/40 border-gray-100 hover:border-[#FACC15]/30"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminTab === 'timetable' && (
            <div className="max-w-7xl mx-auto space-y-10 pb-20">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-3xl font-black text-[#064E3B]">Master Scheduler</h3>
                  <p className="text-[#064E3B]/60 font-bold mt-1 tracking-tight">Auto-arranged 35-minute periods with conflict prevention</p>
                </div>
                <div className="flex gap-4">
                   <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase text-[#064E3B]/40 ml-1">View Group</label>
                      <select 
                        className="bg-white border-2 border-[#D1FAE5] px-4 py-2 rounded-xl font-bold text-[#064E3B] outline-none"
                        value={yearGroup}
                        onChange={(e) => setYearGroup(e.target.value)}
                      >
                        {yearGroups.map(yg => <option key={yg} value={yg}>{yg}</option>)}
                      </select>
                   </div>
                   <button 
                    onClick={() => {
                      // Trigger a re-render/shuffle
                      setTeachers([...teachers]);
                    }}
                    className="self-end px-6 py-2 bg-[#FACC15] text-[#064E3B] rounded-xl font-black uppercase text-xs tracking-widest shadow-md hover:bg-yellow-400 transition-colors"
                   >
                     <Wand2 size={16} /> Re-Shuffle
                   </button>
                </div>
              </div>

              <div className="bg-white rounded-[3rem] p-10 shadow-2xl overflow-x-auto border-8 border-white ring-1 ring-black/5">
                <div className="grid grid-cols-6 gap-4 min-w-[1200px]">
                  <div className="h-16" /> {/* Corner Spacer */}
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(day => (
                    <div key={day} className="h-16 flex flex-col items-center justify-center bg-[#FEFCE8]/50 rounded-2xl border-2 border-[#FACC15]/20">
                      <p className="font-black text-[#064E3B] uppercase tracking-widest text-sm">{day}</p>
                      <p className="text-[10px] font-bold text-[#064E3B]/60">{day === "Friday" ? "1:10pm Finish" : isPrimary(yearGroup) ? "2:30pm Finish" : "3:00pm Finish"}</p>
                    </div>
                  ))}

                  {/* Period Mapping */}
                  {getSlots("Monday", yearGroup).map((slot, sIdx) => (
                    <React.Fragment key={sIdx}>
                      <div className="flex flex-col items-end justify-center pr-4">
                        <p className="text-xs font-black text-[#064E3B] opacity-40 uppercase tracking-tighter">Period {sIdx + 1}</p>
                        <p className="text-sm font-black text-[#064E3B]">{slot.start}</p>
                      </div>
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(day => {
                        const daySlots = getSlots(day, yearGroup);
                        if (sIdx >= daySlots.length) return <div key={day} className="bg-gray-50/30 rounded-2xl border-2 border-dashed border-gray-100" title="End of Day" />;
                        
                        // Smart Auto-Arrange Logic:
                        // Find a subject/teacher that works for this slot for this year group
                        // For demo, we use deterministic shuffling based on YG + Day + Slot
                        const ygIndex = yearGroups.indexOf(yearGroup);
                        const dayIndex = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].indexOf(day);
                        const subjectIndex = (ygIndex * 13 + dayIndex * 8 + sIdx * 5) % subjects.length;
                        const targetSubject = subjects[subjectIndex];
                        
                        // Find teachers who can teach this
                        const eligibleTeachers = teachers.filter(t => t.subjects.includes(targetSubject));
                        const assignedTeacher = eligibleTeachers.length > 0 
                          ? eligibleTeachers[(ygIndex + dayIndex + sIdx) % eligibleTeachers.length]
                          : teachers[subjectIndex % teachers.length];

                        return (
                          <div key={day} className="group relative bg-white p-5 rounded-2xl border-2 border-[#FEFCE8] hover:border-[#FACC15] transition-all hover:scale-[1.02] cursor-default shadow-sm hover:shadow-md">
                            <div className="flex justify-between items-start mb-2">
                              <p className="text-[10px] font-black uppercase text-[#064E3B]/60 tracking-wider leading-none">{targetSubject}</p>
                              <div className="w-1.5 h-1.5 rounded-full bg-[#FACC15] shadow-[0_0_8px_#FACC15]" />
                            </div>
                            <p className="text-sm font-black text-[#064E3B] truncate">{assignedTeacher.name}</p>
                            <div className="mt-2 flex items-center gap-1 opacity-20">
                               <div className="h-1 flex-1 bg-gray-100 rounded-full" />
                            </div>
                            
                            {/* Slot Details Tooltip or Reveal */}
                            <div className="absolute inset-0 bg-[#064E3B]/95 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity p-5 flex flex-col justify-center text-white">
                               <p className="text-[10px] font-black uppercase text-[#FACC15]">{slot.start} - {slot.end}</p>
                               <p className="text-sm font-black leading-tight mt-1">{targetSubject} with {assignedTeacher.name}</p>
                               <p className="text-[8px] font-bold opacity-60 mt-2">Classroom Area {Math.floor(sIdx/2) + 1}</p>
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}

          {adminTab === 'members' && (
            <div className="max-w-6xl mx-auto bg-white rounded-3xl p-10 shadow-2xl pb-20">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h3 className="text-3xl font-black text-[#064E3B]">Registered Members</h3>
                  <p className="text-[#064E3B]/60 font-bold">Manage users and their application permissions.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={fetchMembers}
                    disabled={isLoadingMembers}
                    className="bg-[#F0FDF4] text-[#064E3B] px-6 py-3 rounded-2xl font-bold flex items-center gap-2 border-2 border-[#D1FAE5] hover:bg-[#D1FAE5] transition-all"
                  >
                    <RefreshCw size={20} className={isLoadingMembers ? "animate-spin" : ""} /> Refresh List
                  </button>
                </div>
              </div>

              {isLoadingMembers ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="animate-spin text-[#064E3B]" size={48} />
                  <p className="font-bold text-[#064E3B]/60 animate-pulse">Fetching members directory...</p>
                </div>
              ) : allMembers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-left">
                        <th className="px-6 pb-2 text-[10px] font-black uppercase text-[#064E3B]/40 tracking-[0.2em]">Member Info</th>
                        <th className="px-6 pb-2 text-[10px] font-black uppercase text-[#064E3B]/40 tracking-[0.2em]">Roles</th>
                        <th className="px-6 pb-2 text-[10px] font-black uppercase text-[#064E3B]/40 tracking-[0.2em]">Joined Date</th>
                        <th className="px-6 pb-2 text-[10px] font-black uppercase text-[#064E3B]/40 tracking-[0.2em] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allMembers.map((member) => (
                        <tr key={member.id} className="group hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-5 bg-[#F0FDF4]/30 first:rounded-l-3xl border-y-2 border-[#F0FDF4] first:border-l-2">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-[#064E3B] rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-lg shadow-[#064E3B]/10">
                                {member.teacherName?.[0] || member.email?.[0]?.toUpperCase() || '?'}
                              </div>
                              <div>
                                <p className="font-black text-[#064E3B] leading-none">{member.teacherName || 'Anonymous'}</p>
                                <p className="text-xs font-bold text-[#064E3B]/40 mt-1">{member.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 bg-[#F0FDF4]/30 border-y-2 border-[#F0FDF4]">
                            <div className="flex flex-wrap gap-2">
                              {Array.isArray(member.roles) ? member.roles.map((role: string) => (
                                <span key={role} className="px-3 py-1 bg-white border border-[#D1FAE5] text-[#059669] text-[9px] font-black uppercase rounded-full shadow-sm">
                                  {role}
                                </span>
                              )) : (
                                <span className="px-3 py-1 bg-white border border-[#D1FAE5] text-[#059669] text-[9px] font-black uppercase rounded-full shadow-sm">
                                  Educator
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5 bg-[#F0FDF4]/30 border-y-2 border-[#F0FDF4]">
                            <p className="text-sm font-bold text-[#064E3B]">
                              {member.createdAt ? new Date(member.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown'}
                            </p>
                          </td>
                          <td className="px-6 py-5 bg-[#F0FDF4]/30 last:rounded-r-3xl border-y-2 border-[#F0FDF4] last:border-r-2 text-right">
                            <button 
                              type="button"
                              onClick={(e) => deleteMember(member.id, e)}
                              disabled={member.uid === user?.uid}
                              className={cn(
                                "p-3 rounded-xl transition-all relative z-40",
                                member.uid === user?.uid 
                                  ? "bg-gray-100 text-gray-300 cursor-not-allowed" 
                                  : "bg-white text-red-500 hover:bg-red-500 hover:text-white border-2 border-red-50 hover:border-red-500 shadow-sm cursor-pointer"
                              )}
                              title={member.uid === user?.uid ? "You cannot delete yourself" : "Delete Member"}
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-20 text-center space-y-6 bg-[#F0FDF4]/30 rounded-[3rem] border-4 border-dashed border-[#D1FAE5]">
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto shadow-xl ring-8 ring-[#FEFCE8]/20">
                    <User size={40} className="text-[#059669]" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-[#064E3B]">No Members Found</h4>
                    <p className="text-[#064E3B]/60 font-bold">Check your database connection or register new users.</p>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    );
  };

  // --- Rendering Helpers ---
  const renderHome = () => (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#FDFBF7]">
      <header className="h-20 bg-white border-b-2 border-[#D1FAE5] px-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#059669] rounded-xl flex items-center justify-center text-white">
            <BookOpen size={24} />
          </div>
          <h1 className="text-xl font-black text-[#064E3B] uppercase tracking-tight">EduMagic Suite</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-3 bg-[#F0FDF4] px-4 py-2 rounded-xl border border-[#D1FAE5]">
            <div className="w-8 h-8 bg-[#064E3B] rounded-full flex items-center justify-center text-white font-black text-xs">
              {teacherName[0]}
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black text-[#059669] uppercase tracking-tight">Member</p>
              <p className="text-sm font-black text-[#064E3B] leading-none">{teacherName}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2.5 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-100 shadow-sm"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto p-12 flex items-center justify-center">
        <div className="max-w-4xl mx-auto space-y-12 text-center pb-20">
        <div className="space-y-4">
          <h1 className="text-7xl font-black text-[#064E3B] leading-tight">Zera International Dashboard</h1>
          <p className="text-2xl font-medium text-[#064E3B]/80 max-w-2xl mx-auto">Welcome back, <span className="text-[#059669]">{teacherName}</span>. Please select your workspace to begin.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
            {(userRoles.includes('educator') || userRoles.includes('admin')) && (
              <button 
                onClick={() => setCurrentView('educator-suite')} 
                className={cn(
                  "group p-12 bg-[#064E3B] rounded-[3rem] shadow-2xl transition-all hover:scale-[1.02] hover:-translate-y-2 flex flex-col items-center gap-6 text-white",
                  (!userRoles.includes('admin') || !userRoles.includes('educator')) && !(userRoles.includes('admin') && userRoles.includes('educator')) && "md:col-span-2 max-w-xl mx-auto w-full"
                )}
              >
                <div className="w-24 h-24 bg-[#FACC15] rounded-3xl flex items-center justify-center text-[#064E3B] transition-all group-hover:scale-110">
                  <BookOpen size={48} />
                </div>
                <div>
                  <h2 className="text-3xl font-black">Educator Suite</h2>
                  <p className="text-white/40 font-bold mt-2 uppercase text-xs tracking-widest">Creative Studio</p>
                </div>
              </button>
            )}

            {userRoles.includes('admin') && (
              <button 
                onClick={() => setCurrentView('admin')} 
                className={cn(
                  "group p-12 bg-white rounded-[3rem] border-4 border-[#064E3B] hover:border-[#FACC15] hover:shadow-2xl transition-all hover:scale-[1.02] hover:-translate-y-2 flex flex-col items-center gap-6",
                  !userRoles.includes('educator') && "md:col-span-2 max-w-xl mx-auto w-full"
                )}
              >
                <div className="w-24 h-24 bg-[#FEFCE8] rounded-3xl flex items-center justify-center text-[#064E3B] group-hover:bg-[#FACC15] transition-all group-hover:scale-110">
                  <LayoutGrid size={48} />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-[#064E3B]">Admin Portal</h2>
                  <p className="text-[#064E3B]/40 font-bold mt-2 uppercase text-xs tracking-widest">School Management</p>
                </div>
              </button>
            )}
        </div>
      </div>
    </div>
  </div>
);

  const renderEducatorSuite = () => (
    <div className="flex-1 overflow-y-auto p-12 bg-[#FDFBF7] custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-12">
        <header className="flex justify-between items-center bg-[#064E3B] p-8 rounded-[2.5rem] shadow-2xl">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => {
                clearWorkspace();
                setCurrentView('home');
              }} 
              className="p-4 bg-white/10 hover:bg-white text-white hover:text-[#064E3B] rounded-[1.5rem] transition-all"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h2 className="text-3xl font-black text-white leading-none">Educator Studio</h2>
              <p className="text-[#FACC15] text-[10px] font-black uppercase tracking-[0.3em] mt-2">Smart Curriculum Design</p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="hidden md:flex items-center gap-3 bg-white/10 px-6 py-2.5 rounded-xl border border-white/20">
              <div className="w-8 h-8 bg-[#FACC15] rounded-full flex items-center justify-center text-[#064E3B] font-black text-xs">
                {teacherName[0]}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-white uppercase tracking-tight">Member</p>
                <p className="text-sm font-black text-[#FACC15] leading-none">{teacherName}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-3 bg-white/10 text-white hover:bg-red-500 hover:text-white rounded-xl transition-all border border-white/20 shadow-lg"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
            <div className="h-10 w-px bg-white/20 mx-2" />
            <button 
              onClick={() => {
                clearWorkspace();
              }} 
              className="px-6 py-2.5 bg-white text-[#064E3B] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all shadow-lg active:scale-95"
            >
              New Lesson
            </button>
          </div>
        </header>

        <div className="space-y-16 animate-in fade-in slide-in-from-bottom-5 duration-700">
          <div>
            <div className="flex items-center gap-4 mb-8">
              <h3 className="text-lg font-black uppercase tracking-[0.4em] text-[#064E3B]">Resource Toolkit</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-[#064E3B]/20 to-transparent" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { id: 'lesson-plan', name: 'Lesson Plan', icon: BookOpen, desc: '6-Week Pedagogical Programs' },
                { id: 'slides', name: 'Presentation', icon: Presentation, desc: 'Interactive Visual Materials' },
                { id: 'worksheet', name: 'Worksheet', icon: FileText, desc: 'Academic Practice Papers' },
                { id: 'poster', name: 'Poster Studio', icon: ImageIcon, desc: 'Educational Graphics & Signage' },
              ].map(tool => (
                <button
                  key={tool.id}
                  onClick={() => {
                    if (tool.id === 'slides') resetSlides();
                    else if (tool.id === 'worksheet') resetWorksheet();
                    else if (tool.id === 'poster') resetPoster();
                    else if (tool.id === 'lesson-plan') resetLessonPlan();
                    else setCurrentView(tool.id as any);
                  }}
                  className="group p-8 bg-white rounded-[2.5rem] border-2 border-transparent hover:border-[#FACC15] hover:shadow-2xl transition-all text-left space-y-6 relative overflow-hidden"
                >
                  <div className="w-16 h-16 rounded-2xl bg-[#F0FDF4] group-hover:bg-[#FACC15] flex items-center justify-center text-[#064E3B] text-2xl shadow-sm transition-all duration-500">
                    <tool.icon size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-[#064E3B]">{tool.name}</h3>
                    <p className="text-sm font-medium text-[#064E3B]/60">{tool.desc}</p>
                  </div>
                  <div className="pt-4 flex items-center text-[10px] font-black uppercase tracking-widest text-[#064E3B]/40 group-hover:text-[#064E3B] transition-colors">
                    Launch Tool <ChevronRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4 flex-1">
                <h3 className="text-lg font-black uppercase tracking-[0.4em] text-[#064E3B]">My Saved Designs</h3>
                <div className="h-px flex-1 bg-gradient-to-r from-[#064E3B]/20 to-transparent" />
              </div>
              <button 
                onClick={() => setIsCreatingFolder(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#F0FDF4] text-[#059669] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#059669] hover:text-white transition-all shadow-sm"
              >
                <FolderPlus size={16} /> New Folder
              </button>
            </div>

            {/* Folder Tabs */}
            <div className="flex flex-wrap gap-3 mb-8">
              <button 
                onClick={() => setActiveFolderId(null)}
                className={cn(
                  "px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                  activeFolderId === null ? "bg-[#064E3B] text-white" : "bg-white text-[#064E3B] hover:bg-gray-50 border border-[#064E3B]/10"
                )}
              >
                All Projects
              </button>
              {folders.map(folder => (
                <div key={folder.id} className="relative group/folder">
                  <button 
                    onClick={() => setActiveFolderId(folder.id)}
                    className={cn(
                      "px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2",
                      activeFolderId === folder.id ? "bg-[#064E3B] text-white" : "bg-white text-[#064E3B] hover:bg-gray-50 border border-[#064E3B]/10"
                    )}
                  >
                    <Folder size={14} /> {folder.name}
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFolder(folder.id);
                    }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/folder:opacity-100 transition-opacity transform scale-75"
                    title="Delete Folder"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>

            {/* Folder Creation Form */}
            <AnimatePresence>
              {isCreatingFolder && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-[#F0FDF4] p-6 rounded-[2rem] border-2 border-[#059669]/20 mb-8 flex flex-col sm:flex-row gap-4 items-center">
                    <div className="flex items-center gap-4 flex-1 w-full">
                      <FolderPlus className="text-[#059669] shrink-0" size={24} />
                      <input 
                        type="text" 
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Enter folder name..."
                        className="flex-1 bg-white border-2 border-transparent focus:border-[#059669] rounded-xl px-6 py-3 outline-none font-black text-[#064E3B] text-sm"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') createFolder(newFolderName); }}
                      />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button 
                        onClick={() => createFolder(newFolderName)}
                        className="flex-1 sm:flex-none px-8 py-3 bg-[#059669] text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#047857] transition-all"
                      >
                        Create
                      </button>
                      <button 
                        onClick={() => setIsCreatingFolder(false)}
                        className="px-4 py-3 text-[#064E3B]/40 hover:text-red-500 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isFetchingProjects ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="animate-spin text-[#064E3B]" size={32} />
              </div>
            ) : (activeFolderId 
                  ? userProjects.filter(p => p.folderId === activeFolderId) 
                  : userProjects.filter(p => !p.folderId)
                ).length === 0 ? (
              <div className="bg-white p-12 rounded-[2.5rem] border-2 border-dashed border-[#064E3B]/10 text-center">
                <div className="w-16 h-16 bg-[#F0FDF4] rounded-2xl flex items-center justify-center text-[#064E3B]/20 mx-auto mb-4">
                  <BookOpen size={32} />
                </div>
                <h4 className="text-lg font-black text-[#064E3B]">No designs found</h4>
                <p className="text-[#064E3B]/60 text-sm max-w-xs mx-auto mt-2">
                  {activeFolderId ? "This folder is currently empty." : "No unorganized projects found."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(activeFolderId 
                  ? userProjects.filter(p => p.folderId === activeFolderId) 
                  : userProjects.filter(p => !p.folderId)
                ).map((project: any) => (
                  <div key={project.id} className="group bg-white p-6 rounded-[2rem] border-2 border-transparent hover:border-[#FACC15] hover:shadow-xl transition-all relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className={cn(
                        "p-3 rounded-2xl flex items-center justify-center text-white",
                        project.category === 'lesson-plan' ? "bg-blue-500" :
                        project.category === 'slides' ? "bg-[#FACC15] text-[#064E3B]" :
                        project.category === 'worksheet' ? "bg-green-500" :
                        "bg-purple-500"
                      )}>
                        {project.category === 'lesson-plan' && <BookOpen size={20} />}
                        {project.category === 'slides' && <Presentation size={20} />}
                        {project.category === 'worksheet' && <FileText size={20} />}
                        {project.category === 'poster' && <ImageIcon size={20} />}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsMovingProject(isMovingProject === project.id ? null : project.id);
                            }}
                            className={cn(
                              "text-gray-300 hover:text-[#064E3B] transition-all p-2 hover:bg-gray-50 rounded-lg active:scale-95",
                              isMovingProject === project.id && "text-[#064E3B] bg-gray-50"
                            )}
                            title="Move to Folder"
                          >
                            <ArrowRightCircle size={18} />
                          </button>
                          
                          {isMovingProject === project.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-40" 
                                onClick={(e) => { e.stopPropagation(); setIsMovingProject(null); }} 
                              />
                              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 py-3 z-50 animate-in fade-in zoom-in duration-200">
                                <p className="px-4 py-1 text-[8px] font-black uppercase text-gray-400 tracking-widest mb-2">Move to</p>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); moveProjectToFolder(project.id, null); }}
                                  className="w-full px-4 py-2 hover:bg-[#F0FDF4] text-left text-xs font-black text-[#064E3B] flex items-center gap-2"
                                >
                                  <LayoutGrid size={14} className="opacity-40" /> All Projects
                                </button>
                                {folders.map(f => (
                                  <button 
                                    key={f.id}
                                    onClick={(e) => { e.stopPropagation(); moveProjectToFolder(project.id, f.id); }}
                                    className="w-full px-4 py-2 hover:bg-[#F0FDF4] text-left text-xs font-black text-[#064E3B] flex items-center gap-2"
                                  >
                                    <Folder size={14} className={cn("opacity-40", project.folderId === f.id && "opacity-100 text-[#059669]")} /> {f.name}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProject(project.id);
                          }}
                          className="text-red-300 hover:text-red-500 transition-all p-2 hover:bg-red-50 rounded-lg active:scale-95"
                          title="Delete Project"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    
                    <h4 className="font-black text-[#064E3B] text-lg leading-tight mb-2 line-clamp-1">{project.title}</h4>
                    <p className="text-[10px] font-black text-[#064E3B]/40 uppercase tracking-widest mb-6">
                      {(project.category || 'project').replace('-', ' ')} • {new Date(project.timestamp).toLocaleDateString()}
                    </p>
                    <button 
                      onClick={() => loadProject(project)}
                      className="w-full py-3 bg-[#F0FDF4] text-[#059669] rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#059669] hover:text-white transition-all outline-none"
                    >
                      Open Project
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSlidesView = () => {
    if (!content || !content.slides) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#F0FDF4]">
          <div className="text-center space-y-4">
            <Presentation size={48} className="mx-auto text-[#064E3B]/20" />
            <p className="text-[#064E3B]/60 font-bold">No slides content available.</p>
            <button onClick={() => setCurrentView('educator-suite')} className="text-[#059669] font-black uppercase text-[10px] tracking-widest hover:underline">
              Return to Suite
            </button>
          </div>
        </div>
      );
    }
    const currentSlide = content.slides[currentSlideIdx] || content.slides[0];
    if (!currentSlide) return null;

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          addSlideImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    };

    return (
      <div className="flex-1 flex flex-col bg-[#F0FDF4] overflow-hidden">
        <div className="h-16 bg-white border-b-2 border-[#D1FAE5] flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => {
              clearWorkspace();
              setCurrentView('educator-suite');
            }} className="flex items-center gap-2 text-[#064E3B]/60 font-bold hover:text-[#064E3B] transition-colors">
              <Home size={18} /> Suite
            </button>
            {content?.lessonPlan && (
              <button 
                onClick={() => setCurrentView('lesson-plan')} 
                className="flex items-center gap-2 px-3 py-1.5 bg-[#F0FDF4] text-[#059669] rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#D1FAE5] transition-all border border-[#D1FAE5]"
              >
                <ChevronLeft size={14} /> Lesson Design
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Presentation className="text-[#FACC15]" size={24} />
            <h2 className="text-xl font-black text-[#064E3B]">Slide Studio</h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => generateOnlyWorksheet(true)}
              disabled={isGenerating}
              className={cn(
                "px-4 py-2 bg-[#059669] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#047857] transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
              )}
            >
              <BookOpen size={14} /> {isGenerating ? 'Wait...' : 'Create Worksheet'}
            </button>
            <div className="h-8 w-px bg-[#D1FAE5] mx-1" />
            <button 
              onClick={resetSlides}
              className="px-4 py-2 bg-white text-[#064E3B] border-2 border-[#D1FAE5] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/80 transition-all shadow-sm flex items-center gap-2"
            >
              <Plus size={14} /> New Presentation
            </button>
            <div className="h-8 w-px bg-[#D1FAE5] mx-1" />
             {content?.slides && content.slides.length > 0 && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => saveProject()}
                    className="px-4 py-2 bg-white text-[#064E3B] border-2 border-[#D1FAE5] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#F0FDF4] transition-all shadow-sm flex items-center gap-2"
                  >
                    <PlusCircle size={14} /> Save
                  </button>
                  <button 
                    onClick={() => submitToAdmin()}
                    className="px-4 py-2 bg-[#FACC15] text-[#064E3B] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-yellow-300 transition-all shadow-sm flex items-center gap-2"
                  >
                    <CheckCircle size={14} /> Submit
                  </button>
                </div>
             )}
          </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <aside className="w-80 bg-white border-r-2 border-[#D1FAE5] p-6 space-y-8 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-[#064E3B]/60 tracking-widest leading-none">Lesson Overview</h3>
              <div className="p-4 bg-[#F0FDF4] rounded-2xl border-2 border-[#D1FAE5] space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-[#064E3B]/40 flex items-center gap-1">
                    <Info size={10} /> Description
                  </label>
                  <textarea 
                    value={content?.slidesMetadata?.description || ''} 
                    onChange={(e) => updateSlidesMetadata('description', e.target.value)}
                    className="w-full p-2 bg-white/50 border-2 border-[#D1FAE5] rounded-xl text-xs font-bold resize-none h-20"
                    placeholder="Lesson description..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-[#064E3B]/40 flex items-center gap-1">
                    <BookOpen size={10} /> Methodology
                  </label>
                  <textarea 
                    value={content?.slidesMetadata?.methodology || ''} 
                    onChange={(e) => updateSlidesMetadata('methodology', e.target.value)}
                    className="w-full p-2 bg-white/50 border-2 border-[#D1FAE5] rounded-xl text-[11px] font-medium italic resize-none h-20"
                    placeholder="e.g. Aligned with Cambridge standards, focusing on interactive scaffolded inquiry and hands-on modeling."
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-[#064E3B]/60 tracking-widest leading-none">Slide Editor</h3>
              
              {currentSlide && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Slide Title</label>
                      <input 
                        type="text" 
                        value={currentSlide.title || ""} 
                        onChange={(e) => updateSlideData(currentSlideIdx, 'title', e.target.value)}
                        onFocus={() => { setSelectedSlideElement({ type: 'title' }); setSelectedSlideImageId(null); }}
                        className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-sm font-bold focus:border-[#FACC15] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-[#7C7A65]">Bullets (Edit text directly on slide)</label>
                      <div className="space-y-2 text-xs">
                        {currentSlide.content.map((point, idx) => (
                          <textarea
                            key={idx}
                            value={point || ""}
                            onChange={(e) => updateSlideContent(currentSlideIdx, idx, e.target.value)}
                            onFocus={() => { setSelectedSlideElement({ type: 'bullet', index: idx }); setSelectedSlideImageId(null); }}
                            className="w-full h-16 p-2 bg-[#F9F8F0] border-2 border-[#E5E2C8] rounded-xl font-bold resize-none focus:border-[#FACC15] outline-none transition-all"
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Selection Settings Removed */}

                  {selectedSlideImageId && currentSlide.images?.find(i => i.id === selectedSlideImageId) && (() => {
                    const selectedImg = currentSlide.images.find(i => i.id === selectedSlideImageId);
                    return (
                      <div className="p-4 bg-white border-4 border-[#059669] rounded-2xl shadow-xl space-y-4 animate-in zoom-in-95 duration-200 ring-4 ring-[#D1FAE5]">
                        <div className="flex justify-between items-center bg-[#D1FAE5]/30 -m-4 p-4 rounded-t-xl mb-0 border-b border-[#D1FAE5]">
                          <span className="text-[10px] font-black uppercase text-[#064E3B] flex items-center gap-2">
                            <Layers size={14} /> {selectedImg?.url ? 'Image Settings' : 'Shape Settings'}
                          </span>
                          <button onClick={() => setSelectedSlideImageId(null)} className="p-1 hover:bg-white rounded-full text-[#059669]">
                            <X size={14} />
                          </button>
                        </div>
                        
                        <div className="pt-4 space-y-4">
                          {selectedImg?.url && (
                            <button 
                              onClick={() => {
                                if (selectedSlideImageId) {
                                  setImageEditorCallback({
                                    cb: (newUrl: string) => updateSlideImage(selectedSlideImageId, { url: newUrl })
                                  });
                                  setEditingImageUrl(selectedImg.url);
                                }
                              }}
                              className="w-full py-2.5 flex items-center justify-center gap-2 bg-[#059669] text-white rounded-xl text-[10px] font-black uppercase hover:bg-[#047857] shadow-md transition-all active:scale-95"
                            >
                              <Crop size={14} /> Edit Image Studio
                            </button>
                          )}

                          <div className="flex gap-4">
                            <div className="flex-1 space-y-1.5">
                              <label className="text-[9px] font-black uppercase text-gray-400">Size</label>
                              <input 
                                type="range" min="50" max="600" step="10"
                                value={selectedImg?.size || 200}
                                onChange={(e) => updateSlideImage(selectedSlideImageId, { size: parseInt(e.target.value) })}
                                className="w-full accent-[#059669]"
                              />
                            </div>
                            <div className="flex-1 space-y-1.5">
                              <label className="text-[9px] font-black uppercase text-gray-400">Rotation</label>
                              <input 
                                type="range" min="-180" max="180" step="5"
                                value={selectedImg?.rotation || 0}
                                onChange={(e) => updateSlideImage(selectedSlideImageId, { rotation: parseInt(e.target.value) })}
                                className="w-full accent-[#059669]"
                              />
                            </div>
                          </div>

                          <button 
                            type="button"
                            onClick={(e) => {
                              if (e) {
                                e.preventDefault();
                                e.stopPropagation();
                              }
                              console.log("🗑️ Delete Element click:", selectedSlideImageId);
                              removeSlideImage(selectedSlideImageId);
                            }}
                            className="w-full py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase hover:bg-red-100 transition-colors flex items-center justify-center gap-2 border border-red-200 cursor-pointer relative z-50"
                          >
                            <Trash2 size={14} /> Delete Element
                          </button>
                        </div>
                      </div>
                    );
                  })()}





                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase text-[#7C7A65]">Images & Assets</label>
                      <label 
                        className="flex items-center gap-1 px-2 py-1 bg-[#D1FAE5] text-[#059669] rounded-lg text-[10px] font-bold hover:bg-[#A7F3D0] transition-colors cursor-pointer"
                      >
                        <Plus size={14} /> Device
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                      </label>
                    </div>

                    <div className="flex gap-1 p-1 bg-gray-50 rounded-xl">
                      <button 
                        onClick={() => setImageTab('assets')}
                        className={cn(
                          "flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all",
                          imageTab === 'assets' ? "bg-white shadow-sm text-[#059669]" : "text-gray-400 hover:text-gray-600"
                        )}
                      >
                        Slide Assets
                      </button>
                      <button 
                        onClick={() => setImageTab('backgrounds')}
                        className={cn(
                          "flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all",
                          imageTab === 'backgrounds' ? "bg-white shadow-sm text-[#059669]" : "text-gray-400 hover:text-gray-600"
                        )}
                      >
                        Backgrounds
                      </button>
                      <button 
                        onClick={() => {
                          setImageTab('search');
                          setImageSearchQuery('');
                          setImageSearchResults([]);
                        }}
                        className={cn(
                          "flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all",
                          imageTab === 'search' ? "bg-white shadow-sm text-[#059669]" : "text-gray-400 hover:text-gray-600"
                        )}
                      >
                        Images
                      </button>
                    </div>

                    {imageTab === 'assets' && (
                      <>
                        {currentSlide.images && currentSlide.images.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {currentSlide.images.map(img => (
                              <div key={img.id} className="relative group/mini-img">
                                {img.url ? (
                                  <img 
                                    src={img.url} 
                                    className={cn(
                                      "w-10 h-10 object-cover rounded-lg cursor-pointer transition-all",
                                      selectedSlideImageId === img.id ? "ring-2 ring-[#059669] ring-offset-1" : "opacity-60 hover:opacity-100"
                                    )}
                                    onClick={() => { setSelectedSlideImageId(img.id); setSelectedSlideElement(null); }}
                                  />
                                ) : (
                                   <div 
                                     className={cn(
                                       "w-10 h-10 flex items-center justify-center bg-gray-50 rounded-lg cursor-pointer transition-all",
                                       selectedSlideImageId === img.id ? "ring-2 ring-[#059669] ring-offset-1" : "opacity-60 hover:opacity-100"
                                     )}
                                     onClick={() => { setSelectedSlideImageId(img.id); setSelectedSlideElement(null); }}
                                   >
                                     {img.shape === 'square' && <Square size={14} className="text-[#059669]" />}
                                     {img.shape === 'circle' && <Circle size={14} className="text-[#059669]" />}
                                     {img.shape === 'triangle' && <Triangle size={14} className="text-[#059669]" />}
                                     {img.shape === 'star' && <Star size={14} className="text-[#059669]" />}
                                   </div>
                                )}
                                <button 
                                  onClick={(e) => { 
                                    if (e) {
                                      e.preventDefault();
                                      e.stopPropagation(); 
                                    }
                                    removeSlideImage(img.id); 
                                  }}
                                  type="button"
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/mini-img:opacity-100 transition-opacity"
                                >
                                  <X size={8} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] italic text-[#7C7A65]">No floating images yet.</p>
                        )}
                      </>
                    )}

                    {imageTab === 'backgrounds' && (
                      <div className="space-y-4">
                         <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1">
                            {wallpaperCategories.map((cat, idx) => (
                              <button
                                key={idx}
                                onClick={() => setActiveWallpaperCategory(cat)}
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                  activeWallpaperCategory === cat 
                                    ? "bg-[#059669] text-white shadow-md" 
                                    : "bg-white text-[#7C7A65] border border-gray-200 hover:border-[#059669]"
                                )}
                              >
                                {cat}
                              </button>
                            ))}
                         </div>
                         <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                            <button 
                              onClick={() => updateSlideData(currentSlideIdx, 'backgroundWallpaper', undefined)}
                              className="aspect-video rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 hover:bg-gray-50 transition-all group"
                            >
                              <X size={20} className="text-gray-300 group-hover:text-gray-500" />
                              <span className="text-[9px] font-black uppercase text-gray-400">Clear BG</span>
                            </button>


          <button 
            onClick={() => updateSlideData(currentSlideIdx, 'backgroundWallpaper', null)}
            className="aspect-video rounded-xl border-2 border-dashed border-red-200 bg-red-50 flex flex-col items-center justify-center gap-1 hover:bg-red-100 transition-all group"
            title="Remove background image"
          >
            <Trash2 size={20} className="text-red-400" />
            <span className="text-[9px] font-black uppercase text-red-500">Remove BG</span>
          </button>
                            {PRESET_WALLPAPERS.filter(w => w.category === activeWallpaperCategory).map((w, idx) => (
                              <button
                                key={idx}
                                onClick={() => updateSlideData(currentSlideIdx, 'backgroundWallpaper', w.url)}
                                className={cn(
                                  "aspect-video rounded-xl overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 shadow-sm",
                                  currentSlide.backgroundWallpaper === w.url ? "border-[#059669] ring-2 ring-[#D1FAE5]" : "border-transparent"
                                )}
                              >
                                <img src={w.thumbnail} className="w-full h-full object-cover" alt="" loading="lazy" />
                              </button>
                            ))}
                         </div>
                      </div>
                    )}

                    {imageTab === 'search' && (
                        <div className="space-y-4">
                          {/* Search Google Card */}
                          <div className="bg-white border-2 border-[#D1FAE5] rounded-[2rem] p-6 text-center space-y-4 shadow-sm">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-2 border border-gray-100 p-3">
                              <img src="https://www.google.com/s2/favicons?domain=google.com&sz=128" alt="Google" className="w-full h-full object-contain" />
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Search Google Images</h3>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter leading-relaxed">
                                Find the perfect image on Google, then use "Copy Image Address" to add it here.
                              </p>
                            </div>

                            <div className="relative">
                              <input 
                                type="text" 
                                value={imageSearchQuery}
                                onChange={(e) => setImageSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && imageSearchQuery.trim()) {
                                    window.open(`https://www.google.com/search?q=${encodeURIComponent(imageSearchQuery)}&tbm=isch`, '_blank');
                                  }
                                }}
                                placeholder="What image do you need?..."
                                className="w-full p-4 pl-10 pr-4 text-xs bg-gray-50 border-2 border-transparent focus:border-[#059669] focus:bg-white rounded-[1.5rem] outline-none font-bold placeholder:text-gray-300 transition-all shadow-inner"
                              />
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            </div>

                            <button 
                              onClick={() => {
                                const query = imageSearchQuery || 'educational illustrations';
                                window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`, '_blank');
                              }}
                              className="w-full py-4 bg-[#059669] hover:bg-[#047857] text-white rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 group flex items-center justify-center gap-2"
                            >
                              Search on Google <ExternalLink size={16} className="group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          </div>

                          {/* Already have link? */}
                          <div className="space-y-3">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Step 2: Have a Link?</p>
                            <button 
                              onClick={handleAddImageUrl}
                              className="w-full py-6 bg-blue-50 border-2 border-dashed border-blue-200 text-blue-600 rounded-[2rem] text-xs font-black uppercase tracking-widest hover:bg-blue-100 transition-all flex flex-col items-center justify-center gap-2 group"
                            >
                              <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                <LinkIcon size={24} className="text-blue-500" />
                              </div>
                              <span className="mt-1">Quick Add Image URL</span>
                            </button>

                            <div className="relative group">
                              <textarea
                                value={manualLink}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setManualLink(val);
                                  if (val.trim().startsWith('http') || val.trim().startsWith('data:image')) {
                                    if (val.includes('google.com/search') || val.includes('google.com/imgres')) {
                                      return; // Wait for them to fix it or let them try to add
                                    }
                                  }
                                }}
                                onPaste={(e) => {
                                  e.stopPropagation();
                                  const text = e.clipboardData.getData('text');
                                  const trimmed = text.trim();
                                  if (trimmed.startsWith('http') || trimmed.startsWith('data:image')) {
                                    addSlideImage(trimmed);
                                    setTimeout(() => setManualLink(''), 0);
                                  }
                                }}
                                placeholder="OR PASTE LINK DIRECTLY HERE..."
                                className="w-full p-4 bg-white border-2 border-gray-100 focus:border-[#059669] rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest outline-none resize-none h-20 shadow-inner"
                              />
                              {manualLink && (
                                <button 
                                  onClick={() => {
                                    if (manualLink.startsWith('http') || manualLink.startsWith('data:image')) {
                                      addSlideImage(manualLink);
                                      setManualLink('');
                                    } else {
                                      alert("Invalid link! Right-click image -> Copy image address.");
                                    }
                                  }}
                                  className="absolute bottom-2 right-2 px-3 py-1 bg-[#059669] text-white rounded-lg text-[9px] font-black uppercase"
                                >
                                  ADD
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Visual Tip */}
                          <div className="p-5 bg-amber-50 rounded-[1.5rem] border border-amber-100 space-y-2">
                            <div className="flex items-center gap-2 text-amber-600">
                              <Zap size={14} />
                              <span className="text-[10px] font-black uppercase tracking-tight">Quick Tip</span>
                            </div>
                            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-tighter leading-relaxed">
                              On Google Images: 1. Right-click any image. 2. Choose <span className="text-amber-900 underline">"Copy Image Address"</span>. 3. Back here, click the blue button above and paste!
                            </p>
                          </div>
                        </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[#E5E2C8]">
                    <label className="text-[10px] font-black uppercase text-[#7C7A65]">Add Shape</label>
                    <div className="grid grid-cols-4 gap-2">
                      <button onClick={() => addSlideShape('square')} className="p-2 border-2 border-[#D1FAE5] rounded-xl hover:bg-[#D1FAE5] transition-all flex items-center justify-center text-[#059669] shadow-sm"><Square size={16} /></button>
                      <button onClick={() => addSlideShape('circle')} className="p-2 border-2 border-[#D1FAE5] rounded-xl hover:bg-[#D1FAE5] transition-all flex items-center justify-center text-[#059669] shadow-sm"><Circle size={16} /></button>
                      <button onClick={() => addSlideShape('triangle')} className="p-2 border-2 border-[#D1FAE5] rounded-xl hover:bg-[#D1FAE5] transition-all flex items-center justify-center text-[#059669] shadow-sm"><Triangle size={16} /></button>
                      <button onClick={() => addSlideShape('star')} className="p-2 border-2 border-[#D1FAE5] rounded-xl hover:bg-[#D1FAE5] transition-all flex items-center justify-center text-[#059669] shadow-sm"><Star size={16} /></button>
                    </div>
                  </div>

                  <p className="text-[9px] text-[#7C7A65] font-bold text-center mt-2 italic">Tip: You can also copy and PASTE (Ctrl+V) images directly!</p>

                  <div className="space-y-4 mt-6 pt-4 border-t border-gray-100">
                    <h3 className="text-xs font-black uppercase text-[#7C7A65]">Layout Type</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'standard', name: 'List', icon: <LayoutGrid size={14} /> },
                        { id: 'infographic-cards', name: 'Cards', icon: <Square size={14} /> },
                        { id: 'infographic-flow', name: 'Flow', icon: <Triangle size={14} className="rotate-90" /> },
                        { id: 'infographic-grid', name: 'Grid', icon: <LayoutGrid size={14} /> },
                        { id: 'infographic-bubbles', name: 'Bubbles', icon: <Circle size={14} /> }
                      ].map(l => (
                        <button
                          key={l.id}
                          onClick={() => updateSlideData(currentSlideIdx, 'layoutType', l.id)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border-2",
                            currentSlide.layoutType === l.id || (!currentSlide.layoutType && l.id === 'standard')
                              ? "bg-[#059669] text-white border-[#059669]"
                              : "bg-white text-[#064E3B] border-[#D1FAE5] hover:border-[#059669]"
                          )}
                        >
                          {l.icon} {l.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-[#7C7A65]">Slide Template</h3>
              <div className="grid grid-cols-4 gap-2">
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    title={t.name}
                    onClick={() => setActiveTheme(t)}
                    className={cn(
                      "w-full aspect-square rounded-lg border-2 transition-all flex items-center justify-center text-lg shadow-sm",
                      activeTheme.id === t.id ? "border-[#059669] shadow-md scale-102 ring-2 ring-[#059669]/20" : "border-[#D1FAE5] hover:border-[#059669]"
                    )}
                    style={{ backgroundColor: t.bgColor }}
                  >
                    <span className="group-hover:scale-125 transition-transform">{t.emoji}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 border-t border-[#E5E2C8] pt-6">
              <h3 className="text-xs font-black uppercase text-[#7C7A65]">Regenerate</h3>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-[#7C7A65]">Number of Slides</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="range" 
                    min="5" 
                    max="50" 
                    value={numSlides} 
                    onChange={(e) => setNumSlides(parseInt(e.target.value))} 
                    className="flex-1 accent-[#059669]"
                  />
                  <span className="w-8 text-center font-black text-[#059669]">{numSlides}</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-[#7C7A65]">Generation Instructions</label>
                <textarea 
                  value={lessonInput} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setLessonInput(val);
                    if (content) setContent(prev => prev ? ({ ...prev, lessonTitle: val }) : null);
                  }} 
                  className="w-full h-24 p-2 bg-[#F9F8F0] border-2 border-[#D1FAE5] rounded-xl text-sm font-bold resize-none shadow-sm focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 outline-none transition-all" 
                  placeholder="Describe your slide content (e.g., 'Make it fun for kids' or 'Focus on space exploration')..."
                />
              </div>
              <button 
                onClick={generateOnlySlides} 
                disabled={isGenerating}
                className="w-full py-3 bg-[#059669] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#047857] transition-colors"
              >
                {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />} Generate Content
              </button>
            </div>
          </aside>
          <main className="flex-1 p-8 overflow-y-auto flex flex-col items-center gap-8 bg-[#F9F9F4] custom-scrollbar">
            {content?.slides && content.slides.length > 0 && currentSlide ? (
              <>
                <div 
                  ref={slideRef}
                  onClick={() => {
                    setSelectedSlideImageId(null);
                    setSelectedSlideElement(null);
                  }}
                  className={cn(
                    "w-full aspect-video max-w-4xl bg-white shadow-2xl rounded-2xl overflow-hidden flex flex-col relative border-8 border-[#FACC15]/20 ring-1 ring-[#059669]",
                    activeTheme.patternType === 'dots' && "bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]"
                  )}
                  style={{ 
                    backgroundColor: currentSlide.backgroundColor || activeTheme.bgColor,
                    color: activeTheme.textColor,
                    backgroundImage: currentSlide.backgroundWallpaper ? `url(${getProxiedUrl(currentSlide.backgroundWallpaper)})` : (currentSlide.backgroundWallpaper === "" ? "none" : (activeTheme.bgImage ? `url(${getProxiedUrl(activeTheme.bgImage)})` : undefined)),
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  {/* Slide Content */}
                  <div className="absolute left-0 top-0 w-4 h-full" style={{ backgroundColor: activeTheme.accentColor }} />
                  
                  <div className="p-12 pt-6 flex flex-col gap-6 flex-1 relative pointer-events-none select-text">
                    <h3 
                      dangerouslySetInnerHTML={{ __html: currentSlide.title }}
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      onMouseDown={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        const html = e.currentTarget.innerHTML || "";
                        updateSlideData(currentSlideIdx, 'title', html);
                      }}
                      onPaste={(e) => {
                        // Handle image paste
                        const items = e.clipboardData.items;
                        for (let i = 0; i < items.length; i++) {
                          if (items[i].type.indexOf('image') !== -1) {
                            const file = items[i].getAsFile();
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                addSlideImage(event.target?.result as string);
                              };
                              reader.readAsDataURL(file);
                              e.preventDefault(); // Prevent image from being pasted into text
                            }
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      onClick={() => { setSelectedSlideElement({ type: 'title' }); setSelectedSlideImageId(null); }}
                      className={cn(
                        "font-black tracking-tight leading-tight outline-none focus:ring-2 focus:ring-[#059669]/20 rounded px-1 transition-all cursor-text select-text pointer-events-auto"
                      )} 
                      style={{ 
                        color: currentSlide.titleSettings?.color || activeTheme.accentColor,
                        fontFamily: currentSlide.titleSettings?.family ? `'${currentSlide.titleSettings.family}', sans-serif` : undefined,
                        fontSize: currentSlide.titleSettings?.size ? `${currentSlide.titleSettings.size}px` : undefined,
                        position: 'relative',
                        zIndex: 10
                      }}
                    />
                    <div className="h-1 w-20" style={{ backgroundColor: activeTheme.accentColor }} />
                    
                    {(!currentSlide.layoutType || currentSlide.layoutType === 'standard') ? (
                      <ul className={cn(
                        "flex-1 overflow-hidden pointer-events-none",
                        currentSlide.content.length > 6 ? "space-y-2" : "space-y-4"
                      )}>
                        {currentSlide.content
                          .map((point, i) => (
                            <motion.li 
                              key={i}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                              className={cn(
                                "font-bold flex gap-3 text-current group/bullet pointer-events-none"
                              )}
                            >
                              <span className="text-[#059669] block mt-1.5 flex-shrink-0 animate-pulse pointer-events-none">•</span>
                              <span 
                                dangerouslySetInnerHTML={{ __html: point }}
                                contentEditable={true}
                                suppressContentEditableWarning={true}
                                onBlur={(e) => {
                                  const html = e.currentTarget.innerHTML || "";
                                  updateSlideContent(currentSlideIdx, i, html);
                                }}
                                onPaste={(e) => {
                                  const items = e.clipboardData.items;
                                  for (let j = 0; j < items.length; j++) {
                                    if (items[j].type.indexOf('image') !== -1) {
                                      const file = items[j].getAsFile();
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                          addSlideImage(event.target?.result as string);
                                        };
                                        reader.readAsDataURL(file);
                                        e.preventDefault();
                                      }
                                    }
                                  }
                                }}
                                onClick={(e) => { e.stopPropagation(); setSelectedSlideElement({ type: 'bullet', index: i }); setSelectedSlideImageId(null); }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="leading-relaxed outline-none focus:ring-2 focus:ring-[#059669]/20 rounded px-1 flex-1 transition-all cursor-text select-text pointer-events-auto"
                                style={{ 
                                  color: (currentSlide.individualBulletSettings?.[i]?.color || currentSlide.bulletSettings?.color) || undefined,
                                  fontFamily: (currentSlide.individualBulletSettings?.[i]?.family || currentSlide.bulletSettings?.family) ? `'${currentSlide.individualBulletSettings?.[i]?.family || currentSlide.bulletSettings?.family}', sans-serif` : undefined,
                                  fontSize: (currentSlide.individualBulletSettings?.[i]?.size || currentSlide.bulletSettings?.size) ? `${currentSlide.individualBulletSettings?.[i]?.size || currentSlide.bulletSettings?.size}px` : undefined,
                                  position: 'relative',
                                  zIndex: 10
                                }}
                              />
                            </motion.li>
                          ))}
                      </ul>
                    ) : currentSlide.layoutType === 'infographic-cards' ? (
                      <div className="grid grid-cols-2 gap-4 flex-1 pointer-events-none">
                        {currentSlide.content
                          .filter(point => point.trim())
                          .map((point, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.1 }}
                              className="p-4 rounded-2xl bg-white/50 backdrop-blur-sm border-l-4 border-[#059669] shadow-sm relative group/card flex items-center pointer-events-none"
                              style={{ borderLeftColor: i % 2 === 0 ? activeTheme.accentColor : activeTheme.secondaryColor }}
                            >
                              <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-[#059669] text-white flex items-center justify-center text-[10px] font-black" style={{ backgroundColor: i % 2 === 0 ? activeTheme.accentColor : activeTheme.secondaryColor }}>
                                {i + 1}
                              </div>
                              <p 
                                dangerouslySetInnerHTML={{ __html: point }}
                                contentEditable={true}
                                suppressContentEditableWarning={true}
                                onBlur={(e) => updateSlideContent(currentSlideIdx, i, e.currentTarget.innerHTML || "")}
                                onClick={(e) => { e.stopPropagation(); setSelectedSlideElement({ type: 'bullet', index: i }); setSelectedSlideImageId(null); }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className={cn(
                                  "font-bold leading-relaxed outline-none w-full cursor-text select-text pointer-events-auto"
                                )}
                                style={{ 
                                  color: (currentSlide.individualBulletSettings?.[i]?.color || currentSlide.bulletSettings?.color) || undefined,
                                  fontFamily: (currentSlide.individualBulletSettings?.[i]?.family || currentSlide.bulletSettings?.family) ? `'${currentSlide.individualBulletSettings?.[i]?.family || currentSlide.bulletSettings?.family}', sans-serif` : undefined,
                                  fontSize: (currentSlide.individualBulletSettings?.[i]?.size || currentSlide.bulletSettings?.size) ? `${currentSlide.individualBulletSettings?.[i]?.size || currentSlide.bulletSettings?.size}px` : undefined,
                                  position: 'relative',
                                  zIndex: 10
                                }}
                              />
                            </motion.div>
                          ))}
                      </div>
                    ) : currentSlide.layoutType === 'infographic-flow' ? (
                      <div className="flex flex-col gap-3 relative flex-1 pointer-events-none">
                        {currentSlide.content
                          .filter(point => point.trim())
                          .map((point, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                              className={cn(
                                "flex items-center gap-4 pointer-events-none",
                                i % 2 === 1 ? "flex-row-reverse text-right" : "flex-row"
                              )}
                            >
                              <div className="w-10 h-10 rounded-full border-4 border-[#059669] flex items-center justify-center flex-shrink-0 font-black text-sm bg-white" style={{ borderColor: activeTheme.accentColor }}>
                                {i + 1}
                              </div>
                              <div 
                                className="p-2 bg-white/40 rounded-xl flex-1 border-2 border-[#D1FAE5] pointer-events-none"
                                style={{ borderColor: `${activeTheme.accentColor}20` }}
                              >
                                   <p 
                                    dangerouslySetInnerHTML={{ __html: point }}
                                    contentEditable={true}
                                    suppressContentEditableWarning={true}
                                    onBlur={(e) => updateSlideContent(currentSlideIdx, i, e.currentTarget.innerHTML || "")}
                                    onClick={(e) => { e.stopPropagation(); setSelectedSlideElement({ type: 'bullet', index: i }); setSelectedSlideImageId(null); }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className={cn(
                                      "font-bold leading-tight outline-none cursor-text select-text pointer-events-auto",
                                      currentSlide.content.length > 5 ? "text-xs" : "text-sm"
                                    )}
                                    style={{ 
                                      color: (currentSlide.individualBulletSettings?.[i]?.color || currentSlide.bulletSettings?.color) || undefined,
                                      fontFamily: (currentSlide.individualBulletSettings?.[i]?.family || currentSlide.bulletSettings?.family) ? `'${currentSlide.individualBulletSettings?.[i]?.family || currentSlide.bulletSettings?.family}', sans-serif` : undefined,
                                      fontSize: (currentSlide.individualBulletSettings?.[i]?.size || currentSlide.bulletSettings?.size) ? `${currentSlide.individualBulletSettings?.[i]?.size || currentSlide.bulletSettings?.size}px` : undefined,
                                      position: 'relative',
                                      zIndex: 10
                                    }}
                                  />
                              </div>
                            </motion.div>
                          ))}
                         <div className="absolute left-5 top-5 bottom-5 w-1 bg-[#059669]/10 -z-1" style={{ backgroundColor: `${activeTheme.accentColor}20` }} />
                      </div>
                    ) : currentSlide.layoutType === 'infographic-grid' ? (
                      <div className="grid grid-cols-2 gap-3 flex-1 overflow-hidden pointer-events-none">
                         {currentSlide.content
                          .filter(point => point.trim())
                          .map((point, i) => (
                            <motion.div
                              key={i}
                              whileHover={{ scale: 1.02 }}
                              className="bg-white/80 p-3 rounded-xl border-t-4 border-[#059669] shadow-inner flex items-center pointer-events-none"
                              style={{ borderTopColor: i % 3 === 0 ? activeTheme.accentColor : i % 3 === 1 ? activeTheme.secondaryColor : '#FACC15' }}
                            >
                                  <p 
                                    dangerouslySetInnerHTML={{ __html: point }}
                                    contentEditable={true}
                                    suppressContentEditableWarning={true}
                                    onBlur={(e) => updateSlideContent(currentSlideIdx, i, e.currentTarget.innerHTML || "")}
                                    onClick={(e) => { e.stopPropagation(); setSelectedSlideElement({ type: 'bullet', index: i }); setSelectedSlideImageId(null); }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className={cn(
                                      "font-bold leading-tight outline-none w-full cursor-text select-text pointer-events-auto",
                                      currentSlide.content.length > 6 ? "text-[9px]" : "text-[11px]"
                                    )}
                                    style={{ 
                                      color: (currentSlide.individualBulletSettings?.[i]?.color || currentSlide.bulletSettings?.color) || undefined,
                                      fontFamily: (currentSlide.individualBulletSettings?.[i]?.family || currentSlide.bulletSettings?.family) ? `'${currentSlide.individualBulletSettings?.[i]?.family || currentSlide.bulletSettings?.family}', sans-serif` : undefined,
                                      fontSize: (currentSlide.individualBulletSettings?.[i]?.size || currentSlide.bulletSettings?.size) ? `${currentSlide.individualBulletSettings?.[i]?.size || currentSlide.bulletSettings?.size}px` : undefined,
                                      position: 'relative',
                                      zIndex: 10
                                    }}
                                  />
                            </motion.div>
                          ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap justify-center gap-4 py-2 flex-1 pointer-events-none">
                        {currentSlide.content
                          .filter(point => point.trim())
                          .map((point, i) => (
                            <motion.div
                              key={i}
                              whileHover={{ scale: 1.1 }}
                              className={cn(
                                "rounded-full bg-white shadow-xl flex items-center justify-center p-4 text-center relative border-4 border-[#D1FAE5] pointer-events-none",
                                currentSlide.content.length > 5 ? "w-28 h-28" : "w-32 h-32"
                              )}
                              style={{ borderColor: i % 2 === 0 ? activeTheme.accentColor : activeTheme.secondaryColor }}
                            >
                              <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-[#059669] text-white flex items-center justify-center font-black text-[10px] pointer-events-none" style={{ backgroundColor: i % 2 === 0 ? activeTheme.accentColor : activeTheme.secondaryColor }}>
                                {i + 1}
                              </div>
                              <p 
                                dangerouslySetInnerHTML={{ __html: point }}
                                contentEditable={true}
                                suppressContentEditableWarning={true}
                                onBlur={(e) => updateSlideContent(currentSlideIdx, i, e.currentTarget.innerHTML || "")}
                                onClick={(e) => { e.stopPropagation(); setSelectedSlideElement({ type: 'bullet', index: i }); setSelectedSlideImageId(null); }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className={cn(
                                  "font-black leading-tight outline-none cursor-text select-text pointer-events-auto",
                                  currentSlide.content.length > 5 ? "text-[9px]" : "text-[10px]"
                                )}
                                style={{ 
                                  color: (currentSlide.individualBulletSettings?.[i]?.color || currentSlide.bulletSettings?.color) || undefined,
                                  fontFamily: (currentSlide.individualBulletSettings?.[i]?.family || currentSlide.bulletSettings?.family) ? `'${currentSlide.individualBulletSettings?.[i]?.family || currentSlide.bulletSettings?.family}', sans-serif` : undefined,
                                  fontSize: (currentSlide.individualBulletSettings?.[i]?.size || currentSlide.bulletSettings?.size) ? `${currentSlide.individualBulletSettings?.[i]?.size || currentSlide.bulletSettings?.size}px` : undefined,
                                  position: 'relative',
                                  zIndex: 10
                                }}
                              />
                            </motion.div>
                          ))}
                      </div>
                    )}
                  </div>

                  {!isDownloading && (
                    <div className="absolute bottom-6 right-8 text-[10px] font-black uppercase tracking-widest opacity-30 z-[70] pointer-events-none">
                      Slide {currentSlideIdx + 1}
                    </div>
                  )}

                  <div className={cn(
                    "absolute inset-0 pointer-events-none",
                    selectedSlideImageId ? "z-[500]" : "z-[400]"
                  )}>
                    {currentSlide.images?.map(img => (
                      <motion.div
                        key={img.id}
                        drag
                        dragMomentum={false}
                        dragElastic={0}
                        dragConstraints={slideRef}
                        onDragStart={() => {
                          setSelectedSlideImageId(img.id);
                        }}
                        onTap={(e) => {
                          e.stopPropagation();
                          setSelectedSlideImageId(img.id);
                        }}
                        onDragEnd={(_, info) => {
                          const deltaX = info.offset.x;
                          const deltaY = info.offset.y;
                          if (isNaN(deltaX) || isNaN(deltaY)) return;
                          
                          const newX = img.x + deltaX;
                          const newY = img.y + deltaY;
                          
                          // Final safety check to ensure coordinates are within reasonable bounds
                          // The slide is roughly 896px wide (max-w-4xl)
                          if (newX < -1000 || newX > 2000 || newY < -1000 || newY > 2000) return;
                          
                          updateSlideImage(img.id, { x: newX, y: newY });
                        }}
                        animate={{ x: 0, y: 0 }}
                        transition={{ type: "tween", duration: 0 }}
                        className={cn(
                          "absolute pointer-events-auto group/slide-img touch-none",
                          selectedSlideImageId === img.id ? "ring-4 ring-emerald-400 ring-offset-4 rounded-lg cursor-grabbing" : ""
                        )}
                        style={{ 
                          left: img.x, 
                          top: img.y,
                          width: img.size,
                          height: 'auto',
                          rotate: `${img.rotation || 0}deg`,
                          position: 'absolute',
                          cursor: selectedSlideImageId === img.id ? 'grabbing' : 'grab',
                          zIndex: selectedSlideImageId === img.id ? 1000 : 500
                        }}
                      >
                        <div className="relative">
                          {img.url ? (
                            <img 
                              src={img.url} 
                              className={cn(
                                "w-full h-auto block select-none rounded-lg shadow-xl transition-opacity duration-300",
                                imgFailed[img.id] ? "hidden" : "opacity-100"
                              )} 
                              alt="slide element" 
                              draggable={false}
                              onError={() => setImgFailed(prev => ({ ...prev, [img.id]: true }))}
                            />
                          ) : img.shape ? (
                            <RenderShape shape={img.shape} color={img.color} size={img.size} />
                          ) : null}
                        </div>

                        {selectedSlideImageId === img.id && (
                          <div className="absolute inset-0 pointer-events-none border-2 border-emerald-400 rounded-lg">
                            {/* Resize Handle - More integrated */}
                            <div 
                              className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-500 rounded-full cursor-nwse-resize flex items-center justify-center -mb-4 -mr-4 z-[110] pointer-events-auto shadow-lg hover:scale-110 transition-transform"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const startX = e.clientX;
                                const startSize = img.size;
                                const onMouseMove = (moveEvent: MouseEvent) => {
                                  const deltaX = moveEvent.clientX - startX;
                                  const newSize = Math.max(40, startSize + (deltaX * 1.5));
                                  updateSlideImage(img.id, { size: newSize });
                                };
                                const onMouseUp = () => {
                                  document.removeEventListener('mousemove', onMouseMove);
                                  document.removeEventListener('mouseup', onMouseUp);
                                };
                                document.addEventListener('mousemove', onMouseMove);
                                document.addEventListener('mouseup', onMouseUp);
                              }}
                            >
                              <div className="w-2 h-2 bg-white rounded-sm" />
                            </div>

                            {/* Integrated Control Buttons - On the image itself */}
                            <div className="absolute top-2 right-2 flex gap-1 pointer-events-auto z-[120]">
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (img.url) {
                                    setEditingImageUrl(img.url); 
                                    setImageEditorCallback({ cb: (newUrl) => updateSlideImage(img.id, { url: newUrl }) });
                                  }
                                }} 
                                className="p-2 bg-white/90 backdrop-blur hover:bg-emerald-50 rounded-lg text-emerald-700 shadow-sm transition-all"
                                title="Edit / Remove BG"
                              >
                                <Scissors size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateSlideImage(img.id, { rotation: (img.rotation || 0) + 15 });
                                }}
                                className="p-2 bg-white/90 backdrop-blur hover:bg-emerald-50 rounded-lg text-emerald-600 shadow-sm transition-all"
                                title="Rotate"
                              >
                                <RotateCw size={14} />
                              </button>
                               <button
                                 type="button"
                                 onClick={(e) => {
                                   if (e) {
                                     e.preventDefault();
                                     e.stopPropagation();
                                   }
                                   if (window.confirm("Delete this image?")) {
                                     console.log("🗑️ removeSlideImage from viewer click:", img.id);
                                     removeSlideImage(img.id);
                                   }
                                 }}
                                 className="p-2 bg-white/90 backdrop-blur hover:bg-red-50 rounded-lg text-red-500 shadow-sm transition-all cursor-pointer relative z-50"
                                 title="Delete"
                               >
                                 <Trash2 size={14} />
                               </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 mr-auto">
                    <button 
                      onClick={undo}
                      disabled={historyIndex <= 0}
                      className="p-3 bg-white text-[#064E3B] border-2 border-[#D1FAE5] rounded-xl hover:bg-[#F0FDF4] transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                      title="Undo (Ctrl+Z)"
                    >
                      <Undo size={20} />
                    </button>
                    <button 
                      onClick={redo}
                      disabled={historyIndex >= historyStack.length - 1}
                      className="p-3 bg-white text-[#064E3B] border-2 border-[#D1FAE5] rounded-xl hover:bg-[#F0FDF4] transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                      title="Redo (Ctrl+Y)"
                    >
                      <Redo size={20} />
                    </button>
                  </div>
                  <button 
                    onClick={() => setCurrentSlideIdx(Math.max(0, currentSlideIdx - 1))} 
                    className="p-4 bg-white text-[#7C7A65] border-2 border-[#E5E2C8] rounded-full hover:scale-110 active:scale-95 transition-all shadow-md disabled:opacity-30"
                    disabled={currentSlideIdx === 0}
                  >
                    <ChevronLeft size={24} />
                  </button>
                    <div className="px-6 py-2 bg-white border-2 border-[#E5E2C8] rounded-full font-black text-sm text-[#7C7A65] flex items-center gap-4 relative z-50">
                      <span>{currentSlideIdx + 1} / {content.slides.length}</span>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeSlide(currentSlideIdx);
                        }}
                        className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                        title="Delete this slide"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  <button 
                    onClick={() => setCurrentSlideIdx(Math.min(content.slides.length - 1, currentSlideIdx + 1))} 
                    className="p-4 bg-white text-[#7C7A65] border-2 border-[#E5E2C8] rounded-full hover:scale-110 active:scale-95 transition-all shadow-md disabled:opacity-30"
                    disabled={currentSlideIdx === content.slides.length - 1}
                  >
                    <ChevronRight size={24} />
                  </button>
                  <button
                    onClick={downloadPPTX}
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-6 py-3 bg-[#059669] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#047857] transition-all shadow-md disabled:opacity-50"
                  >
                    {isDownloading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                    Download PPTX
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center mt-20 group">
                <div className="w-32 h-32 bg-[#D1FAE5] rounded-[40px] flex items-center justify-center mb-6 animate-bounce">
                   <Presentation size={64} className="text-[#059669]" />
                </div>
                <h3 className="text-2xl font-black text-[#064E3B] uppercase tracking-widest mb-2">Ready to Design?</h3>
                <p className="text-sm font-medium text-[#064E3B]/60 max-w-md mx-auto mb-8">
                  {content?.lessonTitle || content?.lessonPlan?.overallTopic 
                    ? `We can generate a presentation for "${content.lessonTitle || content.lessonPlan?.overallTopic}" in seconds.`
                    : "Describe your lesson in the sidebar and click generate to create beautiful interactive slides."}
                </p>
                <button 
                  onClick={generateOnlySlides}
                  disabled={isGenerating || (!lessonInput.trim() && !content?.lessonTitle && !content?.lessonPlan?.overallTopic)}
                  className="px-8 py-4 bg-[#059669] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-[#059669]/20 hover:scale-105 transition-all flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  {isGenerating ? "Magic in progress..." : "Generate Presentation Now"}
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  };

  const renderWorksheetView = () => {
    if (!content || !content.worksheet) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#FDFBF7]">
          <div className="text-center space-y-4">
            <FileText size={48} className="mx-auto text-[#064E3B]/20" />
            <p className="text-[#064E3B]/60 font-bold">No worksheet content available.</p>
            <button onClick={() => setCurrentView('educator-suite')} className="text-[#059669] font-black uppercase text-[10px] tracking-widest hover:underline">
              Return to Suite
            </button>
          </div>
        </div>
      );
    }
    return (
    <div className="flex-1 flex flex-col bg-[#F0FDF4] overflow-hidden">
       <div className="h-16 bg-white border-b-2 border-[#D1FAE5] flex items-center justify-between px-6 z-20">
         <div className="flex items-center gap-4">
           <button onClick={() => {
             clearWorkspace();
             setCurrentView('educator-suite');
           }} className="flex items-center gap-2 text-[#064E3B]/60 font-bold hover:text-[#064E3B] transition-colors">
             <Home size={18} /> Suite
           </button>
           {content?.lessonPlan && (
             <button 
               onClick={() => setCurrentView('lesson-plan')} 
               className="flex items-center gap-2 px-3 py-1.5 bg-[#F0FDF4] text-[#059669] rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#D1FAE5] transition-all border border-[#D1FAE5]"
             >
               <ChevronLeft size={14} /> Lesson Design
             </button>
           )}
         </div>
        <div className="flex items-center gap-2">
          <FileText className="text-[#FACC15]" size={24} />
          <h2 className="text-xl font-black text-[#064E3B]">Worksheet Lab</h2>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={resetWorksheet}
            className="px-4 py-2 bg-white text-[#064E3B] border-2 border-[#D1FAE5] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/80 transition-all shadow-sm flex items-center gap-2"
          >
            <Plus size={14} /> New Worksheet
          </button>
          <div className="h-8 w-px bg-[#D1FAE5] mx-1" />
          {content?.worksheet && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => saveProject()}
                className="px-4 py-2 bg-white text-[#064E3B] border-2 border-[#D1FAE5] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#F0FDF4] transition-all shadow-sm flex items-center gap-2"
              >
                <PlusCircle size={14} /> Save
              </button>
              <button 
                onClick={() => submitToAdmin()}
                className="px-4 py-2 bg-[#FACC15] text-[#064E3B] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-yellow-300 transition-all shadow-sm flex items-center gap-2"
              >
                <CheckCircle size={14} /> Submit
              </button>
            </div>
          )}
          <div className="w-12" />
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 bg-white border-r-2 border-[#D1FAE5] p-6 space-y-6 overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-[#064E3B]/60 tracking-widest leading-none">Worksheet Settings</h3>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Grade</label>
              <select value={yearGroup} onChange={(e) => setYearGroup(e.target.value)} className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-sm font-bold">
                {['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12'].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Lexile Level</label>
              <select value={lexileLevel} onChange={(e) => setLexileLevel(e.target.value)} className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-sm font-bold">
                {['None', 'BR99-100', '100-200', '200-300', '300-400', '400-500', '500-600', '600-700', '700-800', '800-900', '900-1050'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Subject</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-sm font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Topic</label>
              <input 
                type="text" 
                value={lessonInput} 
                onChange={(e) => {
                  const val = e.target.value;
                  setLessonInput(val);
                  if (content) setContent(prev => prev ? ({ ...prev, lessonTitle: val }) : null);
                }} 
                className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-sm font-bold" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Number of Questions</label>
              <input type="number" value={numQuestions} onChange={(e) => setNumQuestions(parseInt(e.target.value))} className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-sm font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Question Types</label>
              <div className="grid grid-cols-1 gap-1">
                {QUESTION_TYPES.map(type => (
                  <label key={type} className="flex items-center gap-2 text-xs font-bold text-[#064E3B]">
                    <input 
                      type="checkbox" 
                      className="rounded border-[#D1FAE5] text-[#059669] focus:ring-[#059669]"
                      checked={selectedQuestionTypes.includes(type)}
                      onChange={() => setSelectedQuestionTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>
            {/* Selection Styles Removed */}

            <div className="space-y-4 pt-4 border-t-2 border-[#D1FAE5]">
              <h3 className="text-xs font-black uppercase text-[#064E3B]/60 tracking-widest leading-none">Generation Prompt</h3>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Topic / Instructions</label>
                <textarea 
                  value={lessonInput} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setLessonInput(val);
                    if (content) setContent(prev => prev ? ({ ...prev, lessonTitle: val }) : null);
                  }}
                  className="w-full h-24 p-2 bg-[#F9F8F0] border-2 border-[#D1FAE5] rounded-xl text-sm font-bold resize-none shadow-sm focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 outline-none transition-all" 
                  placeholder="e.g. Geometry for Year 4 or Scientific Inquiry..."
                />
              </div>
            </div>
            
            <div className="space-y-4 pt-4 border-t-2 border-[#D1FAE5]">
              <h3 className="text-xs font-black uppercase text-[#064E3B]/60 tracking-widest leading-none">Lesson Overview</h3>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Description</label>
                <textarea 
                  value={content?.worksheet?.description || ''} 
                  onChange={(e) => updateWorksheetMetadata('description', e.target.value)}
                  className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-xs font-bold resize-none h-20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Methodology</label>
                  <textarea 
                    value={content?.worksheet?.methodology || ''} 
                    onChange={(e) => updateWorksheetMetadata('methodology', e.target.value)}
                    placeholder="e.g. Aligned with Cambridge standards, focusing on interactive conceptual depth and scaffolded exercises."
                    className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-xs font-bold resize-none h-20 italic"
                  />
              </div>
            </div>
            <button 
              onClick={() => generateOnlyWorksheet(false)} 
              disabled={isGenerating || !lessonInput.trim()}
              className="w-full py-3 bg-[#059669] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#047857] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate Worksheet
            </button>
            {content?.worksheet && (
              <button 
                onClick={downloadDOCX}
                className="w-full py-3 bg-[#F0FDF4] text-[#064E3B] border-2 border-[#059669] rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#D1FAE5] transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <Download /> Download DOCX
              </button>
            )}
          </div>
        </aside>
        <main className="flex-1 p-8 overflow-y-auto bg-[#F0FDF4]/50 custom-scrollbar">
          {content?.worksheet?.sections && content.worksheet.sections.length > 0 ? (
            <div className="max-w-4xl mx-auto bg-white p-16 pt-16 shadow-2xl border-t-[32px] border-[#1B4332] min-h-[1200px] relative" ref={worksheetRef}>
                <h1 
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  onBlur={(e) => updateWorksheetMetadata('title', e.currentTarget.innerHTML || "")}
                  data-worksheet-meta="title"
                  dangerouslySetInnerHTML={{ __html: content.worksheet.title }}
                  className="text-4xl font-black text-center mb-2 tracking-tight outline-none focus:ring-2 focus:ring-[#059669]/20 rounded px-1 transition-all cursor-text select-text min-h-[1.2em] relative z-[100]"
                >
                </h1>
               <p className="text-center font-bold text-[#7C7A65] mb-12 uppercase tracking-widest text-xs opacity-50">{content.gradeLevel} • {content.subject} • {content.metadata?.lexileLevel}</p>
               
               {content.worksheet.readingPassage && (
                 <div className="mb-12 p-8 bg-[#F0FFFE] rounded-3xl border-2 border-[#4ECDC4] border-dashed">
                   <h2 className="text-xl font-black mb-4 uppercase tracking-tight text-[#4ECDC4]">Reading Passage</h2>
                    <p 
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      onMouseDown={(e) => e.stopPropagation()}
                      onBlur={(e) => updateWorksheetMetadata('readingPassage', e.currentTarget.innerHTML || "")}
                      data-worksheet-meta="readingPassage"
                      dangerouslySetInnerHTML={{ __html: content.worksheet.readingPassage || "" }}
                      className="text-lg leading-relaxed text-[#2D3436] font-serif outline-none focus:ring-1 focus:ring-[#4ECDC4]/20 rounded px-1 cursor-text select-text relative z-[100] min-h-[1em]"
                    ></p>
                 </div>
               )}

               {/* Description & Methodology Section */}
               <div className="mb-12 space-y-6">
                  {content.worksheet.description && (
                    <div className="p-8 bg-[#F0FDF4] border-2 border-[#10B981] rounded-3xl">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-white rounded-xl shadow-sm text-[#064E3B]">
                          <Info size={20} />
                        </div>
                        <h2 className="text-xl font-black uppercase tracking-tight text-[#064E3B]">Worksheet Description</h2>
                      </div>
                      <p className="text-lg font-medium text-[#064E3B]/80 leading-relaxed">
                        {content.worksheet.description}
                      </p>
                    </div>
                  )}

                  <div className="p-8 bg-[#FEFCE8] border-2 border-[#FACC15] rounded-3xl">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-white rounded-xl shadow-sm text-[#064E3B]">
                        <BookOpen size={20} />
                      </div>
                      <h2 className="text-xl font-black uppercase tracking-tight text-[#064E3B]">Methodology & Lesson Focus</h2>
                    </div>
                    <p className="text-lg font-medium text-[#064E3B]/80 leading-relaxed italic">
                      {content.worksheet.methodology || `This lesson focus on ${content.subject} using inquiry-based methods to enhance student engagement and conceptual depth in ${content.gradeLevel}.`}
                    </p>
                  </div>
               </div>

               <div className="space-y-12">
                 {content.worksheet.sections.map((section, si) => (
                   <div key={si} className="space-y-6">
                     <div className="flex items-center gap-4">
                        <span className="w-10 h-10 bg-[#4ECDC4] text-white rounded-xl flex items-center justify-center font-black">{si + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 
                              contentEditable={true}
                              suppressContentEditableWarning={true}
                              onMouseDown={(e) => e.stopPropagation()}
                              onBlur={(e) => updateWorksheetSection(si, 'title', e.currentTarget.innerHTML || "")}
                              data-worksheet-section={si}
                              data-worksheet-field="title"
                              dangerouslySetInnerHTML={{ __html: section.title }}
                              className="text-xl font-black uppercase tracking-tight outline-none focus:ring-1 focus:ring-[#059669]/20 rounded px-1 cursor-text select-text"
                            ></h3>
                             <button 
                               type="button"
                               onClick={(e) => {
                                 e.preventDefault();
                                 e.stopPropagation();
                                 removeWorksheetSection(si);
                               }}
                               className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer relative z-50"
                               title="Delete this section"
                             >
                               <Trash2 size={16} />
                             </button>
                          </div>
                          <p 
                            contentEditable={true}
                            suppressContentEditableWarning={true}
                            onBlur={(e) => updateWorksheetSection(si, 'instructions', e.currentTarget.innerHTML || "")}
                            data-worksheet-section={si}
                            data-worksheet-field="instructions"
                            dangerouslySetInnerHTML={{ __html: section.instructions }}
                            className="text-sm font-bold text-[#7C7A65] italic outline-none focus:ring-1 focus:ring-[#059669]/20 rounded px-1 cursor-text"
                          ></p>
                        </div>
                     </div>
                     <div className="grid grid-cols-1 gap-8 pl-14">
                        {section.questions.map((q, qi) => (
                          <div key={qi} className="space-y-3">
                             <div className="flex gap-2 group/q">
                               <span className="text-lg font-bold flex-shrink-0">Q{qi + 1}:</span>
                               <p 
                                 contentEditable={true}
                                 suppressContentEditableWarning={true}
                                 onMouseDown={(e) => e.stopPropagation()}
                                 onBlur={(e) => updateWorksheetQuestion(si, qi, e.currentTarget.innerHTML || "")}
                                 data-worksheet-section={si}
                                 data-worksheet-question={qi}
                                 dangerouslySetInnerHTML={{ __html: q.text }}
                                 className="text-lg font-bold outline-none focus:ring-1 focus:ring-[#059669]/20 rounded px-1 flex-1 cursor-text select-text relative z-[100] min-h-[1em]"
                               ></p>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    removeWorksheetQuestion(si, qi);
                                  }}
                                  className="opacity-0 group-hover/q:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all cursor-pointer relative z-50"
                                  title="Delete question"
                                >
                                  <Trash2 size={14} />
                                </button>
                             </div>
                             {q.options ? (
                               <div className="grid grid-cols-2 gap-3">
                                 {q.options.map((opt, oi) => (
                                   <div key={oi} className="p-3 border-2 border-[#E5E2C8] rounded-xl text-sm font-bold flex items-center gap-3">
                                     <div className="w-4 h-4 border-2 border-[#E5E2C8] rounded-full" />
                                     {opt}
                                   </div>
                                 ))}
                               </div>
                             ) : (
                               <div className="h-24 w-full border-b-2 border-dashed border-[#E5E2C8]/50 mt-4" />
                             )}
                          </div>
                        ))}
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center mt-20 opacity-30 group animate-pulse">
              <div className="w-32 h-32 bg-[#E1F7F5] rounded-[40px] flex items-center justify-center mb-6">
                <FileText size={64} className="text-[#4ECDC4]" />
              </div>
              <p className="text-xl font-black text-[#4ECDC4] uppercase tracking-widest">Generate a worksheet to see preview</p>
            </div>
          )}
        </main>
      </div>
    </div>
    );
  };

  const renderPosterView = () => {
    if (!content || !content.poster) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#FDFBF7]">
          <div className="text-center space-y-4">
            <ImageIcon size={48} className="mx-auto text-[#064E3B]/20" />
            <p className="text-[#064E3B]/60 font-bold">No poster content available.</p>
            <button onClick={() => setCurrentView('educator-suite')} className="text-[#059669] font-black uppercase text-[10px] tracking-widest hover:underline">
              Return to Suite
            </button>
          </div>
        </div>
      );
    }
    return (
    <div className="flex-1 flex flex-col bg-[#F0FDF4] overflow-hidden">
      <div className="h-16 bg-white border-b-2 border-[#D1FAE5] flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => {
            clearWorkspace();
            setCurrentView('educator-suite');
          }} className="flex items-center gap-2 text-[#064E3B]/60 font-bold hover:text-[#064E3B] transition-colors">
            <Home size={18} /> Suite
          </button>
          {content?.lessonPlan && (
            <button 
              onClick={() => setCurrentView('lesson-plan')} 
              className="flex items-center gap-2 px-3 py-1.5 bg-[#F0FDF4] text-[#059669] rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#D1FAE5] transition-all border border-[#D1FAE5]"
            >
              <ChevronLeft size={14} /> Lesson Design
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ImageIcon className="text-[#FACC15]" size={24} />
          <h2 className="text-xl font-black text-[#064E3B]">Poster Studio</h2>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={resetPoster}
            className="px-4 py-2 bg-white text-[#064E3B] border-2 border-[#D1FAE5] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/80 transition-all shadow-sm flex items-center gap-2"
          >
            <Plus size={14} /> New Poster
          </button>
          <div className="h-8 w-px bg-[#D1FAE5] mx-1" />
          {content?.poster && (
            <div className="flex items-center gap-2 bg-[#F0FDF4] p-1 rounded-2xl border-2 border-[#D1FAE5]">
              <button 
                onClick={() => downloadPosterView('pdf')}
                className="px-4 py-2 bg-white text-[#064E3B] border-2 border-[#064E3B] rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#064E3B] hover:text-white transition-all shadow-sm flex items-center gap-2"
              >
                <FileText size={14} /> PDF
              </button>
              <button 
                onClick={() => downloadPosterView('jpg')}
                className="px-4 py-2 bg-[#FACC15] text-[#064E3B] rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-yellow-300 transition-all shadow-sm flex items-center gap-2"
              >
                <ImageIcon size={14} /> JPG
              </button>
            </div>
          )}
          {content?.poster && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => saveProject()}
                className="px-4 py-2 bg-white text-[#059669] border-2 border-[#D1FAE5] rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#F0FDF4] transition-all shadow-sm flex items-center gap-2"
              >
                <PlusCircle size={14} /> Save
              </button>
              <button 
                onClick={() => submitToAdmin()}
                className="px-4 py-2 bg-[#059669] text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#047857] transition-all shadow-sm flex items-center gap-2"
              >
                <CheckCircle size={14} /> Submit
              </button>
            </div>
          )}
        </div>
      </div>
       <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 bg-white border-r-2 border-[#D1FAE5] p-6 space-y-6 overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-[#064E3B]/60 tracking-widest leading-none">Poster Criteria</h3>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Subject/Topic</label>
              <input type="text" value={lessonInput} onChange={(e) => setLessonInput(e.target.value)} className="w-full p-2 bg-[#FDFBF7] border-2 border-[#FEFCE8] rounded-xl text-sm font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Criteria/Style</label>
              <textarea value={posterDescription} onChange={(e) => setPosterDescription(e.target.value)} placeholder="e.g. Minimalist, colorful, informative" className="w-full h-32 p-2 bg-[#FDFBF7] border-2 border-[#FEFCE8] rounded-xl text-sm font-bold resize-none" />
            </div>
            <button 
              onClick={generateOnlyPoster} 
              disabled={isGenerating}
              className="w-full py-3 bg-[#FACC15] text-[#064E3B] rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-yellow-400 transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate Poster
            </button>
            <div className="space-y-4 pt-4 border-t border-[#FEFCE8]">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase text-[#064E3B]/60 tracking-widest leading-none">Creative Tools</h3>
                {(selectedField || selectedStickerId) && (
                  <button 
                    onClick={() => { setSelectedField(null); setSelectedStickerId(null); }}
                    className="text-[10px] font-black uppercase text-[#FACC15] flex items-center gap-1 hover:underline"
                  >
                    <MousePointer2 size={10} /> Finish Editing
                  </button>
                )}
              </div>
              {/* Tools removed */}
            </div>
 
              {/* Sticker Controls (if sticker selected) */}
              {selectedStickerId && (
                <div className="p-4 bg-white border-2 border-[#FACC15] rounded-xl shadow-lg animate-in slide-in-from-right-4 duration-300">
                   <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black uppercase text-[#064E3B]">
                      {content.poster.stickers?.find(s => s.id === selectedStickerId)?.text ? 'Text Controls' : 'Picture Controls'}
                    </span>
                    <button onClick={() => setSelectedStickerId(null)} className="p-1 hover:bg-gray-100 rounded-full"><X size={12} /></button>
                  </div>
                  
                  {content.poster.stickers?.find(s => s.id === selectedStickerId)?.shape && (
                    <div className="space-y-1 mb-3">
                      <label className="text-[8px] font-bold text-[#064E3B]/40 uppercase">Shape Color</label>
                      <input 
                        type="color" 
                        className="w-full h-8 rounded-lg cursor-pointer"
                        value={content.poster.stickers?.find(s => s.id === selectedStickerId)?.color || '#059669'}
                        onChange={(e) => updateSticker(selectedStickerId, { color: e.target.value })}
                      />
                    </div>
                  )}

                  {content.poster.stickers?.find(s => s.id === selectedStickerId)?.text && (
                    <div className="space-y-3 mb-4">
                       <textarea 
                         className="w-full text-xs p-2 border rounded font-bold"
                         value={content.poster.stickers?.find(s => s.id === selectedStickerId)?.text || ''}
                         onChange={(e) => updateSticker(selectedStickerId, { text: e.target.value })}
                         rows={2}
                       />
                       {/* Font Controls Removed */}
                    </div>
                  )}
 
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeSticker(selectedStickerId);
                      }}
                      className="p-2 bg-red-100 text-red-600 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 hover:bg-red-500 hover:text-white transition-all cursor-pointer shadow-sm"
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                    <div className="flex items-center gap-2 px-2 bg-gray-50 rounded-lg">
                       <RotateCw size={12} className="text-gray-400" />
                       <input 
                         type="range" min="0" max="360" 
                         value={content.poster.stickers?.find(s => s.id === selectedStickerId)?.rotation || 0}
                         onChange={(e) => updateSticker(selectedStickerId, { rotation: parseInt(e.target.value) })}
                         className="w-full h-1"
                       />
                    </div>
                  </div>
                  
                  <div className="mt-3 space-y-1">
                    <label className="text-[8px] font-bold text-[#064E3B]/40 uppercase">Size</label>
                    <input 
                      type="range" 
                      min={content.poster.stickers?.find(s => s.id === selectedStickerId)?.text ? "10" : "50"} 
                      max={content.poster.stickers?.find(s => s.id === selectedStickerId)?.text ? "100" : "500"} 
                      value={content.poster.stickers?.find(s => s.id === selectedStickerId)?.size || 150}
                      onChange={(e) => updateSticker(selectedStickerId, { size: parseInt(e.target.value) })}
                      className="w-full h-2 bg-[#D1FAE5] rounded-lg appearance-none cursor-pointer accent-[#059669]"
                    />
                  </div>
                </div>
              )}
 
              <div className="grid grid-cols-2 gap-2">
                <label className="cursor-pointer py-2 px-3 bg-[#FEFCE8] text-[#064E3B] border-2 border-[#FACC15] rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-[#FACC15] transition-all flex items-center justify-center gap-2">
                  <PlusCircle size={14} /> Add Picture
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => addSticker(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }} />
                </label>
                <button 
                  onClick={() => handlePasteURL('sticker')}
                  className="py-2 px-3 bg-[#FEFCE8] text-[#064E3B] border-2 border-[#FACC15] rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-[#FACC15] transition-all flex items-center justify-center gap-2"
                >
                  <Search size={14} /> Web Path
                </button>
                <button 
                  onClick={addTextSticker}
                  className="col-span-2 py-2 px-3 bg-[#FEFCE8] text-[#064E3B] border-2 border-dashed border-[#FACC15]/50 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-[#FACC15] transition-all flex items-center justify-center gap-2"
                >
                  <Type size={14} /> Add Wording
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Add Shape</label>
                <div className="grid grid-cols-4 gap-2">
                  <button onClick={() => addShapeSticker('square')} className="p-2 border-2 border-[#D1FAE5] rounded-xl hover:bg-[#D1FAE5] transition-all flex items-center justify-center text-[#059669] shadow-sm"><Square size={16} /></button>
                  <button onClick={() => addShapeSticker('circle')} className="p-2 border-2 border-[#D1FAE5] rounded-xl hover:bg-[#D1FAE5] transition-all flex items-center justify-center text-[#059669] shadow-sm"><Circle size={16} /></button>
                  <button onClick={() => addShapeSticker('triangle')} className="p-2 border-2 border-[#D1FAE5] rounded-xl hover:bg-[#D1FAE5] transition-all flex items-center justify-center text-[#059669] shadow-sm"><Triangle size={16} /></button>
                  <button onClick={() => addShapeSticker('star')} className="p-2 border-2 border-[#D1FAE5] rounded-xl hover:bg-[#D1FAE5] transition-all flex items-center justify-center text-[#059669] shadow-sm"><Star size={16} /></button>
                </div>
              </div>
 
              <div className="flex gap-2">
                 <button 
                   onClick={() => {
                     if (window.confirm("Clear all added pictures?")) {
                       updatePosterField('stickers', []);
                     }
                   }}
                   className="flex-1 py-1 text-[9px] font-bold text-[#064E3B]/40 hover:text-red-500 transition-colors uppercase flex items-center justify-center gap-1"
                 >
                   <Trash2 size={10} /> Clear Pictures
                 </button>
              </div>
 
              <p className="text-[10px] text-[#064E3B]/40 font-bold leading-tight mt-2 italic px-1">
                Tip: Drag stickers to move them.
              </p>
            </div>
 
            <div className="space-y-4 pt-4 border-t border-[#D1FAE5]">
              <h3 className="text-xs font-black uppercase text-[#064E3B]/60 tracking-widest leading-none">Export Poster</h3>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => downloadPosterView('pdf')}
                  className="py-2 px-3 bg-white border-2 border-[#059669] text-[#059669] rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-[#059669] hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <FileText size={12} /> PDF
                </button>
                <button 
                  onClick={() => downloadPosterView('jpg')}
                  className="py-2 px-3 bg-[#059669] text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-[#047857] transition-all flex items-center justify-center gap-2"
                >
                  <ImageIcon size={12} /> JPG
                </button>
              </div>
            </div>
        </aside>
        <main className="flex-1 p-8 overflow-y-auto flex justify-center bg-[#F0FDF4]/50 custom-scrollbar">
          {content?.poster?.title ? (
            <div 
              className="w-[595px] h-[841px] relative overflow-hidden flex flex-col group shadow-[0_40px_100px_rgba(0,0,0,0.5)] transition-all duration-700 bg-[#FDFBF7] select-text" 
              ref={posterRef}
              style={{ borderColor: content.poster.colorPalette?.[0] || '#2D3436' }}
            >
              {/* VINTAGE PAPER TEXTURE */}
              <div className="absolute inset-0 z-5 pointer-events-none opacity-[0.15] mix-blend-multiply" 
                style={{ backgroundImage: 'url(https://www.transparenttextures.com/patterns/old-mathematics.png)' }} 
              />
              <div className="absolute inset-0 z-5 pointer-events-none opacity-[0.05] mix-blend-overlay" 
                style={{ backgroundImage: 'url(https://www.transparenttextures.com/patterns/stardust.png)' }} 
              />

              {/* BACKGROUND SCENE */}
              <div className="absolute inset-0 z-0 bg-[#FDFBF7]">
                <img 
                  key={content.poster.customImages?.background || content.poster.illustrationPrompt}
                  referrerPolicy="no-referrer"
                  src={content.poster.customImages?.background || `https://image.pollinations.ai/prompt/${encodeURIComponent("professional artistic wallpaper for classroom poster about " + (content.poster.illustrationPrompt || content.poster.title) + ", whimsical children's illustration style, vibrant colors, magical background, no text")}?width=800&height=1200&nologo=true&seed=42`} 
                  className="w-full h-full object-cover"
                  alt="Poster Background"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/30" />
                
                {/* Background Hover Controls */}
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4 z-[60] group/bg-controls pointer-events-none">
                  <p className="text-white font-black uppercase tracking-widest text-xs">Custom Background</p>
                  <div className="flex gap-4">
                    <label className="cursor-pointer bg-white text-black px-4 py-2 rounded-full font-bold text-[10px] hover:bg-[#FFD93D] transition-colors flex items-center gap-2">
                       <FileUp size={14} /> Upload
                       <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'background')} />
                    </label>
                    <button onClick={() => handlePasteURL('background')} className="bg-black text-white px-4 py-2 rounded-full font-bold text-[10px] hover:bg-[#6C5CE7] transition-colors border border-white/20 flex items-center gap-2">
                       <Search size={14} /> Paste URL
                    </button>
                    {content.poster.customImages?.background && (
                      <button onClick={() => setCustomImage('background', '')} className="bg-red-500 text-white px-4 py-2 rounded-full font-bold text-[10px] hover:bg-red-600 transition-colors">
                         Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* VINTAGE PAPER TEXTURE */}
              <div className="absolute inset-0 z-10 pointer-events-none opacity-20 mix-blend-multiply" 
                style={{ backgroundImage: 'url(https://www.transparenttextures.com/patterns/old-mathematics.png)' }} 
              />
              <div className="absolute inset-0 z-10 pointer-events-none opacity-5 mix-blend-overlay" 
                style={{ backgroundImage: 'url(https://www.transparenttextures.com/patterns/stardust.png)' }} 
              />

              {/* MAIN CONTENT LAYER */}
              <div className="relative z-20 flex-1 flex flex-col p-10 pt-16 items-center overflow-hidden">
                
                {/* HEADER RIBBON */}
                <div 
                  className={cn(
                    "relative mb-6 cursor-pointer transition-transform hover:scale-105 active:scale-95 group/header pointer-events-auto",
                    selectedField === 'subTitle' && "ring-4 ring-[#059669] ring-offset-4 rounded-lg"
                  )}
                  onClick={() => { setSelectedField('subTitle'); setSelectedStickerId(null); }}
                >
                  <div className="absolute inset-0 bg-[#2D3436] transform -rotate-1 skew-x-[-10deg] shadow-xl group-hover/header:rotate-0 transition-transform" />
                  <div className="relative px-10 py-3 text-center min-w-[200px] z-20">
                     <div 
                       contentEditable={true}
                       suppressContentEditableWarning={true}
                       onMouseDown={(e) => {
                         e.stopPropagation();
                       }}
                       onBlur={(e) => updatePosterField('subTitle', e.currentTarget.innerHTML || "")}
                       dangerouslySetInnerHTML={{ __html: content.poster.subTitle || 'CLASSROOM GUIDE' }}
                       className="bg-transparent border-none text-center focus:ring-0 text-white text-lg font-black tracking-[0.3em] uppercase drop-shadow-md w-full cursor-text outline-none select-text min-h-[1.2em] relative"
                       style={{ 
                         fontFamily: content.poster.subTitleSettings?.family ? `'${content.poster.subTitleSettings.family}', cursive, sans-serif` : 'Montserrat, sans-serif',
                         fontSize: content.poster.subTitleSettings?.size ? `${content.poster.subTitleSettings.size / 4}px` : '20px',
                         color: content.poster.subTitleSettings?.color || 'white',
                         zIndex: 100
                       }}
                     ></div>
                  </div>
                </div>

                {/* MAIN TITLE */}
                <div 
                  className={cn(
                    "relative mb-10 text-center group/title w-full transition-all p-6 rounded-[2rem] pointer-events-auto z-20",
                    selectedField === 'title' && "bg-white/30 backdrop-blur-sm ring-4 ring-[#059669] ring-offset-8"
                  )}
                  onClick={() => { setSelectedField('title'); setSelectedStickerId(null); }}
                >
                  <div 
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => updatePosterField('title', e.currentTarget.innerHTML || "")}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    dangerouslySetInnerHTML={{ __html: content.poster.title || 'POSTER TITLE' }}
                    className="w-full bg-transparent border-none text-center focus:ring-0 resize-none overflow-hidden h-auto cursor-text uppercase font-black tracking-tighter leading-[0.8] drop-shadow-2xl outline-none select-text min-h-[1em]"
                    style={{ 
                      fontFamily: content.poster.titleSettings?.family ? `'${content.poster.titleSettings.family}', cursive, sans-serif` : 'Fredoka One, sans-serif',
                      color: content.poster.titleSettings?.color || content.poster.colorPalette?.[1] || '#FFD93D',
                      fontSize: content.poster.titleSettings?.size ? `${content.poster.titleSettings.size}px` : '84px',
                      textShadow: '3px 3px 0px #2D3436, -1px -1px 0px #2D3436',
                      zIndex: 100
                    }}
                  ></div>
                  
                  {/* Decorative Sparkles */}
                  <div className="absolute -top-6 -left-6 text-yellow-400 animate-bounce pointer-events-none"><Sparkles size={40} /></div>
                  <div className="absolute -bottom-6 -right-6 text-yellow-400 animate-bounce delay-300 pointer-events-none"><Sparkles size={32} /></div>
                </div>

                {/* CALL TO ACTION BUBBLE */}
                <div 
                  className={cn(
                    "bg-[#059669] text-white px-10 py-5 rounded-full shadow-2xl skew-x-[-10deg] rotate-[-2deg] mb-14 border-4 border-white inline-block cursor-pointer transition-all hover:rotate-0 hover:scale-110 active:scale-95 group/cta pointer-events-auto",
                    selectedField === 'ctaText' && "ring-4 ring-white ring-offset-8"
                  )}
                  onClick={() => { setSelectedField('ctaText'); setSelectedStickerId(null); }}
                >
                  <div 
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onMouseDown={(e) => e.stopPropagation()}
                    onBlur={(e) => updatePosterField('ctaText', e.currentTarget.innerHTML || "")}
                    dangerouslySetInnerHTML={{ __html: content.poster.ctaText || 'LEARN MORE!' }}
                    className="bg-transparent border-none text-center focus:ring-0 text-xl font-black tracking-widest uppercase italic w-full cursor-text select-text min-h-[1.2em] outline-none"
                    style={{ 
                      fontFamily: content.poster.ctaSettings?.family ? `'${content.poster.ctaSettings.family}', cursive, sans-serif` : 'Montserrat, sans-serif',
                      fontSize: content.poster.ctaSettings?.size ? `${content.poster.ctaSettings.size / 3}px` : '28px',
                      color: content.poster.ctaSettings?.color || 'white'
                    }}
                  />
                </div>

                {/* INFORMATION GRID */}
                <div className="grid grid-cols-1 gap-6 w-full max-w-[440px] mb-12 pointer-events-auto relative z-[100]">
                  {content.poster.keyPoints.slice(0, 3).map((point, i) => (
                    <div 
                      key={i}
                      className="flex items-start gap-5 group/point"
                    >
                      <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-white shadow-2xl flex items-center justify-center border-2 border-[#2D3436] rotate-[-8deg] group-hover/point:rotate-0 transition-transform">
                        <span className="text-[#2D3436] font-black text-2xl">
                          {i === 0 ? '📅' : i === 1 ? '🌟' : '❤️'}
                        </span>
                      </div>
                      <div className="bg-white/90 backdrop-blur-md p-5 rounded-[1.5rem] shadow-xl border-2 border-white flex-1 hover:bg-white transition-colors">
                        <div 
                          contentEditable={true}
                          suppressContentEditableWarning={true}
                          onMouseDown={(e) => e.stopPropagation()}
                          onBlur={(e) => {
                            const newPoints = [...content.poster.keyPoints];
                            newPoints[i] = e.currentTarget.innerHTML || "";
                            updatePosterField('keyPoints', newPoints);
                          }}
                          dangerouslySetInnerHTML={{ __html: point || "" }}
                          className="w-full bg-transparent border-none text-base font-black text-[#2D3436] leading-tight focus:ring-0 outline-none uppercase tracking-tight select-text cursor-text min-h-[1.2em]"
                          style={{ position: 'relative', zIndex: 100 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* CHARACTERS SPOTS */}
                <div className="absolute bottom-20 left-4 w-44 h-44 group/char1 pointer-events-auto">
                   <img 
                      src={content.poster.customImages?.char1 || `https://image.pollinations.ai/prompt/${encodeURIComponent((content.poster.icons?.[0] || 'cute child character') + " waving, whimsical illustration style, white background")}?width=200&height=200&nologo=true&seed=1`}
                      className="w-full h-full object-contain translate-y-8 -translate-x-4 pointer-events-none opacity-90 transition-transform group-hover/char1:scale-110"
                      alt="character"
                   />
                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/char1:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 rounded-full overflow-hidden scale-90 z-20 pointer-events-none group-hover/char1:pointer-events-auto">
                      <label className="cursor-pointer bg-white p-2 rounded-full shadow-lg hover:bg-[#FFD93D] transition-colors">
                        <FileUp size={16} />
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'char1')} />
                      </label>
                      <button onClick={() => handlePasteURL('char1')} className="bg-black text-white p-2 rounded-full shadow-lg hover:bg-[#6C5CE7] transition-colors">
                        <Search size={16} />
                      </button>
                      {content.poster.customImages?.char1 && (
                         <button onClick={() => setCustomImage('char1', '')} className="bg-red-500 p-2 rounded-full shadow-lg text-white">
                           <X size={12} />
                         </button>
                      )}
                   </div>
                </div>
                <div className="absolute bottom-20 right-4 w-44 h-44 group/char2 pointer-events-auto">
                   <img 
                      src={content.poster.customImages?.char2 || `https://image.pollinations.ai/prompt/${encodeURIComponent((content.poster.icons?.[1] || 'cute animal friend') + " sitting, whimsical illustration style, white background")}?width=200&height=200&nologo=true&seed=2`}
                      className="w-full h-full object-contain translate-y-8 translate-x-4 pointer-events-none opacity-90 transition-transform group-hover/char2:scale-110"
                      alt="character"
                   />
                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/char2:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 rounded-full overflow-hidden scale-90 z-20 pointer-events-none group-hover/char2:pointer-events-auto">
                      <label className="cursor-pointer bg-white p-2 rounded-full shadow-lg hover:bg-[#FFD93D] transition-colors">
                        <FileUp size={16} />
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'char2')} />
                      </label>
                      <button onClick={() => handlePasteURL('char2')} className="bg-black text-white p-2 rounded-full shadow-lg hover:bg-[#6C5CE7] transition-colors">
                        <Search size={16} />
                      </button>
                      {content.poster.customImages?.char2 && (
                         <button onClick={() => setCustomImage('char2', '')} className="bg-red-500 p-2 rounded-full shadow-lg text-white">
                           <X size={12} />
                         </button>
                      )}
                   </div>
                </div>

                {/* FOOTER MESSAGE */}
                <div className="mt-auto w-full relative z-20 px-8 pb-4 pointer-events-auto">
                  <div 
                    className={cn(
                      "bg-[#FFD93D] p-6 rounded-[2.5rem] border-4 border-[#2D3436] shadow-[10px_10px_0px_#2D3436] relative overflow-hidden group/footer cursor-pointer transition-all hover:scale-105 active:scale-95",
                      selectedField === 'summary' && "ring-4 ring-[#6C5CE7] ring-offset-4"
                    )}
                    onClick={() => { setSelectedField('summary'); setSelectedStickerId(null); }}
                  >
                    <div className="absolute inset-0 bg-white/30 translate-x-full group-hover/footer:translate-x-[-100%] transition-transform duration-1000" />
                    <div 
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      onMouseDown={(e) => e.stopPropagation()}
                      onBlur={(e) => updatePosterField('summary', e.currentTarget.innerHTML || "")}
                      dangerouslySetInnerHTML={{ __html: content.poster.summary || "" }}
                      className="w-full bg-transparent border-none text-xl font-black italic text-[#2D3436] uppercase tracking-tight leading-none text-center focus:ring-0 outline-none select-text cursor-text min-h-[1.2em]"
                      style={{ 
                        fontFamily: content.poster.summarySettings?.family ? `'${content.poster.summarySettings.family}', cursive, sans-serif` : 'Fredoka One, sans-serif',
                        fontSize: content.poster.summarySettings?.size ? `${content.poster.summarySettings.size / 3}px` : '24px',
                        color: content.poster.summarySettings?.color || '#2D3436',
                        zIndex: 100
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* STICKERS LAYER */}
              <div className="absolute inset-0 z-50 pointer-events-none">
                {content.poster.stickers?.map(sticker => (
                  <motion.div
                    key={sticker.id}
                    drag
                    dragMomentum={false}
                    className={cn(
                      "absolute pointer-events-auto cursor-move group/sticker",
                      selectedStickerId === sticker.id && "scale-105"
                    )}
                    style={{ 
                      left: sticker.x, 
                      top: sticker.y,
                      width: sticker.url ? sticker.size : 'auto',
                      rotate: sticker.rotation,
                      position: 'absolute'
                    }}
                    onDragEnd={(e, info) => {
                      updateSticker(sticker.id, { x: sticker.x + info.offset.x, y: sticker.y + info.offset.y });
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStickerId(sticker.id);
                      setSelectedField(null);
                    }}
                  >
                    {sticker.url ? (
                      <img src={sticker.url} className="w-full h-auto select-none" draggable={false} alt="sticker" />
                    ) : sticker.text ? (
                      <div 
                        className="px-6 py-3 bg-white/40 backdrop-blur-md rounded-2xl whitespace-nowrap font-black uppercase drop-shadow-2xl select-none border-2 border-white/50"
                        style={{
                           fontFamily: sticker.fontSettings?.family ? `'${sticker.fontSettings.family}', cursive, sans-serif` : 'Fredoka One, sans-serif',
                           fontSize: `${sticker.size}px`,
                           color: sticker.fontSettings?.color || '#2D3436'
                        }}
                      >
                        {sticker.text}
                      </div>
                    ) : sticker.shape ? (
                      <RenderShape shape={sticker.shape} color={sticker.color} size={sticker.size} />
                    ) : null}
                    {selectedStickerId === sticker.id && (
                      <button 
                        type="button"
                        onClick={(e) => { 
                          if (e) {
                            e.preventDefault();
                            e.stopPropagation(); 
                          }
                          removeSticker(sticker.id); 
                        }} 
                        className="absolute -top-4 -right-4 bg-red-500 text-white p-1.5 rounded-full shadow-lg pointer-events-auto hover:bg-red-600 transition-colors cursor-pointer z-50"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>


              {/* FLOATING DECORATIONS */}
              <div className="absolute top-20 right-10 w-24 h-24 rotate-12 bg-white p-2 rounded-3xl shadow-2xl border-4 border-[#059669] hidden md:flex items-center justify-center">
                <p className="text-[10px] font-black text-[#059669] text-center leading-none">BOOKS BRING US TOGETHER!</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center mt-20 opacity-30 group animate-pulse">
              <div className="w-32 h-32 bg-[#FFF9E5] rounded-[40px] flex items-center justify-center mb-6">
                <ImageIcon size={64} className="text-[#FFD93D]" />
              </div>
              <p className="text-xl font-black text-[#FFD93D] uppercase tracking-widest">Generate a poster to see preview</p>
            </div>
          )}
        </main>
      </div>
    </div>
    );
  };

  const renderLessonPlanView = () => {
    if (!content || !content.lessonPlan) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#FDFBF7]">
          <div className="text-center space-y-4">
            <BookOpen size={48} className="mx-auto text-[#064E3B]/20" />
            <p className="text-[#064E3B]/60 font-bold">No lesson plan content available.</p>
            <button onClick={() => setCurrentView('educator-suite')} className="text-[#059669] font-black uppercase text-[10px] tracking-widest hover:underline">
              Return to Suite
            </button>
          </div>
        </div>
      );
    }
    return (
    <div className="flex-1 flex flex-col bg-[#F0FDF4] overflow-hidden">
      <div className="h-16 bg-white border-b-2 border-[#D1FAE5] flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => {
            clearWorkspace();
            setCurrentView('educator-suite');
          }} className="flex items-center gap-2 text-[#064E3B]/60 font-bold hover:text-[#064E3B] transition-colors">
            <Home size={18} /> Suite
          </button>
        </div>
        <div className="flex items-center gap-2">
          <BookOpen className="text-[#FACC15]" size={24} />
          <h2 className="text-xl font-black text-[#064E3B]">Lesson Design</h2>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={resetLessonPlan}
            className="px-4 py-2 bg-white text-[#064E3B] border-2 border-[#D1FAE5] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/80 transition-all shadow-sm flex items-center gap-2"
          >
            <Plus size={14} /> New Lesson
          </button>
          <div className="h-8 w-px bg-[#D1FAE5] mx-1" />
          {content?.lessonPlan && (
               <div className="flex items-center gap-2">
                <button 
                  onClick={sendLessonPlanEmail}
                  className="px-4 py-2 bg-white text-[#064E3B] border-2 border-[#064E3B] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#F0FDF4] transition-all shadow-sm flex items-center gap-2"
                >
                  <Plus size={14} /> Email
                </button>
                 <button 
                   onClick={downloadLessonPlanExcel}
                   className="px-4 py-2 bg-[#1D6F42] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#155332] transition-all shadow-sm flex items-center gap-2"
                 >
                   <FileSpreadsheet size={14} /> Excel
                 </button>
                 <button 
                  onClick={() => saveProject()}
                  className="px-4 py-2 bg-white text-[#064E3B] border-2 border-[#D1FAE5] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#F0FDF4] transition-all shadow-sm flex items-center gap-2"
                >
                  <PlusCircle size={14} /> Save
                </button>
                 <button 
                  onClick={() => submitToAdmin()}
                  className="px-4 py-2 bg-[#FACC15] text-[#064E3B] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-yellow-300 transition-all shadow-sm flex items-center gap-2"
                >
                  <CheckCircle size={14} /> Submit
                </button>
               </div>
             )}
          </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[450px] bg-white border-r-2 border-[#D1FAE5] p-8 space-y-8 overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            <h3 className="text-sm font-black uppercase text-[#064E3B]/60 tracking-wider border-b-2 border-[#D1FAE5] pb-2">Lesson Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Term</label>
                <input 
                  type="text" 
                  value={content?.lessonPlan?.term || lpTerm} 
                  onChange={(e) => {
                    setLpTerm(e.target.value);
                    if (content?.lessonPlan) updateLessonPlanMetadata('term', e.target.value);
                  }} 
                  className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-xs font-bold" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Subject</label>
                <input 
                  type="text" 
                  value={content?.lessonPlan?.subject || lpSubject} 
                  onChange={(e) => {
                    setLpSubject(e.target.value);
                    if (content?.lessonPlan) updateLessonPlanMetadata('subject', e.target.value);
                  }} 
                  className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-xs font-bold" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Duration</label>
                <input 
                  type="text" 
                  value={content?.lessonPlan?.duration || lpDuration} 
                  onChange={(e) => {
                    setLpDuration(e.target.value);
                    if (content?.lessonPlan) updateLessonPlanMetadata('duration', e.target.value);
                  }} 
                  className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-xs font-bold" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Date</label>
                <input 
                  type="date" 
                  value={content?.lessonPlan?.date || lpDate} 
                  onChange={(e) => {
                    setLpDate(e.target.value);
                    if (content?.lessonPlan) updateLessonPlanMetadata('date', e.target.value);
                  }} 
                  className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-xs font-bold" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Academic Year</label>
                <input 
                  type="text" 
                  value={content?.lessonPlan?.academicYear || lpAcademicYear} 
                  onChange={(e) => {
                    setLpAcademicYear(e.target.value);
                    if (content?.lessonPlan) updateLessonPlanMetadata('academicYear', e.target.value);
                  }} 
                  className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-xs font-bold" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Class</label>
                <input 
                  type="text" 
                  value={content?.lessonPlan?.class || lpClass} 
                  onChange={(e) => {
                    setLpClass(e.target.value);
                    if (content?.lessonPlan) updateLessonPlanMetadata('class', e.target.value);
                  }} 
                  className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-xs font-bold" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t-2 border-dashed border-[#D1FAE5] pt-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Prepared By</label>
                <input 
                  type="text" 
                  value={content?.lessonPlan?.preparedBy || lpPreparedBy} 
                  onChange={(e) => {
                    setLpPreparedBy(e.target.value);
                    if (content?.lessonPlan) updateLessonPlanMetadata('preparedBy', e.target.value);
                  }} 
                  className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-xs font-bold" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Checked By</label>
                <input 
                  type="text" 
                  value={content?.lessonPlan?.checkedBy || lpCheckedBy} 
                  onChange={(e) => {
                    setLpCheckedBy(e.target.value);
                    if (content?.lessonPlan) updateLessonPlanMetadata('checkedBy', e.target.value);
                  }} 
                  className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-xs font-bold" 
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-[#064E3B]/40 tracking-widest">Targeted Week Generator</label>
                <div className="h-px flex-1 bg-[#D1FAE5] ml-4" />
              </div>
              <div className="p-5 bg-white border-2 border-[#D1FAE5] rounded-[2rem] shadow-sm space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Select Week</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5, 6].map(w => (
                      <button
                        key={w}
                        onClick={() => setSelectedGenWeek(w)}
                        className={cn(
                          "w-8 h-8 rounded-lg font-black text-xs transition-all",
                          selectedGenWeek === w 
                            ? "bg-[#059669] text-white shadow-lg scale-110" 
                            : "bg-[#F0FDF4] text-[#064E3B]/40 hover:bg-[#D1FAE5]"
                        )}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Unit (Optional)</label>
                        <button 
                          onClick={() => handleSuggestInput('unit')}
                          className="text-[9px] font-bold text-[#059669] hover:underline flex items-center gap-1"
                          disabled={isSuggesting !== null}
                        >
                          {isSuggesting === 'unit' ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} Generate
                        </button>
                      </div>
                      <input 
                        type="text"
                        value={customGenUnit}
                        onChange={(e) => setCustomGenUnit(e.target.value)}
                        placeholder="e.g. Unit 4"
                        className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-xs font-bold outline-none focus:border-[#059669]"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Topic (Optional)</label>
                        <button 
                          onClick={() => handleSuggestInput('topic')}
                          className="text-[9px] font-bold text-[#059669] hover:underline flex items-center gap-1"
                          disabled={isSuggesting !== null}
                        >
                          {isSuggesting === 'topic' ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} Generate
                        </button>
                      </div>
                      <input 
                        type="text"
                        value={customGenTopic}
                        onChange={(e) => setCustomGenTopic(e.target.value)}
                        placeholder="e.g. Electricity"
                        className="w-full p-2 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-xs font-bold outline-none focus:border-[#059669]"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase text-[#064E3B]/40">Specify Activity</label>
                      <button 
                        onClick={() => handleSuggestInput('activity')}
                        className="text-[9px] font-bold text-[#059669] hover:underline flex items-center gap-1"
                        disabled={isSuggesting !== null}
                      >
                        {isSuggesting === 'activity' ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} Generate
                      </button>
                    </div>
                    <textarea
                      value={customGenActivity}
                      onChange={(e) => setCustomGenActivity(e.target.value)}
                      placeholder="Describe what you want to do this week (e.g., 'Hands-on experiment with circuits')..."
                      className="w-full h-20 p-3 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-xs font-bold resize-none outline-none focus:border-[#059669]"
                    />
                  </div>
                </div>
                <button
                  onClick={generateSpecificWeek}
                  disabled={isGeneratingWeek?.type === 'plan'}
                  className="w-full py-3 bg-[#FACC15] text-[#064E3B] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-yellow-400 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {isGeneratingWeek?.type === 'plan' ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />} 
                  Auto-Fill Week {selectedGenWeek}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-[#064E3B]/40 tracking-widest">Weekly Units & Topics (6-Week Term)</label>
                <span className="text-[9px] font-bold text-[#059669] uppercase bg-[#D1FAE5] px-2 py-0.5 rounded-md">AI will fill blanks</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {lpWeeklyTopics.map((topic, i) => (
                  <div key={i} className="flex flex-col gap-2 p-3 bg-[#F0FDF4]/50 rounded-2xl border-2 border-[#D1FAE5]/50">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-[#064E3B]/40 uppercase">Week {i + 1}</span>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={lpUnit[i]} 
                        onChange={(e) => {
                          const newUnits = [...lpUnit];
                          newUnits[i] = e.target.value;
                          setLpUnit(newUnits);
                        }} 
                        placeholder="Unit #"
                        className="w-24 p-2 bg-white border-2 border-[#D1FAE5] rounded-xl text-xs font-bold focus:border-[#059669] outline-none"
                      />
                      <input 
                        type="text" 
                        value={topic} 
                        onChange={(e) => {
                          const newTopics = [...lpWeeklyTopics];
                          newTopics[i] = e.target.value;
                          setLpWeeklyTopics(newTopics);
                        }} 
                        placeholder={`Topic for Week ${i + 1}`}
                        className="flex-1 p-2 bg-white border-2 border-[#D1FAE5] rounded-xl text-xs font-bold focus:border-[#059669] outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-[#064E3B]/40 tracking-widest">Lesson Focus / Methodology</label>
              <textarea 
                value={lpDescription} 
                onChange={(e) => setLpDescription(e.target.value)} 
                placeholder="e.g. Focus on active learning, Cambridge standards, and textbook integration."
                className="w-full h-24 p-3 bg-[#F0FDF4] border-2 border-[#D1FAE5] rounded-xl text-sm font-medium resize-none focus:outline-none focus:border-[#059669]"
              />
            </div>

            <button 
              onClick={generateLP} 
              disabled={isGenerating}
              className="w-full py-4 bg-[#059669] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-[#059669]/20 transition-all flex items-center justify-center gap-3 hover:bg-[#047857] active:scale-[0.98]"
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate Lesson Package
            </button>
          </div>
        </aside>

        <main className="flex-1 p-12 overflow-y-auto bg-[#F0FDF4]/50 custom-scrollbar">
          {content?.lessonPlan ? (
            <div className="max-w-[1000px] mx-auto bg-white p-12 pt-12 shadow-2xl border-[16px] border-white ring-[12px] ring-[#059669] flex flex-col gap-10 font-serif relative" ref={lessonPlanRef} data-ref-id="lesson-plan-container">
               <div className="text-center border-b-4 border-[#064E3B] pb-8">
                 <h1 className="text-4xl font-black uppercase tracking-tight mb-2 text-[#064E3B]">Cambridge Termly Lesson Plan (6-Week Program)</h1>
                 <p className="text-sm font-bold opacity-40 uppercase tracking-[0.3em] text-[#059669]">Zera International School Academic Standards</p>
               </div>

               <div className="grid grid-cols-6 border-2 border-black divide-x-2 divide-black text-[10px] font-black uppercase">
                 <div className="col-span-2 p-3">Term: <input type="text" value={content.lessonPlan.term || ""} onChange={(e) => updateLessonPlanMetadata('term', e.target.value)} className="bg-transparent font-normal normal-case ml-1 outline-none border-b border-transparent hover:border-black/10 focus:border-black/30 w-full" /></div>
                 <div className="col-span-2 p-3">Subject: <input type="text" value={content.lessonPlan.subject || ""} onChange={(e) => updateLessonPlanMetadata('subject', e.target.value)} className="bg-transparent font-normal normal-case ml-1 outline-none border-b border-transparent hover:border-black/10 focus:border-black/30 w-full" /></div>
                 <div className="col-span-2 p-3">Duration: <input type="text" value={content.lessonPlan.duration || ""} onChange={(e) => updateLessonPlanMetadata('duration', e.target.value)} className="bg-transparent font-normal normal-case ml-1 outline-none border-b border-transparent hover:border-black/10 focus:border-black/30 w-full" /></div>
               </div>

               <div className="grid grid-cols-6 border-x-2 border-b-2 border-black divide-x-2 divide-black text-[10px] font-black uppercase">
                 <div className="col-span-2 p-3">Date: <input type="text" value={content.lessonPlan.date || ""} onChange={(e) => updateLessonPlanMetadata('date', e.target.value)} className="bg-transparent font-normal normal-case ml-1 outline-none border-b border-transparent hover:border-black/10 focus:border-black/30 w-full" /></div>
                 <div className="col-span-2 p-3">Academic Year: <input type="text" value={content.lessonPlan.academicYear || ""} onChange={(e) => updateLessonPlanMetadata('academicYear', e.target.value)} className="bg-transparent font-normal normal-case ml-1 outline-none border-b border-transparent hover:border-black/10 focus:border-black/30 w-full" /></div>
                 <div className="col-span-2 p-3">Class: <input type="text" value={content.lessonPlan.class || ""} onChange={(e) => updateLessonPlanMetadata('class', e.target.value)} className="bg-transparent font-normal normal-case ml-1 outline-none border-b border-transparent hover:border-black/10 focus:border-black/30 w-full" /></div>
               </div>

               <div className="grid grid-cols-6 border-x-2 border-b-2 border-black divide-x-2 divide-black text-[10px] font-black uppercase">
                  <div className="col-span-3 p-3 italic opacity-60">Prepared By: <input type="text" value={content.lessonPlan.preparedBy || ""} onChange={(e) => updateLessonPlanMetadata('preparedBy', e.target.value)} className="bg-transparent font-bold ml-1 outline-none border-b border-transparent hover:border-black/10 focus:border-black/30 w-full" /></div>
                  <div className="col-span-3 p-3 italic opacity-60">Checked By: <input type="text" value={content.lessonPlan.checkedBy || ""} onChange={(e) => updateLessonPlanMetadata('checkedBy', e.target.value)} className="bg-transparent font-bold ml-1 outline-none border-b border-transparent hover:border-black/10 focus:border-black/30 w-full" /></div>
               </div>

               <div className="space-y-6">
                 <div className="grid grid-cols-6 gap-0 border-2 border-black">
                    <div className="col-span-1 bg-black text-white p-2 font-black text-[10px] uppercase flex items-center justify-center">
                      <div className="-rotate-90 whitespace-nowrap overflow-visible">Overall Topic</div>
                    </div>
                    <div className="col-span-5 p-6 border-l-2 border-black flex items-center">
                      <input 
                        type="text" 
                        value={content.lessonPlan.overallTopic || ""} 
                        onChange={(e) => updateLessonPlanMetadata('overallTopic', e.target.value)} 
                        className="bg-transparent w-full text-3xl font-black italic outline-none border-b-2 border-transparent hover:border-black/10 focus:border-black/30"
                      />
                    </div>
                 </div>

                 {/* Removed Top Learning Objectives as per user request */}

                 <div className="pt-6">
                   <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-3">
                     <span className="h-[2px] flex-1 bg-black opacity-10"></span>
                     Term Schedule (6 Weeks)
                     <span className="h-[2px] flex-1 bg-black opacity-10"></span>
                   </h3>
                   
                   <div className="overflow-x-auto pb-4 custom-scrollbar">
                     <table className="w-full border-4 border-black border-double text-[10px] min-w-[1200px]">
                       <thead>
                         <tr className="bg-black text-white uppercase font-black tracking-wider">
                           <th className="p-3 border-2 border-black text-left w-[10%]">Unit</th>
                           <th className="p-3 border-2 border-black text-left w-[12%]">Topic</th>
                           <th className="p-3 border-2 border-black text-left w-[15%]">Learning Objective</th>
                           <th className="p-3 border-2 border-black text-left w-[10%]">Strand</th>
                           <th className="p-3 border-2 border-black text-left w-[15%]">Introduction</th>
                           <th className="p-3 border-2 border-black text-left w-[15%]">Activities</th>
                           <th className="p-3 border-2 border-black text-left w-[12%]">Assessment</th>
                           <th className="p-3 border-2 border-black text-left w-[13%]">Resources</th>
                         </tr>
                       </thead>
                       <tbody className="font-medium align-top">
                         {content.lessonPlan.weeklyBreakdown.map((week, idx) => (
                           <tr key={idx} className="border-b-2 border-black">
                              <td className="p-0 border-2 border-black">
                                <input 
                                  value={week.unit} 
                                  onChange={(e) => updateWeeklyBreakdown(idx, 'unit', e.target.value)}
                                  className="w-full p-3 bg-transparent font-black text-[#e67e22] outline-none border-none text-center"
                                />
                              </td>
                             <td className="p-3 border-2 border-black">
                               <div className="font-black mb-1">Week {week.week}</div>
                                <textarea 
                                  value={week.topic} 
                                  onChange={(e) => updateWeeklyBreakdown(idx, 'topic', e.target.value)}
                                  className="w-full bg-transparent font-bold uppercase tracking-tight text-[#6C5CE7] outline-none border-none resize-none h-16"
                                />
                             </td>
                             <td className="p-0 border-2 border-black leading-relaxed">
                               <textarea 
                                 value={week.learningObjective} 
                                 onChange={(e) => updateWeeklyBreakdown(idx, 'learningObjective', e.target.value)}
                                 className="w-full p-3 bg-transparent font-bold text-[#d63031] outline-none border-none resize-none h-32 text-[10px]"
                               />
                             </td>
                             <td className="p-0 border-2 border-black text-center">
                               <textarea 
                                 value={week.strand} 
                                 onChange={(e) => updateWeeklyBreakdown(idx, 'strand', e.target.value)}
                                 className="w-full p-3 bg-transparent font-bold uppercase text-[9px] text-[#27ae60] outline-none border-none resize-none h-16"
                               />
                             </td>
                             <td className="p-0 border-2 border-black leading-relaxed">
                               <textarea 
                                 value={week.introduction} 
                                 onChange={(e) => updateWeeklyBreakdown(idx, 'introduction', e.target.value)}
                                 className="w-full p-3 bg-transparent outline-none border-none resize-none h-32 text-[10px]"
                               />
                             </td>
                             <td className="p-0 border-2 border-black leading-relaxed">
                               <textarea 
                                 value={week.activities} 
                                 onChange={(e) => updateWeeklyBreakdown(idx, 'activities', e.target.value)}
                                 className="w-full p-3 bg-transparent outline-none border-none resize-none h-40 text-[10px]"
                               />
                             </td>
                             <td className="p-0 border-2 border-black leading-relaxed font-bold">
                               <textarea 
                                 value={week.assessment} 
                                 onChange={(e) => updateWeeklyBreakdown(idx, 'assessment', e.target.value)}
                                 className="w-full p-3 bg-transparent font-bold outline-none border-none resize-none h-32 text-[10px]"
                               />
                             </td>
                             <td className="p-3 border-2 border-black leading-relaxed italic opacity-80">
                               <div className="space-y-2 py-1">
                                  <textarea 
                                    value={week.resources} 
                                    onChange={(e) => updateWeeklyBreakdown(idx, 'resources', e.target.value)}
                                    className="w-full bg-transparent opacity-60 outline-none border-none resize-none h-24 text-[10px]"
                                  />
                                  <div className="flex flex-wrap gap-2 pt-1 not-italic">
                                    <button
                                      onClick={() => generateSlidesForWeek(idx)}
                                      disabled={isGeneratingWeek !== null}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF6B6B] text-white rounded-lg text-[10px] font-black uppercase hover:bg-[#FF5252] transition-all disabled:opacity-50 cursor-pointer shadow-sm active:scale-95 border-2 border-transparent hover:border-white/20"
                                    >
                                      {isGeneratingWeek?.index === idx && isGeneratingWeek?.type === 'slides' ? (
                                        <Loader2 size={12} className="animate-spin" />
                                      ) : (
                                        <Presentation size={12} />
                                      )}
                                      Slides
                                    </button>
                                    <button
                                      onClick={() => generateWorksheetForWeek(idx)}
                                      disabled={isGeneratingWeek !== null}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4ECDC4] text-white rounded-lg text-[10px] font-black uppercase hover:bg-[#3DBDB3] transition-all disabled:opacity-50 cursor-pointer shadow-sm active:scale-95 border-2 border-transparent hover:border-white/20"
                                    >
                                      {isGeneratingWeek?.index === idx && isGeneratingWeek?.type === 'worksheet' ? (
                                        <Loader2 size={12} className="animate-spin" />
                                      ) : (
                                        <FileText size={12} />
                                      )}
                                      Worksheet
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        removeWeek(idx);
                                      }}
                                      className="flex items-center justify-center w-7 h-7 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
                                      title="Remove Week"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>

                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 </div>
               </div>

               <div className="mt-auto flex justify-between items-end border-t border-gray-100 pt-8">
                 <div className="text-[10px] font-black uppercase opacity-20 tracking-widest">
                    Cambridge Aligned Lesson Program • Professional Educator Suite
                 </div>
               </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#7C7A65] opacity-20 group">
              <BookOpen size={120} className="group-hover:scale-110 transition-transform" />
              <p className="mt-6 text-2xl font-black uppercase tracking-[0.2em]">Generate a lesson plan to see preview</p>
            </div>
          )}
        </main>
      </div>
    </div>
    );
  };
  const handleThemeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newTheme: AppTheme = {
          id: `custom-${Date.now()}`,
          name: 'Custom Theme',
          accentColor: '#6C5CE7',
          secondaryColor: '#A29BFE',
          cardBg: 'rgba(255, 255, 255, 0.8)',
          bgColor: '#FFFFFF',
          textColor: '#1A1A1A',
          patternType: 'dots',
          emoji: '🖼️',
          bgImage: reader.result as string
        };
        setCustomThemes(prev => [newTheme, ...prev]);
        setActiveTheme(newTheme);
      };
      reader.readAsDataURL(file);
    }
  };

  const allThemes = [...THEMES, ...GENERATED_THEMES, ...customThemes];


  const handleGenerate = async () => {
    if (!lessonInput.trim() && !fileContext) return;
    
    setGeneratingMessage(
      posterOnly ? "Generating Poster..." : 
      (includeStory || !!fileContext) ? "Generating Worksheet..." : 
      "Generating Slides..."
    );
    setIsGenerating(true);

    const finalPrompt = lessonInput.trim() || (fileContext ? `Analyze and generate materials based on: ${fileContext.name}` : "");

    let fileData: { mimeType: string; data: string } | undefined;
    if (fileContext) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(fileContext.data);
        });
        fileData = { mimeType: fileContext.type, data: base64 };
      } catch (err) {
        console.error("File processing error:", err);
      }
    }
    
    try {
      const result = await generateEduContent(finalPrompt, {
        yearGroup,
        lexileLevel,
        subject,
        numSlides: (includeStory || posterOnly) ? 0 : numSlides,
        numQuestions: posterOnly ? 0 : numQuestions,
        questionTypes: selectedQuestionTypes,
        includeStory,
        posterOnly,
        templateMode: fileContext ? templateUploadMode : undefined,
        fileContext: fileData
      });

      if (result) {
        const convertedResult = {
          ...result,
          slides: convertSlidesToMovable(result.slides)
        };
        setContent(convertedResult);
        if (fileContext) {
          setIsTemplateMode(true);
          setWorkspaceMode('worksheet');
        } else {
          setIsTemplateMode(false);
        }
        
        // Auto-save to vault
        const category = posterOnly ? 'poster' : (includeStory || !!fileContext ? 'worksheet' : 'slides');
        // saveToVault(category as any, true, convertedResult, result.lessonTitle || result.lessonPlan?.overallTopic);

        setCurrentSlideIdx(0);
        setIsInputModalOpen(false);
        if (posterOnly) {
          setWorkspaceMode('poster');
          setSidebarTab('poster');
        } else if (includeStory) {
          setWorkspaceMode('worksheet');
          setSidebarTab('worksheet');
        } else {
          setSidebarTab('slides');
        }
      }
    } catch (err: any) {
      handleEduError(err, "Generate content");
    }
    setIsInputModalOpen(false);
    setIsGenerating(false);
  };

  const downloadPPTX = async () => {
    if (!content) return;
    setIsDownloading(true);
    try {
      const pres = new pptxgen();
      pres.layout = 'LAYOUT_16x9';
      
      const accentColor = (activeTheme.accentColor || '#059669').replace('#', '');
      const textColor = (activeTheme.textColor || '#2D3436').replace('#', '');
      const bgColor = (activeTheme.bgColor || '#FFF9E5').replace('#', '');

      content.slides.forEach((slide, idx) => {
        const s = pres.addSlide();
        
        // Handle Background
        const slideBGColor = (slide.backgroundColor || activeTheme.bgColor || 'FFFFFF').replace('#', '');
        if (slide.backgroundWallpaper) {
          s.background = { path: slide.backgroundWallpaper };
        } else if (slide.backgroundWallpaper === "") {
          s.background = { color: slideBGColor };
        } else if (activeTheme.bgImage) {
          s.background = { path: activeTheme.bgImage };
        } else {
          s.background = { color: slideBGColor };
        }
        
        // Side highlight bar
        s.addShape(pres.ShapeType.rect, {
          x: 0, y: 0, w: 0.15, h: '100%',
          fill: { color: accentColor }
        });

        // Slide Title
        const titleFontSize = slide.title.length > 40 ? 22 : 28;
        const slideTitleColor = slide.titleSettings?.color?.replace('#', '') || accentColor;
        const slideTitleFont = slide.titleSettings?.family || 'Arial Black';

        s.addText(slide.title, {
          x: 0.5, y: 0.3, w: 9.0, h: 0.7,
          fontSize: titleFontSize, 
          bold: true, 
          color: slideTitleColor,
          align: pres.AlignH.left,
          fontFace: slideTitleFont
        });

        // Layout logic
        // Identify if we should show a main image
        const displayImageUrl = slide.imageUrl || (slide.imageUrl === undefined ? `https://images.unsplash.com/photo-1?auto=format&fit=crop&w=800&q=80&keywords=${encodeURIComponent(slide.illustrationPrompt || slide.title || 'education')}&sig=${idx}` : null);
        const finalHasImage = !!displayImageUrl && slide.imageUrl !== '';

        if (!slide.layoutType?.startsWith('infographic-')) {
          // Content Area Background (Only for non-infographics)
          s.addShape(pres.ShapeType.roundRect, {
            x: 0.4, y: 1.1, w: finalHasImage ? 5.5 : 9.2, h: 4.1,
            fill: { color: 'FFFFFF', transparency: 20 },
            line: { color: accentColor, width: 0.5 },
            rectRadius: 0.05
          });
        }

        // Filter out redundant points
        const seenPoints = new Set<string>();
        const filteredContent = slide.content.filter(point => {
          const p = point.trim();
          if (!p) return false;
          const lowerP = p.toLowerCase();
          const lowerT = slide.title.toLowerCase().trim();
          if (lowerP === lowerT || lowerP.includes(lowerT)) return false;
          if (seenPoints.has(lowerP)) return false;
          seenPoints.add(lowerP);
          return true;
        });

        // Infographic vs Default Layout
        if (slide.layoutType === 'infographic-cards') {
          const points = filteredContent.slice(0, 8); // Limit to 8 for PPTX layout safety
          points.forEach((point, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const cardW = finalHasImage ? 2.6 : 4.4;
            const cardH = 0.85;
            const cardX = 0.5 + (col * (cardW + 0.2));
            const cardY = 1.2 + (row * (cardH + 0.15));
            const cardColor = i % 2 === 0 ? accentColor : (activeTheme.secondaryColor || '#059669').replace('#', '');

            s.addShape(pres.ShapeType.roundRect, {
              x: cardX, y: cardY, w: cardW, h: cardH,
              fill: { color: 'FFFFFF' },
              line: { color: cardColor, width: 1 },
              rectRadius: 0.1
            });
            s.addShape(pres.ShapeType.rect, {
              x: cardX, y: cardY, w: 0.1, h: cardH,
              fill: { color: cardColor }
            });
            s.addText(point, {
              x: cardX + 0.15, y: cardY, w: cardW - 0.2, h: cardH,
              fontSize: 9, color: textColor, align: pres.AlignH.left, valign: 'middle', bold: true
            });
          });
        } else if (slide.layoutType === 'infographic-flow') {
          const points = filteredContent.slice(0, 5);
          const flowX = 0.6;
          const flowW = finalHasImage ? 5.0 : 8.8;
          
          // Connector line
          s.addShape(pres.ShapeType.rect, {
            x: flowX + 0.2, y: 1.3, w: 0.02, h: points.length * 0.7,
            fill: { color: accentColor, transparency: 70 }
          });

          points.forEach((point, i) => {
            const rowY = 1.3 + (i * 0.75);
            const cardH = 0.6;
            const flowColor = activeTheme.accentColor.replace('#', '');

            s.addShape(pres.ShapeType.ellipse, {
              x: flowX, y: rowY + 0.1, w: 0.4, h: 0.4,
              fill: { color: 'FFFFFF' },
              line: { color: flowColor, width: 2 }
            });
            s.addText((i + 1).toString(), {
              x: flowX, y: rowY + 0.1, w: 0.4, h: 0.4,
              fontSize: 10, color: flowColor, align: pres.AlignH.center, valign: 'middle', bold: true
            });
            s.addShape(pres.ShapeType.roundRect, {
              x: flowX + 0.5, y: rowY, w: flowW - 0.6, h: cardH,
              fill: { color: 'FFFFFF', transparency: 50 },
              line: { color: `${flowColor}33`, width: 1 },
              rectRadius: 0.1
            });
            s.addText(point, {
              x: flowX + 0.6, y: rowY, w: flowW - 0.8, h: cardH,
              fontSize: 10, color: textColor, align: pres.AlignH.left, valign: 'middle', bold: true
            });
          });
        } else if (slide.layoutType === 'infographic-grid') {
          const points = filteredContent.slice(0, 6);
          points.forEach((point, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const gridW = finalHasImage ? 1.7 : 2.9;
            const gridH = 1.2;
            const gridX = 0.5 + (col * (gridW + 0.15));
            const gridY = 1.2 + (row * (gridH + 0.25));
            const gridColor = i % 3 === 0 ? accentColor : i % 3 === 1 ? (activeTheme.secondaryColor || '#059669').replace('#', '') : 'FACC15';

            s.addShape(pres.ShapeType.roundRect, {
              x: gridX, y: gridY, w: gridW, h: gridH,
              fill: { color: 'FFFFFF' },
              line: { color: 'E5E7EB', width: 1 },
              rectRadius: 0.1
            });
            s.addShape(pres.ShapeType.rect, {
              x: gridX, y: gridY, w: gridW, h: 0.1,
              fill: { color: gridColor }
            });
            s.addText(point, {
              x: gridX + 0.1, y: gridY + 0.1, w: gridW - 0.2, h: gridH - 0.1,
              fontSize: 9, color: textColor, align: pres.AlignH.center, valign: 'middle', bold: true
            });
          });
        } else if (slide.layoutType === 'infographic-bubbles') {
          const points = filteredContent.slice(0, 6);
          points.forEach((point, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const bubSize = finalHasImage ? 1.5 : 2.4;
            const bubX = 0.6 + (col * (bubSize + 0.3));
            const bubY = 1.3 + (row * (bubSize + 0.2));
            const bubColor = i % 2 === 0 ? accentColor : (activeTheme.secondaryColor || '#059669').replace('#', '');

            s.addShape(pres.ShapeType.ellipse, {
              x: bubX, y: bubY, w: bubSize, h: bubSize,
              fill: { color: bubColor, transparency: 80 },
              line: { color: bubColor, width: 2 }
            });
            s.addText(point, {
              x: bubX + 0.1, y: bubY + 0.1, w: bubSize - 0.2, h: bubSize - 0.2,
              fontSize: 9, color: textColor, align: pres.AlignH.center, valign: 'middle', bold: true
            });
          });
        } else {
          // Default bullet point rendering
          let bodyFontSize = 14;
          if (filteredContent.length > 10) bodyFontSize = 8;
          else if (filteredContent.length > 7) bodyFontSize = 10;
          else if (filteredContent.length > 4) bodyFontSize = 12;

          const totalChars = filteredContent.join('').length;
          if (totalChars > 800) bodyFontSize = Math.min(bodyFontSize, 7);
          else if (totalChars > 500) bodyFontSize = Math.min(bodyFontSize, 8);
          
          if (filteredContent.length > 0) {
            const textObjects = filteredContent.map((point) => ({
              text: point,
              options: {
                bullet: { indent: 20 },
                fontSize: bodyFontSize,
                color: slide.bulletSettings?.color?.replace('#', '') || textColor,
                paraSpaceAfter: bodyFontSize > 10 ? 10 : 5,
                lineSpacing: bodyFontSize * 1.3,
              }
            }));

            s.addText(textObjects, {
              x: 0.6, y: 1.3, w: finalHasImage ? 5.1 : 8.8, h: 3.7,
              valign: 'top',
              fontFace: slide.bulletSettings?.family || 'Arial',
              align: pres.AlignH.left
            });
          }
        }

        // Main Image
        if (finalHasImage && displayImageUrl) {
          try {
            s.addImage({
              path: displayImageUrl,
              x: 6.2, y: 1.1, w: 3.3, h: 4.1,
              sizing: { type: 'cover', w: 3.3, h: 4.1 }
            });
          } catch (e) {
            console.error("Failed to add image to PPTX", e);
          }
        }

        // Floating Images (Stickers/Shapes)
        slide.images?.forEach(img => {
          if (!img.url) return;
          const posX = (img.x / 896) * 10;
          const posY = (img.y / 504) * 5.625;
          const posW = (img.size / 896) * 10;
          const posH = (img.size / 504) * 5.625;
          
          try {
            s.addImage({
              path: img.url,
              x: posX,
              y: posY,
              w: posW,
              h: posH,
              rotate: img.rotation || 0
            });
          } catch (e) {
            console.error("Error adding floating image:", e);
          }
        });

        // Footer - removed per user request
/*
        s.addText(`${content.lessonTitle} | Slide ${idx + 1}`, {
          x: 0.5, y: 5.3, w: 9.0, h: 0.3,
          fontSize: 8, 
          color: '999999', 
          align: pres.AlignH.right
        });
*/
      });

      await pres.writeFile({ fileName: `${content.lessonTitle.replace(/\s+/g, '_')}_Slides.pptx` });
    } catch (err) {
      console.error("PPTX Generation Error:", err);
      alert("Failed to generate PowerPoint. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadDOCX = async () => {
    if (!content) return;
    
    const doc = new Document({
      sections: [{
        properties: { type: SectionType.CONTINUOUS },
        children: [
          new Paragraph({
            text: content.worksheet.title,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          ...(content.worksheet.readingPassage && content.worksheet.readingPassage.trim().length > 0 ? [
            new Paragraph({
              text: "Reading Passage",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: content.worksheet.readingPassage,
                })
              ],
              spacing: { after: 400 },
            })
          ] : []),
          ...content.worksheet.sections.flatMap(section => [
            new Paragraph({
              text: section.title,
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: section.instructions,
                  italics: true,
                })
              ],
              spacing: { after: 200 },
            }),
            ...section.questions.map((q, idx) => {
              const baseText = `${idx + 1}. ${q.text}`;
              
              if (q.options) {
                return new Paragraph({
                  children: [
                    new TextRun({ text: baseText, break: 1 }),
                    ...q.options.flatMap(opt => [
                      new TextRun({ text: `   [ ] ${opt}`, break: 1 })
                    ])
                  ]
                });
              }
              
              return new Paragraph({
                children: [
                  new TextRun({ text: baseText, break: 1 }),
                  new TextRun({ text: "______________________________________________________", break: 1 })
                ]
              });
            })
          ])
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${content.lessonTitle.replace(/\s+/g, '_')}_Worksheet.docx`;
    a.click();
  };

  const [selectedImageSlot, setSelectedImageSlot] = useState<string | null>(null);

  const updatePosterField = (field: keyof PosterContent, value: any) => {
    setContent(prev => {
      if (!prev || !prev.poster) return prev;
      return {
        ...prev,
        poster: {
          ...prev.poster,
          [field]: value
        }
      };
    });
  };

  const updateFontSettings = (field: 'titleSettings' | 'subTitleSettings' | 'summarySettings' | 'ctaSettings', settings: any) => {
    if (!content || !content.poster) return;
    setContent({
      ...content,
      poster: {
        ...content.poster,
        [field]: { ...(content.poster[field] || {}), ...settings }
      }
    });
  };

  const addSticker = (url: string) => {
    if (!content || !content.poster) return;
    const proxiedUrl = getProxiedUrl(url);
    const newSticker = {
      id: Math.random().toString(36).substr(2, 9),
      url: proxiedUrl,
      x: 100,
      y: 100,
      size: 150,
      rotation: 0
    };
    setContent({
      ...content,
      poster: {
        ...content.poster,
        stickers: [...(content.poster.stickers || []), newSticker]
      }
    });
    setSelectedStickerId(newSticker.id);
  };

  const addTextSticker = () => {
    if (!content || !content.poster) return;
    const newSticker: Sticker = {
      id: Math.random().toString(36).substr(2, 9),
      text: "NEW TEXT",
      x: 150,
      y: 150,
      size: 32,
      rotation: 0,
      fontSettings: {
        family: 'Fredoka One',
        size: 32,
        color: '#2D3436'
      }
    };
    setContent({
      ...content,
      poster: {
        ...content.poster,
        stickers: [...(content.poster.stickers || []), newSticker]
      }
    });
    setSelectedStickerId(newSticker.id);
  };

  const addShapeSticker = (shape: 'square' | 'circle' | 'triangle' | 'star') => {
    if (!content || !content.poster) return;
    const newSticker: Sticker = {
      id: Math.random().toString(36).substr(2, 9),
      shape,
      color: content.poster.colorPalette?.[1] || '#059669',
      x: 200,
      y: 300,
      size: 150,
      rotation: 0
    };
    setContent({
      ...content,
      poster: {
        ...content.poster,
        stickers: [...(content.poster.stickers || []), newSticker]
      }
    });
    setSelectedStickerId(newSticker.id);
  };

  const updateSticker = (id: string, updates: any) => {
    if (!content || !content.poster || !content.poster.stickers) return;
    setContent({
      ...content,
      poster: {
        ...content.poster,
        stickers: content.poster.stickers.map(s => s.id === id ? { ...s, ...updates } : s)
      }
    });
  };

  const removeSticker = (id: string | null) => {
    if (!id || !content || !content.poster || !content.poster.stickers) return;
    setContent({
      ...content,
      poster: {
        ...content.poster,
        stickers: content.poster.stickers.filter(s => String(s.id) !== String(id))
      }
    });
    if (selectedStickerId === id) setSelectedStickerId(null);
  };

  const setCustomImage = (slot: string, url: string) => {
    if (!content || !content.poster) return;
    const customImages = { ...(content.poster.customImages || {}), [slot]: url };
    setContent({
      ...content,
      poster: {
        ...content.poster,
        customImages
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, slot: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (slot === 'sticker') {
          addSticker(reader.result as string);
        } else {
          setCustomImage(slot, reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasteURL = (slot: string) => {
    const url = prompt("Paste image URL (from web search) here:");
    if (url) {
      if (slot === 'sticker') {
        addSticker(url);
      } else {
        setCustomImage(slot, url);
      }
    }
  };

  const downloadPNG = async (elementRef: React.RefObject<HTMLDivElement | null>, filename: string, isJpg: boolean = false) => {
    if (!elementRef.current) return;
    
    // Clear selections before capture
    setSelectedSlideImageId(null);
    setSelectedSlideElement(null);
    setIsDownloading(true);
    
    // Slight delay to allow state changes to render
    setTimeout(async () => {
      try {
        const element = elementRef.current!;
        const canvas = await html2canvas(element, {
          scale: 3,
          useCORS: true,
          allowTaint: false,
          backgroundColor: isJpg ? '#FFFFFF' : null,
          logging: false,
          width: element.offsetWidth,
          height: element.offsetHeight,
        });
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL(isJpg ? 'image/jpeg' : 'image/png', 0.9);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error("Error generating image:", error);
        alert("Failed to generate image. Please try again.");
      } finally {
        setIsDownloading(false);
      }
    }, 100);
  };

  const downloadPosterView = (format: 'pdf' | 'png' | 'jpg') => {
    if (!content) return;
    setSelectedField(null);
    setSelectedStickerId(null);
    const baseName = `${content.lessonTitle.replace(/\s+/g, '_')}_Poster`;
    if (format === 'pdf') {
      downloadPDFFull(posterRef, `${baseName}.pdf`);
    } else if (format === 'png') {
      downloadPNG(posterRef, `${baseName}.png`, false);
    } else {
      downloadPNG(posterRef, `${baseName}.jpg`, true);
    }
  };

  const downloadPDFFull = async (elementRef: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!elementRef.current || !content) return;
    
    // Clear selections before capture
    setSelectedSlideImageId(null);
    setSelectedSlideElement(null);
    setIsDownloading(true);
    
    // Slight delay to allow state changes to render (like hiding footers/broken images)
    setTimeout(async () => {
      try {
        const element = elementRef.current!;
        
        // Capture the full content even if it's in a scrollable container
        const canvas = await html2canvas(element, { 
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#FFFFFF',
          logging: false,
          width: element.scrollWidth,
          height: element.scrollHeight,
          windowWidth: element.scrollWidth,
          windowHeight: element.scrollHeight,
          onclone: (clonedDoc) => {
            // Fix for oklch colors which html2canvas doesn't support
            const elements = clonedDoc.getElementsByTagName('*');
            const tempCanvas = document.createElement('canvas');
            const ctx = tempCanvas.getContext('2d');
            
            if (ctx) {
              for (let i = 0; i < elements.length; i++) {
                const el = elements[i] as HTMLElement;
                const props = ['color', 'backgroundColor', 'borderColor', 'fill', 'stroke'];
                const computed = window.getComputedStyle(el);
                
                props.forEach(prop => {
                  const val = computed.getPropertyValue(prop);
                  if (val && val.includes('oklch')) {
                    ctx.fillStyle = val;
                    el.style.setProperty(prop, ctx.fillStyle, 'important');
                  }
                });
              }
            }

            // Find the cloned version of our element to make sure it's fully visible
            const clonedElement = clonedDoc.querySelector('[data-ref-id="lesson-plan-container"]');
            if (clonedElement instanceof HTMLElement) {
               clonedElement.style.overflow = 'visible';
               clonedElement.style.maxHeight = 'none';
               clonedElement.style.height = 'auto';
               clonedElement.style.width = '1000px'; // Lock width for consistency
               
               // Force table to be fully visible if it's in a scroll container
               const scrollContainer = clonedElement.querySelector('.overflow-x-auto');
               if (scrollContainer instanceof HTMLElement) {
                 scrollContainer.style.overflow = 'visible';
                 scrollContainer.style.width = 'auto';
                 const table = scrollContainer.querySelector('table');
                 if (table) {
                   table.style.width = '100%';
                   table.style.minWidth = '1200px'; // Maintain the min-width
                 }
               }
            }
          }
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const width = canvas.width;
        const height = canvas.height;
        
        // Convert to points for jsPDF (1px = 0.75pt)
        const pdfWidth = width * 0.75;
        const pdfHeight = height * 0.75;

        const pdf = new jsPDF({
          orientation: width > height ? 'l' : 'p',
          unit: 'pt',
          format: [pdfWidth, pdfHeight]
        });

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(filename);
      } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Failed to generate PDF. Please try again. Ensure all images are loaded.");
      } finally {
        setIsDownloading(false);
      }
    }, 150);
  };

  const downloadSlidePDF = () => downloadPDFFull(slideRef, `${content?.lessonTitle.replace(/\s+/g, '_')}_Slide_${currentSlideIdx + 1}.pdf`);
  const downloadSlidePNG = () => downloadPNG(slideRef, `${content?.lessonTitle.replace(/\s+/g, '_')}_Slide_${currentSlideIdx + 1}.png`);
  const downloadPosterPDF = () => downloadPDFFull(posterRef, `${content?.lessonTitle.replace(/\s+/g, '_')}_Poster.pdf`);
  const downloadWorksheetPDF = () => downloadPDFFull(worksheetRef, `${content?.lessonTitle.replace(/\s+/g, '_')}_Worksheet.pdf`);
  const downloadLessonPlanPDF = () => downloadPDFFull(lessonPlanRef, `${content?.lessonPlan?.overallTopic.replace(/\s+/g, '_')}_Lesson_Plan.pdf`);

  const currentSlide = content?.slides?.[currentSlideIdx];

  if (authLoading) {
    return (
      <div className="w-full h-screen bg-[#059669] flex flex-col items-center justify-center p-6 text-center">
         <Loader2 className="animate-spin text-white mb-4" size={48} />
         <h2 className="text-white text-2xl font-black uppercase tracking-tight">Initializing EduMagic...</h2>
      </div>
    );
  }

  if (!user) {
    return renderAuth();
  }

  return (
    <div className="w-full h-screen bg-[#059669] flex flex-col font-sans overflow-hidden text-[#2D3436]">
      <AnimatePresence mode="wait">
        {currentView === 'home' && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex overflow-hidden">
            {renderHome()}
          </motion.div>
        )}
        {currentView === 'educator-suite' && (
          <motion.div key="educator-suite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex overflow-hidden">
            {renderEducatorSuite()}
          </motion.div>
        )}
        {currentView === 'admin' && (
          <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex overflow-hidden">
            {renderAdmin()}
          </motion.div>
        )}
        {currentView === 'lesson-plan' && (
          <motion.div key="lp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex overflow-hidden">
            {renderLessonPlanView()}
          </motion.div>
        )}
        {currentView === 'slides' && (
          <motion.div key="slides" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex overflow-hidden">
            {renderSlidesView()}
          </motion.div>
        )}
        {currentView === 'worksheet' && (
          <motion.div key="ws" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex overflow-hidden">
            {renderWorksheetView()}
          </motion.div>
        )}
        {currentView === 'poster' && (
          <motion.div key="poster" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex overflow-hidden">
            {renderPosterView()}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E2C8;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D1CFB5;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        [contenteditable] {
          -webkit-user-select: text !important;
          user-select: text !important;
          cursor: text !important;
          pointer-events: auto !important;
        }
        [contenteditable] * {
          -webkit-user-select: text !important;
          user-select: text !important;
          pointer-events: auto !important;
        }
        .select-text {
          -webkit-user-select: text !important;
          user-select: text !important;
        }
      `}</style>
      <AnimatePresence>
        {isGenerating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 max-w-sm border-4 border-[#059669]">
              <div className="relative">
                <div className="w-20 h-20 border-8 border-[#D1FAE5] border-t-[#059669] rounded-full animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-[#064E3B] uppercase tracking-tight">{generatingMessage}</h3>
                <div className="h-1 w-24 bg-[#D1FAE5] mx-auto rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-[#059669]"
                    animate={{ x: [-100, 100] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingImageUrl && (
          <ImageEditor 
            imageUrl={editingImageUrl}
            onSave={(newUrl) => {
              imageEditorCallback.cb(newUrl);
              setEditingImageUrl(null);
            }}
            onCancel={() => setEditingImageUrl(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
