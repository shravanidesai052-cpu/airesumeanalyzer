// ================================================================
//  ResumeIQ — AI Resume Analyzer
//  Uses Gemini API (gemini-2.5-flash) & JSearch API for Live Vacancies
// ================================================================

const GEMINI_API_KEY = "AIzaSyC-8R6yFLXYV9NuKWQGCuUeSCjzjli_FLM";
const MODEL_NAME = "gemini-2.5-flash";

// ⚠️ IMPORTANT: Replace with your actual RapidAPI Key from your JSearch account subscription
const RAPIDAPI_KEY = "d56486b229mshac147b3fccd2aa3p1dc8a4jsn176ad541c154";  // <-- REPLACE THIS WITH YOUR RAPIDAPI KEY

const PDFJS_MODULE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs";
const PDFJS_WORKER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs";

async function ensurePdfJsLoaded() {
  if (window.pdfjsLib) {
    return window.pdfjsLib;
  }

  try {
    const pdfjs = await import(PDFJS_MODULE_CDN);
    window.pdfjsLib = pdfjs;
    return pdfjs;
  } catch (error) {
    console.error("PDF.js import error:", error);
    throw new Error("PDF.js did not initialize after importing module.");
  }
}

async function handleResumeFile(event) {
  const file = event.target.files?.[0];
  const fileNameEl = document.getElementById("resumeFileName");
  fileNameEl.textContent = "";

  if (!file) {
    return;
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    alert("Please upload a PDF resume file.");
    event.target.value = "";
    return;
  }

  let pdfjs;
  try {
    pdfjs = await ensurePdfJsLoaded();
  } catch (error) {
    console.error("PDF.js load error:", error);
    alert("PDF parsing library failed to load. Check your network or browser script settings and refresh the page, or paste your resume text instead.");
    event.target.value = "";
    return;
  }

  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;

  setLoading(true);
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let extractedText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str || item?.unicode || "").join(" ");
      extractedText += pageText + "\n\n";
    }

    const resumeTextEl = document.getElementById("resumeText");
    resumeTextEl.value = extractedText.trim();
    fileNameEl.textContent = `Loaded: ${file.name}`;
  } catch (error) {
    console.error("PDF extract error:", error);
    alert("Unable to read the PDF. Please try a different resume file or refresh the page.");
    event.target.value = "";
  } finally {
    setLoading(false);
  }
}

// ================================================================
//  MAIN ANALYZE FUNCTION
// ================================================================
async function analyzeResume() {
  const resumeText = document.getElementById("resumeText").value.trim();
  const jobDesc = document.getElementById("jobDesc").value.trim();
  const targetRole = document.getElementById("targetRole").value;

  if (!resumeText || resumeText.length < 100) {
    alert("Please paste your resume text or upload a PDF resume with at least 100 characters of extracted content.");
    return;
  }

  // UI: loading state
  setLoading(true);

  try {
    // 💡 Performance Optimization: We bundle all sub-prompts into a single master layout structure.
    // This reduces external network roundtrips from 5 calls to 1, avoiding RPM/TPM rate limits.
    const systemPrompt = `You are an expert resume analyst, resume writer, and ATS specialist. Your task is to evaluate the user's resume thoroughly and return a single, valid JSON object containing all analytical blocks. Do not include markdown formatting, code fences, or text preambles.`;

    const userMessage = `Analyze this resume for a ${targetRole} position.
    ${jobDesc ? "Target Job Description: " + jobDesc.slice(0, 1000) : "No specific job description provided."}

    Resume Content:
    ${resumeText}

    Return EXACTLY this JSON structure:
    {
      "overview": {
        "ats_score": 75,
        "verdict": "One sentence summary verdict.",
        "strengths": ["Strength 1", "Strength 2", "Strength 3"],
        "weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
        "quick_tips": ["Tip 1", "Tip 2", "Tip 3"]
      },
      "sections": [
        { "name": "Summary / Objective", "score": 85, "feedback": "Feedback line.", "exists": true },
        { "name": "Work Experience", "score": 70, "feedback": "Feedback line.", "exists": true },
        { "name": "Skills", "score": 90, "feedback": "Feedback line.", "exists": true },
        { "name": "Education", "score": 95, "feedback": "Feedback line.", "exists": true },
        { "name": "Formatting & Length", "score": 80, "feedback": "Feedback line.", "exists": true }
      ],
      "keywords": {
        "present_keywords": ["keyword1", "keyword2"],
        "missing_keywords": ["keyword3", "keyword4"],
        "keyword_density_score": 65,
        "industry_terms_found": ["term1", "term2"],
        "summary": "Two sentence overview summary of keywords."
      },
      "rewrites": {
        "bullet_points": [
          { "original": "Original weak bullet 1 found in text", "improved": "Improved bullet using action verbs and data impact", "reason": "Why it was weak" },
          { "original": "Original weak bullet 2 found in text", "improved": "Improved bullet layout", "reason": "Why it was weak" },
          { "original": "Original weak bullet 3 found in text", "improved": "Improved bullet layout", "reason": "Why it was weak" }
        ],
        "general_tip": "One overall structural advice tip."
      },
      "job_match": {
        "match_percentage": 70,
        "matching_requirements": ["Req met 1", "Req met 2"],
        "missing_requirements": ["Missing req 1", "Missing req 2"],
        "recommendation": "Two sentence recommendation statement.",
        "hiring_chance": "Medium"
      },
      "job_search_meta": {
        "suggested_query": "Target job title keywords for search engines",
        "target_companies": ["Company1", "Company2"]
      }
    }`;

    const rawJSON = await callGemini(systemPrompt, userMessage);
    const data = JSON.parse(rawJSON);

    // Render data structures across all client sub-tabs
    renderOverview(data.overview);
    renderSections({ sections: data.sections });
    renderKeywords(data.keywords);
    renderRewrites(data.rewrites);
    renderJobMatch(data.job_match, !!jobDesc);

    // Trigger the real-time job vacancy database pull
    if (data.job_search_meta) {
      fetchLiveJobs(data.job_search_meta.suggested_query, data.job_search_meta.target_companies);
    } else {
      fetchLiveJobs(targetRole, []);
    }

    // Show results panel
    document.getElementById("resultsPanel").style.display = "block";
    document.getElementById("resultsPanel").scrollIntoView({ behavior: "smooth", block: "start" });

  } catch (err) {
    console.error("Analysis error:", err);
    alert("Something went wrong during evaluation. Check your network console configuration.\n\nError: " + err.message);
  } finally {
    setLoading(false);
  }
}

