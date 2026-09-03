/**
 * Leet++ popup — company browser.
 *
 * The bundled dataset is indexed by problem slug (slug -> companies).
 * For this view we need the inverse (company -> problems), so we build
 * that index once in memory when the popup opens. Cheap: ~3.4k problems,
 * done in a single pass.
 */

const TIMEFRAME_LABELS = {
  all: "All Time",
  "30": "Last 30 Days",
  "90": "Last 3 Months",
  "180": "Last 6 Months",
  gt180: "More Than 6 Months",
};
const DIFFICULTIES = ["ALL", "EASY", "MEDIUM", "HARD"];

let dataset = null;
let companyIndex = null; // Map<companyName, Array<{slug, title, difficulty, topics, freqs}>>
let currentCompany = null;
let currentTimeframe = "all";
let currentDifficulty = "ALL";
let selectedTopics = new Set();

const els = {
  companiesView: document.getElementById("lcx-view-companies"),
  detailView: document.getElementById("lcx-view-detail"),
  search: document.getElementById("lcx-company-search"),
  companyList: document.getElementById("lcx-company-list"),
  backBtn: document.getElementById("lcx-back-btn"),
  companyName: document.getElementById("lcx-company-name"),
  timeframeSelect: document.getElementById("lcx-timeframe-select"),
  difficultyFilter: document.getElementById("lcx-difficulty-filter"),
  topicsFilter: document.getElementById("lcx-topics-filter"),
  problemList: document.getElementById("lcx-problem-list"),
};

// ---------- Data loading ----------

async function loadDataset() {
  const url = chrome.runtime.getURL("company-data.json");
  const res = await fetch(url);
  dataset = await res.json();
  buildCompanyIndex();
}

function buildCompanyIndex() {
  companyIndex = new Map();
  for (const [slug, entry] of Object.entries(dataset.problems)) {
    for (const [company, freqs] of Object.entries(entry.companies)) {
      if (!companyIndex.has(company)) companyIndex.set(company, []);
      companyIndex.get(company).push({
        slug,
        title: entry.title,
        difficulty: entry.difficulty,
        topics: entry.topics,
        freqs,
      });
    }
  }
}

// ---------- Company list view ----------

function renderCompanyList(filterText = "") {
  const query = filterText.trim().toLowerCase();
  const names = [...companyIndex.keys()]
    .filter((name) => name.toLowerCase().includes(query))
    .sort((a, b) => a.localeCompare(b));

  els.companyList.innerHTML = "";

  if (names.length === 0) {
    const empty = document.createElement("div");
    empty.className = "lcx-empty-state";
    empty.textContent = "No companies match.";
    els.companyList.appendChild(empty);
    return;
  }

  for (const name of names) {
    const row = document.createElement("div");
    row.className = "lcx-company-row";

    const label = document.createElement("span");
    label.textContent = name;

    const count = document.createElement("span");
    count.className = "lcx-count";
    count.textContent = companyIndex.get(name).length;

    row.appendChild(label);
    row.appendChild(count);
    row.addEventListener("click", () => openCompany(name));
    els.companyList.appendChild(row);
  }
}

// ---------- Detail view ----------

function openCompany(name) {
  currentCompany = name;
  currentDifficulty = "ALL";
  selectedTopics = new Set();
  currentTimeframe = "all";

  els.companyName.textContent = name;
  els.companiesView.hidden = true;
  els.detailView.hidden = false;

  renderTimeframeSelect();
  renderDifficultyFilter();
  renderTopicsFilter();
  renderProblemList();
}

function backToCompanyList() {
  currentCompany = null;
  els.detailView.hidden = true;
  els.companiesView.hidden = false;
}

function renderTimeframeSelect() {
  els.timeframeSelect.innerHTML = "";
  for (const [key, label] of Object.entries(TIMEFRAME_LABELS)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = label;
    if (key === currentTimeframe) opt.selected = true;
    els.timeframeSelect.appendChild(opt);
  }
  els.timeframeSelect.onchange = (e) => {
    currentTimeframe = e.target.value;
    renderProblemList();
  };
}

