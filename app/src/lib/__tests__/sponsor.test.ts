import { describe, expect, it } from 'vitest'
import { buildTerms, DEFAULT_FORM } from '../sponsor'

// Mirrors RaidVault._checkTerms / _baseAmount on the testnet tSTAR/tUSDC market.
describe('sponsor buildTerms (vault rules)', () => {
  it('accepts the keeper demo terms and converts to Kuru units', () => {
    const b = buildTerms(DEFAULT_FORM)
    expect(b.errors).toEqual([])
    expect(b.wallSize).toBe(100_000n * 10n ** 10n) // same as keeper DEMO.wallSize
    expect(b.wallWei).toBe(100_000n * 10n ** 18n)
    expect(b.anchorParam).toBe(2_600_000n) // 0.026 at price precision 1e8
    expect(b.bounty).toBe(50_000_000n)
    expect(b.target).toBe(500_000_000n)
    expect(b.windowBlocks).toBe(150n)
    expect(b.wallValue).toBe(2_600_000_000n) // 100k * 0.026 = 2600 tUSDC
  })
  it('refuses a prize above a tenth of the target (BountyTooLarge)', () => {
    expect(buildTerms({ ...DEFAULT_FORM, prize: '51' }).errors.join()).toMatch(/10x the prize/)
  })
  it('refuses a wall below Kuru min size and dust decimals (BadSize)', () => {
    expect(buildTerms({ ...DEFAULT_FORM, wallTokens: '99' }).errors.join()).toMatch(/at least 100 tSTAR/)
    expect(buildTerms({ ...DEFAULT_FORM, wallTokens: '100000.00000000001' }).errors.join()).toMatch(/too many decimals/)
  })
  it('refuses windows outside 40..400 blocks and starts inside OPEN_EARLY (BadWindow)', () => {
    expect(buildTerms({ ...DEFAULT_FORM, lengthSec: 10 }).errors.join()).toMatch(/at least 16 seconds/)
    expect(buildTerms({ ...DEFAULT_FORM, lengthSec: 200 }).errors.join()).toMatch(/at most 160 seconds/)
    expect(buildTerms({ ...DEFAULT_FORM, startInSec: 3 }).errors.join()).toMatch(/at least 10 seconds/)
  })
  it('refuses zero amounts (BadAmounts) and a target the wall cannot reach', () => {
    expect(buildTerms({ ...DEFAULT_FORM, seatCap: '0' }).ok).toBe(false)
    expect(buildTerms({ ...DEFAULT_FORM, target: '5000' }).errors.join()).toMatch(/whole wall is worth/)
  })
  it('parses affiliates and refuses junk', () => {
    const a = '0x1111111111111111111111111111111111111111'
    expect(buildTerms({ ...DEFAULT_FORM, affiliates: `${a}\n` }).affiliates).toEqual([a])
    expect(buildTerms({ ...DEFAULT_FORM, affiliates: 'bob' }).ok).toBe(false)
  })
})
