import type { Effect } from './card-effects'

export type Element =
  | 'rainbow' // Equivalent to colorless energy in Pokemon TCG
  | 'earth'
  | 'water'
  | 'thunder'
  | 'fire'
  | 'wind'

export type ElestralSubclass =
  | 'aquatic'
  | 'archaic'
  | 'avian'
  | 'behemoth'
  | 'brute'
  | 'dragon'
  | 'dryad'
  | 'eldritch'
  | 'ethereal'
  | 'golem'
  | 'insectoid'
  | 'oceanic'

export type RuneSubclass =
  | 'divine'
  | 'invoke'
  | 'counter'
  | 'artifact'
  | 'stadium'

export type Rarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'holo_rare'
  | 'full_art'
  | 'alt_art'

export type CardSubclasses = {
  spirit: ElestralSubclass
  elestral: ElestralSubclass
  rune: RuneSubclass
}
export type CardClass = keyof CardSubclasses

type CardBase<T extends CardClass> = {
  id: string
  name: string
  images: {
    default: string
  }
  class: T
  subclasses: CardSubclasses[T]
  rarity: Rarity
  artist: string
}

export type SpiritCard = CardBase<'spirit'> & {
  element: Element
}

export type ElestralCard = CardBase<'elestral'> & {
  cost: Element[]
  attack: number
  defense: number
  effect: Effect
}

export type RuneCard = CardBase<'rune'> & {
  cost: Element[]
  effect: Effect
}

export type ElestralOrRuneCard = ElestralCard | RuneCard
export type Card = SpiritCard | ElestralCard | RuneCard

// This needs to be inferred from a zod schema, so we can validate
export type DeckList = {
  main: {
    [cardId: string]: 1 | 2 | 3
  }
  spirit: {
    [cardId: string]: number
  }
  sideboard: {
    [cardId: string]: number
  }
}

export type Deck = {
  main: ElestralOrRuneCard[]
  spirit: SpiritCard[]
  sideboard: Card[]
}
