/* eslint-disable func-style,no-console */
import fs from 'node:fs'
import path from 'node:path'

import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

import { renderPdfToPngs } from './render-pdf.mjs'

/**
 *
 * @param n
 */
function pad(n) {
  return n.toString().padStart(2, '0')
}

/**
 *
 * @param date
 */
function formatDateLocal(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${pad(date.getDate())}.${pad(
    date.getMonth() + 1,
  )}.${date.getFullYear()}`
}

/**
 *
 * @param stats
 */
function pickCreationDate(stats) {
  const bt = Number(stats.birthtimeMs)
  const now = Date.now()

  const MIN_REASONABLE = Date.UTC(1980, 0, 1)
  const MAX_FUTURE_SKEW = 5 * 60 * 1000

  if (Number.isFinite(bt) && bt > MIN_REASONABLE && bt <= now + MAX_FUTURE_SKEW) {
    return { date: new Date(bt), kind: 'birthtime' }
  }

  const mt = Number(stats.mtimeMs)
  if (Number.isFinite(mt) && mt > 0) {
    return { date: new Date(mt), kind: 'mtime-fallback' }
  }

  const ct = Number(stats.ctimeMs)
  if (Number.isFinite(ct) && ct > 0) {
    return { date: new Date(ct), kind: 'ctime-fallback' }
  }

  return { date: new Date(0), kind: 'unknown' }
}

/**
 *
 * @param p
 */
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

/**
 *
 * @param p
 */
function cleanDir(p) {
  for (const f of fs.readdirSync(p)) {
    fs.rmSync(path.join(p, f), { force: true })
  }
}

/**
 *
 * @param srcDir
 * @param dstDir
 */
function copyDirPngs(srcDir, dstDir) {
  ensureDir(dstDir)
  cleanDir(dstDir)
  const pages = listPages(srcDir)
  for (const p of pages) {
    fs.copyFileSync(path.join(srcDir, p), path.join(dstDir, p))
  }
}

/**
 *
 * @param filePath
 */
function readPng(filePath) {
  const buf = fs.readFileSync(filePath)

  return PNG.sync.read(buf)
}

/**
 *
 * @param filePath
 * @param png
 */
function writePng(filePath, png) {
  const buf = PNG.sync.write(png)
  fs.writeFileSync(filePath, buf)
}

/**
 *
 * @param dir
 */
function listPages(dir) {
  if (!fs.existsSync(dir)) {
    return []
  }

  return fs
    .readdirSync(dir)
    .filter((f) => /^page-\d{3}\.png$/.test(f))
    .sort()
}

/**
 *
 * @param s
 */
function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

/**
 *
 * @param rows
 * @param root0
 * @param root0.totalDiffPercent
 * @param root0.pageCount
 * @param root0.reportFileName
 * @param root0.creationInfoHtml
 * @param root0.baselineDir
 * @param root0.currentDir
 * @param root0.diffDir
 * @param root0.threshold
 * @param root0.maxDiffPercent
 */
function buildReportHtml(
  rows,
  {
    totalDiffPercent,
    pageCount,
    reportFileName,
    creationInfoHtml,
    baselineDir,
    currentDir,
    diffDir,
    threshold,
    maxDiffPercent,
  },
) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PDF visual diff: ${escapeHtml(reportFileName)}</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 16px; }
  .summary { padding: 12px; border: 1px solid #ccc; border-radius: 8px; margin-bottom: 16px; }
  .bad { border-color: #c00; }
  .ok { border-color: #0a0; }
  .grid { display: grid; grid-template-columns: 180px 1fr; gap: 12px; align-items: start; margin-bottom: 18px; }
  .imgs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .controls { display: flex; gap: 12px; align-items: center; margin: 12px 0 16px; }
  .controls label { display: inline-flex; gap: 8px; align-items: center; cursor: pointer; user-select: none; }
  .controls input[type="checkbox"] { width: 16px; height: 16px; }
  .hidden { display: none !important; }
  figure { margin: 0; }
  figcaption { font-size: 12px; opacity: 0.8; margin: 6px 0 10px; }
  img { width: 100%; height: auto; border: 1px solid #ddd; border-radius: 6px; }
  code { background: #f3f3f3; padding: 2px 4px; border-radius: 4px; }
</style>
</head>
<body>
<h1>PDF visual diff: <code>${escapeHtml(reportFileName)}</code></h1>
<div class="summary ${totalDiffPercent > maxDiffPercent ? 'bad' : 'ok'}">
  ${creationInfoHtml}
  <div><b>Pages:</b> ${pageCount}</div>
  <div><b>Total diff:</b> ${totalDiffPercent.toFixed(4)}%</div>
  <div><b>Threshold (pixelmatch):</b> ${threshold}</div>
  <div><b>Allowed total diff (%):</b> ${maxDiffPercent}</div>
  <div><b>Baseline (left):</b> <code>${escapeHtml(baselineDir)}</code></div>
  <div><b>Current (right):</b> <code>${escapeHtml(currentDir)}</code></div>
  <div><b>Diff:</b> <code>${escapeHtml(diffDir)}</code></div>
</div>

<div class="controls">
  <label>
    <input id="onlyDiff" type="checkbox" checked />
    Diffs only
  </label>
  <span id="visibleCount"></span>
</div>

${rows
  .map((r) => {
    const status = escapeHtml(r.status)
    const dp = Number.isFinite(r.diffPercent) ? r.diffPercent.toFixed(4) : 'n/a'
    const base = r.baseRel
      ? `<figure><figcaption>left</figcaption><img src="${escapeHtml(r.baseRel)}"></figure>`
      : `<div>—</div>`
    const curr = r.currRel
      ? `<figure><figcaption>right</figcaption><img src="${escapeHtml(r.currRel)}"></figure>`
      : `<div>—</div>`
    const diff = r.diffRel
      ? `<figure><figcaption>diff</figcaption><img src="${escapeHtml(r.diffRel)}"></figure>`
      : `<div>—</div>`

    return `<div class="grid" data-status="${status}">
    <div>
      <div><b>${escapeHtml(r.page)}</b></div>
      <div style="${status === 'diff' ? 'color: red' : ''}">Status: <code>${status}</code></div>
      <div>Diff: <code>${dp}%</code></div>
    </div>
    <div class="imgs">${base}${curr}${diff}</div>
  </div>`
  })
  .join('\n')}

<script>
(function () {
  const checkbox = document.getElementById('onlyDiff');
  const rows = Array.from(document.querySelectorAll('.grid[data-status]'));
  const visibleCount = document.getElementById('visibleCount');

  function applyFilter() {
    const onlyDiff = checkbox.checked;

    let shown = 0;
    for (const el of rows) {
      const status = el.getAttribute('data-status') || '';
      const isDiffLike = status !== 'ok';
      const show = onlyDiff ? isDiffLike : true;

      el.classList.toggle('hidden', !show);
      if (show) shown++;
    }

    visibleCount.textContent = 'Shown: ' + shown + ' / ' + rows.length;
  }

  checkbox.addEventListener('change', applyFilter);
  applyFilter();
})();
</script>

</body></html>
`
}

