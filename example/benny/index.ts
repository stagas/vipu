import { vipu } from '../../src'
import { suite, add, cycle, complete, configure } from 'benny'
import { asciiChartReporter } from 'benny-ascii-chart-reporter'
import type { Client } from './client'

export interface Server {
  runSuite: (name: string, cases: string[]) => Promise<void>
  finish: () => Promise<void>
}

vipu<Server, Client>(require.resolve('./client.ts'), {
  rpc: {
    server: { debug: false, name: 'benny' },
    client: { debug: false, name: 'bench' },
  },
  vite: {
    server: { force: true },
    resolve: {
      alias: {
        'benny-benchmark': require.resolve('./benchmark/insert-elements.ts'),
      },
    },
  },
}).then(({ server, client, finish }) => {
  server.finish = finish
  server.runSuite = async (name, cases) => {
    await suite(
      name,
      configure({
        cases: {
          minSamples: 3,
          maxTime: 1,
        },
      }),
      ...cases.map(c => add(c, () => () => client.runCase(name, c))),
      cycle(),
      complete(asciiChartReporter({ reverse: true, sort: false })),
      complete(),
    )
  }
})
