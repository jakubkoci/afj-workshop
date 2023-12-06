import { initAgent } from './agent'

export function hello(name: string) {
  const greeting = `Hello, ${name}!`
  return greeting
}

async function main() {
  const agent = await initAgent()
  console.log('Agent', agent)
  console.log('Agent initialized!')

  const didResolutionResult = await agent?.dids.resolve(
    'did:indy:bcovrin:test:PaAQsUg4JwvaVuvkk9VQok',
  )
  console.log('didResolutionResult', didResolutionResult)
}

main()
