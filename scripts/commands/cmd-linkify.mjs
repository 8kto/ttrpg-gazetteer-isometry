#!/usr/bin/env node

/**
 * @file Convert room references to the links:
 *    - headers that look like `## A2. Room` are parsed and converted to the HTML headers with `id=$roomRef`
 *    - room refs in texts that look like `... leads to the Cats Hall (A4)` are converted to the HTML links
 */

/**
 * @param {string} ref
 * @returns {string}
 */
const covertRoomRefToLink = (ref) => {
  return `room-` + ref.toLowerCase()
}

/**
 * @param {Array<string>} lines
 * @returns {Array<string>}
 */
const linkRooms = (lines) => {
  /** @type {Array<string>} */
  const buffer = []
  const roomRefRegex = /\(([A-F]\d+)\)/g

  lines.forEach((line) => {
    if (line.match(roomRefRegex)) {
      const replaced = line.replace(roomRefRegex, (_, roomRef) => {
        return `<a target="_self" href="#${covertRoomRefToLink(roomRef)}">(${roomRef})</a>`
      })
      buffer.push(replaced)
    } else {
      buffer.push(line)
    }
  })

  return buffer
}

const linkHeaders = (lines) => {
  /** @type {Array<string>} */
  const buffer = []
  const headerRegex = /^(#+)\s([A-F]\d+)\.\s(.+)$/

  lines.forEach((line) => {
    if (line.match(headerRegex)) {
      const replaced = line.replace(headerRegex, (_, headerPfx, roomRef, headerText) => {
        const level = headerPfx.length
        const tag = `h${level}`

        return `<${tag} id="${covertRoomRefToLink(roomRef)}">${roomRef}. ${headerText}</${tag}>`
      })
      buffer.push(replaced)
    } else {
      buffer.push(line)
    }
  })

  return buffer
}

/**
 * @type {CommandHandlerFn}
 * @param {string} markdown
 * @returns {string}
 */
export const linkifyRoomReferences = (markdown) => {
  const lines = markdown.split('\n')
  const processors = [linkRooms, linkHeaders]

  const res = processors.reduce((acc, processor) => processor(acc), lines)

  return res.join('\n')
}
