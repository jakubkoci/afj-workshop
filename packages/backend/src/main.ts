import { Agent, KeyType, TypedArrayEncoder } from '@aries-framework/core'
import { initAgent } from './agent'

export function hello(name: string) {
  const greeting = `Hello, ${name}!`
  return greeting
}

async function main() {
  const agent = await initAgent()

  if (!agent) throw new Error('Agent is not initialized!')

  console.log('Agent', agent)
  console.log('Agent initialized!')

  const didResolutionResult = await agent.dids.resolve(
    'did:indy:bcovrin:test:PaAQsUg4JwvaVuvkk9VQok',
  )
  console.log('didResolutionResult', didResolutionResult)

  const did = await importDid(agent)
  const schemaId = await registerSchema(agent, did)
  await registerCredentialDefinition(agent, did, schemaId)
}

async function importDid(agent: Agent) {
  const seed = TypedArrayEncoder.fromString(`acea2c3daef588159078fe6a0a779df5`) // What you input on bcovrin. Should be kept secure in production!
  const unqualifiedIndyDid = `jLNmQZPJjeiCj22oF1h13` // will be returned after registering seed on bcovrin
  const indyDid = `did:indy:bcovrin:test:${unqualifiedIndyDid}`

  await agent.dids.import({
    did: indyDid,
    overwrite: true,
    privateKeys: [
      {
        privateKey: seed,
        keyType: KeyType.Ed25519,
      },
    ],
  })
  console.log(`Did ${indyDid} has been imported`)
  return indyDid
}

async function registerSchema(agent: Agent, issuerDid: string) {
  const schemaResult = await agent.modules.anoncreds.registerSchema({
    schema: {
      attrNames: ['name'],
      issuerId: issuerDid,
      name: 'Example Schema to register',
      version: '1.0.0',
    },
    options: {},
  })

  if (schemaResult.schemaState.state === 'failed') {
    throw new Error(`Error creating schema: ${schemaResult.schemaState.reason}`)
  }

  console.log('schemaResult', schemaResult)
  const { schemaId } = schemaResult.schemaState
  console.log(`Schema ${schemaId} has been registered`)
  return schemaResult.schemaState.schemaId
}

async function registerCredentialDefinition(
  agent: Agent,
  issuerDid: string,
  schemaId: string,
) {
  const credentialDefinitionResult =
    await agent.modules.anoncreds.registerCredentialDefinition({
      credentialDefinition: {
        tag: 'default',
        issuerId: issuerDid,
        schemaId,
      },
      options: {},
    })

  if (credentialDefinitionResult.credentialDefinitionState.state === 'failed') {
    throw new Error(
      `Error creating credential definition: ${credentialDefinitionResult.credentialDefinitionState.reason}`,
    )
  }

  console.log('credentialDefinitionResult', credentialDefinitionResult)
  const { credentialDefinitionId } =
    credentialDefinitionResult.credentialDefinitionState
  console.log(
    `Credential definition ${credentialDefinitionId} has been registered`,
  )
  return credentialDefinitionId
}

main()
