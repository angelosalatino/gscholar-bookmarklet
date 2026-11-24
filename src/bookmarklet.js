/**
 * Google Scholar Citation Distribution & h-index Visualizer Bookmarklet
 * Self-contained, zero-dependency SVG visualization
 */
(function () {
  'use strict';

  var OVERLAY_ID = 'gsc-distribution-overlay';

  // Toggle if already open
  var existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    existing.remove();
    return;
  }

  // --- 1. DOM Parser for Google Scholar ---
  function parseScholarData() {
    var scholarName = (document.getElementById('gsc_prf_in') || {}).innerText || 'Scholar Profile';
    var rows = Array.from(document.querySelectorAll('tr.gsc_a_tr'));

    var papers = [];
    rows.forEach(function (row, idx) {
      var titleEl = row.querySelector('.gsc_a_at');
      var title = titleEl ? titleEl.innerText.trim() : 'Paper #' + (idx + 1);
      var link = titleEl ? titleEl.href : '';

      var citesEl = row.querySelector('.gsc_a_ac') || row.querySelector('.gsc_a_c');
      var citesRaw = citesEl ? citesEl.innerText.trim() : '0';
      var citations = parseInt(citesRaw.replace(/[^0-9]/g, ''), 10);
      if (isNaN(citations)) citations = 0;

      var yearEl = row.querySelector('.gsc_a_y');
      var yearRaw = yearEl ? yearEl.innerText.trim() : '';
      var year = parseInt(yearRaw.replace(/[^0-9]/g, ''), 10);
      if (isNaN(year)) year = null;

      papers.push({
        id: idx + 1,
        title: title,
        link: link,
        citations: citations,
        year: year
      });
    });

    return {
      scholarName: scholarName.trim(),
      papers: papers
    };
  }

  // --- 2. Calculations ---
  function calculateMetrics(papers) {
    if (!papers || papers.length === 0) {
      return { hIndex: 0, i10Index: 0, totalCitations: 0, median: 0, max: 0, gini: 0 };
    }

    var desc = papers.map(function (p) { return p.citations; }).sort(function (a, b) { return b - a; });
    var hIndex = 0;
    for (var i = 0; i < desc.length; i++) {
      if (desc[i] >= i + 1) hIndex = i + 1;
      else break;
    }

    var i10 = desc.filter(function (c) { return c >= 10; }).length;
    var total = desc.reduce(function (sum, c) { return sum + c; }, 0);
    var max = desc[0] || 0;
    var mid = Math.floor(desc.length / 2);
    var median = desc.length % 2 === 0 ? (desc[mid - 1] + desc[mid]) / 2 : desc[mid];

    // Gini inequality (0 = equal, 1 = concentrated)
    var asc = desc.slice().reverse();
    var n = asc.length;
    var gini = 0;
    if (total > 0 && n > 1) {
      var cum = 0;
      for (var k = 0; k < n; k++) cum += (k + 1) * asc[k];
      gini = (2 * cum) / (n * total) - (n + 1) / n;
      gini = Math.max(0, Math.min(1, gini));
    }

    return {
      hIndex: hIndex,
      i10Index: i10,
      totalCitations: total,
      median: median,
      max: max,
      gini: Number(gini.toFixed(3))
    };
  }

  // --- 3. Initial check ---
  var currentData = parseScholarData();
  var state = {
    sortOrder: 'desc', // default: descending (highest to lowest)
    scale: 'linear',   // 'linear' or 'log'
    papers: currentData.papers,
    scholarName: currentData.scholarName,
    isLoadingMore: false,
    loadTimer: null
  };

  if (state.papers.length === 0) {
    alert('Google Scholar Visualizer:\nCould not find any paper citations on this page.\nPlease ensure you are viewing a Google Scholar profile (citations?user=...).');
    return;
  }

  // --- 4. Scoped CSS & Container ---
  var overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;

  var style = document.createElement('style');
  style.textContent = [
    '#' + OVERLAY_ID + ' { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 2147483647; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; box-sizing: border-box; }',
    '#' + OVERLAY_ID + ' * { box-sizing: border-box; margin: 0; padding: 0; }',
    '#' + OVERLAY_ID + ' .gsc-card { background: #fff; width: 920px; max-width: 95vw; max-height: 92vh; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden; position: relative; }',
    '#' + OVERLAY_ID + ' .gsc-hdr { padding: 14px 20px; background: linear-gradient(135deg, #1e293b, #0f172a); color: #fff; display: flex; align-items: center; justify-content: space-between; cursor: grab; user-select: none; }',
    '#' + OVERLAY_ID + ' .gsc-hdr-title { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px; }',
    '#' + OVERLAY_ID + ' .gsc-hdr-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }',
    '#' + OVERLAY_ID + ' .gsc-hdr-actions { display: flex; align-items: center; gap: 8px; }',
    '#' + OVERLAY_ID + ' .gsc-btn { border: none; outline: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }',
    '#' + OVERLAY_ID + ' .gsc-btn-load { background: #334155; color: #f8fafc; border: 1px solid #475569; padding: 5px 10px; }',
    '#' + OVERLAY_ID + ' .gsc-btn-load:hover { background: #475569; }',
    '#' + OVERLAY_ID + ' .gsc-btn-close { background: transparent; color: #94a3b8; font-size: 18px; padding: 4px 8px; line-height: 1; }',
    '#' + OVERLAY_ID + ' .gsc-btn-close:hover { color: #fff; }',
    '#' + OVERLAY_ID + ' .gsc-ribbon { padding: 10px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }',
    '#' + OVERLAY_ID + ' .gsc-stat { background: #fff; border-radius: 8px; padding: 8px 10px; border: 1px solid #e2e8f0; }',
    '#' + OVERLAY_ID + ' .gsc-stat-lbl { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; }',
    '#' + OVERLAY_ID + ' .gsc-stat-val { font-size: 18px; font-weight: 700; margin-top: 2px; }',
    '#' + OVERLAY_ID + ' .gsc-stat-key { border-color: #fecdd3; }',
    '#' + OVERLAY_ID + ' .gsc-toolbar { padding: 8px 20px; background: #fff; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; font-size: 12px; flex-wrap: wrap; gap: 8px; }',
    '#' + OVERLAY_ID + ' .gsc-seg { display: inline-flex; background: #e2e8f0; border-radius: 6px; padding: 2px; }',
    '#' + OVERLAY_ID + ' .gsc-seg-btn { border: none; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; background: transparent; color: #475569; }',
    '#' + OVERLAY_ID + ' .gsc-seg-btn.active { background: #2563eb; color: #fff; }',
    '#' + OVERLAY_ID + ' .gsc-act-btn { background: #fff; border: 1px solid #cbd5e1; color: #334155; padding: 3px 8px; border-radius: 5px; font-size: 11px; font-weight: 600; cursor: pointer; }',
    '#' + OVERLAY_ID + ' .gsc-act-btn:hover { background: #f8fafc; }',
    '#' + OVERLAY_ID + ' .gsc-chart-wrap { padding: 16px 20px 20px 20px; flex: 1; min-height: 380px; position: relative; display: flex; flex-direction: column; background: #fff; }',
    '#' + OVERLAY_ID + ' .gsc-tip { position: absolute; display: none; background: rgba(15,23,42,0.95); color: #fff; padding: 8px 12px; border-radius: 6px; font-size: 11px; pointer-events: none; z-index: 100; max-width: 280px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); }',
    '#' + OVERLAY_ID + ' .gsc-ftr { padding: 8px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #64748b; }',
    '#' + OVERLAY_ID + ' .gsc-dot-active { cursor: pointer; transition: transform 0.1s ease; }'
  ].join('\n');
  overlay.appendChild(style);

  var card = document.createElement('div');
  card.className = 'gsc-card';

  card.innerHTML = [
    '<div class="gsc-hdr" id="gsc-hdr-drag">',
      '<div>',
        '<div class="gsc-hdr-title">📊 Citation Distribution: ' + escapeHtml(state.scholarName) + '</div>',
        '<div class="gsc-hdr-sub">Citing distribution curve & h-index threshold boundary</div>',
      '</div>',
      '<div class="gsc-hdr-actions">',
        '<button class="gsc-btn gsc-btn-load" id="gsc-load-all-btn">✓ All Loaded</button>',
        '<button class="gsc-btn gsc-btn-close" id="gsc-close-btn">✕</button>',
      '</div>',
    '</div>',
    '<div class="gsc-ribbon" id="gsc-stats"></div>',
    '<div class="gsc-toolbar">',
      '<div style="display:flex; align-items:center; gap:12px;">',
        '<div style="display:flex; align-items:center; gap:6px;">',
          '<span style="font-weight:600; color:#64748b;">ORDER:</span>',
          '<div class="gsc-seg">',
            '<button class="gsc-seg-btn active" id="gsc-ord-desc">Descending</button>',
            '<button class="gsc-seg-btn" id="gsc-ord-asc">Ascending</button>',
          '</div>',
        '</div>',
        '<div style="display:flex; align-items:center; gap:6px;">',
          '<span style="font-weight:600; color:#64748b;">SCALE:</span>',
          '<div class="gsc-seg">',
            '<button class="gsc-seg-btn active" id="gsc-scl-lin">Linear</button>',
            '<button class="gsc-seg-btn" id="gsc-scl-log">Log10</button>',
          '</div>',
        '</div>',
      '</div>',
      '<div style="display:flex; align-items:center; gap:6px;">',
        '<button class="gsc-act-btn" id="gsc-exp-csv">Export CSV</button>',
        '<button class="gsc-act-btn" id="gsc-exp-svg">Save SVG</button>',
      '</div>',
    '</div>',
    '<div class="gsc-chart-wrap" id="gsc-plot-area">',
      '<div class="gsc-tip" id="gsc-tooltip"></div>',
    '</div>',
    '<div class="gsc-ftr">',
      '<div style="display:flex; align-items:center; gap:14px;">',
        '<span><span style="display:inline-block; width:10px; height:10px; background:#2563eb; border-radius:2px; vertical-align:middle; margin-right:4px;"></span> Citations curve</span>',
        '<span><span style="display:inline-block; width:12px; height:3px; background:#f43f5e; vertical-align:middle; margin-right:4px;"></span> <strong>h-index boundary</strong> (citations ≥ h)</span>',
        '<span><span style="display:inline-block; width:12px; height:2px; border-top:2px dashed #f59e0b; vertical-align:middle; margin-right:4px;"></span> h-index level (y = h)</span>',
      '</div>',
      '<div>Hover points for details • Drag header to move</div>',
    '</div>'
  ].join('');

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- 5. Render Chart ---
  var plotArea = card.querySelector('#gsc-plot-area');
  var tooltip = card.querySelector('#gsc-tooltip');
  var statsContainer = card.querySelector('#gsc-stats');

  function render() {
    var raw = state.papers.slice();
    var n = raw.length;
    var metrics = calculateMetrics(raw);

    // Update Ribbon
    statsContainer.innerHTML = [
      statHTML('Total Papers', n, '#2563eb', false),
      statHTML('h-index', metrics.hIndex, '#f43f5e', true),
      statHTML('i10-index', metrics.i10Index, '#059669', false),
      statHTML('Total Citations', metrics.totalCitations.toLocaleString(), '#0284c7', false),
      statHTML('Median Citations', metrics.median, '#8b5cf6', false),
      statHTML('Gini Inequality', metrics.gini, '#d97706', false)
    ].join('');

    // Sort papers
    var sorted = raw.slice();
    if (state.sortOrder === 'asc') {
      sorted.sort(function (a, b) { return a.citations - b.citations; });
    } else {
      sorted.sort(function (a, b) { return b.citations - a.citations; });
    }

    var h = metrics.hIndex;
    var hCutoffPos = (state.sortOrder === 'asc')
      ? ((n - h) > 0 ? (n - h + 0.5) : 0.5)
      : (h + 0.5);

    var W = 880;
    var H = 340;
    var pad = { top: 25, right: 30, bottom: 45, left: 60 };
    var plotW = W - pad.left - pad.right;
    var plotH = H - pad.top - pad.bottom;
    var maxC = Math.max(metrics.max, 5);

    function scaleX(rank) {
      if (n <= 1) return pad.left + plotW / 2;
      return pad.left + ((rank - 1) / (n - 1)) * plotW;
    }

    function scaleXPos(pos) {
      if (n <= 1) return pad.left + plotW / 2;
      return pad.left + ((pos - 1) / (n - 1)) * plotW;
    }

    function scaleY(c) {
      if (state.scale === 'log') {
        var logMax = Math.log10(maxC + 1);
        var logVal = Math.log10(c + 1);
        return pad.top + plotH - (logVal / logMax) * plotH;
      }
      return pad.top + plotH - (c / maxC) * plotH;
    }

    // Y Ticks
    var yTicks = [];
    if (state.scale === 'log') {
      var logMaxVal = Math.ceil(Math.log10(maxC + 1));
      for (var p = 0; p <= logMaxVal; p++) {
        var val = Math.pow(10, p);
        if (val <= maxC * 1.5) yTicks.push(val);
      }
      if (yTicks.indexOf(0) === -1) yTicks.unshift(0);
    } else {
      var step = Math.pow(10, Math.floor(Math.log10(maxC)));
      if (maxC / step < 2) step /= 5;
      else if (maxC / step < 5) step /= 2;
      for (var yv = 0; yv <= maxC; yv += step) yTicks.push(yv);
      if (yTicks[yTicks.length - 1] < maxC) yTicks.push(maxC);
    }

    // X Ticks
    var xTicks = [];
    var xStep = Math.max(1, Math.round(n / 8));
    for (var xi = 1; xi <= n; xi += xStep) xTicks.push(xi);
    if (xTicks[xTicks.length - 1] !== n) xTicks.push(n);

    // SVG Generation
    var svg = [];
    svg.push('<svg id="gsc-svg-chart" viewBox="0 0 ' + W + ' ' + H + '" style="width:100%; height:100%; overflow:visible;" xmlns="http://www.w3.org/2000/svg">');
    svg.push('<defs>');
    svg.push('<linearGradient id="gscAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2563eb" stop-opacity="0.3"/><stop offset="100%" stop-color="#2563eb" stop-opacity="0.02"/></linearGradient>');
    svg.push('<linearGradient id="gscHGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f43f5e" stop-opacity="0.25"/><stop offset="100%" stop-color="#f43f5e" stop-opacity="0.02"/></linearGradient>');
    svg.push('</defs>');

    // Y Gridlines
    yTicks.forEach(function (tick) {
      var y = scaleY(tick);
      svg.push('<line x1="' + pad.left + '" y1="' + y + '" x2="' + (pad.left + plotW) + '" y2="' + y + '" stroke="#f1f5f9" stroke-width="1"/>');
      svg.push('<text x="' + (pad.left - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10" fill="#94a3b8">' + tick.toLocaleString() + '</text>');
    });

    // X Gridlines
    xTicks.forEach(function (tick) {
      var x = scaleX(tick);
      svg.push('<line x1="' + x + '" y1="' + pad.top + '" x2="' + x + '" y2="' + (pad.top + plotH) + '" stroke="#f8fafc" stroke-width="1"/>');
      svg.push('<text x="' + x + '" y="' + (pad.top + plotH + 18) + '" text-anchor="middle" font-size="10" fill="#94a3b8">#' + tick + '</text>');
    });

    // Axis lines
    svg.push('<line x1="' + pad.left + '" y1="' + (pad.top + plotH) + '" x2="' + (pad.left + plotW) + '" y2="' + (pad.top + plotH) + '" stroke="#cbd5e1" stroke-width="1.5"/>');
    svg.push('<line x1="' + pad.left + '" y1="' + pad.top + '" x2="' + pad.left + '" y2="' + (pad.top + plotH) + '" stroke="#cbd5e1" stroke-width="1.5"/>');
    svg.push('<text x="' + (pad.left + plotW / 2) + '" y="' + (pad.top + plotH + 36) + '" text-anchor="middle" font-size="11" font-weight="600" fill="#64748b">Paper Index (1 to ' + n + ', sorted ' + (state.sortOrder === 'asc' ? 'ascending' : 'descending') + ')</text>');
    svg.push('<text transform="rotate(-90)" x="' + -(pad.top + plotH / 2) + '" y="' + (pad.left - 42) + '" text-anchor="middle" font-size="11" font-weight="600" fill="#64748b">Citations' + (state.scale === 'log' ? ' (log10)' : '') + '</text>');

    // Points
    var pts = [];
    sorted.forEach(function (p, i) {
      var rank = i + 1;
      pts.push({ x: scaleX(rank), y: scaleY(p.citations), paper: p, rank: rank });
    });

    if (pts.length > 0) {
      var areaD = 'M ' + pts[0].x + ' ' + (pad.top + plotH);
      pts.forEach(function (pt) { areaD += ' L ' + pt.x + ' ' + pt.y; });
      areaD += ' L ' + pts[pts.length - 1].x + ' ' + (pad.top + plotH) + ' Z';
      svg.push('<path d="' + areaD + '" fill="url(#gscAreaGrad)"/>');

      var lineD = 'M ' + pts[0].x + ' ' + pts[0].y;
      for (var li = 1; li < pts.length; li++) lineD += ' L ' + pts[li].x + ' ' + pts[li].y;
      svg.push('<path d="' + lineD + '" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>');
    }

    // Horizontal y = h line
    if (h > 0) {
      var hY = scaleY(h);
      svg.push('<line x1="' + pad.left + '" y1="' + hY + '" x2="' + (pad.left + plotW) + '" y2="' + hY + '" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4,4"/>');
      svg.push('<text x="' + (pad.left + plotW - 4) + '" y="' + (hY - 5) + '" text-anchor="end" font-size="10" font-weight="700" fill="#d97706">y = h (' + h + ')</text>');
    }

    // Vertical h-index line
    if (h > 0 && n >= h) {
      var rawLineX = scaleXPos(hCutoffPos);
      var hLineX = Math.min(Math.max(rawLineX, pad.left), pad.left + plotW);
      var hRegX = state.sortOrder === 'asc' ? hLineX : pad.left;
      var hRegW = state.sortOrder === 'asc' ? (pad.left + plotW - hLineX) : (hLineX - pad.left);
      if (hRegW > 0) {
        svg.push('<rect x="' + hRegX + '" y="' + pad.top + '" width="' + hRegW + '" height="' + plotH + '" fill="url(#gscHGrad)"/>');
      }
      svg.push('<line x1="' + hLineX + '" y1="' + pad.top + '" x2="' + hLineX + '" y2="' + (pad.top + plotH) + '" stroke="#f43f5e" stroke-width="2.5" stroke-dasharray="5,4"/>');

      var bW = 96, bH = 20;
      var bX = Math.min(Math.max(hLineX - bW / 2, pad.left + 4), pad.left + plotW - bW - 4);
      svg.push('<rect x="' + bX + '" y="' + (pad.top - 18) + '" width="' + bW + '" height="' + bH + '" rx="4" fill="#f43f5e"/>');
      svg.push('<text x="' + (bX + bW / 2) + '" y="' + (pad.top - 4) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#ffffff">h = ' + h + ' threshold</text>');

      var lbl = state.sortOrder === 'asc' ? ((n - h + 1) + ' to ' + n) : ('1 to ' + h);
      svg.push('<text x="' + hLineX + '" y="' + (pad.top + plotH - 6) + '" text-anchor="' + (state.sortOrder === 'asc' ? 'start' : 'end') + '" font-size="10" font-weight="700" fill="#e11d48" dx="' + (state.sortOrder === 'asc' ? '6' : '-6') + '">h-core (' + lbl + ')</text>');
    }

    // Dots
    pts.forEach(function (pt) {
      var isHCore = (state.sortOrder === 'asc') ? (pt.rank >= (n - h + 1)) : (pt.rank <= h);
      var col = isHCore ? '#f43f5e' : '#2563eb';
      var r = n > 80 ? 2.5 : 3.5;
      svg.push('<circle class="gsc-data-pt" cx="' + pt.x + '" cy="' + pt.y + '" r="' + r + '" fill="' + col + '" stroke="#fff" stroke-width="1.5" style="cursor:pointer;" data-rank="' + pt.rank + '" data-c="' + pt.paper.citations + '" data-yr="' + (pt.paper.year || 'N/A') + '" data-t="' + escapeHtml(pt.paper.title) + '" data-hc="' + isHCore + '"/>');
    });

    svg.push('</svg>');

    var prevSvg = plotArea.querySelector('svg');
    if (prevSvg) prevSvg.remove();
    plotArea.insertAdjacentHTML('beforeend', svg.join(''));

    // Attach Tooltip events
    var circles = plotArea.querySelectorAll('.gsc-data-pt');
    circles.forEach(function (c) {
      c.onmouseenter = function (e) {
        c.setAttribute('r', '6');
        c.setAttribute('stroke', '#0f172a');
        var t = c.getAttribute('data-t');
        var rk = c.getAttribute('data-rank');
        var ct = c.getAttribute('data-c');
        var yr = c.getAttribute('data-yr');
        var hc = c.getAttribute('data-hc') === 'true';

        tooltip.innerHTML = [
          '<div style="font-weight:700; color:#60a5fa; margin-bottom:4px;">' + t + '</div>',
          '<div style="display:flex; justify-content:space-between; gap:10px; border-top:1px solid #334155; padding-top:4px;">',
            '<span>Citations: <strong style="color:#38bdf8;">' + ct + '</strong></span>',
            '<span>Year: <strong>' + yr + '</strong></span>',
          '</div>',
          '<div style="display:flex; justify-content:space-between; gap:10px; margin-top:2px;">',
            '<span>Position: <strong>#' + rk + ' of ' + n + '</strong></span>',
            '<span>' + (hc ? '<strong style="color:#f43f5e;">★ in h-core</strong>' : '<span style="color:#94a3b8;">below h</span>') + '</span>',
          '</div>'
        ].join('');
        tooltip.style.display = 'block';
        moveTip(e);
      };
      c.onmousemove = moveTip;
      c.onmouseleave = function () {
        var defR = n > 80 ? 2.5 : 3.5;
        c.setAttribute('r', defR.toString());
        c.setAttribute('stroke', '#fff');
        tooltip.style.display = 'none';
      };
    });
  }

  function moveTip(e) {
    var rect = plotArea.getBoundingClientRect();
    var x = e.clientX - rect.left + 12;
    var y = e.clientY - rect.top - 12;
    if (x + 260 > rect.width) x = x - 270;
    if (y < 10) y = 10;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }

  function statHTML(lbl, val, col, key) {
    return [
      '<div class="gsc-stat' + (key ? ' gsc-stat-key' : '') + '">',
        '<div class="gsc-stat-lbl">' + lbl + '</div>',
        '<div class="gsc-stat-val" style="color:' + col + ';">' + val + '</div>',
      '</div>'
    ].join('');
  }

  // --- 6. Controls ---
  function closeOverlay() {
    if (state.loadTimer) {
      clearInterval(state.loadTimer);
      state.loadTimer = null;
      state.isLoadingMore = false;
    }
    overlay.remove();
  }

  card.querySelector('#gsc-close-btn').onclick = closeOverlay;
  overlay.onclick = function (e) { if (e.target === overlay) closeOverlay(); };

  var bAsc = card.querySelector('#gsc-ord-asc');
  var bDesc = card.querySelector('#gsc-ord-desc');
  bAsc.onclick = function () {
    state.sortOrder = 'asc';
    bAsc.className = 'gsc-seg-btn active';
    bDesc.className = 'gsc-seg-btn';
    render();
  };
  bDesc.onclick = function () {
    state.sortOrder = 'desc';
    bDesc.className = 'gsc-seg-btn active';
    bAsc.className = 'gsc-seg-btn';
    render();
  };

  var bLin = card.querySelector('#gsc-scl-lin');
  var bLog = card.querySelector('#gsc-scl-log');
  bLin.onclick = function () {
    state.scale = 'linear';
    bLin.className = 'gsc-seg-btn active';
    bLog.className = 'gsc-seg-btn';
    render();
  };
  bLog.onclick = function () {
    state.scale = 'log';
    bLog.className = 'gsc-seg-btn active';
    bLin.className = 'gsc-seg-btn';
    render();
  };

  // Load all papers automation (runs automatically on launch, button allows stopping/restarting)
  var bLoadAll = card.querySelector('#gsc-load-all-btn');
  function stopLoading(finished) {
    if (state.loadTimer) {
      clearInterval(state.loadTimer);
      state.loadTimer = null;
    }
    state.isLoadingMore = false;
    var ref = parseScholarData();
    state.papers = ref.papers;
    render();
    if (finished) {
      bLoadAll.innerText = '✓ All Loaded (' + state.papers.length + ')';
      bLoadAll.style.background = '#059669';
      bLoadAll.style.borderColor = '#059669';
    } else {
      bLoadAll.innerText = '⚡ Load Remaining';
      bLoadAll.style.background = '#334155';
      bLoadAll.style.borderColor = '#475569';
    }
  }

  function startLoadingAll() {
    var moreBtn = document.getElementById('gsc_bpf_more');
    var hasMore = moreBtn && !moreBtn.disabled && !moreBtn.classList.contains('gs_btn_ds');
    if (!hasMore) {
      stopLoading(true);
      return;
    }

    state.isLoadingMore = true;
    bLoadAll.innerText = '⏳ Loading (' + state.papers.length + ')... Stop';
    bLoadAll.style.background = '#d97706';
    bLoadAll.style.borderColor = '#d97706';

    var lastCount = state.papers.length;
    var idleTicks = 0;

    state.loadTimer = setInterval(function () {
      var btn = document.getElementById('gsc_bpf_more');
      var done = !btn || btn.disabled || btn.classList.contains('gs_btn_ds');
      var cur = parseScholarData();

      if (cur.papers.length !== lastCount) {
        lastCount = cur.papers.length;
        idleTicks = 0;
        state.papers = cur.papers;
        render();
        bLoadAll.innerText = '⏳ Loading (' + cur.papers.length + ')... Stop';
      } else {
        idleTicks++;
      }

      if (done || idleTicks > 20) {
        stopLoading(done);
      } else {
        btn.click();
      }
    }, 450);
  }

  bLoadAll.onclick = function () {
    if (state.isLoadingMore) {
      stopLoading(false);
    } else {
      startLoadingAll();
    }
  };

  // CSV
  card.querySelector('#gsc-exp-csv').onclick = function () {
    var rows = [['Rank', 'Title', 'Citations', 'Year', 'Link']];
    var s = state.papers.slice();
    if (state.sortOrder === 'asc') s.sort(function (a, b) { return a.citations - b.citations; });
    else s.sort(function (a, b) { return b.citations - a.citations; });

    s.forEach(function (p, i) {
      rows.push([
        i + 1,
        '"' + (p.title || '').replace(/"/g, '""') + '"',
        p.citations,
        p.year || '',
        '"' + (p.link || '').replace(/"/g, '""') + '"'
      ]);
    });
    var csv = 'data:text/csv;charset=utf-8,' + rows.map(function (r) { return r.join(','); }).join('\n');
    var a = document.createElement('a');
    a.href = encodeURI(csv);
    a.download = (state.scholarName || 'scholar').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_citations.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // SVG
  card.querySelector('#gsc-exp-svg').onclick = function () {
    var el = plotArea.querySelector('svg');
    if (!el) return;
    var src = (new XMLSerializer()).serializeToString(el);
    if (src.indexOf('xmlns="http://www.w3.org/2000/svg"') === -1) {
      src = src.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    var blob = new Blob([src], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (state.scholarName || 'scholar').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_distribution.svg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Dragging
  var dragHdr = card.querySelector('#gsc-hdr-drag');
  var isDragging = false, startX, startY, initX, initY;
  dragHdr.onmousedown = function (e) {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    var r = card.getBoundingClientRect();
    initX = r.left;
    initY = r.top;
    card.style.position = 'absolute';
    card.style.margin = '0';
    card.style.left = initX + 'px';
    card.style.top = initY + 'px';
    dragHdr.style.cursor = 'grabbing';
  };
  window.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    card.style.left = (initX + (e.clientX - startX)) + 'px';
    card.style.top = (initY + (e.clientY - startY)) + 'px';
  });
  window.addEventListener('mouseup', function () {
    if (isDragging) {
      isDragging = false;
      dragHdr.style.cursor = 'grab';
    }
  });

  // ESC key
  window.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') {
      closeOverlay();
      window.removeEventListener('keydown', onEsc);
    }
  });

  render();
  startLoadingAll();
})();
