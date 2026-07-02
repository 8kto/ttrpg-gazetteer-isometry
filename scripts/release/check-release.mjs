#!/usr/bin/env node
/* eslint-disable no-console, func-style */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import chalk from 'chalk'
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRef, PDFString } from 'pdf-lib'

const require = createRequire(import.meta.url)
const pkg = require('../../package.json')

const ROOT = path.resolve('.')
const PDF_DIR = path.join(ROOT, 'build/release')
const BUILD_DIR = path.join(ROOT, 'build')
const SKIP_SCREENSHOTS = process.argv.includes('--skip-screenshots')

const getVersion = () => {
  return `v${pkg.version}`
}

// ── Release file specs ────────────────────────────────────────────────────────

const SPECS = [
  {
    id: 'main',
    file: `Зеница Варготара (${getVersion()}).pdf`,
    expectedPages: 66,
    tocJson: `$toc-main.json`,
  },
  {
    id: 'osr',
    file: `Зеница Варготара [OSR] (${getVersion()}).pdf`,
    expectedPages: 66,
    tocJson: `$toc-osr.json`,
  },
  {
    id: 'map',
    file: `Карты Зеницы Варготара (${getVersion()}).pdf`,
    expectedPages: 10,
    tocJson: `$toc-map.json`,
    skipToc: true,
  },
  {
    id: 'bestiary',
    file: `Каталог Аномалий (${getVersion()}).pdf`,
    expectedPages: 24,
    tocJson: `$toc-bestiary.json`,
  },
  {
    id: 'bestiary-osr',
    file: `Каталог Аномалий [OSR] (${getVersion()}).pdf`,
    expectedPages: 24,
    tocJson: `$toc-bestiary-osr.json`,
  },
]

// ── PDF helpers ───────────────────────────────────────────────────────────────

/**
 *
 * @param pdfPath
 */
function extractText(pdfPath) {
  const res = spawnSync('pdftotext', [pdfPath, '-'], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  })
  if (res.error) {
    throw res.error
  }
  if (res.status !== 0) {
    throw new Error(`pdftotext failed: ${res.stderr}`)
  }

  return res.stdout || ''
}

/**
 * Returns a Set of named destination keys (in "/name" form, matching PDFName.toString())
 * from /Catalog/Dests.
 * @param doc
 */
function getNamedDestKeys(doc) {
  const destsEntry = doc.catalog.get(PDFName.of('Dests'))
  if (!destsEntry) {
    return new Set()
  }

  const destsDict = destsEntry instanceof PDFRef ? doc.context.lookup(destsEntry) : destsEntry
  if (!(destsDict instanceof PDFDict)) {
    return new Set()
  }

  const keys = new Set()
  for (const key of destsDict.keys()) {
    keys.add(key.toString()) // "/dest-name" form
  }

  return keys
}

/**
 * For a link annotation dict, returns the named destination key ("/name" form).
 * Returns null for external links (/URI), explicit page destinations (PDFArray),
 * or non-link annotations.
 * @param doc
 * @param annot
 */
function getLinkDestKey(doc, annot) {
  if (!(annot instanceof PDFDict)) {
    return null
  }
  if (annot.get(PDFName.of('Subtype'))?.toString() !== '/Link') {
    return null
  }

  // Check for /Dest (direct named destination — Chrome's format)
  const dest = annot.get(PDFName.of('Dest'))
  if (dest) {
    const resolved = dest instanceof PDFRef ? doc.context.lookup(dest) : dest
    if (resolved instanceof PDFName) {
      return resolved.toString()
    }
    if (resolved instanceof PDFString) {
      return `(${resolved.decodeText()})`
    } // rare

    return null // PDFArray = explicit page+coord destination, skip
  }

  // Alternative format: /A (Action) dictionary (e.g. /A << /S /GoTo /D /name >>).
  // Chrome uses /Dest for internal links (handled above), but some PDF generators
  // use /A instead. In our PDFs this branch only fires for the 5 external /URI
  // links — they hit the /URI guard and return null immediately.
  const action = annot.get(PDFName.of('A'))
  if (!action) {
    return null
  }
  const actionDict = action instanceof PDFRef ? doc.context.lookup(action) : action
  if (!(actionDict instanceof PDFDict)) {
    return null
  }

  const s = actionDict.get(PDFName.of('S'))?.toString() // /S = action Subtype
  if (s === '/URI') {
    return null
  } // external http/https link — not an internal dest
  if (s !== '/GoTo') {
    return null
  } // /GoToR (remote), /Launch, etc. — skip

  // /D = Destination — same formats as /Dest above
  const d = actionDict.get(PDFName.of('D'))
  if (!d) {
    return null
  }
  const resolved = d instanceof PDFRef ? doc.context.lookup(d) : d
  if (resolved instanceof PDFName) {
    return resolved.toString()
  }
  if (resolved instanceof PDFString) {
    return `(${resolved.decodeText()})`
  }

  return null // PDFArray = explicit page+coord destination, skip
}

