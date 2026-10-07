import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { RAID_NO_SEAT } from '../data'
import { Bg, clamp, Guide, Pop, Sprite, StarAvatar, Title, Twinkles } from '../ui'

/** Act 2: verified humans only. One Lil Stars token id is one seat per raid. */
export function Seats() {
  const frame = useCurrentFrame()
  const seats = RAID_NO_SEAT.buys.filter((b) => b.seated)
  const noSeat = RAID_NO_SEAT.buys.find((b) => !b.seated)
  const stamp = interpolate(frame, [70, 78], [2.2, 1], clamp)
  const stampO = interpolate(frame, [70, 76], [0, 1], clamp)
  return (
    <AbsoluteFill className="bg-grape-950">
      <Bg slot="lobbyBg" dim={0.6} />
      <Twinkles count={12} seed={5} />
      <AbsoluteFill className="items-center pt-20">
        <Title kicker="Step 2 · the raiders" size={84}>
          One Lil Star = <span className="text-ember-400">one seat</span>
        </Title>
        <div className="mt-16 flex items-end gap-14">
          {seats.map((b, i) => (
            <Pop key={b.tokenId} delay={18 + i * 10} from="up" distance={200}>
              <div className="panel flex w-[340px] flex-col items-center px-6 py-7">
                <Sprite slot="seatTicket" className="-mt-20 mb-2 h-20 w-20" />
                <StarAvatar tokenId={b.tokenId} size={190} />
                <div className="mt-5 font-display text-[40px] text-white">Lil Star #{b.tokenId}</div>
                <div className="chip mt-3 bg-mint text-[20px] text-grape-900">seat · counts</div>
              </div>
            </Pop>
          ))}
          {noSeat && (
            <Pop delay={38} from="up" distance={200}>
              <div className="panel relative flex w-[340px] flex-col items-center px-6 py-7" style={{ filter: 'saturate(0.6)' }}>
                <StarAvatar tokenId={null} size={190} />
                <div className="mt-5 font-display text-[40px] text-grape-300">No seat</div>
                <div className="chip mt-3 bg-grape-700 text-[20px] text-grape-100">buy goes through · +0</div>
                <div
                  className="title-outline absolute left-1/2 top-[38%] whitespace-nowrap text-[64px] text-candy-300"
                  style={{ transform: `translate(-50%,-50%) rotate(-14deg) scale(${stamp})`, opacity: stampO }}
                >
                  NOT COUNTED
                </div>
              </div>
            </Pop>
          )}
        </div>
      </AbsoluteFill>
      <div className="absolute bottom-10 left-14">
        <Guide who="bunny" p="cheer" delay={60} size={190}>
          No bots farming the prize. Only seats share it. From real raid #{RAID_NO_SEAT.id}.
        </Guide>
      </div>
    </AbsoluteFill>
  )
}
