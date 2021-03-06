import chalk from '@stagas/chalk'
import { createServer, mergeConfig, ViteDevServer } from 'vite'
import puppeteer, { SerializableOrJSHandle } from 'puppeteer'
import { Alice, Agent, PayloadMethod } from 'alice-bob'
import type { AddressInfo } from 'net'
import puppeteerConsolePretty from './puppeteer-console-pretty'

export interface VipuWindowInterface<Server, Client> extends WindowOrWorkerGlobalScope {
  vipu: {
    server: Agent<Server, Client>
    client: Agent<Client, Server>
  }
  vipuSend: PayloadMethod<Agent<Client, Server>>
  vipuRpcConfig: RpcConfig<Client, Server>
}

export const ready = () => undefined

declare const window: VipuWindowInterface<unknown, unknown>

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

export interface Vipu<Server, Client> {
  page: puppeteer.Page
  browser: puppeteer.Browser
  vite: ViteDevServer
  close: () => Promise<void>
  server: Agent<Server, Client>
  client: Agent<Client, Server>
  ready: () => Promise<void>
}

const vipuLog = (...args: unknown[]) => console.log(chalk.blueBright('[vipu]'), ...args)

/**
 * Creates a vipu instance.
 *
 * @param config Configuration.
 * @param config.rpc Passed to AliceBob [`agents`](https://github.com/stagas/alice-bob/#agents).
 * @param config.vite Vite configuration. Passed to vite [`createServer`](https://vitejs.dev/guide/api-javascript.html#createserver).
 * @param config.puppeteer Puppeteer launch configuration. Passed to [`puppeteer.launch`](https://pptr.dev/#?product=Puppeteer&version=v11.0.0&show=api-puppeteerlaunchoptions).
 * @param config.info Whether to display info messages in console.
 * @param config.log Log function that can be overriden.
 * @returns
 */
async function vipu<Server extends { ready: () => Promise<void> }, Client>({
  rpc: rpcConfig = {},
  vite: viteConfig = {},
  puppeteer: puppeteerConfig = {},
  info = true,
  log = vipuLog,
}: Config = {}): Promise<Vipu<Server, Client>> {
  info && log('starting...')

  rpcConfig = mergeConfig(
    {
      server: { name: 'server' },
      client: { name: 'client' },
    },
    rpcConfig,
  )

  viteConfig = mergeConfig({}, viteConfig)

  const startRpc = async (page: puppeteer.Page, rpcOptions: RpcConfig<unknown, unknown>) => {
    const [server, client] = new Alice<Server, Client>().agents(
      rpcOptions.server as Partial<Agent<Server, Client>>,
      rpcOptions.client as Partial<Agent<Client, Server>>,
    )

    server.send = async data => {
      try {
        const result = await page.evaluate(data => window.vipu.client.receive(data), data as unknown as SerializableOrJSHandle)
        return result
      } catch (error) {
        console.error(error)
      }
    }

    await page.evaluateOnNewDocument((rpcConfig: RpcConfig<unknown, unknown>) => {
      window.vipuRpcConfig = rpcConfig
    }, rpcOptions)
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
  const [viteDevServer, { browser, page, rpc }] = await Promise.all([startViteDevServer(), startPuppeteer()])

  // logs
  puppeteerConsolePretty(page)
  page.on('load', () => info && log('page loaded '.padEnd(65, '???')))
  page.on('close', () => info && log(' page closed'.padStart(65, '???')))
  info && log('started.')
  viteDevServer.printUrls()

  // TODO: a not very DX friendly way of getting the url of the server i just created..
  // should've been smth like: `httpServer.address().toString()` or `viteDevServer.url`
  const addressInfo = viteDevServer.httpServer!.address() as AddressInfo
  const url = `${viteDevServer.config.server.https ? 'https' : 'http'}://${addressInfo.address}:${addressInfo.port}`

  // navigate to the server
  page.goto(url)

  // ready hook
  let resolveReady: () => void
  const readyPromise = new Promise<void>(resolve => (resolveReady = resolve))
  rpc.server.ready = async () => resolveReady()
  const ready = async () => readyPromise

  return {
    ...rpc,
    ready,
    page,
    browser,
    vite: viteDevServer,
    close: async () => {
      info && log('closing...')
      // give some time for the ack's
      // TODO: should be handled better
      return new Promise<void>(resolve =>
        setTimeout(async () => {
          await browser.close()
          await viteDevServer.close()
          info && log('closed.')
          resolve()
        }, 150),
      )
    },
  }
}

export { vipu }
export default vipu
