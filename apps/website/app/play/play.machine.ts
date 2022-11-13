import type {
  PlayerStateSyncPayload as GameState,
  SentPlayerEvent as ServerEvent,
  PlayerId,
} from '@elestrals-showdown/logic'
import type { SendToServer } from './game-round.machine'
import type { StateFrom, ActorRefFrom, StateValueFrom } from 'xstate'

import { createMachine, assign } from 'xstate'

import { gameRoundMachine } from './game-round.machine'
import {
  createSelectionInvokeData,
  selectionMachine,
} from './selection.machine'
import type { SelectionResultEvent } from './selection.machine'

type PlayContext = {
  roomId: string
  playerId: string
  sendToServer: SendToServer
  opponents: string[]
  diceRolls: Record<string, number>
  gameState: GameState
}

type PlayEvent =
  | { type: 'CONNECTED'; sendToServer: SendToServer }
  | { type: 'PLAYER_CHOSEN'; playerId: PlayerId }
  | { type: 'KEEP_HAND' }
  | { type: 'MULLIGAN' }
  | { type: 'DISCONNECTED' }
  | ServerEvent
  | SelectionResultEvent

export const playMachine = createMachine(
  {
    id: 'Play Machine',
    predictableActionArguments: true,
    tsTypes: {} as import('./play.machine.typegen').Typegen0,
    schema: {
      context: {} as PlayContext,
      events: {} as PlayEvent,
    },
    context: {
      playerId: '',
      roomId: '',
      sendToServer: () => { },
      opponents: [],
      diceRolls: {},
      gameState: {} as GameState,
    },
    // Actual Machine
    initial: 'Init',
    invoke: {
      id: 'gameSocket',
      src: 'gameSocket',
    },
    on: {
      SYNC_STATE: {
        actions: ['updateGameState'],
      },
      GAME_ROUND_OVER: {
        target: 'Game Round Over',
      },
    },
    states: {
      Init: {
        after: {
          1: {
            target: 'Connecting',
            cond: 'is client side',
          },
        },
      },
      Connecting: {
        on: {
          CONNECTED: {
            target: 'Waiting For Opponents',
            actions: ['saveSendToServerToContext', 'sendConnectedEvent'],
          },
        },
      },
      'Waiting For Opponents': {
        on: {
          PLAYER_CONNECTED: {
            actions: ['addOpponent'],
          },
          ENOUGH_PLAYERS: {
            target: 'Deciding Starting Player',
          },
        },
      },
      'Deciding Starting Player': {
        initial: 'Rolling',
        states: {
          Rolling: {
            on: {
              DICE_ROLL_RESULT: {
                target: 'Waiting',
                actions: ['saveDiceRollsToContext'],
              },
            },
          },
          Waiting: {
            on: {
              CHOOSE_STARTING_PLAYER: {
                target: 'Choosing',
              },
              SYNC_STATE: {
                target: '#Play Machine.Mulligan Check',
                actions: ['updateGameState'],
              },
            },
          },
          Choosing: {
            on: {
              PLAYER_CHOSEN: {
                target: 'Waiting',
                actions: ['sendStartingPlayerPickedEvent'],
              },
            },
          },
        },
      },
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
                target: '#Play Machine.In Play',
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
      'In Play': {
        invoke: {
          id: 'gameRound',
          src: 'gameRound',
          autoForward: true,
          data: (c, _e) => {
            return {
              sendToServer: c.sendToServer,
              playerId: c.playerId,
              gameState: c.gameState,
            }
          },
        },
        on: {
          GAME_ROUND_OVER: {
            target: 'Game Round Over',
          },
        },
      },
      'Game Round Over': {},
      Disconnected: {},
    },
  },
  {
    actions: {
      saveSendToServerToContext: assign((_c, e) => {
        return {
          sendToServer: e.sendToServer,
        }
      }),
      sendConnectedEvent: ({ sendToServer }) => {
        sendToServer({
          type: 'PLAYER_CONNECTED',
        })
      },
      addOpponent: assign((_c, e) => {
        return {
          opponents: e.data.players,
        }
      }),
      saveDiceRollsToContext: assign((_c, e) => {
        return {
          diceRolls: e.data.results,
        }
      }),
      sendStartingPlayerPickedEvent: ({ sendToServer }, e) => {
        sendToServer({
          type: 'STARTING_PLAYER_PICKED',
          startingPlayer: e.playerId,
        })
      },
      sendNoMulliganEvent: ({ sendToServer }) => {
        sendToServer({ type: 'NO_MULLIGAN' })
      },
      sendMulliganEvent: ({ sendToServer }, e) => {
        sendToServer({
          type: 'MULLIGAN',
          spiritDeckIndicesToExpend: e.selection as [number, number],
        })
      },
      updateGameState: assign((_c, e) => {
        return {
          gameState: e.data,
        }
      }),
    },
    guards: {
      'is client side': () => {
        return typeof window !== 'undefined'
      },
    },
    services: {
      gameSocket: (c, _e) => (send, recieve) => {
        const ws = new WebSocket(
          gameURLFrom(c.roomId, AMBROSIA_DECK, c.playerId)
        )

        recieve((event) => {
          console.log(`[gameSocket] ${event}`)
        })

        ws.onopen = () => {
          console.log('Connected')
          send({
            type: 'CONNECTED',
            sendToServer: (e) => {
              ws.send(JSON.stringify(e))
            },
          })
        }

        ws.onmessage = (message) => {
          const event = JSON.parse(message.data)

          send(event)
        }

        ws.onclose = () => {
          send({ type: 'DISCONNECTED' })
        }

        return () => {
          ws.close()
        }
      },
      mulliganSelection: selectionMachine,
      gameRound: gameRoundMachine,
    },
  }
)

export type PlayState = StateFrom<typeof playMachine>
export type PlayStateValue = StateValueFrom<typeof playMachine>
export type PlayActor = ActorRefFrom<typeof playMachine>

function gameURLFrom(roomId: string, deckList: any, playerId: string): URL {
  console.log('Connecting player', playerId, 'to room', roomId)
  const url = new URL('ws://localhost:4040')

  // FIXME: Make this robust
  url.searchParams.append('roomId', roomId)
  url.searchParams.append('deckList', JSON.stringify(deckList))
  url.searchParams.append('playerId', playerId)

  return url
}

const TESTING_DECK_LIST = {
  main: {
    base_006: 3,
    base_021: 3,
    base_042: 3,
    base_053: 3,
    base_054: 3,
    base_056: 3,
    base_068: 3,
    base_069: 3,
    base_078: 3,
    base_092: 3,
    base_097: 3,
    base_098: 3,
    base_102: 3,
    base_103: 1,
  },
  spirit: {
    base_001: 4,
    base_002: 4,
    base_003: 4,
    base_004: 4,
    base_005: 4,
  },
  sideboard: {},
}

const AMBROSIA_DECK = {
  main: {
    base_103: 6,
  },
  spirit: {
    base_005: 20,
  },
  sideboard: {},
}
