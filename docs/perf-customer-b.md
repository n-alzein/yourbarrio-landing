# Customer Business Profile Perf (/customer/b/:id)

## Entry point
- `app/(customer)/customer/b/[id]/page.js`
- `app/(public)/(marketing)/b/[id]/page.jsx`

## Repro steps (prod-like)
1) Build + start:
```bash
npm run build
YB_PROFILE_PERF=1 npm run start
```
2) Pick a representative business id/slug:
```bash
export BIZ_ID="your-business-id"
```
3) Server timing (cold + warm):
```bash
curl -o /dev/null -s -w "ttfb=%{time_starttransfer}s total=%{time_total}s\n" "http://localhost:3000/customer/b/${BIZ_ID}?perf=1"
curl -o /dev/null -s -w "ttfb=%{time_starttransfer}s total=%{time_total}s\n" "http://localhost:3000/customer/b/${BIZ_ID}?perf=1"
```
4) Client timing (Lighthouse mobile):
```bash
npx lighthouse "http://localhost:3000/customer/b/${BIZ_ID}" --preset=perf --form-factor=mobile --screenEmulation.mobile --only-categories=performance
```

## Instrumentation
- Enable server span logs via `YB_PROFILE_PERF=1` or `?perf=1`.
- Logs are emitted from `app/(public)/(marketing)/b/[id]/page.jsx`.

## Baseline metrics (before changes)
- TTFB: TBD
- p95 (light load): TBD
- Expensive DB queries: TBD
- Lighthouse (mobile): LCP TBD, TBT/INP TBD

## After metrics (this change)
- TTFB: TBD
- p95 (light load): TBD
- Expensive DB queries: TBD
- Lighthouse (mobile): LCP TBD, TBT/INP TBD

## Notes
- Replace `BIZ_ID` with a real business id/slug that has listings, gallery, and reviews.
