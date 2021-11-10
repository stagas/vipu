import { vipu } from '../../src'
import type { Client } from './client'

export interface Server {
  sayHi: ({ iam }: { iam: string }) => Promise<string>
  finish: () => Promise<void>
}

export interface WindowHandle {
  vipu: {
    server: Server
  }
}

vipu<Server, Client>(require.resolve('./client.ts')).then(
  ({ server, client, page, finish }) => {
    server.finish = finish
    server.sayHi = async ({ iam }) => `hello ${iam}`
    page.on('load', async () => {
      const result = await client.multiply(3, 4)
      console.log('from client:', result)
      // => from client: 12
    })
  },
)
