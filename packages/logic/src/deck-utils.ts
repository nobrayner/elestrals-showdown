import type { Card, DeckList, Deck } from '@elestrals-showdown/types'

import PrototypeCardList from '@elestrals-showdown/card-data/cards/en/proto.json'
import { Result, ok, err } from 'neverthrow'

type DeckFromDeckListErrorCode =
  | 'INVALID_CARD'
class DeckFromDeckListError extends Error {
  constructor(code: DeckFromDeckListErrorCode, message: string) {
    super(`${code}: ${message}`)
  }
}

export function deckFromDeckList(deckList: DeckList): Result<Deck, DeckFromDeckListError[]> {
  return Result.combineWithAllErrors([
    cardDataFromCardList(deckList.main),
    cardDataFromCardList(deckList.spirit),
    cardDataFromCardList(deckList.sideboard),
  ]).map<Deck>((cardsDataArrays) => {
    return {
      main: cardsDataArrays[0]!,
      spirit: cardsDataArrays[1]!,
      sideboard: cardsDataArrays[2]!,
    }
  })
}

export function cardDataFromCardList(list: Record<string, number>): Result<Card[], DeckFromDeckListError> {
  const cards: Card[] = []

  for (const cardId in list) {
    const cardData = PrototypeCardList.find((card) => card.id === cardId)

    if (!cardData) {
      return err(new DeckFromDeckListError('INVALID_CARD', cardId))
    }

    cards.push(...new Array(list[cardId]).fill(cardData))
  }

  return ok(cards)
}

/**
  * Shuffles an array of cards using the Fisher-Yates algorithm
  */
export function shuffleCards(cards: Card[]) {
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