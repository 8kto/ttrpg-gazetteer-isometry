#!/usr/bin/env node

/**
 * @file Insert referenced text sections from the `REFERENCES_FILEs` const
 * @param {string} header ID of one of the sections in the `REFERENCES_FILEs` file (marked with `###` header)
 * @param {boolean} detailed When set, the entire section will be inserted
 * @example ```markdown
 *     <!-- This command would be replaced with the `Летучая медуза` entry -->
 *     <!-- cmd[ref] header[Летучая медуза] /-->
 * ```
 */

/**
 * @typedef {object} RefEntry
 * @property {string} fullText - The full text of the entry
 * @property {string} shortText - The shortened version of the text
 * @property {string[]} buffer - Full text as an array of lines
 */

import { readFileSync } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { convertListToTable } from '#commands/cmd-convert-list.mjs'
import handleCommands from '#commands/index.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const REFERENCES_FILES = [
  path.join(__dirname, '../../src/markdown/$refs-stats.md'),
  path.join(__dirname, '../../src/markdown/$refs-personaes.md'),
  path.join(__dirname, '../../src/markdown/$refs-items.md'),
]

const getFirstSentence = (str) => {
  // Match everything up to the first dot
  const match = str.match(/[^.]*\./)

  return match ? match[0] : str
}

const findLastNonSpaceEntry = (arr) => {
  // Iterate from the last element to the first
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].trim() !== '') {
      return arr[i]
    }
  }

  return null
}

/**
 * @param {string} md
 * @returns {Record<string, RefEntry>}
 */
const parseMarkdown = (md) => {
  const lines = md.split('\n')

  /** @type {Record<string, string[]>} */
  const buffer = {}
  let currentTitle = ''

  // Collect full texts
  lines.forEach((line) => {
    if (line.startsWith('### ')) {
      currentTitle = line.substring(4).trim()
      buffer[currentTitle] = []
    } else if (currentTitle) {
      if (line.startsWith('## ') || line.startsWith('# ')) {
        return
      }

      buffer[currentTitle].push(line.trim())
    }
  })

  /** @type {Record<string, RefEntry>} */
  const result = {}
  Object.entries(buffer).forEach(([key, refItem]) => {
    if (!result[key]) {
      result[key] = {}
    }
    result[key].fullText = refItem.join('\n')

    const lastNonSpaceEntry = findLastNonSpaceEntry(refItem)

    // NB faster comparison instead of regexp
    const hasStats = !!lastNonSpaceEntry?.startsWith('`{ ')
    result[key].shortText = hasStats ? lastNonSpaceEntry : getFirstSentence(result[key].fullText)
  })

  return result
}

/**
 * @param {string[]} filePaths
 * @returns {function(id: string, fullText: boolean): string|null}
 */
const getReferenceResolver = (filePaths) => {
  /** @type {string} */
  const content = filePaths.reduce((acc, cur) => {
    return acc + readFileSync(cur, 'utf8')
  }, '')

  const storage = parseMarkdown(content)

  /**
   * @param {string} refId
   * @param {boolean} fullText
   * @returns {string|null}
   */
  return (refId, fullText) => {
    const content = fullText ? storage[refId]?.fullText?.trim() : storage[refId]?.shortText?.trim()

    return content ? handleCommands(content) : null
  }
}

const resolveContent = getReferenceResolver(REFERENCES_FILES)

/**
 * @type {CommandHandlerFn}
 * @param {string} markdown
 * @returns {string}
 */
export const convertRefInserts = (markdown) => {
  const commandPattern = /<!--\s*cmd\[ref]\s*header\[(.*?)]\s*(.*?)\/-->/gms
  if (!commandPattern.test(markdown)) {
    return markdown
  }

  return markdown.replace(commandPattern, (match, title, extraArgs) => {
    const isFullText = extraArgs?.includes('detailed')
    const shouldWrap = !!extraArgs?.match(/no-page-break/)
    const content = resolveContent(title, isFullText)

    if (content) {
      console.debug('Insert ref for', title)

      const lines = [
        `<section class="ref-insert">`,
        `<header>${title}</header>`,
        `<main>`,
        '', // Markdown parser for some reason requires an empty line to parse the layout entirely
        content,
        `</main>`,
        `</section>`,
      ]

      if (shouldWrap) {
        lines.unshift(`<div class="no-page-break">`)
        lines.push(`</div>`)
      }

      return lines.join('\n')
    } else {
      console.error('Ref not found', title)

      return match
    }
  })
}
