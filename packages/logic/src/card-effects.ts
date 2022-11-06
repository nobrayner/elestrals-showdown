import type { PlayerState } from './types'

import { shuffleCards } from './deck-utils'

export function shuffleMainDeck(player: PlayerState): PlayerState {
  player.mainDeck = shuffleCards(player.mainDeck)

  return player
}

export function shuffleHandIntoDeck(player: PlayerState): PlayerState {
  player.mainDeck = player.mainDeck.concat(player.hand)
  player.hand = []

  shuffleMainDeck(player)

  return player
}

export function drawCards(player: PlayerState, { amount = 1 }): PlayerState {
  player.hand = player.hand.concat(player.mainDeck.splice(0, amount))

  return player
}

export function expendSpirits(
  player: PlayerState,
  { spiritDeckIndicesToExpend }: { spiritDeckIndicesToExpend: number[] }
): PlayerState {
  player.spiritDeck = player.spiritDeck.filter((_, i) => !spiritDeckIndicesToExpend.includes(i))

  return player
}
