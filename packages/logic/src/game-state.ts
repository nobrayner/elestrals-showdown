import type { PlayerId, PlayerState, TurnState, TurnPhase } from './types'
import type { PlayerData } from './game-server.machine'

import { shuffleCards } from './deck-utils'

export class GameState extends Map<PlayerId, PlayerState> {
  private _turnState: TurnState

  constructor(activePlayerId: PlayerId) {
    super()
    this._turnState = {
      activePlayerId,
      phase: 'Main Phase',
    }
  }

  get turnState(): TurnState {
    return this._turnState
  }

  setActivePlayer(playerId: PlayerId) {
    this._turnState.activePlayerId = playerId
  }

  setTurnPhase(phase: TurnPhase) {
    this._turnState.phase = phase
  }

  get activePlayerState() {
    return this.get(this._turnState.activePlayerId)!
  }
}

export function initGameState(
  activePlayerId: PlayerId,
  playerDecks: PlayerData[],
  initialHandSize: number
): GameState {
  return playerDecks.reduce((state, { id, deck }) => {
    const shuffledMainDeck = shuffleCards(deck.main)

    state.set(id, {
      status: 'preparing',
      mainDeck: shuffledMainDeck,
      spiritDeck: deck.spirit,
      hand: shuffledMainDeck.splice(0, initialHandSize),
      field: {
        stadium: null,
        elestrals: [null, null, null, null],
        runes: [null, null, null, null],
        underworld: [],
      },
    })

    return state
  }, new GameState(activePlayerId))
}
