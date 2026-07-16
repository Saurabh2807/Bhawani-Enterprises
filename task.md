# Tasks

- [x] Run Supabase SQL migration to add commission column
- [x] Modify `src/lib/db.ts` to add commission and bump schema to version 4
- [ ] Update `src/context/DatabaseContext.tsx`
  - [x] Add `commission_rules` default settings seeder
  - [x] Add suggested commission engine
  - [x] Update `saveTransaction` signature and DB insert logic
  - [x] Add double-entry logic inside `adjustWalletBalance`
  - [x] Implement and export `editTransaction`
  - [x] Update pullLatest/worker sync methods to query `commission`
- [x] Update `src/app/transaction/[serviceId]/page.tsx` (recharge/transaction forms) to replace Notes with Commission
- [x] Update `src/app/wallets/page.tsx` to redesigned Add/Deduct modal
- [x] Update `src/app/settings/page.tsx` to add Commission Rules editor
- [x] Update `src/app/ledger/page.tsx` to display commission and add Edit modal
- [x] Update `src/app/page.tsx` (Home Dashboard) to display live Today's and Monthly Profit in header
- [x] Update `src/app/reports/page.tsx` with new profit analytics and updated PDF export
