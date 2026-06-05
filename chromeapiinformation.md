# LEO OS — Chrome Extension API Reference

Everything a developer needs to build a Chrome extension that reads employee data from the LEO OS database and auto-fills it into third-party website forms.

---

## Base URL

```
https://leomaldives.com/api
```

---

## Authentication

All extension API calls must include the API token as a Bearer header:

```
Authorization: Bearer <token>
```

**How to get the token:**
1. Log in to [https://leomaldives.com](https://leomaldives.com)
2. Go to **Settings → System** tab
3. Scroll to the **Extension access** section
4. Copy the **API token** (or generate one on first use)
5. Paste it into your extension's config/storage

The token only grants **read access** — it cannot upload, edit, or delete any records. If the token is ever compromised, it can be regenerated instantly from the same settings page (the old token stops working immediately).

---

## Endpoints

### List employees

```
GET https://leomaldives.com/api/passports
Authorization: Bearer <token>
```

Returns all employee (passport) records. Supports optional query parameters to filter results.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by name, passport number, work permit number, or agent name |
| `nationality` | string | Filter by nationality: `bangladesh` or `india` |
| `status` | string | Filter by status: `completed`, `processing`, or `failed` |
| `clientId` | string | Filter by employer/client ID. Pass `none` for unallocated employees |

**Example requests:**

```
# All completed Bangladeshi employees
GET https://leomaldives.com/api/passports?nationality=bangladesh&status=completed
Authorization: Bearer <token>

# Search by name
GET https://leomaldives.com/api/passports?search=Ahmed
Authorization: Bearer <token>

# Employees at a specific client (employer)
GET https://leomaldives.com/api/passports?clientId=5
Authorization: Bearer <token>
```

**Response — array of employee objects:**

```json
[
  {
    "id": 42,
    "fullName": "Ahmed Ali",
    "passportNumber": "A1234567",
    "dateOfBirth": "1990-05-15",
    "dateOfIssue": "2020-01-10",
    "dateOfExpiry": "2030-01-10",
    "nationality": "bangladesh",
    "address": "Dhaka, Bangladesh",
    "workPermitNumber": "WP-001",
    "agent": "Agent Name",
    "clientId": 5,
    "clientName": "Ayada Maldives",
    "status": "completed",
    "originalFilename": "ahmed_passport.jpg",
    "errorMessage": null,
    "createdAt": "2024-03-01T10:00:00.000Z",
    "updatedAt": "2024-03-01T10:05:00.000Z"
  }
]
```

---

### Get a single employee

```
GET https://leomaldives.com/api/passports/:id
Authorization: Bearer <token>
```

**Example:**

```
GET https://leomaldives.com/api/passports/42
Authorization: Bearer <token>
```

**Response — single employee object** (same shape as above).

Returns `404` if the record does not exist.

---

## Field reference

| Field | Description | Example value |
|-------|-------------|---------------|
| `id` | Internal database ID | `42` |
| `fullName` | Employee's full name | `"Ahmed Ali"` |
| `passportNumber` | Passport number | `"A1234567"` |
| `dateOfBirth` | Date of birth (ISO 8601) | `"1990-05-15"` |
| `dateOfIssue` | Passport issue date (ISO 8601) | `"2020-01-10"` |
| `dateOfExpiry` | Passport expiry date (ISO 8601) | `"2030-01-10"` |
| `nationality` | Nationality slug | `"bangladesh"` or `"india"` |
| `address` | Home address | `"Dhaka, Bangladesh"` |
| `workPermitNumber` | Work permit / visa number | `"WP-001"` |
| `agent` | Recruiting agent name | `"Agent Name"` |
| `clientId` | ID of the employer/client | `5` |
| `clientName` | Employer/client display name | `"Ayada Maldives"` |
| `status` | OCR processing status | `"completed"` / `"processing"` / `"failed"` |

> **Note:** Only records with `status: "completed"` have fully extracted data. Records with `status: "processing"` or `"failed"` may have null fields.

---

## Extension implementation guide

### 1. Store the token securely

```js
// Save token in Chrome's sync storage
chrome.storage.sync.set({ apiToken: 'your-token-here', baseUrl: 'https://leomaldives.com/api' });

// Retrieve it later
chrome.storage.sync.get(['apiToken', 'baseUrl'], ({ apiToken, baseUrl }) => {
  // use token
});
```

### 2. Fetch employees

```js
async function fetchEmployees(search = '') {
  const { apiToken, baseUrl } = await chrome.storage.sync.get(['apiToken', 'baseUrl']);

  const url = new URL(`${baseUrl}/passports`);
  if (search) url.searchParams.set('search', search);
  url.searchParams.set('status', 'completed');

  const response = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${apiToken}` }
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}
```

### 3. Fill form fields

```js
function fillForm(employee) {
  // Map employee fields to form input selectors on the target website
  const fieldMap = {
    '#full-name':       employee.fullName,
    '#passport-number': employee.passportNumber,
    '#date-of-birth':   employee.dateOfBirth,
    '#nationality':     employee.nationality,
    '#address':         employee.address,
  };

  for (const [selector, value] of Object.entries(fieldMap)) {
    const el = document.querySelector(selector);
    if (el && value) el.value = value;
  }
}
```

---

## Error responses

| HTTP status | Meaning |
|-------------|---------|
| `200` | Success |
| `400` | Invalid query parameter |
| `401` | Missing or invalid token |
| `404` | Record not found |
| `500` | Server error |

A `401` response body looks like:
```json
{ "error": "Authentication required" }
```

---

## CORS

The API allows requests from `chrome-extension://` origins, so standard `fetch()` calls from extension scripts work without any proxy.

---

## Token rotation

If you need to rotate the token (e.g. after a security incident):
1. Go to **Settings → System → Extension access** on [leomaldives.com](https://leomaldives.com)
2. Click **Regenerate token**
3. Confirm — the old token stops working immediately
4. Update the new token in your extension's storage
