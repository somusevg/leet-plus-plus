# leet++
VIKAS SOMUSE

Shows company tags + interview frequency (30d / 3mo / 6mo / >6mo / all-time)
on LeetCode problem pages, sourced from internet. 
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

DataSet will be updated periodically, keep updating company-data file accordingly. 

..vxy
