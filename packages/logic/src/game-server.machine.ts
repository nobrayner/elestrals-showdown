import type {
  SendEventFunction as SendEventFunctionBase,
  Deck,
  Card,
} from '@elestrals-showdown/types'

import type {
  DiceRollResult,
  PlayerStateSyncPayload,
  PlayerState,
} from './types'

import type { ActorRefFrom, InterpreterFrom } from 'xstate'

import { assign, createMachine, interpret } from 'xstate'

import { rollDice } from './dice-utils'
import { shuffleCards } from './deck-utils'

export type PlayerData = {
  id: string
  send: SendEventFunction
  deck: Deck
}

type SentPlayerEvents =
  | {
    type: 'DICE_ROLL_RESULT'
    data: Pick<GameServerServices['rollDice']['data'], 'player1' | 'player2'>
  }
  | { type: 'CHOOSE_STARTING_PLAYER'; data: undefined }
  | { type: 'SYNC_STATE'; data: PlayerStateSyncPayload }

type SendEventFunction = SendEventFunctionBase<SentPlayerEvents>

type GameServerEvent =
  | {
    type: 'PLAYER_2_CONNECTED'
    playerData: PlayerData
  }
  // Events that come from a player
  | {
    type: 'STARTING_PLAYER_PICKED'
    from: string
    startingPlayer: 'me' | 'them'
  }

type GameServerContext = {
  currentPlayer: string
  player1: PlayerState & {
    id: string
    send: SendEventFunction
  }
  player2: PlayerState & {
    id: string
    send: SendEventFunction
  }
}

type GameServerServices = {
  rollDice: {
    data: {
      player1: DiceRollResult
      player2: DiceRollResult
      winner: 'player1' | 'player2'
    }
  }
  shufflePlayer1Deck: {
    data: Card[]
  }
  shufflePlayer2Deck: {
    data: Card[]
  }
}

