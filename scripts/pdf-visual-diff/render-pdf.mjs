/* eslint-disable no-console,func-style */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 *
 * @param p
 */
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

/**
 *
 * @param outDir
 */
function listPagePngs(outDir) {
  return fs
    .readdirSync(outDir)
    .filter((f) => /^page-\d+\.png$/i.test(f))
    .sort((a, b) => {
      const na = Number(a.match(/^page-(\d+)\.png$/i)?.[1] ?? 0)
      const nb = Number(b.match(/^page-(\d+)\.png$/i)?.[1] ?? 0)

      return na - nb
    })
}

/**
 *
 * @param root0
 * @param root0.pdfPath
 * @param root0.outDir
 * @param root0.dpi
 */
export function renderPdfToPngs({ pdfPath, outDir, dpi = 200 }) {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`renderPdfToPngs: PDF not found: ${pdfPath}`)
  }

  ensureDir(outDir)

  // pdftocairo outputs files like:
  // - page-1.png / page-01.png / page-001.png (varies by version/options)
  // because we pass prefix "<outDir>/page"
  const prefix = path.join(outDir, 'page')

  const res = spawnSync('pdftocairo', ['-png', '-r', String(dpi), pdfPath, prefix], { encoding: 'utf8' })

  if (res.error) {
    throw res.error
  }
  if (res.status !== 0) {
    throw new Error(`pdftocairo failed:\n${res.stderr || res.stdout}`)
  }

  // Normalize to page-001.png, page-002.png, ...
  const files = listPagePngs(outDir)

  for (const f of files) {
    const m = f.match(/^page-(\d+)\.png$/i)
    if (!m) {
      continue
    }

    const n = Number(m[1])
    if (!Number.isFinite(n) || n <= 0) {
      continue
    }

    const target = `page-${String(n).padStart(3, '0')}.png`
    if (f === target) {
      continue
    } // already normalized

    const from = path.join(outDir, f)
    const to = path.join(outDir, target)

    // If destination already exists, keep it and just remove the unnormalized file.
    // This prevents crashes on weird mixed outputs.
    if (fs.existsSync(to)) {
      fs.rmSync(from, { force: true })
      continue
    }

    fs.renameSync(from, to)
  }
}
