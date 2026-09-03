# LeetCode Company Tags — Chrome Extension

Shows company tags + interview frequency (30d / 3mo / 6mo / >6mo / all-time)
on LeetCode problem pages, sourced from
[liquidslr/leetcode-company-wise-problems](https://github.com/liquidslr/leetcode-company-wise-problems)
(471 companies, 3,392 unique problems, snapshot as of repo clone date).

## Load it (unpacked)

1. Unzip this folder.
2. Chrome -> `chrome://extensions`
3. Toggle **Developer mode** (top right).
4. Click **Load unpacked** -> select the unzipped `extension/` folder.
5. Visit any `https://leetcode.com/problems/<slug>/` page.
6. Click the extension's toolbar icon (puzzle-piece menu) once and set
   site access to **"On leetcode.com"** (Chrome defaults new extensions
   to "When you click the extension", which won't auto-inject the
   panel). This is a one-time, per-install Chrome setting — it can't be
   preset by the extension itself.

## How it works

- `company-data.json` — prebuilt slug -> company/frequency map.
  Built once by `build_data.py` from the raw CSVs, not parsed at runtime.
- `content.js` — extracts the problem slug from the URL, looks it up,
  injects a panel above the problem description.
- SPA handling: LeetCode never does a full page reload between problems,
  so the script polls `location.href` every 600ms and re-renders on
  change. It also re-injects the panel if LeetCode's own re-render wipes
  it out (e.g. switching between Description/Editorial/Solutions tabs).

## Known fragility (read before reporting "it broke")

LeetCode's React app uses hashed/utility class names that change across
their deploys. `content.js` tries several selector strategies
(`TARGET_SELECTORS`) to find where to inject the panel — if LeetCode
ships a redesign, this is the first thing to fix. Check the browser
console for `[LCX]` log lines; a `could not find insertion point`
warning means the selectors need updating.

## Usage analytics

Anonymous usage tracking runs through Google Analytics 4 — no backend
needed, already configured in `background.js` with your Measurement ID
and API secret. It tells you daily/weekly active users and which
problems get viewed, using a random per-install ID (never a name,
email, or account).

**⚠️ Web Store listing note:** since this collects usage data, don't
declare "no data collection" in the Chrome Web Store's Privacy
Practices tab. Instead:
- Check "Collects usage statistics" (or equivalent current wording).
- Declare that you collect a randomly generated identifier + which
  problem pages are viewed, purely for aggregate usage counts.
- State clearly this data is **not** sold, **not** linked to identity,
  and **not** used for anything beyond product analytics.
- Add a short privacy policy page (even a single paragraph on a GitHub
  Pages / Notion page works) and link it in the listing — required once
  any data collection is declared.

## Welcome page

On first install, `background.js` opens `welcome.html` in a new tab —
a short "Happy solving!" screen with a Report a Bug link
(mailto:somusevg@gmail.com). Doesn't reopen on updates, only on the
initial install (`chrome.runtime.onInstalled`, `reason === "install"`).

## Refreshing the dataset later

The source repo updates periodically. To regenerate:

```bash
git clone --depth 1 https://github.com/liquidslr/leetcode-company-wise-problems.git repo
python3 build_data.py
```

This overwrites `extension/company-data.json`.
