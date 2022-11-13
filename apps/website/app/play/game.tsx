'use client'

import type { GameRoundActor, GameRoundState } from './game-round.machine'
import type { PlayActor, PlayState, PlayStateValue } from './play.machine'

import * as React from 'react'

import { useActor, useMachine } from '@xstate/react'

import { playMachine } from './play.machine'
import { SelectionActor } from './selection.machine'
import { CardSelector } from 'components/card-selector'

type GameProps = {
  roomId: string
  playerId: string
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
  playerId: string
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
        <CardSelector
          title="Spirits for Mulligan"
          selectionActor={state.children.mulliganSelection as SelectionActor}
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

function InPlay({ state: parentState }: GameChildProps) {
  const [state, send] = useActor(
    parentState.children.gameRound as GameRoundActor
  )
  const gameState = state.context.gameState

  return (
    <div>
      <pre>Game Round State: {JSON.stringify(state.value)}</pre>
      <p>Spirit Count:</p>
      <pre>{gameState.spiritDeck.length}</pre>
      <p>Deck Count:</p>
      <pre>{gameState.mainDeckCount}</pre>
      <p>Hand:</p>
      <pre>{JSON.stringify(gameState.hand.map((c) => c.name))}</pre>
      <Actions state={state} send={send} />
      <p>Stadium:</p>
      <pre>{JSON.stringify(gameState.field.stadium)}</pre>
      <p>Elestrals:</p>
      <pre>
        {JSON.stringify(gameState.field.elestrals.map((c) => c?.card.name))}
      </pre>
      <p>Runes:</p>
      <pre>
        {JSON.stringify(gameState.field.runes.map((c) => c?.card.name))}
      </pre>
      <p>Underworld:</p>
      <pre>{JSON.stringify(gameState.field.underworld.length)}</pre>
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

type InPlayChildProps = {
  state: GameRoundState
  send: GameRoundActor['send']
}

function Actions({ state, send }: InPlayChildProps) {
  return (
    <>
      <p>Actions:</p>
      {state.matches('My Turn.Main Phase') && (
        <button onClick={() => send({ type: 'END_TURN' })}>End Turn</button>
      )}
    </>
  )
}

function GameRoundOver({ state }: GameChildProps) {
  return (
    <p>
      {state.context.gameState.status === 'out'
        ? `You lost by ${state.context.gameState.outReason}...`
        : 'You won!'}
    </p>
  )
}
