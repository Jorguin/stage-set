import { describe, it, expect } from 'vitest'
import { calculateRetentionSync, getRetentionColor } from './spacedRepetition'

describe('calculateRetentionSync', () => {
  const today = new Date()
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fifteenDaysAgo = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000)

  it('returns 100 when just practiced (today) - with progress data', () => {
    expect(calculateRetentionSync(today.toISOString(), 1, true)).toBe(100)
    expect(calculateRetentionSync(today.toISOString(), 5, true)).toBe(100)
  })

  it('returns 100 for future dates (daysElapsed <= 0) - with progress data', () => {
    const future = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    expect(calculateRetentionSync(future.toISOString(), 1, true)).toBe(100)
  })

  it('decays linearly for mastery level 1 (interval = 1 day) - with progress data', () => {
    expect(calculateRetentionSync(yesterday.toISOString(), 1, true)).toBe(50)
    expect(calculateRetentionSync(threeDaysAgo.toISOString(), 1, true)).toBe(0)
  })

  it('decays linearly for mastery level 2 (interval = 3 days) - with progress data', () => {
    expect(calculateRetentionSync(yesterday.toISOString(), 2, true)).toBe(83)
    expect(calculateRetentionSync(threeDaysAgo.toISOString(), 2, true)).toBe(50)
    expect(calculateRetentionSync(sevenDaysAgo.toISOString(), 2, true)).toBe(0)
  })

  it('decays linearly for mastery level 3 (interval = 7 days) - with progress data', () => {
    expect(calculateRetentionSync(threeDaysAgo.toISOString(), 3, true)).toBe(79)
    expect(calculateRetentionSync(sevenDaysAgo.toISOString(), 3, true)).toBe(50)
    expect(calculateRetentionSync(fifteenDaysAgo.toISOString(), 3, true)).toBe(0)
  })

  it('decays linearly for mastery level 5 (interval = 30 days) - with progress data', () => {
    const fifteenDaysAgo = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000)
    
    expect(calculateRetentionSync(fifteenDaysAgo.toISOString(), 5, true)).toBe(75)
    expect(calculateRetentionSync(thirtyDaysAgo.toISOString(), 5, true)).toBe(50)
    expect(calculateRetentionSync(sixtyDaysAgo.toISOString(), 5, true)).toBe(0)
  })

  it('returns 0 for new songs without progress data', () => {
    expect(calculateRetentionSync(today.toISOString(), 1)).toBe(0)
    expect(calculateRetentionSync(today.toISOString(), 1, false)).toBe(0)
  })

  it('returns 0 for invalid dates', () => {
    expect(calculateRetentionSync('invalid', 1)).toBe(0)
    expect(calculateRetentionSync(null, 1)).toBe(0)
    expect(calculateRetentionSync(undefined, 1)).toBe(0)
  })

  it('returns 0 for missing mastery level', () => {
    expect(calculateRetentionSync(today.toISOString(), null)).toBe(0)
    expect(calculateRetentionSync(today.toISOString(), undefined)).toBe(0)
  })

  it('clamps values between 0 and 100', () => {
    const veryOld = new Date(today.getTime() - 100 * 24 * 60 * 60 * 1000)
    expect(calculateRetentionSync(veryOld.toISOString(), 1)).toBe(0)
  })
})

describe('getRetentionColor', () => {
  it('returns green for high retention', () => {
    expect(getRetentionColor(100)).toBe('text-green-500')
    expect(getRetentionColor(80)).toBe('text-green-500')
    expect(getRetentionColor(85)).toBe('text-green-500')
  })

  it('returns amber for medium retention', () => {
    expect(getRetentionColor(79)).toBe('text-amber-400')
    expect(getRetentionColor(50)).toBe('text-amber-400')
    expect(getRetentionColor(40)).toBe('text-amber-400')
  })

  it('returns red for low retention', () => {
    expect(getRetentionColor(39)).toBe('text-red-500')
    expect(getRetentionColor(0)).toBe('text-red-500')
  })
})