export const gameServerMachine = createMachine(
  {
    // Configuration
    id: 'Elestrals TCG (Server)',
    predictableActionArguments: true,
    tsTypes: {} as import('./game-server.machine.typegen').Typegen0,
    schema: {
      events: {} as GameServerEvent,
      context: {} as GameServerContext,
      services: {} as GameServerServices,
    },
    // Actual Machine
    initial: 'Waiting for Player 2',
    states: {
      'Waiting for Player 2': {
        on: {
          PLAYER_2_CONNECTED: {
            target: 'Rolling Dice',
            actions: ['assignPlayer2'],
          },
        },
      },
      'Rolling Dice': {
        invoke: {
          src: 'rollDice',
          onDone: {
            target: 'Choose Starting Player',
            actions: ['sendPlayerDiceRollResults'],
          },
        },
      },
      'Choose Starting Player': {
        entry: [
          'setCurrentPlayerToDiceRollWinner',
          'sendChooseStartingPlayerEvent',
        ],
        on: {
          STARTING_PLAYER_PICKED: {
            target: 'Shuffle and Draw',
            cond: 'fromCurrentPlayer',
            actions: ['setCurrentPlayerToStartingPlayer'],
          },
        },
      },
      'Shuffle and Draw': {
        type: 'parallel',
        onDone: {
          target: 'Game Started',
        },
        states: {
          'Player 1': {
            initial: 'Shuffle',
            states: {
              Shuffle: {
                invoke: {
                  src: 'shufflePlayer1Deck',
                  onDone: {
                    target: 'Ready',
                    actions: ['setInitialPlayer1State'],
                  },
                },
              },
              Ready: {
                type: 'final',
              },
            },
          },
          'Player 2': {
            initial: 'Shuffle',
            states: {
              Shuffle: {
                invoke: {
                  src: 'shufflePlayer2Deck',
                  onDone: {
                    target: 'Ready',
                    actions: ['setInitialPlayer2State'],
                  },
                },
              },
              Ready: {
                type: 'final',
              },
            },
          },
        },
      },
      'Game Started': {
        entry: ['syncPlayer1State', 'syncPlayer2State'],
      },
      'Game Over': {
        type: 'final',
      },
    },
  },
  {
    actions: {
      assignPlayer2: assign((c, e) => {
        return {
          player2: {
            ...c.player2,
            ...e.playerData,
            field: {
              elestrals: [null, null, null, null] as any,
              runes: [null, null, null, null] as any,
              stadium: null,
              underworld: [] as any,
            },
            hand: [] as any,
          },
        }
      }),
      setCurrentPlayerToDiceRollWinner: assign((_, e) => {
        return {
          currentPlayer: e.data.winner,
        }
      }),
      setCurrentPlayerToStartingPlayer: assign((c, e) => {
        const me = e.from
        const them = c.player1.id === e.from ? c.player2.id : c.player1.id
        return {
          currentPlayer: e.startingPlayer === 'me' ? me : them,
        }
      }),
      sendPlayerDiceRollResults: (c, e) => {
        sendToPlayers(c, {
          type: 'DICE_ROLL_RESULT',
          data: {
            player1: e.data.player1,
            player2: e.data.player2,
          },
        })
      },
      sendChooseStartingPlayerEvent: (c, e) => {
        c[e.data.winner].send({
          type: 'CHOOSE_STARTING_PLAYER',
          data: undefined,
        })
      },
      syncPlayer1State: (c) => {
        const player = c.player1
        const opponent = c.player2

        player.send({
          type: 'SYNC_STATE',
          data: {
            deck: {
              main: player.deck.main,
              spirit: player.deck.spirit,
            },
            hand: player.hand,
            field: player.field,
            opponent: {
              field: opponent.field,
              handCount: opponent.hand.length,
              spiritCount: opponent.deck.spirit.length,
            },
          },
        })
      },
      syncPlayer2State: (c) => {
        const player = c.player2
        const opponent = c.player1

        player.send({
          type: 'SYNC_STATE',
          data: {
            deck: {
              main: player.deck.main,
              spirit: player.deck.spirit,
            },
            hand: player.hand,
            field: player.field,
            opponent: {
              field: opponent.field,
              handCount: opponent.hand.length,
              spiritCount: opponent.deck.spirit.length,
            },
          },
        })
      },
      // player1DrawCard: assign((c) => {
      //   const card = c.player1.deck.main.shift()!

      //   return {
      //     player1: {
      //       ...c.player1,
      //       hand: c.player1.hand.concat(card),
      //     },
      //   }
      // }),
      // player2DrawCard: assign((c) => {
      //   const card = c.player2.deck.main.shift()!

      //   return {
      //     player2: {
      //       ...c.player2,
      //       hand: c.player2.hand.concat(card),
      //     },
      //   }
      // }),
      : assign((c, e) => {
        return {
          player1: {
            ...c.player1,
            deck: {
              ...c.player1.deck,
              main: e.data,
            },
          },
        }
      }),
  updatePlayer2Deck: assign((c, e) => {
    return {
      player2: {
        ...c.player2,
        deck: {
          ...c.player2.deck,
          main: e.data,
        },
      },
    }
  }),
    },
guards: {
  fromCurrentPlayer: (c, e) => {
    return c.currentPlayer === e.from
  },
    },
services: {
  rollDice: async () => {
    const p1Roll = rollDice()
    let p2Roll = rollDice()

    while (p2Roll === p1Roll) {
      p2Roll = rollDice()
    }

    return {
      player1: {
        roll: p1Roll,
      },
      player2: {
        roll: p2Roll,
      },
      winner: p1Roll > p2Roll ? ('player1' as const) : ('player2' as const),
    }
  },
    shufflePlayer1Deck: async (c) => {
      return shuffleCards(c.player1.deck.main)
    },
      shufflePlayer2Deck: async (c) => {
        return shuffleCards(c.player2.deck.main)
      },
    },
  }
)

export type GameServerActor = ActorRefFrom<typeof gameServerMachine>
export type GameServerService = InterpreterFrom<typeof gameServerMachine>

function sendToPlayers(context: GameServerContext, event: SentPlayerEvents) {
  context.player1.send(event)
  context.player2.send(event)
}

export function newGameServerMachine({ id, send, deck }: PlayerData) {
  return interpret(
    gameServerMachine.withContext({
      currentPlayer: '' as any,
      player1: {
        id,
        send,
        deck,
        field: {
          elestrals: [null, null, null, null],
          runes: [null, null, null, null],
          stadium: null,
          underworld: [],
        },
        hand: [],
      },
      // We don't actually have player2 until they connect, so just dummy this one
      player2: {} as any,
    })
  ).start()
}