/**
 *
 * @param img
 * @param width
 * @param height
 */
function padTo(img, width, height) {
  if (img.width === width && img.height === height) {
    return img
  }
  const out = new PNG({ width, height })
  PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0)

  return out
}

/**
 *
 * @param argv
 */
function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
      args[key] = val
    }
  }

  return args
}

const args = parseArgs(process.argv)

// Modes:
// - pdf-diff (default): baseline/<name> vs current/<name> (rendered from --pdf)
// - baseline-diff: baseline/<name> vs baseline/<baseline2> (no PDF involved)
const mode = String(args.mode || 'pdf-diff')

const name = String(args.name || 'example')
const baseline2 = args.baseline2 ? String(args.baseline2) : ''

const pdfPath = String(args.pdf || '')
const dpi = Number(args.dpi || 200)
const threshold = Number(args.threshold || 0.1)
const maxDiffPercent = Number(args.maxDiffPercent || 0.05)

const root = path.resolve('tests/pdf-snapshots')
const reportsDir = path.join(root, 'reports')

let baselineDir = ''
let currentDir = ''
let diffDir = ''
let reportFileName = ''
let creationInfoHtml = ''

if (mode === 'baseline-diff') {
  if (!baseline2) {
    console.error(
      'Usage: node scripts/pdf-visual-diff/pdf-regress.mjs --mode baseline-diff --name <baseline1> --baseline2 <baseline2> [--threshold 0.1] [--maxDiffPercent 0.05]',
    )
    process.exit(2)
  }

  reportFileName = `${name}__VS__${baseline2}`

  baselineDir = path.join(root, 'baseline', name)
  currentDir = path.join(root, 'baseline', baseline2)
  diffDir = path.join(root, 'diff', reportFileName)

  ensureDir(diffDir)
  ensureDir(reportsDir)

  // Clean diff first
  cleanDir(diffDir)

  // "Creation info" for baseline-diff: show timestamps of both baseline dirs
  const leftStats = fs.existsSync(baselineDir) ? fs.statSync(baselineDir) : null
  const rightStats = fs.existsSync(currentDir) ? fs.statSync(currentDir) : null

  if (leftStats) {
    const picked = pickCreationDate(leftStats)
    const t =
      picked.kind === 'birthtime' ? formatDateLocal(picked.date) : `${formatDateLocal(picked.date)} (${picked.kind})`
    creationInfoHtml += `<div><b>Left baseline timestamp:</b> ${t}</div>`
  } else {
    creationInfoHtml += `<div><b>Left baseline timestamp:</b> —</div>`
  }

  if (rightStats) {
    const picked = pickCreationDate(rightStats)
    const t =
      picked.kind === 'birthtime' ? formatDateLocal(picked.date) : `${formatDateLocal(picked.date)} (${picked.kind})`
    creationInfoHtml += `<div><b>Right baseline timestamp:</b> ${t}</div>`
  } else {
    creationInfoHtml += `<div><b>Right baseline timestamp:</b> —</div>`
  }
} else {
  if (!pdfPath) {
    console.error(
      'Usage: node scripts/pdf-visual-diff/pdf-regress.mjs --name <set> --pdf <file.pdf> [--dpi 200] [--threshold 0.1] [--maxDiffPercent 0.05]',
    )
    process.exit(2)
  }

  reportFileName = name

  baselineDir = path.join(root, 'baseline', name)
  currentDir = path.join(root, 'current', name)
  diffDir = path.join(root, 'diff', name)

  ensureDir(currentDir)
  ensureDir(diffDir)
  ensureDir(reportsDir)

  // Clean current/diff first
  for (const d of [currentDir, diffDir]) {
    cleanDir(d)
  }

  renderPdfToPngs({ pdfPath, outDir: currentDir, dpi })

  // ==========================
  // BASELINE CREATION MODE
  // ==========================
  if (process.argv.includes('--create-baseline') || process.env.PDF_CREATE_BASELINE === '1') {
    ensureDir(baselineDir)

    // Clean existing baseline
    cleanDir(baselineDir)

    // Copy rendered PNGs into baseline
    const rendered = listPages(currentDir)
    for (const file of rendered) {
      fs.copyFileSync(path.join(currentDir, file), path.join(baselineDir, file))
    }

    console.log(`Baseline created at: ${baselineDir}`)
    process.exit(0)
  }

  const stats = fs.statSync(pdfPath)
  const picked = pickCreationDate(stats)
  const creationTime =
    picked.kind === 'birthtime' ? formatDateLocal(picked.date) : `${formatDateLocal(picked.date)} (${picked.kind})`

  creationInfoHtml = `<div><b>File creation date:</b> ${creationTime}</div>`

  // ==========================
  // ACCEPT MODE
  // ==========================
  if (process.argv.includes('--accept')) {
    copyDirPngs(currentDir, baselineDir)
    cleanDir(diffDir) // remove stale diff images

    // Build all-ok rows from accepted pages — no pixel comparison needed
    const acceptedPages = listPages(currentDir) // baseline now equals current
    const acceptRows = acceptedPages.map((page) => ({
      page,
      status: 'ok',
      diffPercent: 0,
      baseRel: path.relative(reportsDir, path.join(baselineDir, page)).replaceAll('\\', '/'),
      currRel: path.relative(reportsDir, path.join(currentDir, page)).replaceAll('\\', '/'),
      diffRel: null,
    }))

    const reportPath = path.join(reportsDir, `${reportFileName}.html`)
    fs.writeFileSync(
      reportPath,
      buildReportHtml(acceptRows, {
        totalDiffPercent: 0,
        pageCount: acceptedPages.length,
        reportFileName,
        creationInfoHtml,
        baselineDir,
        currentDir,
        diffDir,
        threshold,
        maxDiffPercent,
        reportsDir,
      }),
      'utf8',
    )

    console.log(`Accepted: baseline updated at ${baselineDir}`)
    console.log(`Report: ${reportPath}`)
    process.exit(0)
  }
}

