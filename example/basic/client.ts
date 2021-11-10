import type { WindowHandle } from './index'
declare const window: WindowHandle
const server = window.vipu.server

;(async () => {
  console.log('from server:', await server.sayHi({ iam: 'The Client' }))
  // => from server: hello The Client
})()

const client = {
  multiply: async (x: number, y: number) => x * y,
}

export default client
export type Client = typeof client
