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
  stadium: RuneSlot
  elestrals: [ElestralSlot, ElestralSlot, ElestralSlot, ElestralSlot]
  runes: [RuneSlot, RuneSlot, RuneSlot, RuneSlot]
  underworld: Card[]
}

type OutReason = 'deck out' | 'spirit out'
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
      outReason: OutReason
    }
  )

export type TurnPhase =
  | 'Draw Phase'
  | 'Main Phase'
  | 'Battle Phase'
  | 'End Phase'

export type TurnState = {
  activePlayerId: PlayerId
  phase: TurnPhase
}

export type PlayerStateSyncPayload = {
  status: PlayerState['status']
  outReason: OutReason | null
  turnState: TurnState
  mainDeckCount: number
  spiritDeck: SpiritCard[]
  hand: ElestralOrRuneCard[]
  field: PlayerField
  opponents: Record<
    PlayerId,
    {
      status: PlayerState['status']
      outReason: OutReason | null
      field: PlayerField
      handCount: number
      spiritCount: number
      mainDeckCount: number
    }
  >
}
