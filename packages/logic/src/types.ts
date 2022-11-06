import type {
  Card,
  ElestralCard,
  RuneCard,
  SpiritCard,
  ElestralOrRuneCard,
} from '@elestrals-showdown/schemas'

type ElestralSlot = {
  card: ElestralCard
  position: 'attack' | 'defence'
  spirits: SpiritCard[]
  // TODO: Attack and defence modifiers? Gonna be kinda difficult, actually :cry:
} | null
type RuneSlot = {
  card: RuneCard
  position: 'facedown' | 'active'
  spirits: SpiritCard[]
} | null

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
      status: 'connecting' | 'preparing' | 'ready'
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
