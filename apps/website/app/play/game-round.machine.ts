import type {
  PlayerStateSyncPayload as GameState,
  SentPlayerEvent as ServerEvent,
} from '@elestrals-showdown/logic'
import type { SelectionResultEvent } from './selection.machine'

import { createMachine, assign, ActorRefFrom, StateFrom } from 'xstate'
import {
  createSelectionInvokeData,
  selectionMachine,
} from './selection.machine'

export type SendToServer = (e: { type: string;[key: string]: any }) => void

type GameRoundEvent =
  | { type: 'KEEP_HAND' }
  | { type: 'MULLIGAN' }
  | ServerEvent
  | SelectionResultEvent

type GameRoundContext = {
  sendToServer: SendToServer
  gameState: GameState
}

export const gameRoundMachine = createMachine(
  {
    id: 'Game Round Machine',
    predictableActionArguments: true,
    tsTypes: {} as import('./game-round.machine.typegen').Typegen0,
    schema: {
      context: {} as GameRoundContext,
      events: {} as GameRoundEvent,
    },
    // Actual Machine
    initial: 'Mulligan Check',
    states: {
      'Mulligan Check': {
        initial: 'Checking',
        states: {
          Checking: {
            on: {
              KEEP_HAND: {
                target: 'Waiting',
                actions: ['sendNoMulliganEvent'],
              },
              MULLIGAN: {
                target: 'Choosing Spirits',
              },
            },
          },
          Waiting: {
            on: {
              GAME_ROUND_START: {
                target: '#Game Round Machine.Game Round',
              },
            },
          },
          'Choosing Spirits': {
            invoke: {
              id: 'mulliganSelection',
              src: 'mulliganSelection',
              data: (c) => {
                return createSelectionInvokeData({
                  cards: c.gameState.spiritDeck,
                  amount: 2,
                })
              },
            },
            on: {
              SELECTION_CONFIRMED: {
                target: 'Checking',
                actions: ['sendMulliganEvent'],
              },
              SELECTION_CANCELLED: {
                target: 'Checking',
              },
            },
          },
        },
        on: {
          SYNC_STATE: {
            actions: ['updateGameState'],
          },
        },
      },
      'Game Round': {},
    },
  },
  {
    actions: {
      updateGameState: assign((_c, e) => {
        return {
          gameState: e.data,
        }
      }),
      sendNoMulliganEvent: ({ sendToServer }) => {
        sendToServer({ type: 'NO_MULLIGAN' })
      },
      sendMulliganEvent: ({ sendToServer }, e) => {
        sendToServer({
          type: 'MULLIGAN',
          spiritDeckIndicesToExpend: e.selection,
        })
      },
    },
    guards: {},
    services: {
      mulliganSelection: selectionMachine,
    },
  }
)

export type GameRoundActor = ActorRefFrom<typeof gameRoundMachine>
export type GameRoundState = StateFrom<typeof gameRoundMachine>
