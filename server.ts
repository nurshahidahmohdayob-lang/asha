import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import crypto from "crypto";
import jwt from "jsonwebtoken";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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
      const { generateSlides, generateWorksheet, generateReadingProgram, generateLessonPlan, generateSessionPlan, generateWeeklyPlan, generateEduContent, suggestWeeklyInput, generateEduNotes, relevelReadingPassage, generateInteractiveSortingGame, askAI, generatePosterImage } = await import("./src/services/geminiService.ts");
      
      let result;
      switch (type) {
        case 'slides': result = await generateSlides(lessonInput, options); break;
        case 'worksheet': result = await generateWorksheet(lessonInput, options); break;
        case 'interactiveSorting': result = await generateInteractiveSortingGame(lessonInput, options.subject, options.yearGroup); break;
        case 'readingProgram': result = await generateReadingProgram(lessonInput, options); break;
        case 'sessionPlan': result = await generateSessionPlan(lessonInput, options.subtopics, options.weeks, options); break;
        case 'lessonPlan': result = await generateLessonPlan(lessonInput, options); break;
        case 'weeklyPlan': result = await generateWeeklyPlan(lessonInput, options.weekNum, options, options.unit, options.topic); break;
        case 'notes': result = await generateEduNotes(lessonInput, options); break;
        case 'suggest': result = await suggestWeeklyInput(lessonInput as any, options, options.weekNum); break;
        case 'all': result = await generateEduContent(lessonInput, options); break;
        case 'relevelPassage': result = await relevelReadingPassage(lessonInput, options.targetLexile, options.subject, options.yearGroup); break;
        case 'chat': result = await askAI(lessonInput, options.history || []); break;
        case 'image': result = await generatePosterImage(lessonInput); break;
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

  // ==========================================
  // Passwordless Email OTP Login Authentication
  // ==========================================
  
  const otpCache = new Map<string, { code: string; expiresAt: number; name: string; role: 'admin' | 'educator' }>();

  const ADMIN_EMAILS = [
    'nurshahidahmohdayob@gmail.com', 
    'shahidah.a@zera.edu.my', 
    'shahidah.a@zera.edumy',
    'nurshahidah@zera.edu.my'
  ];

  // Helper to look up if email is in the school API or is an admin
  async function checkEmailRegistration(
    emailToCheck: string,
    customBaseUrl?: string,
    customToken?: string
  ): Promise<{ registered: boolean; name: string; role: 'admin' | 'educator' }> {
    const cleanEmail = emailToCheck.trim().toLowerCase();
    
    // 1. Check Admin List
    if (ADMIN_EMAILS.includes(cleanEmail)) {
      return {
        registered: true,
        name: "Admin User",
        role: "admin"
      };
    }

    const token = customToken || process.env.STAFF_API_KEY || "23|IUgdvUdK3yUfa7IFGy3FC5ZkWAYc4E5uYYDTyTqV544970de";
    
    // Generate candidate URLs
    const baseUrls: string[] = [];
    if (customBaseUrl) {
      let url = customBaseUrl.trim();
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      url = url.replace(/\/+$/, "");
      // sanitize
      if (url.endsWith("/api/v1/staff")) url = url.slice(0, -"/api/v1/staff".length);
      else if (url.endsWith("/api/v1")) url = url.slice(0, -"/api/v1".length);
      else if (url.endsWith("/api")) url = url.slice(0, -"/api".length);
      url = url.replace(/\/+$/, "");
      if (url) baseUrls.push(url);
    }
    
    const envBase = process.env.STAFF_API_BASE_URL;
    if (envBase) {
      let url = envBase.trim();
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      url = url.replace(/\/+$/, "").replace(/\/api\/v1\/staff$/, "").replace(/\/api\/v1$/, "").replace(/\/api$/, "").replace(/\/+$/, "");
      if (url && !baseUrls.includes(url)) baseUrls.push(url);
    }

    // Default fallbacks
    const fallbacks = [
      "https://zera-education.commun.cloud",
      "https://api.zera.edu.my",
      "https://portal.zera.edu.my",
      "https://sms.zera.edu.my",
      "https://erp.zera.edu.my"
    ];
    for (const fb of fallbacks) {
      if (!baseUrls.includes(fb)) baseUrls.push(fb);
    }

    // Attempt querying the URLs
    for (const baseUrl of baseUrls) {
      try {
        console.log(`[send-otp] Checking registration for ${cleanEmail} at ${baseUrl}`);
        
        // Try searching first for speed and precision
        const searchUrl = `${baseUrl}/api/v1/staff?search=${encodeURIComponent(cleanEmail)}`;
        const response = await fetch(searchUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/json",
            "Content-Type": "application/json"
          }
        });
        
        if (response.ok) {
          const resData: any = await response.json();
          const staffList = resData.data || [];
          const found = staffList.find((s: any) => {
            const staffEmail = String(s.email || '').trim().toLowerCase();
            return staffEmail === cleanEmail && (!s.status || s.status.toLowerCase() === 'active');
          });

          if (found) {
            const rawApiName = (found.preferred_name || found.nric_name || `${found.first_name || ''} ${found.last_name || ''}`).trim();
            const apiName = rawApiName.replace(/^(MR|MS|MRS|MR\.|MS\.|MRS\.)\s+/i, '').trim();
            const jobTitle = String(found.job_title || '').trim().toLowerCase();
            const isAuthorizedAdmin = jobTitle === 'admin staff' || jobTitle === 'coordinator';
            return {
              registered: true,
              name: apiName || "Teacher",
              role: isAuthorizedAdmin ? "admin" : "educator"
            };
          }
        }
      } catch (err) {
        console.error(`[send-otp] Search attempt failed for ${baseUrl}:`, err);
      }
    }

    // Fallback: paginated search (up to page 10) on the first successful endpoint
    for (const baseUrl of baseUrls) {
      try {
        let page = 1;
        let hasNextPage = true;
        while (hasNextPage && page <= 10) {
          const url = `${baseUrl}/api/v1/staff?page=${page}`;
          const response = await fetch(url, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Accept": "application/json",
              "Content-Type": "application/json"
            }
          });
          if (!response.ok) break;
          const resData: any = await response.json();
          const staffList = resData.data || [];
          
          const found = staffList.find((s: any) => {
            const staffEmail = String(s.email || '').trim().toLowerCase();
            return staffEmail === cleanEmail && (!s.status || s.status.toLowerCase() === 'active');
          });

          if (found) {
            const rawApiName = (found.preferred_name || found.nric_name || `${found.first_name || ''} ${found.last_name || ''}`).trim();
            const apiName = rawApiName.replace(/^(MR|MS|MRS|MR\.|MS\.|MRS\.)\s+/i, '').trim();
            const jobTitle = String(found.job_title || '').trim().toLowerCase();
            const isAuthorizedAdmin = jobTitle === 'admin staff' || jobTitle === 'coordinator';
            return {
              registered: true,
              name: apiName || "Teacher",
              role: isAuthorizedAdmin ? "admin" : "educator"
            };
          }

          const meta = resData.meta;
          if (meta && typeof meta.current_page === 'number' && typeof meta.last_page === 'number') {
            hasNextPage = meta.current_page < meta.last_page;
          } else {
            hasNextPage = false;
          }
          page++;
        }
      } catch (err) {
        // Continue to next domain fallback
      }
    }

    return { registered: false, name: "", role: "educator" };
  }

  // API Route for sending Passwordless Login OTP (Code)
  app.post("/api/auth/send-otp", async (req, res) => {
    const { email, customBaseUrl, customToken } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: "Email parameter is required" });
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
      const registration = await checkEmailRegistration(cleanEmail, customBaseUrl, customToken);
      if (!registration.registered) {
        return res.status(404).json({ 
          error: "This email is not registered under any active Staff or Admin. Please check your email or contact your administrator." 
        });
      }

      // Generate 6-digit verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

      // Cache the OTP code
      otpCache.set(cleanEmail, {
        code,
        expiresAt,
        name: registration.name,
        role: registration.role
      });

      // Try sending using configured SMTP
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM || `"EduMagic AI" <noreply@zera.edu.my>`;

      let smtpConfigured = false;
      let emailSent = false;

      if (smtpHost && smtpUser && smtpPass) {
        smtpConfigured = true;
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass
            },
            tls: {
              rejectUnauthorized: false
            }
          });

          await transporter.sendMail({
            from: smtpFrom,
            to: cleanEmail,
            subject: `Your EduMagic AI Verification Code: ${code}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 24px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <span style="font-size: 32px;">🧙‍♂️</span>
                  <h1 style="color: #059669; margin: 8px 0 0 0; font-size: 24px; font-weight: 800;">EduMagic AI</h1>
                  <p style="color: #059669; font-weight: 600; margin: 4px 0 0 0;">Your Personal Teaching Assistant</p>
                </div>
                <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 24px;" />
                <p style="color: #334155; font-size: 16px; line-height: 1.5;">Hello <strong>${registration.name}</strong>,</p>
                <p style="color: #334155; font-size: 16px; line-height: 1.5;">You requested a verification code to sign in to your EduMagic AI dashboard. Please use the following 6-digit code:</p>
                <div style="background-color: #f0fdf4; border: 2px dashed #059669; padding: 20px; text-align: center; margin: 24px 0; border-radius: 16px;">
                  <strong style="font-size: 36px; letter-spacing: 6px; color: #064e3b; font-family: monospace;">${code}</strong>
                </div>
                <p style="font-size: 14px; color: #64748b; line-height: 1.5;">This code is valid for <strong>5 minutes</strong>. If you did not request this code, please ignore this email or reach out to support if you have security concerns.</p>
                <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0 0 0;" />
                <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px;">EduMagic AI &bull; Your Automated Co-Pilot</p>
              </div>
            `
          });
          emailSent = true;
          console.log(`[SMTP] Successfully sent OTP code ${code} to ${cleanEmail}`);
        } catch (smtpErr: any) {
          console.error(`[SMTP ERROR] Failed to send email to ${cleanEmail}:`, smtpErr);
          return res.status(500).json({
            error: `Failed to send email to ${cleanEmail}. SMTP error: ${smtpErr?.message || smtpErr}. Please verify your SMTP settings in Settings.`
          });
        }
      } else {
        console.error(`[SMTP CONFIG ERROR] Missing SMTP settings when trying to email ${cleanEmail}`);
        return res.status(400).json({
          error: "To receive verification codes in school email addresses, SMTP must be configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS under Settings in your AI Studio dashboard."
        });
      }

      res.json({
        success: true,
        smtpConfigured,
        emailSent,
        name: registration.name,
        role: registration.role,
        message: smtpConfigured 
          ? "A verification code has been sent to your registered email address."
          : "Please check your registered email inbox for the login verification code. (If you don't receive it, please contact your administrator to verify your SMTP settings)."
      });

    } catch (err: any) {
      console.error("send-otp server error:", err);
      res.status(500).json({ error: err.message || "Internal server error during verification code generation" });
    }
  });

  // API Route for verifying Passwordless Login OTP (Code)
  app.post("/api/auth/verify-otp", async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "Both email and verification code are required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    const cachedData = otpCache.get(cleanEmail);
    if (!cachedData) {
      return res.status(400).json({ error: "No verification draft found for this email. Please click 'Send Verification Code' first." });
    }

    if (Date.now() > cachedData.expiresAt) {
      otpCache.delete(cleanEmail);
      return res.status(400).json({ error: "Verification code has expired. Please request a new code." });
    }

    if (cachedData.code !== cleanCode) {
      return res.status(400).json({ error: "Incorrect verification code. Please try again." });
    }

    // OTP validated successfully! Clear it from cache
    otpCache.delete(cleanEmail);

    res.json({
      success: true,
      email: cleanEmail,
      name: cachedData.name,
      role: cachedData.role,
      message: "Verify successful!"
    });
  });

  // API Route to securely check user registration status and role server-side
  app.post("/api/auth/check-registration", async (req, res) => {
    const { email, customBaseUrl, customToken } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: "Email parameter is required" });
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
      const registration = await checkEmailRegistration(cleanEmail, customBaseUrl, customToken);
      res.json({
        success: true,
        registered: registration.registered,
        name: registration.name,
        role: registration.role
      });
    } catch (err: any) {
      console.error("check-registration server error:", err);
      res.status(500).json({ error: err.message || "Internal server error during registration check" });
    }
  });

  // API Route for syncing Staff from schools API securely
  app.post("/api/staff/sync", async (req, res) => {
    const { customBaseUrl, customToken } = req.body;

    const base_url = customBaseUrl || process.env.STAFF_API_BASE_URL || "https://zera-education.commun.cloud";
    const api_token = customToken || process.env.STAFF_API_KEY || "23|IUgdvUdK3yUfa7IFGy3FC5ZkWAYc4E5uYYDTyTqV544970de";

    if (!api_token) {
      return res.status(400).json({ 
        success: false, 
        error: "API credentials are not configured. Please provide a valid token." 
      });
    }

    // Helper for timeout-based fetch
    const fetchWithTimeout = async (url: string, options: any, timeoutMs = 4000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(id);
        return response;
      } catch (error) {
        clearTimeout(id);
        throw error;
      }
    };

    try {
      let rawUrl = (customBaseUrl || process.env.STAFF_API_BASE_URL || "https://api.zera.edu.my").trim();
      if (!/^https?:\/\//i.test(rawUrl)) {
        rawUrl = `https://${rawUrl}`;
      }
      
      let resolvedBaseUrl = rawUrl.replace(/\/+$/, "");
      
      // Prevent duplicate path additions by stripping any existing routing suffixes from the base URL
      if (resolvedBaseUrl.endsWith("/api/v1/staff")) {
        resolvedBaseUrl = resolvedBaseUrl.slice(0, -"/api/v1/staff".length);
      } else if (resolvedBaseUrl.endsWith("/api/v1")) {
        resolvedBaseUrl = resolvedBaseUrl.slice(0, -"/api/v1".length);
      } else if (resolvedBaseUrl.endsWith("/api")) {
        resolvedBaseUrl = resolvedBaseUrl.slice(0, -"/api".length);
      }
      resolvedBaseUrl = resolvedBaseUrl.replace(/\/+$/, "");

      const probesAttempted: string[] = [];
      const probeResults: Record<string, string> = {};
      let isWebflowDetected = false;

      // Check if original base URL is probably a webflow public page
      const isPublicWebflowUrl = (url: string) => {
        return url.includes("zera.edu.my") && 
          !url.includes("portal.") && 
          !url.includes("sms.") && 
          !url.includes("erp.") && 
          !url.includes("staff.") && 
          !url.includes("app.") && 
          !url.includes("system.");
      };

      // Probe original base URL first
      try {
        probesAttempted.push(resolvedBaseUrl);
        const probeRes = await fetchWithTimeout(`${resolvedBaseUrl}/api/v1/staff?page=1`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${api_token}`,
            "Accept": "application/json"
          }
        }, 5000);

        const contentType = probeRes.headers.get("content-type") || "";
        
        if (probeRes.ok && contentType.includes("application/json")) {
          // It works immediately!
          probeResults[resolvedBaseUrl] = "SUCCESS";
        } else {
          probeResults[resolvedBaseUrl] = `STATUS_${probeRes.status}_${contentType.includes("html") ? "HTML" : "NON_JSON"}`;
          
          if (contentType.includes("html")) {
            const htmlText = await probeRes.text();
            if (htmlText.includes("Webflow") || htmlText.includes("w-webflow") || htmlText.includes("webflow.shared")) {
              isWebflowDetected = true;
            }
          }
        }
      } catch (err: any) {
        probeResults[resolvedBaseUrl] = `ERROR_${err.name || "FAILED"}`;
      }

      // If original URL didn't return JSON/Succesful API response, and it's zera.edu.my
      if (probeResults[resolvedBaseUrl] !== "SUCCESS" && resolvedBaseUrl.includes("zera.edu.my")) {
        console.log("Original URL probe failed or returned HTML. Starting subdomain discovery...");
        
        const candidateSubdomains = [
          "https://api.zera.edu.my",
          "https://portal.zera.edu.my",
          "https://sms.zera.edu.my",
          "https://erp.zera.edu.my",
          "https://staff.zera.edu.my",
          "https://app.zera.edu.my",
          "https://system.zera.edu.my",
          "https://admin.zera.edu.my",
          "https://school.zera.edu.my"
        ];

        let foundWorkingSubdomain = false;
        for (const sub of candidateSubdomains) {
          if (sub === resolvedBaseUrl) continue;
          
          try {
            probesAttempted.push(sub);
            console.log(`Probing subdomain: ${sub}/api/v1/staff?page=1`);
            
            const subRes = await fetchWithTimeout(`${sub}/api/v1/staff?page=1`, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${api_token}`,
                "Accept": "application/json"
              }
            }, 4000);

            const type = subRes.headers.get("content-type") || "";
            if (subRes.ok && type.includes("application/json")) {
              probeResults[sub] = "SUCCESS";
              resolvedBaseUrl = sub;
              foundWorkingSubdomain = true;
              console.log(`Found working API subdomain! Auto-switching to: ${sub}`);
              break;
            } else {
              probeResults[sub] = `STATUS_${subRes.status}`;
            }
          } catch (err: any) {
            probeResults[sub] = `ERROR_${err.name || "FAILED"}`;
          }
        }

        if (!foundWorkingSubdomain) {
          // If we couldn't auto-resolve, and webflow was originally hit, throw a custom explanatory error
          if (isWebflowDetected || resolvedBaseUrl.includes("zera.edu.my")) {
            return res.status(404).json({
              success: false,
              isWebflowError: true,
              error: `The base URL points to the static public Webflow website or could not be resolved natively. We scanned common subdomains (portal, sms, erp, staff, api) but they didn't respond. If your school portal uses a different URL (such as zera-education.commun.cloud), please enter that specific address directly.`,
              probes: probeResults
            });
          }
        }
      }

      // Proceed with fetching pages from resolvedBaseUrl
      console.log(`Using resolved API base URL: ${resolvedBaseUrl}`);
      let page = 1;
      let allStaff: any[] = [];
      let hasNextPage = true;

      while (hasNextPage) {
        const url = `${resolvedBaseUrl}/api/v1/staff?page=${page}`;
        console.log(`Fetching page ${page} of staff from: ${url}`);
        
        const response = await fetchWithTimeout(url, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${api_token}`,
            "Accept": "application/json",
            "Content-Type": "application/json"
          }
        }, 12000);

        if (!response.ok) {
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("html")) {
            const text = await response.text();
            if (text.includes("Webflow")) {
              throw new Error(`The school portal at '${resolvedBaseUrl}' appears to be routed to Webflow or incorrect hosting (returned a Webflow page). Please verify the portal subdomain.`);
            }
          }
          throw new Error(`API error (${response.status}) at ${resolvedBaseUrl}: ${response.statusText}`);
        }

        const resData: any = await response.json();
        const data = resData.data || [];
        allStaff = allStaff.concat(data);

        // Check for next page
        const meta = resData.meta;
        const links = resData.links;

        if (meta && typeof meta.current_page === 'number' && typeof meta.last_page === 'number') {
          hasNextPage = meta.current_page < meta.last_page;
        } else if (links && links.next) {
          hasNextPage = true;
        } else {
          hasNextPage = false;
        }

        if (page >= 50) {
          break;
        }
        page++;
      }

      // Filter only active staff
      const activeStaff = allStaff.filter(s => {
        return !s.status || s.status.toLowerCase() === 'active';
      });

      res.json({
        success: true,
        count: activeStaff.length,
        totalInApi: allStaff.length,
        staff: activeStaff,
        resolvedUrl: resolvedBaseUrl
      });

    } catch (err: any) {
      console.error("Staff sync error:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Failed to fetch staff from API"
      });
    }
  });

  // ==========================================
  // Connected Systems SSO and Back-channel API
  // ==========================================
  let currentSsoClientId = "em-client-8822";
  let currentSsoMachineToken = "commun_mt_abc123xyz";
  let currentSsoSchoolUrl = "https://zera-education.commun.cloud";

  let ssoPrivateKey: any;
  let ssoPublicKeyJwk: any;
  const ssoKid = "commun-sso-key-1";

  try {
    const keypair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });

    ssoPrivateKey = keypair.privateKey.export({ type: 'pkcs8', format: 'pem' });
    const publicKeyJwk = keypair.publicKey.export({ format: 'jwk' });
    ssoPublicKeyJwk = {
      ...publicKeyJwk,
      kid: ssoKid,
      use: 'sig',
      alg: 'RS256'
    };
  } catch (err) {
    console.error("Failed to generate RSA keypair", err);
  }

  // JTI List to prevent ticket replays
  const seenJtis = new Set<string>();

  // In-memory SSO event log
  const ssoLogs: any[] = [];
  function logSso(status: 'success' | 'failed' | 'info', message: string, details?: any) {
    ssoLogs.unshift({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      status,
      message,
      details: details ? JSON.stringify(details, null, 2) : null
    });
    if (ssoLogs.length > 50) ssoLogs.pop();
  }

  // Active shadow users provisioned through SSO
  const shadowUsers = new Map<string, any>();
  // Pre-seed some shadow users
  shadowUsers.set("user_sub_8801", {
    sub: "user_sub_8801",
    school_id: "sch_zera_01",
    school_slug: "zera",
    name: {
      first_name: "Sarah",
      last_name: "Connor",
      preferred_name: "Sarah",
      nric_name: "Sarah Connor"
    },
    email: "sarah.connor@zera.edu.my",
    user_types: ["teacher"],
    locale: "en-GB",
    createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    active: true
  });

  // JWKS Public Key Endpoint
  app.get("/api/sso/jwks", (req, res) => {
    if (!ssoPublicKeyJwk) {
      return res.status(500).json({ error: "SSO Public Key not initialized" });
    }
    res.json({
      keys: [ssoPublicKeyJwk]
    });
  });

  // Get SSO configurations
  app.get("/api/sso/config", (req, res) => {
    res.json({
      client_id: currentSsoClientId,
      machine_token: currentSsoMachineToken,
      school_url: currentSsoSchoolUrl,
      callback_url: `/sso/callback`,
      jwks_url: `/api/sso/jwks`
    });
  });

  // Update SSO configurations
  app.post("/api/sso/config", (req, res) => {
    const { client_id, machine_token, school_url } = req.body;
    if (client_id) currentSsoClientId = client_id;
    if (machine_token) currentSsoMachineToken = machine_token;
    if (school_url) currentSsoSchoolUrl = school_url;
    
    logSso('info', 'SSO configuration updated', { client_id, machine_token, school_url });
    res.json({ success: true, message: "Configurations saved successfully!" });
  });

  // Clean SSO state (logs, shadow users, seen jtis)
  app.post("/api/sso/reset", (req, res) => {
    seenJtis.clear();
    ssoLogs.length = 0;
    shadowUsers.clear();
    
    // re-seed
    shadowUsers.set("user_sub_8801", {
      sub: "user_sub_8801",
      school_id: "sch_zera_01",
      school_slug: "zera",
      name: {
        first_name: "Sarah",
        last_name: "Connor",
        preferred_name: "Sarah",
        nric_name: "Sarah Connor"
      },
      email: "sarah.connor@zera.edu.my",
      user_types: ["teacher"],
      locale: "en-GB",
      createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
      active: true
    });

    logSso('info', 'SSO simulator state reset to factory defaults');
    res.json({ success: true, message: "SSO simulator state reset successfully" });
  });

  // Fetch live logs
  app.get("/api/sso/logs", (req, res) => {
    res.json(ssoLogs);
  });

  // Get list of active shadow users
  app.get("/api/sso/shadow-users", (req, res) => {
    res.json(Array.from(shadowUsers.values()));
  });

  // Generate valid ticket signed with RS256 for browser SSO flow testing
  app.post("/api/sso/generate-ticket", (req, res) => {
    const { sub, email, first_name, last_name, user_types, clockSkewSeconds, expiredToken } = req.body;
    
    if (!ssoPrivateKey) {
      return res.status(500).json({ error: "Private key not generated yet" });
    }

    try {
      const now = Math.floor(Date.now() / 1000);
      const skew = Number(clockSkewSeconds || 0);

      const iat = now + skew;
      const nbf = now + skew - 2;
      const exp = expiredToken ? (now - 120) : (now + skew + 60);

      const payload = {
        iss: currentSsoSchoolUrl,
        aud: currentSsoClientId,
        sub: sub || `user_sub_${Math.floor(1000 + Math.random() * 9000)}`,
        school_id: "sch_zera_01",
        school_slug: "zera",
        name: {
          first_name: first_name || "John",
          last_name: last_name || "Doe",
          preferred_name: first_name || "John",
          nric_name: `${first_name || "John"} ${last_name || "Doe"}`
        },
        email: email || `${(first_name || "john").toLowerCase()}.${(last_name || "doe").toLowerCase()}@zera.edu.my`,
        user_types: user_types || ["teacher"],
        locale: "en-GB",
        jti: "jti_" + Math.random().toString(36).substr(2, 15),
        iat,
        nbf,
        exp
      };

      const token = jwt.sign(payload, ssoPrivateKey, {
        algorithm: 'RS256',
        header: {
          kid: ssoKid
        }
      });

      res.json({ ticket: token, payload });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // SSO Callback browser handoff handler.
  // Commun redirects browser here: GET /sso/callback?ticket=<token>
  app.get("/sso/callback", (req, res) => {
    const { ticket } = req.query;
    if (!ticket || typeof ticket !== 'string') {
      logSso('failed', 'SSO Handoff failed: Missing ticket query parameter');
      return res.status(400).send(`
        <html>
          <head><title>SSO Error</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
          <body style="font-family: sans-serif; background: #FEF2F2; color: #991B1B; padding: 40px; text-align: center;">
            <h2>SSO Handoff Failed</h2>
            <p>The "ticket" query parameter is missing from the SSO callback request.</p>
            <a href="/" style="display: inline-block; padding: 10px 20px; background: #EF4444; color: white; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px;">Return to App</a>
          </body>
        </html>
      `);
    }

    try {
      // 1. Decrypt/Decode header without verification to identify kid
      const decodedToken = jwt.decode(ticket, { complete: true }) as any;
      if (!decodedToken) {
        throw new Error("Unable to decode token format (compact RS256 JWT expected)");
      }

      const headerKid = decodedToken.header?.kid;
      if (headerKid !== ssoKid) {
        throw new Error(`JWKS kid mismatch. Header kid: "${headerKid}", Expected kid: "${ssoKid}"`);
      }

      // 2. Cryptographic signature check with public JWK format via PEM
      // In production, we'd fetch the public key from the school portal JWKS and cached it.
      // Since we generate ssoPrivateKey/ssoPublicKeyJwk dynamically on startup, we verify it directly.
      const payload = jwt.verify(ticket, ssoPrivateKey, { algorithms: ['RS256'] }) as any;

      // 3. Verify Aud and Iss claims
      if (payload.aud !== currentSsoClientId) {
        throw new Error(`aud claim mismatch. Payload aud: "${payload.aud}", Expected client_id: "${currentSsoClientId}"`);
      }
      if (payload.iss !== currentSsoSchoolUrl) {
        throw new Error(`iss claim mismatch. Payload iss: "${payload.iss}", Expected issuer URL: "${currentSsoSchoolUrl}"`);
      }

      // 4. Verify JTI anti-replay single-use constraint
      if (seenJtis.has(payload.jti)) {
        throw new Error(`Single-use protection triggered: The jti token claim "${payload.jti}" has already been processed (replay attack blocked)`);
      }
      seenJtis.add(payload.jti);

      // 5. Match or Provision local shadow user
      const existingUser = shadowUsers.get(payload.sub);
      const isNew = !existingUser;

      const matchedOrProvisionedUser = {
        sub: payload.sub,
        school_id: payload.school_id,
        school_slug: payload.school_slug,
        name: payload.name,
        email: payload.email,
        user_types: payload.user_types,
        locale: payload.locale || "en-GB",
        createdAt: existingUser?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        active: existingUser ? existingUser.active : true
      };

      shadowUsers.set(payload.sub, matchedOrProvisionedUser);

      logSso('success', `SSO handoff verified successfully for sub: "${payload.sub}" (${matchedOrProvisionedUser.name.first_name} ${matchedOrProvisionedUser.name.last_name}). ${isNew ? 'New shadow user provisioned.' : 'Existing shadow user profile updated.'}`, {
        claims: payload,
        matchedOrProvisionedUser
      });

      // Redirect browser back to home with the sso_user details so client React can active the authenticated state!
      const userPayloadStr = Buffer.from(JSON.stringify(matchedOrProvisionedUser)).toString('base64');
      res.redirect(`/?sso_user=${userPayloadStr}`);

    } catch (err: any) {
      const errMsg = err.message || "Cryptographic verification failed";
      logSso('failed', `SSO Token Handoff Failed: ${errMsg}`, { error: errMsg, ticket: ticket.substring(0, 50) + "..." });
      
      return res.status(400).send(`
        <html>
          <head><title>SSO Ticket Verification Failed</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
          <body style="font-family: sans-serif; background: #FEF2F2; color: #991B1B; padding: 40px; text-align: center;">
            <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid #FCA5A5;">
              <span style="font-size: 48px;">❌</span>
              <h2 style="margin: 12px 0;">SSO Verification Failed</h2>
              <p style="color: #555; text-align: left; font-size: 14px; background: #F9FAFB; padding: 12px; border-radius: 8px; border-left: 4px solid #EF4444; font-family: monospace; white-space: pre-wrap;">${errMsg}</p>
              <p style="font-size: 13px; color: #666; margin-top: 15px;">Check the Admin Single Sign-On logs for detailed cryptographic tracing.</p>
              <a href="/" style="display: inline-block; padding: 12px 24px; background: #EF4444; color: white; border-radius: 12px; text-decoration: none; font-weight: bold; margin-top: 20px;">Return to App</a>
            </div>
          </body>
        </html>
      `);
    }
  });

  // BACK-CHANNEL API: /api/v1/userinfo/{sub}  (requires authorization bearer token check)
  app.get("/api/v1/userinfo/:sub", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logSso('failed', `Back-channel Userinfo lookup block: Missing Bearer authorization token`, { sub: req.params.sub });
      return res.status(401).json({ error: "Unauthorized. Missing Bearer authorization token" });
    }

    const token = authHeader.split(" ")[1];
    if (token !== currentSsoMachineToken) {
      logSso('failed', `Back-channel Userinfo lookup block: Invalid Bearer token "${token}" supplied`, { sub: req.params.sub });
      return res.status(401).json({ error: "Unauthorized. Invalid Bearer token" });
    }

    const sub = req.params.sub;
    const user = shadowUsers.get(sub);
    
    if (!user) {
      logSso('failed', `Back-channel Userinfo lookup failed: Sub lookup "${sub}" was not found in database`, { sub });
      return res.status(404).json({ error: `User with sub ID "${sub}" not found` });
    }

    logSso('success', `Back-channel identity re-sync lookup served for sub: "${sub}" under active machine token credentials`, { sub, userProfile: user });
    res.json({
      sub: user.sub,
      email: user.email,
      name: user.name,
      active: user.active,
      user_types: user.user_types,
      school_id: user.school_id
    });
  });

  // BACK-CHANNEL API: /api/v1/students  (list of students, requires bearer token check)
  app.get("/api/v1/students", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized. Missing Bearer token" });
    }
    const token = authHeader.split(" ")[1];
    if (token !== currentSsoMachineToken) {
      return res.status(401).json({ error: "Unauthorized. Invalid token" });
    }

    logSso('success', `Back-channel API bulk read: Fetched student directory (students.read scope)`);
    res.json({
      success: true,
      data: [
        { id: "std_1", first_name: "Emma", last_name: "Watson", email: "emma.watson@school.edu.my", gender: "female", status: "active" },
        { id: "std_2", first_name: "Ron", last_name: "Weasley", email: "ron.weasley@school.edu.my", gender: "male", status: "active" },
        { id: "std_3", first_name: "Harry", last_name: "Potter", email: "harry.potter@school.edu.my", gender: "male", status: "active" }
      ]
    });
  });

  // Toggle user active status in simulator back-office to test active recheck failures
  app.post("/api/sso/toggle-shadow-active", (req, res) => {
    const { sub } = req.body;
    const user = shadowUsers.get(sub);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user.active = !user.active;
    shadowUsers.set(sub, user);
    logSso('info', `Shadow user profile "${sub}" status toggled in simulator back-office`, { sub, active: user.active });
    res.json({ success: true, active: user.active });
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
