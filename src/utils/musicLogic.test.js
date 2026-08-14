import { describe, it, expect } from 'vitest'
import { transposeChord, parseLine } from './musicLogic'

describe('transposeChord', () => {
  it('transposes major chords up', () => {
    expect(transposeChord('C', 2)).toBe('D')
    expect(transposeChord('G', 5)).toBe('C')
  })

  it('transposes major chords down', () => {
    expect(transposeChord('D', -2)).toBe('C')
    expect(transposeChord('C', -5)).toBe('G')
  })

  it('handles sharps', () => {
    expect(transposeChord('C#', 1)).toBe('D')
    expect(transposeChord('F#', -1)).toBe('F')
  })

  it('handles flats by converting to sharps', () => {
    expect(transposeChord('Db', 1)).toBe('D')
    expect(transposeChord('Eb', -1)).toBe('D')
  })

  it('preserves chord suffixes', () => {
    expect(transposeChord('Cm7', 2)).toBe('Dm7')
    expect(transposeChord('Gmaj7', -2)).toBe('Fmaj7')
    expect(transposeChord('F#dim', 1)).toBe('Gdim')
  })

  it('handles slash chords', () => {
    expect(transposeChord('C/E', 2)).toBe('D/F#')
    expect(transposeChord('G/B', -5)).toBe('D/F#')
  })

  it('returns original for invalid chords', () => {
    expect(transposeChord('X', 2)).toBe('X')
    expect(transposeChord('', 2)).toBe('')
  })
})

describe('parseLine', () => {
  it('parses line with chords', () => {
    const result = parseLine('[C]Hello [F]world')
    expect(result).toEqual([
      { chord: 'C', text: 'Hello ' },
      { chord: 'F', text: 'world' },
    ])
  })

  it('handles text before first chord', () => {
    const result = parseLine('Start [C]middle [F]end')
    expect(result).toEqual([
      { chord: '', text: 'Start ' },
      { chord: 'C', text: 'middle ' },
      { chord: 'F', text: 'end' },
    ])
  })

  it('transposes chords when semitones provided', () => {
    const result = parseLine('[C]Hello [F]world', 2)
    expect(result).toEqual([
      { chord: 'D', text: 'Hello ' },
      { chord: 'G', text: 'world' },
    ])
  })

  it('returns plain text when no chords', () => {
    const result = parseLine('Just plain text')
    expect(result).toEqual([{ chord: '', text: 'Just plain text' }])
  })

  it('handles empty line', () => {
    const result = parseLine('')
    expect(result).toEqual([])
  })
})