import type {
  PlayerStateSyncPayload as GameState,
  SentPlayerEvent as ServerEvent,
} from '@elestrals-showdown/logic'
import { gameRoundMachine, SendToServer } from './game-round.machine'

import {
  createMachine,
  assign,
  StateFrom,
  ActorRefFrom,
  StateValueFrom,
} from 'xstate'

type PlayContext = {
  roomId: string
  playerId: string
  sendToServer: SendToServer
  opponents: string[]
  diceRolls: Record<string, number>
}

type PlayEvent =
  | { type: 'CONNECTED'; sendToServer: SendToServer }
  | { type: 'PLAYER_CHOSEN'; playerId: string }
  | ServerEvent

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
    },
    // Actual Machine
    initial: 'Init',
    invoke: {
      id: 'gameSocket',
      src: 'gameSocket',
    },
    on: {
      GAME_ROUND_OVER: {
        target: '#Play Machine',
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
                target: '#Play Machine.In Play',
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
      'In Play': {
        invoke: {
          id: 'gameRound',
          src: 'gameRound',
          autoForward: true,
          data: (c, e) => {
            return {
              sendToServer: c.sendToServer,
              // @ts-expect-error
              gameState: e.data,
            }
          },
        },
      },
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
    },
    guards: {
      'is client side': () => {
        return typeof window !== 'undefined'
      },
    },
    services: {
      gameSocket: (c, _e) => (send, recieve) => {
        const ws = new WebSocket(
          gameURLFrom(c.roomId, TESTING_DECK_LIST, c.playerId)
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
          console.log('Disconnected')
          // @ts-expect-error
          send({ type: 'GAME_ROUND_OVER', winner: '' })
        }

        return () => {
          ws.close()
        }
      },
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
    aeolus: 3,
    aeromare: 3,
    ambrosia: 3,
    ampup: 3,
    apheros: 3,
    astrabbit: 3,
    atlantis: 3,
    bagofwinds: 3,
    blazerus: 3,
    boombatt: 3,
    capregal: 3,
    carryon: 3,
    centaurbor: 3,
    circlethesky: 1,
  },
  spirit: {
    zaptor: 4,
    vipyro: 4,
    leviaphin: 4,
    lycarus: 4,
    teratlas: 4,
  },
  sideboard: {},
}
