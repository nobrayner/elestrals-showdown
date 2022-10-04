import type { SendEventFunction, WebSocket } from './types'
import type { DeckList } from '@elestrals-showdown/types'

import { WebSocketServer } from 'ws'

import { deckFromDeckList } from '@elestrals-showdown/machines'

import { startGameOrConnect } from './games-cache'

const PORT = process.env.PORT ?? 4040
const wss = new WebSocketServer({
  port: Number(PORT),
  host: process.env.HOST ?? 'localhost',
})

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(`${req.url ?? '/'}`, `https://${req.headers.host}`)
  const urlParams = url.searchParams

  const roomId = urlParams.get('roomId')
  const deckList = urlParams.get('deckList')
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

  console.info(`[${roomId}]`, 'New connection')

  const send: SendEventFunction = (data) => {
    ws.send(JSON.stringify(data))
  }

  let gameRes = startGameOrConnect(roomId, {
    send,
    deck: deckRes.value,
  })

  if (gameRes.isErr()) {
    console.error(gameRes.error)
    ws.close(4403, gameRes.error)
    return
  }

  const [gameMachine, playerKey] = gameRes.value

  gameMachine.onStop(() => {
    ws.close(4000, 'Game Over')
  })

  ws.on('message', (data) => {
    const payload = JSON.parse(data.toString())
    console.log(`[${roomId} (${playerKey})]`, payload)
    gameMachine.send(Object.assign(payload, { from: playerKey }))
  })
})

wss.on('listening', () => {
  console.info(`Listening on http://${wss.options.host}:${wss.options.port}`)
})
