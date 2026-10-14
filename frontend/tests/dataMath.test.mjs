import assert from 'node:assert/strict'
import test from 'node:test'
import { toNumber, histogram, groupMean, correlation, getOutlierCount } from '../src/utils/dataMath.ts'

test('numeric parsing accepts finite numbers and rejects missing or invalid values', () => {
  for (const value of [null, undefined, '', '  ', 'abc', '12px', Infinity, NaN, 'Infinity']) {
    assert.equal(toNumber(value), null)
  }
  for (const [input, expected] of [[0, 0], ['  -2.5 ', -2.5], ['1e2', 100]]) {
    assert.equal(toNumber(input), expected)
  }
})

test('group means skip invalid values, round, and retain first-seen group order', () => {
  const rows = [
    { g: 'B', v: '1' }, { g: 'A', v: 9 }, { g: 'B', v: 2.333 },
    { g: 'B', v: null }, { g: null, v: 4 }, { g: 'invalid', v: 'abc' },
  ]
  const original = structuredClone(rows)
  assert.deepEqual(groupMean(rows, 'g', 'v'), [
    { name: 'B', value: 1.67 }, { name: 'A', value: 9 }, { name: 'Unknown', value: 4 },
  ])
  assert.deepEqual(groupMean([], 'g', 'v'), [])
  assert.deepEqual(rows, original)
})

test('histograms count boundaries and the maximum once, ignoring missing values', () => {
  const rows = [-2, -1, 0, 1, 2, null, 'bad'].map(v => ({ v }))
  assert.deepEqual(histogram(rows, 'v', 4), [
    { name: '-2.0--1.0', count: 1 }, { name: '-1.0-0.0', count: 1 },
    { name: '0.0-1.0', count: 1 }, { name: '1.0-2.0', count: 2 },
  ])
  assert.equal(histogram(rows, 'v').length, 10)
  assert.equal(histogram(rows, 'v', 12).length, 12)
  assert.deepEqual(histogram([{ v: null }], 'v'), [])
  const constant = histogram([{ v: 5 }, { v: '5' }], 'v')
  assert.equal(constant[0].count, 2)
  assert.equal(constant.reduce((sum, bin) => sum + bin.count, 0), 2)
})

test('correlation handles paired values, insufficient data, and constant columns', () => {
  assert.equal(correlation([{ x: 1, y: 3 }, { x: '2', y: 2 }, { x: 3, y: 1 }, { x: null, y: 4 }], 'x', 'y'), -1)
  assert.equal(correlation([{ x: 1, y: 2 }], 'x', 'y'), null)
  assert.equal(correlation([1, 2, 3].map(y => ({ x: 1, y })), 'x', 'y'), null)
})

test('outlier counting preserves inputs and handles short samples', () => {
  const values = [100, 1, 2, 3, 4, 5, 6, 7]
  assert.equal(getOutlierCount(values), 1)
  assert.deepEqual(values, [100, 1, 2, 3, 4, 5, 6, 7])
  assert.equal(getOutlierCount([1, 2, 100]), 0)
})
