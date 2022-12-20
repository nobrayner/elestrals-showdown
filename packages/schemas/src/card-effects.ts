import type {
  ElestralCard,
  RuneCard,
  SpiritCard,
  CardSubclasses,
  Card,
} from './types'

export type Effect = {
  text: string
  effects: EffectNode[]
}

export type EffectNode = {
  inputs: Criteria[]
  body: MoveCards
}

export type MoveCards = {
  type: 'MoveCards'
  input: InputPlaceholder | CardInput
  to: Zone
}

export type Zone = {
  type: 'Zone'
  owner: Player
  kind:
  | 'hand'
  | 'main deck'
  | 'spirit deck'
  | 'underworld'
  | 'field'
  | 'field.stadium'
  | 'field.elestral'
  | 'field.rune'
}

export type Player = {
  type: 'Player'
  value: 'caster'
}

// Placeholder for when there are more criterium
// e.g. for choosing a player, or a FieldSlot
export type Criteria = CardCriteria

export type CardCriteria = {
  type: 'CardCriteria'
  zones: Zone[]
  variance: 'exactly' | 'up to'
  amount: number
} & (
    | ({ class: 'elestral' } & Partial<{
      subclasses: CardSubclasses['elestral'][]
      name: ElestralCard['name']
      cost: ElestralCard['cost']
    }>)
    | ({ class: 'rune' } & Partial<{
      subclasses: CardSubclasses['rune']
      name: RuneCard['name']
    }>)
    | ({ class: 'spirit' } & Partial<{
      element: SpiritCard['element']
    }>)
    | {
      class: 'any'
    }
  )

export type InputPlaceholder = {
  type: 'InputPlaceholder'
  index: number
}

export type CardInput = {
  type: 'CardInput'
  cards: Card[]
}

export type EffectInput = CardInput
