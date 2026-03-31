# RubberJointsAI — Full Build Prompt

> **What this document is:** A comprehensive prompt that describes every aspect of the RubberJointsAI application — its purpose, architecture, data model, UI/UX, AI integration, onboarding flow, and deployment — in enough detail to regenerate the entire app from scratch.

---

## 1. Overview

**App Name:** RubberJointsAI
**Tagline:** "A hilariously serious program to get your joints moving like they should."
**Domain:** Joint health, mobility, and recovery tracking
**Platform:** Mobile-first responsive web app (designed for phone screens, works on desktop)
**Live URL:** Deployed as an Azure App Service (app name: `rjai-app`)

RubberJointsAI is a personalized 4-week joint health and mobility program. Users go through an AI-driven onboarding questionnaire, get a custom plan generated based on their goals/problem areas/equipment, then follow daily exercise checklists and supplement tracking. An AI Coach (powered by Claude) is available throughout for plan adjustments, encouragement, and guidance.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | ASP.NET Core 8.0 with Razor Pages |
| **Language** | C# (backend), HTML/CSS/JS (frontend, inline in Razor Pages) |
| **Database** | Azure SQL Server (serverless tier — has cold-start auto-pause behavior) |
| **DB Access** | Raw ADO.NET via `Microsoft.Data.SqlClient` (no Entity Framework) |
| **AI** | Anthropic Claude API (claude-haiku-4-5-20251001) via HttpClient |
| **Auth** | Cookie-based authentication (ASP.NET Core Identity cookies, 30-day sliding expiration) |
| **Caching** | In-memory cache (`IMemoryCache`) for prefetched page data |
| **Deployment** | Azure App Service via GitHub Actions CI/CD |
| **Timezone** | All dates use Pacific Time (America/Los_Angeles) |

---

## 3. Project Structure

```
RubberJointsAI/
├── Program.cs                              # App config, middleware, ALL API endpoints (~1400 lines)
├── RubberJointsAI.csproj                   # .NET 8 project file
├── appsettings.json                        # Config (connection string placeholder)
├── Data/
│   └── RubberJointsAIRepository.cs         # All SQL queries, table creation, seeding (~2500 lines)
├── Models/
│   └── Exercise.cs                         # All data models and view models (~195 lines)
├── Pages/
│   ├── _Layout.cshtml                      # Shared layout with bottom nav bar
│   ├── _ViewImports.cshtml                 # Razor namespace imports
│   ├── _ViewStart.cshtml                   # Layout assignment
│   ├── AI.cshtml / AI.cshtml.cs            # AI Coach page (chat + onboarding)
│   ├── Index.cshtml / Index.cshtml.cs      # Today page (daily workout checklist)
│   ├── Week.cshtml / Week.cshtml.cs        # Weekly view
│   ├── Progress.cshtml / Progress.cshtml.cs # Progress tracking + milestones
│   ├── Settings.cshtml / Settings.cshtml.cs # User settings, disabled tools
│   ├── Library.cshtml / Library.cshtml.cs  # Exercise reference library
│   ├── Enroll.cshtml / Enroll.cshtml.cs    # Program enrollment
│   ├── Login.cshtml / Login.cshtml.cs      # Login page
│   ├── Register.cshtml / Register.cshtml.cs # Registration page
│   └── Logout.cshtml / Logout.cshtml.cs    # Logout handler
├── wwwroot/
│   └── css/site.css                        # All styles (~2900 lines, light theme, mobile-first)
└── .github/
    └── workflows/deploy.yml                # GitHub Actions → Azure App Service
```

---

## 4. Data Models

### 4.1 Core Entities

**Exercise**
- `Id` (string, PK) — e.g. "brisk_walking", "cars_routine"
- `Name` (string) — display name
- `Category` (string) — one of: `warmup_tool`, `mobility`, `strength`, `recovery_tool`
- `Targets` (string) — comma-separated body areas (e.g. "Hips, Knees, Ankles")
- `Description` (string) — what the exercise does
- `Cues` (string) — pipe-separated form cues
- `Explanation` (string) — detailed explanation
- `Warning` (string, nullable) — safety warnings
- `Phases` (string) — comma-separated phase numbers, e.g. "1,2"
- `DefaultRx` (string, nullable) — default prescription, e.g. "5 min", "30 sec each"

**AppUser**
- `Id` (int, identity PK)
- `Username` (string, unique)
- `PasswordHash` (string)
- `Salt` (string)
- `CreatedDate` (string, yyyy-MM-dd)

