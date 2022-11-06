import type { Card } from '@elestrals-showdown/schemas'
import type { SelectionActor } from 'app/play/selection.machine'

import { useActor } from '@xstate/react'

type CardSelectorProps = {
  selectionActor: SelectionActor
  title?: React.ReactNode
  renderCard?: (
    card: Card,
    index: number,
    onClick: React.MouseEventHandler
  ) => React.ReactNode
}

export function CardSelector({
  selectionActor,
  title,
  renderCard = defaultCardRender,
}: CardSelectorProps) {
  const [state, send] = useActor(selectionActor)

  return (
    <div>
      <button onClick={() => send({ type: 'CANCEL' })}>Cancel</button>
      <button
        onClick={() => send({ type: 'CONFIRM' })}
        disabled={!state.can('CONFIRM')}
      >
        Confirm
      </button>
      <p>
        {title} (select {state.context.amount}):
      </p>
      <div>
        {state.context.selection.map((selectionCard, index) => {
          return renderCard(selectionCard.card, selectionCard.index, () =>
            send({ type: 'DESELECT', index })
          )
        })}
      </div>
      <br />
      <div>
        {state.context.cards.map((selectionCard, index) => {
          return renderCard(selectionCard.card, selectionCard.index, () =>
            send({ type: 'SELECT', index })
          )
        })}
      </div>
    </div>
  )
}

function defaultCardRender(
  c: Card,
  i: number,
  onClick: React.MouseEventHandler
) {
  return (
    <button key={`${c.id}-${i}`} id={`${c.id}-${i}`} onClick={onClick}>
      {c.name}
    </button>
  )
}
