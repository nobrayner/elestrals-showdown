import type {
  PlayerId,
  GameStateForPlayer as GameState,
  GameStateEvent,
  RecievedPlayerEvent as SendToServerEvent,
} from '@elestrals-showdown/logic'

import type { ActorRefFrom, StateFrom } from 'xstate'

import type { CardCostSelectionResultEvent } from './selection.machine'

import { createMachine, assign } from 'xstate'

import {
  cardSelectionMachine,
  createCardCastSelectionInvokeDataFromCard,
} from './selection.machine'

export type SendToServer = (e: SendToServerEvent) => void

type GameRoundEvent =
  | { type: 'END_TURN' }
  | { type: 'CAST_RUNE_FROM_HAND'; index: number }
  | { type: 'CAST_SET_RUNE' }
  | GameStateEvent
  | CardCostSelectionResultEvent

type GameRoundContext = {
  sendToServer: SendToServer
  gameState: GameState
  playerId: PlayerId
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
    initial: 'Init',
    states: {
      Init: {
        always: [
          {
            target: 'My Turn.Main Phase',
            cond: 'active player is me and I start',
          },
          {
            target: 'My Turn.Draw Phase',
            cond: 'active player is me',
          },
          {
            target: 'Opponents Turn',
          },
        ],
      },
      'My Turn': {
        initial: 'Draw Phase',
        states: {
          'Draw Phase': {
            on: {
              MAIN_PHASE: {
                target: 'Main Phase',
              },
            },
          },
          'Main Phase': {
            on: {
              END_TURN: {
                actions: ['sendEndTurnEvent'],
              },
              BATTLE_PHASE: {
                target: 'Battle Phase',
              },
              END_PHASE: {
                target: 'End Phase',
              },
            },
            initial: 'Idle',
            states: {
              Idle: {
                on: {
                  CAST_RUNE_FROM_HAND: {
                    target: 'Choosing Rune Cast Spirits',
                  },
                },
              },
              'Choosing Rune Cast Spirits': {
                tags: ['cardSelection'],
                invoke: {
                  id: 'selectCards',
                  src: 'selectCards',
                  data: (
                    c,
                    e: Extract<GameRoundEvent, { type: 'CAST_RUNE_FROM_HAND' }>
                  ) => {
                    const card = c.gameState.hand[e.index]
                    return createCardCastSelectionInvokeDataFromCard({
                      card,
                      gameState: c.gameState,
                      playerId: c.playerId,
                      data: e,
                    })
                  },
                },
                on: {
                  SELECTION_CONFIRMED: {
                    target: 'Idle',
                    actions: ['sendCastRuneEvent'],
                  },
                  SELECTION_CANCELLED: {
                    target: 'Idle',
                  },
                },
              },
            },
          },
          'Battle Phase': {
            on: {
              END_TURN: {
                actions: ['sendEndTurnEvent'],
              },
              END_PHASE: {
                target: 'End Phase',
              },
            },
          },
          'End Phase': {},
        },
        on: {
          NEXT_PLAYER_TURN: {
            target: 'Opponents Turn',
          },
        },
      },
      'Opponents Turn': {
        initial: 'Draw Phase',
        states: {
          'Draw Phase': {
            on: {
              MAIN_PHASE: {
                target: 'Main Phase',
              },
            },
          },
          'Main Phase': {
            on: {
              BATTLE_PHASE: {
                target: 'Battle Phase',
              },
              END_PHASE: {
                target: 'End Phase',
              },
            },
          },
          'Battle Phase': {
            on: {
              END_PHASE: {
                target: 'End Phase',
              },
            },
          },
          'End Phase': {},
        },
        on: {
          NEXT_PLAYER_TURN: [
            {
              target: 'My Turn',
              cond: 'next player is me',
            },
            {
              target: 'Opponents Turn',
            },
          ],
        },
      },
    },
    on: {
      SYNC_STATE: {
        actions: ['updateGameState'],
      },
    },
  },
  {
    actions: {
      sendEndTurnEvent: (c, _e) => {
        c.sendToServer({
          type: 'END_TURN',
        })
      },
      sendCastRuneEvent: (c, e) => {
        c.sendToServer({
          type: 'CAST_RUNE',
          rune: {
            from: e.data.type === 'CAST_RUNE_FROM_HAND' ? 'hand' : 'set rune',
            index: e.data.index,
          },
          cost: e.selection.map((item) => item.item.source),
        })
      },
      updateGameState: assign((_c, e) => {
        return {
          gameState: e.data,
        }
      }),
    },
    guards: {
      'active player is me and I start': (c, _e) => {
        const turnState = c.gameState.turnState
        return (
          turnState.activePlayerId === c.playerId &&
          turnState.phase === 'Main Phase'
        )
      },
      'active player is me': (c, _e) => {
        return c.gameState.turnState.activePlayerId === c.playerId
      },
      'next player is me': (c, e) => {
        return e.data.nextActivePlayer === c.playerId
      },
    },
    services: {
      selectCards: cardSelectionMachine,
    },
  }
)

export type GameRoundActor = ActorRefFrom<typeof gameRoundMachine>
export type GameRoundState = StateFrom<typeof gameRoundMachine>
