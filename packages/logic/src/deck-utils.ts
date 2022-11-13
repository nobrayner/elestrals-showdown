import type {
  Card,
  DeckList,
  Deck,
  ElestralOrRuneCard,
  SpiritCard,
} from '@elestrals-showdown/schemas'

import BaseSetCardList from '@elestrals-showdown/card-data/cards/en/base.json'
import { Result, ok, err } from 'neverthrow'

type DeckFromDeckListErrorCode = 'INVALID_CARD'
class DeckFromDeckListError extends Error {
  constructor(code: DeckFromDeckListErrorCode, message: string) {
    super(`${code}: ${message}`)
  }
}

export function deckFromDeckList(
  deckList: DeckList
): Result<Deck, DeckFromDeckListError[]> {
  return Result.combineWithAllErrors([
    cardDataFromCardList(deckList.main),
    cardDataFromCardList(deckList.spirit),
    cardDataFromCardList(deckList.sideboard),
  ]).map<Deck>((cardsDataArrays) => {
    return {
      main: cardsDataArrays[0]! as ElestralOrRuneCard[],
      spirit: cardsDataArrays[1]! as SpiritCard[],
      sideboard: cardsDataArrays[2]!,
    }
  })
}

export function cardDataFromCardList(
  list: Record<string, number>
): Result<Card[], DeckFromDeckListError> {
  const cards: Card[] = []

  for (const cardId in list) {
    const cardData = BaseSetCardList.find((card) => card.id === cardId)

    if (!cardData) {
      return err(new DeckFromDeckListError('INVALID_CARD', cardId))
    }

    // TODO: Limit decks to only 3 of a card
    cards.push(...new Array(list[cardId]).fill(cardData))
  }

  return ok(cards)
}

/**
 * Shuffles an array of cards using the Fisher-Yates algorithm
 */
export function shuffleCards<T extends Card>(cards: T[]) {
  // clone array
  const shuffledCards = Array.from(cards)
  let i = shuffledCards.length

  while (--i > 0) {
    const randomIndex = Math.floor(Math.random() * (i + 1))
    let randomCard = shuffledCards[randomIndex]!

    // Set the randomIndex to the current card
    shuffledCards[randomIndex] = shuffledCards[i]!
    shuffledCards[i] = randomCard
  }

  return shuffledCards
}
