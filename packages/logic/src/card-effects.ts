import type { Card, SpiritCard } from '@elestrals-showdown/schemas'

import type { PlayerId } from './types'
import type { GameState } from './game-state'

import { shuffleCards } from './deck-utils'

export function shuffleMainDeck(gameState: GameState, player: PlayerId) {
  const playerState = gameState.stateFor(player)
  playerState.mainDeck = shuffleCards(playerState.mainDeck)
}

export function shuffleHandIntoDeck(gameState: GameState, player: PlayerId) {
  const playerState = gameState.stateFor(player)
  playerState.mainDeck = playerState.mainDeck.concat(playerState.hand)
  playerState.hand = []

  shuffleMainDeck(gameState, player)
}

export function drawCards(
  gameState: GameState,
  player: PlayerId,
  { amount = 1 }
) {
  const playerState = gameState.stateFor(player)
  playerState.hand = playerState.hand.concat(
    playerState.mainDeck.splice(0, amount)
  )
}

export function expendSpirits(
  gameState: GameState,
  player: PlayerId,
  { spiritDeckIndicesToExpend }: { spiritDeckIndicesToExpend: number[] }
) {
  const playerState = gameState.stateFor(player)
  const { expendedSpirits, remainingSpirits } = playerState.spiritDeck.reduce(
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

  playerState.spiritDeck = remainingSpirits
  playerState.underworld.push(...expendedSpirits)
}
