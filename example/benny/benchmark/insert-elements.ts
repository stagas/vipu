import { suite, add, finish } from '../benny'

// benchmark

const container = document.body
const clear = () => (container.innerHTML = '')

const bench = async () => {
  for (const count of [100, 1_000, 10_000, 50_000, 100_000]) {
    await suite(
      `insert ${count} elements`,

      // add('1 sec', () => new Promise(r => setTimeout(r, 1000))),
      // add('2 sec', () => new Promise(r => setTimeout(r, 2000))),
      // add('3 sec', () => new Promise(r => setTimeout(r, 3000))),
      add('createElement/appendChild', () => {
        clear()
        for (let i = 0; i < count; i++) {
          const div = document.createElement('div')
          container.appendChild(div)
        }
      }),

      add('html+=div + innerHTML', () => {
        clear()
        let html = ''
        for (let i = 0; i < count; i++) {
          html += '<div></div>'
        }
        container.innerHTML = html
      }),

      add('Array.fill.join() + innerHTML', () => {
        clear()
        container.innerHTML = Array(count).fill('<div></div>').join('')
      }),
    )
  }
}

bench().then(finish)
