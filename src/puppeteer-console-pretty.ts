// credits: https://github.com/andywer/puppet-run/blob/40a7eb06ccd8b2b9dcfdeeac273ec27dce6d3c54/src/host-bindings.ts

// TODO: move to an npm package

import chalk from 'chalk'
import type { Page } from 'puppeteer'

export function puppeteerConsolePretty(page: Page) {
  page.on('console', async message => {
    const type = message.type()
    const messageArgs = message.args()
    const args = await Promise.all(messageArgs.map(arg => arg.jsonValue()))
    messageArgs.forEach(arg => arg.dispose()) // gc

    if (type === 'clear') {
      return console.clear()
    } else if (type === 'startGroupCollapsed') {
      return console.groupCollapsed()
    } else if (type === 'endGroup') {
      return console.groupEnd()
    }

    if (type === 'error') {
      console.error(...args)
    } else if (type === 'warning') {
      console.warn(...args)
    } else if (type === 'debug') {
      console.debug(...args)
    } else if (type === 'startGroup') {
      console.group(...args)
    } else {
      console.log(...args)
    }
  })

  page.on('requestfailed', request => {
    const failure = request.failure()
    console.error(
      chalk.redBright(`Request failed: ${request.method()} ${request.url()}`)
    )
    console.error(
      chalk.gray(`  ${failure ? failure.errorText : 'Unknown error'}`)
    )
  })

  page.on('requestfinished', request => {
    const response = request.response()
    if (response && response.status() >= 400) {
      console.error(
        chalk.redBright(
          `HTTP ${response.status()} ${request.method()} ${request.url()}`
        )
      )
    }
  })
}

export default puppeteerConsolePretty
