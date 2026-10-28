# Veyro Design System Specification (`design.md`)

**Document Version:** 2.4.0 (Refined & Qualified Specification, aligned with the built reference UI)  
**Phase:** Phase 4 — UI Design & Frontend Preparation  
**Step:** STEP-4.3: Design System Documentation & Refinement  
**Status:** APPROVED BASELINE (user approval 2026-10-18)  
**Author Role:** Senior Product Designer, Frontend Architect, and Technical Project Analyst  
**Date:** October 14, 2026  
**Primary Visual Source of Truth:** *Project Management Dashboard* by Abdur Rouf on Dribbble ([Live Shot](https://dribbble.com/shots/27041894-Project-Management-Dashboard))  
**Native Reference Asset:** Native $1600 \times 1240$ PNG ([Dribbble CDN Asset](https://cdn.dribbble.com/userupload/46584666/file/81c5138f0a3df0c49c1c43738131d598.png?resize=1600x1240&vertical=center))  
**Evidence Artifacts** *(generated locally during analysis; `scratch/` is not in this repository and can be regenerated from the Dribbble source above)*:  
- Full Image: [`scratch/reference_1600x1240.png`](file:///C:/Users/Mohand/.gemini/antigravity/brain/688e2ce4-7fa3-4009-803c-9d45988f3ec3/scratch/reference_1600x1240.png)  
- Regional HD Crops: `scratch/crops_hd/` (`sidebar.png`, `header.png`, `kpis.png`, `project_summary.png`, `overall_progress.png`, `today_tasks.png`, `workload.png`)  
- Pixel Geometry Scripts: `scratch/detailed_analysis.py`, `scratch/measure_corners.py`, `scratch/measure_radii_and_contrast.py`  
- Font Specimen: `scratch/veyro_typography_specimen.html`

---

## 1. Design Principles & Reference-Driven Direction

Veyro is a production-grade multi-tenant workspace and project management platform. The visual foundation adheres strictly to the **Reference-Driven UI Design Principle**:

1. **Faithful Visual Reproduction:** The Dribbble reference is our visual source of truth. We preserve its layout composition, measured spacing, card geometry, border radii, colors, typography relationships, navigation styling, pill capsules, badges, and spatial density.
2. **Coordinated Neutral Harmony (No Generic White Dashboards):** We reject clinical, stark-white SaaS templates. The reference achieves its distinct elegance through a warm, layered neutral palette: an obsidian navigation rail (`#060606` / `#121214`), a warm sand canvas (`#EBDFD7`), soft linen card surfaces (`#F2EAE5`), and crisp pure white interactive pill capsules (`#FFFFFF`) accented with terracotta (`#C2410C`).
3. **Adapt Content, Not the Visual Architecture:** We replace generic agency metrics (billables, client timesheets, external headcounts) with real Veyro workspace entities (projects, tasks, members, subscriptions, AI quotas) while keeping the visual layout and card structures intact.
4. **Extend Consistently:** All screens outside the single reference shot (Kanban board, slide-over task sheets, reopen dialogs, AI assistant drawer, billing console, audit stream) are designed as organic, seamless extensions of this exact visual language.
5. **Strict Architectural Separation:** Visual decisions (appearance), behavioral decisions (interaction), data contracts (API sources), and verification statuses are strictly delineated. Unsupported functionality is never simulated or implied to exist.

---

## 2. Layout Geometry, Measurements & Ratios

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             FULL REFERENCE FRAME (1600 x 1240 px)                                │
│  Outer Presentation Margin (#c9c8c7, ~56px)                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                     APP WINDOW CONTAINER (Measured: 1488 x 1128 px)                        │  │
│  │                     Outer Shell Radius: ~36-40px (rounded-[2.5rem])                        │  │
│  ├─────────────────┬──────────────────────────────────────────────────────────────────────────┤  │
│  │                 │ TOP HEADER (Height: ~80px): [<] [View Title]   [🔔 Mock] [Profile Pill] │  │
│  │                 ├──────────────────────────────────────────────────────────────────────────┤  │
│  │                 │ ROW 1: KPI ROW (4 Cards, Height: ~160px, Gap: ~20px)                     │  │
│  │                 │ [ Project Cap ]   [ Active Prj ]    [ Total Tasks ]    [ Daily AI Quota] │  │
│  │  OBSIDIAN       ├────────────────────────────────────────┬─────────────────────────────────┤  │
│  │  SIDEBAR RAIL   │ ROW 2: PROJECT SUMMARY TABLE (~58%)    │ DASHBOARD ANALYTICS SLOT (~34%) │  │
│  │  (#060606)      │ • Name, Members, Tasks, Status, Date   │ [Reserved Workspace Slot]       │  │
│  │  Width: 260px   ├────────────────────────────────────────┼─────────────────────────────────┤  │
│  │  (17.47% app)   │ ROW 3: TODAY TASKS QUICK-LIST (~58%)   │ WORKLOAD SLOT (~34%)            │  │
│  │  Radius: ~28px  │ [All] [Urgent] [High] [In Review]      │ [Reserved Team Workload Slot]   │  │
│  │  [Logo / Nav]   │ ✓ Completed Task (Terracotta Check)    │                                 │  │
│  │  [Pill CTAs]    │ ○ Pending Task (Thin Outline)          │ Gutter: ~40px (Canvas #ebdfd7)  │  │
│  └─────────────────┴────────────────────────────────────────┴─────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Measured Reference Dimensions vs. Engineering Specifications

All figures below are mathematically consistent and derived from programmatic image inspection:

| Structural Element | Measured Coordinates & Dimensions | Proportional Ratio | Production Token / Tailwind Class | Verification Basis |
| :--- | :--- | :--- | :--- | :--- |
| **Reference Asset** | $1600 \times 1240\text{px}$ | $100\%$ canvas | Asset canvas baseline | Verified file dimensions |
| **Presentation Backdrop**| $x: [0, 55], [1544, 1599]$<br/>$y: [0, 55], [1184, 1239]$ | $\approx 56\text{px}$ framing | `#C9C8C7` | Sampled border framing |
| **App Window Container** | $x: [56, 1543]$ (width: $1488\text{px}$)<br/>$y: [56, 1183]$ (height: $1128\text{px}$) | $93.00\% \times 90.97\%$ of asset | `max-w-[1488px] min-h-[1128px]` | Measured bounding box |
| **Window Corner Radius** | Curvature spans $\Delta x = \Delta y \approx 38\text{px}$ | N/A | `rounded-[2.5rem]` ($\approx 38\text{px}$) | Measured curve ($y=60\dots 94$) |
| **Sidebar Rail Width** | $x: [80, 339]$ (width: **$260\text{px}$**) | **$17.47\%$** of app container<br/>($16.25\%$ of full asset) | `w-[260px] shrink-0` | Measured dark column |
| **Sidebar Corner Radius**| Curvature spans $\Delta x = \Delta y \approx 28\text{px}$ | N/A | `rounded-[1.75rem]` ($\approx 28\text{px}$) | Measured curve ($y=81\dots 109$) |
| **Main Content Canvas** | $x: [340, 1520]$ (width: **$1180\text{px}$**) | **$79.30\%$** of app container<br/>($73.75\%$ of full asset) | `flex-1 min-w-0` | Measured area |
| **Container Padding Gap**| $x: [56, 79]$ and $x: [1521, 1543]$ | $\approx 24\text{px}$ each ($3.23\%$ total) | `p-6` shell inset | Outer window border margin |
| **KPI Cards (Row 1)** | 4 cards, each $\approx 265 \times 160\text{px}$ | $\approx 22.46\%$ width each | `grid-cols-4 gap-5` | Measured widths ($x \approx 370\dots 635, 655\dots 920$, etc.) |
| **Middle Tier Split** | Table: $680\text{px}$ / Gutter: $40\text{px}$ / Right: $400\text{px}$ | Table: **$57.63\%$** / Gutter: **$3.39\%$** / Right: **$33.90\%$** | `grid-cols-12` (Table: `col-span-7`, Right: `col-span-5`)| Measured at $y=520$ ($x: 370\dots 1050, 1050\dots 1090, 1090\dots 1490$) |
| **Bottom Tier Split** | Tasks: $680\text{px}$ / Gutter: $40\text{px}$ / Right: $400\text{px}$ | Tasks: **$57.63\%$** / Gutter: **$3.39\%$** / Right: **$33.90\%$** | `grid-cols-12` (Tasks: `col-span-7`, Right: `col-span-5`)| Measured at $y=950$ ($x: 370\dots 1050, 1050\dots 1090, 1090\dots 1490$) |
| **Card Corner Radius** | Transition curve $\approx 20\text{px} - 22\text{px}$ | N/A | `rounded-2xl` ($1.25\text{rem}$) | Measured card corner patch |

### 2.2. Responsive Viewport Adaptations
The reference depicts a single widescreen desktop viewport ($1600\text{px}$). For production fidelity across devices, the layout geometry adapts responsively:
- **Desktop ($\ge 1280\text{px}$):** Directly mirrors reference geometry ($260\text{px}$ fixed rail, 4-column KPI row, $58\% / 34\%$ asymmetric middle and bottom rows).
- **Tablet Landscape ($1024\text{px} - 1279\text{px}$):** Sidebar collapses to compact icon rail ($72\text{px}$); KPI row remains 4 columns; middle/bottom rows adjust to $60\% / 40\%$.
- **Tablet Portrait ($768\text{px} - 1023\text{px}$):** Sidebar transforms into slide-over drawer; KPI row reflows to 2x2 grid (`grid-cols-2`); middle and bottom rows stack vertically (`col-span-12`).
- **Mobile ($< 768\text{px}$):** Single column stream; KPI cards stack vertically or horizontal scroll snap; bottom navigation bar replaces sidebar.

---

## 3. Surface & Color System (Reference vs. Proposed Veyro)

### 3.1. Surface Hierarchy: The Warm Neutral Ladder

Direct pixel inspection reveals the reference's color hierarchy:
1. **Presentation Backdrop:** `#C9C8C7` (neutral framing canvas).
2. **Main App Canvas / Gutters:** `#EBDFD7` (warm muted sand/beige).
3. **Card Surfaces:** `#F2EAE5` (warm linen card fill).
4. **Interactive Controls & Capsule Pills:** `#FFFFFF` (pure white buttons, search pills, filter dropdowns, profile card).

```
┌────────────────────────────────────────────────────────────────────────┐
│ APP CANVAS (Gutters & Header Background): #EBDFD7                      │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ CARD SURFACE: #F2EAE5 (Measured Card Surface)                  │   │
│   │                                                                │   │
│   │   ┌───────────────────────────┐    ┌───────────────────────┐   │   │
│   │   │ WHITE PILL BUTTON #FFFFFF │    │ WHITE FILTER #FFFFFF  │   │   │
│   │   └───────────────────────────┘    └───────────────────────┘   │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

> **Why Pure White Cards Depart from the Reference:**  
> Changing all card backgrounds to pure white (`#FFFFFF`) washes out the dashboard, destroys the subtle tone-on-tone depth between canvas and cards, and flattens the visual hierarchy of the pure white capsule buttons. Mathematical verification confirms that primary text (`#18181B`) on the reference warm linen card (`#F2EAE5`) achieves **`14.91:1`** contrast—exceeding WCAG AAA ($7.0:1$). Therefore, Veyro adopts warm linen card surfaces (`#F4ECE7`) to match the reference faithfully.

### 3.2. Color Tokens Comparison & Verified WCAG 2.1 Contrast

All contrast ratios below are mathematically calculated using the official WCAG relative luminance formula:  
$L = 0.2126 \times R + 0.7152 \times G + 0.0722 \times B$, with contrast ratio $(L_1 + 0.05) / (L_2 + 0.05)$.

| Token Name | Sampled Reference Value | Proposed Veyro Production Token | Verified Contrast Ratio | WCAG Compliance Level & Application |
| :--- | :--- | :--- | :--- | :--- |
| `canvas-backdrop` | `#C9C8C7` | `#C9C8C7` *(Slate Sand)* | N/A | Outer presentation framing backdrop. |
| `canvas-main` | `#EBDFD7` | `#EDE5DE` *(Warm Linen Canvas)* | N/A | Gutter background between cards and behind top header. |
| `surface-card` | `#F2EAE5` | `#F4ECE7` *(Soft Linen Card)* | **14.91:1** (against text #18181B) | Primary card surfaces (KPIs, Table, Kanban, Today tasks). |
| `surface-subtle` | `#EADED6` | `#EAE0D8` *(Muted Beige)* | N/A | Secondary sub-panels, table header rows, inactive tabs. |
| `surface-pill` | `#FFFFFF` | `#FFFFFF` *(Pure White)* | **16.89:1** (against text #18181B) | Capsule buttons, filter dropdowns, search pills, avatar card. |
| `sidebar-bg` | `#060606` | `#121214` *(Obsidian Charcoal)* | High | Navigation rail. True black softened to prevent OLED fringing. |
| `accent-terracotta`| `#E65F2B` | `#C2410C` *(Terracotta 700)* | **5.18:1** (on white #FFFFFF)<br/>**4.36:1** (on card #F4ECE7) | Primary brand CTA, plus button, completed checkmark. Calibrated from sampled `#E65F2B` ($3.48:1$, failing AA normal text) to pass WCAG AA. |
| `accent-terracotta-text`| N/A | `#9A3412` *(Terracotta 800)* | **6.15:1** (on card #F4ECE7) | Dedicated token for small/regular terracotta text rendered directly on linen card surfaces. |
| `accent-blue` | `#194FE6` | `#2563EB` *(Electric Blue)* | **5.45:1** (on white #FFFFFF) | Active indicator underline bar on Today Tasks tabs (`Urgent`). |
| `text-primary` | `#111111` | `#18181B` *(Zinc 900)* | **14.91:1** (on card)<br/>**13.56:1** (on canvas) | **Normal Text:** Primary headings, KPI values, project names. Exceeds WCAG AAA ($7.0:1$). |
| `text-secondary` | `#777777` | `#52525B` *(Zinc 600)* | **6.14:1** (on card)<br/>**5.58:1** (on canvas) | **Normal Text:** Calibrated from sampled `#777777` ($3.77:1$, failing AA normal text) to Zinc 600 to satisfy WCAG AA ($>4.5:1$). |
| `text-muted` | `#999999` | `#71717A` *(Zinc 500)* | **4.07:1** (on card)<br/>**3.70:1** (on canvas) | **Large Text / Subtitles ($\ge 18$pt / $\ge 14$pt bold):** Satisfies WCAG AA Large ($\ge 3.0:1$). Timestamps, breadcrumbs. |
| `border-subtle` | `#E5DED8` | `#E2D7CE` *(Linen Border)* | N/A | Table row divider lines and nested card outlines. |

### 3.3. Semantic Status Badges (WCAG 2.1 AA Calibrated)

Mathematical verification reveals that the sampled reference badge text colors failed WCAG AA ($2.40:1$ to $2.98:1$). Veyro calibrates the foreground text values to achieve accessible contrast while preserving the soft pastel background aesthetic:

| Semantic Status | Sampled Reference (Bg / Text) | Sampled Contrast | Veyro Production Token (Bg / Text) | Verified Contrast | Mapped Veyro Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Success** | `bg: #cbdac4`, `text: #229435` | 2.68:1 ❌ | `bg: #DCFCE7`, `text: #15803D` *(Green 700)* | **4.57:1** ✅ PASS AA | Task `DONE`, Task `Approved`, Project `ACTIVE` |
| **Warning** | `bg: #f5e6b8`, `text: #c48b18` | 2.40:1 ❌ | `bg: #FEF3C7`, `text: #B45309` *(Amber 700)* | **4.51:1** ✅ PASS AA | Task `IN_REVIEW`, Project `ARCHIVED` |
| **Danger** | `bg: #f1c6c1`, `text: #d93834` | 2.98:1 ❌ | `bg: #FEE2E2`, `text: #B91C1C` *(Red 700)* | **5.30:1** ✅ PASS AA | Task `CANCELLED`, Account `PAST_DUE` |
| **Ongoing** | `bg: #f0d1c4`, `text: #d45928` | 2.78:1 ❌ | `bg: #FFEDD5`, `text: #C2410C` *(Orange 700)*| **4.52:1** ✅ PASS AA | Task `IN_PROGRESS`, Project `READ_ONLY` |

### 3.4. Non-Text UI Indicators & Boundaries (WCAG SC 1.4.11)
- **Card Boundaries against Canvas:** Contrast between Card Surface (`#F4ECE7`) and Canvas (`#EDE5DE`) is `1.10:1`. Per WCAG 2.1 SC 1.4.11, low contrast on card containers is permissible because container boundaries are not the sole indicator of clickable functionality. Visual grouping is achieved by spacing and subtle ambient elevation (`rgba(120, 90, 70, 0.05)`).
- **Interactive Controls (Capsule Pills & Dropdowns):** Contrast between White Pills (`#FFFFFF`) and Card (`#F4ECE7`) is `1.15:1`. To ensure accessibility for low-vision users, interactive controls feature a subtle border (`border border-[#E2D7CE]`) and mandatory high-visibility keyboard focus rings:  
  `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#C2410C]`.

---

## 4. Typography System (Provisional Stack & Qualified Claims)

### 4.1. Provisional Font Stack Status
The font stack remains **provisionally approved** and will be visually evaluated during Phase 4 Step 4 mockups. No font files or npm dependencies are installed during Step 3.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             PROVISIONALLY APPROVED FONT STACK                                    │
├──────────────────────────┬──────────────────────────┬────────────────────────────────────────────┤
│ Language / Role          │ Selected Font Family     │ License & Provenance                       │
├──────────────────────────┼──────────────────────────┼────────────────────────────────────────────┤
│ **Arabic Headings**      │ `Cairo`                  │ SIL Open Font License 1.1 (Google Fonts)   │
│ **Arabic Body & Data**   │ `IBM Plex Sans Arabic`   │ SIL Open Font License 1.1 (Google Fonts)   │
│ **English Headings & UI**│ `Plus Jakarta Sans`      │ SIL Open Font License 1.1 (Google Fonts)   │
└──────────────────────────┴──────────────────────────┴────────────────────────────────────────────┘
```

### 4.2. Qualified Typographic Claims & Verification Requirements

1. **Correction of x-Height & Vertical Metric Claims:**
   - *Previous Unverified Claim:* Earlier drafts asserted that `IBM Plex Sans Arabic` and `Plus Jakarta Sans` share a "matching x-height of 52% of cap-height."
   - *Correction:* In Arabic typography, the Latin concept of an "x-height" does not strictly apply because Arabic lacks a uniform lowercase waistline (it is characterized by medial tooth heights, loop heights, and distinct ascending/descending strokes).
   - *Qualified Stance:* While both are contemporary sans-serif typefaces with upright vertical strokes, their actual vertical metrics (ascent, descent, line gap, and baseline alignment) when mixed inline **have not yet been rendered or visually verified in the browser**.
   - *Requirement:* Baseline alignment and mixed-script readability (e.g. an English task code `[TASK-101]` inside an Arabic sentence) must be verified visually during Phase 4 Step 4 mockups.

2. **Intended Weights & Fallback Behavior:**
   - **`Cairo`:** Intended for headings in `600` (SemiBold) and `700` (Bold).  
     *Fallback:* `'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif`.
   - **`IBM Plex Sans Arabic`:** Intended for body, tables, and task lists in `400` (Regular) and `500` (Medium).  
     *Fallback:* `'IBM Plex Sans Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif`.
   - **`Plus Jakarta Sans`:** Intended for English headings and body in `400` (Regular), `500` (Medium), `600` (SemiBold), and `700` (Bold).  
     *Fallback:* `'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif`.

3. **Tabular Numerals & Metric Display:**
   - `IBM Plex Sans Arabic` includes OpenType `tnum` support, which is intended to ensure vertical alignment of figures in data tables.
   - Metric figures on KPI cards use Western Arabic numerals (`0, 1, 2, 3...`) across both English and Arabic views to maintain universal visual parity with the reference cards.

### 4.3. Typographic Scale & Hierarchy

| Role | Font Family | Size (px / rem) | Weight | Line Height | Tracking | Application |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Display / KPI** | Jakarta / Cairo | `32px` / `2.0rem` | `700` Bold | `1.2` | `-0.02em` | Metric card headline values |
| **Page Header (H1)**| Cairo / Jakarta | `24px` / `1.5rem` | `700` Bold | `1.3` | `-0.01em` | Top header view title |
| **Card Header (H2)**| Cairo / Jakarta | `18px` / `1.125rem`| `600` SemiBold| `1.4` | `0` | Section headers (`Project summary`, `Today task`) |
| **Body (Default)** | IBM Plex / Jakarta| `14px` / `0.875rem`| `400` Regular | `1.5` | `0` | Table cell data, task titles, descriptions |
| **Body (Medium)** | IBM Plex / Jakarta| `14px` / `0.875rem`| `500` Medium  | `1.5` | `0` | Assigned member names, active menu items |
| **Caption / Sub** | IBM Plex / Jakarta| `12px` / `0.75rem` | `400` Regular | `1.4` | `+0.01em` | Timestamps, denominators, subtitle labels |
| **Badge / Pill Tag**| Jakarta / Cairo | `11px` / `0.6875rem`| `600` SemiBold| `1.0` | `+0.02em` | Status badges (`Active`, `In Review`, `Done`) |

---

## 5. Component Specifications (Visual, Behavioral & Data Contracts)

To preserve architectural integrity, every component specification explicitly separates:
- **Visual Decision:** Geometric styling, colors, and layout.
- **Behavioral Decision:** Interactive state transitions and click handling.
- **Data Contract:** Exact NestJS endpoint and Prisma models supplying data.
- **Verification Status:** Current factual state of backend contract.
- **Deferred / Mock Elements:** Explicit limitations to prevent simulated functionality.

---

### 5.1. Sidebar Navigation Rail (`COMP-NAV-01`)

- **Visual Decision:** Solid `#121214` obsidian rail with rounded top-left corner ($\approx 28\text{px}$ radius). Width: $260\text{px}$. Top brand section houses terracotta sunburst logo and white `"Veyro"` wordmark. Prominent `"Create new project"` pill CTA ($44\text{px}$ height) with white fill and inset terracotta circular `+` button. Navigation links use soft white icons and text; active route displays a full-width white capsule pill (`#FFFFFF`) with terracotta icon and text. Bottom section pins a circular terracotta help button (`?`).
- **Behavioral Decision:** Clicking navigation links triggers Next.js client-side navigation. Clicking `"Create new project"` opens modal `SCR-PRJ-02`. Clicking `?` opens the AI Assistant drawer in Mode A (Knowledge).
- **Data Contract:** Client session state (`UserSessionDto` from NextAuth/JWT).
- **Verification Status:** **`[Confirmed Existing Functionality]`**
- **Deferred Elements:** None.

---

### 5.2. Top Application Header Bar (`COMP-HDR-01`)

- **Visual Decision:** Fluid header row ($80\text{px}$ height) over canvas `#EDE5DE`. Left contains circular white pill (`#FFFFFF`, $40\text{px}$) with chevron `<` toggle, followed by bold view title ($24\text{px}$, `#18181B`). Right cluster contains white circular pill button with outline bell (`🔔`), and white user profile capsule ($44\text{px}$ height) with circular avatar photo, user name ($14\text{px}$ bold), and role badge ($12\text{px}$ gray).
- **Behavioral Decision:** Clicking `<` toggles sidebar collapse. Clicking user profile opens account dropdown menu (`/account/profile`, `/auth/logout`).
- **Data Contract:** Current user profile (`GET /api/v1/auth/me`).
- **Verification Status:** **`[Confirmed Existing Functionality]`**
- **Deferred / Mock Elements:**
  - **Notification Bell (`🔔`):** Explicitly designated as **`[Approved Mock UI / Future Feature — Not Functional]`**. Renders visually for reference balance; clicking produces no network request and displays no unread notification counts in MVP.
  - **Global Search:** Explicitly designated as **`[Deferred Functionality]`** / Omitted in MVP. No search input is rendered in the header.

---

### 5.3. Overview KPI Cards (`COMP-KPI-01` — Row 1)

- **Visual Decision:** 4 equal horizontal cards (`grid-cols-4`, gap $20\text{px}$). Surfaces use soft linen `#F4ECE7` with $\approx 20\text{px}$ radius and ambient shadow (`rgba(120, 90, 70, 0.05)`). Each card features a top-left circular pastel icon badge ($36\text{px}$), a bold headline value ($32\text{px}$ bold `#18181B`), and a subtitle description ($12\text{px}$ `#52525B`).
- **Behavioral Decision:** Cards are non-clickable overview surfaces displaying live metrics.
- **Card-by-Card Contracts & Role-Adaptive Scoping:**

#### Card 1: Project Capacity / Total Workspace Projects
- **Visual Form:** Purple circular icon badge with bar chart icon. Displays headline ratio e.g. `2 / 3 Projects` (or single integer `8 Projects`).
- **Role Scoping & Data Contracts:**
  - *Account Owner Variant:* Displays **Account Project Capacity** (`currentProjects / maxProjects`, e.g. `2 / 3 Projects`).  
    *Data Source:* `GET /api/v1/accounts/:id/subscription` (guarded by `AccountOwnerGuard`).  
    *Meaning:* Shows total active projects across all workspaces against subscription limit.
  - *Non-Owner Variant (Admins, Members):* Displays **Total Workspace Projects** (`_count.projects`, e.g. `5 Projects`).  
    *Data Source:* `GET /api/v1/workspaces/:id` (accessible to all workspace members).  
    *Meaning:* Shows total projects in current active workspace, avoiding `403 Forbidden` errors.
  - *Loading / Error State:* Displays skeleton shimmer ($32\text{px} \times 120\text{px}$) during loading; if subscription request fails, falls back gracefully to workspace project count.
- **Verification Status:** **`[Confirmed Existing Functionality (Role-Adaptive)]`**

#### Card 2: Active Projects
- **Visual Form:** Terracotta circular icon badge with briefcase icon.
- **Data Contract:** Count of projects where `lifecycleStatus === 'ACTIVE'` from `GET /api/v1/workspaces/:workspaceId/projects`.
- **Verification Status:** **`[Confirmed Existing Functionality]`**

#### Card 3: Total Tasks Tracked
- **Visual Form:** Blue circular icon badge with clock icon.
- **Data Contract:** Sum of `_count.tasks` across returned projects from `GET /api/v1/workspaces/:workspaceId/projects`.
- **Verification Status:** **`[Confirmed Existing Functionality]`**

#### Card 4: Personal Daily AI Quota
- **Visual Form:** Gold circular icon badge with user/sparkle icon. Displays `messagesUsed / dailyQuota` (e.g. `2 / 3 Messages`) with countdown timer to 00:00 UTC reset.
- **Data Contract:** `GET /api/v1/ai/conversations` (returns quota object from `AiService`).
- **Verification Status:** **`[Confirmed Existing Functionality]`**

---

### 5.4. Project Summary Table (`COMP-TBL-01` — Middle Tier, ~58% Width)

- **Visual Decision:** Soft linen card (`#F4ECE7`, $20\text{px}$ radius) occupying the left column of Row 2 ($680\text{px}$ width). Top header contains bold title `"Project summary"` ($18\text{px}$) and right-aligned white filter pills (`Project v`, `Status v`). Data table rows use linen borders (`#E2D7CE`). Columns:
  1. `Name`: Bold project name ($14\text{px}$ `#18181B`).
  2. `Assigned Members`: Stacked circular avatar rings ($28\text{px}$).
  3. `Tasks`: Number of tasks with small donut ring icon.
  4. `Status`: Semantic pastel status pill (`Active`, `Archived`, `Read-Only`).
  5. `Created Date`: Formatted date string ($12\text{px}$ `#52525B`).
- **Behavioral Decision:** Clicking a project row navigates to the Project Kanban Board (`/workspaces/:workspaceId/projects/:projectId`). Clicking filter pills toggles client-side status filter.
- **Data Contract:** `GET /api/v1/workspaces/:workspaceId/projects` (returns `Project[]` with `_count.members`, `_count.tasks`, `lifecycleStatus`, `createdAt`).
- **Verification Status:** **`[Confirmed Existing Functionality]`**
- **Deferred Elements:** None.

---

### 5.5. My Tasks Quick-List (`COMP-TSK-01` — Bottom Tier, ~58% Width)

> **CS-01 update:** the card is titled **"My tasks"** and its single data source is `GET /api/v1/workspaces/:workspaceId/dashboard` (`myTasks` ≤ 10, `myDueToday`, `completedThisWeek` from `Task.completedAt`). The per-project `listProjectTasks` calls described below are superseded for this card; the checkbox still dispatches `PATCH /api/v1/tasks/:id`.

- **Visual Decision:** Soft linen card (`#F4ECE7`, $20\text{px}$ radius) occupying the left column of Row 3 ($680\text{px}$ width). Top header contains bold title `"Today task"` ($18\text{px}$) and horizontal category tabs: `All`, `Urgent`, `High`, `In Review`. Active tab (`Urgent`) is styled with an Electric Blue underline indicator bar (`#2563EB`, $3\text{px}$ height). Task list items contain:
  1. Circular checkbox control ($20\text{px}$). Completed tasks render a terracotta filled circle with white checkmark (`✓`); pending tasks render a thin circular outline.
  2. Task title ($14\text{px}$ `#18181B`).
  3. Priority / status pill (`Approved`, `In Review`, `In Progress`, `To Do`).
- **Behavioral Decision:** Clicking a checkbox immediately triggers `PATCH /api/v1/tasks/:id` with optimistic UI update. Clicking task title opens the Task Detail page (`SCR-TSK-01`). Clicking tabs filters list in-memory.
- **Data Contract:** `GET /api/v1/projects/:projectId/tasks` (filtered by assignee `currentUserId`).
- **Verification Status:** **`[Confirmed Existing Functionality]`**
- **Deferred Elements:** None.

---

### 5.6. Dashboard Right-Side Cards: Overall Progress Gauge & Team Workload (`COMP-GAU-02`, `COMP-WLD-01`)

> **Revision (CS-01, 2026-10-17):** This section previously relocated the gauge to the Kanban page and deferred the workload chart because no workspace-wide aggregate existed. Change set CS-01 (ADR-001, `docs/08`) added `GET /api/v1/workspaces/:workspaceId/dashboard`, so both cards are now **supported and part of the dashboard**. The "Reserved / Deferred" slots are removed.

The reference features two visual cards on the right side of the dashboard, and Veyro now renders both with real data:

```
┌───────────────────────────────────────────────┬──────────────────────────────────────────────┐
│ LEFT COLUMN (~58% Width)                      │ RIGHT COLUMN (~34% Width)                    │
├───────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ PROJECT SUMMARY DATA TABLE                    │ OVERALL PROGRESS GAUGE (COMP-GAU-02)         │
│ • Project key, members, tasks, status, date   │ • Semicircle %, 4 status counters            │
│ • Search + status + project filters           │ • Cancelled tasks are not counted            │
├───────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ MY TASKS QUICK-LIST                           │ TEAM WORKLOAD (COMP-WLD-01) — Owner/Admin    │
│ • Tabs, due-today first, completed-this-week  │ • Bead stack per member (top 3 + others)    │
└───────────────────────────────────────────────┴──────────────────────────────────────────────┘
```

- **Overall Progress Gauge (`COMP-GAU-02`):** Semicircular dial aggregated over all active projects of the workspace (`projects[].tasks` status counts, `CANCELLED` excluded). It shows `Done / (Todo + In progress + In review + Done)` as a percentage with four counters. The per-project gauge on the Kanban page (`COMP-GAU-01`, section 5.7) remains and uses the same visual language.
- **Team Workload (`COMP-WLD-01`):** Bead-stack chart of open tasks per member from `workload[]`. **Visible to Owner and Admin only;** for Members the API returns `workload = null` and the card is not rendered (no empty placeholder, the grid collapses).
- **Role-aware notices:** `notices[]` and `capacity` render as a top banner (plan limit reached, payment failed with grace period, subscription past due, downgraded to read-only). Members never receive them.
- **Data Contract:** one request, `GET /api/v1/workspaces/:workspaceId/dashboard` (`docs/06 §2.3.1`). The table, KPIs, gauge, workload and my-tasks all read from this response. Unknown workspace returns `404`, non-member returns `403`.
- **Verification Status:** **`[Confirmed Existing Functionality — CS-01]`** (backed by `backend/test/cs01-dashboard.spec.ts`).

#### Other dashboard decisions introduced by CS-01
- **Project key:** every project has an optional-on-create, auto-generated 2 to 5 character uppercase label (`Project.key`, unique per workspace, e.g. `WEB`). It is a display label only, shown beside the project name and in the invitation project picker. It is not part of any URL.
- **"Completed this week":** computed from the new `Task.completedAt` timestamp, not from `updatedAt`.
- **Workspace switcher:** the sidebar workspace button opens a listbox popover of the user's workspaces (keyboard accessible, `aria-expanded`).
- **Owner role:** a third role in the prototype switcher. The Owner additionally sees the Billing navigation item and billing notices. Admin sees management actions. Member sees a read-only subset.
- **Notifications bell:** stays a visual placeholder that opens a popover labelled **Future feature**. No endpoint, no unread counter.

> **Trade-Off Analysis:** The earlier Option A (reserved cards) and Option B (full-width table) are both superseded. Because the data now exists, the dashboard keeps the reference's asymmetric composition with real content and no placeholders.

---

### 5.7. Project Kanban Board & Semicircular Completion Gauge (`COMP-KAN-01`, `COMP-GAU-01`)

- **Visual Decision:**
  - **Semicircular Speedometer Gauge (`COMP-GAU-01`):** Visually positioned in the project header bar on `SCR-PRJ-01` (Kanban page). Displays a 180-degree semicircular dial, radial tick markers (`0`, `25`, `50`, `100`), segmented colored arc (green for Done, amber for In Review, terracotta for In Progress, gray for Todo), prominent center percentage (`"72%"`), and 4 counter metrics below.
  - **Kanban Columns (`COMP-KAN-01`):** 4 active columns (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`) plus collapsible `CANCELLED`. Task cards are `#FFFFFF` pills with $14\text{px}$ radius, priority pill, due date chip, and assignee avatar.
- **Behavioral Decision:** Drag-and-drop moves cards between columns, dispatching `PATCH /api/v1/tasks/:id` with new status. Dragging a card out of `DONE` or `CANCELLED` intercepts the drop and displays the Task Reopen Reason Dialog (`SCR-TSK-02`).
- **Data Contract:** `GET /api/v1/projects/:projectId/tasks` (paginated, default limit 20, max limit 100 via `QueryTasksDto`).
- **Verification Status:**
  - Kanban Board: **`[Confirmed Existing Functionality]`**
  - Per-project Completion Gauge: **`[Confirmed Existing Functionality — CS-04]`**  
    *Resolved:* `GET /projects/:id` returns database-side `taskCounts` (non-deleted tasks, `cancelled` reported but excluded from progress), so the gauge is exact for any project size and no longer depends on a 100-row task page.
- **Deferred Elements:** None.

---

### 5.8. AI Assistant Drawer & Standalone View (`COMP-AI-01`, `COMP-AI-02`)

- **Visual Decision:** Slide-over right drawer ($440\text{px}$ width) with obsidian header matching sidebar. Main chat canvas uses warm linen `#F4ECE7`. Chat bubbles: User messages are white pills with terracotta accents; Assistant messages are soft cream surfaces. Includes structured citation pills (`[TASK-101]`) and embedded Action Confirmation Cards (`SCR-AI-02`).
- **Behavioral Decision:** Single active conversation model without a history sidebar. The API answers in one piece, so a typing indicator replaces streaming. Action proposals display inline "Confirm" / "Reject" buttons on a card that names the target project; confirming and rejecting cost no message.
- **Data Contract:** `GET /api/v1/ai/conversations` (retrieves active session), `POST /api/v1/ai/conversations` (creates session lazily on the first send), `GET /api/v1/ai/conversations/:id/messages`, `POST /api/v1/ai/conversations/:id/messages` (with `Idempotency-Key`), `POST /api/v1/ai/proposals/:id/confirm` and `/reject` (`CS-06`).
- **Verification Status:** **`[Confirmed Existing Functionality]`** (Single active canvas restored across page refresh).
- **Deferred Elements:** Conversation history archive sidebar is deferred.

### 5.9. Projects and My Tasks Pages (`COMP-PRJ-01`, `COMP-TSK-02`)

- **Projects (`/w/.../projects`):** toolbar (search by name or key, Active / Archived / Deleted tabs, plan usage chip for admins) over a table with key chip, member stack, progress bar, creator and status. A row menu is driven by `viewer.*` flags from the API: Open board, Project settings (project admin and above), Archive / Unarchive and Delete (workspace admin and owner only). The Deleted tab offers Restore, which can answer `409` at the plan limit. Settings dialog: name and description, immutable key, lifecycle actions behind a confirm step, illustrated lifecycle panel.
- **My tasks (`/w/.../my-tasks`):** the caller's assigned tasks across projects, grouped Overdue / Today / Upcoming / No date with stable count chips, Open / Done tabs, project filter and paging. A read-only project is marked on its rows.
- **Data Contracts:** `GET /workspaces/:id/projects?q&status&deleted`, `POST /projects/:id/restore`, `GET /workspaces/:id/my-tasks` (`CS-08`). **Status:** `[Confirmed Existing Functionality — CS-08]`.

### 5.10. Account Billing, Account Audit and Access States (`COMP-BIL-01`, `COMP-AUD-02`, `COMP-STA-01`)

- **Billing (`/account/billing`, Account Owner only):** plan card with project and workspace usage bars, plan comparison (limits only; prices are TBD and payment actions read "when billing launches"), billing history, and a danger zone. Banners: payment failed with the 7-day grace countdown, grace ended, choose projects, deletion in progress. Choose-projects dialog enforces the plan cap with a live slot illustration; the delete dialog needs the typed account slug and the password.
- **Account audit (`/account/audit`):** the account-level trail only (plan, billing, project choices, workspaces, deletion), owner only, same table language as the workspace audit.
- **Access states:** `403` (owner-only areas and other tenants' workspaces) and `404` are full states inside the application shell, each with its own illustration. The API answers `404`, never `403`, for projects the caller cannot see.
- **Data Contracts:** `GET /accounts/:id/subscription`, `/billing-events`, `/projects`, `POST /accounts/:id/select-active-projects`, `POST /accounts/:id/offboard`, `GET /audit-logs?accountId=` (`CS-07`). **Status:** `[Confirmed Existing Functionality — CS-07]`.

### 5.11. Illustrated Surfaces and Prototype Controls

- **Illustrated surfaces:** every non-input area (dialog side panels, auth panels, the assistant page, empty and first-run states, 403 and 404) is composed from the shared kit `screens/shared/illustration.css` with a new scene per screen; dense working surfaces (tables, boards, charts, forms) never use it. Dark mode, RTL and `prefers-reduced-motion` are required.
- **Prototype role switcher:** Owner, Admin, Project admin and Member is one shared setting for every reference screen (`veyro-proto-role`), with one persona per role (Owner = Mohand, Admin = Sarah, Project admin = Maya, Member = Leo). It is scaffolding and is replaced by the session in the real app.

### 5.12. Account Menu and Profile (`COMP-ACC-01`, `COMP-PRF-01`)

- **Account menu:** the header account button opens a popover (name, email, role, Profile, Sign out) on every app screen; on phones the same two actions sit at the bottom of the navigation drawer. Keyboard: opens with focus on the first item, arrows move, Escape closes and returns focus.
- **Profile (`/account/profile`):** a hero card with avatar and name on the left and an illustration on the right (same pattern as the audit trail hero), then two columns: details and password, and footprint and preferences. The footprint block (workspaces, projects, open tasks, personal AI plan; the account plan appears only for the account owner), profile details (name editable, email read-only), preferences and password change.
- **Preferences:** language (English / Arabic) and theme (Light / Dark / System) save immediately, are stored on the account and remembered on the device, and apply on every screen including sign-in and marketing. System follows the OS and switches with it.
- **Password:** current, new (strength hint) and confirm; success tells how many other devices were signed out.
- **Data Contracts:** `GET /users/me/profile`, `PATCH /users/me`, `POST /auth/change-password` (`CS-09`). Photo upload (`POST /users/me/avatar`) is deferred to the storage step. **Status:** `[Confirmed Existing Functionality — CS-09]`.

**Rule: orange fills carry light content.** Any element filled with the brand orange (buttons, round icon buttons, chips, avatars) uses white text and white icons, in light and dark mode and also when it is an anchor (`.app a` must not override it).

### 5.14. Surface Palettes and the Parity Gate

- **Two palettes, not one:** the application screens use the dashboard roles (page `#EBDFD7`, cards `#F4ECE7`). The auth and marketing screens use their own cream set (page `#FAF6F0`, white fields, field border 28% ink, links in ink or `#9A3412`, status `#15803D` / `#B91C1C`). A screen takes the palette of its reference page.
- **Parity Gate:** a Next.js screen is finished only when `frontend/scripts/parity/` reports no unexplained difference from its reference page (text, computed styles, layout offsets) at 1440px and 390px, light and dark, English and Arabic. The auth screens are the first to pass it (their CSS is ported verbatim into `frontend/src/components/auth/`).

### 5.15. Application Shell in Next.js (`COMP-SHL-01`)

- **One layout for every signed-in page** (`frontend/src/components/shell/`): sidebar, top bar, bottom dock, workspace switcher, account menu and the notifications popover, ported verbatim from the reference (`shell.css`, same class names).
- **Data:** `GET /auth/me` and `GET /workspaces` (role and `isAccountOwner` per workspace). The menu shows items by role (members four; admins add Audit trail and Members & settings; only the account owner sees Billing). This is convenience only, the backend enforces access.
- **Routes:** `/w/[workspaceSlug]` (workspace slugs are globally unique). `/dashboard` forwards to the last used workspace. Items whose screens are not built yet show a "built in a later step" notice instead of a dead link.
- **States:** loading, load failure with retry, no workspace, unknown workspace, expired session (back to sign-in and return).
- **Verified with the Parity Gate:** 42 shell states (3 roles, EN/AR, light/dark, 1440 / 1100 rail / 390 drawer and dock, popovers) match the reference except test data (the invented email in the account menu).

---

### 5.16. Onboarding and Invitations in Next.js (`SCR-ONBD-01`, `SCR-INVT-01`)

- **Onboarding (`/onboarding`):** three choice cards (create a workspace, join with an invitation, ask the knowledge assistant) and the matching panel. Creating calls `POST /onboarding/atomic` (409 slug conflicts show the reference message). People who already have a workspace are sent to the app; people without one are sent here from `/dashboard` and from the shell.
- **Invitation (`/invitations/accept?token=`):** valid, accepted, expired or revoked, wrong account, and not found states from the new read-only `GET /invitations/preview` (CS-11, `docs/19`). Signed-out visitors go through sign-in and return; `?next=` is carried through login, register and verify.
- **Parity:** 27 states at 1440 and 390 (EN/AR, light/dark) match the reference except demo content (the fixed "in 5 days", the invented email).

---

### 5.17. Workspace Dashboard in Next.js (`SCR-WKSP-01`)

- **Route and data:** `/w/[workspaceSlug]`, one request: `GET /workspaces/:id/dashboard` (plus `GET /ai/quota` for the fourth KPI). Admin-only blocks arrive as `null` for members and are simply not rendered. Search in the top bar filters the project table and My tasks in memory.
- **Same markup as the reference:** KPI cards, project summary (status filter, avatars, progress rings), progress gauge (project filter), My tasks (tabs), team workload (admins) or the illustrated "Your workload" card (members), billing and plan-limit banners, and the first-project empty state. The prototype toolbar (role and scenario switchers) is reference-only and not built.
- **Task checkbox:** stays the decorative circle of the reference. The backend state machine does not allow TODO to DONE in one step (BR-TSK-01), so a one-click "complete" would be wrong; changing a task's status belongs to the task page, a later step. Task titles and project rows get their links when those pages exist.
- **Arabic:** the KPI sub-lines are translated (the reference leaves them in English).
- **Verified with the Parity Gate:** owner, admin and member across full, empty, limit, grace, past-due and downgraded states at 1440 and 390 (EN/AR, light/dark). Only data-driven differences remain: avatar colours (ids), workload bar heights and order (backend sorts by open tasks), and the translated sub-lines.

---

### 5.18. Projects and My Tasks in Next.js (`SCR-PRJ-04`, `SCR-TSK-04`)

- **Routes and data:** `/w/[workspaceSlug]/projects` reads `GET /workspaces/:id/projects` (search and the Active / Archived / Deleted tabs run on the server); `/w/[workspaceSlug]/my-tasks` reads `GET /workspaces/:id/my-tasks` (view, due bucket, project, page; eight rows per page like the reference). Admins also read the dashboard capacity for the "N of M projects used" chip.
- **Backend (CS-12, additive):** the project list now carries `members` (first four, for the avatar stack) and my-tasks `counts.projects` (for "N open tasks across M projects"). Covered in `backend/test/cs08-projects-and-my-tasks.spec.ts`; contract in `docs/06`.
- **Read-only for now:** the row menu shows what the viewer's `viewer.*` capabilities allow, but settings, archive, delete, restore, "Open board" and task rows explain themselves ("built in a later step") until those dialogs and pages exist.
- **Top-bar search:** only the dashboard has it, as in the reference; the lists have their own search.
- **Differences from the reference, on purpose:** proper plurals ("1 member"); the deleted-project pill is styled (the reference's pill had no style because its page never loaded the rule); Arabic uses the dual form where Arabic needs it.
- **Verified with the Parity Gate:** owner, admin and member on full, plan-limit and empty states, with the archived, deleted, no-match, row-menu, error and pager states, at 1440 and 390 (EN/AR, light/dark). Only data differences remain (avatar colours, task titles, digit counts).

---

### 5.19. Loading Scene (`COMP-LDR-01`)

- **Idea:** a clerk files project folders into a pigeonhole shelf (the workspace being assembled). Folders fly in from the inbox tray one after another and make room for the next, so the shelf is always filling. Built from the illustration kit (peach grid ground, ink-outlined cards, flat character, dotted links, floating chips) with a new scene, per the illustrated-surfaces rule.
- **Sizes:** `page` fills a content area (the shell's wait for the workspace, the dashboard's wait for its data), `card` fits one card, `full` takes the whole screen with the logo (the session check after a refresh). Skeleton rows stay for lists that already know their shape.
- **Captions** (rotating, real product facts only): "Opening your workspace", "Fetching only what you are allowed to see", "Almost there. Counting open tasks". EN and AR; the picture holds no text.
- **Behavior:** pure CSS motion; with reduced motion the shelf is full and still. A screen reader hears one status label, not the changing captions. The reference is `screens/shared/loading.html`; the Next component is `frontend/src/components/loader/`.

---

### 5.20. Create Project Dialog in Next.js (`SCR-PRJ-02`)

- **Opens from four places** through one shell action (`openCreateProject`): the sidebar button, the dashboard empty state, and the Projects page header button and empty state. When the plan is full or downgraded (capacity and `notices` from the dashboard read model) the sidebar button is dimmed and every entry point shows the "project limit reached" toast instead of opening the dialog.
- **Form:** name, project key (suggested from the name with the same rules as `backend/.../project-key.ts`, editable, "Use suggestion" resets it), optional description. An untouched key is omitted from the request so the server generates it and resolves collisions. Native `<dialog>`: focus, Escape and backdrop come from the platform; closing is blocked while a request is in flight.
- **Live side panel:** the flag shows the key, the folder shows the name, the capacity card and caption use the real plan numbers and the user's initials; captions rotate (still with reduced motion).
- **Errors:** `PROJECT_KEY_TAKEN` (409) shows a suggested next key under the field; `PROJECT_CAPACITY_EXCEEDED`, a read-only plan and unknown errors show an alert inside the dialog. Success refetches the project lists and the dashboard and shows "Project created: Name (KEY)".
- **Arabic:** the labels inside the picture (Members, Plan capacity, Active, To do, Doing, Done, Audit logged on create), which the reference left in English, are translated, and the caption names the plan.
- **Verified with the Parity Gate:** empty, filled, key edited, name error and key taken at 1440 (EN light) with zero differences; Arabic dark, 390 EN and 390 AR owner with only the translations above. Real run: created two projects, saw the duplicate key refused, filled the plan to 7 of 7 and saw the button block.

---

### 5.21. Project Settings, Confirm and Restore in Next.js (`SCR-PRJ-05`)

- **Row menu is fully live** ("Open board" and the project name lead to the board, step 4.9a). Items follow the server's `viewer.*` flags: Project settings (`canEdit`), Archive / Unarchive (`canArchive`), Delete (`canDelete`), and a Restore button for deleted rows (`canRestore`).
- **Settings dialog:** name (2 to 100) and description (up to 1000) saved with `PATCH /projects/:id`; the key is read-only. The Lifecycle block is hidden when the viewer can neither archive nor delete (a project admin who is not a workspace admin sees only the form). The side panel shows the three lifecycle stops and three captions. `?settings=<id>` opens a project's dialog once, if the viewer may edit it (the board will link here).
- **Confirm dialog:** archive, unarchive and delete each ask first, stacked over the settings dialog when opened from there; when accepted both close. Delete uses the danger button.
- **Errors:** a refused request becomes a friendly message (plan full on restore, read-only project, no permission, project gone). In a dialog it shows as an alert; from the confirm dialog or Restore it shows as a toast. The lists are refetched after every mutation either way.
- **Lists refresh in the background:** a dialog closes as soon as the server answers; the project lists, dashboard and My tasks catch up right after. The API client also accepts the empty `204` answer that DELETE returns.
- **Verified with the Parity Gate:** seven states (settings as admin, as project admin and on an archived project, name error, and the three confirm dialogs) at 1440 EN light with zero differences; Arabic dark and 390 EN/AR with only the Arabic wording noted in the step. Real run: renamed, archived (through settings and confirm), deleted, restored, refused a restore on a full plan, and opened the deep link.

### 5.22. Project Board in Next.js (`SCR-PRJ-01`, steps 4.9a and 4.9b)

- **Route:** `/w/[workspaceSlug]/projects/[key]`. The URL carries the project key; the key is resolved to an id from the cached workspace project list (`GET /workspaces/:id/projects`), then `GET /projects/:id` and `GET /projects/:id/tasks?limit=100` (filters assignee, priority, category) fill the board. An unknown key (or a project the viewer is not in) shows a "not found" card; a failed request shows the retry card under the same breadcrumbs. The top bar shows the project's name.
- **Header:** key, name, status pill (Active, Archived, Read-only), description, member stack with the "Project members" link, the member-role note, and the actions *Add task* (`viewer.canCreateTask`, disabled when the project is read-only or archived), *Deleted tasks* and *Project settings* (project admins; settings opens the Projects page dialog through `?settings=<id>`). The semicircle gauge uses `taskCounts` (cancelled never counted).
- **Banner** for archived and read-only projects; **toolbar** with search (client side), assignee, priority, category and *Show cancelled* with its count.
- **Columns and cards:** To do, In progress, In review, Done (+ Cancelled on demand); counters come from `taskCounts` (so they stay exact past the 100 rows fetched) and show `shown/total` while a filter is active. Card: priority pill, category, title (3-line clamp), due date (red when overdue and open), comment count, assignee avatar.
- **Moving a task:** drag and drop on desktop, the card menu ("Move to ...") everywhere (keyboard and touch alternative). Allowed targets come from the workflow and the viewer (`dropTargets`): admins follow the workflow, an assigned member the same without Cancelled, nobody on an archived or read-only project. Terminal tasks (Done, Cancelled) only reopen, through a dialog with a reason (a later step).
- **Optimistic with rollback:** on drop the card jumps at once (every cached list and the counters), `PATCH /tasks/:id`, and a refusal puts everything back and shows the reason as a toast; the board, project lists, dashboard and My tasks are refetched after every answer. A second drop of the same card waits for the first answer.
- **Phone (under 768px):** one column at a time through the status tabs (with counts); no drag, the menu does the moves.
- **Add task dialog (`SCR-TSK-03`, step 4.9b):** opened from the header button, the To do column "+" and the empty-board button (a read-only or archived project answers with a toast instead). Title (200), description (5000, optional), priority pills, category, assignee (project members only) and due date; only the title is required. The side panel previews the card live (title, priority colour and width, due date, assignee initials) and cycles three captions. `POST /projects/:id/tasks`; not optimistic (the server assigns the id), but the card is inserted into every cached list it fits and the counters on the server's answer, then the board reconciles in the background.
- **Reopen dialog (`SCR-TSK-02`):** a Done task goes back to In progress, a Cancelled one to To do, and only through this dialog (reason 5 to 1000 characters, kept as a task comment and in the audit trail). Reached from the card menu ("Reopen to ...") or by dropping a terminal card on its single allowed column. `POST /tasks/:id/reopen`; the card moves on the server's answer.
- **Project members dialog (step 4.9c):** opened from the header member stack. Lists every member with avatar, name, "Creator" and "You" tags, and the project role. Project admins change roles (select) and remove people (trash icon); the add form (workspace members not yet in the project, with a role) shows only on an editable project and is replaced by a hint when everyone is already in. Locked rows show a badge instead: the creator (unless the viewer is a workspace admin or the account owner), the viewer themselves, and everything for non-admins. `POST/PATCH/DELETE /projects/:id/members`; each call waits for the project refetch, so the list is current when its row stops being busy. Roles and removals stay available on a read-only project because the server accepts them there; adding does not.
- **Deleted tasks view (step 4.9c):** the header button (project admins) swaps the board for the restore window and back ("Back to board"): title, "Deleted N d ago · permanently removed in N days", author, *Open details* and *Restore task* (disabled on a read-only project). `GET /projects/:id/tasks?deleted=true`, `POST /tasks/:id/restore`; the board, counters and list are refetched after a restore.
- **Opening a task:** a card, the card menu's "Open details", a deleted-task row and a My tasks row all lead to the task page (5.23).
- **Deliberate differences from the reference page:** the *Deleted tasks* button is shown to project admins only (the server returns an empty list to everyone else); the card title weight is 700 (the reference writes 650 but its static font files render 700, a variable font would render a true 650 and wrap lines differently); avatar colours derive from real user ids; the dark Medium priority pill takes the colour of the reference's assistant stylesheet (`ai-chat.css`), which wins on its pages; the SVG captions of the Add task panel and the screen-reader "Role" labels of the members dialog are translated (the reference leaves them in English).

### 5.23. Task Page in Next.js (`SCR-TSK-01`, step 4.10)

- **Route:** `/w/[workspaceSlug]/projects/[key]/tasks/[id]`, a full page (not a slide-over). `GET /tasks/:id` returns the task, its comments, its project's flags and `viewer.*` (what this viewer may do); the project members for the assignee list come from `GET /projects/:id`. The top bar shows the project name; breadcrumbs are Dashboard / Projects / KEY / task title. A missing task (or one the viewer may not see) shows the "does not exist" state, a failed request the retry card, both under the same breadcrumbs.
- **Header card:** back link, a "Saved" note, **Reopen** (Done and Cancelled tasks, project admins) and **Delete** (project admins), key and status pill, and the title as an editable field. A deleted task shows the restore banner: a ring with the days left, "permanently removed on <date>" and **Restore task**.
- **Fields save by themselves** as soon as they are committed (selects and date at once, title and description when the field loses focus; Enter commits the title): status, priority, category, assignee (project members only), due date, description. While the request runs the field keeps what was typed; a refusal puts it back with the reason as a toast. Which fields are editable follows `viewer.canEdit`; the status select lists only the steps the server allows this viewer (a member: the normal steps, never Cancelled); an archived or read-only project locks everything.
- **Comments:** newest last, with "N min ago"; reopen and reinstate records show as highlighted system lines. The form is hidden on a deleted task and on a read-only project. **Delete** asks first, then returns to the board with "Task deleted. You can restore it for 30 days."
- **Workflow scene (side panel, hidden on phones):** a four-step track (To do, In progress, In review, Done) with the task card on its current step, a Cancelled branch, live title, priority colour and assignee initials, and three captions; the first one follows what this viewer can do next (a member never reads "cancel").
- **Verified with the Parity Gate:** 14 states (every status, deleted, owner, project admin, member on own and other task, read-only, archived, not found, error) at 1440 EN light, 1440 AR dark and 390 EN/AR; only data-driven differences remain (the project key letters, which wrap one breadcrumb on a phone). Real run: edited every field, commented, reopened a Done task (system line appears), deleted and restored, and checked a member's limits.

### 5.24. Members & Settings in Next.js (`SCR-SET-01` and `SCR-INVT-02`, steps 4.11a and 4.11b)

- **Route:** `/w/[workspaceSlug]/settings` (the "Members & settings" item, workspace admins and the account owner). Members never reach the data: the page shows the "Only workspace admins can manage members" explanation, and the requests are not even sent (the server would answer 403 anyway). A failed load shows the retry card.
- **Workspace details:** name (2 to 100) and URL (3 to 50 characters: lowercase letters, digits, single hyphens; typing is filtered) with a live "members · projects" chip, Discard and Save (enabled only while something changed), and the account name and creation date. `PATCH /workspaces/:id` sends only what changed. A taken URL answers "This URL is already in use. Try <slug>-2". After a URL change the workspace list is refetched and the page moves to the new address, because the shell finds the workspace by its slug.
- **Roles scene:** three role cards (Owner, Admin, Member) with the one a caption talks about lifted and outlined; three captions that rotate every 5.2 seconds, pausable with the pager. Hidden on phones.
- **Members table:** search (name or email), filter by role, joined date. The account owner always shows an "Owner" badge, the viewer's own row a plain badge with a "You" tag, everyone else a role select and a remove button. `PATCH /workspaces/:id/members/:id` (the row is busy until the list is refetched) and `DELETE` after a confirm dialog, which reports how many tasks lost their assignee. "Invite member" opens the invite dialog (below).
- **Pending invitations:** email, inviter, role badge, project keys, and expiry ("Expires in N days", or an "Expired" badge with how long ago). **Resend** issues a new link and shows it once in the link dialog (copy button); **Revoke** asks first. Both are refetched afterwards.
- **Invite dialog (`SCR-INVT-02`, step 4.11b):** email, role (Member or Admin) and, for members, the projects they join on day one (active projects only, archived and read-only ones are listed but disabled; "Select all" / "Clear"; admins see every project, so the list gives way to a note). The side panel is a live invitation ticket (workspace name, the typed email, the role pill and up to three project keys plus "+N") with three rotating captions. `POST /workspaces/:id/invitations` answers with the link once; the dialog then shows it with a Copy button, a summary badge and "Invite another". Errors land where they belong: invalid email, already a member and already pending under the email field, a no-longer-available project as an alert. The pending list is refetched before the dialog switches to the link.
- **Deliberate differences from the reference page:** the scene's role cards and the invitation ticket's texts are translated in Arabic (the reference leaves them in English); the Arabic "expired N days ago" reads "منذ N أيام" (the reference prints "N أيام منذ", words in the wrong order); avatar colours derive from real user ids.
- **Verified with the Parity Gate:** admin, owner, member (denied), load error, role filter, search with and without a match, the remove and revoke confirms and the link dialog, at 1440 EN light, 1440 AR dark and 390 EN/AR. Only the differences above remain. Real run: validated and discarded the form, renamed the workspace (the shell followed), changed the URL (the page moved), changed a role, cancelled and confirmed a removal, revoked and resent invitations, searched and filtered. The "Just me" scenario was not compared.

### 5.25. Audit Trail in Next.js (`SCR-AUD-01`, step 4.11c)

- **Route:** `/w/[workspaceSlug]/audit`, workspace admins and the account owner. Members see "The audit trail is for admins" and no request is sent; a failed load shows the retry card.
- **Read model:** `GET /audit-logs?workspaceId&actorUserId&projectId&action=A,B&from&to&page&limit=15` (CS-03). Each record arrives render-ready: actor, project (with `isDeleted`) and the subject user are resolved by the server, so removed members and deleted projects never read "unknown".
- **Filters:** time chips (Last 24 hours, 7 days, 30 days, All time; a chip sets the From and To dates, typing a date clears the chip), From / To, Person (workspace members), Project (active and archived projects, then deleted ones marked "(deleted)"), and four type chips (People, Projects, Tasks, Workspace) that can be combined. "Clear filters" appears as soon as any filter is on. Every change returns to page 1; the previous rows stay on screen while the next page loads.
- **Rows:** date, time and "N min/h/d ago", the actor (or a gear and "System"), a category icon (colour per type) and one readable sentence with the names in bold and the project key, e.g. "Sarah Ahmed changed Leo Karam's role in Auth Revamp from Member to Project admin". A "Details" disclosure lists the raw metadata and the action name. Dates and times follow the viewer's language with Latin digits in Arabic.
- **Sentences beyond the reference:** the reference page covers 19 actions; the backend writes more. These get their own sentences and chip membership: project updated, archived, unarchived, restored, project role changed, task edited, moved (from X to Y), reopened and reinstated. Anything unknown still shows "<Actor> <action in words>".
- **Backend (CS-13):** a type chip sends every action of its category, and all four together are 30 actions, so the cap on `action=` rose from 20 to 40 (`docs/06` and the CS-03 test updated).
- **Empty and paging states:** "No activity yet" (nothing recorded) or "No activity matches these filters" with a Clear button; page controls and "16-30 of 71" appear above 15 records, and moving to another page scrolls the list heading to the top.
- **Verified with the Parity Gate:** 15 states (admin, owner, member denied, error, empty, details open, three category combinations, person, project, deleted project, no match, page 2, last page, 30 days) at 1440 EN light, 1440 AR dark and 390 EN/AR. Only avatar colours and the ids inside Details (the reference prints p1, u4; the real ones are database ids) differ, plus the scroll offset after paging at 1440px (the reference swaps rows for a skeleton while it loads, so its page height changes under the smooth scroll). Real run: created real events through the API and read their sentences, used the 7-day chip, three categories at once (30 actions), Clear, paging, manual dates and the empty state.


### 5.26. Billing and the 403 State in Next.js (`SCR-SET-02`, `STATE-AUTH-403`, step 4.12a)

- **Route:** `/account/billing`, account owner only (sidebar "Billing" now built). A workspace admin or member who opens the link sees the 403 state ("This area is for the account owner") and no billing request is sent; a failed load shows the retry card.
- **Data:** `GET /accounts/:id/subscription` (plan, status, cycle dates, grace, limits, read-only project count) and `GET /accounts/:id/billing-events`. The plan table (Free 3 projects / 1 workspace, Pro 7 / 3, Enterprise 15 / 10, Epic 25 / unlimited) lives in `lib/billing.ts` and mirrors the backend tier limits.
- **Banner (one at a time, by priority):** account deletion in progress, projects must be chosen, grace period ended, payment failed with days left. Meters turn red at 100%; "Unlimited" has an empty bar.
- **No payment provider yet:** "Change plan", the plan buttons and "Update payment method" only show a toast ("open when billing launches"). "Choose projects" and "Delete account" open their dialogs in step 4.12b; until then they toast too. While an offboarding is pending, Change plan and Delete account are disabled.
- **History:** invoice and plan events with a red dot for failures; the Amount column appears only when an event carries an amount; empty state with an illustration otherwise.
- **403 state:** `components/state/forbidden.tsx`, variants `billing` and `audit`, with the "Owner only" door scene (translated captions).
- **Verified with the Parity Gate:** 9 states (Pro, past due, grace over, select projects, Free, offboarding, load error, 403 for admin and member) at 1440 EN light, 1440 AR dark and 390 EN/AR: no differences except the Arabic "Read-only" badge (the reference leaves it in English). Real run against the backend: every banner and status per scenario, toasts, disabled states while offboarding, and 403 for admin and member.

### 5.27. Select-Projects and Delete-Account Dialogs in Next.js (`SCR-SET-03`, `SCR-SET-04`, step 4.12b)

- **Choose your editable projects (`SCR-SET-03`):** opens from the "Choose projects" button of the banner shown when a plan change requires a selection. It asks the server for `GET /accounts/:id/projects` at the moment of opening (never a cached copy), then lists every project of the account (workspace, task count, "Archived" when archived). It starts from the projects that are already editable, capped by the plan; when the owner has none, nothing is ticked: we never pick for them. The counter ("2 of 3 selected", then "Plan limit reached") and the three slots in the illustration follow the ticks live; once the cap is reached the other rows are disabled. Confirm sends `POST /accounts/:id/select-active-projects { activeProjectIds }`, then the banner, meters and project lists are refetched before the dialog closes and a toast says "Your selection was saved". Refusals show in the dialog: over the limit, no pending selection, a project of another account, account locked.
- **Project order:** the server lists projects by workspace name, then project name (the reference listed them in creation order). The real order is kept.
- **Delete this account (`SCR-SET-04`, DEC-15):** two checks before the red button enables: the account slug typed exactly (surrounding spaces ignored) and a non-empty password. `POST /accounts/:id/offboard { slugConfirmation, passwordConfirmation }`. A wrong password shows under the password field and returns focus to it (editing the field clears it); any other refusal shows in the dialog. On success the dialog closes, a toast says "Account deletion started. Every workspace is locked." and the page refetches: the banner reads "Account deletion in progress", the status is Locked, and Change plan and Delete account are disabled.
- **Both dialogs:** native `<dialog>` (focus trap, Escape, focus returns to the button that opened it), Escape and the close buttons are ignored while a request is running, illustrated side panel with three rotating captions (a short clerk-at-a-shelf scene for the selection, a person with a sealed box for the deletion), hidden below 880px.
- **Known backend gap (Phase 5 backlog):** `select-active-projects` does not check the offboarding lock the way the project, task and workspace guards do. The UI cannot reach it because the banner has no button while a deletion is pending.
- **Verified with the Parity Gate:** 7 states (select with none, two and three ticked; delete empty, typed, half-typed slug, wrong password) at 1440 EN light, 1440 AR dark and 390 EN/AR. Differences: the vertical offsets of the five project rows (server order, see above) and the Arabic caption on the sealed box (the reference leaves it in English). Real run against the backend: cap behaviour, cancel and Escape send nothing, reopening starts from the server flags, the saved selection (AUT, BIL, DSN editable, the other two read-only), refusal codes, wrong password, and the real deletion (account locked, repeat deletion refused).

### 5.28. Account Audit Trail in Next.js (`SCR-AUD-02`, step 4.12c)

- **Route:** `/account/audit`, account owner only. The page title is "Account audit trail", the breadcrumb is Dashboard / Billing / Account audit trail, and the sidebar keeps Billing lit (the Billing page links here). A workspace admin or member sees the 403 state ("The account history is for the account owner") and no request is sent; the server also answers `403 PERMISSION_DENIED`. A failed load shows the retry card.
- **Read model:** `GET /audit-logs?accountId&action=A,B&from&to&page&limit=10` (CS-07). Account-level events only: `ACCOUNT_*`, `SUBSCRIPTION_*`, `PROJECT_SELECTION_CONFIRMED` and workspace created, archived, deleted. Work inside workspaces stays in each workspace's own trail.
- **Filters:** time chips (Last 24 hours, 7 days, 30 days, All time; typing a date clears the chip), From and To, and four type chips that can be combined: Plan & billing, Projects, Workspaces, Account. "Clear filters" appears as soon as any filter is on; every change returns to page 1.
- **Rows:** the same row as the workspace trail (shared component), with account sentences: "The subscription is active on the Pro plan", "A renewal payment failed. The 7-day grace period started", "The plan was downgraded to Free and every project became read-only", "<name> chose 3 projects to keep editable", "<name> created the workspace Acme Labs", "<name> created the account Acme Corp" (the real event stores slugs, so the name comes from the signed-in account), "<name> started deleting the account", and "The account's data was permanently deleted" (an event the reference has no sentence for). Anything unknown reads "<actor> <action in words>". A "Details" disclosure lists the raw metadata.
- **Hero:** a receipt with a KEPT stamp (translated in Arabic), two meshing gears at its left (the "System" actor of the trail, see 5.29) and the three reassurances (what is recorded, where workspace work lives, owner only and read-only records).
- **Icon colours:** the reference gives no background to the Plan & billing, Workspaces and Account icons (its white icons would be invisible), so they take the palette of the workspace trail.
- **Verified with the Parity Gate:** 11 states (with data, details open, Plan & billing chip, Projects + Account chips, 30 days, no match, page 2, empty, error, 403 as admin, 403 as member) at 1440 EN light, 1440 AR dark and 390 EN/AR. Differences: the icon colours above, the translated Arabic stamp, and a hover shade on the disabled Next button at 390px (the reference's pointer rests over it after paging). Real run: filters and counts (8 plan events, 8 + 2 with both chips, 5 in 30 days, empty state), paging "11-13 of 13", 403 for admin and member (UI and API), error then retry, and a real event: starting the account deletion from the Billing dialog (4.12b) shows at the top as "started deleting the account · just now" while the account is locked.

### 5.29. Illustration refinements: loading scene and account audit hero (2026-10-20)

Two dotted lines in approved illustrations started or ended in empty space. Each now connects two real things, with the same kit (`screens/shared/illustration.css`), no new colours and motion guarded by `prefers-reduced-motion`.

- **Loading scene** (`screens/shared/loading.html` in its three sizes, `loading.css`; `components/loader/loader.tsx`, `loader.css`): a small white badge under the lock card holds a progress ring, and the dotted line now runs from the badge to the shelf. The ring fills in nine steps over the same 8.1s loop as the nine folders that land on the shelf ("Counting open tasks" fits it); with reduced motion it stays at two thirds. The other dotted line (tray to the clerk's hand) already connected two things and is unchanged. No text in the SVG, so nothing to translate.
- **Account audit hero** (`account-audit.html`, `billing.css`; `account-audit.tsx`, `account-audit.css`): two meshing gears replace the two loose curves. The big white gear (orange hub) turns once in 24s, the small orange gear turns the other way once in 14s (the 12:7 tooth ratio keeps the teeth meshed); two dotted lines run from the gears to the receipt's first and third rows. The gear is the same symbol the trail's table uses for the "System" actor. Still when reduced motion is on; dark mode follows the kit variables.
- **Verified:** reference and Next at 1440 (light), Next in Arabic dark, phone width (hero art hidden below 768px as before, no overflow), ring steps read from the computed style (5/9 then 7/9), gear angles and direction sampled over time, reduced motion (no animation, ring frozen).

### 5.30. Profile and Account Menu in Next.js (`SCR-ACC-01`, `SCR-ACC-02`, step 4.12d)

- **Route:** `/account/profile`, any signed-in person (owner, admin, member). Reached from the account menu (header) and the sidebar's Profile link (phone drawer); the page title is "Profile", the breadcrumb is Dashboard / Profile, no sidebar item is lit and the dashboard search stays away.
- **Data:** `GET /users/me/profile` (CS-09): identity, saved preferences, footprint and AI plan in one read. The account plan tile is returned only to account owners.
- **Hero:** initials avatar with a camera badge, name, email with Verified / Not verified, "Member since <month year> · <highest role>" (owner, else admin, else member), and the settings-panel illustration bound to the saved language and theme (the pill, the knob and the theme word move with the choice). **Photo:** upload needs file storage, which is not connected, so the avatar button says "Photo upload opens when file storage is connected." instead of faking a browser-only photo (the reference's photo dialog is not built).
- **Profile details:** full name (2 to 100 characters, live counter, inline error, no request when invalid) and the read-only email. `PATCH /users/me { name }`; the header and the page update at once.
- **Password:** current, new and confirm with the four-bar meter (Weak, Fair, Good, Strong). Client checks (current required, backend rule, confirmation) send nothing; the server answers `INVALID_CURRENT_PASSWORD` (shown under the current password and focused) or `PASSWORD_UNCHANGED`. Success clears the fields and says "Password changed. N other devices were signed out." This device stays signed in; the other devices' refresh tokens stop working.
- **Footprint:** workspaces, projects, open tasks, AI plan (tier and daily quota) and, for owners, the account plan; then each workspace with its project count and tags (Account owner, Admin or Member). The "no workspace" empty state exists but the shell sends a person without a workspace to onboarding first.
- **Preferences:** language (English, العربية) and theme (Light, Dark, System). A change is saved to the account and applied here at once (the language switches the route and direction, the theme switches the class); choosing a value that is already saved but not in effect on this device just applies it.
- **Known gap (Phase 5, decided 2026-10-21):** the header toggles are per device and nothing applies the saved choice at sign-in. The reference sentence "They follow you to every device" would over-promise, so the page says "Saved to your account and applied on this device right away." instead (a deliberate difference from the reference). Syncing the toggles and sign-in stays on the Phase 5 list.
- **Verified with the Parity Gate:** 12 states (three roles, name typed and refused, password meter at three strengths, empty submit, mismatch, wrong current password, load error) at 1440 EN light, 1440 AR dark and 390 EN/AR. English is identical to the reference in every state. In Arabic the reference leaves two strings in English (the theme word in the illustration and the empty password hint, which also makes its card 18px taller); ours are translated. Real run: menu to profile, rename (page, header, initials and server agree), preferences (theme back to back, language round trip, an already-saved choice applied), the full password flow including a second signed-in device being signed out, the phone drawer link, and a member in Arabic dark.

### 5.31. In-App 404, Workspace 403 and Crash States in Next.js (`STATE-GLOBAL-404`, `STATE-AUTH-403`, step 4.13)

- **404 (`components/state/not-found.tsx`):** any address the app does not have (`/zzz`, `/account/nothing`, `/w/slug/nothing`) lands on a catch-all inside the shell that raises `notFound()`, and the shell's `not-found.tsx` shows the reference scene: "We can't find that page", the map with the empty pin, "Back to dashboard" and "Open a project". The header says "Not found" and the dashboard search box steps aside. A signed-out visitor is sent to sign-in first, as for every app address. (Next streams the page, so the HTTP status is 200; this matters only for public pages, to remember at the landing page step.)
- **No access to this workspace (403 variant):** a workspace address that is not the person's (someone else's, or one that does not exist: the same page, so existence is never revealed) shows the reference 403 scene with the "workspace" wording and a single "Back to dashboard" button. It replaces the plain "Workspace not found" block the shell had since 4.4. The shell around it (workspace switcher, role, sidebar) falls back to the person's own workspace, so the page is not left with an empty "—" chrome.
- **Header titles:** a state page names itself (`usePageTitle`): "Not found" and "Access denied", as in the reference. This also fixes the owner-only 403 pages of step 4.12, whose header said "Billing".
- **Crash (`error.tsx` inside the shell) and the shell's own load failure:** both use the approved error card (title, one sentence, "Try again", and "Back to dashboard" for a crash). The reference defines no separate crash scene, so none was invented. "Try again" on a crash first drops the cached queries (bad data may be what made the page throw), then renders the page again. The same card replaces the unstyled "Could not load your workspace" block.
- **Unchanged on purpose:** the board's and the task page's own "not found" cards (built in 4.9 and 4.10 against their references) and the invitation page's invalid-link state.
- **Verified with the Parity Gate:** 4 states (404 as owner and as member, workspace 403 for someone else's workspace and for one that does not exist) at 1440 EN light, 1440 AR dark and 390 EN/AR: no differences. Real run: header titles, an unknown URL, a workspace that is not yours, a real crash (billing data the page cannot read) caught inside the shell and recovered with "Try again", and the shell's load failure recovered with "Try again".

### 5.32. Contact Us in Next.js (`SCR-HLP-02`, step 4.14a)

- **Route:** `/help/contact` (it was `/contact` until step 4.17c, which gave that address to the public page), any signed-in person. Reached from the orange envelope button of the sidebar (also in the phone drawer); the header says "Contact us", no sidebar item is lit and the dashboard search stays away.
- **Form:** name and email start from the signed-in person (editable), five topics as cards (A question, A problem, Billing, Feedback, Something else), a message of 10 to 2000 characters with a live counter, and a hidden honeypot field. The illustration (a paper plane flying to an inbox tray) shows the chosen topic on its chip. Mistakes are caught in the browser (nothing is sent), with inline messages and focus on the first bad field.
- **Sending:** `POST /contact` (CS-10): the public endpoint answers `201 { received: true }`; the page then shows "Message sent" and "We got it - Sent to the team as <name> - <email>" with "Send another message" and "Back to my workspace". A refusal for sending too often (3 per email and 8 per network address in a rolling hour, `429 CONTACT_RATE_LIMITED`) shows "Too many messages in a short time. Please try again in an hour." and keeps what was typed; any other failure says nothing was lost.
- **Server side (unchanged, verified):** a filled honeypot answers the same `201` and stores nothing; validation answers `400 VALIDATION_FAILED` (name, email, topic, message); the message is stored as plain text with a salted hash of the network address; the team is not emailed yet (email provider, later gated step), messages are read from `contact_messages`.
- **Link to the guide:** "Looking for answers first? How it works" points to `/help`, which is live since step 4.14b.
- **Verified with the Parity Gate:** 9 states (owner, admin and member prefill, two topics, typed message with counter, three errors, sent, rate-limited) at 1440 EN light, 1440 AR dark and 390 EN/AR: no differences. The success and rate-limited states answer the request from the test script so repeated runs never reach the real hourly limit. Real run: the sidebar button, errors with no request, a real message found in the database (topic, text, hashed address), a filled honeypot stored nothing, the server's 400 for a bad email and a bad topic, three messages accepted and the fourth refused with the typed text kept.

### 5.33. How It Works Guide in Next.js (`SCR-HLP-01`, step 4.14b)

- **Route:** `/help`, any signed-in person. Reached from the dark `?` button of the sidebar and from "How it works" in the account menu; the header says "How it works", no sidebar item is lit and the dashboard search stays away. The Contact page's "How it works" link now opens it.
- **Page:** a hero, a role picker (Account Owner, Workspace Admin, Project Admin, Member) that opens on the signed-in role, a table of contents of nine numbered links, and nine illustrated sections that alternate sides: the big picture, your cycle, getting started, tasks, people, the AI assistant, plans, trust, and help. Each section has its own scene from the shared illustration kit, a bullet list and, for the role it was opened on, a short note. "Your cycle" has numbered steps and You can / You can not columns that change with the picked role. The last section ends with "Contact us" and "Back to my workspace".
- **Behaviour:** the picker changes only the role-specific parts (no reload); a table-of-contents link scrolls smoothly (instantly with reduced motion) and puts `#sec-<id>` in the address, and a link such as `/help#sec-ai` opens at that section.
- **No backend:** the guide is static text, no request is made.
- **Generated, not retyped:** the nine illustrations (`guide-scenes.tsx`) and the English and Arabic text were produced from the reference renderer (`screens/shared/guide.js`) by a conversion script, so the Next page cannot drift from the approved wording; `guide-scenes.tsx` carries a "do not edit by hand" note. A test checks that English and Arabic have the same keys, that every illustration string exists in both, and that every role has text in every section.
- **Verified with the Parity Gate:** 4 roles (owner, admin, project admin, member) at 1440 EN light, 1440 AR dark and 390 EN/AR: no differences (about 280 measured elements per run). Real run: the picker, the table of contents, a deep link, both closing links, Arabic dark mode, and a clean browser console. The parity script cannot see a missing-message error, so the console was checked separately (it caught one real bug, fixed). Headless test browsers scroll slowly when smooth scrolling is on (about 4 s for a long page); this is the browser, not the page.

### 5.34. Create Workspace Dialog (`SCR-WKSP-02`, step 4.15)

- **Where:** reference page `screens/groups/03-workspace-dashboard/index.html` (dialog `#ap-wm`), opened by "+ New workspace" at the bottom of the workspace switcher (account owner only; the button is no longer a "later" toast). It reuses the Create project dialog frame (`.pm`), so the look, sizes, close behaviour and phone bottom sheet are the same.
- **Fields:** Workspace name (min 2) and Address, shown as `/w/` + a suggested slug (`<account address>-<name>`, at most 40 characters, follows the name until edited; "Auto" badge and "Use suggestion" link like the project key). An Arabic-only name suggests nothing (addresses are Latin letters, numbers and hyphens). The address always reads left to right, also in Arabic.
- **Illustration (new scene):** a building for the account with one room per workspace; the room being created lights up with the new initials, a waving person, a "Workspace Admin" card, a live plan card ("2 / 3" with segments) and a "Members stay separate" chip. Captions: name it and the address is suggested; you become its admin; how many workspaces are left on the plan (last one, or none).
- **States:** field errors (name under 2 characters; address not 3 to 40 lowercase letters, numbers and single hyphens), address in use (`409 WORKSPACE_SLUG_TAKEN`: "This address is already in use. Try <next>."), plan limit reached (`403 WORKSPACE_CAPACITY_EXCEEDED`, CS-14: a red notice "Your plan allows N workspaces. Upgrade to create another." with an "Upgrade plan" link to billing, and the Create button disabled), and busy button while sending. Success closes the dialog, shows "Workspace created" and adds the workspace to the switcher.
- **Rules:** creation is account owner only (the backend answers `PERMISSION_DENIED` otherwise); caps are Free 1, Pro 3, Enterprise 10, Epic unlimited, archived workspaces count.
- **In Next.js:** `components/workspace/create-workspace-dialog.tsx` (+ `create-workspace.css`, `lib/workspaces.ts`), opened from the switcher in the shell. The plan numbers (used, allowed, plan name) come from the owner's subscription (`GET /accounts/:id/subscription`, `limits.currentWorkspaces / maxWorkspaces`); `POST /accounts/:id/workspaces` creates it, the new workspace is written into the switcher list at once and the page moves to `/w/<address>` with a "Workspace created" toast. "Upgrade plan" closes the dialog and opens billing. A plan with no limit (Epic) shows the count alone and the caption "Your plan has no workspace limit" (not in the reference, which has no such plan). An account being deleted shows its own notice.
- **Verified with the Parity Gate:** 9 states (empty, typed, address edited, long name, Arabic-only name, third caption, errors, address in use, plan full) at 1440 EN light, 1440 AR dark, 390 EN light and 390 AR dark: no differences, and the typed values, button state and text match. The "plan full" state answers the subscription request from the test script (the real cap is covered by `backend/test/cs14-workspace-limit.spec.ts`). Real run: created a workspace, landed on it as Account Owner, the switcher listed it, the next attempt showed 3 / 3 with the notice and a disabled button, "Upgrade plan" reached billing; no console errors.
- **Prototype data:** Acme Labs now belongs to another account, so the owner's account has 2 of 3 Pro workspaces (1 left). After one creation the plan is full and the limit state shows; the downgraded scenario (Free, 1 allowed) shows it straight away.

### 5.35. AI Assistant Page in Next.js (`SCR-AI-03`, `STATE-AI-QUOTA-MAX`, step 4.16a)

- **Route:** `/assistant`, any signed-in person (no workspace needed, Mode A: general knowledge). The sidebar item and the phone bottom bar "Ask AI" now open it and light up; the header says "AI assistant". The top-bar AI button (quick-ask panel, Mode B) comes with step 4.16b and still shows the "later" note.
- **Page:** breadcrumb (Dashboard / AI assistant), one chat card and the illustrated panel (a proposal card with Confirm and Reject, and the day's three message tokens; the three captions rotate and the dots work). No conversation list (approved decision): one active conversation, restored on load from `GET /ai/conversations` (the most recent global one) and its messages, created on the first send.
- **Sending:** Enter sends (Shift+Enter adds a line, the box grows to 160px), every send carries an `Idempotency-Key` that is reused when the same text is retried after a gateway failure; the message and a typing indicator show at once, the thread and the quota are refetched before the indicator goes away, and the box gets focus back. A refused send puts the text back in the box and says why in a toast ("Generation failed. No message was deducted from your quota.", "You used today's quota.", or a general failure). Typing in the box never moves the thread.
- **Quota:** the pill ("2 of 3 messages") turns amber at one left and red at none, with the countdown to 00:00 UTC; at none, the box and button are disabled and the red notice "You used today's messages" appears. When the clock passes the reset, the count is fetched again. The caption "N messages a day" uses the person's real daily limit (3 on Free).
- **Not built, on purpose:** streaming and the proposal card inside messages (Mode B, step 4.16b). Citation pills, the real model and the reworded note under the box came with step 5.8 (see 5.41). The illustration's own labels stay in English in both languages, as in the reference.
- **Verified with the Parity Gate:** 8 states (empty, with a conversation, limit reached, typed, three lines, typing, send failed, third caption) at 1440 EN light, 1440 AR dark, 390 EN light and 390 AR dark: no style or layout differences. The only two measured differences are the width of the time stamp text (the reference stamps its messages from the page load, the test data from another minute, so the digits differ; the text matches once digits are masked). The typing and failed states answer the send request from the test script so no real message is spent. Real run: nav lit and header, the empty state, a suggestion sent for real (typing indicator, reply, "1 of 3"), a reload restoring the conversation, two more sends reaching "3 of 3" with the disabled box and the countdown; no console errors.

### 5.36. Quick-Ask Drawer and Proposal Cards in Next.js (`SCR-AI-01`, `SCR-AI-02`, step 4.16b)

- **Opening:** the AI button in the top bar (with `aria-expanded`), `Ctrl/⌘ + J` from anywhere, and the same shortcut on phones (where the top-bar button is hidden and the bottom bar's "Ask AI" opens the full page). `Esc`, the close button and a click on the dimmed page close it; the focus goes back to what opened it. It is not modal: the page behind stays readable. Closed, the drawer stays in the page but off screen and inert; its chat loads the first time it opens and is then kept (a half-written question survives closing).
- **Drawer:** 440px from the end edge (the start edge in Arabic), obsidian header ("Ask Veyro", "Open full page", close, "Workspace · <name>" and the quota pill), the same thread, daily-limit notice and message box as the assistant page, and the placeholder note. Empty state suggests "What is overdue this week?" and "Create task: Update the runbook".
- **One conversation per workspace** (decision of step 4.16b): the drawer's conversation is the one for the current workspace (`mode PROJECT`, `contextScope WORKSPACE`, created on the first send), so two workspaces never share a thread; the page keeps the single global one.
- **Proposal card:** "create a task" drafts a card with the title, the project (`KEY · name`) and the priority. Confirm creates the task for real in that project (no message is spent, rights are checked again at that moment) and the card becomes "Task created" with "Open the board" to `/w/<workspace>/projects/<KEY>` (the real board, not the prototype file); Reject marks it "Proposal rejected". Errors show on the card: rights lost ("You can no longer create tasks in this project, so the proposal cannot be applied."), already resolved, or a general failure; the buttons come back. A confirmed task refreshes the project lists, the dashboard counts, My tasks and an open board in the background.
- **Shared with the page:** the chat (controller hook, thread, composer) lives in `components/assistant/chat.tsx`; the page and the drawer only add their frames. The refs the controller steers are created by each screen (the React compiler rejects refs returned inside the controller's result).
- **Verified with the Parity Gate:** 9 states (empty, with a conversation and a pending card, limit reached, typed, typing, send failed, confirmed, rejected, rights lost) at 1440 EN light, 1440 AR dark, 390 EN light and 390 AR dark: no unexplained differences. Explained: time stamp widths (the clock minute differs between the reference and the test data); in the limit-reached state the reference leaves the last message half hidden under the notice while Next is scrolled to the bottom (the quota is known before the thread renders); the screen-reader label of the box is translated in Next ("Message" stayed English in the reference); the reference words the daily-limit notice two ways in Arabic and Next uses the page's wording in both; the reference's card buttons are the small 36px ones on every host that loads the settings styles (the reference dashboard does not, so it was measured with that rule loaded). Confirm, Reject and the lost-rights state hit the real server. Real run: the button, Ctrl/⌘+J, Esc and the scrim, focus returning, a real "create task" message answered with a card for AUT, Confirm creating the task (it is listed on the real board), and the quota counting 3 of 3; no console errors. The page was re-checked after the refactor (empty state, four combinations: no differences).
- **Not built:** streaming. Citation pills, the due date on the card and the real model came with step 5.8 (see 5.41).

### 5.37. Landing Page in Next.js (`SCR-MKT-01`, step 4.17a)

- **Route:** `/` (`/en`, `/ar`), public and rendered on the server (real `<title>`, description, social card and language alternates). The navigation sign-in part is the only dynamic piece: it reads the session cookie on the server and streams in, so a signed-in visitor sees "Open workspace" (to `/dashboard`) instead of "Sign in" and "Get started"; everyone else gets the signed-out version at once. Signed-in people are not redirected away from the landing page (decision of step 4.17).
- **Sections (as in the approved reference):** navigation (full size at the top, compact with a blurred bar after scrolling, a drawer on narrow screens, theme and language buttons), hero with an email field that goes to `/register?email=...` (the register form now starts with that address), a marquee, the workflow scene, the product showcase (a dashboard and phone mock), how it works in three moves, features (heading only for now), roles, the "AI asks before it acts" demo (confirm or reject, then try again), about (three principles), contact, and the footer with its toggles. Sections slide in as they enter the screen (not with reduced motion).
- **What changed from the reference, after checking each claim against the product (decision of step 4.17):** the role count is 4 (not 3: project admin is a role); the roles matrix now follows the project-role rules (creating, editing and assigning tasks and reopening finished ones are "as project admin" for members, and a new row says everyone can move tasks assigned to them); the roles note no longer promises ownership transfer (not built) and says the owner controls billing and can delete the account; two marquee chips that advertised Google and GitHub sign-in (not live yet) became "English and Arabic" and "Light and dark theme"; the dashboard mock's third card is "AI messages today" like the real dashboard; the contact section no longer has the reference's prototype form and made-up address, it points to the real Contact page (step 4.17c makes that page public). The drawings and the mock keep their English labels in Arabic, as in the reference.
- **Features grid and public pages:** the bento grid is step 4.17b (5.39) and the public How it works and Contact pages are step 4.17c (5.38).
- **Verified with the Parity Gate:** 5 states (top, scrolled, phone drawer, AI demo confirmed, AI demo rejected) at 1440 EN light, 1440 AR dark, 390 EN light and 390 AR dark. The first five sections match exactly; the differences are the claim edits above and the empty features grid, plus two computed-style details without visual effect (next/image sets a transparent text colour on the logo; the icon-only menu button keeps the app's font). The harness missed the nav's blur at first (the stylesheet pipeline dropped the standard `backdrop-filter` when it was written together with the `-webkit-` form), so `backdropFilter` is now measured. Real run: guest and signed-in navigation, scroll compaction, theme and language buttons, the hero hand-off to register, the phone drawer with Esc, the AI demo in both languages with focus returning to Confirm; no console errors.

### 5.38. Public How It Works and Contact Pages in Next.js (`SCR-MKT-02`, `SCR-MKT-03`, step 4.17c)

- **Routes:** `/how-it-works` and `/contact`, public, in the landing page's frame (its navigation and footer; the navigation's section links go to `/#product`, `/#features` and so on, so they work from these pages). The signed-in versions moved: the in-app Contact is now `/help/contact` (the guide stays at `/help`), so one address never needs two frames (decision of step 4.17c). The sidebar's envelope button, the in-app guide's "Contact us" button and the header title follow the new address. A signed-in visitor on a public page sees "Open workspace" in the navigation.
- **Same components, two frames:** the guide and the contact form are one implementation each (`GuideView`, `ContactView`) with a small frame description. Public guide: opens on the Account Owner role (there is no signed-in role), ends with "Contact us" and "Start a free workspace". Public contact: no prefill, ends with "Back to the home page" and links to the public guide. Titles are real (`Contact us - Veyro`, `How Veyro works - Veyro`). Sending uses the same public `POST /contact` (honeypot, 3 per email and 8 per network address per hour).
- **Landing link:** the landing page's contact section button now opens the real page.
- **Verified with the Parity Gate:** the guide in 4 roles and the form in 6 states (empty, a topic, typed, errors, sent, rate-limited) at 1440 EN light, 1440 AR dark, 390 EN light and 390 AR dark: no differences. Two things learned: the shared page styles read the app colours first and fall back to the marketing colours, but the app defines `--card` and `--rose-soft` globally, so the fallback never applied (the public scope now clears those two); and the harness measures positions in page coordinates, because the reference rebuilds the whole form on submit while Next updates it in place, which shifts the browser's scroll anchor. Real run: landing to Contact, a real message stored and removed, the navigation back to landing sections, the in-app pages at their new addresses with the sidebar link, and no console errors.

### 5.39. Landing Features Grid in Next.js (`SCR-MKT-01`, step 4.17b)

- **What it is:** the features section of the landing page: six cards (live project progress with a chart that follows the pointer, workload bars, a shared task document with two named cursors, the task lifecycle, the team hub, and two privacy switches) in a grid of 4, 2 or 1 columns. Effects: a glowing border and a soft spotlight that follow the pointer, a ripple and a press on click (which also replays that card's artwork), and a staggered intro when the grid scrolls into view. With reduced motion everything shows at once and static.
- **How it is built:** the grid is an imperative engine (`bento-engine.js`, converted from the reference) because it animates by writing CSS variables each frame and replaying CSS animations; `magic-bento.tsx` only mounts it, passes the card text from the Landing messages and the theme, and rebuilds the cards when the language changes. Unlike the reference, the engine removes its listeners, observers, timers and cards when it is unmounted, so leaving and returning to the page never doubles the grid. The server renders only the section heading and an empty container.
- **Content note (decided in step 4.17b):** the "Work on tasks together" card shows two live cursors (Maya and Leo). Veyro has assignees, comments and due dates but not real-time co-editing, so this is a decorative illustration kept as approved; the same goes for the sample numbers in the other cards (24 done, 38 tasks a week).
- **Verified with the Parity Gate:** 12 runs (static, hovering card 3, hovering card 4 and scrubbing the chart at 1440; static and scrubbing at 390; EN light and AR dark): every element inside all six cards (tag, class, box and computed style), the cards, their text, the grid columns and the hover variables match; and the landing page's features section now has the reference's exact height in all four combinations. Motion checked in a real browser with reduced motion off: intro, spotlight, ripple, chart scrub ("10 done, Day 7" and back to "24 done, this sprint"), theme and language switches (still six cards, Arabic text, theme kept), leaving and returning; no errors from the grid. One existing dev-mode warning was seen on language switches everywhere (React 19 reports the theme provider's inline script when the root layout re-renders for a new locale); it is logged for Phase 5.

---

### 5.40. Billing With Stripe Payments (`SCR-SET-02`, step 5.7c; approved 2026-10-24)

- **What changed on the existing Billing page (no new screen, no layout change):** the plan cards show the monthly price (`Free`, `$9 / month`, `$19 / month`, `$29 / month`, formatted in the reader's language) instead of "Pricing to be announced". On a Free account each paid card has a **Choose {plan}** button that opens Stripe Checkout (the button reads "Redirecting…" meanwhile). On a paid account the other cards stay disabled ("Available soon") with a one-line note, because switching between paid plans waits for the downgrade rules.
- **Plan header:** the main button is **Choose a plan** (scrolls to the cards) until the account has been through checkout, then **Manage billing**, which opens Stripe's billing portal (card, invoices, cancel at period end). The hint reads "Payments are handled securely by Stripe." The payment-failed banner's **Update payment method** also opens the portal. When the owner has cancelled, the renewal line reads **Ends on {date}**. Everything is disabled while the account is being deleted.
- **Coming back from Stripe:** `?checkout=success` shows a green banner (new `gv-banner is-ok`, uses `--ok` / `--ok-soft` in both themes) and re-checks the plan every 2 seconds, up to 15 times, until the webhook has changed it; `?checkout=cancelled` shows a neutral banner (`is-info`). The address is cleaned after the first read so a refresh does not repeat the banner.
- **History wording:** the six Stripe events the backend records each have their own line (Checkout completed, Subscription started / updated / ended, Payment received / failed).
- **Data contracts:** `GET /accounts/:id/subscription` now also returns `billing: { currency, priceCents, canManage }` (no provider ids); `POST /accounts/:id/billing/checkout { tier }` and `POST /accounts/:id/billing/portal` (owner only) answer `{ url }`. **Status:** `[Confirmed Existing Functionality — step 5.7]`.
- **Verified:** Free, paid, cancel-scheduled and payment-failed states, plus both return banners, at 1440 px (English, light) and 390 px (Arabic, dark): no horizontal overflow and no console errors; the buttons reach Stripe's real Checkout and portal pages.
- **Switching between paid plans (step 5.7d, approved 2026-10-24; this replaces the "paid cards stay disabled" rule above):** on a paid account that is up to date, each other paid card has **Switch to {plan}** (filled button for an upgrade, quiet button for a downgrade). It opens a compact confirmation dialog (single column, no side panel, because it is one decision): "You will be charged the prorated difference now (or get a credit for the unused time), and {plan} starts immediately. Your next invoice keeps its date." When the new plan keeps fewer projects than the account has, an amber note adds "{plan} keeps {n} projects editable and your account has {m}. After switching, you choose which ones stay editable." After confirming, the page re-checks until the new plan shows and the existing "Choose the projects you keep editing" banner and dialog take over. The Free card reads "Via Manage billing" (going back to Free is cancelling in the portal); a past-due account sees "Fix payment first". Stripe applies the change (price swapped on the subscription, prorated, a failed payment aborts it); our record is updated by the signed webhook.
- **Card prices:** each plan card shows its price large and bold with "/ month" small (Free shows "$0 / month"); dollar amounts are not localised, so Arabic reads "$9 / شهر".
- **Test mode note:** while a Stripe test key is in use the plan header shows a "Test mode" pill with "No real charges. Pay with the card 4242 4242 4242 4242, any future date and any CVC." A deployed demo may run on test keys only with `STRIPE_ALLOW_TEST_KEYS=true`.
- **Data contracts:** `POST /accounts/:id/billing/change-plan { tier }` (owner only; 409 `SAME_PLAN`, `NO_ACTIVE_SUBSCRIPTION`, `PAYMENT_PAST_DUE`; 402 `PAYMENT_FAILED`); the subscription overview's `billing` also carries `canSwitch` and `testMode`.

---

### 5.13. Help Pages and Sidebar Help Buttons (`COMP-HLP-01`, `COMP-CTC-01`)

- **Sidebar bottom:** two round buttons side by side: the dark `?` (How it works) and the orange envelope (Contact us). Icon-only, so each shows a tooltip on hover and keyboard focus (`data-tip`, translated); stacked in the collapsed rail, side by side in the phone drawer.
- **How it works (`SCR-MKT-02`, `SCR-HLP-01`):** one renderer for the public and in-app shells. A role picker (Account Owner, Workspace Admin, Project Admin, Member) and nine illustrated sections (big picture, your cycle, getting started, tasks, people, AI assistant, plans, trust, help), each with its own scene in the shared illustration kit, alternating sides. In the app it opens on the signed-in role.
- **Contact us (`SCR-MKT-03`, `SCR-HLP-02`):** an illustrated card with a live topic chip next to the form (name, email, topic, message with counter, hidden honeypot). Inline field errors, a success card with "Send another", and a calm rate-limit message.
- **Data Contracts:** `POST /api/v1/contact` (`CS-10`). **Status:** `[Confirmed Existing Functionality — CS-10]`.

### 5.41. Real Assistant: Sources, Due Date and an Honest Note (`SCR-AI-01`, `SCR-AI-02`, `SCR-AI-03`, step 5.8d-2; approved 2026-10-28)

Small additions to 5.35 and 5.36, made when the assistant became real (Gemini, help-document search, workspace tools). Same page, same drawer, same classes; nothing is moved.

- **Sources row:** under an assistant answer that has citations, a muted label "Sources" and one chip per citation, wrapping to more lines on a phone. A chip is a 32px-high pill (`.ai-src-c`: 1px `--line` border, `--pill` fill, 12px bold text, brand-coloured border on hover and focus) with a 12px outline icon and a label cut to 220px with an ellipsis. Three kinds: a **help section** (document icon, the section title, links to the in-app How it works page), a **task** (check icon, the task title, links to the task page) and a **project** (board icon, the key in bold and the name, links to the project board). A chip appears only for a record the answer names, so every chip opens something the person was allowed to see. No chips, no row.
- **Draft card:** a **Due** row (date in the person's language, shown only when the draft has a date) after Priority, and the task description (at most two lines, muted) under the title when there is one.
- **Footer note:** replaces "The assistant in this prototype is a placeholder…" with "Answers come from the Veyro help documents and your workspace. Check important details." (Arabic: "تأتي الإجابات من وثائق مساعدة Veyro ومن مساحة عملك. تحقق من التفاصيل المهمة.").
- **Limits:** the pill and the side caption show the real daily limit of the plan (3, 15, 25 or 50), already data-driven.
- **Guide copy:** the AI section of How it works lists the limits by plan.
- **Not built, on purpose:** streaming text, a conversation list, feedback buttons, and plan limits on the Billing cards.
- **Data contracts:** `GET /ai/conversations/:id/messages` returns `citations` (`HELP_DOC {source, heading}`, `TASK {id, title, projectKey}`, `PROJECT {id, key, name}`) and proposals with `proposedPayload.dueDate` and `description` (steps 5.8b to 5.8d-1). **Status:** `[Confirmed Existing Functionality — 5.8]`.

### 5.42. Profile Photos (`SCR-ACC-01` and every avatar circle, step 5.9a; approved 2026-10-28)

The photo state of the person circle that already exists on every screen (header account button, board cards and stacks, project member stacks, members table, comments, audit trail, project members dialog, deleted tasks). Same sizes, same classes, nothing is moved.

- **Circle:** with no photo the circle is exactly what it was (coloured `av0`–`av5` or brand fill with the initials). With a photo, the picture fills the same circle (`object-fit: cover`, same radius, face-centred crop by the server) and the initials are not drawn. A picture that fails to load falls back to the initials, so a circle is never empty or broken.
- **Profile page:** the 92px circle (72px on a phone) is a button that opens the profile photo dialog (5.43). When there is a picture, a quiet underlined text button sits under the hint line: "Remove photo" for an uploaded photo, "Use initials" for an illustrated avatar. Success and failure are toasts, English and Arabic.
- **Pictures:** shrunk to 512px in the browser, then sent to our server, which checks that the file is a real JPEG, PNG or WebP (2 MB at most), turns it upright, crops it to a square, strips all metadata and stores only a 256px WebP (about 10 to 30 KB) in the `Veyro/avatars` folder under the person's id (one file per person, replaced on every change). Google and GitHub photos from sign-in keep working and are used as they are.
- **Removing a photo:** the circle goes back to initials. A photo we stored is not deleted at once: it is moved to private delivery, so its address stops working within about half a minute, and it is deleted for good 30 days later (the schedule arrives with deployment). A Google or GitHub photo is only unlinked.
- **Not built, on purpose:** cropping or zoom tools, drag and drop, photos for workspaces, and a photo in the assistant chat bubble.
- **Data contracts:** `PUT /users/me/avatar` (the picture as the raw request body, `Content-Type` image/jpeg, image/png or image/webp), `PUT /users/me/avatar/preset` (`{ key }`, one of amber, sage, sky, sand, rose) and `DELETE /users/me/avatar` (back to initials) (step 5.9a); every list that already returned `avatarUrl` keeps doing so, and the profile also returns `avatarType` (INITIALS, PRESET or UPLOAD) and `avatarPresetKey`. **Status:** `[Confirmed Existing Functionality — 5.9a]`.

### 5.43. Profile Photo Dialog and Illustrated Avatars (`SCR-ACC-01`, step 5.9, Phase B; approved 2026-10-28)

Reference: `screens/groups/07-avatar-notifications/avatars.html` and `avatar-dialog.html` (boards, with `review/` screenshots). Same shell as the other small dialogs (`.pm`, 480px wide, a bottom sheet on a phone).

- **Initials (the default):** the first letter of the first word and of the last word of the name ("Mohand Ahmed Hatem" is MH, "Mohand" is M). Words with no letter or digit (emoji, symbols) are skipped, Arabic marks are never the letter, and a name with nothing usable falls back to the email's first letter, then "?". The colour is one of the six `av0` to `av5` colours chosen from the account id, so it is the same on every screen. Every new account therefore has an avatar at once.
- **Five illustrated avatars:** Amber (bun), Sage (glasses), Sky (beanie), Sand (curls) and Rose (headscarf): flat, ink-outlined busts in the illustration kit's language with a Veyro hexagon on the sweater, on a flat pastel ground, varied skin tones. One picture, the same in light and dark. Static SVG files in `public/avatars/presets/<key>.svg`; keys are permanent. Nothing is uploaded.
- **Dialog:** title "Profile photo", a segmented control (Upload photo, Avatars) in the same style as the Profile page's switches. *Upload photo:* a dashed zone with the person's current initials and a "Choose a photo" button (JPG, PNG or WebP, up to 20 MB, shrunk by us). After a file is chosen the zone becomes the crop step: a 300px stage, a circular ring (86% of the stage) with the surround dimmed, drag to move, a zoom slider (1 to 3) and the arrow keys, live previews at 56px and 36px, and "Choose another" and "Save photo". The picture is always kept covering the ring. Nothing leaves the browser until Save. *Avatars:* a grid of six options (Initials and the five avatars), the chosen one ringed in the brand colour with a check badge, and a note "Removed photos are kept privately for 30 days, then deleted." only when a photo we stored would be hidden by the choice. Save is disabled until something different from the current choice is picked.
- **States:** nothing chosen yet, cropping, avatars, saving (spinner on the button, everything else disabled), and an error banner (`pm-alert`) with the reason. English and Arabic (RTL mirrors the grid and the controls), light and dark.
- **Not built, on purpose:** restoring a removed photo, a permanent-delete link, pinch zoom, drag and drop, and photos for workspaces.
- **Data contracts:** see 5.42. **Status:** `[Confirmed Existing Functionality — 5.9a]`.

### 5.44. Notification Bell and Popover (shell, step 5.9, Phase C; approved 2026-10-28)

Reference: `screens/groups/07-avatar-notifications/notifications.html` (board, with `review/` screenshots). Replaces the "Notifications are coming" placeholder.

- **Bell:** the existing round bell button with a brand-coloured count badge at its top end (the number up to 9, then 9+; nothing when everything is read). The accessible label says how many are unread. On a phone the bell is shown in the top bar and the popover becomes a full-width sheet under the header.
- **Popover:** 380px wide, 22px radius, on the surface colour. A header with "Notifications" and a text button "Mark all read" (disabled when nothing is unread). A scrolling list (at most 440px or 60% of the screen), newest first, then a "Load more" button when there are more pages.
- **Row:** the actor's avatar (photo, illustrated avatar or initials, 36px), one sentence with the names in bold, a project-key chip when there is one and the time ("2 min. ago", "yesterday", then a short date). Unread rows have a soft brand tint and a dot at the end; clicking a row opens the task, the project board or the members page, marks it read and closes the popover. The five sentences: "{name} assigned you {task}", "{name} commented on {task}", "{name} added you to {project}", "{name} made you an admin (or a member) of {workspace}" and "{name} accepted your invitation to {workspace}", in English and Arabic.
- **States:** items, all read, empty (the illustrated sleeping bell on the peach ground, "You're all caught up"), loading (three skeleton rows) and error (a message and Retry).
- **Behaviour:** the unread count is polled once a minute while the tab is visible; the list loads when the popover opens. No live connection and no separate page.
- **Not built, on purpose:** mentions, due-soon reminders, email or push notifications, settings per event type.
- **Data contracts:** `GET /notifications?cursor&limit`, `GET /notifications/unread-count`, `POST /notifications/:id/read` and `POST /notifications/read-all` (step 5.9, Phase C). **Status:** `[Confirmed Existing Functionality — 5.9c]`.

---

## 6. Bilingual RTL & Internationalization Architecture

1. **Logical Layout Mirroring:**
   - In Arabic mode (`dir="rtl"`), the navigation rail mirrors to the right viewport edge ($x = [1228, 1488]$).
   - Breadcrumbs, chevron navigation arrows (`<` becomes `>`), and table columns mirror symmetrically.
   - All CSS declarations use logical properties (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`).
2. **Typography Harmonization:**
   - Headings dynamically adopt `Cairo` in Arabic and `Plus Jakarta Sans` in English.
   - Body copy, forms, and data tables dynamically adopt `IBM Plex Sans Arabic` in Arabic and `Plus Jakarta Sans` in English.
   - Western Arabic numerals (`0, 1, 2, 3...`) are preserved uniformly across both languages for metric values to ensure consistent tabular width.

---

## 7. Accessibility (WCAG 2.1 AA) Compliance Rules

1. **Text Contrast Standards:**
   - Primary text (`#18181B`) achieves **`14.91:1`** on linen cards (`#F4ECE7`) and **`13.56:1`** on canvas (`#EDE5DE`), far exceeding WCAG AAA ($7.0:1$).
   - Secondary text (`#52525B`) achieves **`6.14:1`** on linen cards, satisfying WCAG AA ($>4.5:1$).
   - Terracotta brand accent (`#C2410C`) achieves **`5.18:1`** on white capsule buttons (`#FFFFFF`).
   - Dedicated terracotta text token (`#9A3412`) achieves **`6.15:1`** on linen cards.
   - All 4 semantic status badges achieve verified contrast ratios exceeding **`4.5:1`**.
2. **Non-Text UI Boundaries & Interactive Focus:**
   - Interactive capsule pills maintain distinct silhouettes against linen card surfaces.
   - All interactive controls provide high-visibility focus rings:  
     `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#C2410C]`.
3. **Screen Reader Compatibility:**
   - Semicircular gauge and progress indicators supply explicit `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` attributes.
   - Status badges include descriptive text labels for assistive technologies.

---

## 8. Summary of Component Design Contracts

| Component ID | Component Name | Visual Archetype | Data Source Contract | Visual & Functional Status |
| :--- | :--- | :--- | :--- | :--- |
| `COMP-NAV-01` | Sidebar Navigation Rail | Obsidian Rail (`#121214`) | Shell Routing & Auth Session | `[Confirmed Existing Functionality]` |
| `COMP-HDR-01` | Top Header Bar | Fluid Header Capsule | Active Route & Auth Session | `[Confirmed Existing Functionality]` |
| `COMP-MOCK-01`| Notification Bell (`🔔`)| White Circular Pill | None (Static Mock UI) | `[Approved Mock UI / Future Feature — Not Functional]` |
| `COMP-KPI-01` | Overview KPI Cards (4) | Linen Cards (`#F4ECE7`) | `getWorkspaceDashboard` (`capacity`, `counts`) + AI quota | `[Confirmed Existing Functionality (Role-Adaptive)]` |
| `COMP-TBL-01` | Project Summary Table | Data Table with Avatars | `listWorkspaceProjects` | `[Confirmed Existing Functionality]` |
| `COMP-TSK-01` | My Tasks Quick-List | Checkbox List with Tabs | `getWorkspaceDashboard` (`myTasks`) | `[Confirmed Existing Functionality]` |
| `COMP-GAU-02` | Dashboard Overall Progress Gauge | Semicircular Gauge in Linen Card | `getWorkspaceDashboard` (`projects[].tasks`) | `[Confirmed Existing Functionality — CS-01]` |
| `COMP-WLD-01` | Dashboard Team Workload | Vertical Bead Stack Chart | `getWorkspaceDashboard` (`workload`, Owner/Admin only) | `[Confirmed Existing Functionality — CS-01]` |
| `COMP-GAU-01` | Semicircular Completion Gauge| Speedometer Gauge Arc | `getProject` (`taskCounts`, on Kanban) | `[Confirmed Existing Functionality — CS-04]` |
| `COMP-KAN-01` | Project Kanban Board | 4+1 Column Board | `listProjectTasks` & Status FSM | `[Confirmed Existing Functionality]` |
| `COMP-DRW-01` | Task Detail Page (was slide-over, changed by user request) | Full page: details + comments, illustrated workflow panel on the right | Task Details, Comments, Restore | `[Confirmed Existing Functionality]` |
| `COMP-AI-01`  | AI Assistant Drawer | Slide-Over Right Sheet | AI Session & Messages API | `[Confirmed Existing Functionality]` (Single Active Canvas) |
| `COMP-AI-02`  | Standalone AI View | Full-Page View (`/assistant`)| AI Knowledge Session (Global) | `[Confirmed Existing Functionality]` |
| `COMP-PRJ-01` | Projects Page | Table with row menu, tabs and plan chip | `listWorkspaceProjects` (filters, `viewer.*`) | `[Confirmed Existing Functionality — CS-08]` |
| `COMP-TSK-02` | My Tasks Page | Grouped list with bucket chips | `listMyTasks` | `[Confirmed Existing Functionality — CS-08]` |
| `COMP-BIL-01` | Account Billing Page | Plan card, meters, banners, dialogs | `getAccountSubscription`, `selectActiveProjects`, `offboard` | `[Confirmed Existing Functionality — CS-07]` |
| `COMP-AUD-02` | Account Audit Trail | Audit table, account scope | `listAuditLogs?accountId` | `[Confirmed Existing Functionality — CS-07]` |
| `COMP-STA-01` | 403 and 404 States | Illustrated full-page states in the shell | `PERMISSION_DENIED`, `RESOURCE_NOT_FOUND` | `[Confirmed Existing Functionality]` |
| `COMP-ACC-01` | Account Menu (header and phone drawer) | Popover with profile link and Sign out | Session (`POST /auth/logout`) | `[Confirmed Existing Functionality]` |
| `COMP-PRF-01` | Profile Page | Identity, footprint, forms, illustrated panel | `getProfile`, `updateProfile`, `changePassword` | `[Confirmed Existing Functionality — CS-09]` |
| `COMP-MKT-01` | Public Landing Page | Marketing Hero Surface | Static Content (`/`) | `[Previously Approved Decision]` (Pricing Deferred) |
| `COMP-DEF-01` | Global Search Bar | Header Search Pill | None (Omitted in MVP) | `[Deferred Functionality]` |

---

## 9. Next Action & Approval Gate

This refined **Design System Specification (`design.md`)** is now submitted for your review.

Upon your explicit approval:
- We will proceed to the **Stitch MCP Screen Generation Phase** to generate pixel-accurate, reference-aligned visual mockups for Veyro's approved screens.
- No frontend Next.js code or dependencies will be written or installed until all mockups pass human review.
