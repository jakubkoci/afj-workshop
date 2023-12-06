import { startApp } from './app'

export function hello(name: string) {
  const greeting = `Hello, ${name}!`
  return greeting
}

async function main() {
  const agentName = process.env.NAME || 'default-agent'
  const port = Number(process.env.PORT) || 3000
  startApp(agentName, port)
}

main()
