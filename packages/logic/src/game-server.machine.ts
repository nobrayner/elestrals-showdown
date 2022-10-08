import type {
  SendEventFunction as SendEventFunctionBase,
  Deck,
} from '@elestrals-showdown/schemas'

import type { PlayerId, PlayerStateSyncPayload, GameState } from './types'

import type { ActorRefFrom, InterpreterFrom } from 'xstate'

import { assign, createMachine, interpret } from 'xstate'

import { rollDice } from './dice-utils'
import { initGameState } from './game-state-utils'
import { shuffleHandIntoDeck, expendSpirits, drawCards } from './card-effects'

const INITIAL_HAND_SIZE = 5

type SendEventFunction = SendEventFunctionBase<SentPlayerEvent>

export type PlayerData = {
  id: PlayerId
  send: SendEventFunction
  deck: Deck
}

type SentPlayerEvent =
  | {
    type: 'DICE_ROLL_RESULT'
    data: Pick<GameServerServices['rollDice']['data'], 'results'>
  }
  | { type: 'CHOOSE_STARTING_PLAYER'; data: undefined }
  | { type: 'SYNC_STATE'; data: PlayerStateSyncPayload }
  | { type: 'GAME_ROUND_OVER'; data: { winner: PlayerId } }

type GameServerEvent =
  | {
    type: 'PLAYER_CONNECTED'
    playerData: PlayerData
  }
  // Events that come from a player
  | {
    type: 'STARTING_PLAYER_PICKED'
    from: PlayerId
    startingPlayer: PlayerId
  }
  | {
    type: 'MULLIGAN'
    from: PlayerId
    spiritDeckIndicesToExpend: [number, number]
  }
  | {
    type: 'NO_MULLIGAN'
    from: PlayerId
  }

type GameServerContext = {
  currentPlayerId: string
  gameState: GameState
  players: Map<PlayerId, PlayerData>
}

