# SEO roadmap (from uploaded brief)
- [x] Task 1 – Crawler-readable pages (prerender)
- [x] Task 2 – Homepage SEO
- [x] Task 3 – Titles & descriptions
- [x] Task 4 – Landing pages
- [x] Task 5 – Sitemap & robots
- [x] Task 6 – Structured data
- [x] Task 7 – Internal linking
- [x] Task 8 – Content guides
- [x] Task 9 – Mobile performance
- [x] Task 10 – Canonicals & redirects
- [x] Task 11 – Social sharing
- [x] Task 12 – Conversion
- [x] Task 13 – Validation

# Failed downloads
- [x] Add secure admin failure report for browser exports and cloud renders.
- [x] Capture future browser export failure reasons without changing credits or billing.
- [x] Verify signed-in report with existing failure records, anonymous access denial and all 357 tests.
- [ ] Visually verify the dashboard table after authenticator verification (blocked by AAL2; no bypass).

# Currency previews
- [x] Add GBP, USD, EUR, CAD, AUD and INR selector on Pricing and Billing with current exchange rates.
- [x] Keep GBP checkout, credit amounts and historical invoices unchanged; 41 relevant tests passed, all currencies and signed-in top-up previews verified on desktop/mobile without starting a payment.

# Paid generation
- [x] Require verified payment before AI calls, including free helpers, without altering existing balances or subscriptions.
- [x] Stop future free credit grants and update pricing and creation prompts.
- [x] Test payment eligibility and verify an unpaid account is blocked before any AI spend; 393 tests passed, £5 Billing offer verified without initiating a payment.

# Uploaded payment specification
- [x] Safely reconcile remaining starter/monthly balances: 46 accounts, 1,130 credits; 2 mixed balances flagged and untouched.
- [x] Preserve valid promotional and remaining subscription credits with server-enforced AI access; existing protected transactions unchanged.
- [x] Add consistent Credits Required notices, zero-balance dashboard and Free pricing card; verify purchase links and mobile layout.
- [x] Audit public/authenticated content and signup email; retire free-credit schedule and referral bonuses without changing tracking or paid plans.
- [x] Run all 414 tests, including simulated Stripe confirmations and real signed-in concurrent charging/refunds without paid AI calls.
- [ ] Administrator to review 2 mixed balances; no automatic deduction is safe.
- [ ] Visually verify administrator credit-source drawer after authenticator verification (blocked by AAL2; no bypass).

# Admin Free testing
- [x] Reset Free test mode to zero and remove AI admin bypass while testing, with isolated top-up simulation.
- [x] Verify signed-in Free testing, purchase prompts and unchanged real billing history; 28 relevant tests passed.
