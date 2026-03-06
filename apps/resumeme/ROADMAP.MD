# ResumeMe — Product Roadmap

> Features and enhancements to help job seekers build ATS-friendly resumes, get past automated screening, and land
> callbacks.

---

## ✅ Shipped

- **ATS Friendliness Score** — Real-time local scoring engine (0–100) with 8 categories, severity-rated tips, and a
  visual gauge in the builder sidebar. No AI APIs — runs entirely in the browser.
- **8 Professional Templates** — Classic, Modern, Lisbon, Executive, Minimal, Clean, Creative, Bold — all ATS-parseable.
- **Section Reordering** — Drag-and-drop to rearrange resume sections for maximum impact per role.
- **Guest Mode** — Try the builder instantly without signing up (locked identity, no save/export).
- **PDF Export** — Server-side Puppeteer rendering for pixel-perfect PDFs.
- **Plain Text Export** — ATS-safe `.txt` output for copy-paste into application forms.
- **Resume Sharing** — Public short-link with OG meta tags for quick sharing.
- **Application Dossier** — Organised folder of supporting documents per application.

---

## 🔜 Near-Term (Next 1–3 Months)

### ATS & Screening Optimisation

| #   | Feature                     | Problem it Solves                                                                                                                                               |
| --- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Job Description Matcher** | Paste a job posting → highlight missing keywords in your resume. Most ATS rank candidates by keyword overlap.                                                   |
| 2   | **Keyword Density Heatmap** | Visual overlay showing which sections are keyword-rich vs. thin, so you know exactly where to strengthen.                                                       |
| 3   | **Action Verb Checker**     | Flag weak bullet-point openers ("Responsible for…") and suggest strong action verbs ("Spearheaded", "Reduced", "Delivered").                                    |
| 4   | **Quantification Coach**    | Detect bullet points missing numbers/metrics and prompt with templates: "Increased **_ by _**% in \_\_\_ months."                                               |
| 5   | **ATS Simulation Preview**  | Render the resume as a plain-text parse tree — exactly what an ATS sees. Exposes formatting issues (tables, columns, headers inside images) that break parsing. |
| 6   | **Role-Tailored Tips**      | Select a target role (e.g. "Frontend Engineer", "Product Manager") and get tailored section order, keyword, and phrasing suggestions.                           |

### Resume Content

| #   | Feature                             | Problem it Solves                                                                                |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| 7   | **Multiple Summaries / Objectives** | Maintain several summaries tuned to different roles — swap in one click per application.         |
| 8   | **AI Summary Writer**               | Generate a first-draft summary from your work experience bullets (opt-in, AI-powered).           |
| 9   | **Highlight Suggestor**             | Given a job title + company, suggest relevant achievement bullets from your data bank.           |
| 10  | **Language & Tone Analyser**        | Detect passive voice, filler words, jargon, and overly long sentences. Suggest concise rewrites. |

### Builder UX

| #   | Feature                       | Problem it Solves                                                                                         |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| 11  | **One-Page Fit Indicator**    | Real-time page-count badge — warns when content overflows a single page (critical for most applications). |
| 12  | **Section Visibility Toggle** | Hide/show sections per resume without deleting data — easy A/B for different applications.                |
| 13  | **Undo / Redo**               | Track edit history so users can experiment freely.                                                        |
| 14  | **Auto-Save**                 | Periodic background save with conflict resolution — no more lost work.                                    |
| 15  | **Dark Mode Preview**         | Preview how the resume looks when printed (light) vs. on-screen (dark).                                   |

---

## 🛣️ Mid-Term (3–6 Months)

### ATS Deep Dive

| #   | Feature                            | Problem it Solves                                                                                                  |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 16  | **ATS Vendor Profiles**            | Different ATS (Workday, Greenhouse, Lever, Taleo, iCIMS) parse resumes differently. Show vendor-specific warnings. |
| 17  | **Parseable Date Validation**      | Ensure all dates are in standard ATS-friendly formats (Month YYYY or YYYY-MM). Flag ambiguous date entries.        |
| 18  | **Section Header Standardisation** | Warn when custom section names deviate from ATS-expected labels ("Professional Experience" vs. "My Journey").      |
| 19  | **File Format Advisor**            | Recommend PDF vs. DOCX based on the target ATS. Some ATS (e.g. older Taleo) parse DOCX better than PDF.            |
| 20  | **Hidden Character Detector**      | Scan for invisible Unicode characters, smart quotes, and non-standard dashes that break ATS parsing.               |

