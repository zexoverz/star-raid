import { describe, expect, it } from 'vitest'
import { raidGasLimit, explainError, ERROR_TEXT } from '../contracts'
import { fmt, ratio, duration } from '../format'
import { phaseOf, sortLobby } from '../phase'
import { starArt } from '../stars'
import { nextRaidAt, rollForward } from '../schedule'
import type { Frame, LobbyRaid } from '../types'

const terms = { w0: '100', w1: '200', drawFrom: '175' } as Frame['terms']
const f = (status: Frame['status'], won: boolean | null = null) => ({ status, terms, won, endBlock: null }) as unknown as Frame

describe('phaseOf', () => {
  it.each([
    ['Posted', null, 50n, 'upcoming'],
    ['Posted', null, 250n, 'called-off'],
    ['Open', null, 95n, 'upcoming'],
    ['Open', null, 150n, 'live'],
    ['Open', null, 175n, 'danger'],
    ['Open', null, 200n, 'danger'],
    ['Open', null, 201n, 'drawing'],
    ['Closing', null, 220n, 'drawing'],
    ['Closed', null, 230n, 'revealed'],
    ['Settled', true, 240n, 'victory'],
    ['Settled', false, 240n, 'defeat'],
    ['Aborted', null, 240n, 'called-off'],
    ['Open', null, undefined, 'live'],
  ] as const)('%s won=%s head=%s -> %s', (status, won, head, want) => {
    expect(phaseOf(f(status, won), head)).toBe(want)
  })
})

describe('sortLobby', () => {
  it('puts live raids first, then upcoming, then finished newest first', () => {
    const r = (raidId: string, status: Frame['status'], won: boolean | null = null) => ({ ...f(status, won), raidId }) as unknown as LobbyRaid
    const out = sortLobby([r('1', 'Aborted'), r('3', 'Settled', true), r('7', 'Posted'), r('6', 'Open'), r('4', 'Settled', false)], 150n)
    expect(out.map((x) => x.raidId)).toEqual(['6', '7', '4', '3', '1'])
  })
})

describe('raidGasLimit (AGENTS rule 10, mirrors keeper/src/gas.ts)', () => {
  it('floors at 800k + 40k per extra maker', () => {
    expect(raidGasLimit(0)).toBe(800_000n)
    expect(raidGasLimit(1)).toBe(840_000n)
    expect(raidGasLimit(1, 100_000n)).toBe(840_000n)
  })
  it('pads the estimate by 1.5x', () => expect(raidGasLimit(1, 574_198n)).toBe(861_297n))
  it('never exceeds the 2M ceiling', () => expect(raidGasLimit(0, 5_000_000n)).toBe(2_000_000n))
})

describe('explainError', () => {
  it('maps every named contract error to plain copy', () => {
    for (const [name, copy] of Object.entries(ERROR_TEXT)) expect(explainError(new Error(`reverted with the following reason:\n${name}()`))).toBe(copy)
  })
  it('explains wallet rejection and missing gas', () => {
    expect(explainError(new Error('User rejected the request.'))).toMatch(/cancelled/)
    expect(explainError(new Error('insufficient funds for gas * price + value'))).toMatch(/MON for gas/)
  })
  it('explains Monad "Missing or invalid parameters" (insufficient balance) and the 15 req/s limit', () => {
    const monad = Object.assign(new Error('Missing or invalid parameters.\nDouble check you have provided the correct parameters.'), { details: 'Signer had insufficient balance' })
    expect(explainError(monad)).toMatch(/Not enough MON for gas/)
    expect(explainError(new Error('Missing or invalid parameters.'))).toMatch(/not enough MON/)
    expect(explainError(Object.assign(new Error('RPC Request failed.'), { details: 'requests limited to 15/sec' }))).toMatch(/rate limited/)
    expect(explainError(Object.assign(new Error('RPC Request failed.'), { details: 'reserve balance violation' }))).toMatch(/still crediting/)
  })
})

describe('format (no price, no PnL: token amounts only)', () => {
  it('formats token units', () => {
    expect(fmt('600000000', 6)).toBe('600')
    expect(fmt('749999998', 6)).toBe('750')
    expect(fmt('100000000000000000000000', 18)).toBe('100k')
    expect(fmt(null, 6)).toBe('0')
  })
  it('ratio is safe at zero and above one', () => {
    expect(ratio('5', '0')).toBe(0)
    expect(ratio('750', '500')).toBe(1.5)
  })
  it('duration', () => {
    expect(duration(60)).toBe('1m 00s')
    expect(duration(3725)).toBe('1h 2m')
    expect(duration(-5)).toBe('0s')
  })
})

describe('nextRaidAt (hourly demo schedule estimate)', () => {
  it('is one hour after the last post, using the newest settled raid', () => {
    const rows = [{ settledAt: 1_000_000 }, { settledAt: 500 }] as unknown as LobbyRaid[]
    expect(nextRaidAt(rows)).toBe(1_000_000 * 1000 - 90_000 + 3_600_000)
  })
  it('skips raids that never settled and is null with no history', () => {
    expect(nextRaidAt([{ settledAt: null }, { settledAt: 2000 }] as unknown as LobbyRaid[])).toBe(2000 * 1000 - 90_000 + 3_600_000)
    expect(nextRaidAt([])).toBeNull()
    expect(nextRaidAt(undefined)).toBeNull()
  })
  it('rolls a missed slot to the next hour after a 3 minute grace, never backwards', () => {
    const at = 10_000_000
    expect(rollForward(at, at + 60_000)).toBe(at) // within grace: still "soon"
    expect(rollForward(at, at + 4 * 60_000)).toBe(at + 3_600_000) // skipped slot: next hour
    expect(rollForward(at, at + 2 * 3_600_000 + 4 * 60_000)).toBe(at + 3 * 3_600_000)
    expect(rollForward(at, at - 1000)).toBe(at)
    expect(rollForward(null, at)).toBeNull()
  })
})

describe('starArt (testnet preview mapping)', () => {
  it('maps any token id to bundled official art, labelled preview', () => {
    for (const id of ['0', '7', '8', '31', '12345678901234567890']) {
      const a = starArt(id)!
      expect(a.src).toMatch(/^\/stars\/\d+\.webp$/)
      expect(a.preview).toBe(true)
    }
    expect(starArt(null)).toBeNull()
  })
})
