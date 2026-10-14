import { toNumber } from '../utils/dataMath'
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import ModulePage from '../components/ModulePage'
import { fetchAllRows, type DataRow } from '../services/explorer'
import { fetchRecentDatasets } from '../services/datasets'
import { logProgressEvent } from '../services/platform'

type HistoryItem = {
  label: string
  snapshot: DataRow[]
}

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

function mode(values: Array<string | number>): string | number {
  const counts = new Map<string, { value: string | number; count: number }>()
  for (const value of values) {
    const key = String(value)
    const existing = counts.get(key)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(key, { value, count: 1 })
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count)[0]?.value ?? values[0]
}

export default function DataCleaningLabPage() {
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const [selectedColumn, setSelectedColumn] = useState('')
  const [originalRows, setOriginalRows] = useState<DataRow[]>([])
  const [cleanedRows, setCleanedRows] = useState<DataRow[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [message, setMessage] = useState('Select a generated dataset to start cleaning operations.')

  const recentQuery = useQuery({
    queryKey: ['recent-datasets', 'cleaning-lab'],
    queryFn: () => fetchRecentDatasets(30),
  })

  const loadRowsMutation = useMutation({
    mutationFn: fetchAllRows,
    onSuccess: (data) => {
      setOriginalRows(data.rows)
      setCleanedRows(data.rows)
      setHistory([])
      setSelectedColumn(Object.keys(data.rows[0] ?? {})[0] ?? '')
      setMessage('Dataset loaded. Apply cleaning operations and inspect before/after changes.')
      void logProgressEvent({ module: 'data-cleaning-lab', event_type: 'dataset_loaded' })
    },
    onError: () => setMessage('Could not load dataset rows for cleaning.'),
  })

  const columns = useMemo(() => Object.keys(cleanedRows[0] ?? {}), [cleanedRows])

  const missingCount = useMemo(
    () => cleanedRows.reduce((acc, row) => acc + Object.values(row).filter((value) => isMissing(value)).length, 0),
    [cleanedRows],
  )

  const duplicateCount = useMemo(() => {
    const seen = new Set<string>()
    let dups = 0
    for (const row of cleanedRows) {
      const key = JSON.stringify(row)
      if (seen.has(key)) {
        dups += 1
      } else {
        seen.add(key)
      }
    }
    return dups
  }, [cleanedRows])

  const pushHistory = (label: string) => {
    setHistory((prev) => [...prev, { label, snapshot: cleanedRows }])
  }

  const loadDataset = () => {
    if (!selectedDatasetId) {
      setMessage('Pick a dataset first.')
      return
    }
    loadRowsMutation.mutate(selectedDatasetId)
  }

  const fillMean = () => {
    if (!selectedColumn) return
    const nums = cleanedRows.map((row) => toNumber(row[selectedColumn])).filter((v): v is number => v !== null)
    if (nums.length === 0) {
      setMessage('Selected column has no numeric values for mean fill.')
      return
    }
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length
    pushHistory(`Filled missing values in ${selectedColumn} using mean`)
    setCleanedRows((prev) => prev.map((row) => (isMissing(row[selectedColumn]) ? { ...row, [selectedColumn]: Number(mean.toFixed(3)) } : row)))
    setMessage(`Filled missing values in ${selectedColumn} using mean.`)
    void logProgressEvent({ module: 'data-cleaning-lab', event_type: 'fill_mean' })
  }

  const fillMedian = () => {
    if (!selectedColumn) return
    const nums = cleanedRows.map((row) => toNumber(row[selectedColumn])).filter((v): v is number => v !== null).sort((a, b) => a - b)
    if (nums.length === 0) {
      setMessage('Selected column has no numeric values for median fill.')
      return
    }
    const median = nums[Math.floor(nums.length / 2)]
    pushHistory(`Filled missing values in ${selectedColumn} using median`)
    setCleanedRows((prev) => prev.map((row) => (isMissing(row[selectedColumn]) ? { ...row, [selectedColumn]: median } : row)))
    setMessage(`Filled missing values in ${selectedColumn} using median.`)
    void logProgressEvent({ module: 'data-cleaning-lab', event_type: 'fill_median' })
  }

  const fillMode = () => {
    if (!selectedColumn) return
    const vals = cleanedRows
      .map((row) => row[selectedColumn])
      .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    if (vals.length === 0) {
      setMessage('Selected column has no values for mode fill.')
      return
    }
    const modeValue = mode(vals)
    pushHistory(`Filled missing values in ${selectedColumn} using mode`)
    setCleanedRows((prev) => prev.map((row) => (isMissing(row[selectedColumn]) ? { ...row, [selectedColumn]: modeValue } : row)))
    setMessage(`Filled missing values in ${selectedColumn} using mode.`)
    void logProgressEvent({ module: 'data-cleaning-lab', event_type: 'fill_mode' })
  }

  const removeRowsWithMissing = () => {
    pushHistory('Removed rows containing missing values')
    setCleanedRows((prev) => prev.filter((row) => !Object.values(row).some((value) => isMissing(value))))
    setMessage('Removed rows that contain missing values.')
    void logProgressEvent({ module: 'data-cleaning-lab', event_type: 'remove_missing_rows' })
  }

  const removeDuplicates = () => {
    pushHistory('Removed duplicate rows')
    const seen = new Set<string>()
    setCleanedRows((prev) =>
      prev.filter((row) => {
        const key = JSON.stringify(row)
        if (seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      }),
    )
    setMessage('Removed duplicate rows.')
    void logProgressEvent({ module: 'data-cleaning-lab', event_type: 'remove_duplicates' })
  }

  const flagOutliers = () => {
    if (!selectedColumn) return
    const nums = cleanedRows.map((row) => toNumber(row[selectedColumn])).filter((v): v is number => v !== null).sort((a, b) => a - b)
    if (nums.length < 4) {
      setMessage('Not enough numeric values for outlier flagging.')
      return
    }
    const q1 = nums[Math.floor(nums.length * 0.25)]
    const q3 = nums[Math.floor(nums.length * 0.75)]
    const iqr = q3 - q1
    const low = q1 - 1.5 * iqr
    const high = q3 + 1.5 * iqr
    pushHistory(`Flagged outliers in ${selectedColumn}`)
    setCleanedRows((prev) =>
      prev.map((row) => {
        const value = toNumber(row[selectedColumn])
        const flagged = value !== null && (value < low || value > high)
        return { ...row, outlier_flag: flagged ? 'yes' : 'no' }
      }),
    )
    setMessage(`Flagged outliers for ${selectedColumn} using IQR bounds.`)
    void logProgressEvent({ module: 'data-cleaning-lab', event_type: 'flag_outliers' })
  }

  const undo = () => {
    if (history.length === 0) {
      setMessage('No action to undo.')
      return
    }
    const previous = history[history.length - 1]
    setHistory((prev) => prev.slice(0, -1))
    setCleanedRows(previous.snapshot)
    setMessage(`Undo successful: ${previous.label}`)
  }

  const resetToOriginal = () => {
    setCleanedRows(originalRows)
    setHistory([])
    setMessage('Restored cleaned dataset to original snapshot.')
  }

  return (
    <ModulePage
      title="Data Cleaning Lab"
      purpose="Experiment with non-destructive cleaning and understand why each operation is performed."
      status="available"
      nextActionLabel="Continue to Visualization Lab"
      nextActionTo="/visualization-lab"
    >
      <section className="card">
        <h3>Load Dataset</h3>
        <div className="form-grid">
          <label>
            Generated dataset
            <select value={selectedDatasetId} onChange={(event) => setSelectedDatasetId(event.target.value)}>
              <option value="">Select a dataset id</option>
              {(recentQuery.data ?? []).map((item) => (
                <option key={item.dataset_id} value={item.dataset_id}>
                  {item.dataset_name} | {item.dataset_id.slice(0, 8)} | {item.rows_count} rows
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="button-row">
          <button type="button" className="primary" onClick={loadDataset}>
            Load
          </button>
        </div>
        <p className="status-message">{message}</p>
      </section>

      {cleanedRows.length > 0 && (
        <>
          <section className="card summary-grid">
            <div>
              <span>Original rows</span>
              <strong>{originalRows.length}</strong>
            </div>
            <div>
              <span>Cleaned rows</span>
              <strong>{cleanedRows.length}</strong>
            </div>
            <div>
              <span>Missing cells</span>
              <strong>{missingCount}</strong>
            </div>
            <div>
              <span>Duplicate rows</span>
              <strong>{duplicateCount}</strong>
            </div>
          </section>

          <section className="card">
            <h3>Cleaning Operations</h3>
            <p>Choose a column and apply operations with clear rationale. The original dataset is never mutated.</p>
            <div className="form-grid">
              <label>
                Column
                <select value={selectedColumn} onChange={(event) => setSelectedColumn(event.target.value)}>
                  {columns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="button-row">
              <button type="button" className="ghost" onClick={fillMean}>
                Fill Mean
              </button>
              <button type="button" className="ghost" onClick={fillMedian}>
                Fill Median
              </button>
              <button type="button" className="ghost" onClick={fillMode}>
                Fill Mode
              </button>
              <button type="button" className="ghost" onClick={removeRowsWithMissing}>
                Remove Missing Rows
              </button>
              <button type="button" className="ghost" onClick={removeDuplicates}>
                Remove Duplicates
              </button>
              <button type="button" className="ghost" onClick={flagOutliers}>
                Flag Outliers
              </button>
              <button type="button" className="danger" onClick={undo}>
                Undo
              </button>
              <button type="button" className="danger" onClick={resetToOriginal}>
                Reset to Original
              </button>
            </div>
          </section>

          <section className="card twin-columns">
            <div>
              <h3>Action History</h3>
              {history.length === 0 ? <p>No actions yet.</p> : <ol>{history.map((item, idx) => <li key={`${item.label}-${idx}`}>{item.label}</li>)}</ol>}
            </div>
            <div>
              <h3>Before vs After Sample</h3>
              <p>Original first row: {JSON.stringify(originalRows[0])}</p>
              <p>Cleaned first row: {JSON.stringify(cleanedRows[0])}</p>
            </div>
          </section>
        </>
      )}
    </ModulePage>
  )
}