// ── Individual checks ─────────────────────────────────────────────────────────

/**
 *
 * @param doc
 * @param expected
 */
function checkPageCount(doc, expected) {
  const count = doc.getPageCount()

  return { ok: count === expected, count }
}

/**
 *
 * @param text
 */
function checkNoDraft(text) {
  return { ok: !text.includes('Черновая версия') }
}

/**
 *
 * @param fileName
 * @param text
 */
function checkNoDevVersion(fileName, text) {
  const inName = fileName.includes('-dev')
  const inText = /v\d+\.\d+\.\d+-dev/i.test(text)

  return { ok: !inName && !inText, inName, inText }
}

/**
 *
 * @param items
 */
function countTocItems(items) {
  if (!Array.isArray(items)) {
    return 0
  }

  return items.reduce((sum, item) => sum + 1 + countTocItems(item.items), 0)
}

/**
 *
 * @param tocJsonPath
 * @param destKeys
 */
function checkTocDestinations(tocJsonPath, destKeys) {
  if (!fs.existsSync(tocJsonPath)) {
    return { ok: null, reason: 'TOC JSON not found (run build first)' }
  }

  let toc
  try {
    toc = JSON.parse(fs.readFileSync(tocJsonPath, 'utf8'))
  } catch (e) {
    return { ok: false, reason: `JSON parse error: ${e.message}` }
  }

  const missing = []
  /**
   *
   * @param items
   */
  function walk(items) {
    if (!Array.isArray(items)) {
      return
    }
    for (const item of items) {
      if (item.id) {
        // TOC id "heading-1" → PDF dest key "/heading-1"
        const key = `/${item.id}`
        if (!destKeys.has(key)) {
          missing.push(item)
        }
      }
      if (item.items) {
        walk(item.items)
      }
    }
  }
  walk(toc)

  return { ok: missing.length === 0, missing, total: countTocItems(toc) }
}

/**
 *
 * @param doc
 * @param destKeys
 */
function checkInternalLinks(doc, destKeys) {
  const broken = []
  let total = 0
  const pages = doc.getPages()

  for (let i = 0; i < pages.length; i++) {
    const annotsRaw = pages[i].node.get(PDFName.of('Annots'))
    if (!annotsRaw) {
      continue
    }
    const arr = annotsRaw instanceof PDFRef ? doc.context.lookup(annotsRaw) : annotsRaw
    if (!(arr instanceof PDFArray)) {
      continue
    }

    for (let j = 0; j < arr.size(); j++) {
      const ref = arr.get(j)
      const annot = ref instanceof PDFRef ? doc.context.lookup(ref) : ref
      const destKey = getLinkDestKey(doc, annot)
      if (destKey === null) {
        continue
      } // external, explicit, or non-link
      total++
      if (!destKeys.has(destKey)) {
        broken.push({ page: i + 1, dest: destKey })
      }
    }
  }

  return { ok: broken.length === 0, broken, total }
}

/**
 * Decodes a bookmark /Title value. PDF allows both PDFString (UTF-16BE with BOM
 * or Latin-1) and PDFHexString (hex-encoded UTF-16BE). pdf-lib's decodeText()
 * handles both encodings transparently.
 * @param raw
 */
function decodeTitle(raw) {
  const v = raw instanceof PDFRef ? null : raw // refs won't appear here in practice
  if (v instanceof PDFString || v instanceof PDFHexString) {
    return v.decodeText()
  }

  return raw?.toString?.() ?? '?'
}

/**
 * Validates the PDF outline (bookmarks) tree.
 *
 * Bookmark destinations are explicit page refs: /A << /S /GoTo /D [pageRef /XYZ x y z] >>
 * (not named destinations). Validation checks that the PDFRef at index 0 of each
 * destination array is a page that actually exists in the document.
 *
 * Returns { ok, total, broken: [{ title, dest }] } or { ok: false, reason } if no
 * outline tree is present.
 * @param doc
 */
