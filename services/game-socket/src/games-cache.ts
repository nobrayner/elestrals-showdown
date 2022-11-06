import type { GameServerService, PlayerData } from '@elestrals-showdown/logic'

import { Result, ok, err } from 'neverthrow'

import { newGameServerMachine } from '@elestrals-showdown/logic'

const GAMES: Map<string, GameServerService> = new Map()

type StartGameError = 'GAME_IS_FULL'
export function startGameOrConnect(
  roomId: string,
  playerData: PlayerData
): Result<GameServerService, StartGameError> {
  if (!GAMES.has(roomId)) {
    const gameMachine = newGameServerMachine(playerData)
    gameMachine.subscribe((state) => {
      console.log(`[${roomId}]`, state.value)
      console.log(`[${roomId}]`, state.context)
    })

    gameMachine.onStop(() => {
      GAMES.delete(roomId)
    })

    GAMES.set(roomId, gameMachine)

    return ok(gameMachine)
  }

  const gameMachine = GAMES.get(roomId)

  if (gameMachine?.getSnapshot()?.matches('Waiting for Players')) {
    gameMachine.send({
      type: 'PLAYER_CONNECTING',
      playerData,
    })
    return ok(gameMachine)
  }

  return err('GAME_IS_FULL')
}
