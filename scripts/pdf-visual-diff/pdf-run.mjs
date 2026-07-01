/* eslint-disable no-console,func-style */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 *
 * @param msg
 * @param code
 */
function die(msg, code = 2) {
  console.error(msg)
  process.exit(code)
}

/**
 *
 * @param name
 */
function sanitizeSnapshotName(name) {
  // prevent path traversal and Windows reserved separators
  let s = String(name).trim()

  // Replace path separators with spaces
  s = s.replace(/[\/\\]/g, ' ')

  // Collapse dot-dot segments
  s = s.replace(/\.\.+/g, '.')

  // Remove control characters
  s = s.replace(/[\u0000-\u001F\u007F]/g, '')

  // Trim and collapse whitespace
  s = s.replace(/\s{2,}/g, ' ').trim()

  // Avoid empty
  return s || 'snapshot'
}

/**
 *
 * @param fileName
 */
function normalizeSnapshotName(fileName) {
  // "Зеница Варготара (1.10.0) (bookmarked).pdf"
  // -> "Зеница Варготара"
  let base = fileName

  if (base.toLowerCase().endsWith('.pdf')) {
    base = base.slice(0, -4)
  }

  // remove "(bookmarked)" and similar bracketed suffixes except we keep main title
  // 1) remove trailing " (bookmarked)" / " (something)" repeatedly
  base = base.replace(/\s*\([^)]*\)\s*$/g, '')

  // 2) remove trailing semantic version in parentheses: " (1.10.0)" repeatedly
  // (if there are still any, e.g. title itself had brackets)
  base = base.replace(/\s*\(\d+\.\d+\.\d+\)\s*$/g, '')

  // Also remove double spaces
  base = base.replace(/\s{2,}/g, ' ').trim()

  // If empty for any reason, fallback to original without .pdf
  return base || (fileName.toLowerCase().endsWith('.pdf') ? fileName.slice(0, -4) : fileName)
}

/**
 *
 * @param argv
 */
function parseArgs(argv) {
  // Supports:
  // node scripts/pdf-visual-diff/pdf-run.mjs diff "file.pdf" --dpi 200 --threshold 0.1 --maxDiffPercent 0.05 --name "custom"
  const res = { _: [] }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      const val = next && !next.startsWith('--') ? argv[++i] : 'true'
      res[key] = val
    } else {
      res._.push(a)
    }
  }

  return res
}

const args = parseArgs(process.argv)
const cmd = args._[0]

if (!cmd || !['diff', 'update', 'open', 'baseline', 'accept', 'baseline-diff'].includes(cmd)) {
  die(
    [
      'Usage:',
      '  node scripts/pdf-visual-diff/pdf-run.mjs diff "Зеница Варготара (1.10.0).pdf" [--dpi 200 --threshold 0.1 --maxDiffPercent 0.05]',
      '  node scripts/pdf-visual-diff/pdf-run.mjs update "Зеница Варготара (1.10.0).pdf" [--dpi 200 --threshold 0.1 --maxDiffPercent 0.05]',
      '  node scripts/pdf-visual-diff/pdf-run.mjs open "Зеница Варготара (1.10.0).pdf"',
      '  node scripts/pdf-visual-diff/pdf-run.mjs baseline-diff "<baseline1>" "<baseline2>"',
      '  node scripts/pdf-visual-diff/pdf-run.mjs baseline "Зеница Варготара (1.10.0).pdf" [--dpi 200]',
      '',
      'Notes:',
      '  - If you pass only a filename, it will be resolved under build/release/',
      '  - Snapshot name defaults to title stripped from version/bookmarked suffix; override with --name.',
    ].join('\n'),
  )
}

const dpi = String(args.dpi || '200')
const threshold = String(args.threshold || '0.1')
const maxDiffPercent = String(args.maxDiffPercent || '0.05')

/**
 *
 * @param script
 * @param scriptArgs
 */
