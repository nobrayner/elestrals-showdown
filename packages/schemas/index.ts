export type SendEventFunction<T extends { type: string; data: any }> = (data: T) => void

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


export type Class = {
  'spirit': ElestralSubclass
  'elestral': ElestralSubclass
  'rune': RuneSubclass
}
export type CardClass = {
  [K in keyof Class]: K
}[keyof Class]

export type CardEffect = {
  text: string
}

type CardBase<T extends keyof Class> = {
  id: string
  name: string
  images: {
    default: string
  }
  class: T
  subclasses: Class[T]
}

export type SpiritCard = CardBase<'spirit'> & {
  element: Element
}

export type ElestralCard = CardBase<'elestral'> & {
  cost: Element[]
  attack: number
  defense: number
  effect: CardEffect
}

export type RuneCard = CardBase<'rune'> & {
  cost: Element[]
  effect: CardEffect
}

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

export type Deck = Readonly<{
  main: Card[]
  spirit: Card[]
  sideboard: Card[]
}>
