const POLL_INTERVAL_MINUTES = 0.1;
const MAX_PROFILES = 15;

const defaultConfig = {
  backendBaseUrl: "http://localhost:5000",
  extensionApiKey: "",
  maxProfiles: MAX_PROFILES
};

let pollInFlight = false;

const getConfig = async () => {
  const stored = await chrome.storage.sync.get(["backendBaseUrl", "extensionApiKey", "maxProfiles"]);
  return {
    backendBaseUrl: (stored.backendBaseUrl || defaultConfig.backendBaseUrl).replace(/\/+$/, ""),
    extensionApiKey: stored.extensionApiKey || defaultConfig.extensionApiKey,
    maxProfiles: Number(stored.maxProfiles || defaultConfig.maxProfiles)
  };
};

const authHeaders = (apiKey) => ({
  "Content-Type": "application/json",
  "x-api-key": apiKey
});

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const extractVisibleProfiles = (maxProfiles) => {
  const unique = new Map();
  const cards = Array.from(document.querySelectorAll("li.reusable-search__result-container"));

  for (const card of cards) {
    if (unique.size >= maxProfiles) break;

    const profileAnchor = card.querySelector('a[href*="/in/"]');
    const rawHref = profileAnchor?.getAttribute("href") || "";
    if (!rawHref) continue;

    const profileUrl = rawHref.startsWith("http") ? rawHref : `https://www.linkedin.com${rawHref}`;
    if (unique.has(profileUrl)) continue;

    const nameEl = card.querySelector('[aria-hidden="true"] span[dir="ltr"]') || card.querySelector("span.entity-result__title-text");
    const headlineEl = card.querySelector("div.entity-result__primary-subtitle") || card.querySelector("div.t-14.t-normal");

    const name = (nameEl?.textContent || "").trim().replace(/\s+/g, " ");
    const headline = (headlineEl?.textContent || "").trim().replace(/\s+/g, " ");

    if (!name) continue;

    unique.set(profileUrl, {
      name,
      headline,
      profile_url: profileUrl,
      skills: []
    });
  }

  return Array.from(unique.values());
};

const waitAndExtractProfiles = async (tabId, maxProfiles) => {
  await pause(5000);

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractVisibleProfiles,
    args: [maxProfiles]
  });

  return Array.isArray(result) ? result : [];
};

const postCandidateForAnalysis = async (baseUrl, apiKey, candidate, jobContext) => {
  const response = await fetch(`${baseUrl}/api/linkedin/analyze-profile`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      candidate,
      job_context: {
        role: jobContext.role,
        skills: jobContext.skills || [],
        location: jobContext.location || "",
        experience_required: 0
      }
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Analyze profile failed (${response.status}): ${message}`);
  }
};

const completeSearch = async (baseUrl, apiKey, requestId, processedCount, error = "") => {
  await fetch(`${baseUrl}/api/linkedin/search-complete`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      request_id: requestId,
      processed_count: processedCount,
      error
    })
  });
};

const processQueuedSearch = async (search, config) => {
  const tab = await chrome.tabs.create({
    url: search.search_url,
    active: false
  });

  try {
    const profiles = await waitAndExtractProfiles(tab.id, config.maxProfiles);

    for (const profile of profiles) {
      await postCandidateForAnalysis(config.backendBaseUrl, config.extensionApiKey, profile, {
        role: search.role,
        skills: search.skills,
        location: search.location
      });
      await pause(300);
    }

    await completeSearch(config.backendBaseUrl, config.extensionApiKey, search.request_id, profiles.length);
  } catch (error) {
    await completeSearch(config.backendBaseUrl, config.extensionApiKey, search.request_id, 0, error.message || "Unknown extension error");
  } finally {
    if (tab?.id) {
      await chrome.tabs.remove(tab.id).catch(() => {});
    }
  }
};

const pollBackendQueue = async () => {
  if (pollInFlight) return;
  pollInFlight = true;

  try {
    const config = await getConfig();
    if (!config.extensionApiKey) {
      pollInFlight = false;
      return;
    }

    const response = await fetch(`${config.backendBaseUrl}/api/linkedin/pending-search`, {
      method: "GET",
      headers: {
        "x-api-key": config.extensionApiKey
      }
    });

    if (!response.ok) {
      pollInFlight = false;
      return;
    }

    const payload = await response.json();
    if (!payload.available || !payload.search) {
      pollInFlight = false;
      return;
    }

    await processQueuedSearch(payload.search, config);
  } catch {
    // Keep the worker alive and continue polling on the next alarm tick.
  } finally {
    pollInFlight = false;
  }
};

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.sync.set(defaultConfig);
  chrome.alarms.create("linkedinQueuePoll", { periodInMinutes: POLL_INTERVAL_MINUTES });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("linkedinQueuePoll", { periodInMinutes: POLL_INTERVAL_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "linkedinQueuePoll") {
    pollBackendQueue();
  }
});
