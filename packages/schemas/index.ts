export * from './src/types'
export * as CardEffects from './src/card-effects'

export type SendEventFunction<T extends { type: string; data: any }> = (
  data: T
) => void

