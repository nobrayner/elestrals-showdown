import type {
  Card,
  ElestralCard,
  ElestralOrRuneCard,
  RuneCard,
  SpiritCard,
} from '@elestrals-showdown/schemas'

import type { PlayerId, PlayerMeta, TurnPhase, OutReason } from './types'

import { shuffleCards } from './deck-utils'

type TurnState = {
  activePlayerId: PlayerId
  phase: TurnPhase
}

type Hand = ElestralOrRuneCard[]

type MainDeck = ElestralOrRuneCard[]

type SpiritDeck = SpiritCard[]

type Underworld = Card[]

type PlayerStatus =
  | {
    value: 'connecting' | 'preparing' | 'ready'
  }
  | {
    value: 'out'
    outReason: OutReason
  }

type PlayerState = {
  status: PlayerStatus
  hand: Hand
  spiritDeck: SpiritDeck
  mainDeck: MainDeck
  underworld: Underworld
}

type OpponentData = Record<
  PlayerId,
  {
    status: PlayerStatus
    handCount: number
    spiritCount: number
    mainDeckCount: number
    underworld: Underworld
  }
>

export type GameStateForPlayer = {
  status: PlayerStatus
  turnState: TurnState
  hand: ElestralOrRuneCard[]
  spiritDeck: SpiritCard[]
  mainDeckCount: number
  underworld: Underworld
  field: Field
  opponents: OpponentData
}

type FieldSlot<T extends string, C extends Card, Data> = {
  type: T
  owner: PlayerId
  index: number
  contents:
  | ({
    owner: PlayerId
    card: C
    spirits: SpiritCard[]
    playOrder: number
  } & Data)
  | null
}

export type ElestralFieldSlot = FieldSlot<
  'elestral',
  ElestralCard,
  {
    attackModifiers: any[]
    defenseModifiers: any[]
  }
>

export type RuneFieldSlot = FieldSlot<
  'rune',
  RuneCard,
  {
    state: 'set' | 'faceup'
  }
>

export type StadiumFieldSlot = FieldSlot<'stadium', RuneCard, {}>

export type AnyFieldSlot = ElestralFieldSlot | RuneFieldSlot | StadiumFieldSlot

type Field = Array<AnyFieldSlot>

export class GameState {
  static init(
    activePlayerId: PlayerId,
    playerMeta: PlayerMeta[],
    options: {
      initialHandSize?: number
      elestralSlotCount?: number
      runeSlotCount?: number
      stadiumSlotCount?: number
    } = {}
  ): GameState {
    const {
      initialHandSize = 5,
      elestralSlotCount = 4,
      runeSlotCount = 4,
      stadiumSlotCount = 1,
    } = options

    const [playerState, field] = playerMeta.reduce(
      (acc, { id, deck }) => {
        const shuffledMainDeck = shuffleCards(deck.main)

        const states = acc[0]
        const field = acc[1]

        states.set(id, {
          status: {
            value: 'preparing',
          },
          mainDeck: shuffledMainDeck,
          spiritDeck: deck.spirit,
          hand: shuffledMainDeck.splice(0, initialHandSize),
          underworld: [],
        })

        for (let i = 0; i < runeSlotCount; ++i) {
          field.splice(-0, 0, {
            type: 'rune',
            owner: id,
            index: i,
            contents: null,
          })
        }
        for (let i = 0; i < elestralSlotCount; ++i) {
          field.splice(-0, 0, {
            type: 'elestral',
            owner: id,
            index: i,
            contents: null,
          })
        }
        for (let i = 0; i < stadiumSlotCount; ++i) {
          field.splice(-0, 0, {
            type: 'stadium',
            owner: id,
            index: i,
            contents: null,
          })
        }

        return acc
      },
      [new Map<PlayerId, PlayerState>(), [] as Field]
    )

    return new GameState(activePlayerId, playerState, field)
  }

  private _turnState: TurnState
  private _field: Field
  private _playerStates: Map<PlayerId, PlayerState>

  constructor(
    activePlayerId: PlayerId,
    playerStates: Map<PlayerId, PlayerState>,
    field: Field
  ) {
    this._turnState = {
      activePlayerId,
      phase: 'Main Phase',
    }
    this._field = field
    this._playerStates = playerStates
  }

  get turnState(): TurnState {
    return this._turnState
  }

  get field(): Field {
    return this._field
  }

  playerStates(): [PlayerId, PlayerState][] {
    return [...this._playerStates.entries()]
  }

  setActivePlayer(playerId: PlayerId) {
    this._turnState.activePlayerId = playerId
  }

  setTurnPhase(phase: TurnPhase) {
    this._turnState.phase = phase
  }

  updatePlayerState(player: PlayerId, playerStateUpdate: Partial<PlayerState>) {
    this._playerStates.set(player, {
      ...this.stateFor(player),
      ...playerStateUpdate,
    })
  }

  activePlayerState(): PlayerState {
    return this._playerStates.get(this._turnState.activePlayerId)!
  }

  activePlayerId(): PlayerId {
    return this._turnState.activePlayerId
  }

  fieldFor(player: PlayerId): Field {
    return this._field.filter((slot) => slot.owner === player)
  }

  availableElestralSlotsFor(player: PlayerId): number {
    return this._field.filter((slot) => {
      return (
        slot.owner === player &&
        slot.type === 'elestral' &&
        slot.contents === null
      )
    }).length
  }

  availableRuneSlotsFor(player: PlayerId): number {
    return this._field.filter((slot) => {
      return (
        slot.owner === player && slot.type === 'rune' && slot.contents === null
      )
    }).length
  }

  stateFor(player: PlayerId): PlayerState {
    return this._playerStates.get(player)!
  }

  stateViewFor(player: PlayerId): GameStateForPlayer {
    const playerState = this._playerStates.get(player)!

    const opponents: OpponentData = {}

    this._playerStates.forEach((opponentData, opponent) => {
      if (player === opponent) {
        // We don't include the player in the opponent list!
        return
      }

      opponents[opponent] = {
        status: opponentData.status,
        handCount: opponentData.hand.length,
        spiritCount: opponentData.spiritDeck.length,
        mainDeckCount: opponentData.mainDeck.length,
        underworld: opponentData.underworld,
      }
    })

    return {
      status: playerState.status,
      turnState: this._turnState,
      hand: playerState.hand,
      spiritDeck: playerState.spiritDeck,
      mainDeckCount: playerState.mainDeck.length,
      underworld: playerState.underworld,
      field: this._field,
      opponents,
    }
  }
}
