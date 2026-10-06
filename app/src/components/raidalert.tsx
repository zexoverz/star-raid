import { useRouter, useRouterState } from '@tanstack/react-router'
import { useCallback } from 'react'
import { useRaidAlerts } from '../lib/schedule'
import { play } from '../lib/sfx'
import { notify } from '../lib/toast'

/** Toasts "Raid #N just opened" the moment the keeper posts it, on any page, no reload needed. */
export function RaidAlerts() {
  const router = useRouter()
  const path = useRouterState({ select: (s) => s.location.pathname })
  const onNew = useCallback(
    (raidId: string) => {
      if (path === `/raid/${raidId}`) return
      play('join')
      notify.info(`Raid #${raidId} just opened. The window is about a minute, hit early!`, {
        id: `raid-live-${raidId}`,
        title: 'Raid time!',
        action: { label: '\u2694 Jump in', onClick: () => void router.navigate({ to: '/raid/$raidId', params: { raidId } }) },
      })
    },
    [router, path],
  )
  useRaidAlerts(onNew)
  return null
}
