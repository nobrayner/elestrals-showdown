// import type { SendEventFunction } from './types'
import type {
  GameServerService,
  PlayerData,
} from '@elestrals-showdown/machines'
// import type { Deck } from '@elestrals-showdown/types'

import { Result, ok, err } from 'neverthrow'

import { newGameServerMachine } from '@elestrals-showdown/machines'

const GAMES: Map<string, GameServerService> = new Map()

type StartGameError = 'GAME_IS_FULL'
export function startGameOrConnect(
  roomId: string,
  playerData: Pick<PlayerData, 'send' | 'deck'>
): Result<[GameServerService, 'player1' | 'player2'], StartGameError> {
  if (!GAMES.has(roomId)) {
    const playerKey = 'player1'
    const gameMachine = newGameServerMachine({ ...playerData, id: playerKey })
    gameMachine.subscribe((state) => {
      console.log(`[${roomId}]`, state.value)
      console.log(`[${roomId}]`, state.context)
    })

    gameMachine.onStop(() => {
      GAMES.delete(roomId)
    })

    GAMES.set(roomId, gameMachine)

    return ok([gameMachine, playerKey])
  }

  const playerKey = 'player2'
  const gameMachine = GAMES.get(roomId)

  if (gameMachine?.getSnapshot()?.matches('Waiting for Player 2')) {
    gameMachine.send({
      type: 'PLAYER_2_CONNECTED',
      playerData: { ...playerData, id: playerKey },
    })
    return ok([gameMachine, playerKey])
  }

  return err('GAME_IS_FULL')
}
