import type { SendEventFunction as SendEventFunctionBase, DeckList, PlayerKey } from '@elestrals-showdown/types'

import type { DiceRollResult } from './types'

import type { ActorRefFrom, InterpreterFrom } from 'xstate'
import { assign, createMachine, interpret } from 'xstate'

import { rollDice } from './dice-utils'

type PlayerEvents =
  | {
    type: 'DICE_ROLL_RESULT'
    data: Pick<GameServerServices['rollDice']['data'], 'player1' | 'player2'>
  }
  | { type: 'CHOOSE_STARTING_PLAYER'; data: undefined }

type SendEventFunction = SendEventFunctionBase<PlayerEvents>

type GameServerEvent =
  | { type: 'PLAYER_2_CONNECTED'; send: SendEventFunction }
  // Events that come from a player
  | { type: 'STARTING_PLAYER_PICKED'; from: PlayerKey; startingPlayer: PlayerKey }

type GameServerContext = {
  currentPlayer: 'player1' | 'player2'
  player1: {
    send: SendEventFunction
    deck: DeckList
  }
  player2: {
    send: SendEventFunction
    deck: DeckList
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
}

export const gameServerMachine = createMachine(
  {
    // Configuration
    id: 'Elestrals TCG (Server)',
    predictableActionArguments: true,
    tsTypes: {} as import("./game-server.machine.typegen").Typegen0,
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
            actions: ['assignPlayer2']
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
        entry: ['setCurrentPlayer', 'sendChooseStartingPlayerEvent'],
        on: {
          STARTING_PLAYER_PICKED: {
            target: 'Draw Cards',
          },
        },
      },
      'Draw Cards': {},
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
            send: e.send,
          },
        }
      }),
      setCurrentPlayer: assign((_, e) => {
        return {
          currentPlayer: e.data.winner,
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
      }
    },
    guards: {},
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
          winner: p1Roll > p2Roll ? 'player1' as const : 'player2' as const
        }
      }
    },
  }
)

export type GameServerActor = ActorRefFrom<typeof gameServerMachine>
export type GameServerService = InterpreterFrom<typeof gameServerMachine>

function sendToPlayers(context: GameServerContext, event: PlayerEvents) {
  context.player1.send(event)
  context.player2.send(event)
}

export function newGameServerMachine(send: SendEventFunction) {
  return interpret(gameServerMachine.withContext({
    currentPlayer: '' as any,
    player1: {
      send,
      deck: {} as DeckList,
    },
    // We don't actually have player2 until they connect, so just dummy this one
    player2: {} as any,
  })).start()
}
