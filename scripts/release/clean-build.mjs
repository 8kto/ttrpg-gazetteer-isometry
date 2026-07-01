#!/usr/bin/env node
/* eslint-disable no-console,func-style */
import fs from 'node:fs'
import path from 'node:path'

/**
 *
 * @param msg
 * @param code
 */
function die(msg, code = 1) {
  console.error(msg)
  process.exit(code)
}

/**
 *
 * @param argv
 */
function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      const val = next && !next.startsWith('--') ? argv[++i] : 'true'
      args[key] = val
    } else {
      args._.push(a)
    }
  }

  return args
}

/**
 *
 * @param filePath
 */
function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')

  return JSON.parse(raw)
}

/**
 *
 * @param name
 */
function findLastSemverInParens(name) {
  // Finds the LAST "(x.y.z)" segment in the filename (without .pdf)
  // Example: "Foo (1.11.12) (bookmarked)" -> "1.11.12"
  const re = /\((\d+\.\d+\.\d+)\)/g
  let last = null
  for (const m of name.matchAll(re)) {
    last = m[1]
  }

  return last
}

const args = parseArgs(process.argv)
const dryRun = String(args['dry-run'] || 'false') === 'true'
const root = process.cwd()

const pkgPath = path.resolve(root, 'package.json')
if (!fs.existsSync(pkgPath)) {
  die(`package.json not found at: ${pkgPath}`)
}

const pkg = readJson(pkgPath)
const currentVersion = String(pkg.version || '').trim()
if (!currentVersion) {
  die(`package.json has no "version": ${pkgPath}`)
}

const pdfDir = path.resolve(root, String(args.dir || 'build/release'))
if (!fs.existsSync(pdfDir)) {
  die(`PDF directory not found: ${pdfDir}`)
}
if (!fs.statSync(pdfDir).isDirectory()) {
  die(`Not a directory: ${pdfDir}`)
}

const files = fs.readdirSync(pdfDir)
const pdfs = files.filter((f) => f.toLowerCase().endsWith('.pdf'))

const toDelete = []
const toKeep = []

for (const f of pdfs) {
  const full = path.join(pdfDir, f)

  // Safety: only operate on regular files
  const st = fs.statSync(full)
  if (!st.isFile()) {
    continue
  }

  const base = f.slice(0, -4) // remove ".pdf"
  const isDev = /\\d+\.\d+\.\d+-dev/i.test(base)

  const fileVersion = findLastSemverInParens(base)
  const hasVersion = Boolean(fileVersion)

  // Rules:
  // 1) delete if bookmarked (even if current)
  // 2) delete if has a version and it's NOT current
  // 3) keep otherwise (including "no version in name" PDFs)
  const shouldDelete = isDev || (hasVersion && fileVersion !== currentVersion)

  if (shouldDelete) {
    toDelete.push({ file: f, reason: isDev ? 'dev version' : `version ${fileVersion} != ${currentVersion}` })
  } else {
    toKeep.push(f)
  }
}

console.log(`Current version (package.json): ${currentVersion}`)
console.log(`Directory: ${pdfDir}`)
console.log(`PDFs found: ${pdfs.length}`)
console.log(`Will delete: ${toDelete.length}`)
console.log(`Will keep: ${toKeep.length}`)

if (toDelete.length) {
  console.log('\nDelete list:')
  for (const x of toDelete) {
    console.log(`- ${x.file}  (${x.reason})`)
  }
}

if (dryRun) {
  console.log('\nDry run: no files were deleted. Re-run without --dry-run to apply.')
  process.exit(0)
}

for (const x of toDelete) {
  const full = path.join(pdfDir, x.file)
  fs.rmSync(full, { force: true })
}

console.log('\nDone.')

// FIXME clear pdf chunks and registry
