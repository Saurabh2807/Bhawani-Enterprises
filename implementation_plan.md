# Implementation Plan: Profit & Commission System (Core Accounting Upgrade)

This plan details the implementation of a full Profit & Commission System inside the Bhawani Enterprises PWA. It replaces the transaction "Notes" field with "Commission" as a core numeric accounting field. It introduces a configurable Commission Rules settings page, modifies the wallet load modal to Add/Deduct type with operator commission credits (for Jio and Airtel) split into two ledger entries, creates transaction edit screens with balance recalculation, and updates reports & PDF exports to calculate profits accurately.

## User Review Required

> [!IMPORTANT]
> **Database Schema Update Needed:**
> A new column `commission` must be added to the `transactions` table in Supabase. You will need to run the following SQL query in the Supabase SQL Editor:
> ```sql
> ALTER TABLE transactions ADD COLUMN IF NOT EXISTS commission NUMERIC(10,2) NOT NULL DEFAULT 0;
> ```
> Local IndexedDB will automatically migrate when the app boots by bumping the Dexie schema version to `4`.

---

## Proposed Changes

### Component Layer (Local Database Schema & Sync)

#### [MODIFY] [db.ts](file:///Users/saurabh/BE%20app/src/lib/db.ts)
* Add `commission: number;` to the `Transaction` interface.
* Bump Dexie schema version to `4` and add `commission` index to the `transactions` store definition.

#### [MODIFY] [DatabaseContext.tsx](file:///Users/saurabh/BE%20app/src/context/DatabaseContext.tsx)
* Expose `getSuggestedCommission(serviceType: string, amount: number): number` helper.
* Update `saveTransaction` signature: replace `notes: string | null` with `commission: number`.
* Update transaction creation logic to store `commission`.
* **UPI Redirection Logic:** If `PhonePe`, `Google Pay`, or `Navi` are selected, write the ledger entry under the `SBI` wallet ID while saving the transaction under the selected UPI wallet ID.
* Update `deleteTransaction` and `restoreTransaction` to support UPI system wallets and recalculate the corresponding `SBI` balance correctly.
* Implement `editTransaction(transactionId: string, amount: number, walletId: string | null, commission: number)`:
  * Delete existing cash/wallet ledger entries for the transaction.
  * Re-write the ledger entries based on updated amount and rules using the original `created_at` timestamp.
  * Recalculate balances for all affected wallets (`oldWalletId`, `newWalletId`, `SBI` if UPI, and `CASH`).
* Update `adjustWalletBalance(walletId: string | 'CASH', action: 'add' | 'deduct', amount: number, commission: number)`:
  * Write a `Transaction` row for the load/deduct (so it syncs to Supabase, appears in ledger, and counts in profits).
  * **Double Ledger Entries for Loads:** If the wallet is `Jio Wallet` or `Airtel LAPU Wallet` and the action is `add`:
    * Write 1st ledger entry `Wallet Load` with `amount = Amount`.
    * Write 2nd ledger entry `Operator Commission` with `amount = Commission`.
    * This splits the `Amount + Commission` into two clean, auditable ledger items in IndexedDB and Supabase.
  * For other wallets/cash or if action is `deduct`, write a single ledger entry with `amount = Amount` (ignoring commission).
* Update RLS sync parsers in `runSyncWorker()` and `pullLatest()` to write/fetch the `commission` column.
* Seed default `commission_rules` settings inside `initializeDatabase()`.

---

### UI Layer (Transaction & Setup Pages)

#### [MODIFY] [page.tsx](file:///Users/saurabh/BE%20app/src/app/transaction/[serviceId]/page.tsx)
* Replace the `Notes` input with a `Commission (₹)` input looking identical to the `Amount` field.
* Hook a `useEffect` that listens to `amount` and service type, calling `getSuggestedCommission` to auto-fill the field without locking it.

#### [MODIFY] [page.tsx](file:///Users/saurabh/BE%20app/src/app/wallets/page.tsx)
* Redesign the Adjustment Dialog modal:
  * Replace the layout with Green `+ Add` / Red `- Deduct` segmented toggle buttons.
  * Inputs: `Amount (₹)` and `Commission (₹)`.
  * Remove `Reason` and `Notes` inputs.
  * Modify submit handler to call `adjustWalletBalance(walletId, action, amount, commission)`.

---

### UI Layer (Settings & Ledger)

#### [MODIFY] [page.tsx](file:///Users/saurabh/BE%20app/src/app/settings/page.tsx)
* Add a new accordion panel "Configure Commission Rules" for Admin.
* Inputs to modify Recharge Default Commission and Electricity Default Commission.
* Dynamic editable lists/grids for AEPS Slabs, Money Transfer Slabs, and Loan Repayment Slabs.
* "Save Rules" button calling `updateSetting('commission_rules', rules)`.

#### [MODIFY] [page.tsx](file:///Users/saurabh/BE%20app/src/app/ledger/page.tsx)
* Render the `Commission` value on each transaction card (e.g., `Commission: ₹5`).
* Add an Edit button (pencil icon) next to the Trash icon on each card.
* Clicking the Edit button opens a modal showing:
  * Selected Wallet Select
  * Amount Input
  * Commission Input
  * Save and Cancel buttons.
* Triggers `editTransaction` upon submission and triggers the sync worker.

---

### Reporting & Home Dashboard Layer

#### [MODIFY] [page.tsx](file:///Users/saurabh/BE%20app/src/app/page.tsx)
* Expose dynamic Live Query counts of today's and this month's transactions.
* Sum up commissions for all non-deleted transactions matching `today` and `this month`.
* Display **Today's Profit** and **Monthly Profit** inside a beautiful stats container row in the Home page header.

#### [MODIFY] [page.tsx](file:///Users/saurabh/BE%20app/src/app/reports/page.tsx)
* Add 4 KPI Cards: Today's Profit, Monthly Profit, Custom Date Profit, Total Profit.
* Build Profit by Service charts/lists (Recharge, AEPS, Money Transfer, Electricity, Loan).
* Display "Top Profitable Service".
* **PDF Export Upgrade:** Integrate transactions count, cash totals, wallet balances, profit totals, profit by service, and a chronological profit timeline into the jsPDF file.

---

## Verification Plan

### Automated Verification
* Execute `npm run build && npm run lint` to confirm TypeScript type-safety and NextJS compile.

### Manual Verification
1. Run Supabase SQL script to extend the database tables.
2. Hard-refresh the app. Ensure default rules are seeded and Fino splits / SBI / system wallets are active.
3. Test Jio Recharge: Enter ₹299. Suggested commission should auto-fill to ₹2 (or custom default). Save recharge and verify the transaction has `commission = 2` on Supabase.
4. Test Wallet Load: Go to Jio Wallet, click Add. Add ₹10,000 with ₹150 commission. Verify Fino / Cash / Jio balances update. Jio Wallet balance should increase by ₹10,150.
5. Verify that 2 separate ledger entries are written: `Wallet Load (+₹10,000)` and `Operator Commission (+₹150)`.
6. Go to Home page and verify that Today's Profit shows ₹152 (₹150 load commission + ₹2 recharge commission).
7. Test Ledger Editing: Edit Jio Recharge transaction to change amount/commission. Verify that Jio Wallet balance and profits recalculate correctly.
8. Test PDF export on the reports screen to check formatting.
