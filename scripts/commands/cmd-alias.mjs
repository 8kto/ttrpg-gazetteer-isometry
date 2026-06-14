#!/usr/bin/env node

/**
 * @file Provides aliases for commands
 */

/**
 * @type {Map<RegExp, string>}
 */
const ALIASES = new Map([
  [/<!-- item\[([^\]]+)] \/-->/g, `<!-- cmd[ref] header[$1] detailed /-->`],
  // [/<!-- persona\[([^\]])] \/-->/g, 'cmd[ref] header[$1] detailed']
])

// <!-- cmd[ref] header[Щит Викинга] detailed /-->
// <!-- item[Щит Викинга] /-->

/**
 * @param {string} line
 * @returns {Array<string>}
 */
const processAliases = (line) => {
  let res = line

  ALIASES.forEach((replace, search) => {
    res = res.replace(search, replace)
  })

  return res
}

/**
 * @type {CommandHandlerFn}
 * @param {string} markdown
 * @returns {string}
 */
export const addAliases = (markdown) => {
  const lines = markdown.split('\n')
  const res = lines.map((line) => processAliases(line))

  return res.join('\n')
}
