# Bhawani Enterprises — Digital Register & Shop Ledger PWA

A high-performance, production-ready, local-first Progressive Web App (PWA) designed as a digital ledger to replace physical paper registers for single-owner retail shops. It is optimized for mobile browsers (specifically Android phones) with zero-latency writes (< 5ms), offline-first capabilities, and automatic cloud synchronization.

---

## 🚀 Key Features

* **Local-First Architecture**: Writes are saved instantly to the local IndexedDB database using Dexie.js, ensuring saving a transaction takes under 5 seconds (typically milliseconds).
* **Automatic Background Sync**: A background sync worker monitors network status and pushes buffered operations to Supabase in order of execution.
* **Authoritative Ledger Bookkeeping**: Cash in Shop and Wallet balances are calculated as `Opening Balance + Sum(Ledger Entries) + Sum(Adjustment Entries)`. Balances cannot be directly overwritten, ensuring a complete audit trail.
* **Dynamic Wallet Selection**: Toggle wallet selection on or off per service. Supports automatic defaults (e.g. Jio Wallet for Jio Recharge) to minimize taps.
* **Transaction Recovery (Soft Delete)**: Accidentally deleted transactions can be restored instantly from the "Recently Deleted" settings pane, automatically recalculating all ledger balances.
* **PDF Export & Reports**: Generate beautiful PDF ledger sheets and business statements (Today, Yesterday, Custom Period, This Month) directly in the browser. Works 100% offline.
* **Single Admin Login**: Simple Username & Password login. Sessions are persisted and restored automatically.

---

## 🛠️ Tech Stack

* **Frontend**: Next.js 16 (App Router), React 19, TypeScript
* **Styling**: Tailwind CSS v4, shadcn/ui
* **Local Storage**: Dexie.js (IndexedDB wrapper)
* **Cloud Database & Auth**: Supabase (PostgreSQL, GoTrue Auth)
* **PDF Generation**: jsPDF, jsPDF-AutoTable

---

## 📂 Project Structure

```
├── public/
│   ├── logo.svg              # Custom application brand vector logo
│   ├── manifest.json         # PWA Manifest configuration
│   └── sw.js                 # Service Worker (caches static assets & pages offline)
├── src/
│   ├── app/
│   │   ├── ledger/           # Transaction history with filters (Search, Date, Wallets, Services)
│   │   ├── login/            # Simple Admin Username/Password login form
│   │   ├── reports/          # Financial summaries and PDF export interface
│   │   ├── settings/         # Configuration panel (Manage Services, Wallets, soft-deleted restore)
│   │   ├── transaction/      # Reusable Transaction Screen with quick amounts and tactile feedback
│   │   ├── globals.css       # Tailwind CSS v4 imports & shadcn oklch color configurations
│   │   └── layout.tsx        # App layout containing SW registration and context providers
│   ├── components/
│   │   ├── layout/           # Bottom Nav tab panel, Service Worker register
│   │   ├── setup/            # First-Time Setup Wizard (Opening Cash & Wallets)
│   │   └── ui/               # Reusable shadcn buttons, inputs, selects, dialogs, switches, tabs
│   ├── context/
│   │   ├── AuthContext.tsx   # Sign-in state, session restoring, path protection
│   │   └── DatabaseContext.tsx# Authoritative ledger math, atomic transfers, Dexie initialization, sync queue
│   └── lib/
│       ├── db.ts             # Dexie.js schema specifications and tables
│       └── supabase.ts       # Supabase client utility and setup detector
├── supabase_schema.sql       # Database migration script for PostgreSQL / Supabase
└── package.json
```

---

## 💾 Database Setup (Supabase)

1. Create a new project on [Supabase](https://supabase.com).
2. Navigate to the **SQL Editor** tab in your Supabase dashboard.
3. Paste the contents of the `supabase_schema.sql` file (found in the root of this project) into the editor.
4. Click **Run** to create the tables, seed the default services/settings, and enable Row Level Security (RLS) policies.
5. In your Supabase project settings, go to **Authentication -> Providers**, enable the **Email** provider, and toggle off **Confirm Email** (to allow instant shop setup).
6. Create an admin user under the Auth dashboard by clicking **Add User -> Create User**. Input the desired email (which matches `<username>@bhawani.com`) and password.

---

## ⚙️ Environment Configuration

Create a `.env.local` file in the root of the project:

```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

> 💡 **Local Fallback Mode**: If these keys are missing or left as blank, the application will automatically run in **Local Mode**. The shop register will be 100% functional, storing all data in the device's local database. When you configure the keys later and rebuild, the sync queue will automatically push all historical data to the cloud.

---

## 🏃 Running the Application

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the local development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

---

## 📱 PWA Installation on Android (Chrome)

1. Open Chrome on your Android device and navigate to your deployed site.
2. Tap the **three-dot menu icon** in the top-right corner.
3. Select **Add to Home screen** or **Install app**.
4. The digital register will now behave as a native Android app: it launches standalone (no browser address bar), runs in portrait lock, and caches assets locally to load instantly even without an internet connection.