const basePages = listPages(baselineDir)
const currPages = listPages(currentDir)

if (basePages.length === 0) {
  console.error(`Baseline is empty or missing: ${baselineDir}`)
  console.error('Create baseline first.')
  process.exit(2)
}

if (currPages.length === 0) {
  console.error(`Second set is empty or missing: ${currentDir}`)
  console.error(mode === 'baseline-diff' ? 'Check baseline2 name.' : 'Render step failed.')
  process.exit(2)
}

const pageCount = Math.max(basePages.length, currPages.length)

let totalPixels = 0
let totalDiffPixels = 0

const rows = []

for (let i = 0; i < pageCount; i++) {
  const page = `page-${String(i + 1).padStart(3, '0')}.png`

  const basePath = path.join(baselineDir, page)
  const currPath = path.join(currentDir, page)
  const outDiffPath = path.join(diffDir, page)

  const baseExists = fs.existsSync(basePath)
  const currExists = fs.existsSync(currPath)

  if (!baseExists || !currExists) {
    rows.push({
      page,
      status: !baseExists ? 'missing in baseline' : 'missing in current',
      diffPercent: 100,
      baseRel: baseExists ? path.relative(reportsDir, basePath).replaceAll('\\', '/') : null,
      currRel: currExists ? path.relative(reportsDir, currPath).replaceAll('\\', '/') : null,
      diffRel: null,
    })
    continue
  }

  const img1 = readPng(basePath)
  const img2 = readPng(currPath)

  const w = Math.max(img1.width, img2.width)
  const h = Math.max(img1.height, img2.height)

  const a = padTo(img1, w, h)
  const b = padTo(img2, w, h)
  const diff = new PNG({ width: w, height: h })

  const diffPixels = pixelmatch(a.data, b.data, diff.data, w, h, { threshold })

  writePng(outDiffPath, diff)

  const pixels = w * h
  const diffPercent = (diffPixels / pixels) * 100

  totalPixels += pixels
  totalDiffPixels += diffPixels

  rows.push({
    page,
    status: diffPixels === 0 ? 'ok' : 'diff',
    diffPercent,
    baseRel: path.relative(reportsDir, basePath).replaceAll('\\', '/'),
    currRel: path.relative(reportsDir, currPath).replaceAll('\\', '/'),
    diffRel: path.relative(reportsDir, outDiffPath).replaceAll('\\', '/'),
  })
}

const totalDiffPercent = totalPixels ? (totalDiffPixels / totalPixels) * 100 : 0

const reportPath = path.join(reportsDir, `${reportFileName}.html`)
fs.writeFileSync(
  reportPath,
  buildReportHtml(rows, {
    totalDiffPercent,
    pageCount,
    reportFileName,
    creationInfoHtml,
    baselineDir,
    currentDir,
    diffDir,
    threshold,
    maxDiffPercent,
    reportsDir,
  }),
  'utf8',
)

console.log(`Report: ${reportPath}`)
console.log(`Total diff: ${totalDiffPercent.toFixed(6)}%`)

if (totalDiffPercent > maxDiffPercent) {
  console.error(`FAILED: total diff ${totalDiffPercent.toFixed(6)}% > allowed ${maxDiffPercent}%`)
  process.exit(1)
} else {
  console.log('OK')
  process.exit(0)
}
