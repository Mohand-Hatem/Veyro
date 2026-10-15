# Veyro Design System Specification (`design.md`)

**Document Version:** 2.1.0 (Refined & Qualified Specification)  
**Phase:** Phase 4 — UI Design & Frontend Preparation  
**Step:** STEP-4.3: Design System Documentation & Refinement  
**Status:** DRAFT SPECIFICATION — AWAITING EXPLICIT USER APPROVAL  
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

### 5.5. Today Tasks Quick-List (`COMP-TSK-01` — Bottom Tier, ~58% Width)

- **Visual Decision:** Soft linen card (`#F4ECE7`, $20\text{px}$ radius) occupying the left column of Row 3 ($680\text{px}$ width). Top header contains bold title `"Today task"` ($18\text{px}$) and horizontal category tabs: `All`, `Urgent`, `High`, `In Review`. Active tab (`Urgent`) is styled with an Electric Blue underline indicator bar (`#2563EB`, $3\text{px}$ height). Task list items contain:
  1. Circular checkbox control ($20\text{px}$). Completed tasks render a terracotta filled circle with white checkmark (`✓`); pending tasks render a thin circular outline.
  2. Task title ($14\text{px}$ `#18181B`).
  3. Priority / status pill (`Approved`, `In Review`, `In Progress`, `To Do`).
- **Behavioral Decision:** Clicking a checkbox immediately triggers `PATCH /api/v1/tasks/:id` with optimistic UI update. Clicking task title opens Task Detail Drawer (`SCR-TSK-01`). Clicking tabs filters list in-memory.
- **Data Contract:** `GET /api/v1/projects/:projectId/tasks` (filtered by assignee `currentUserId`).
- **Verification Status:** **`[Confirmed Existing Functionality]`**
- **Deferred Elements:** None.

---

### 5.6. Resolution of Dashboard Right-Side Slots (Middle-Right & Bottom-Right)

The reference features two visual cards on the right side of the dashboard:
- Middle-Right: Semicircular completion gauge (`crops_hd/overall_progress.png`).
- Bottom-Right: Member workload bubble stack chart (`crops_hd/workload.png`).

Per approved decisions:
1. The Semicircular Completion Gauge was **relocated to the Project Kanban Page (`SCR-PRJ-01`)** because Veyro computes task completion at the project level, not workspace-wide, and no workspace-wide completion aggregation endpoint exists in `docs/06`.
2. The Workload Bubble Chart was **deferred from MVP** because Veyro lacks a workspace-wide member workload aggregation endpoint.

#### Specification for the Dashboard Right-Side Slots:
To preserve the reference's asymmetric grid composition ($58\% / 34\%$) without inventing unauthorized features, fake data, or unapproved backend aggregation endpoints, the dashboard right-side slots are documented as follows:

```
┌───────────────────────────────────────────────┬──────────────────────────────────────────────┐
│ LEFT COLUMN (~58% Width, 680px)               │ RIGHT COLUMN (~34% Width, 400px)             │
├───────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ PROJECT SUMMARY DATA TABLE                    │ [SLOT 1: Reserved Workspace Analytics Slot]  │
│ • Real Prisma Project records                 │ • Styled #F4ECE7 container with subtle state │
│ • Members, Tasks, Status, Date                │ • Explicitly marked Deferred / Reserved      │
├───────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ TODAY TASKS QUICK-LIST                        │ [SLOT 2: Reserved Team Workload Slot]        │
│ • Real assigned Task records                  │ • Styled #F4ECE7 container with subtle state │
│ • Tabs, Checkbox PATCH, Status Pills          │ • Explicitly marked Deferred / Reserved      │
└───────────────────────────────────────────────┴──────────────────────────────────────────────┘
```

- **Slot 1 (Middle-Right — Height $\approx 360\text{px}$):**
  - **Visual Treatment:** Styled linen card container (`#F4ECE7`, $20\text{px}$ radius).
  - **Functional Status:** **`[Reserved Workspace Analytics Slot — Deferred from MVP Scope]`**.
  - **Content:** Displays an elegant, clean reserved state: *"Workspace Analytics — Aggregate workspace metrics will activate as project volume grows."*
  - **Data Contract:** None. Zero network requests dispatched.
- **Slot 2 (Bottom-Right — Height $\approx 360\text{px}$):**
  - **Visual Treatment:** Styled linen card container (`#F4ECE7`, $20\text{px}$ radius).
  - **Functional Status:** **`[Reserved Team Workload Slot — Deferred from MVP Scope]`**.
  - **Content:** Displays an elegant, clean reserved state: *"Team Workload — Member workload distribution is deferred pending Phase 5 team analytics."*
  - **Data Contract:** None. Zero network requests dispatched.

> **Trade-Off Analysis & Alternate Option:**  
> - **Option A (Recommended — Preserved Grid):** Retains the 2-column asymmetric layout with reserved cards. Preserves the exact spatial hierarchy and visual density of the reference, ensuring that the Project Summary Table and Today Tasks do not stretch unnaturally wide on desktop viewports ($1180\text{px}$).
> - **Option B (Full-Width Expansion):** Expands the Project Summary Table and Today Tasks to full width (`col-span-12`, $1180\text{px}$), eliminating the right-side cards completely. This removes reserved cards, but departs from the reference's 2-column composition and creates very wide table rows.  
> *Both options are fully documented; Option A is recommended for reference fidelity.*

---

### 5.7. Project Kanban Board & Semicircular Completion Gauge (`COMP-KAN-01`, `COMP-GAU-01`)

