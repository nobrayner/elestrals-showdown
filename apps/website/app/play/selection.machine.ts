import type {
  GameStateForPlayer as GameState,
  AnyFieldSlot,
  PlayerId,
} from '@elestrals-showdown/logic'
import type { Card, ElestralOrRuneCard } from '@elestrals-showdown/schemas'

import { createMachine, assign, sendParent, ActorRefFrom } from 'xstate'

export const cardSelectionMachine = createSelectionMachine<Card>()

export type CardSelectionActor = SelectionActor<Card>
export type CardSelectionResultEvent = SelectionResultEvent<Card>

export function createCardSelectionInvokeData({
  amount,
  cards,
  data,
}: {
  amount: number
  cards: Readonly<Card>[]
  data?: any
}): SelectionContext<Card> {
  return {
    amount,
    items: cards.map((item, index) => ({ item, index })),
    selection: [],
    data,
  }
}

type CardCost = {
  card: Card
  source:
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
}
export type CardCostSelectionActor = SelectionActor<CardCost>
export type CardCostSelectionResultEvent = SelectionResultEvent<CardCost>

export function createCardCastSelectionInvokeDataFromCard({
  card,
  gameState,
  playerId,
  data,
}: {
  card: ElestralOrRuneCard
  gameState: GameState
  playerId: PlayerId
  data?: any
}): SelectionContext<CardCost> {
  let cards: CardCost[] = gameState.spiritDeck.map<CardCost>((card, index) => ({
    card,
    source: {
      zone: 'spirit deck',
      index: index,
    },
  }))

  if (
    card.class === 'rune' &&
    // I.e. instant runes
    (card.subclasses.includes('invoke') || card.subclasses.includes('counter'))
  ) {
    cards = cards.concat(
      gameState.field
        .filter((slot) => {
          if (slot.owner !== playerId) {
            return false
          }

          if (slot.contents === null) {
            return false
          }

          if (slot.type === 'rune') {
            if (
              // Can't take spirits from a set card
              slot.contents.state === 'set' ||
              // Can't take spirits from an "instant" rune
              slot.contents.card.subclasses.includes('invoke') ||
              slot.contents.card.subclasses.includes('counter')
            ) {
              return false
            }
          }

          return true
        })
        .flatMap((slot) => {
          return slot.contents!.spirits.map<CardCost>((card, spiritIndex) => ({
            card,
            source: {
              zone: 'field',
              type: slot.type,
              slotIndex: slot.index,
              spiritIndex,
            },
          }))
        })
    )
  }

  return {
    amount: card.cost.length,
    items: cards.map((item, index) => ({ item, index })),
    selection: [],
    data,
  }
}

//--- --- ---//
//  HELPERS  //
//--- --- ---//

export type SelectionActor<T> = ActorRefFrom<
  ReturnType<typeof createSelectionMachine<T>>
>

type SelectionEvent =
  | { type: 'SELECT'; index: number }
  | { type: 'DESELECT'; index: number }
  | { type: 'CANCEL' }
  | { type: 'CONFIRM' }

type SelectionResultEvent<T> =
  | { type: 'SELECTION_CONFIRMED'; selection: SelectionItem<T>[]; data?: any }
  | { type: 'SELECTION_CANCELLED'; data?: any }

type SelectionItem<T> = {
  item: T
  index: number
}

type SelectionContext<T> = {
  data?: any
  amount: number
  items: SelectionItem<T>[]
  selection: SelectionItem<T>[]
}

function createSelectionMachine<T>() {
  return createMachine(
    {
      id: 'Selection Machine',
      predictableActionArguments: true,
      tsTypes: {} as import('./selection.machine.typegen').Typegen0,
      schema: {
        context: {} as SelectionContext<T>,
        events: {} as SelectionEvent,
      },
      // Actual Machine
      initial: 'Idle',
      states: {
        Idle: {
          on: {
            SELECT: {
              cond: 'has remaining selection slots',
              actions: ['addSelection'],
            },
            DESELECT: {
              actions: ['removeSelection'],
            },
            CONFIRM: {
              target: 'Confirmed',
              cond: 'has required selection amount',
            },
            CANCEL: {
              target: 'Cancelled',
            },
          },
        },
        Confirmed: {
          type: 'final',
          entry: ['sendConfirmation'],
        },
        Cancelled: {
          type: 'final',
          entry: ['sendCancellation'],
        },
      },
    },
    {
      actions: {
        addSelection: assign((c, e) => {
          const selectedCard = c.items.splice(e.index, 1)[0]
          return {
            items: c.items,
            selection: [...c.selection, selectedCard],
          }
        }),
        removeSelection: assign((c, e) => {
          const deselectedCard = c.selection.splice(e.index, 1)[0]
          c.items.splice(deselectedCard.index, 0, deselectedCard)

          return {
            items: c.items,
            selection: c.selection,
          }
        }),
        sendConfirmation: sendParent((c) => {
          return {
            type: 'SELECTION_CONFIRMED',
            selection: c.selection,
            data: c.data,
          } as SelectionResultEvent<T>
        }),
        sendCancellation: sendParent((c) => {
          return {
            type: 'SELECTION_CANCELLED',
            data: c.data,
          } as SelectionResultEvent<T>
        }),
      },
      guards: {
        'has remaining selection slots': (c) => {
          return c.selection.length < c.amount
        },
        'has required selection amount': (c) => {
          return c.selection.length === c.amount
        },
      },
    }
  )
}
