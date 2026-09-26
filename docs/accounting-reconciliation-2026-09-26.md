# Accounting reconciliation — 26 September 2026

This review started read-only. After approval, migration `0007_eager_vector.sql` was applied to the Crown Supabase database. It added a nullable invoice-to-sale link and set the default brand for newly inserted products to SOLO. No historical transaction, invoice, bank account, journal, or product row was changed.

## Confirmed live findings

- 8 parties, 18 transactions, 2 invoices, and no worker payments were present at review time.
- Posted party transaction totals match the receivable/payable journal lines. Cash movements match the cash journal. Bill line totals match both stored invoice totals. No negative stock or productless purchases booked to inventory were found.
- A PKR 33,000 IGR TRADERS bank sale (TXN-2026-00012) was previously included in customer receivables even though it was settled immediately. The application calculation now treats settled sales as a sale plus matching payment in the party statement, with zero net receivable.
- Eleven posted bank transactions have no bank account assigned: TXN-2026-00003, 00004, 00005, 00007, 00008, 00009, 00010, 00011, 00012, 00013, and 00019. The only configured account is Factory Cash. Account-specific bank reports cannot allocate these entries until actual bank accounts and mappings are supplied.
- INV-2026-00005 (IGR TRADERS, 9 July 2026, PKR 84,000) and INV-2026-00004 (NEW SHAHEEN AUTOS, 29 August 2026, PKR 48,960) predate automatic invoice posting and have no linked sale. Neither has a same-day sale. The latter has a later PKR 48,960 receipt and a PKR 48,480 sale, leaving a PKR 480 difference to explain. Do not automatically backfill either invoice: that could duplicate a later sale or stock movement.

## Reconciliation steps

1. Match each older invoice to the delivery note, stock issue, sale transaction, and bank receipt. Record whether the invoice was fulfilled, cancelled, or superseded. Confirm the PKR 480 difference for INV-2026-00004.
2. Create the real bank accounts in Settings with verified opening balances. Match each of the eleven transaction numbers to a bank statement, then assign the account in Settings. The assignment changes bank attribution and keeps the original amount and party.
3. Re-run `npm run audit:accounting`. The audit intentionally remains nonzero while old invoices or bank transactions remain unresolved.
4. The approved migration was applied and verified as Drizzle migration ID 8. The invoice link column, foreign key, and unique index exist. Both existing invoices remain unlinked for review; new invoices can use the posting flow when the updated application is deployed.
