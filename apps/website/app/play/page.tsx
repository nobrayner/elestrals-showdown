import type { PlayerId } from '@elestrals-showdown/logic'

import cuid from 'cuid'

import { Game } from './game'

import styles from './page.module.scss'

export default function Play({
  searchParams,
}: {
  searchParams: {
    roomId: string
  }
}) {
  return (
    <main className={styles.play}>
      <Game roomId={searchParams.roomId} playerId={cuid() as PlayerId} />
    </main>
  )
}