**Supplement**
- `Id` (string, PK)
- `Name` (string)
- `Dose` (string) — e.g. "10g", "1000mg"
- `Time` (string) — when to take, e.g. "AM with food"
- `TimeGroup` (string) — `am`, `mid`, or `pm`

**SessionStep** (template for daily exercises)
- `Id` (int, identity PK)
- `DayType` (string) — `gym`, `home`, `recovery`, `rest`
- `ExerciseId` (string, FK)
- `Phase1Rx` / `Phase2Rx` (string, nullable)
- `PhaseOnly` (int, nullable) — null=both phases, 1=phase1 only, 2=phase2 only
- `Section` (string, nullable)
- `SortOrder` (int)

**DailyCheck** (tracks what user checked off each day)
- `Id` (int, identity PK)
- `UserId` (string)
- `Date` (string, yyyy-MM-dd)
- `ItemType` (string) — `step` or `supplement`
- `ItemId` (string) — exercise ID or supplement ID
- `StepIndex` (int, nullable)
- `Checked` (bool)

**Milestone**
- `Id` (string, PK)
- `Name` (string)
- `Done` (bool)
- `AchievedDate` (string, nullable)

**SessionLog** (historical completion records)
- `Id` (int, identity PK)
- `UserId` (string)
- `Date` (string)
- `StepsDone` (int)
- `StepsTotal` (int)

**UserSettings**
- `UserId` (string, PK)
- `StartDate` (string, nullable)
- `DisabledTools` (string) — comma-separated exercise IDs the user disabled

### 4.2 Program & Plan Entities

**TrainingProgram**
- `Id` (int, PK)
- `Name` (string)
- `DurationDays` (int) — e.g. 28 for a 4-week program
- `Description` (string)

**ProgramTemplate** (master template for a program)
- `Id` (int, PK)
- `ProgramId` (int, FK)
- `DayNumber` (int) — 1-28
- `DayType` (string)
- `ExerciseId` (string)
- `Category` (string)
- `SortOrder` (int)
- `Rx` (string, nullable)

**UserEnrollment**
- `Id` (int, PK)
- `UserId` (string)
- `ProgramId` (int, FK)
- `StartDate` (string, yyyy-MM-dd)
- `Status` (string) — `active`, `completed`, `paused`

**UserDailyPlanEntry** (personalized daily plan per user)
- `Id` (int, PK)
- `UserId` (string)
- `ProgramId` (int)
- `Date` (string, yyyy-MM-dd)
- `DayType` (string)
- `ExerciseId` (string)
- `Category` (string)
- `SortOrder` (int)
- `Rx` (string, nullable)
- `AiAdjusted` (bool) — flagged if AI modified this entry
- `IsManual` (bool) — flagged if user manually added

### 4.3 User Preferences (Onboarding State)

**UserPreferences**
- `UserId` (string, PK)
- `HasGym` (bool)
- `DaysPerWeek` (int, default 3)
- `OnboardingStep` (int) — 0=welcome, 1=AI questionnaire, 2=generate/customize choice, 3=warmup picker, 4=mobility picker, 5=recovery picker, 6=supplement picker, 7=complete
- `SelectedExercises` (string) — comma-separated exercise IDs chosen during onboarding
- `SelectedSupplements` (string) — comma-separated supplement IDs
- `ProfileNotes` (string) — AI-generated summary of user's goals, problem areas, activity level, equipment, injuries

---

## 5. Program Structure

The program is a **4-week (28-day) plan** with two phases:

- **Phase 1 — Foundation (Weeks 1-2):** Gentler exercises, lower intensity
- **Phase 2 — Progression (Weeks 3-4):** More challenging exercises, increased volume

### Day Types

The weekly schedule follows this pattern (configurable by days_per_week):
- Monday = gym
- Tuesday = home
- Wednesday = gym
- Thursday = home
- Friday = gym
- Saturday = recovery
- Sunday = rest

Day types determine which exercises appear. When users select fewer days per week, some days become rest days.

### Exercise Categories

1. **warmup_tool** — Pre-workout warm-ups (Brisk Walking, Arm Circles, Leg Swings, Rowing Machine, Jump Rope, etc.)
2. **mobility** — Core mobility work (CARs Routine, Cable Face Pulls, Banded Ankle Distraction, Hip 90/90, etc.)
3. **recovery_tool** — Recovery aids (Foam Roller, Massage Gun, Quality Sleep, Cold Plunge, Sauna, etc.)
4. **strength** — Light strengthening (used sparingly)

---

## 6. Onboarding Flow (State Machine)

