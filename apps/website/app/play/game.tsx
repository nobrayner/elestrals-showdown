'use client'

import type { PlayerId } from '@elestrals-showdown/logic'

import type { GameRoundActor, GameRoundState } from './game-round.machine'
import type { PlayActor, PlayState, PlayStateValue } from './play.machine'
import type {
  CardSelectionActor,
  CardCostSelectionActor,
} from './selection.machine'

import * as React from 'react'

import { useActor, useMachine } from '@xstate/react'

import { playMachine } from './play.machine'
import { Selector } from 'components/card-selector'

type GameProps = {
  roomId: string
  playerId: PlayerId
}

const STATE_COMPONENT_MAPPING: {
  selector: PlayStateValue
  component: (...args: any[]) => JSX.Element
}[] = [
    {
      selector: 'In Play',
      component: InPlay,
    },
    {
      selector: 'Deciding Starting Player',
      component: DecidingStartingPlayer,
    },
    {
      selector: 'Mulligan Check',
      component: MulliganCheck,
    },
    {
      selector: 'Game Round Over',
      component: GameRoundOver,
    },
  ]

export function Game({ roomId, playerId }: GameProps) {
  const [state, send, service] = useMachine(playMachine, {
    context: {
      roomId,
      playerId,
    },
  })

  React.useEffect(() => {
    const sub = service.subscribe(console.log)

    return sub.unsubscribe

    // eslint-disable-next-line
  }, [])

  const Child = React.useMemo(() => {
    return (
      STATE_COMPONENT_MAPPING.find(({ selector }) => state.matches(selector))
        ?.component ?? (() => null)
    )
    // eslint-disable-next-line
  }, [state.value])

  const childProps: GameChildProps = {
    state,
    send,
    playerId,
  }

  return (
    <>
      <pre>State: {JSON.stringify(state.value)}</pre>
      <Child {...childProps} />
    </>
  )
}

type GameChildProps = {
  state: PlayState
  send: PlayActor['send']
  playerId: PlayerId
}

function DecidingStartingPlayer({ state, send, playerId }: GameChildProps) {
  return (
    <>
      {state.context.diceRolls[playerId] && (
        <>
          <p>You Rolled: {state.context.diceRolls[playerId]}</p>
          <p>
            {Object.entries(state.context.diceRolls).map(([pid, res]) => {
              if (pid === playerId) {
                return null
              }

              return `${pid} rolled: ${res}\n`
            })}
          </p>
        </>
      )}
      {state.matches('Deciding Starting Player.Choosing') && (
        <div>
          <p>Choose the Starting Player:</p>
          {[...state.context.opponents, playerId].map((pid) => {
            return (
              <button
                key={pid}
                onClick={() => {
                  send({ type: 'PLAYER_CHOSEN', playerId: pid })
                }}
              >
                {pid}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

function MulliganCheck({ state, send }: GameChildProps) {
  const gameState = state.context.gameState

  return (
    <div>
      <p>Spirit Count:</p>
      <pre>{gameState.spiritDeck.length}</pre>
      <p>Hand:</p>
      <pre>{JSON.stringify(gameState.hand.map((c) => c.name))}</pre>
      {state.matches('Mulligan Check.Checking') && (
        <div>
          <button onClick={() => send({ type: 'KEEP_HAND' })}>Keep Hand</button>
          <button onClick={() => send({ type: 'MULLIGAN' })}>Mulligan</button>
        </div>
      )}
      {state.matches('Mulligan Check.Choosing Spirits') && (
        <Selector
          title="Spirits for Mulligan"
          selectionActor={
            state.children.mulliganSelection as CardSelectionActor
          }
          renderItem={(item, index, onClick) => {
            return (
              <button
                key={`${item.id}-${index}`}
                id={`${item.id}-${index}`}
                onClick={onClick}
              >
                {item.name}
              </button>
            )
          }}
        />
      )}
      <br />
      <p>Opponents:</p>
      {Object.entries(gameState.opponents).map(([pid, pState]) => {
        return (
          <div key={pid}>
            <p>{pid}:</p>
            <pre>{JSON.stringify(pState, null, 4)}</pre>
          </div>
        )
      })}
    </div>
  )
}

function InPlay({ state: parentState, playerId }: GameChildProps) {
  const [state, send] = useActor(
    parentState.children.gameRound as GameRoundActor
  )
  const gameState = state.context.gameState
  const field = gameState.field.filter((slot) => slot.owner === playerId)

  return (
    <div>
      <pre style={{ display: 'block' }}>
        Game Round State: {JSON.stringify(state.value)}
      </pre>
      <span>Spirit Count:</span>
      <pre>{gameState.spiritDeck.length}</pre>
      <span>Deck Count:</span>
      <pre>{gameState.mainDeckCount}</pre>
      <Actions state={state} send={send} />
      <p>Field:</p>
      <pre>{JSON.stringify(field, null, 4)}</pre>
      <p>Underworld:</p>
      <pre>{JSON.stringify(gameState.underworld)}</pre>
      <br />
      <p>Opponents:</p>
      {Object.entries(gameState.opponents).map(([pid, pState]) => {
        const field = gameState.field.filter((slot) => slot.owner === pid)
        const opponent = {
          ...pState,
          field,
        }
        return (
          <div key={pid}>
            <p>{pid}:</p>
            <pre>{JSON.stringify(opponent, null, 4)}</pre>
          </div>
        )
      })}
    </div>
  )
}

type InPlayChildProps = {
  state: GameRoundState
  send: GameRoundActor['send']
}

function Actions({ state, send }: InPlayChildProps) {
  if (state.hasTag('cardSelection')) {
    return (
      <Selector
        title="Select Cards"
        selectionActor={state.children.selectCards as CardCostSelectionActor}
        renderItem={(cost, index, onClick) => {
          return (
            <button key={`${cost.card.id}-${index}`} onClick={onClick}>
              {cost.card.name}
            </button>
          )
        }}
      />
    )
  }

  return (
    <div>
      <p>Hand:</p>
      {state.context.gameState.hand.map((card, index) => {
        return (
          <button
            key={`${card.id}-${index}`}
            onClick={() => send({ type: 'CAST_RUNE_FROM_HAND', index })}
          >
            {card.name}
          </button>
        )
      })}
      <p>Actions:</p>
      {state.matches('My Turn.Main Phase') && (
        <button onClick={() => send({ type: 'END_TURN' })}>End Turn</button>
      )}
    </div>
  )
}

function GameRoundOver({ state }: GameChildProps) {
  return (
    <p>
      {state.context.gameState.status.value === 'out'
        ? `You lost by ${state.context.gameState.status.outReason}...`
        : 'You won!'}
    </p>
  )
}