function checkBookmarks(doc) {
  const outlinesRaw = doc.catalog.get(PDFName.of('Outlines'))
  if (!outlinesRaw) {
    return { ok: false, reason: 'No /Outlines in catalog' }
  }

  const outlines = outlinesRaw instanceof PDFRef ? doc.context.lookup(outlinesRaw) : outlinesRaw
  if (!(outlines instanceof PDFDict)) {
    return { ok: false, reason: '/Outlines is not a dict' }
  }

  // Set of valid page object numbers — used to validate each bookmark's page ref
  const validPageObjNums = new Set(doc.getPages().map((p) => p.ref.objectNumber))

  const broken = []
  let total = 0

  /**
   *
   * @param node
   */
  function walk(node) {
    let cur = node.get(PDFName.of('First'))
    while (cur) {
      const entry = cur instanceof PDFRef ? doc.context.lookup(cur) : cur
      if (!(entry instanceof PDFDict)) {
        break
      }

      total++
      const title = decodeTitle(entry.get(PDFName.of('Title')))

      // Resolve the destination: /A << /S /GoTo /D [pageRef /XYZ x y z] >>
      // or direct /Dest [pageRef ...] (less common).
      let destArray = null
      const action = entry.get(PDFName.of('A'))
      if (action) {
        const ad = action instanceof PDFRef ? doc.context.lookup(action) : action
        const D = ad instanceof PDFDict ? ad.get(PDFName.of('D')) : null
        const d = D instanceof PDFRef ? doc.context.lookup(D) : D
        if (d instanceof PDFArray) {
          destArray = d
        }
      } else {
        const d = entry.get(PDFName.of('Dest'))
        const resolved = d instanceof PDFRef ? doc.context.lookup(d) : d
        if (resolved instanceof PDFArray) {
          destArray = resolved
        }
      }

      if (!destArray) {
        broken.push({ title, dest: '(no destination)' })
      } else {
        const pageRef = destArray.get(0)
        if (!(pageRef instanceof PDFRef) || !validPageObjNums.has(pageRef.objectNumber)) {
          broken.push({ title, dest: destArray.toString() })
        }
      }

      walk(entry) // recurse into children
      cur = entry.get(PDFName.of('Next'))
    }
  }

  walk(outlines)

  if (total === 0) {
    return { ok: false, reason: 'Bookmark tree is empty' }
  }

  return { ok: broken.length === 0, total, broken }
}

/**
 * Runs `pdf:diff` for the given file via pdf-run.mjs.
 * Returns { ok: true } on clean diff, { ok: false, output } on failure,
 * { ok: null, reason } when no baseline exists (not a failure — just unreviewed).
 * @param fileName
 */
function checkVisualDiff(fileName) {
  process.stdout.write(`  . Visual diff (rendering ${fileName.length > 30 ? `…${fileName.slice(-27)}` : fileName})...`)

  const res = spawnSync(process.execPath, [path.resolve('scripts/pdf-visual-diff/pdf-run.mjs'), 'diff', fileName], {
    encoding: 'utf8',
    stdio: 'pipe',
  })

  process.stdout.write(`\r${' '.repeat(80)}\r`) // clear the progress line

  const output = ((res.stdout || '') + (res.stderr || '')).trim()

  if (res.error) {
    return { ok: false, output: res.error.message }
  }

  if (res.status === 2) {
    // Exit 2 = usage/setup error; distinguish missing baseline from other errors
    const noBaseline = output.includes('Baseline is empty or missing')

    return { ok: null, reason: noBaseline ? 'No baseline — run: yarn pdf:baseline' : output }
  }

  if (res.status !== 0) {
    return { ok: false, output }
  }

  // Extract the "Total diff: X%" line for the pass message
  const diffLine = output.split('\n').find((l) => l.startsWith('Total diff:')) ?? ''

  return { ok: true, diffLine }
}

// ── Output helpers ────────────────────────────────────────────────────────────

const PASS = chalk.green('✓')
const FAIL = chalk.red('✗')
const WARN = chalk.yellow('!')

/**
 *
 * @param msg
 */
function pass(msg) {
  console.log(`  ${PASS} ${msg}`)
}

/**
 *
 * @param msg
 */
function fail(msg) {
  console.log(`  ${FAIL} ${chalk.red(msg)}`)
}

/**
 *
 * @param msg
 */
function warn(msg) {
  console.log(`  ${WARN} ${chalk.yellow(msg)}`)
}

/**
 *
 * @param msg
 */
function detail(msg) {
  console.log(`       ${chalk.dim(msg)}`)
}

// ── Per-file runner ───────────────────────────────────────────────────────────

/**
 *
 * @param spec
 */
