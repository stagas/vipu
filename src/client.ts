import { Bob } from 'alice-bob'
import type { VipuWindowInterface } from '.'

declare const window: VipuWindowInterface<any, any>

const [client, server] = new Bob<any, any>().agents(window.vipuRpcConfig.client, window.vipuRpcConfig.server)
client.deferredSend = () => window.vipuSend

window.vipu = { client, server }

const ready = () => server.ready()
export { ready }
