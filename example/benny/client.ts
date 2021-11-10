import { suites } from './benny'

// client interface

const client = {
  runCase: async (suiteName: string, caseName: string) =>
    suites[suiteName].find(c => c.name === caseName)?.fn(),

  getSuites: async () =>
    Object.fromEntries(
      Object.keys(suites).map(s => [s, suites[s].map(c => c.name)]),
    ),
}

export default client
export type Client = typeof client

// benchmark

// this is aliased in vipu config under ./index.ts to point
// to the actual benchmark file
import 'benny-benchmark'