- **Visual Decision:**
  - **Semicircular Speedometer Gauge (`COMP-GAU-01`):** Visually positioned in the project header bar on `SCR-PRJ-01` (Kanban page). Displays a 180-degree semicircular dial, radial tick markers (`0`, `25`, `50`, `100`), segmented colored arc (green for Done, amber for In Review, terracotta for In Progress, gray for Todo), prominent center percentage (`"72%"`), and 4 counter metrics below.
  - **Kanban Columns (`COMP-KAN-01`):** 4 active columns (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`) plus collapsible `CANCELLED`. Task cards are `#FFFFFF` pills with $14\text{px}$ radius, priority pill, due date chip, and assignee avatar.
- **Behavioral Decision:** Drag-and-drop moves cards between columns, dispatching `PATCH /api/v1/tasks/:id` with new status. Dragging a card out of `DONE` or `CANCELLED` intercepts the drop and displays the Task Reopen Reason Dialog (`SCR-TSK-02`).
- **Data Contract:** `GET /api/v1/projects/:projectId/tasks` (paginated, default limit 20, max limit 100 via `QueryTasksDto`).
- **Verification Status:**
  - Kanban Board: **`[Confirmed Existing Functionality]`**
  - Completion Gauge: **`[Pending Data-Contract Verification]`**  
    *Limitation Rationale:* The task retrieval endpoint is paginated (`limit <= 100`). If a project contains $>100$ tasks, the client only holds a partial page and cannot compute an accurate full-project completion percentage without a dedicated status aggregation endpoint. To maintain strict engineering honesty, the gauge is documented visually but marked as pending contract verification.
- **Deferred Elements:** None.

---

### 5.8. AI Assistant Drawer & Standalone View (`COMP-AI-01`, `COMP-AI-02`)

- **Visual Decision:** Slide-over right drawer ($440\text{px}$ width) with obsidian header matching sidebar. Main chat canvas uses warm linen `#F4ECE7`. Chat bubbles: User messages are white pills with terracotta accents; Assistant messages are soft cream surfaces. Includes structured citation pills (`[TASK-101]`) and embedded Action Confirmation Cards (`SCR-AI-02`).
- **Behavioral Decision:** Single active conversation model without a history sidebar. When users submit prompts, streamed tokens render in real time. Action proposals display inline "Confirm" / "Reject" buttons.
- **Data Contract:** `GET /api/v1/ai/conversations` (retrieves active session), `POST /api/v1/ai/conversations` (creates session), `POST /api/v1/ai/chat` (sends message/prompt), `POST /api/v1/ai/actions/execute` (confirms pending action).
- **Verification Status:** **`[Confirmed Existing Functionality]`** (Single active canvas restored across page refresh).
- **Deferred Elements:** Conversation history archive sidebar is deferred.

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
| `COMP-KPI-01` | Overview KPI Cards (4) | Linen Cards (`#F4ECE7`) | Subscription, Projects, AI Quota | `[Confirmed Existing Functionality (Role-Adaptive)]` |
| `COMP-TBL-01` | Project Summary Table | Data Table with Avatars | `listWorkspaceProjects` | `[Confirmed Existing Functionality]` |
| `COMP-TSK-01` | Today Tasks Quick-List | Checkbox List with Tabs | `listProjectTasks` | `[Confirmed Existing Functionality]` |
| `COMP-SLOT-01`| Dashboard Analytics Slot | Linen Card (`#F4ECE7`) | None (Reserved Silhouette) | `[Reserved Workspace Analytics Slot — Deferred from MVP Scope]` |
| `COMP-SLOT-02`| Dashboard Workload Slot | Linen Card (`#F4ECE7`) | None (Reserved Silhouette) | `[Reserved Team Workload Slot — Deferred from MVP Scope]` |
| `COMP-GAU-01` | Semicircular Completion Gauge| Speedometer Gauge Arc | `listProjectTasks` (on Kanban) | `[Pending Data-Contract Verification]` (Pagination) |
| `COMP-KAN-01` | Project Kanban Board | 4+1 Column Board | `listProjectTasks` & Status FSM | `[Confirmed Existing Functionality]` |
| `COMP-DRW-01` | Task Detail Slide Drawer| Slide-Over Right Sheet | Task Details, Comments, Restore | `[Confirmed Existing Functionality]` |
| `COMP-AI-01`  | AI Assistant Drawer | Slide-Over Right Sheet | AI Session & Messages API | `[Confirmed Existing Functionality]` (Single Active Canvas) |
| `COMP-AI-02`  | Standalone AI View | Full-Page View (`/assistant`)| AI Knowledge Session (Global) | `[Confirmed Existing Functionality]` |
| `COMP-MKT-01` | Public Landing Page | Marketing Hero Surface | Static Content (`/`) | `[Previously Approved Decision]` (Pricing Deferred) |
| `COMP-DEF-01` | Global Search Bar | Header Search Pill | None (Omitted in MVP) | `[Deferred Functionality]` |
| `COMP-DEF-02` | Workload Bubble Chart | Vertical Bead Stack Chart | None (Omitted in MVP) | `[Deferred Functionality]` |

---

## 9. Next Action & Approval Gate

This refined **Design System Specification (`design.md`)** is now submitted for your review.

Upon your explicit approval:
- We will proceed to the **Stitch MCP Screen Generation Phase** to generate pixel-accurate, reference-aligned visual mockups for Veyro's approved screens.
- No frontend Next.js code or dependencies will be written or installed until all mockups pass human review.
