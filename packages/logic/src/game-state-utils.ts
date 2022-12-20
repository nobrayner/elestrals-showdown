import type { Card, CardEffects } from '@elestrals-showdown/schemas'

import type { PlayerId } from './types'
import type { GameState, AnyFieldSlot } from './game-state'

const PLAYER_STATE_ZONE_MAP: Record<
  Extract<CardEffects.Zone['kind'], 'hand' | 'main deck' | 'spirit deck' | 'underworld'>,
  (gameState: GameState, player: PlayerId) => Card[]
> = {
  hand: (gameState, player) => gameState.stateFor(player).hand,
  "main deck": (gameState, player) => gameState.stateFor(player).mainDeck,
  "spirit deck": (gameState, player) => gameState.stateFor(player).spiritDeck,
  underworld: (gameState, player) => gameState.stateFor(player).underworld,
}

const FIELD_STATE_ZONE_MAP: Record<
  Extract<
    CardEffects.Zone['kind'],
    'field' | 'field.stadium' | 'field.elestral' | 'field.rune'
  >,
  (gameState: GameState, player: PlayerId, index: number) => AnyFieldSlot
> = {
  field: (gameState, player, index) =>
    gameState.fieldFor(player)
      .find((s) => s.index === index)!,
  "field.stadium": (gameState, player, index) =>
    gameState.fieldFor(player)
      .filter((s) => s.type === 'stadium' && s.index === index)[0]!,
  "field.elestral": (gameState, player, index) =>
    gameState.fieldFor(player)
      .filter((s) => s.type === 'elestral' && s.index === index)[0]!,
  "field.rune": (gameState, player, index) =>
    gameState.fieldFor(player)
      .filter((s) => s.type === 'rune' && s.index === index)[0]!,
}

export type RemoveFromZoneArgs = {
  zone: CardEffects.Zone['kind']
  index: number
}
export function removeFromZone(gameState: GameState, player: PlayerId, args: RemoveFromZoneArgs) {
  if (
    args.zone === 'hand' ||
    args.zone === 'underworld' ||
    args.zone === 'main deck' ||
    args.zone === 'spirit deck'
  ) {
    const cards = PLAYER_STATE_ZONE_MAP[args.zone](gameState, player)
    return cards.splice(args.index, 1)[0]
  } else {
    const field = FIELD_STATE_ZONE_MAP[args.zone](gameState, player, args.index)

    const card = field.contents?.card
    field.contents = null

    return card
  }
}

export type AddToFieldOptions = {
  from: {
    zone: 'hand'
    index: number
  }
  cost: (
    | {
      zone: 'field'
      type: AnyFieldSlot['type']
      slotIndex: number
      spiritIndex: number
    }
    | {
      zone: 'spirit deck'
      index: number
    }
  )[]
}
export function addToField(gameState: GameState, player: PlayerId, options: AddToFieldOptions) {

}


