import { Outlet, createRootRoute } from '@tanstack/react-router'
import { Footer, TabBar, TopBar } from '../components/shell'
import { RaidAlerts } from '../components/raidalert'
import { OnboardingGuide } from '../components/guide'
import { StarToaster } from '../lib/toast'

export const Route = createRootRoute({
  component: () => (
    <div className="relative min-h-dvh overflow-x-clip">
      <TopBar />
      <Outlet />
      <Footer />
      <TabBar />
      <StarToaster />
      <RaidAlerts />
      <OnboardingGuide />
    </div>
  ),
  notFoundComponent: () => (
    <main className="grid min-h-dvh place-items-center px-6 pt-24 text-center">
      <div>
        <img src="/art/defeat.webp" alt="" className="mx-auto h-40" />
        <h1 className="title-outline mt-4 text-5xl">Lost in the plaza</h1>
        <a href="/" className="btn btn-primary mt-6">
          Back to the lobby
        </a>
      </div>
    </main>
  ),
})