### Application Tracking

| #   | Feature                       | Problem it Solves                                                                                           |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 21  | **Application Tracker Board** | Kanban board: Applied → Screened → Interview → Offer → Rejected. Link each card to the resume version used. |
| 22  | **Follow-Up Reminders**       | Configurable reminders (3 days, 1 week, 2 weeks) to nudge follow-up emails after applying.                  |
| 23  | **Resume Version History**    | See exactly which version was sent to which company. Diff two versions side-by-side.                        |
| 24  | **Application Analytics**     | Track response rate per template, per resume variant, per role type. Data-driven iteration.                 |

### Content Library

| #   | Feature                        | Problem it Solves                                                                                                 |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 25  | **Achievement Vault**          | Dedicated bank of career achievements — tag by skill, role, and impact. Cherry-pick per application.              |
| 26  | **Pre-Written Bullet Library** | Searchable library of strong bullet points by industry/role. Start from proven templates instead of a blank page. |
| 27  | **Skills Taxonomy**            | Auto-map user skills to industry-standard taxonomies (O\*NET, LinkedIn Skills) for better ATS matching.           |
| 28  | **Import from LinkedIn**       | Parse LinkedIn profile PDF/JSON export to pre-populate resume data.                                               |

---

## 🔭 Long-Term (6–12 Months)

### Intelligence & Coaching

| #   | Feature                        | Problem it Solves                                                                                             |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 29  | **AI Resume Review**           | Full AI-powered review: tone, relevance, keyword gaps, formatting, length. Returns a prioritised action plan. |
| 30  | **Industry Benchmarking**      | Compare your resume's ATS score against anonymised averages for your target role/industry.                    |
| 31  | **Interview Prep from Resume** | Generate likely interview questions based on your resume content — "Tell me about reducing latency by 40%."   |
| 32  | **Career Trajectory Planner**  | Based on current experience, suggest realistic next roles and the skills gaps to address.                     |

### Cover Letters & Beyond

| #   | Feature                      | Problem it Solves                                                                         |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| 33  | **Cover Letter Builder**     | Templated cover letters that pull data from the resume and tailor to the job description. |
| 34  | **Thank-You Note Generator** | Post-interview thank-you email templates personalised to discussion points.               |
| 35  | **Reference Sheet Builder**  | Matching-styled reference page with contact details and relationship context.             |

### Distribution & Networking

| #   | Feature                | Problem it Solves                                                                                       |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| 36  | **Public Resume Page** | SEO-optimised personal page (yourname.resumeme.app) with OG tags — one link for all applications.       |
| 37  | **Email Resume**       | Send resume directly from the app with a professional cover email template.                             |
| 38  | **QR Code on Resume**  | Generate a QR code linking to your public page or portfolio — useful for print/networking events.       |
| 39  | **LinkedIn Optimiser** | Side-by-side comparison of resume vs. LinkedIn — flag discrepancies and suggest LinkedIn profile edits. |

### Platform & Ecosystem

| #   | Feature                      | Problem it Solves                                                                          |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| 40  | **Mobile Resume Editor**     | Responsive builder that works on tablets/phones for quick edits on the go.                 |
| 41  | **Offline Mode**             | Service worker caching — edit resumes without internet, sync when back online.             |
| 42  | **Team / Career Coach Mode** | Shared workspace where a coach or mentor can review and annotate resumes.                  |
| 43  | **API for Integrations**     | Public API so job boards, career services, and universities can integrate resume building. |
| 44  | **Accessibility Audit**      | Check resume templates for screen reader compatibility and colour contrast.                |
| 45  | **Multi-Language Resumes**   | Build the same resume in multiple languages, switch per application.                       |
| 46  | **DOCX Export**              | Native Word export for companies that require .docx uploads.                               |
| 47  | **Custom Branding**          | White-label the builder for universities, bootcamps, and career services.                  |

---

## 🎯 Guiding Principles

1. **ATS first** — Every template and export format must be machine-parseable. Pretty doesn't help if the ATS can't read
   it.
2. **Data stays yours** — Resume data is the user's. Export everything, import from anywhere, delete anytime.
3. **Local intelligence first** — Run scoring, keyword matching, and analysis in the browser where possible. Reserve AI
   APIs for opt-in generative features.
4. **One resume, many versions** — Maintain a single data bank; generate tailored versions per application.
5. **Measure what matters** — Track application outcomes, not vanity metrics. Help users iterate based on real callback
   rates.

---

_Last updated: March 2026_

---
