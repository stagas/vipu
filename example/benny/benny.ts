// benny interface

import type { Server } from '.'

type Case = { name: string; fn: () => Promise<void> | void }
type Suites = Record<string, Case[]>
interface BennyWindow extends Window {
  vipu: {
    server: Server
  }
  suites: Suites
}

declare const window: BennyWindow

const server = window.vipu.server

export const suites: Suites = (window.suites = {})

export const suite = (name: string, ...cases: Case[]) => {
  suites[name] = cases

  return server.runSuite(
    name,
    cases.map(c => c.name),
  )
}

export const add = (name: Case['name'], fn: Case['fn']): Case => ({
  name,
  fn,
})

export const finish = server.finish
