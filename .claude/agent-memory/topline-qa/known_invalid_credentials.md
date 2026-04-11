---
name: Test Accounts Status
description: Known valid and invalid test account credentials for TopLine Tec
type: project
---

## Test Account Status (verified 2026-04-10)

| Account | Credentials | Status | Notes |
|---------|-------------|--------|-------|
| danielabrego95@gmail.com | Loquito420 | VALID | admin role |
| gerencia1@toplinetec.com | Sayayin420 | VALID (browser had session) | gerente role |
| taller@toplinetec.com | Taller123 | UNKNOWN — not tested | |
| buyer1@toplintecinc.com | Yughio123 | INVALID — auth rejected | Firebase returns error, silent failure on screen |
| administration@toplintecinc.com | unknown | NOT TESTED | This is the only email that can see costs |

## Note on browser autocomplete
The Playwright browser had a cached session for gerencia1@toplinetec.com from a prior session.
When fill_form is used, browser autocomplete may override typed values.
Use browser_type with submit:true and verify actual email via React fiber inspection.
