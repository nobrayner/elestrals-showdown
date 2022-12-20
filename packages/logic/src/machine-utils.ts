import type { SendEventFunction as SendEventFunctionBase } from '@elestrals-showdown/schemas'

import type { PlayerId, PlayerMetaWithStatus, DiceRollResult } from './types'
import type { Chain, ChainLink } from './chain'

import type { GameState, GameStateForPlayer } from './game-state'

export type GameStateEvent =
  | { type: 'PLAYER_CONNECTED'; data: { players: PlayerId[] } }
  | { type: 'ENOUGH_PLAYERS'; data: undefined }
  | {
    type: 'DICE_ROLL_RESULT'
    data: Pick<DiceRollResult, 'results'>
  }
  | { type: 'CHOOSE_STARTING_PLAYER'; data: undefined }
  | { type: 'GAME_ROUND_START'; data: undefined }
  | { type: 'SYNC_STATE'; data: GameStateForPlayer }
  | {
    type: 'CHAIN_UPDATE'
    data: {
      chain: Chain
      newLink: ChainLink
    }
  }
  | { type: 'MAIN_PHASE'; data: undefined }
  | { type: 'BATTLE_PHASE'; data: undefined }
  | { type: 'END_PHASE'; data: undefined }
  | { type: 'NEXT_PLAYER_TURN'; data: { nextActivePlayer: PlayerId } }
  | { type: 'GAME_ROUND_OVER'; data: { winner: PlayerId } }

export type SendEventFunction = SendEventFunctionBase<GameStateEvent>

export function sendToAllPlayers<
  Context extends {
    players: Map<PlayerId, PlayerMetaWithStatus>
    gameState: GameState
  }
>(
  context: Context,
  eventOrBuilder:
    | GameStateEvent
    | ((playerId: PlayerId, gameState: GameState) => GameStateEvent)
) {
  context.players.forEach((player) => {
    const event =
      typeof eventOrBuilder === 'function'
        ? eventOrBuilder(player.id, context.gameState)
        : eventOrBuilder

    player.send(event)
  })
}

export function sendToPlayer<
  Context extends {
    players: Map<PlayerId, PlayerMetaWithStatus>
  }
>(context: Context, player: PlayerId, event: GameStateEvent) {
  context.players.get(player)!.send(event)
}