The onboarding is a 7-step state machine managed via `UserPreferences.OnboardingStep`:

### Step 0: Welcome
- AI sends a warm, funny welcome message
- App shows a "Let's Go" button
- On click → Step 1

### Step 1: AI Questionnaire (Conversational)
- Claude conducts a natural conversation asking ONE question at a time
- Gathers: goals/motivation, problem areas, activity level, equipment, days per week, injuries/cautions
- Uses tool_use: `finalize_onboarding` tool saves profile and moves to Step 2
- AI model: claude-haiku-4-5-20251001 with 600 max_tokens

### Step 2: Generate or Customize Choice
- App shows two choice cards:
  - **"Quick Start"** — Uses ALL exercises, auto-generates plan → jumps to Step 7
  - **"Customize First"** — User picks exercises per category → Step 3
- Also shows a days-per-week selector (2-6 days)

### Step 3: Warm-Up Picker
- All warm-up exercises shown ON by default (deselect mode)
- User taps to remove exercises they don't want
- Confirm button → Step 4

### Step 4: Mobility Picker
- Same deselect pattern for mobility exercises → Step 5

### Step 5: Recovery Picker
- Same deselect pattern for recovery tools → Step 6

### Step 6: Supplement Picker
- All supplements shown OFF by default (select mode — opt-in)
- User taps to add supplements they want to track
- Confirm button → Step 7 (plan generated)

### Step 7: Complete
- Plan is generated via `GenerateCustomPlanAsync()`
- AI sends celebratory message with joint humor
- "START TRAINING" button appears linking to /Index
- Onboarding lock on other pages is released

