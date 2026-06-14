#!/usr/bin/env node

/**
 * @file Convert Markdown list to Markdown table
 * @param {string} header Header titles, separated by | character. List items should also use this delimiter for cells.
 * @param {boolean} no-page-break If present, wraps the table with `.no-page-break` container
 * @example ```markdown
 *    <!-- cmd[list-to-table] header[d4|Table header] no-page-break -->
 *    - 1 | Point 1
 *    - 2 | Point 2
 *    - 3 | Point 3
 *    - 4 | Point 4
 * ```
 */

/**
 * @type {CommandHandlerFn}
 * @param {string} markdown
 * @returns {string}
 */
export const convertListToTable = (markdown) => {
  const commandPattern = /<!--\s*cmd\[list-to-table]\s*header\[(.*?)](.*?)-->(.+?)<!-- \/cmd -->/gms
  const listItemPattern = /- (.*?) \| (.*)/s

  return markdown.replace(commandPattern, (match, headerArgs, extraArgs, listContent) => {
    const headers = headerArgs ? headerArgs.split('|').map((header) => header.trim()) : []
    const listItems = listContent.trim().split(/\n(?=- )/)
    const shouldWrap = extraArgs.match(/no-page-break/)

    const tableHeader = `| ${headers.join(' | ')} |`
    const tableDivider = `|${headers.map(() => '------').join('|')}|`

    const tableRows = listItems
      .map((item) => {
        const fullItem = item.replace(/\n/g, ' ')
        const [, left, right] = fullItem.match(listItemPattern) || []

        return left && right ? `| ${left} | ${right} |` : null
      })
      .filter(Boolean)

    if (tableRows.length) {
      const table = `\n${tableHeader}\n${tableDivider}\n${tableRows.join('\n')}\n`

      return shouldWrap
        ? `<div class="no-page-break list-to-table--converted">\n${table}\n</div>`
        : `<div class="list-to-table--converted">\n${table}\n</div>`
    }

    return match // Return original match if no conversion is done
  })
}
