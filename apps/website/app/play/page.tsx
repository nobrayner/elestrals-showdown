import { Game } from './game'
import cuid from 'cuid'

export default function Play({
  searchParams,
}: {
  searchParams: {
    roomId: string
  }
}) {
  return (
    <main>
      <Game roomId={searchParams.roomId} playerId={cuid()} />
    </main>
  )
}