function runNode(script, scriptArgs) {
  const res = spawnSync(process.execPath, [script, ...scriptArgs], {
    stdio: 'inherit',
  })
  if (res.error) {
    throw res.error
  }
  process.exit(res.status ?? 0)
}

/* ===========================
   BASELINE vs BASELINE MODE
=========================== */

if (cmd === 'baseline-diff') {
  const left = args._[1]
  const right = args._[2]

  if (!left || !right) {
    die('Usage:\n  pdf-run.mjs baseline-diff "<baseline1>" "<baseline2>"')
  }

  runNode(path.resolve('scripts/pdf-visual-diff/pdf-regress.mjs'), [
    '--mode',
    'baseline-diff',
    '--name',
    left,
    '--baseline2',
    right,
    '--threshold',
    threshold,
    '--maxDiffPercent',
    maxDiffPercent,
  ])
}

/* ===========================
   PDF-BASED MODES BELOW
=========================== */

const pdfArg = args._[1]
if (!pdfArg) {
  die('Missing PDF argument.')
}

const buildDir = path.resolve('build/release')

// Resolve PDF path
let pdfPath = pdfArg
if (!pdfPath.toLowerCase().endsWith('.pdf')) {
  die(`Not a .pdf file: ${pdfArg}`)
}

// If user gave a path that exists, use it. Else try build/pdf/<name>
if (!fs.existsSync(pdfPath)) {
  const candidate = path.join(buildDir, pdfArg)
  if (fs.existsSync(candidate)) {
    pdfPath = candidate
  } else {
    die(`pdf-run.mjs: PDF not found:\n- ${path.resolve(pdfArg)}\n- ${candidate}`)
  }
} else {
  pdfPath = path.resolve(pdfPath)
}

const fileName = path.basename(pdfPath)
const snapshotName = sanitizeSnapshotName(String(args.name || normalizeSnapshotName(fileName)))
const reportsPath = path.resolve('tests/pdf-snapshots/reports', `${snapshotName}.html`)

/* ===========================
   STANDARD PDF MODES
=========================== */

if (cmd === 'diff') {
  runNode(path.resolve('scripts/pdf-visual-diff/pdf-regress.mjs'), [
    '--name',
    snapshotName,
    '--pdf',
    pdfPath,
    '--dpi',
    dpi,
    '--threshold',
    threshold,
    '--maxDiffPercent',
    maxDiffPercent,
  ])
}

if (cmd === 'baseline') {
  runNode(path.resolve('scripts/pdf-visual-diff/pdf-regress.mjs'), [
    '--name',
    snapshotName,
    '--pdf',
    pdfPath,
    '--dpi',
    dpi,
    '--create-baseline',
  ])
}

if (cmd === 'accept') {
  runNode(path.resolve('scripts/pdf-visual-diff/pdf-regress.mjs'), [
    '--name',
    snapshotName,
    '--pdf',
    pdfPath,
    '--dpi',
    dpi,
    '--threshold',
    threshold,
    '--maxDiffPercent',
    maxDiffPercent,
    '--accept',
  ])
}

if (cmd === 'update') {
  runNode(path.resolve('scripts/pdf-visual-diff/pdf-regress.mjs'), [
    '--name',
    snapshotName,
    '--pdf',
    pdfPath,
    '--dpi',
    dpi,
    '--threshold',
    threshold,
    '--maxDiffPercent',
    maxDiffPercent,
    '--accept',
  ])
}

if (cmd === 'open') {
  if (!fs.existsSync(reportsPath)) {
    die(`Report not found: ${reportsPath}`)
  }

  console.log('Opening report:', reportsPath)

  const platform = process.platform

  if (platform === 'darwin') {
    spawnSync('open', [reportsPath], { stdio: 'inherit' })
  } else if (platform === 'win32') {
    spawnSync('cmd', ['/c', 'start', '', reportsPath], { stdio: 'inherit' })
  } else {
    spawnSync('xdg-open', [reportsPath], { stdio: 'inherit' })
  }

  process.exit(0)
}