### Page Locking During Onboarding
While `OnboardingStep < 7`, all pages except /AI, /Login, /Logout, and /api/* redirect to /AI.

---

## 7. AI Coach Integration

### Architecture
- All AI calls go through `/api/ai/chat` endpoint
- Uses Anthropic API with claude-haiku-4-5-20251001
- Two modes: Onboarding (questionnaire) and Regular Chat (tool use)

### Onboarding Mode Tools
```
finalize_onboarding(profile_summary, days_per_week, problem_areas, has_equipment)
```

### Regular Chat Mode Tools
```
get_all_exercises(category?)          — List available exercises
add_exercise_to_plan(exercise_id, category) — Add exercise from today forward
remove_exercise_from_plan(exercise_id)      — Remove from future plan days
add_supplement(supplement_id, time_group)   — Add supplement to routine
remove_supplement(supplement_id)            — Remove supplement
get_all_supplements()                       — List all supplements
update_training_days(days_per_week)         — Change training frequency + regenerate
create_custom_exercise(name, category, targets, default_rx) — Add new exercise to catalog + plan
create_custom_supplement(name, time, time_group)            — Add new supplement to catalog + routine
```

### Tool Use Loop
- Max 5 iterations per request
- AI can chain multiple tool calls
- After tool execution, results are fed back and AI generates a final text response

### System Prompt (Regular Chat)
The system prompt is dynamically built and includes:
- Tone/behavior rules (warm, funny, encouraging, mobile-concise)
- Scope restrictions (joint health/mobility only — rejects off-topic requests)
- Safety rules for custom items (rejects strength exercises, weapons, illegal substances, food items, etc.)
- User profile notes from onboarding
- Live data: today's exercises with completion status, all available exercises, supplements, milestones, 7-day session history
- Tool use instructions

### AI Personality Rules
- 2-4 short paragraphs max (mobile users)
- Always encouraging — celebrate any progress
- Joint/mobility humor welcome
- Never diagnose injuries or act as doctor/PT
- Never invent exercises or data not in the system
- Off-topic deflection: "I'm your mobility coach and can only help with your joint workout program"

---

## 8. Pages & UI

### Layout (_Layout.cshtml)
- Bottom navigation bar with 5 tabs: AI Coach, Today, Week, Progress, Settings
- Mobile-first, iOS-inspired design
- Light theme with CSS variables

### AI Page (/AI)
- Full-screen chat interface
- Chat sidebar with conversation history (New Chat button)
- During onboarding: shows "Getting to know you" header
- Post-onboarding: shows Week X of 4 progress bar, phase name, and "START TRAINING" button
- Joint-themed joke card at top
- Real-time stats line (exercises done / supplements taken today)
- Prefetches Today page data in background via `/api/today-prefetch`
- Interactive onboarding UI components rendered inline (choice cards, picker grids, confirm buttons)

### Today Page (/Index)
- Day navigation with left/right arrows and weekly calendar strip
- Category-grouped exercise checklist (Warm-Up, Mobility, Recovery)
- Each exercise shows: name, targets, Rx, checkbox
- Category progress bars (e.g. "Mobility 3/5")
- Supplement checklist grouped by time (AM, MID, PM)
- "Log Session" button at bottom
- Past dates are viewable; future dates are read-only (no checkboxes)
- Uses prefetch cache when available for instant load

### Week Page (/Week)
- Weekly overview showing each day's plan
- Day type indicators (gym/home/recovery/rest)
- Completion status per day

### Progress Page (/Progress)
- Current week/phase display
- Sessions this week count
- Today's completion stats (exercises + supplements)
- Milestone tracker with achievement dates
- "Log Session" button

### Settings Page (/Settings)
- Disabled tools management (toggle exercises on/off)
- Start date display
- User preferences

### Library Page (/Library)
- Searchable exercise reference
- Shows all exercises with descriptions, cues, targets

### Enroll Page (/Enroll)
- Program selection for users without active enrollment
- Starts the 4-week program

### Login / Register
- Simple username/password auth
- Password hashing with PBKDF2 (SHA-512, 10000 iterations, 32-byte random salt)
- No email required for registration

---

## 9. API Endpoints

All endpoints require authentication (cookie-based) except login/register.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ai-stats` | Today's exercise/supplement completion counts |
| GET | `/api/today-prefetch` | Prefetch and cache Today page data |
| POST | `/api/check` | Toggle exercise/supplement checkbox |
| POST | `/api/plan/add` | Add exercise to daily plan |
| POST | `/api/plan/remove` | Remove exercise from future plans |
| POST | `/api/preferences/toggle` | Toggle exercise/supplement in preferences + regenerate plan |
| GET | `/api/exercises?category=X` | Get exercises by category |
| GET | `/api/supplements/available?timeGroup=X` | Get supplements not yet in user's time group |
| POST | `/api/supplements/add` | Add supplement to user's active list |
| GET | `/api/debug` | Debug endpoint showing checks data |
| POST | `/api/milestone` | Mark milestone as complete |
| POST | `/api/logsession` | Log today's session completion |
| POST | `/api/ai/chat` | AI chat (onboarding + regular mode) |

---

## 10. Database Layer

### Repository Pattern
- Single class: `RubberJointsAIRepository`
- Raw SQL via `Microsoft.Data.SqlClient` (no ORM)
- Connection string injected via DI
- 120-second connection timeout for Azure SQL serverless cold starts

### Initialization
- `InitializeAsync()` → `EnsureTablesExistAsync()` creates all tables if they don't exist (IF NOT EXISTS pattern)
- Seeds default exercises, supplements, milestones, and programs
- DB init runs at startup with retry (3 attempts, 5s between)

### Key Operations
- `GenerateCustomPlanAsync(userId, prefs)` — Generates 28-day personalized plan based on selected exercises and days_per_week
- `RegenerateFuturePlanAsync(userId, prefs)` — Regenerates future plan days when preferences change
- `AddManualPlanEntryWithFutureAsync(userId, date, exerciseId, category)` — Adds exercise to today and all future plan days
- `RemoveExerciseFromFuturePlanAsync(userId, exerciseId, today)` — Removes exercise from today and future
- User supplement management with time-group scheduling
- Session logging and milestone tracking

---

## 11. Styling

### Design Language
- Light theme, iOS-inspired
- Mobile-first (designed for 375px+ screens)
- System font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif`
- CSS custom properties for theming

### Color Palette
```css
--bg: #f5f5f7;      /* Page background */
--s1: #ffffff;       /* Card surface */
--s2: #f0f0f3;      /* Secondary surface */
--s3: #e5e5ea;       /* Tertiary surface */
--brd: #d1d1d6;     /* Borders */
--tx: #1c1c1e;      /* Primary text */
--tx2: #636366;      /* Secondary text */
--tx3: #8e8e93;      /* Muted text */
--acc: #4a6cf7;      /* Accent blue */
--grn: #34c759;      /* Success green */
--org: #ff9500;      /* Warning orange */
--red: #ff3b30;      /* Error red */
--pur: #af52de;      /* Purple accent */
--yel: #ffcc00;      /* Gold/yellow */
```

### Key UI Patterns
- Cards with rounded corners (12-14px border-radius)
- Bottom tab navigation (fixed)
- Sticky top bars per page
- Checkbox-style exercise completion
- Category progress bars
- Chat bubbles for AI interface
- Picker grids for onboarding (2-column, scrollable)
- Choice cards for binary selections

---

## 12. Security

### Headers (set via middleware)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self'; frame-ancestors 'self'`

