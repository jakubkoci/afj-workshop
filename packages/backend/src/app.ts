import express from 'express'
// import morgan from 'morgan'
import cors from 'cors'
import { asyncHandler } from './middleware'
import * as repository from './repository'
import { Agent, KeyType, TypedArrayEncoder } from '@aries-framework/core'

export function createApp(agent: Agent) {
  const app = express()
  // app.use(morgan(':date[iso] :method :url :response-time'))
  app.use(cors())
  app.use(express.json())
  app.set('json spaces', 2)

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
    '/import-did/:seed',
    asyncHandler(async (req, res) => {
      // What you input on bcovrin. Should be kept secure in production!
      const seed = req.params.seed
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

  return app
}
