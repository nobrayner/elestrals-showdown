import type { SendEventFunction } from './types'
import type { GameServerService } from '@elestrals-showdown/machines'

import { Result, ok, err } from 'neverthrow'

import { newGameServerMachine } from '@elestrals-showdown/machines'

const GAMES: Map<string, GameServerService> = new Map()

type StartGameError = 'GAME_IS_FULL'
export function startGameOrConnect(roomId: string, send: SendEventFunction): Result<[GameServerService, 'player1' | 'player2'], StartGameError> {
  if (!GAMES.has(roomId)) {
    const gameMachine = newGameServerMachine(send)

    gameMachine.onStop(() => {
      GAMES.delete(roomId)
    })

    GAMES.set(roomId, gameMachine)

    return ok([gameMachine, 'player1'])
  }
    const gameMachine = GAMES.get(roomId)

    if (gameMachine?.getSnapshot()?.matches('Waiting for Player 2')) {
      gameMachine.send({ type: 'PLAYER_2_CONNECTED', send })
      return ok([gameMachine, 'player2'])
    }

  return err('GAME_IS_FULL')
}

