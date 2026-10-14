// Pure data calculations shared by the explorer and learning labs.
type DataRow = Record<string, string | number | null>

/** Parse finite numeric cells; missing, blank, and invalid cells become null. */
export function toNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Two-decimal means in first-seen group order, excluding invalid target cells. */
export function groupMean(rows: DataRow[], key: string, target: string): Array<{ name: string; value: number }> {
  const map = new Map<string, { sum: number; count: number }>()
  for (const row of rows) {
    const group = String(row[key] ?? 'Unknown')
    const targetValue = toNumber(row[target])
    if (targetValue === null) {
      continue
    }
    const existing = map.get(group)
    if (existing) {
      existing.sum += targetValue
      existing.count += 1
    } else {
      map.set(group, { sum: targetValue, count: 1 })
    }
  }
  return Array.from(map.entries())
    .map(([name, agg]) => ({ name, value: Number((agg.sum / agg.count).toFixed(2)) }))
}

/** Equal-width bins (positive integer count), including the maximum in the last bin. */
export function histogram(rows: DataRow[], key: string, bins = 10): Array<{ name: string; count: number }> {
  const values = rows.map((row) => toNumber(row[key])).filter((value): value is number => value !== null)
  if (values.length === 0) {
    return []
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const width = (max - min || 1) / bins
  const counts = Array.from({ length: bins }, () => 0)

  for (const value of values) {
    const index = Math.min(bins - 1, Math.floor((value - min) / width))
    counts[index] += 1
  }

  return counts.map((count, index) => {
    const start = min + index * width
    const end = start + width
    return {
      name: `${start.toFixed(1)}-${end.toFixed(1)}`,
      count,
    }
  })
}

export function correlation(rows: DataRow[], xKey: string, yKey: string): number | null {
  const points = rows
    .map((row) => ({ x: toNumber(row[xKey]), y: toNumber(row[yKey]) }))
    .filter((point): point is { x: number; y: number } => point.x !== null && point.y !== null)

  if (points.length < 3) {
    return null
  }

  const n = points.length
  const sumX = points.reduce((acc, point) => acc + point.x, 0)
  const sumY = points.reduce((acc, point) => acc + point.y, 0)
  const meanX = sumX / n
  const meanY = sumY / n

  let numerator = 0
  let denomX = 0
  let denomY = 0
  for (const point of points) {
    const dx = point.x - meanX
    const dy = point.y - meanY
    numerator += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }

  const denominator = Math.sqrt(denomX * denomY)
  if (denominator === 0) {
    return null
  }
  return Number((numerator / denominator).toFixed(3))
}

export function getOutlierCount(values: number[]): number {
  if (values.length < 4) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(sorted.length * 0.25)]
  const q3 = sorted[Math.floor(sorted.length * 0.75)]
  const iqr = q3 - q1
  const low = q1 - 1.5 * iqr
  const high = q3 + 1.5 * iqr
  return sorted.filter((value) => value < low || value > high).length
}

