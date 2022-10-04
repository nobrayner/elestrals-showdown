import type {
  Card,
  Deck,
  ElestralCard,
  RuneCard,
} from '@elestrals-showdown/types'

export type DiceRollResult = {
  roll: number
}

type ElestralSlot = ElestralCard | null
type RuneSlot = RuneCard | null

type PlayerField = {
  elestrals: [ElestralSlot, ElestralSlot, ElestralSlot, ElestralSlot]
  runes: [RuneSlot, RuneSlot, RuneSlot, RuneSlot]
  stadium: RuneSlot
  underworld: Card[]
}

export type PlayerState = {
  deck: Deck
  hand: Card[]
  field: PlayerField
}

export type PlayerStateSyncPayload = {
  deck: Pick<Deck, 'main' | 'spirit'>
  hand: Card[]
  field: PlayerField
  opponent: {
    field: PlayerField
    handCount: number
    spiritCount: number
  }
}
