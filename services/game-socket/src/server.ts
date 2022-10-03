import type { SendEventFunction, WebSocket } from './types'

import { WebSocketServer } from 'ws'

import { startGameOrConnect } from './games-cache'

const PORT = process.env.PORT ?? 4040
const wss = new WebSocketServer({
  port: Number(PORT),
  host: process.env.HOST ?? 'localhost',
})

wss.on('connection', (ws: WebSocket, req) => {
  console.info('New connection')
  const url = new URL(`${req.url ?? '/'}`, `https://${req.headers.host}`)
  const urlParams = url.searchParams

  const roomId = urlParams.get('roomId')
  if (!roomId) {
    console.error('Room ID must be provided')
    ws.close(4000, 'Room ID must be provided')
    return
  }
  const send: SendEventFunction = (data) => {
    ws.send(JSON.stringify(data))
  }

  let gameRes = startGameOrConnect(roomId, send)

  if (gameRes.isErr()) {
    console.error(gameRes.error)
    ws.close(4001, gameRes.error)
    return
  }

  const [gameMachine, playerKey] = gameRes.value

  gameMachine.onStop(() => {
    ws.close(4002, 'Game Over')
  })

  ws.on('message', (data) => {
    const payload = JSON.parse(data.toString())
    console.log(payload)
    gameMachine.send(Object.assign(payload, { from: playerKey }))
  })
})

wss.on('listening', () => {
  console.info(`Listening on http://${wss.options.host}:${wss.options.port}`)
})
