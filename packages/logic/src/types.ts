import type {
  Card,
  ElestralCard,
  ElestralOrRuneCard,
  RuneCard,
  SpiritCard,
} from '@elestrals-showdown/schemas'

type ElestralSlot = ElestralCard | null
type RuneSlot = RuneCard | null

export type PlayerId = string & { __type: 'playerid' }

export type PlayerField = {
  elestrals: [ElestralSlot, ElestralSlot, ElestralSlot, ElestralSlot]
  runes: [RuneSlot, RuneSlot, RuneSlot, RuneSlot]
  stadium: RuneSlot
  underworld: Card[]
}

export type PlayerState = {
  mainDeck: ElestralOrRuneCard[]
  spiritDeck: SpiritCard[]
  hand: ElestralOrRuneCard[]
  field: PlayerField
} & (
    | {
      status: 'preparing' | 'ready'
    }
    | {
      status: 'out'
      outReason: 'deck out' | 'spirit out'
    }
  )

export type PlayerStateSyncPayload = {
  mainDeckCount: number
  spiritDeck: SpiritCard[]
  hand: ElestralOrRuneCard[]
  field: PlayerField
  opponents: Record<
    PlayerId,
    {
      field: PlayerField
      handCount: number
      spiritCount: number
    }
  >
}

export type GameState = Map<PlayerId, PlayerState>
