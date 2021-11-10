import { Bob } from 'alice-bob'
import type { VipuWindowInterface } from '..'

declare const window: VipuWindowInterface

const [client, server] = new Bob().agents(
  window.vipuRpcConfig.client,
  window.vipuRpcConfig.server,
)
client.deferredSend = () => window.vipuSend
window.vipu = { client, server }
import('@vipu/entry').then(m => Object.assign(client, m.default))
