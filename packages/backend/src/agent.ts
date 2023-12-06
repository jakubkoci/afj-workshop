import type { InitConfig } from '@aries-framework/core'
import {
  Agent,
  ConsoleLogger,
  DidsModule,
  HttpOutboundTransport,
  LogLevel,
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

const config: InitConfig = {
  label: 'docs-agent-nodejs',
  walletConfig: {
    id: 'wallet-id',
    key: 'testkey0000000000000000000000000',
  },
  logger: new ConsoleLogger(LogLevel.trace),
}

export async function initAgent() {
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

  agent.registerOutboundTransport(new HttpOutboundTransport())
  agent.registerInboundTransport(new HttpInboundTransport({ port: 3000 }))

  try {
    await agent.initialize()
    return agent
  } catch (error) {
    console.error(
      `Something went wrong while setting up the agent! Message: ${error}`,
    )
  }
}