// ================================================================
//  API CALL HELPER (Updated for Gemini API)
// ================================================================
async function callGemini(systemPrompt, userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        role: "user",
        parts: [{ text: userMessage }]
      }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

// ================================================================
//  LIVE JOB VACANCY HOOK (JSearch API Implementation)
// ================================================================
async function fetchLiveJobs(query, companies) {
  const container = document.getElementById("tab-vacancies");
  container.innerHTML = `
    <div class="skeleton" style="height:80px; margin-top:12px;"></div>
    <div class="skeleton" style="height:80px; margin-top:12px;"></div>
    <div class="skeleton" style="height:80px; margin-top:12px;"></div>
  `;

  // prioritize matching companies if Gemini pulled them out, e.g., "AI Engineer at Google"
  const companyQueryAppend = companies && companies.length > 0 ? ` at ${companies[0]}` : "";
  const normalizedQuery = (query && query.trim().length > 0) ? query.trim() : "Software Engineer";
  const primarySearchTerms = `${normalizedQuery}${companyQueryAppend}`;
  const fallbackSearchTerms = normalizedQuery;

  async function searchJobs(searchTerms) {
    const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(searchTerms)}&page=1&num_pages=1`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
      }
    });

    if (!response.ok) {
      let errorDetails = "";
      try {
        const errJson = await response.json();
        errorDetails = errJson?.message || JSON.stringify(errJson);
      } catch (innerErr) {
        errorDetails = await response.text();
      }
      throw new Error(`HTTP ${response.status}: ${errorDetails}`);
    }

    const resData = await response.json();
    return resData.data || [];
  }

  try {
    let jobs = await searchJobs(primarySearchTerms);
    let usedSearch = primarySearchTerms;

    if ((!jobs || jobs.length === 0) && companyQueryAppend) {
      jobs = await searchJobs(fallbackSearchTerms);
      usedSearch = fallbackSearchTerms;
    }

    if (!jobs || jobs.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:var(--text-muted)">
          <div style="font-size:32px; margin-bottom:8px;">🔍</div>
          <div>No matching live roles were found for <strong>${escapeHtml(usedSearch)}</strong>.</div>
          <div style="margin-top:12px; font-size:13px;">Try a broader target role or paste a job description with different keywords.</div>
        </div>`;
      activateVacanciesTab();
      return;
    }

    renderVacancies(jobs);
    activateVacanciesTab();
  } catch (err) {
    console.error("Job Search API error:", err);
    container.innerHTML = `
      <div class="sw-item weakness">
        <span class="sw-icon">✗</span>
        <span>Failed to fetch real-time listings. Please ensure you have added your valid RapidAPI subscription key inside app.js.</span>
      </div>
      <div style="margin-top:12px; color:var(--text-muted); font-size:12px;">
        ${escapeHtml(err.message)}
      </div>`;
  }
}

