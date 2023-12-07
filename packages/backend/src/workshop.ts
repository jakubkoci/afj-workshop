// import morgan from 'morgan'
import { asyncHandler, errorHandler } from './middleware'
import * as repository from './repository'
import {
  Agent,
  ConnectionsModule,
  ConsoleLogger,
  CredentialEventTypes,
  CredentialState,
  CredentialStateChangedEvent,
  CredentialsModule,
  DidsModule,
  HttpOutboundTransport,
  InitConfig,
  LogLevel,
  V2CredentialProtocol,
} from '@aries-framework/core'
import { HttpInboundTransport, agentDependencies } from '@aries-framework/node'
import { AskarModule } from '@aries-framework/askar'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import {
  AnonCredsCredentialFormatService,
  AnonCredsModule,
} from '@aries-framework/anoncreds'
import { AnonCredsRsModule } from '@aries-framework/anoncreds-rs'
import { anoncreds } from '@hyperledger/anoncreds-nodejs'
import {
  IndyVdrAnonCredsRegistry,
  IndyVdrIndyDidRegistrar,
  IndyVdrIndyDidResolver,
  IndyVdrModule,
} from '@aries-framework/indy-vdr'
import { indyVdr } from '@hyperledger/indy-vdr-nodejs'
import { bcovrinTestnet } from './txns'
import { createApp } from './app'

export async function startApp(agentName: string, port: number) {
  const agent = createAgent(agentName, port)

  if (!agent) throw new Error('Agent has not been created!')

  const app = createApp(agent)

  agent.registerOutboundTransport(new HttpOutboundTransport())
  agent.registerInboundTransport(new HttpInboundTransport({ app, port }))

  app.get(
    '/invitation',
    asyncHandler(async (req, res) => {
      // TODO Section 2: Create an invitation
      const outOfBandRecord = await agent.oob.createInvitation()
      const { outOfBandInvitation } = outOfBandRecord
      res.send(outOfBandInvitation.toUrl({ domain: 'https://example.com/ssi' }))
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
          // autoAcceptInvitation: true,
          // autoAcceptConnection: true,
        })
      res.status(200).json({ outOfBandRecord, connectionRecord })
    }),
  )

  app.get(
    '/issue-credential/:connectionId',
    asyncHandler(async (req, res) => {
      const connectionId = req.params.connectionId
      const credentialDefinitionId = repository.getCredentialDefinitionId()

      const anonCredsCredentialExchangeRecord =
        agent.credentials.offerCredential({
          protocolVersion: 'v2',
          connectionId,
          credentialFormats: {
            anoncreds: {
              credentialDefinitionId,
              attributes: [
                { name: 'name', value: 'Jane Doe' },
                // { name: 'age', value: '23' },
              ],
            },
          },
        })
      res.status(200).json(anonCredsCredentialExchangeRecord)
    }),
  )

  app.use(errorHandler)
  await agent.initialize()
  console.log('Agent started.')

  return app
}

function createAgent(name: string, port: number) {
  const config: InitConfig = {
    label: name,
    walletConfig: {
      id: name,
      key: 'testkey0000000000000000000000000',
    },
    endpoints: [`http://localhost:${port}`],
    logger: new ConsoleLogger(LogLevel.trace),
  }

  const agent = new Agent({
    config,
    dependencies: agentDependencies,
    modules: {
      askar: new AskarModule({
        ariesAskar,
      }),
      connections: new ConnectionsModule({
        autoAcceptConnections: true,
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
        registrars: [new IndyVdrIndyDidRegistrar()],
        resolvers: [new IndyVdrIndyDidResolver()],
      }),
      credentials: new CredentialsModule({
        credentialProtocols: [
          new V2CredentialProtocol({
            credentialFormats: [
              // new LegacyIndyCredentialFormatService(),
              new AnonCredsCredentialFormatService(),
            ],
          }),
        ],
      }),
    },
  })

  agent.events.on<CredentialStateChangedEvent>(
    CredentialEventTypes.CredentialStateChanged,
    async ({ payload }) => {
      switch (payload.credentialRecord.state) {
        case CredentialState.OfferReceived: {
          console.log('received a credential')
          // custom logic here
          await agent.credentials.acceptOffer({
            credentialRecordId: payload.credentialRecord.id,
          })
          break
        }
        case CredentialState.Done: {
          console.log(
            `Credential for credential id ${payload.credentialRecord.id} is accepted`,
          )
        }
      }
    },
  )

  return agent
}
