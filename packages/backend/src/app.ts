import express from 'express'
// import morgan from 'morgan'
import cors from 'cors'
import { asyncHandler, errorHandler } from './middleware'
import * as repository from './repository'
import {
  Agent,
  ConsoleLogger,
  DidsModule,
  HttpOutboundTransport,
  InitConfig,
  KeyType,
  LogLevel,
  TypedArrayEncoder,
} from '@aries-framework/core'
import { HttpInboundTransport, agentDependencies } from '@aries-framework/node'
import { AskarModule } from '@aries-framework/askar'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { AnonCredsModule } from '@aries-framework/anoncreds'
import { AnonCredsRsModule } from '@aries-framework/anoncreds-rs'
import { anoncreds } from '@hyperledger/anoncreds-nodejs'
import {
  IndyVdrAnonCredsRegistry,
  IndyVdrIndyDidResolver,
  IndyVdrModule,
} from '@aries-framework/indy-vdr'
import { indyVdr } from '@hyperledger/indy-vdr-nodejs'
import { bcovrinTestnet } from './txns'

export async function startApp(agentName: string, port: number) {
  const agent = createAgent(agentName)

  if (!agent) throw new Error('Agent is not initialized!')

  console.log('Agent initialized!')

  const app = express()
  // app.use(morgan(':date[iso] :method :url :response-time'))
  app.use(cors())
  app.use(express.json())
  app.set('json spaces', 2)

  agent.registerOutboundTransport(new HttpOutboundTransport())
  agent.registerInboundTransport(new HttpInboundTransport({ app, port }))

  app.get(
    '/',
    asyncHandler(async (req, res) => {
      res.send('Hello, World!')
    }),
  )

  app.get(
    '/resolve-did',
    asyncHandler(async (req, res) => {
      // params
      const did = 'did:indy:bcovrin:test:PaAQsUg4JwvaVuvkk9VQok'

      const didResolutionResult = await agent.dids.resolve(did)
      console.log('didResolutionResult', didResolutionResult)
      res.status(200).json({ didResolutionResult })
    }),
  )

  app.get(
    '/import-did',
    asyncHandler(async (req, res) => {
      // params
      // What you input on bcovrin. Should be kept secure in production!
      const seed = 'acea2c3daef588159078fe6a0a779df5'
      // will be returned after registering seed on bcovrin
      const unqualifiedIndyDid = `jLNmQZPJjeiCj22oF1h13`

      const indyDid = `did:indy:bcovrin:test:${unqualifiedIndyDid}`

      await agent.dids.import({
        did: indyDid,
        overwrite: true,
        privateKeys: [
          {
            privateKey: TypedArrayEncoder.fromString(seed),
            keyType: KeyType.Ed25519,
          },
        ],
      })
      console.log(`Did ${indyDid} has been imported`)
      repository.saveDid(indyDid)
      res.status(200).json({ did: indyDid })
    }),
  )

  app.get(
    '/dids',
    asyncHandler(async (req, res) => {
      const dids = await agent.dids.getCreatedDids()
      console.log('request to /dids', dids)
      res.status(200).json(dids)
    }),
  )

  app.get(
    '/oobs',
    asyncHandler(async (req, res) => {
      const outOfBandRecords = await agent.oob.getAll()
      res.status(200).json(outOfBandRecords)
    }),
  )

  app.get(
    '/connections',
    asyncHandler(async (req, res) => {
      const connectionRecords = await agent.connections.getAll()
      res.status(200).json(connectionRecords)
    }),
  )

  app.get(
    '/credentials',
    asyncHandler(async (req, res) => {
      const credentialRecords = await agent.credentials.getAll()
      res.status(200).json(credentialRecords)
    }),
  )

  app.get(
    '/proofs',
    asyncHandler(async (req, res) => {
      const proofRecords = await agent.proofs.getAll()
      res.status(200).json(proofRecords)
    }),
  )

  app.get(
    '/schemas',
    asyncHandler(async (req, res) => {
      res.status(200).json({
        did: repository.getDid(),
        schemaId: repository.getSchemaId(),
        credentialDefinitionId: repository.getCredentialDefinitionId(),
      })
    }),
  )

  app.get(
    '/register-schema',
    asyncHandler(async (req, res) => {
      const issuerDid = repository.getDid()
      const schemaResult = await agent.modules.anoncreds.registerSchema({
        schema: {
          attrNames: [
            'Name',
            'Surname',
            'Date of Birth',
            'Event Name',
            'Event Year',
          ],
          name: 'Conference Ticket',
          version: '1.0.0',
          issuerId: issuerDid,
        },
        options: {},
      })

      if (schemaResult.schemaState.state === 'failed') {
        throw new Error(
          `Error creating schema: ${schemaResult.schemaState.reason}`,
        )
      }

      console.log('schemaResult', schemaResult)
      const { schemaId } = schemaResult.schemaState

      if (!schemaId) {
        throw new Error('No schema ID after registration')
      }

      console.log(`Schema ${schemaId} has been registered`)
      repository.saveSchemaId(schemaId)
      res.status(200).json({ schemaResult })
    }),
  )

  app.get(
    '/register-credential-definition',
    asyncHandler(async (req, res) => {
      // params
      const issuerDid = repository.getDid()
      const schemaId = repository.getSchemaId()

      const credentialDefinitionResult =
        await agent.modules.anoncreds.registerCredentialDefinition({
          credentialDefinition: {
            tag: 'default',
            issuerId: issuerDid,
            schemaId,
          },
          options: {},
        })

      if (
        credentialDefinitionResult.credentialDefinitionState.state === 'failed'
      ) {
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
      if (!credentialDefinitionId) {
        throw new Error('No credential definition ID after registration')
      }

      repository.saveCredentialDefinitionId(credentialDefinitionId)
      res.status(200).json({ credentialDefinitionResult })
    }),
  )

  app.post(
    '/accept-invitation',
    asyncHandler(async (req, res) => {
      console.log('req.body', req.body)
      const { invitationUrl } = req.body
      const { outOfBandRecord, connectionRecord } =
        await agent.oob.receiveInvitationFromUrl(invitationUrl, {
          alias: 'Test name',
          autoAcceptInvitation: true,
          autoAcceptConnection: true,
        })
      res.status(200).json({ outOfBandRecord, connectionRecord })
    }),
  )

  app.use(errorHandler)
  await agent.initialize()

  return app
}

function createAgent(name: string) {
  const config: InitConfig = {
    label: name,
    walletConfig: {
      id: name,
      key: 'testkey0000000000000000000000000',
    },
    logger: new ConsoleLogger(LogLevel.trace),
  }

  const agent = new Agent({
    config,
    dependencies: agentDependencies,
    modules: {
      askar: new AskarModule({
        ariesAskar,
      }),
      anoncredsRs: new AnonCredsRsModule({
        anoncreds,
      }),
      anoncreds: new AnonCredsModule({
        registries: [new IndyVdrAnonCredsRegistry()],
      }),
      indyVdr: new IndyVdrModule({
        indyVdr,
        networks: [
          {
            isProduction: false,
            indyNamespace: 'bcovrin:test',
            genesisTransactions: bcovrinTestnet,
            connectOnStartup: true,
          },
        ],
      }),
      dids: new DidsModule({
        resolvers: [new IndyVdrIndyDidResolver()],
      }),
    },
  })

  return agent
}
