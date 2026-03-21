# LinkedIn Automation Extension

This Chrome extension runs LinkedIn search extraction in the background for the HR Recruit app.

## What it does

1. Polls backend endpoint `GET /api/linkedin/pending-search`.
2. Opens LinkedIn search results in an inactive tab.
3. Extracts visible profile snippets (name, headline, profile URL).
4. Sends each profile to `POST /api/linkedin/analyze-profile`.
5. Marks completion via `POST /api/linkedin/search-complete`.

## Setup

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select this `linkedin-extension` folder.
3. Open extension service worker console.
4. Set storage values from console:

```js
chrome.storage.sync.set({
  backendBaseUrl: "http://localhost:5000",
  extensionApiKey: "<same value as LINKEDIN_EXTENSION_API_KEY>",
  maxProfiles: 15
});
```

## Security notes

- Uses API key in `x-api-key` for extension to backend authentication.
- Extracts only visible search result fields.
- Limits extraction to `maxProfiles` (default 15).
