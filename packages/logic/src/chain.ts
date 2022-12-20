import type { Card } from '@elestrals-showdown/schemas'

import type { PlayerId } from './types'

export type ChainLink = {
  card: Card
  caster: PlayerId
}

export class Chain {
  static from(links: ChainLink[]): Chain
  static from(link: ChainLink): Chain
  static from(arg: any): Chain {
    return new Chain(arg)
  }

  private _links: Array<ChainLink>

  constructor(linkOrLinks: ChainLink | ChainLink[]) {
    this._links = Array.isArray(linkOrLinks) ? linkOrLinks : [linkOrLinks]
  }

  get root(): ChainLink {
    return this._links[0]!
  }

  at(index: number) {
    return this._links.at(index)
  }
}
