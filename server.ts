import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

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
      const { generateSlides, generateWorksheet, generateReadingProgram, generateLessonPlan, generateSessionPlan, generateWeeklyPlan, generateEduContent, suggestWeeklyInput, generateEduNotes, relevelReadingPassage } = await import("./src/services/geminiService.ts");
      
      let result;
      switch (type) {
        case 'slides': result = await generateSlides(lessonInput, options); break;
        case 'worksheet': result = await generateWorksheet(lessonInput, options); break;
        case 'readingProgram': result = await generateReadingProgram(lessonInput, options); break;
        case 'sessionPlan': result = await generateSessionPlan(lessonInput, options.subtopics, options.weeks, options); break;
        case 'lessonPlan': result = await generateLessonPlan(lessonInput, options); break;
        case 'weeklyPlan': result = await generateWeeklyPlan(lessonInput, options.weekNum, options, options.unit, options.topic); break;
        case 'notes': result = await generateEduNotes(lessonInput, options); break;
        case 'suggest': result = await suggestWeeklyInput(lessonInput as any, options, options.weekNum); break;
        case 'all': result = await generateEduContent(lessonInput, options); break;
        case 'relevelPassage': result = await relevelReadingPassage(lessonInput, options.targetLexile, options.subject, options.yearGroup); break;
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
