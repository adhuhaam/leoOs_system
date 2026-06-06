---
name: Xpat MV API
description: Maldives government work permit API — base URL, auth header, required params, and endpoint shapes
---

## Base URL
`https://mobile-xpat.egov.mv/api/v1`

## Auth
Header: `ApiKey: d110e2a8-5adc-4f7b-90a0-701b4fedf476` — hardcoded server-side in `artifacts/api-server/src/routes/xpat.ts`, never exposed to the browser.

## Every call requires BOTH params
`WorkPermitNumber` AND `PassportNumber` — omitting either returns an error.

## Endpoints
- `GET /WorkPermit?WorkPermitNumber=...&PassportNumber=...` → JSON
- `GET /WorkPermit/GetImage?photoId=...&serviceId=...` → JPEG (parse `photoUrl` from JSON)
- `GET /WorkPermitCard/GetWorkPermitCard?WorkPermitNumber=...&PassportNumber=...` → PNG

## JSON fields
`fullName`, `firstName`, `middleName`, `lastName`, `gender`, `dateOfBirth`, `nationality`, `isoAlpha3CountryCode`, `contactNumber`, `occupationName`, `isValid`, `workPermitStateName`, `workPermitIssuedDate`, `workPermitExpiry`, `employerName`, `employerNumber`, `employerContactNumber`, `photoUrl`, `verifyUrl`

## Test pair
WP `WP00595305`, Passport `V7255877`

## Backend proxy
Three routes in `artifacts/api-server/src/routes/xpat.ts` — all behind `requireAuth`:
- `GET /api/xpat/work-permit` → JSON proxy
- `GET /api/xpat/photo?photoUrl=...` → JPEG proxy
- `GET /api/xpat/card` → PNG proxy (mounted after `requireAuth` block in `routes/index.ts`)

**Why server-side:** API key must stay server-side; photo/card images served as same-origin URLs so browser cookies satisfy auth automatically.
