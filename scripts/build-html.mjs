#!/bin/env node

import chalk from 'chalk'
import fs from 'fs-extra'
import matter from 'gray-matter'
import path from 'path'
import { fileURLToPath } from 'url'

import handleCommands from '#commands/index.mjs'
import { getMarkdownRenderer } from '#lib/markdown.mjs'

import globalConfig from '../global.conf.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SKIPPED_FILES = ['server.html', '0801-uber-beasts.md', '$refs-stats.md', '$notes.md']

/**
 * @param {string} filename
 * @returns {boolean}
 */
const shouldSkipFile = (filename) => {
  return !filename.endsWith('.md') || SKIPPED_FILES.includes(filename)
}

const convertMarkdownToHtml = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf8')
  const frontMatter = matter(content)
  const processedContent = handleCommands(frontMatter.content)
  // const htmlContent = await hyphenateRu(md.render(processedContent))
  const htmlContent = getMarkdownRenderer().render(processedContent)

  return {
    metadata: {
      ...globalConfig,
      ...frontMatter.data,
    },
    content: htmlContent,
  }
}

const applyTemplate = async (data, templatePath) => {
  const { content, metadata } = data
  const template = await fs.readFile(templatePath, 'utf8')

  return template
    .replace('{{documentTitle}}', metadata.documentTitle)
    .replace('{{header}}', metadata.header)
    .replace('{{footer}}', metadata.footer)
    .replace('{{content}}', content)
}

const buildHtmlFiles = async () => {
  console.info(chalk.green('Building HTML...'))

  const markdownDir = path.join(__dirname, '../src/markdown')
  const htmlDir = path.join(__dirname, '../src/html')
  const buildDir = path.join(__dirname, '../build/chunks-html')

  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir)
  }

  void fs.copy(path.join(__dirname, '../server/index.html'), `${buildDir}/server.html`)
  void fs.copy(path.join(__dirname, '../build/output.css'), `${buildDir}/output.css`)
  void fs.copy(path.join(__dirname, '../src/images/'), `${buildDir}/images/`)

  try {
    const markdownFiles = await fs.readdir(markdownDir)

    // for (const file of markdownFiles.slice(0,5)) {
    for (const file of markdownFiles) {
      if (shouldSkipFile(file)) {
        continue
      }

      const filePath = path.join(markdownDir, file)
      const data = await convertMarkdownToHtml(filePath)
      const { metadata } = data

      const templatePath = path.join(htmlDir, `/${metadata.template}`)
      const html = await applyTemplate(data, templatePath)
      await fs.writeFile(path.join(buildDir, `/${file}.html`), html)
      console.info(chalk.blueBright(`Generated HTML for ${file}`))
    }
  } catch (error) {
    console.error(chalk.red('Error during HTML build:'), error)
  }
}

void buildHtmlFiles()
