import type { RuneCard } from '@elestrals-showdown/schemas'

import type {
  PlayerId,
  PlayerMeta,
  PlayerMetaWithStatus,
  DiceRollResult,
} from './types'
import type { AnyFieldSlot } from './game-state'

import type { ActorRefFrom, InterpreterFrom } from 'xstate'

import { assign, send, createMachine, interpret } from 'xstate'

import { rollDice } from './dice-utils'
import { sendToPlayer, sendToAllPlayers } from './machine-utils'
import { GameState } from './game-state'
import { shuffleHandIntoDeck, expendSpirits, drawCards } from './card-effects'
import { chainProcessorMachine } from './chain-processor.machine'

const INITIAL_HAND_SIZE = 5

export type RecievedPlayerEvent =
  | { type: 'PLAYER_CONNECTED' }
  | {
      type: 'STARTING_PLAYER_PICKED'
      startingPlayer: PlayerId
    }
  | {
      type: 'MULLIGAN'
      spiritDeckIndicesToExpend: number[]
    }
  | {
      type: 'NO_MULLIGAN'
    }
  | {
      type: 'NORMAL_CAST_ELESTRAL'
      from: {
        zone: 'hand'
        index: number
      }
      cost: {
        zone: 'spirit deck'
        index: number
      }[]
      position: 'attack' | 'defence'
    }
  | {
      type: 'CAST_RUNE'
      from: {
        zone: 'hand'
        index: number
      }
      cost: (
        | {
            zone: 'field'
            type: AnyFieldSlot['type']
            slotIndex: number
            spiritIndex: number
          }
        | {
            zone: 'spirit deck'
            index: number
          }
      )[]
    }
  | {
      type: 'CAST_SET_RUNE'
      from: {
        zone: 'field.rune'
        index: number
      }
      cost: (
        | {
            zone: 'field'
            type: AnyFieldSlot['type']
            slotIndex: number
            spiritIndex: number
          }
        | {
            zone: 'spirit deck'
            index: number
          }
      )[]
    }
  | {
      type: 'CAST_STADIUM'
      from: {
        zone: 'hand'
        index: number
      }
      cost: {
        zone: 'spirit deck'
        index: number
      }[]
    }
  | { type: 'END_TURN' }

type RecievedPlayerEventWithFrom = RecievedPlayerEvent & {
  from: PlayerId
}

type GameServerEvent =
  | { type: 'PLAYER_CONNECTING'; playerData: PlayerMeta }
  | { type: 'PLAYER_DISCONNECTED'; playerId: PlayerId }
  | { type: 'DECK_OUT' }
  | RecievedPlayerEventWithFrom

type GameServerContext = {
  gameState: GameState
  players: Map<PlayerId, PlayerMetaWithStatus>
}

type GameServerServices = {
  rollDice: {
    data: DiceRollResult
  }
  shufflePlayerDecks: {
    data: void
  }
}