### Cookie Hygiene
- Strips Azure `ARRAffinity` and `ARRAffinitySameSite` cookies
- Strips unused antiforgery cookies
- Auth cookie: HttpOnly, Secure, SameSite=Lax

### Password Hashing
- PBKDF2 with SHA-512
- 10,000 iterations
- 64-byte hash, 32-byte random salt
- Salt stored alongside hash

---

## 13. Deployment

### GitHub Actions Workflow
- Trigger: push to `main` branch
- Steps: checkout → setup .NET 8 → build → publish → deploy to Azure App Service
- Uses Azure Web App publish profile stored as GitHub secret

### Azure Configuration
- App Service name: `rjai-app`
- Resource group: `1000problems-rg`
- Connection string: set in Azure App Settings (key: `ConnectionStrings__DefaultConnection`)
- Anthropic API key: set in Azure App Settings (key: `Anthropic__ApiKey`)
- Azure SQL: serverless tier with auto-pause (requires 120s connection timeout + retry logic)

### DB Init Retry Pattern
```csharp
for (int attempt = 1; attempt <= 3; attempt++)
{
    try {
        repository.InitializeAsync().GetAwaiter().GetResult();
        break;
    } catch (Exception ex) {
        if (attempt < 3) Thread.Sleep(5000);
    }
}
```

---

## 14. Key Behaviors & Edge Cases

1. **Azure SQL Auto-Pause:** The serverless DB pauses after inactivity. First connection can take 60+ seconds. Connection timeout is set to 120s with 3 retry attempts.

2. **Plan Regeneration:** When user changes preferences (add/remove exercise, change days/week), future plan days are regenerated while past days are preserved.

3. **Date Handling:** All dates use Pacific Time. The app converts UTC to `America/Los_Angeles` timezone for all date calculations.

4. **Prefetch Cache:** The AI page prefetches Today page data in the background via `/api/today-prefetch`, cached for 60 seconds in memory. The Today page checks this cache first before querying the DB.

5. **Onboarding Page Lock:** During onboarding (step < 7), navigating to Index, Week, Progress, or Settings redirects to /AI. This is enforced via middleware.

6. **Custom Exercise/Supplement Safety:** The AI Coach enforces strict rules — only joint health/mobility/recovery items can be created. Strength exercises, weapons, illegal substances, food, and joke items are rejected with friendly humor.

7. **Authenticated root redirect:** `/` redirects to `/AI` for logged-in users. The Today page is always at `/Index`.

8. **Session Logging:** Users can log their session once per day, recording steps completed vs total.

---

## 15. Seed Data

The repository seeds a comprehensive exercise library on first run, including:

**Warm-Up Tools:** Brisk Walking, Arm Circles, Leg Swings, Rowing Machine, Jump Rope, Light Cycling, High Knees, Butt Kicks

**Mobility Exercises:** CARs Routine (Controlled Articular Rotations), Cable Face Pulls, Banded Ankle Distraction, Hip 90/90, Thoracic Spine Extensions, Shoulder Dislocates, Wrist Circles, Neck CARs, Cat-Cow, World's Greatest Stretch

**Recovery Tools:** Foam Roller, Massage Gun, Quality Sleep, Epsom Salt Bath, Cold Plunge, Sauna, Lacrosse Ball, Yoga

**Supplements:** Collagen Peptides, Glucosamine, MSM, Turmeric/Curcumin, Omega-3, Vitamin D3, Magnesium, Hyaluronic Acid, Boswellia, Tart Cherry Extract

**Milestones:** First Session, First Week Complete, All Supplements Taken (1 day), 5 Sessions, Phase 2 Unlocked, 3-Week Streak, Program Complete

---

## 16. Humor & Tone

The app has a distinctive personality — "hilariously serious." Examples:

- Joint-themed jokes rotate on the AI page (e.g. "I told my knees we're doing mobility work. They cracked up.")
- AI Coach uses joint/mobility humor in responses
- Error states are friendly, never blaming
- Progress celebration is over-the-top encouraging
- The tagline captures it: your joints called, and they want better treatment

---

*This prompt contains everything needed to rebuild RubberJointsAI from scratch. The app is a single-repo monolith — all backend logic in Program.cs, all DB access in RubberJointsAIRepository.cs, all models in Exercise.cs, all styles in site.css, and all pages as Razor Pages with inline JavaScript.*