function renderVacancies(jobs) {
  const container = document.getElementById("tab-vacancies");

  if (!jobs || jobs.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:var(--text-muted)">
        <div style="font-size:32px; margin-bottom:8px;">🔍</div>
        <div>No matching live roles open at targeted companies right now. Please check back later.</div>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="result-section">
      <h3>💼 Real-Time Vacancy Matches</h3>
      ${jobs.map(job => {
        const title = job.job_title || job.title || "Job opening";
        const employer = job.employer_name || job.company_name || "Unknown employer";
        const city = job.job_city || job.location || "Remote";
        const country = job.job_country || "";
        const publisher = job.job_publisher || "JSearch";
        const applyUrl = job.job_google_link || job.job_apply_link || job.redirect_url || `https://www.google.com/search?q=${encodeURIComponent(`${title} ${employer}`)}`;

        return `
          <div class="rewrite-card" style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 16px;">
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 15px; color: var(--text);">${escapeHtml(title)}</div>
              <div style="font-size: 13px; color: var(--accent2); margin-top: 2px;">
                ${escapeHtml(employer)} — 📍 ${escapeHtml(city)}, ${escapeHtml(country)}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                Listed via ${escapeHtml(publisher)}
              </div>
            </div>
            <a href="${escapeHtml(applyUrl)}" target="_blank" class="btn-primary" 
               style="margin-top: 0; width: auto; padding: 8px 16px; font-size: 12px; text-decoration: none; border-radius: 6px; white-space: nowrap;">
              Apply ↗
            </a>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// ================================================================
//  RENDER FUNCTIONS
// ================================================================
function renderOverview(data) {
  const score = data.ats_score || 0;
  const el = document.getElementById("atsScore");
  const bar = document.getElementById("atsBar");
  const verdict = document.getElementById("atsVerdict");

  el.textContent = score;
  verdict.textContent = data.verdict || "";
  el.style.color = scoreColor(score);

  setTimeout(() => { bar.style.width = score + "%"; }, 100);
  bar.style.background = score >= 70
    ? "linear-gradient(90deg, #34d399, #6ee7b7)"
    : score >= 45
    ? "linear-gradient(90deg, #fbbf24, #fde68a)"
    : "linear-gradient(90deg, #f87171, #fca5a5)";

  const container = document.getElementById("tab-overview");
  container.innerHTML = `
    <div class="result-section">
      <h3>✅ Strengths</h3>
      ${(data.strengths || []).map(s => `
        <div class="sw-item strength"><span class="sw-icon">✦</span><span>${s}</span></div>
      `).join("")}
    </div>
    <div class="result-section">
      <h3>⚠️ Weaknesses</h3>
      ${(data.weaknesses || []).map(w => `
        <div class="sw-item weakness"><span class="sw-icon">✗</span><span>${w}</span></div>
      `).join("")}
    </div>
    <div class="result-section">
      <h3>💡 Quick Tips</h3>
      ${(data.quick_tips || []).map(t => `
        <div class="sw-item tip"><span class="sw-icon">→</span><span>${t}</span></div>
      `).join("")}
    </div>
  `;
}

function renderSections(data) {
  const container = document.getElementById("tab-sections");
  container.innerHTML = `
    <div class="result-section">
      ${(data.sections || []).map(sec => {
        const badgeClass = sec.score >= 70 ? "badge-green" : sec.score >= 45 ? "badge-yellow" : "badge-red";
        return `
          <div class="section-score-item">
            <div>
              <div class="section-score-name">${sec.exists ? "✓" : "✗"} ${sec.name}</div>
              <div class="section-score-detail">${sec.feedback}</div>
            </div>
            <div class="section-score-badge ${badgeClass}">${sec.score}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderKeywords(data) {
  const container = document.getElementById("tab-keywords");
  container.innerHTML = `
    <div class="result-section">
      <h3>🔑 Keywords Found</h3>
      <div class="tag-row">
        ${(data.present_keywords || []).map(k => `<span class="tag present">${k}</span>`).join("")}
      </div>
    </div>
    <div class="result-section" style="margin-top:20px">
      <h3>❌ Missing Keywords</h3>
      <div class="tag-row">
        ${(data.missing_keywords || []).map(k => `<span class="tag missing">${k}</span>`).join("")}
      </div>
    </div>
    <div class="result-section" style="margin-top:20px">
      <h3>🏭 Industry Terms</h3>
      <div class="tag-row">
        ${(data.industry_terms_found || []).map(k => `<span class="tag">${k}</span>`).join("")}
      </div>
    </div>
    <div class="sw-item tip" style="margin-top:16px">
      <span class="sw-icon">💬</span>
      <span>${data.summary || ""}</span>
    </div>
  `;
}

function renderRewrites(data) {
  const container = document.getElementById("tab-rewrites");
  const rewrites = data.bullet_points || data.rewrites || [];

  container.innerHTML = `
    ${rewrites.map(r => `
      <div class="rewrite-card rewrite-original">
        <div class="rewrite-label">Original</div>
        <div class="rewrite-text">${escapeHtml(r.original)}</div>
      </div>
      <div class="rewrite-arrow">↓ ${r.reason}</div>
      <div class="rewrite-card rewrite-improved">
        <div class="rewrite-label">Improved</div>
        <div class="rewrite-text">${escapeHtml(r.improved)}</div>
      </div>
      <hr style="border:none;border-top:1px solid var(--border);margin:20px 0"/>
    `).join("")}
    ${data.general_tip ? `
      <div class="sw-item tip">
        <span class="sw-icon">💡</span>
        <span>${data.general_tip}</span>
      </div>
    ` : ""}
  `;
}

function renderJobMatch(data, hasJobDesc) {
  const container = document.getElementById("tab-jobmatch");

  if (!hasJobDesc) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text-muted)">
        <div style="font-size:40px;margin-bottom:12px">📋</div>
        <div style="font-size:15px">Paste a job description in the input panel to see your match score.</div>
      </div>
    `;
    return;
  }

  if (!data) {
    container.innerHTML = `<div class="sw-item weakness">Job match analysis failed. Try again.</div>`;
    return;
  }

  const chanceColor = data.hiring_chance === "High" ? "var(--green)"
    : data.hiring_chance === "Medium" ? "var(--yellow)" : "var(--red)";

  container.innerHTML = `
    <div class="job-match-meter">
      <div class="job-match-pct">${data.match_percentage}%</div>
      <div class="job-match-label">Job Match Score</div>
      <div style="margin-top:8px;font-size:13px;font-weight:600;color:${chanceColor}">
        ${data.hiring_chance} chance of passing screening
      </div>
    </div>
    <div class="result-section" style="margin-top:16px">
      <h3>✅ Requirements You Meet</h3>
      ${(data.matching_requirements || []).map(r => `
        <div class="sw-item strength"><span class="sw-icon">✦</span><span>${r}</span></div>
      `).join("")}
    </div>
    <div class="result-section" style="margin-top:16px">
      <h3>❌ Requirements You're Missing</h3>
      ${(data.missing_requirements || []).map(r => `
        <div class="sw-item weakness"><span class="sw-icon">✗</span><span>${r}</span></div>
      `).join("")}
    </div>
    <div class="sw-item tip" style="margin-top:16px">
      <span class="sw-icon">💬</span>
      <span>${data.recommendation || ""}</span>
    </div>
  `;
}

// ================================================================
//  TAB SWITCHING
// ================================================================
function switchTab(tabName, btn) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll(".tab").forEach(el => el.classList.remove("active"));
  document.getElementById("tab-" + tabName).classList.remove("hidden");
  btn.classList.add("active");
}

function activateVacanciesTab() {
  const vacancyButton = Array.from(document.querySelectorAll(".tab")).find(el => el.textContent.trim() === "Live Vacancies");
  if (vacancyButton) {
    switchTab('vacancies', vacancyButton);
  }
}

// ================================================================
//  UI HELPERS
// ================================================================
function setLoading(isLoading) {
  const btn = document.getElementById("analyzeBtn");
  const btnText = document.getElementById("btnText");
  const btnLoader = document.getElementById("btnLoader");

  btn.disabled = isLoading;
  btnText.classList.toggle("hidden", isLoading);
  btnLoader.classList.toggle("hidden", !isLoading);

  if (isLoading) {
    btnLoader.innerHTML = `<span class="spinner"></span>Analyzing with AI...`;
  }
}

function scoreColor(score) {
  if (score >= 70) return "var(--green)";
  if (score >= 45) return "var(--yellow)";
  return "var(--red)";
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}