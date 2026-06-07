---
name: Xpat MV API
description: Maldives government work permit API — base URL, required params, endpoint shapes, and proxy security notes
---

## Base URL
`https://mobile-xpat.egov.mv/api/v1`

## Auth
The API key is hardcoded server-side in `artifacts/api-server/src/routes/xpat.ts` in a constant — never stored in memory or environment variables that appear in logs.

## Every call requires BOTH params
`WorkPermitNumber` AND `PassportNumber` — omitting either returns an error.

## Endpoints
- `GET /WorkPermit?WorkPermitNumber=...&PassportNumber=...` → JSON
- `GET /WorkPermit/GetImage?photoId=...&serviceId=...` → JPEG (IDs come from the `photoUrl` field in the JSON response — parse them out, never pass the raw URL to the browser)
- `GET /WorkPermitCard/GetWorkPermitCard?WorkPermitNumber=...&PassportNumber=...` → PNG

## JSON fields
`fullName`, `firstName`, `middleName`, `lastName`, `gender`, `dateOfBirth`, `nationality`, `isoAlpha3CountryCode`, `contactNumber`, `occupationName`, `isValid`, `workPermitStateName`, `workPermitIssuedDate`, `workPermitExpiry`, `employerName`, `employerNumber`, `employerContactNumber`, `photoUrl`, `verifyUrl`

## Test pair
WP `WP00595305`, Passport `V7255877`

## Backend proxy — security design
Three routes in `artifacts/api-server/src/routes/xpat.ts`, all behind `requireAuth`:
- `GET /api/xpat/work-permit` — JSON proxy
- `GET /api/xpat/photo?photoId=...&serviceId=...` — JPEG proxy. Accepts only validated alphanumeric IDs (not a caller-supplied URL). URL is always constructed server-side from XPAT_BASE — eliminates SSRF risk.
- `GET /api/xpat/card?workPermitNumber=...&passportNumber=...` — PNG proxy

**Why param-based (not URL-based) photo proxy:** accepting a full URL and forwarding the API key header to it would allow SSRF and credential exfiltration to attacker-controlled hosts. Always parse photoId + serviceId from the JSON `photoUrl` field on the frontend, never pass the URL itself.

**Frontend photo URL construction:** parse `photoId` and `serviceId` from `xpat.photoUrl` using `parseXpatPhotoParams()` helper (defined in both `master-list.tsx` and `employee-profile.tsx`), then build `/api/xpat/photo?photoId=...&serviceId=...`.
