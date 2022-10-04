import crypto from 'crypto'

type RollDiceArgs = {
  sides?: number
}
export function rollDice(args?: RollDiceArgs) {
  const { sides = 20 } = args ?? {}

  const values = new Uint8Array(sides)
  crypto.webcrypto.getRandomValues(values)

  const summedValue = values.reduce((sum, value) => sum + value)

  let roll = summedValue % sides

  return roll === 0 ? sides : roll
}
