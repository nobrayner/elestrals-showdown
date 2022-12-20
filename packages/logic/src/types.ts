import type { Deck, SendEventFunction } from '@elestrals-showdown/schemas'

export type DiceRollResult = {
  results: Record<PlayerId, number>
  winner: PlayerId
}

export type PlayerId = string & { __type: 'playerid' }

export type ElestralPosition = 'attack' | 'defence'

export type RunePosition = 'set' | 'active'

export type OutReason = 'deck out' | 'spirit out'

export type TurnPhase =
  | 'Draw Phase'
  | 'Main Phase'
  | 'Battle Phase'
  | 'End Phase'

export type PlayerMeta = {
  id: PlayerId
  send: SendEventFunction<any>
  deck: Deck
}

export type PlayerMetaWithStatus = PlayerMeta & {
  status: 'connecting' | 'connected' | 'disconnected'
}
