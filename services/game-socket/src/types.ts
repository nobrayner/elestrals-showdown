import type { WebSocket as WebSocketBase } from 'ws'
import type { SendEventFunction as SendEventFunctionBase } from '@elestrals-showdown/types'

export type WebSocket = WebSocketBase & {
  meta: {
    playerKey: 'player1' | 'player2'
  }
}

export type SendEventFunction = SendEventFunctionBase<{ type: string; data: any}>
