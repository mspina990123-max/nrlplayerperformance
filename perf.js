/**
 * FootyStatistics — Player Performance Overlay (Last 25 Games)
 * Run this in the DevTools Console OR host as perf.js for your GitHub Pages bookmarklet loader.
 *
 * UPDATED SCORING:
 * - 4 points per point scored by the player
 * - 10 points per try assist
 * - 1 point per 10 run metres (rounded down)
 * - 5 points per line break
 * - 1 point per tackle
 *
 * Works by reading the currently-rendered player game stats table in the DOM.
 * If the table isn't loaded / visible (or requires login), it will alert and exit.
 */
(() => {
  // ---------- CONFIG ----------
  const OVERLAY_ID = "fs-perf-overlay";
  const MAX_GAMES = 25;

  // Remove existing overlay if rerun
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();

  const toNum = (v) => {
    if (v == null) return 0;
    const s = String(v).replace(/,/g, "").trim();
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const computePerformance = (row) => {
    const T = toNum(row.T);
    const G = toNum(row.G);
    const FG = toNum(row.FG);
    const TA = toNum(row.TA);
    const MG = toNum(row.MG);
    const LB = toNum(row.LB);
    const TCK = toNum(row.TCK);

    // Points scored by player
    const matchPoints = 4 * T + 2 * G + 1 * FG;

    // Custom scoring
    const runMetrePoints = Math.floor(MG / 10); // 1 point per 10m, rounded down
    const tryAssistPoints = TA * 10;            // 10 points per try assist

    const performance =
      (4 * matchPoints) +    // 4 points per point scored
      tryAssistPoints +      // 10 points per try assist
      runMetrePoints +       // 1 point per 10 run metres
      (5 * LB) +             // 5 points per line break
      TCK;                   // 1 point per tackle

    return {
      ...row,
      matchPoints,
      runMetrePoints,
      tryAssistPoints,
      performance,
    };
  };

  // ---------- FIND STATS TABLE ----------
  // Look for a <table> containing headers like "TCK" and "MG"
  const tables = Array.from(document.querySelectorAll("table"));
  const table = tables.find((t) => {
    const txt = (t.querySelector("thead")?.innerText || t.innerText || "");
    return /(^|\s)TCK(\s|$)/.test(txt) && /(^|\s)MG(\s|$)/.test(txt);
  });

  if (!table) {
    alert(
      "Could not find the player game stats table on this page.\n\n" +
        "Possible reasons:\n" +
        "- The page hasn't fully loaded yet (wait and run again)\n" +
        "- The table is hidden unless you're logged in\n" +
        "- The site uses a non-table layout for this view"
    );
    return;
  }

  // Extract headers + rows
  const headers = Array.from(table.querySelectorAll("thead th"))
    .map((th) => th.textContent.trim())
    .filter(Boolean);

  const bodyRows = Array.from(table.querySelectorAll("tbody tr")).map((tr) =>
    Array.from(tr.querySelectorAll("td")).map((td) => td.textContent.trim())
  );

  if (!headers.length || !bodyRows.length) {
    alert("Found the table, but it has no readable headers/rows yet. Try again after it loads.");
    return;
  }

  // Build objects per row: header -> cell
  const rowObjects = bodyRows.map((cells) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = cells[i] ?? ""));
    return obj;
  });

  // Header mapping for variations (if the site changes labels)
  const headerMap = {
    Tackles: "TCK",
    Tkl: "TCK",
    "Metres Gained": "MG",
    Metres: "MG",
    "Line Breaks": "LB",
    "Try Assists": "TA",
    Tries: "T",
    Goals: "G",
    "Field Goals": "FG",
    Opp: "Opponent",
    Vs: "Opponent",
    Round: "Rnd",
  };

  const normaliseRow = (r) => {
    const nr = { ...r };
    for (const [from, to] of Object.entries(headerMap)) {
      if (nr[to] == null && nr[from] != null) nr[to] = nr[from];
    }

    // Friendly label
    const season = (nr.Season ?? "").toString().trim();
    const rnd = (nr.Rnd ?? "").toString().trim();
    const opp = (nr.Opponent ?? "").toString().trim();
    const date = (nr.Date ?? "").toString().trim();

    const parts = [];
    if (season) parts.push(season);
    if (rnd) parts.push(`R${rnd}`);
    if (opp) parts.push(`vs ${opp}`);
    if (date) parts.push(date);

    nr.Game = parts.join(" ").trim() || opp || "(Game)";
    return nr;
  };

  // Take last 25 (assumes newest first on the site)
  const games = rowObjects.slice(0, MAX_GAMES).map(normaliseRow).map(computePerformance);

  if (!games.length) {
    alert("No games found to score.");
    return;
  }

  // ---------- BUILD OVERLAY UI ----------
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    width: min(760px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    overflow: auto;
    background: rgba(20, 20, 24, 0.95);
    color: #fff;
    z-index: 2147483647;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 14px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  `;

  const title = document.createElement("div");
  title.style.cssText = `
    padding: 12px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border-bottom: 1px solid rgba(255,255,255,0.12);
    position: sticky;
    top: 0;
    background: rgba(20, 20, 24, 0.98);
    backdrop-filter: blur(6px);
  `;

  const titleLeft = document.createElement("div");
  titleLeft.innerHTML = `
    <div style="font-weight: 700; font-size: 14px;">Performance (Last ${games.length} games)</div>
    <div style="opacity: 0.8; font-size: 12px; margin-top: 2px;">
      4×points + 10×TA + floor(MG/10) + 5×LB + TCK
    </div>
  `;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.style.cssText = `
    appearance: none;
    border: 0;
    border-radius: 10px;
    padding: 6px 10px;
    cursor: pointer;
    background: rgba(255,255,255,0.12);
    color: #fff;
    font-weight: 700;
  `;
  closeBtn.onclick = () => overlay.remove();

  title.appendChild(titleLeft);
  title.appendChild(closeBtn);

  // Summary
  const scores = games.map((g) => g.performance);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const max = Math.max(...scores);
  const min = Math.min(...scores);

  const summary = document.createElement("div");
  summary.style.cssText = `
    padding: 10px 14px;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
  `;

  const statBox = (label, value) => {
    const d = document.createElement("div");
    d.style.cssText = `
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 12px;
      padding: 10px;
    `;
    d.innerHTML = `
      <div style="opacity:0.8; font-size: 12px;">${label}</div>
      <div style="font-size: 18px; font-weight: 800; margin-top: 2px;">${value}</div>
    `;
    return d;
  };

  summary.appendChild(statBox("Avg", avg.toFixed(1)));
  summary.appendChild(statBox("Max", max));
  summary.appendChild(statBox("Min", min));

  // Chart container
  const chartWrap = document.createElement("div");
  chartWrap.style.cssText = `padding: 0 14px 10px 14px;`;

  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 260;
  canvas.style.cssText = `
    width: 100%;
    height: auto;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 12px;
  `;
  chartWrap.appendChild(canvas);

  // Table
  const tbl = document.createElement("table");
  tbl.style.cssText = `
    width: calc(100% - 28px);
    margin: 0 14px 14px 14px;
    border-collapse: collapse;
    font-size: 12px;
  `;

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr style="text-align:left; opacity:0.9;">
      <th style="padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.12);">Game</th>
      <th style="padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.12);">Perf</th>
      <th style="padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.12);">Pts</th>
      <th style="padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.12);">TA pts</th>
      <th style="padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.12);">MG pts</th>
      <th style="padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.12);">LB</th>
      <th style="padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.12);">TCK</th>
    </tr>
  `;
  tbl.appendChild(thead);

  const tbody = document.createElement("tbody");
  games.forEach((g) => {
    const tr = document.createElement("tr");
    const mgRaw = Math.floor(toNum(g.MG));
    tr.innerHTML = `
      <td style="padding: 7px 6px; border-bottom: 1px solid rgba(255,255,255,0.08); max-width: 360px; overflow:hidden; text-overflow: ellipsis; white-space: nowrap;" title="${g.Game}">${g.Game}</td>
      <td style="padding: 7px 6px; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 800;">${g.performance}</td>
      <td style="padding: 7px 6px; border-bottom: 1px solid rgba(255,255,255,0.08);">${g.matchPoints}</td>
      <td style="padding: 7px 6px; border-bottom: 1px solid rgba(255,255,255,0.08);">${g.tryAssistPoints}</td>
      <td style="padding: 7px 6px; border-bottom: 1px solid rgba(255,255,255,0.08);">${g.runMetrePoints} <span style="opacity:0.65;">(${mgRaw}m)</span></td>
      <td style="padding: 7px 6px; border-bottom: 1px solid rgba(255,255,255,0.08);">${toNum(g.LB)}</td>
      <td style="padding: 7px 6px; border-bottom: 1px solid rgba(255,255,255,0.08);">${toNum(g.TCK)}</td>
    `;
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);

  overlay.appendChild(title);
  overlay.appendChild(summary);
  overlay.appendChild(chartWrap);
  overlay.appendChild(tbl);
  document.body.appendChild(overlay);

  // ---------- DRAW CHART ----------
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const pad = { l: 44, r: 12, t: 14, b: 34 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  // Reverse so chart shows older->newer left-to-right
  const data = [...games].reverse();
  const yVals = data.map((d) => d.performance);
  const yMin = Math.min(...yVals);
  const yMax = Math.max(...yVals);
  const yRange = yMax - yMin || 1;

  ctx.clearRect(0, 0, W, H);

  // Grid lines + y labels
  const gridLines = 4;
  ctx.lineWidth = 1;

  for (let i = 0; i <= gridLines; i++) {
    const y = pad.t + (plotH * i) / gridLines;

    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + plotW, y);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.stroke();

    const v = yMax - (yRange * i) / gridLines;
    ctx.font = "11px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(String(Math.round(v)), 6, y + 4);
  }

  // x positions
  const xStep = plotW / Math.max(1, data.length - 1);
  const xAt = (idx) => pad.l + idx * xStep;
  const yAt = (val) => pad.t + ((yMax - val) / yRange) * plotH;

  // Line
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xAt(i);
    const y = yAt(d.performance);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Points
  data.forEach((d, i) => {
    const x = xAt(i);
    const y = yAt(d.performance);
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fill();
  });

  // X labels (every 5th + last)
  const labelIdxs = [];
  for (let i = 0; i < data.length; i += 5) labelIdxs.push(i);
  if (!labelIdxs.includes(data.length - 1)) labelIdxs.push(data.length - 1);

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "10px system-ui";

  labelIdxs.forEach((i) => {
    const text = data[i].Game || "";
    const x = xAt(i);
    const y = pad.t + plotH + 22;
    const short = text.length > 18 ? text.slice(0, 18) + "…" : text;
    ctx.fillText(short, Math.max(0, x - 35), y);
  });

  console.log(`[FootyStats Perf] Rendered overlay with ${games.length} games. Close with the ✕ button.`);
})();
