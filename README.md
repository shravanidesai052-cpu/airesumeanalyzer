# ResumeIQ — AI Resume Analyzer 🎯🤖

ResumeIQ is an intelligent, high-performance web application designed to optimize resumes for modern Applicant Tracking Systems (ATS). Powered by the **Google Gemini API**, it provides comprehensive contextual feedback, automated bullet point rewriting, keyword gap identification, and real-time job vacancy sourcing—all from a single PDF upload.

![Version](https://img.shields.io/badge/version-1.1.0-blueviolet)
![License](https://img.shields.io/badge/license-MIT-green)
![Powered By](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-orange)

---

## ⚡ Key Features

*   **Multimodal PDF Parsing:** No clunky frontend text extraction libraries. Upload your raw resume PDF directly; Gemini processes the structural layout and content natively.
*   **Single-Request Architecture:** Combines complex analytical sub-tasks (ATS rating, keyword verification, metric rewriting, job descriptions cross-referencing) into a single optimized model payload. This drops API consumption by **80%** and completely bypasses free tier rate limit crashes (`429 Errors`).
*   **Automated Bullet Upgrades:** Extracts weak structural phrases and rewrites them using action verbs and quantifiable data impact metrics.
*   **Live Vacancy Matching:** Deep-scans your optimized profile structure to query live job boards (via JSearch API) for open matching listings at major companies.

---

## 🛠️ Tech Stack

*   **Frontend:** Semantic HTML5, CSS3 Custom Variables (Modern Dark Mode UX), Vanilla JavaScript (ES6+ Asynchronous architecture).
*   **AI Engine:** Google Gemini 2.5 Flash (`generateContent` endpoint utilizing Native Structured JSON response schemas).
*   **Job Database Feed:** JSearch REST Engine via RapidAPI proxy layers.

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone [https://github.com/YOUR-USERNAME/ResumeIQ.git](https://github.com/YOUR-USERNAME/ResumeIQ.git)
cd ResumeIQ
