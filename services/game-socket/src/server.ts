import type { SendEventFunction, WebSocket } from './types'
import type { DeckList } from '@elestrals-showdown/schemas'
import type { PlayerId } from '@elestrals-showdown/logic'

import { WebSocketServer } from 'ws'

import { deckFromDeckList } from '@elestrals-showdown/logic'

import { startGameOrConnect } from './games-cache'

const PORT = process.env.PORT ?? 4040
const wss = new WebSocketServer({
  port: Number(PORT),
  host: process.env.HOST ?? 'localhost',
})

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(`${req.url ?? '/'}`, `https://${req.headers.host}`)
  const urlParams = url.searchParams

  const playerId = urlParams.get('playerId')
  const roomId = urlParams.get('roomId')
  const deckList = urlParams.get('deckList')
  if (!playerId) {
    console.error('Player ID must be provided')
    ws.close(4400, 'Player ID must be provided')
    return
  }
  if (!roomId) {
    console.error('Room ID must be provided')
    ws.close(4400, 'Room ID must be provided')
    return
  }
  if (!deckList) {
    console.error('Deck List must be provided')
    ws.close(4401, 'Deck List must be provided')
    return
  }
  // FIXME: Actually do parsing to a decklist
  const parsedDeckList: DeckList | null = JSON.parse(deckList ?? 'null')
  if (!parsedDeckList) {
    console.error('Invalid Deck List format')
    ws.close(4402, 'Invalid Deck List format')
    return
  }
  const deckRes = deckFromDeckList(parsedDeckList)

  if (deckRes.isErr()) {
    const message =
      `Invalid Deck List:\n` + deckRes.error.map((e) => `* ${e}\n`)
    console.error(message)
    ws.close(4403, message)
    return
  }

  const send: SendEventFunction = (data) => {
    ws.send(JSON.stringify(data))
  }

  let gameRes = startGameOrConnect(roomId, {
    id: playerId as PlayerId,
    send,
    deck: deckRes.value,
  })

  if (gameRes.isErr()) {
    console.error(gameRes.error)
    ws.close(4403, gameRes.error)
    return
  }

  const gameMachine = gameRes.value

  gameMachine.onStop(() => {
    console.log(`[${roomId}] Game completed`)
    ws.close(4000, 'Game Over')
  })

  console.info(`[${roomId} (${playerId})] Connected`)

  ws.on('message', (data) => {
    const payload = JSON.parse(data.toString())
    console.log(`[${roomId} (${playerId})]`, payload)
    gameMachine.send(Object.assign(payload, { from: playerId }))
  })

  ws.on('close', () => {
    console.log(`[${roomId} (${playerId})] Disconnected`)
    gameMachine.send({
      type: 'PLAYER_DISCONNECTED',
      playerId: playerId,
    } as any)
  })
})

wss.on('listening', () => {
  console.info(`Listening on http://${wss.options.host}:${wss.options.port}`)
})
