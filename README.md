# BunkBook 📓

> **Your attendance diary, one bunk at a time.**

BunkBook is a mobile-first Progressive Web App (PWA) built for college students who need to stay on top of their attendance. It lets you mark classes in one tap, instantly see how many more you can safely skip, and get push notification reminders before class — all without installing anything from an App Store.

---

## ✨ Features

- **One-tap attendance marking** — Mark Present, Absent, or Cancelled directly from the dashboard or calendar.
- **Safe Bunks counter** — The hero metric is not a percentage, it's the exact number of classes you can still miss before falling below your required attendance.
- **Calendar view** — A full month view with color-coded dots for each class, day-level overrides (Holiday / Mass Bunk), and a tappable day-detail panel.
- **AI-powered timetable import** — Paste your raw college timetable and let a ChatGPT prompt format it for you, or import a classmate's JSON template directly.
- **Per-subject analytics** — See detailed attendance stats, logbook of absences, and bunkability scores for each subject.
- **PWA / Installable** — Works offline after the first load. Add to Home Screen for a native app experience (no App Store required).
- **Web Push Notifications** — Get a reminder 10 minutes before a class starts with one-tap "✓ Present / ✗ Absent" action buttons on your lock screen.
- **Dark & Light Mode** — Switch between the light "Powder Blue" notebook theme and a rich dark "Ink" theme manually via Settings, or let it sync automatically with your OS.

---

## 🛠️ Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Server Components for fast initial load, file-based routing |
| **Database** | Supabase (PostgreSQL) | Row Level Security, built-in auth, real-time capable |
| **Authentication** | Supabase Auth | Email/password login with session cookies |
| **Client State / Cache** | SWR | Optimistic UI updates shared across pages |
| **Styling** | Tailwind CSS v4 + CSS Variables | Custom design system, auto dark mode via `prefers-color-scheme` |
| **Animations** | Framer Motion | Smooth micro-interactions and page transitions |
| **PWA** | `@ducanh2912/next-pwa` | Service worker generation, offline support, installability |
| **Push Notifications** | Web Push + VAPID | Background lock-screen notifications with action buttons |
| **Fonts** | Outfit + Plus Jakarta Sans | Premium, modern feel |

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier is fine)
- [mkcert](https://github.com/FiloSottile/mkcert) *(optional, for local HTTPS on mobile)*

### 1. Clone and install

```bash
git clone https://github.com/vaishnavifrsharma/Bunkbook.git
cd bunkbook/attendance-app
npm install
```

### 2. Set up environment variables

Create a `.env.local` file in the `attendance-app/` directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:you@example.com
CRON_SECRET=a_random_secret_string
```

To generate VAPID keys, run:
```bash
npx web-push generate-vapid-keys
```

### 3. Apply database migrations

In your Supabase Dashboard → **SQL Editor**, run the contents of:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_push_subscriptions.sql`

### 4. Run the development server

```bash
npm run dev
```

Open [https://localhost:3000](https://localhost:3000) in your browser.

> **For mobile testing:** The dev server also runs on your local network. Find your machine's IP (e.g. `192.168.1.x`) and open `https://192.168.1.x:3000` in Safari on your phone. Accept the self-signed certificate warning to proceed.

---

## ☁️ Deployment (Vercel)

1. Push your code to a GitHub repository.
2. Go to [Vercel.com](https://vercel.com) → **Add New Project** → select your repo.
3. In the project settings, add all the environment variables from your `.env.local`.
4. Click **Deploy**. That's it — you'll have a live `https://` URL in ~2 minutes.

> **Tip:** After deploying, update your Supabase Dashboard under **Authentication → URL Configuration** to add your new Vercel domain to the allowed redirect URLs.

---

## 📁 Project Structure

```
attendance-app/
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── dashboard/        # Main dashboard (Today's Classes, Subject Cards)
│   │   ├── calendar/         # Monthly calendar view
│   │   ├── subject/[id]/     # Per-subject detail & logbook
│   │   ├── timetable/        # Timetable editing & bulk import
│   │   ├── semesters/        # Semester management
│   │   ├── settings/         # User settings
│   │   └── api/              # API routes (push/subscribe, cron/reminders)
│   ├── components/
│   │   ├── auth/             # Login / Sign-up form
│   │   ├── dashboard/        # Subject cards
│   │   ├── forms/            # Subject & Absence forms
│   │   ├── notebook/         # UI shell (spiral binding, notebook layout)
│   │   └── ui/               # Shared UI primitives (Button, Modal, etc.)
│   └── lib/
│       ├── attendance.ts     # Core attendance & bunkability calculations
│       ├── calendar-utils.ts # Date utilities for the calendar
│       ├── push-utils.ts     # Web Push subscription helper
│       ├── useAttendanceData.ts # SWR shared data hook
│       └── types.ts          # Shared TypeScript types
├── worker/
│   └── index.ts              # Custom Service Worker (handles push events)
└── supabase/
    └── migrations/           # SQL migration files
```

---

## 📄 License

MIT — feel free to fork and adapt for your institution.
