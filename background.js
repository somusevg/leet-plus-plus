/**
 * Leet++ background service worker
 *
 * Two jobs:
 *  1. Forward anonymous usage pings to Google Analytics 4 via its
 *     Measurement Protocol. Runs here (not in content.js) because
 *     LeetCode's page CSP can block fetches made directly from a
 *     content script, even with host_permissions declared — a service
 *     worker isn't subject to the page's CSP.
 *  2. Open welcome.html once, the first time the extension is installed.
 *
 * What's tracked: a random per-install ID (no name, email, or account
 * info — never tied to a person) + which problem slug was viewed. No IP
 * address, no browsing history beyond leetcode.com/problems/* pages,
 * nothing sent anywhere else.
 *
 * GA4 is already configured below with your Measurement ID + API secret.
 */
const GA_MEASUREMENT_ID = "G-H9ZP0F1TDZ";
const GA_API_SECRET = "s89ZK1djTW6LI_HxyIDirQ";

async function getClientId() {
  const { clientId } = await chrome.storage.local.get("clientId");
  if (clientId) return clientId;
  const newId = crypto.randomUUID();
  await chrome.storage.local.set({ clientId: newId });
  return newId;
}

async function sendEvent(name, params = {}) {
  if (GA_MEASUREMENT_ID.startsWith("REPLACE_") || GA_API_SECRET.startsWith("REPLACE_")) {
    return { ok: false, reason: "not_configured" };
  }
  const clientId = await getClientId();
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        client_id: clientId,
        // engagement_time_msec is what GA4 uses to count "active users" —
        // without it, events can log but not count toward user metrics.
        events: [{ name, params: { engagement_time_msec: 1, ...params } }],
      }),
    });
    // GA's collect endpoint returns 204 No Content on success with no body.
    const ok = res.status === 204 || res.ok;
    console.log(`[LCX] analytics ping "${name}" -> HTTP ${res.status}`, ok ? "OK" : "unexpected status");
    return { ok, status: res.status };
  } catch (err) {
    console.warn(`[LCX] analytics ping "${name}" failed`, err);
    return { ok: false, reason: String(err) };
  }
}

// MV3 service workers can be killed ~30s after going idle. A message
// listener that fires an async fetch and returns nothing gives Chrome no
// reason to keep the worker alive, so the fetch can be cut off mid-flight
// with zero error output. Returning `true` here + calling sendResponse
// only after the fetch settles keeps the worker alive for the duration.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "TRACK_VIEW") {
    sendEvent("view_problem", { slug: message.slug }).then(sendResponse);
    return true; // keep the message channel (and worker) open until sendResponse fires
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  }
});
