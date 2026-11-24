# Google Scholar Citation Distribution & h-index Visualizer

A self-contained JavaScript bookmarklet that parses any Google Scholar profile (such as [Geoffrey Hinton's profile](https://scholar.google.com/citations?user=RFWhMIkAAAAJ&hl=en)), automatically loads all papers on the profile, sorts them in descending order (highest to lowest citations, with an option to toggle ascending), and renders an interactive SVG chart floating directly in the middle of your screen with an explicit vertical boundary indicating where the **h-index** sits.

---

## 🚀 Quick Start / Installation

### Method 1: Drag-and-Drop Installation (Recommended)
1. Open `index.html` in your browser (double-click `index.html` locally, or visit your deployed GitHub Pages URL).
2. Make sure your browser's Bookmarks bar is visible:
   - **Chrome / Edge / Brave**: Press `Cmd + Shift + B` (Mac) or `Ctrl + Shift + B` (Windows/Linux).
   - **Safari**: View > Always Show Bookmarks Bar (`Cmd + Shift + B`).
   - **Firefox**: Press `Ctrl + Shift + B` or `Cmd + Shift + B`.
3. Drag the blue **`📊 Scholar Distribution`** button directly up into your Bookmarks Bar.

### Method 2: Manual Bookmark Creation
1. Copy the full bookmarklet URL from [`dist/bookmarklet.url.txt`](dist/bookmarklet.url.txt).
2. Right-click your Bookmarks Bar and select **"Add Page..."** / **"New Bookmark"**.
3. Name it **"Scholar Distribution"** and paste the code into the **URL / Location** field.
4. Save.

---

## 📖 How to Use

1. Navigate to any Google Scholar researcher profile (e.g., `https://scholar.google.com/citations?user=RFWhMIkAAAAJ&hl=en`).
2. Click the **Scholar Distribution** bookmarklet from your bookmarks bar.
3. A modal immediately appears floating in the middle of the screen and **automatically loads all papers** from the profile (clicking Scholar's "Show more" button in the background while updating the chart live). It displays:
   - **Interactive Area Chart**: Citation counts sorted in **descending order** (highest to lowest) across all articles, with a toggle to switch to ascending order.
   - **Vertical Line (Red)**: The exact threshold separating papers inside the h-core from those below it.
   - **Horizontal Reference (Yellow dashed)**: The line at citation count $y = h$.
   - **Summary Ribbon**: Total papers ($N$), $h$-index, $i10$-index, total citations, median citations, and Gini citation inequality.
   - **Scale Switcher**: Toggle between **Linear** and **Log10** scale ($y \to \log_{10}(y+1)$) to inspect power-law behavior in heavy-tailed citation distributions.
   - **Auto-Load Progress & Stop Control**: Automatically expands the full publication list on launch, with a header button to stop early or resume loading for very large profiles.
   - **Data Export**: Export paper rankings to CSV or download the vector graphic as SVG.
   - **Interactive Hover**: Hover any point to view the paper's title, year, citations, and rank.

---

## 🧮 Mathematical Details

### 1. The h-index Definition
A researcher has an index $h$ if $h$ of their $N$ publications have at least $h$ citations each, and the other $(N - h)$ papers have $\le h$ citations each.

### 2. Descending Order Placement (Default)
When papers are sorted in **descending order** ($c_1 \ge c_2 \ge \dots \ge c_N$):
- The $h$ most cited papers occupy the left-hand side of the distribution, from rank:
  $$\text{Rank} = 1 \quad \text{to} \quad h$$
- The visualizer places a prominent vertical line right after the $h$-th paper (at $x = h + 0.5$).
- Everything to the left of the vertical line represents the **h-core** (papers contributing to the scholar's h-index).
- Everything to the right represents the long tail of papers below the h-index threshold.
- Switching to **Ascending** mode mirrors the curve so the h-core sits on the right (indices $N - h + 1$ to $N$).

### 3. Logarithmic Scaling
Citation distributions typically follow a Pareto / power-law distribution ($P(C) \sim C^{-\alpha}$). A linear chart often compresses 95% of papers near the bottom axis due to a few super-hits. The built-in **Log10** toggle enables direct analysis of both emergent work and landmark papers simultaneously.

---

## 🛡️ Content Security Policy (CSP) Compliance
Google Scholar enforces strict Content Security Policies that block loading third-party scripts from external CDNs (such as Chart.js, D3, or unpkg).

This bookmarklet is **100% self-contained vanilla JavaScript**:
- Zero external libraries or network requests.
- Pure native SVG generation.
- Scoped DOM styling that does not interfere with Google Scholar's styles.

---

## 📁 Repository Structure

```
├── src/
│   └── bookmarklet.js          # Readable, unminified source code
├── dist/
│   ├── bookmarklet.min.js      # Cleaned code ready for browser execution
│   └── bookmarklet.url.txt     # Bookmarklet URL (javascript:(function(){...})())
├── tests/
│   └── test_logic.js           # Unit tests for metric calculations
├── index.html                  # Interactive landing page & in-browser simulator
├── build.py                    # Tokenizer & minification script
└── README.md                   # Documentation
```