type GameServerServices = {
  rollDice: {
    data: {
      results: Record<PlayerId, number>
      winner: PlayerId
    }
  }
  shufflePlayerDecks: {
    data: void
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
    initial: 'Waiting for Players',
    states: {
      'Waiting for Players': {
        always: {
          target: 'Rolling Dice',
          cond: 'enough players',
        },
        on: {
          PLAYER_CONNECTED: {
            target: 'Waiting for Players',
            actions: ['addPlayer'],
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
            cond: 'from current player',
            actions: ['setCurrentPlayerToStartingPlayer'],
          },
        },
      },
      'Shuffle and Draw': {
        entry: ['initGameState'],
        always: {
          target: 'Check for Mulligans',
        },
      },
      'Check for Mulligans': {
        entry: ['syncPlayerState'],
        always: [
          {
            target: 'Game Round Over',
            cond: 'only one player left',
          },
          {
            target: '#Elestrals TCG (Server).Game Round.Main Phase',
            cond: 'all players ready',
          },
        ],
        on: {
          MULLIGAN: [
            {
              cond: 'has two or more spirits',
              actions: ['mulligan', 'syncPlayerState'],
            },
            {
              actions: ['markPlayerAsSpiritOut'],
            },
          ],
          NO_MULLIGAN: {
            actions: ['markPlayerAsReady'],
          },
        },
      },
      'Game Round': {
        initial: 'Draw Phase',
        states: {
          'Draw Phase': {},
          'Main Phase': {
            type: 'parallel',
            states: {
              'Normal Enchant': {
                initial: 'Can Normal Enchant',
                states: {
                  'Can Normal Enchant': {
                    on: {
                      // NORMAL_ENCHANT_ELESTRAL: {
                      //   target: 'Cannot Normal Enchant',
                      // },
                      // REENCHANT_ELESTRAL: {
                      //   target: 'Cannot Normal Enchant',
                      // },
                      // EXPEND_TO_DRAW: {
                      //   target: 'Cannot Normal Enchant',
                      // },
                      // ASCEND_ELESTRAL: {
                      //   target: 'Cannot Normal Enchant',
                      // },
                    },
                  },
                  'Cannot Normal Enchant': {},
                },
              },
              Actions: {
                initial: 'Idle',
                states: {
                  Idle: {
                    description:
                      'Addd some random text to make this node as big as possible so there is more room for transitions!',
                    on: {
                      // PLAY_FACEDOWN_RUNE: {},
                      // ENCHANT_RUNE: {},
                      // USE_CARD_ABILITY: {},
                      // CHANGE_ELESTRAL_POSITION: {},
                    },
                  },
                },
              },
            },
            on: {
              // END_TURN: {
              //   target: 'End Phase',
              // },
              // ATTACK: {
              //   cond: 'attack position elestral on current player field',
              //   target: 'Battle Phase',
              // },
            },
          },
          'Battle Phase': {},
          'End Phase': {},
        },
      },
      'Game Round Over': {
        entry: ['sendGameRoundOver'],
      },
    },
  },
  {
    actions: {
      addPlayer: assign((c, e) => {
        const players = c.players

        players.set(e.playerData.id, e.playerData)

        return {
          players,
        }
      }),
      setCurrentPlayerToDiceRollWinner: assign((_, e) => {
        return {
          currentPlayerId: e.data.winner,
        }
      }),
      setCurrentPlayerToStartingPlayer: assign((_, e) => {
        return {
          currentPlayerId: e.startingPlayer,
        }
      }),
      sendPlayerDiceRollResults: (c, e) => {
        sendToAllPlayers(c, {
          type: 'DICE_ROLL_RESULT',
          data: {
            results: e.data.results,
          },
        })
      },
      sendChooseStartingPlayerEvent: (c, e) => {
        sendToPlayer(c, e.data.winner, {
          type: 'CHOOSE_STARTING_PLAYER',
          data: undefined,
        })
      },
      initGameState: assign((c) => {
        return {
          gameState: initGameState([...c.players.values()], INITIAL_HAND_SIZE),
        }
      }),
      markPlayerAsReady: (c, e) => {
        c.gameState.get(e.from)!.status = 'ready'
      },
      mulligan: (c, e) => {
        const player = c.gameState.get(e.from)!

        shuffleHandIntoDeck(player)
        expendSpirits(player, {
          spiritDeckIndicesToExpend: e.spiritDeckIndicesToExpend,
        })
        drawCards(player, { amount: INITIAL_HAND_SIZE })
      },
      markPlayerAsSpiritOut: (c, e) => {
        c.gameState.set(e.from, {
          ...c.gameState.get(e.from)!,
          status: 'out',
          outReason: 'spirit out',
        })
      },
      syncPlayerState: (c) => {
        sendToAllPlayers(c, (playerId, gameState) => {
          const player = gameState.get(playerId)!

          const opponentState: PlayerStateSyncPayload['opponents'] = {}

          for (const [opponentId, opponent] of gameState) {
            if (opponentId === playerId) {
              // We don't include ourselves in the opponent list!
              continue
            }

            opponentState[opponentId] = {
              spiritCount: opponent.spiritDeck.length,
              handCount: opponent.hand.length,
              field: opponent.field,
            }
          }

          return {
            type: 'SYNC_STATE',
            data: {
              mainDeckCount: player.mainDeck.length,
              spiritDeck: player.spiritDeck,
              hand: player.hand,
              field: player.field,
              opponents: opponentState,
            },
          }
        })
      },
      sendGameRoundOver: (c) => {
        const winner = [...c.gameState.entries()].find(
          ([_, player]) => player.status !== 'out'
        )!
        sendToAllPlayers(c, {
          type: 'GAME_ROUND_OVER',
          data: {
            winner: winner[0],
          },
        })
      },
    },
    guards: {
      'from current player': (c, e) => {
        return c.currentPlayerId === e.from
      },
      'enough players': (c) => {
        return c.players.size === 2
      },
      'has two or more spirits': (c, e) => {
        return c.gameState.get(e.from)!.spiritDeck.length > 2
      },
      'all players ready': (c) => {
        return [...c.gameState.values()].every(
          (player) => player.status === 'ready'
        )
      },
      'only one player left': (c) => {
        return (
          [...c.gameState.values()].filter((player) => player.status !== 'out')
            .length === 1
        )
      },
    },
    services: {
      rollDice: async (c) => {
        type Roll = [PlayerId, number]
        const results: Roll[] = []

        for (const [playerId] of c.players) {
          results.push([playerId, rollDice()])
        }

        const highestRoll = (winningRoll: Roll, playerRoll: Roll) => {
          if (playerRoll[1] > winningRoll[1]) {
            return playerRoll
          }

          return winningRoll
        }

        let topRoll: [PlayerId, number] = results.reduce(highestRoll)
        let tiedWinnerIndexes = results
          .filter((roll) => roll[1] === topRoll[1])
          .map((_, i) => i)

        while (tiedWinnerIndexes.length > 1) {
          for (const index of tiedWinnerIndexes) {
            results[index]![1] = rollDice()
          }

          topRoll = results
            .filter((_, i) => tiedWinnerIndexes.includes(i))
            .reduce(highestRoll)
          tiedWinnerIndexes = results
            .filter((roll) => roll[1] === topRoll[1])
            .map((_, i) => i)
        }

        return {
          results: Object.fromEntries(results),
          winner: topRoll[0],
        }
      },
    },
  }
)

export type GameServerActor = ActorRefFrom<typeof gameServerMachine>
export type GameServerService = InterpreterFrom<typeof gameServerMachine>

function sendToAllPlayers(
  context: GameServerContext,
  eventOrBuilder:
    | SentPlayerEvent
    | ((playerId: PlayerId, gameState: GameState) => SentPlayerEvent)
) {
  context.players.forEach((player) => {
    const event =
      typeof eventOrBuilder === 'function'
        ? eventOrBuilder(player.id, context.gameState)
        : eventOrBuilder

    player.send(event)
  })
}

function sendToPlayer(
  context: GameServerContext,
  player: PlayerId,
  event: SentPlayerEvent
) {
  context.players.get(player)!.send(event)
}

export function newGameServerMachine(playerData: PlayerData) {
  const players = new Map()
  players.set(playerData.id, playerData)

  return interpret(
    gameServerMachine.withContext({
      currentPlayerId: '' as any,
      players,
      // Will be properly set once the game starts
      gameState: {} as GameState,
    })
  ).start()
}