export const gameServerMachine = createMachine(
  {
    // Configuration
    id: 'Elestrals Game',
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
            cond: 'from active player',
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
            target: '#Elestrals Game.Game Round.Main Phase',
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
        onDone: {
          target: 'Game Round',
          actions: [
            'advanceActivePlayer',
            'syncPlayerState',
            'sendNextPlayerTurnEvent',
          ],
        },
        on: {
          DECK_OUT: [
            {
              target: 'Game Round Over',
              cond: 'only one player left',
            },
            {
              target: 'Game Round',
              actions: [
                'advanceActivePlayer',
                'syncPlayerState',
                'sendNextPlayerTurnEvent',
              ],
            },
          ],
        },
        initial: 'Draw Phase',
        states: {
          'Draw Phase': {
            onDone: {
              target: 'Main Phase',
            },
            initial: 'Deck Count Check',
            states: {
              'Deck Count Check': {
                always: [
                  {
                    target: 'Deck Out',
                    cond: 'no cards remaining for active player',
                  },
                  {
                    target: 'Done',
                    actions: ['drawCardForActivePlayer'],
                  },
                ],
              },
              'Deck Out': {
                entry: ['markPlayerAsDeckOut', 'raiseDeckOutEvent'],
              },
              // TODO: draw phase effects/cards/etc.
              Done: {
                type: 'final',
              },
            },
          },
          'Main Phase': {
            type: 'parallel',
            entry: ['syncPlayerState', 'sendMainPhaseEvent'],
            states: {
              'Normal Enchant': {
                initial: 'Can Normal Enchant',
                states: {
                  'Can Normal Enchant': {
                    on: {
                      // TODO: actually implement
                      NORMAL_CAST_ELESTRAL: {
                        target: 'Cannot Normal Enchant',
                        cond: 'can normal enchant elestral',
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
                  'Cannot Normal Enchant': {
                    entry: ['syncPlayerState'],
                  },
                },
              },
              Actions: {
                initial: 'Idle',
                states: {
                  Idle: {
                    on: {
                      // SET_RUNE: {},
                      CAST_RUNE: {
                        target: 'Casting',
                        cond: 'can cast rune',
                        actions: ['addToField', 'syncPlayerState'],
                      },
                      // USE_CARD_ABILITY: {},
                      // CHANGE_ELESTRAL_POSITION: {},
                    },
                  },
                  Casting: {
                    invoke: {
                      id: 'processChain',
                      src: 'processChain',
                      data: (_c, _e) => ({}),
                      onDone: {
                        target: 'Idle',
                        actions: ['syncPlayerState'],
                      },
                    },
                  },
                },
              },
            },
            on: {
              END_TURN: {
                target: 'End Phase',
                cond: 'from active player',
              },
              // ATTACK: {
              //   cond: 'attack position elestral on current player field',
              //   target: 'Battle Phase',
              // },
            },
          },
          'Battle Phase': {
            // entry: ['syncPlayerState', 'sendBattlePhaseEvent'],
          },
          'End Phase': {
            entry: ['syncPlayerState', 'sendEndPhaseEvent'],
            // TODO: Run any cleanup, execute end phase effects, etc.
            always: 'Turn Complete',
          },
          'Turn Complete': {
            type: 'final',
          },
        },
      },
      'Game Round Over': {
        entry: ['syncPlayerState', 'sendGameRoundOverEvent'],
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
      setCurrentPlayerToDiceRollWinner: (c, e) => {
        c.gameState.setActivePlayer(e.data.winner)
      },
      setCurrentPlayerToStartingPlayer: (c, e) => {
        c.gameState.setActivePlayer(e.startingPlayer)
      },
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
          gameState: GameState.init(
            c.gameState.activePlayerId(),
            [...c.players.values()],
            {
              initialHandSize: INITIAL_HAND_SIZE,
            }
          ),
        }
      }),
      markPlayerAsReady: (c, e) => {
        c.gameState.stateFor(e.from).status.value = 'ready'
      },
      mulligan: (c, e) => {
        shuffleHandIntoDeck(c.gameState, e.from)
        expendSpirits(c.gameState, e.from, {
          spiritDeckIndicesToExpend: e.spiritDeckIndicesToExpend,
        })
        drawCards(c.gameState, e.from, { amount: INITIAL_HAND_SIZE })
      },
      sendGameRoundStartEvent: (c) => {
        sendToAllPlayers(c, {
          type: 'GAME_ROUND_START',
          data: undefined,
        })
      },
      markPlayerAsSpiritOut: (c, e) => {
        c.gameState.updatePlayerState(e.from, {
          status: {
            value: 'out',
            outReason: 'spirit out',
          },
        })
      },
      markPlayerAsDeckOut: (c, _e) => {
        const player = c.gameState.activePlayerId()

        c.gameState.updatePlayerState(player, {
          status: {
            value: 'out',
            outReason: 'deck out',
          },
        })
      },
      sendMainPhaseEvent: (c, _e) => {
        sendToAllPlayers(c, {
          type: 'MAIN_PHASE',
          data: undefined,
        })
      },
      addToField: assign((c, e) => {
        const firstAvailableIndex = c.gameState.field.findIndex((slot) => {
          return (
            slot.owner === e.from &&
            slot.type === 'rune' &&
            slot.contents === null
          )
        })!

        const playerState = c.gameState.stateFor(e.from)

        const card = playerState.hand[e.from.index]! as RuneCard

        const spirits = e.cost.map((cost) => {
          if (cost.zone === 'spirit deck') {
            return playerState.spiritDeck.splice(cost.index, 1)[0]!
          } else {
            return c.gameState.field[cost.slotIndex]!.contents!.spirits[
              cost.spiritIndex
            ]!
          }
        })

        c.gameState.field[firstAvailableIndex]!.contents = {
          owner: e.from,
          card: card,
          state: 'faceup' as const,
          playOrder: 1,
          spirits: spirits,
        }

        return {
          gameState: c.gameState,
        }
      }),
      // sendBattlePhaseEvent: (c, _e) => {
      //   sendToAllPlayers(c, {
      //     type: 'BATTLE_PHASE',
      //     data: undefined,
      //   })
      // },
      raiseDeckOutEvent: send({
        type: 'DECK_OUT',
      }),
      sendEndPhaseEvent: (c, _e) => {
        sendToAllPlayers(c, {
          type: 'END_PHASE',
          data: undefined,
        })
      },
      advanceActivePlayer: (c, _e) => {
        const players = [...c.players.values()]

        let nextPlayerIndex =
          players.findIndex((p) => p.id === c.gameState.activePlayerId()) + 1

        if (nextPlayerIndex >= players.length) {
          nextPlayerIndex = 0
        }

        while (
          c.gameState.stateFor(players[nextPlayerIndex]!.id).status.value !==
          'ready'
        ) {
          nextPlayerIndex++

          if (nextPlayerIndex >= players.length) {
            nextPlayerIndex = 0
          }
        }

        c.gameState.setActivePlayer(players[nextPlayerIndex]!.id)
      },
      sendNextPlayerTurnEvent: (c, _e) => {
        sendToAllPlayers(c, {
          type: 'NEXT_PLAYER_TURN',
          data: {
            nextActivePlayer: c.gameState.activePlayerId(),
          },
        })
      },
      drawCardForActivePlayer: (c, _e) => {
        drawCards(c.gameState, c.gameState.activePlayerId(), {
          amount: 1,
        })
      },
      syncPlayerState: (c) => {
        sendToAllPlayers(c, (playerId, gameState) => {
          return {
            type: 'SYNC_STATE',
            data: gameState.stateViewFor(playerId),
          }
        })
      },
      sendGameRoundOverEvent: (c) => {
        const winner = c.gameState
          .playerStates()
          .find(([_, player]) => player.status.value !== 'out')

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
      'from active player': (c, e) => {
        return fromActivePlayer(c, e)
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
        return c.gameState.stateFor(e.from).spiritDeck.length > 2
      },
      'all players ready': (c) => {
        return c.gameState
          .playerStates()
          .every(([_, player]) => player.status.value === 'ready')
      },
      'only one player left': (c) => {
        return (
          c.gameState
            .playerStates()
            .filter(([_, player]) => player.status.value !== 'out').length === 1
        )
      },
      'no cards remaining for active player': (c, _e) => {
        return (
          c.gameState.stateFor(c.gameState.activePlayerId()).mainDeck.length <=
          0
        )
      },
      'can cast rune': (c, e) => {
        // TODO: make it so any player can cast a counter rune
        if (!fromActivePlayer(c, e)) {
          console.error('Event not from active player')
          return false
        }

        const gameState = c.gameState
        const player = gameState.stateFor(e.from)

        let card = player.hand[e.from.index]

        if (card === undefined) {
          console.error("Tried to play a card that doesn't exist")
          return false
        }

        if (card.class !== 'rune') {
          console.error('Tried to play a non-rune card')
          return false
        }

        if (gameState.availableRuneSlotsFor(e.from) <= 0) {
          console.error('No available Rune slot')
          return false
        }

        return true
      },
      'can normal enchant elestral': (c, e) => {
        if (!fromActivePlayer(c, e)) {
          console.error('Event not from active player')
          return false
        }

        const player = c.gameState.stateFor(e.from)
        const card = player.hand[e.from.index]

        if (card === undefined) {
          console.error("Tried to play a card that doesn't exist")
          return false
        }

        if (card.class !== 'elestral') {
          console.error('Tried to play a non-elestral card')
          return false
        }

        if (c.gameState.availableElestralSlotsFor(e.from) > 0) {
          console.error('No avialable Elestral slot')
          return false
        }

        return true
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
      processChain: chainProcessorMachine,
      // normalEnchantElestral: async (c, e) => {
      //   const player = c.gameState.get(e.from)!
      //   const card = player.hand[e.cardIndex]

      //   if (card === undefined) {
      //     throw new Error('Invalid card index for current hand')
      //   }
      //   if (card.class !== 'elestral') {
      //     throw new Error(
      //       'Tried to normal enchant a non-Elestral to an Elestral slot'
      //     )
      //   }

      //   if (player.field.elestrals[e.elestralFieldIndex] !== null) {
      //     throw new Error('Already an elestral in that slot')
      //   }

      //   player.field.elestrals[e.elestralFieldIndex] = {
      //     card,
      //     position: e.position,
      //     spirits: player.spiritDeck.splice(e.spiritCardIndex, 1),
      //   }
      // },
    },
  }
)

export type GameServerActor = ActorRefFrom<typeof gameServerMachine>
export type GameServerService = InterpreterFrom<typeof gameServerMachine>

//////
// Guard Helpers (FIXME: Turn into real guards with xstate v5)
//////

function fromActivePlayer(
  c: GameServerContext,
  e: RecievedPlayerEventWithFrom
): boolean {
  return c.gameState.turnState.activePlayerId === e.from
}

export function newGameServerMachine(playerData: PlayerMeta) {
  const players = new Map<PlayerId, PlayerMetaWithStatus>()
  players.set(playerData.id, { ...playerData, status: 'connecting' })

  return interpret(
    gameServerMachine.withContext({
      players,
      // Will be properly set once the game starts
      gameState: new GameState('' as PlayerId, new Map(), []),
    })
  ).start()
}
