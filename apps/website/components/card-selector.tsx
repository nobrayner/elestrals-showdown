import type { SelectionActor } from 'app/play/selection.machine'

import { useActor } from '@xstate/react'

type SelectorProps<T> = {
  selectionActor: SelectionActor<T>
  renderItem: (
    item: T,
    index: number,
    onClick: React.MouseEventHandler
  ) => React.ReactNode
  title?: React.ReactNode
}

export function Selector<T>({
  selectionActor,
  title,
  renderItem,
}: SelectorProps<T>) {
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
          return renderItem(selectionCard.item, selectionCard.index, () =>
            send({ type: 'DESELECT', index })
          )
        })}
      </div>
      <br />
      <div>
        {state.context.items.map((selectionCard, index) => {
          return renderItem(selectionCard.item, selectionCard.index, () =>
            send({ type: 'SELECT', index })
          )
        })}
      </div>
    </div>
  )
}
