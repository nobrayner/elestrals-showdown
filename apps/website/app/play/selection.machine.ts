import type { Card } from '@elestrals-showdown/schemas'

import { createMachine, assign, sendParent, ActorRefFrom } from 'xstate'

export function createSelectionInvokeData({
  amount,
  cards,
}: {
  amount: number
  cards: Readonly<Card>[]
}): SelectionContext {
  return {
    amount,
    cards: cards.map((card, index) => ({ card, index })),
    selection: [],
  }
}

export type SelectionResultEvent =
  | { type: 'SELECTION_CONFIRMED'; selection: number[] }
  | { type: 'SELECTION_CANCELLED' }

type SelectionEvent =
  | { type: 'SELECT'; index: number }
  | { type: 'DESELECT'; index: number }
  | { type: 'CANCEL' }
  | { type: 'CONFIRM' }

type SelectionCard = {
  card: Card
  index: number
}

type SelectionContext = {
  amount: number
  cards: SelectionCard[]
  selection: SelectionCard[]
}

export const selectionMachine = createMachine(
  {
    id: 'Selection Machine',
    predictableActionArguments: true,
    tsTypes: {} as import('./selection.machine.typegen').Typegen0,
    schema: {
      context: {} as SelectionContext,
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
        const selectedCard = c.cards.splice(e.index, 1)[0]
        return {
          cards: c.cards,
          selection: [...c.selection, selectedCard],
        }
      }),
      removeSelection: assign((c, e) => {
        const deselectedCard = c.selection.splice(e.index, 1)[0]
        c.cards.splice(deselectedCard.index, 0, deselectedCard)

        return {
          cards: c.cards,
          selection: c.selection,
        }
      }),
      sendConfirmation: sendParent((c) => {
        return {
          type: 'SELECTION_CONFIRMED',
          selection: c.selection.map((c) => c.index),
        } as SelectionResultEvent
      }),
      sendCancellation: sendParent({
        type: 'SELECTION_CANCELLED',
      } as SelectionResultEvent),
    },
    guards: {
      'has remaining selection slots': (c) => {
        console.log(c.selection)
        return c.selection.length < c.amount
      },
      'has required selection amount': (c) => {
        return c.selection.length === c.amount
      },
    },
  }
)

export type SelectionActor = ActorRefFrom<typeof selectionMachine>