async function checkFile(spec) {
  const pdfPath = path.join(PDF_DIR, spec.file)
  const tocJsonPath = path.join(BUILD_DIR, spec.tocJson)

  console.log(chalk.bold(`\n── ${spec.file}`))

  if (!fs.existsSync(pdfPath)) {
    fail(`File not found: ${pdfPath}`)

    return false
  }
  pass('File exists')

  // Load PDF (needed for page count, dest keys, and link annotations)
  const bytes = fs.readFileSync(pdfPath)
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })

  // Extract text once (shared by draft + version checks)
  const text = extractText(pdfPath)

  let allOk = true
  const mark = (ok) => {
    if (!ok) {
      allOk = false
    }

    return ok
  }

  // Page count
  const pages = checkPageCount(doc, spec.expectedPages)
  if (mark(pages.ok)) {
    pass(`Page count: ${pages.count}`)
  } else {
    fail(`Page count: ${pages.count} (expected ${spec.expectedPages})`)
  }

  // No draft text
  const draft = checkNoDraft(text)
  if (mark(draft.ok)) {
    pass('No "Черновая версия"')
  } else {
    fail('"Черновая версия" found in text')
  }

  // No -dev version
  const ver = checkNoDevVersion(spec.file, text)
  if (mark(ver.ok)) {
    pass('Version: no -dev suffix')
  } else {
    const where = [ver.inName && 'filename', ver.inText && 'text'].filter(Boolean).join(', ')
    fail(`Version has -dev suffix (in: ${where})`)
  }

  // TOC destinations
  const destKeys = getNamedDestKeys(doc)
  if (!spec.skipToc) {
    const toc = checkTocDestinations(tocJsonPath, destKeys)
    if (toc.ok === null) {
      warn(`TOC: ${toc.reason}`)
    } else if (mark(toc.ok)) {
      pass(`TOC: ${toc.total} entries verified`)
    } else {
      fail(`TOC: ${toc.missing.length} missing destination(s)`)
      for (const m of toc.missing.slice(0, 10)) {
        detail(`"${m.label}" → #${m.id}`)
      }
      if (toc.missing.length > 10) {
        detail(`...and ${toc.missing.length - 10} more`)
      }
    }
  } else {
    pass(`TOC: skipped`)
  }

  // Bookmarks (outline tree)
  const bm = checkBookmarks(doc)
  if ('reason' in bm) {
    mark(false)
    fail(`Bookmarks: ${bm.reason}`)
  } else if (mark(bm.ok)) {
    pass(`Bookmarks: ${bm.total} entries, all valid`)
  } else {
    fail(`Bookmarks: ${bm.broken.length} broken destination(s) (of ${bm.total})`)
    for (const { title, dest } of bm.broken.slice(0, 10)) {
      detail(`"${title}" → ${dest}`)
    }
    if (bm.broken.length > 10) {
      detail(`...and ${bm.broken.length - 10} more`)
    }
  }

  // Internal links
  const links = checkInternalLinks(doc, destKeys)
  if (mark(links.ok)) {
    pass(`Internal links: ${links.total} checked, all valid`)
  } else {
    fail(`Internal links: ${links.broken.length} broken (of ${links.total})`)
    // Group by destination so repeated broken links are compact
    const byDest = new Map()
    for (const { page, dest } of links.broken) {
      if (!byDest.has(dest)) {
        byDest.set(dest, [])
      }
      byDest.get(dest).push(page)
    }
    for (const [dest, pgs] of [...byDest].slice(0, 10)) {
      detail(`${dest}  →  page(s) ${pgs.join(', ')}`)
    }
    if (byDest.size > 10) {
      detail(`...and ${byDest.size - 10} more unique destinations`)
    }
  }

  // Visual diff
  if (SKIP_SCREENSHOTS) {
    warn('Visual diff: skipped (--skip-screenshots)')
  } else {
    const diff = checkVisualDiff(spec.file)
    if (diff.ok === null) {
      warn(`Visual diff: ${diff.reason}`)
    } else if (mark(diff.ok)) {
      pass(`Visual diff: no unapproved changes  ${chalk.dim(diff.diffLine)}`)
    } else {
      fail('Visual diff: unapproved changes detected')
      if (diff.output) {
        for (const line of diff.output.split('\n').filter(Boolean).slice(0, 5)) {
          detail(line)
        }
      }
    }
  }

  return allOk
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(chalk.bold(`\nRelease check ${getVersion()}\n`) + chalk.dim('─'.repeat(50)))

const results = []
for (const spec of SPECS) {
  const ok = await checkFile(spec)
  results.push({ file: spec.file, ok })
}

const passed = results.filter((r) => r.ok)
const failed = results.filter((r) => !r.ok)

console.log(`\n${chalk.bold('── Summary ')}${chalk.dim('─'.repeat(39))}`)
if (failed.length === 0) {
  console.log(chalk.green(`All ${results.length} files passed ✓`))
} else {
  console.log(String(chalk.green(`${passed.length}/${results.length} passed`)))
  for (const r of failed) {
    console.log(chalk.red(`  ✗ ${r.file}`))
  }
}
console.log()

process.exit(failed.length > 0 ? 1 : 0)
