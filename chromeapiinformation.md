# LEO OS — Chrome Extension: Full Build Guide

Step-by-step instructions to build, install, and use a Chrome extension that searches LEO OS employee records and auto-fills forms on any website.

---

## How it works

- A popup opens when you click the extension icon
- You type a name or passport number to search
- A list of matching employees appears
- You click a name → the extension fills the form fields on the current tab's page

No login, no token, no setup — the API is open for read access.

---

## Base API URL

```
https://leomaldives.com/api
```

---

## Step 1 — Create the extension folder

On your computer, create a folder anywhere you like. Name it something like `leo-extension`.

Inside that folder you will create **4 files** (described below):

```
leo-extension/
├── manifest.json
├── popup.html
├── popup.js
└── content.js
```

---

## Step 2 — Create `manifest.json`

This tells Chrome what the extension is and what permissions it needs.

```json
{
  "manifest_version": 3,
  "name": "LEO OS Autofill",
  "version": "1.0",
  "description": "Search LEO OS employees and autofill forms",
  "permissions": ["activeTab", "scripting"],
  "host_permissions": [
    "https://leomaldives.com/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "LEO OS Autofill"
  }
}
```

---

## Step 3 — Create `popup.html`

This is the UI that appears when you click the extension icon.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }

    body {
      width: 340px;
      background: #0f172a;
      color: #f1f5f9;
    }

    .header {
      padding: 14px 16px 10px;
      border-bottom: 1px solid #1e293b;
    }

    .header h1 {
      font-size: 14px;
      font-weight: 600;
      color: #e2e8f0;
      letter-spacing: 0.3px;
    }

    .header p {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }

    .search-wrap {
      padding: 10px 12px;
    }

    #search {
      width: 100%;
      padding: 8px 10px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      color: #f1f5f9;
      font-size: 13px;
      outline: none;
    }

    #search::placeholder { color: #475569; }
    #search:focus { border-color: #3b82f6; }

    #status {
      padding: 0 12px 6px;
      font-size: 11px;
      color: #64748b;
      min-height: 18px;
    }

    #results {
      max-height: 360px;
      overflow-y: auto;
    }

    .employee {
      padding: 10px 14px;
      border-top: 1px solid #1e293b;
      cursor: pointer;
      transition: background 0.1s;
    }

    .employee:hover { background: #1e293b; }

    .employee .name {
      font-size: 13px;
      font-weight: 500;
      color: #e2e8f0;
    }

    .employee .meta {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }

    .employee .badge {
      display: inline-block;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 9999px;
      margin-top: 4px;
      font-weight: 500;
    }

    .badge.bd { background: #166534; color: #bbf7d0; }
    .badge.in { background: #92400e; color: #fde68a; }

    .empty {
      padding: 24px 16px;
      text-align: center;
      color: #475569;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>LEO OS Autofill</h1>
    <p>Search an employee to fill the form</p>
  </div>

  <div class="search-wrap">
    <input id="search" type="text" placeholder="Name, passport no., work permit..." autocomplete="off" />
  </div>

  <div id="status"></div>
  <div id="results"></div>

  <script src="popup.js"></script>
</body>
</html>
```

---

## Step 4 — Create `popup.js`

This is the logic: fetch from the API, render results, and send the selected employee to the content script.

```js
const API = 'https://leomaldives.com/api';

const searchInput = document.getElementById('search');
const resultsDiv  = document.getElementById('results');
const statusDiv   = document.getElementById('status');

let debounceTimer;

// Load all completed employees on open
window.addEventListener('DOMContentLoaded', () => {
  fetchAndRender('');
});

// Search as you type (debounced 300ms)
searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchAndRender(searchInput.value.trim()), 300);
});

async function fetchAndRender(query) {
  statusDiv.textContent = 'Searching…';
  resultsDiv.innerHTML  = '';

  try {
    const url = new URL(`${API}/passports`);
    url.searchParams.set('status', 'completed');
    if (query) url.searchParams.set('search', query);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Server error ${res.status}`);

    const employees = await res.json();

    if (!employees.length) {
      statusDiv.textContent = '';
      resultsDiv.innerHTML  = '<div class="empty">No employees found</div>';
      return;
    }

    statusDiv.textContent = `${employees.length} result${employees.length !== 1 ? 's' : ''}`;

    resultsDiv.innerHTML = employees.map(emp => `
      <div class="employee" data-id="${emp.id}">
        <div class="name">${emp.fullName || '—'}</div>
        <div class="meta">${emp.passportNumber || ''} ${emp.workPermitNumber ? '· WP: ' + emp.workPermitNumber : ''}</div>
        <div class="meta">${emp.clientName ? '🏢 ' + emp.clientName : ''}</div>
        <span class="badge ${emp.nationality === 'bangladesh' ? 'bd' : 'in'}">
          ${emp.nationality === 'bangladesh' ? 'Bangladesh' : 'India'}
        </span>
      </div>
    `).join('');

    // Click a result → inject into active tab
    resultsDiv.querySelectorAll('.employee').forEach((el, i) => {
      el.addEventListener('click', () => fillEmployee(employees[i]));
    });

  } catch (err) {
    statusDiv.textContent = 'Error: ' + err.message;
  }
}

async function fillEmployee(emp) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectFill,
    args: [emp],
  });

  statusDiv.textContent = `✓ Filled: ${emp.fullName}`;
}

// This function runs inside the target page — keep it self-contained
function injectFill(emp) {
  function fill(selector, value) {
    const el = document.querySelector(selector);
    if (el && value) {
      el.focus();
      el.value = value;
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // ── Adjust selectors below to match the target website's form fields ──
  fill('[name="full_name"]',        emp.fullName);
  fill('[name="name"]',             emp.fullName);
  fill('[name="passport_number"]',  emp.passportNumber);
  fill('[name="passport_no"]',      emp.passportNumber);
  fill('[name="dob"]',              emp.dateOfBirth);
  fill('[name="date_of_birth"]',    emp.dateOfBirth);
  fill('[name="expiry"]',           emp.dateOfExpiry);
  fill('[name="expiry_date"]',      emp.dateOfExpiry);
  fill('[name="nationality"]',      emp.nationality);
  fill('[name="address"]',          emp.address);
  fill('[name="work_permit"]',      emp.workPermitNumber);
  fill('[name="work_permit_no"]',   emp.workPermitNumber);
}
```

> **Customising field selectors:** The `injectFill` function tries common `name` attribute patterns. Open the target website, right-click a form field → Inspect, and find its `name`, `id`, or class. Replace or add entries to match.

---

## Step 5 — Create `content.js`

This file can stay empty for now. Chrome requires it to exist if you later want to inject scripts directly (rather than via `chrome.scripting.executeScript`).

```js
// Reserved for future content-script use
```

---

## Step 6 — Load the extension in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select your `leo-extension` folder
5. The extension appears in your toolbar — click the puzzle-piece icon and pin it for quick access

---

## Step 7 — Using the extension

1. Navigate to the website with the form you want to fill
2. Click the **LEO OS Autofill** extension icon in the Chrome toolbar
3. The popup opens and loads all employees automatically
4. Type a name, passport number, or work permit number to filter
5. Click the employee — the form fields on the current page are filled instantly

---

## Customising which fields get filled

Edit the `injectFill` function in `popup.js`. Each line maps a form field selector to an employee data field:

| Employee field | What it contains |
|---|---|
| `emp.fullName` | Full name |
| `emp.passportNumber` | Passport number |
| `emp.dateOfBirth` | Date of birth (`YYYY-MM-DD`) |
| `emp.dateOfIssue` | Date of issue (`YYYY-MM-DD`) |
| `emp.dateOfExpiry` | Date of expiry (`YYYY-MM-DD`) |
| `emp.nationality` | `bangladesh` or `india` |
| `emp.address` | Home address |
| `emp.workPermitNumber` | Work permit / visa number |
| `emp.agent` | Recruiting agent name |
| `emp.clientName` | Employer name |

To target a field by **id** instead of name:

```js
fill('#passportField', emp.passportNumber);
```

To target by **class**:

```js
fill('.passport-input', emp.passportNumber);
```

---

## Updating the extension after code changes

1. Edit your files in the `leo-extension` folder
2. Go to `chrome://extensions`
3. Click the **↺ refresh** icon on the LEO OS Autofill card
4. Changes take effect immediately

---

## API endpoints (reference)

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/api/passports` | List all employees |
| `GET` | `/api/passports?search=Ahmed` | Search by name / passport / WP no. |
| `GET` | `/api/passports?nationality=bangladesh` | Filter by nationality |
| `GET` | `/api/passports?status=completed` | Filter by OCR status |
| `GET` | `/api/passports/:id` | Get a single employee by ID |

No authentication required. All responses are JSON.

---

## Error responses

| HTTP status | Meaning |
|-------------|---------|
| `200` | Success |
| `400` | Invalid query parameter |
| `404` | Record not found |
| `500` | Server error |

---

## CORS

The API explicitly allows `chrome-extension://` origins. No proxy or workaround needed — `fetch()` works directly from the extension popup and content scripts.
