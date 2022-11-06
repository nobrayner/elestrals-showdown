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

type PlayerDataWithStatus = PlayerData & {
  status: 'connecting' | 'connected' | 'disconnected'
}

export type SentPlayerEvent =
  | { type: 'PLAYER_CONNECTED'; data: { players: PlayerId[] } }
  | { type: 'ENOUGH_PLAYERS'; data: undefined }
  | {
    type: 'DICE_ROLL_RESULT'
    data: Pick<GameServerServices['rollDice']['data'], 'results'>
  }
  | { type: 'CHOOSE_STARTING_PLAYER'; data: undefined }
  | { type: 'GAME_ROUND_START'; data: undefined }
  | { type: 'SYNC_STATE'; data: PlayerStateSyncPayload }
  | { type: 'GAME_ROUND_OVER'; data: { winner: PlayerId } }

export type RecievedPlayerEvent =
  | { type: 'PLAYER_CONNECTED'; from: PlayerId }
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
  | {
    type: 'NORMAL_ENCHANT_ELESTRAL'
    from: PlayerId
    cardIndex: number
    spiritCardIndex: number
    elestralFieldIndex: number
    position: 'attack' | 'defence'
  }

type GameServerEvent =
  | { type: 'PLAYER_CONNECTING'; playerData: PlayerData }
  | { type: 'PLAYER_DISCONNECTED'; playerId: PlayerId }
  | RecievedPlayerEvent

type GameServerContext = {
  currentPlayerId: string
  gameState: GameState
  players: Map<PlayerId, PlayerDataWithStatus>
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
    on: {
      PLAYER_DISCONNECTED: [
        {
          target: 'Game Round Over',
          cond: 'is connected player',
          actions: ['removePlayer'],
        },
        {
          actions: ['removePlayer'],
        },
      ],
    },
    initial: 'Waiting for Players',
    states: {
      'Waiting for Players': {
        always: {
          target: 'Rolling Dice',
          cond: 'enough connected players',
          actions: ['sendEnoughPlayersEvent'],
        },
        on: {
          PLAYER_CONNECTING: {
            target: 'Waiting for Players',
            actions: ['addPlayer'],
          },
          PLAYER_CONNECTED: {
            target: 'Waiting for Players',
            actions: ['markPlayerAsConnected', 'sendConnectedPlayersList'],
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
            actions: ['sendGameRoundStartEvent'],
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
                      NORMAL_ENCHANT_ELESTRAL: {
                        target: 'Normal Enchanting Elestral',
                        cond: 'from current player and is elestral',
                      },
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
                  'Normal Enchanting Elestral': {
                    invoke: {
                      src: 'normalEnchantElestral',
                      onDone: {
                        target: 'Cannot Normal Enchant',
                      },
                      onError: {
                        target: 'Can Normal Enchant',
                      },
                    },
                  },
                  'Cannot Normal Enchant': {
                    entry: ['syncPlayerState'],
                  },
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
        entry: ['sendGameRoundOverEvent'],
        type: 'final',
      },
    },
  },
  {
    actions: {
      addPlayer: assign((c, e) => {
        const players = c.players

        players.set(e.playerData.id, { ...e.playerData, status: 'connecting' })

        return {
          players,
        }
      }),
      removePlayer: assign((c, e) => {
        const players = c.players

        players.delete(e.playerId)

        return {
          players,
        }
      }),
      markPlayerAsConnected: assign((c, e) => {
        const players = c.players
        const player = players.get(e.from)!

        player.status = 'connected'

        return {
          players,
        }
      }),
      sendConnectedPlayersList: (c, _e) => {
        if (c.players.size <= 1) {
          // Don't notify the first player about themselves connecting
          return
        }

        sendToAllPlayers(c, (playerId) => {
          return {
            type: 'PLAYER_CONNECTED',
            data: {
              players: [...c.players.keys()].filter((id) => id !== playerId),
            },
          }
        })
      },
      sendEnoughPlayersEvent: (c) => {
        sendToAllPlayers(c, {
          type: 'ENOUGH_PLAYERS',
          data: undefined,
        })
      },
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
      sendGameRoundStartEvent: (c) => {
        sendToAllPlayers(c, {
          type: 'GAME_ROUND_START',
          data: undefined,
        })
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
      sendGameRoundOverEvent: (c) => {
        const winner = [...c.gameState.entries()].find(
          ([_, player]) => player.status !== 'out'
        )

        if (!winner) {
          return
        }

        sendToAllPlayers(c, {
          type: 'GAME_ROUND_OVER',
          data: {
            winner: winner[0],
          },
        })
      },
    },
    guards: {
      'is connected player': (c, e) => {
        const player = c.players.get(e.playerId)

        return player?.status === 'connected'
      },
      'from current player and is elestral': (c, e) => {
        return fromCurrentPlayer(c, e)
      },
      'from current player': (c, e) => {
        return fromCurrentPlayer(c, e)
      },
      'enough connected players': (c) => {
        const requiredNumberOfPlayers = 2

        return (
          c.players.size === requiredNumberOfPlayers &&
          [...c.players.values()].filter((p) => p.status === 'connected')
            .length === requiredNumberOfPlayers
        )
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
      normalEnchantElestral: async (c, e) => {
        const player = c.gameState.get(e.from)!
        const card = player.hand[e.cardIndex]

        if (card === undefined) {
          throw new Error('Invalid card index for current hand')
        }
        if (card.class !== 'elestral') {
          throw new Error(
            'Tried to normal enchant a non-Elestral to an Elestral slot'
          )
        }

        if (player.field.elestrals[e.elestralFieldIndex] !== null) {
          throw new Error('Already an elestral in that slot')
        }

        player.field.elestrals[e.elestralFieldIndex] = {
          card,
          position: e.position,
          spirits: player.spiritDeck.splice(e.spiritCardIndex, 1),
        }
      },
    },
  }
)

export type GameServerActor = ActorRefFrom<typeof gameServerMachine>
export type GameServerService = InterpreterFrom<typeof gameServerMachine>

//////
// Guard Helpers (FIXME: Turn into real guards with xstate v5)
//////

function fromCurrentPlayer(
  c: GameServerContext,
  e: RecievedPlayerEvent
): boolean {
  return c.currentPlayerId === e.from
}

// Send Helpers

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
  const players = new Map<PlayerId, PlayerDataWithStatus>()
  players.set(playerData.id, { ...playerData, status: 'connecting' })

  return interpret(
    gameServerMachine.withContext({
      currentPlayerId: '' as any,
      players,
      // Will be properly set once the game starts
      gameState: new Map() as GameState,
    })
  ).start()
}
