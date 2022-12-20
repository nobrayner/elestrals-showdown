import type { PlayerId, PlayerMetaWithStatus } from './types'

import { createMachine } from 'xstate'

import { sendToAllPlayers } from './machine-utils'
import { GameState } from './game-state'
import type { Chain, ChainLink } from './chain'

type ChainProcessorEvent = { type: 'NOOP' }

type ChainProcessorContext = {
  players: Map<PlayerId, PlayerMetaWithStatus>
  gameState: GameState
  chain: Chain
  linksForNextChain: ChainLink[]
}

export const chainProcessorMachine = createMachine(
  {
    id: 'Chain Processor Machine',
    predictableActionArguments: true,
    tsTypes: {} as import('./chain-processor.machine.typegen').Typegen0,
    schema: {
      events: {} as ChainProcessorEvent,
      context: {} as ChainProcessorContext,
    },
    // Actual Machine
    entry: ['sendChainUpdateToPlayers'],
    initial: 'Gather Reactions',
    states: {
      'Gather Reactions': {},
    },
  },
  {
    actions: {
      sendChainUpdateToPlayers: (c, _e) => {
        sendToAllPlayers(c, {
          type: 'CHAIN_UPDATE',
          data: {
            chain: c.chain,
            newLink: c.chain.at(-1)!,
          },
        })
      },
    },
    guards: {},
  }
)
