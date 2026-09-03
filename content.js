/**
 * Leet++ — content script
 *
 * Responsibilities:
 *  1. Load the prebuilt slug -> companies dataset once.
 *  2. Detect which problem slug is currently shown (works across SPA
 *     navigation, since LeetCode never full-reloads between problems).
 *  3. Find a stable insertion point in the problem description panel.
 *  4. Render a panel listing companies + frequency, sortable by timeframe.
 *  5. Send an anonymous view-tracking ping to the background worker.
 *
 * NOTE ON SELECTORS: LeetCode's React app uses hashed/utility class names
 * that change across deploys. Rather than depend on any single class name,
 * TARGET_SELECTORS lists several fallback strategies, tried in order. If
 * LeetCode ships a redesign and the panel stops appearing, check the
 * console for "[LCX]" warnings and update TARGET_SELECTORS.
 */

(() => {
  const PANEL_ID = "lcx-company-panel";
  const CHECK_INTERVAL_MS = 600;
  const TIMEFRAME_LABELS = {
    "30": "Last 30 Days",
    "90": "Last 3 Months",
    "180": "Last 6 Months",
    gt180: "More Than 6 Months",
    all: "All Time",
  };

  let dataset = null; // full parsed JSON, loaded once
  let datasetLoadPromise = null;
  let currentSlug = null;
  let currentTimeframe = "all";

  function log(...args) {
    console.log("[LCX]", ...args);
  }

  function warn(...args) {
    console.warn("[LCX]", ...args);
  }

  // ---------- Data loading ----------

  function loadDataset() {
    if (datasetLoadPromise) return datasetLoadPromise;
    const url = chrome.runtime.getURL("company-data.json");
    datasetLoadPromise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        dataset = json;
        log(
          `dataset loaded: ${json.meta.companyCount} companies, ${json.meta.problemCount} problems`
        );
        return json;
      })
      .catch((err) => {
        warn("failed to load dataset", err);
        datasetLoadPromise = null; // allow retry on next call
        throw err;
      });
    return datasetLoadPromise;
  }

  // ---------- Slug / navigation detection ----------

  function getSlugFromLocation() {
    const match = window.location.pathname.match(/\/problems\/([^/]+)/);
    return match ? match[1] : null;
  }

  // ---------- DOM target detection ----------

  // Ordered fallback strategies for "where does the problem description live".
  const TARGET_SELECTORS = [
    '[data-track-load="description_content"]',
    'div[class*="description__"]',
    'div[class*="content__"] > div[class*="question"]',
  ];

  function findInsertionTarget() {
    for (const selector of TARGET_SELECTORS) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    // Last resort: anchor to the problem title h1's parent
    const h1 = document.querySelector("div[class*='mr-2'] a, a[href*='/problems/']");
    return h1 ? h1.closest("div") : null;
  }

  // ---------- Theme detection ----------

  function isDarkMode() {
    return (
      document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-mode") === "dark"
    );
  }

  // ---------- Rendering ----------

  function buildPanel(problemEntry) {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.dataset.theme = isDarkMode() ? "dark" : "light";

    const header = document.createElement("div");
    header.className = "lcx-header";

    const title = document.createElement("span");
    title.className = "lcx-title";
    title.textContent = "Company Tags";
    header.appendChild(title);

    const select = document.createElement("select");
    select.className = "lcx-timeframe-select";
    for (const [key, label] of Object.entries(TIMEFRAME_LABELS)) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = label;
      if (key === currentTimeframe) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener("change", (e) => {
      currentTimeframe = e.target.value;
      renderCompanyList(panel, problemEntry);
    });
    header.appendChild(select);

    panel.appendChild(header);

    const list = document.createElement("div");
    list.className = "lcx-company-list";
    panel.appendChild(list);

    renderCompanyList(panel, problemEntry);
    return panel;
  }

  function renderCompanyList(panel, problemEntry) {
    const list = panel.querySelector(".lcx-company-list");
    list.innerHTML = "";

    const rows = Object.entries(problemEntry.companies)
      .map(([company, freqs]) => ({ company, freq: freqs[currentTimeframe] }))
      .filter((row) => row.freq !== undefined && row.freq !== null)
      .sort((a, b) => b.freq - a.freq);

    if (rows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "lcx-empty";
      empty.textContent = "No data for this timeframe.";
      list.appendChild(empty);
      return;
    }

    const maxFreq = rows[0].freq;

    for (const { company, freq } of rows) {
      const row = document.createElement("div");
      row.className = "lcx-row";

      const name = document.createElement("span");
      name.className = "lcx-company-name";
      name.textContent = company;

      const barTrack = document.createElement("div");
      barTrack.className = "lcx-bar-track";
      const bar = document.createElement("div");
      bar.className = "lcx-bar";
      bar.style.width = `${(freq / maxFreq) * 100}%`;
      barTrack.appendChild(bar);

      const freqLabel = document.createElement("span");
      freqLabel.className = "lcx-freq";
      freqLabel.textContent = freq.toFixed(1);

      row.appendChild(name);
      row.appendChild(barTrack);
      row.appendChild(freqLabel);
      list.appendChild(row);
    }
  }

  function removeExistingPanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();
  }

  async function renderForCurrentSlug() {
    const slug = getSlugFromLocation();
    if (!slug) {
      removeExistingPanel();
      currentSlug = null;
      return;
    }
    if (slug === currentSlug && document.getElementById(PANEL_ID)) {
      return; // already rendered, nothing changed
    }
    currentSlug = slug;
    removeExistingPanel();

    try {
      await loadDataset();
    } catch {
      return; // already warned in loadDataset
    }

    const entry = dataset.problems[slug];
    if (!entry) {
      log(`no company data for "${slug}"`);
      return;
    }

    const target = findInsertionTarget();
    if (!target) {
      warn(`could not find insertion point for "${slug}", will retry`);
      return;
    }

    const panel = buildPanel(entry);
    target.parentElement.insertBefore(panel, target);

    // Anonymous usage ping — see background.js for what's sent.
    chrome.runtime.sendMessage({ type: "TRACK_VIEW", slug });
  }

  // ---------- SPA navigation watcher ----------
  // LeetCode is a client-side-routed React app: the URL changes without a
  // full page reload, and internal routing events aren't a stable public
  // API to hook into. Polling the URL is cheap and reload-proof.

  function startWatching() {
    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        renderForCurrentSlug();
      } else if (getSlugFromLocation() && !document.getElementById(PANEL_ID)) {
        // Same URL, but panel missing — LeetCode re-rendered the DOM
        // (e.g. switching tabs) and wiped our injected node.
        renderForCurrentSlug();
      }
    }, CHECK_INTERVAL_MS);

    renderForCurrentSlug();
  }

  startWatching();
})();