function renderDifficultyFilter() {
  els.difficultyFilter.innerHTML = "";
  for (const diff of DIFFICULTIES) {
    const btn = document.createElement("button");
    btn.className = "lcx-diff-btn" + (diff === currentDifficulty ? " active" : "");
    btn.textContent = diff === "ALL" ? "All" : diff.charAt(0) + diff.slice(1).toLowerCase();
    btn.addEventListener("click", () => {
      currentDifficulty = diff;
      renderDifficultyFilter();
      renderProblemList();
    });
    els.difficultyFilter.appendChild(btn);
  }
}

function renderTopicsFilter() {
  const problems = companyIndex.get(currentCompany) || [];
  const topicCounts = new Map();
  for (const p of problems) {
    for (const t of p.topics) {
      topicCounts.set(t, (topicCounts.get(t) || 0) + 1);
    }
  }
  const topics = [...topicCounts.keys()].sort((a, b) => topicCounts.get(b) - topicCounts.get(a));

  els.topicsFilter.innerHTML = "";
  for (const topic of topics) {
    const chip = document.createElement("span");
    chip.className = "lcx-topic-chip" + (selectedTopics.has(topic) ? " active" : "");
    chip.textContent = topic;
    chip.addEventListener("click", () => {
      if (selectedTopics.has(topic)) {
        selectedTopics.delete(topic);
      } else {
        selectedTopics.add(topic);
      }
      renderTopicsFilter();
      renderProblemList();
    });
    els.topicsFilter.appendChild(chip);
  }
}

function renderProblemList() {
  const problems = companyIndex.get(currentCompany) || [];

  const filtered = problems
    .filter((p) => p.freqs[currentTimeframe] !== undefined && p.freqs[currentTimeframe] !== null)
    .filter((p) => currentDifficulty === "ALL" || p.difficulty === currentDifficulty)
    .filter((p) => selectedTopics.size === 0 || p.topics.some((t) => selectedTopics.has(t)))
    .sort((a, b) => b.freqs[currentTimeframe] - a.freqs[currentTimeframe]);

  els.problemList.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "lcx-empty-state";
    empty.textContent = "No problems match these filters.";
    els.problemList.appendChild(empty);
    return;
  }

  for (const p of filtered) {
    const row = document.createElement("a");
    row.className = "lcx-problem-row";
    row.href = `https://leetcode.com/problems/${p.slug}/`;
    row.target = "_blank";
    row.rel = "noopener";

    const top = document.createElement("div");
    top.className = "lcx-problem-top";

    const titleWrap = document.createElement("span");
    titleWrap.className = "lcx-problem-title";
    const badge = document.createElement("span");
    badge.className = `lcx-diff-badge ${p.difficulty}`;
    badge.textContent = p.difficulty.charAt(0);
    titleWrap.appendChild(badge);
    titleWrap.appendChild(document.createTextNode(p.title));

    const freq = document.createElement("span");
    freq.className = "lcx-problem-freq";
    freq.textContent = p.freqs[currentTimeframe].toFixed(1);

    top.appendChild(titleWrap);
    top.appendChild(freq);

    const topicsLine = document.createElement("div");
    topicsLine.className = "lcx-problem-topics";
    topicsLine.textContent = p.topics.join(", ");

    row.appendChild(top);
    row.appendChild(topicsLine);
    els.problemList.appendChild(row);
  }
}

// ---------- Wiring ----------

els.search.addEventListener("input", (e) => renderCompanyList(e.target.value));
els.backBtn.addEventListener("click", backToCompanyList);

loadDataset()
  .then(() => renderCompanyList())
  .catch((err) => {
    els.companyList.innerHTML = "";
    const errEl = document.createElement("div");
    errEl.className = "lcx-empty-state";
    errEl.textContent = "Couldn't load company data.";
    els.companyList.appendChild(errEl);
    console.error("[LCX] popup dataset load failed", err);
  });
