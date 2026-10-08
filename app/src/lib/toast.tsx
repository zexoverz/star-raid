import toast, { Toaster, type Toast } from 'react-hot-toast'
import { motion } from 'motion/react'
import { CREW, Mascot, type Pose, type Who } from '../components/mascots'
import { play } from './sfx'

/**
 * Lil Stars toasts: a crew member pops up with a speech bubble. One mascot per kind so players learn
 * the language: Bunnystar = something went wrong, Foxstar = success, Chogstar = working on it,
 * Bearstar = heads-up. Built on react-hot-toast; only the look is ours.
 */
type Kind = 'error' | 'success' | 'info' | 'loading'
const LOOK: Record<Kind, { who: Who; pose: Pose; border: string; title: string }> = {
  error: { who: 'bunny', pose: 'watch', border: '#F7B2D9', title: 'Oops!' },
  success: { who: 'fox', pose: 'cheer', border: '#A3E3C1', title: 'Nice!' },
  info: { who: 'bear', pose: 'cheer', border: '#B6D6F7', title: 'Heads up' },
  loading: { who: 'chog', pose: 'wait', border: '#F7C873', title: 'Working on it' },
}

type Action = { label: string; onClick: () => void }

function StarToast({ t, kind, message, title, action }: { t: Toast; kind: Kind; message: string; title?: string; action?: Action }) {
  const look = LOOK[kind]
  return (
    <motion.div
      initial={{ y: 30, scale: 0.85, opacity: 0 }}
      animate={t.visible ? { y: 0, scale: 1, opacity: 1 } : { y: 20, scale: 0.9, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className="pointer-events-auto flex max-w-sm items-end gap-1"
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <Mascot who={look.who} pose={look.pose} className={`h-20 w-auto shrink-0 drop-shadow-[0_6px_6px_rgba(0,0,0,0.4)] ${kind === 'loading' ? 'animate-float' : ''}`} />
      <div className="relative mb-3 rounded-3xl border-[3px] border-dashed bg-cream-100 px-4 py-2.5 text-grape-900 shadow-[0_5px_0_#2d2250,0_14px_30px_rgba(0,0,0,0.35)]" style={{ borderColor: look.border }}>
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-sm uppercase tracking-widest text-grape-600">{title ?? look.title}</span>
          <button onClick={() => toast.dismiss(t.id)} className="text-grape-500 hover:text-grape-900" aria-label="Dismiss">
            ✕
          </button>
        </div>
        <div className="text-[14px] font-semibold leading-snug">{message}</div>
        {action && (
          <button
            className="btn btn-primary mt-2 px-4 py-1.5 text-sm"
            onClick={() => {
              toast.dismiss(t.id)
              action.onClick()
            }}
          >
            {action.label}
          </button>
        )}
        <div className="mt-1 text-[12px] sm:text-[10px] font-bold uppercase tracking-widest text-grape-500">{CREW[look.who].name}</div>
        <span className="absolute -left-[9px] bottom-4 h-4 w-4 rotate-45 border-b-[3px] border-l-[3px] border-dashed bg-cream-100" style={{ borderColor: look.border }} />
      </div>
    </motion.div>
  )
}

type Opts = { title?: string; id?: string; duration?: number; action?: Action }

const show = (kind: Kind, message: string, opts?: Opts) =>
  toast.custom((t) => <StarToast t={t} kind={kind} message={message} title={opts?.title} action={opts?.action} />, {
    // The same message never stacks twice: it replaces the one already on screen.
    id: opts?.id ?? `${kind}:${message}`,
    duration: opts?.duration ?? (opts?.action ? 15000 : kind === 'error' ? 7000 : kind === 'loading' ? Infinity : 4000),
  })

export const notify = {
  error: (m: string, o?: Opts) => (play('defeat'), show('error', m, o)),
  success: (m: string, o?: Opts) => (play('coin'), show('success', m, o)),
  info: (m: string, o?: Opts) => show('info', m, o),
  loading: (m: string, o?: Opts) => show('loading', m, o),
  dismiss: (id?: string) => toast.dismiss(id),
}

export function StarToaster() {
  return <Toaster position="bottom-right" gutter={10} containerStyle={{ bottom: 96, right: 16 }} toastOptions={{ style: { background: 'transparent', boxShadow: 'none', padding: 0 } }} />
}
