import chalk from 'chalk'
import { createServer, mergeConfig } from 'vite'
import puppeteer, { SerializableOrJSHandle } from 'puppeteer'
import { Alice, Agent, PayloadMethod } from 'alice-bob'
import type { AddressInfo } from 'net'
import puppeteerConsolePretty from './puppeteer-console-pretty'

export interface VipuWindowInterface extends Window {
  vipu: {
    server: Agent<unknown, unknown>
    client: Agent<unknown, unknown>
  }
  vipuSend: PayloadMethod<Agent<unknown, unknown>>
  vipuRpcConfig: RpcConfig<unknown, unknown>
}

declare const window: VipuWindowInterface

export type RpcConfig<Server, Client> = {
  server?: Partial<Agent<Server, Client>>
  client?: Partial<Agent<Client, Server>>
}

export interface Config {
  rpc?: RpcConfig<unknown, unknown>
  vite?: Parameters<typeof createServer>[0]
  puppeteer?: Parameters<typeof puppeteer.launch>[0]
  info?: boolean
  log?: (...args: unknown[]) => void
}

const vipuLog = (...args: unknown[]) =>
  console.log(chalk.blueBright('[vipu]'), ...args)

/**
 * Creates a vipu instance.
 *
 * @param entry Entry file. Must be a full path, which can be obtained using `require.resolve()`. It can be anything Vite supports, .ts, .tsx work as well.
 * @param config Configuration.
 * @param config.rpc Passed to AliceBob [`agents`](https://github.com/stagas/alice-bob/#agents).
 * @param config.vite Vite configuration. Passed to vite [`createServer`](https://vitejs.dev/guide/api-javascript.html#createserver).
 * @param config.puppeteer Puppeteer launch configuration. Passed to [`puppeteer.launch`](https://pptr.dev/#?product=Puppeteer&version=v11.0.0&show=api-puppeteerlaunchoptions).
 * @param config.info Whether to display info messages in console.
 * @param config.log Log function that can be overriden.
 * @returns
 */
async function vipu<Server, Client>(
  entry: string,
  {
    rpc: rpcConfig = {},
    vite: viteConfig = {},
    puppeteer: puppeteerConfig = {},
    info = true,
    log = vipuLog,
  }: Config = {},
) {
  info && log('starting...')

  rpcConfig = mergeConfig(
    {
      server: { name: 'server' },
      client: { name: 'client' },
    },
    rpcConfig,
  )

  viteConfig = mergeConfig(
    {
      root: __dirname + '/public',
      resolve: {
        alias: {
          '/@vipu/client': '/client.ts',
          '@vipu/entry': entry,
        },
      },
    },
    viteConfig,
  )

  const startRpc = async (
    page: puppeteer.Page,
    rpcOptions: RpcConfig<unknown, unknown>,
  ) => {
    const [server, client] = new Alice<Server, Client>().agents(
      rpcOptions.server as Partial<Agent<Server, Client>>,
      rpcOptions.client as Partial<Agent<Client, Server>>,
    )

    server.send = async data => {
      try {
        const result = await page.evaluate(
          data => window.vipu.client.receive(data),
          data as unknown as SerializableOrJSHandle,
        )
        return result
      } catch (error) {
        console.error(error)
      }
    }

    await page.evaluateOnNewDocument(
      (rpcConfig: RpcConfig<unknown, unknown>) => {
        window.vipuRpcConfig = rpcConfig
      },
      rpcOptions,
    )
    await page.exposeFunction('vipuSend', server.receive)

    return { server, client }
  }

  const startViteDevServer = async () => {
    const viteDevServer = await createServer(viteConfig)
    await viteDevServer.listen()
    return viteDevServer
  }

  const startPuppeteer = async () => {
    const browser = await puppeteer.launch(puppeteerConfig)
    const page = await browser.newPage()
    const rpc = await startRpc(page, rpcConfig)
    return { browser, page, rpc }
  }

  // start server and puppeteer in parallel
  const [viteDevServer, { browser, page, rpc }] = await Promise.all([
    startViteDevServer(),
    startPuppeteer(),
  ])

  // logs
  puppeteerConsolePretty(page)
  page.on('load', () => info && log('page loaded '.padEnd(65, '─')))
  page.on('close', () => info && log(' page closed'.padStart(65, '─')))
  info && log('started.')
  viteDevServer.printUrls()

  // TODO: a not very DX friendly way of getting the url of the server i just created..
  // should've been smth like: `httpServer.address().toString()` or `viteDevServer.url`
  const addressInfo = viteDevServer.httpServer!.address() as AddressInfo
  const url = `${viteDevServer.config.server.https ? 'https' : 'http'}://${
    addressInfo.address
  }:${addressInfo.port}`

  // navigate to the server
  page.goto(url)

  return {
    ...rpc,
    page,
    browser,
    vite: viteDevServer,
    finish: async () => {
      info && log('finishing...')
      // give some time for the ack's
      // TODO: should be handled better
      setTimeout(async () => {
        await browser.close()
        await viteDevServer.close()
        info && log('finished.')
      }, 150)
    },
  }
}

export { vipu }
export default vipu
