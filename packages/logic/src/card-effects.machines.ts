import { createMachine } from 'xstate'

export const normalEnchantMachine = createMachine({
  // Configuration
  id: 'normal-enchant-machine',
  predictableActionArguments: true,
  // Actual Machine
  initial: 'Enchanting',
  states: {
    'Enchanting': {},
  },
}, {
  actions: {},
  guards: {},
  services: {},
})
