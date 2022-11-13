import type { PlayerState } from './types'
import type { Card, SpiritCard } from '@elestrals-showdown/schemas'

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
  const { expendedSpirits, remainingSpirits } = player.spiritDeck.reduce(
    (acc, card, i) => {
      if (spiritDeckIndicesToExpend.includes(i)) {
        acc.expendedSpirits.push(card)
      } else {
        acc.remainingSpirits.push(card)
      }

      return acc
    },
    { expendedSpirits: [], remainingSpirits: [] } as {
      expendedSpirits: Card[]
      remainingSpirits: SpiritCard[]
    }
  )

  player.spiritDeck = remainingSpirits
  player.field.underworld.push(...expendedSpirits)

  return player
}
