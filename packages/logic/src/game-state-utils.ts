import type { PlayerData } from './game-server.machine'

import type { GameState } from './types'

import { shuffleCards } from './deck-utils'

export function initGameState(
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
        underworld: [],
        runes: [null, null, null, null],
      },
    })

    return state
  }, new Map() as GameState)
}
