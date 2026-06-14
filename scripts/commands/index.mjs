import { convertListToTable } from '#commands/cmd-convert-list.mjs'
import { convertRefInserts } from '#commands/cmd-ref-insert.mjs'
import { convertStatsInserts } from '#commands/cmd-stats-insert.mjs'
import { linkifyRoomReferences } from '#commands/cmd-linkify.mjs'
import { addAliases } from '#commands/cmd-alias.mjs'

/**
 * @global
 * @typedef {Function} CommandHandlerFn
 * @property {function(string): string} - A function that takes a markdown string and returns a string
 */

/**
 * @type {CommandHandlerFn[]}
 */
const commandHandlers = [addAliases, convertListToTable, convertRefInserts, convertStatsInserts, linkifyRoomReferences]

/**
 * @param {string} markdown
 * @returns {string}
 */
const handleCommands = (markdown) => commandHandlers.reduce((acc, handler) => handler(acc), markdown)

export default handleCommands
