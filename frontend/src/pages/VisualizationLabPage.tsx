import { toNumber, groupMean, histogram, correlation } from '../utils/dataMath'
import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toPng } from 'html-to-image'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from 'recharts'
import ModulePage from '../components/ModulePage'
import { fetchRecentDatasets } from '../services/datasets'
import { fetchAllRows } from '../services/explorer'
import { logProgressEvent } from '../services/platform'
import '../App.css'

type Objective =
  | 'compare_categories'
  | 'distribution'
  | 'relationship'
  | 'trend'
  | 'compare_groups'
  | 'outliers'
  | 'correlation'
  | 'composition'

type ChartType =
  | 'bar'
  | 'horizontal_bar'
  | 'stacked_bar'
  | 'line'
  | 'multi_line'
  | 'area'
  | 'scatter'
  | 'bubble'
  | 'histogram'
  | 'pie'
  | 'donut'
  | 'treemap'
  | 'correlation_heatmap'

const CHART_BY_OBJECTIVE: Record<Objective, { chart: ChartType; reason: string; whatToLook: string; commonMistake: string }> = {
  compare_categories: {
    chart: 'bar',
    reason: 'Category-level comparison is clearest in bar length/height.',
    whatToLook: 'Largest and smallest categories and gap sizes.',
    commonMistake: 'Comparing categories with inconsistent aggregation.',
  },
  distribution: {
    chart: 'histogram',
    reason: 'Histogram reveals center, spread, and skew for numeric values.',
    whatToLook: 'Skew, concentration, and unusual tails.',
    commonMistake: 'Using too few bins and hiding structure.',
  },
  relationship: {
    chart: 'scatter',
    reason: 'Two numeric variables are best assessed with point distribution.',
    whatToLook: 'Trend direction, clusters, and outliers.',
    commonMistake: 'Confusing association with causation.',
  },
  trend: {
    chart: 'line',
    reason: 'Ordered progression is communicated best with line continuity.',
    whatToLook: 'Rising/falling segments and turning points.',
    commonMistake: 'Using unsorted x-axis values for trend analysis.',
  },
  compare_groups: {
    chart: 'stacked_bar',
    reason: 'Stacked composition allows group comparison and share analysis.',
    whatToLook: 'Total magnitude and subgroup contributions.',
    commonMistake: 'Reading small stacked segments as precise values.',
  },
  outliers: {
    chart: 'scatter',
    reason: 'Outliers are easier to isolate in point-based views.',
    whatToLook: 'Points far from dense clusters.',
    commonMistake: 'Removing outliers without context justification.',
  },
  correlation: {
    chart: 'correlation_heatmap',
    reason: 'Heatmaps provide compact pairwise correlation overview.',
    whatToLook: 'Strong positive/negative cells and multicollinearity patterns.',
    commonMistake: 'Interpreting correlation as causal effect.',
  },
  composition: {
    chart: 'donut',
    reason: 'Part-to-whole breakdown is intuitive in donut segments.',
    whatToLook: 'Dominant segments and long-tail categories.',
    commonMistake: 'Using too many tiny slices that become unreadable.',
  },
}

export default function VisualizationLabPage() {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const [datasetId, setDatasetId] = useState('')
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [objective, setObjective] = useState<Objective>('compare_categories')
  const [xAxis, setXAxis] = useState('')
  const [yAxis, setYAxis] = useState('')
  const [groupBy, setGroupBy] = useState('')

  const recentQuery = useQuery({
    queryKey: ['recent-datasets', 'viz-lab'],
    queryFn: () => fetchRecentDatasets(50),
  })

  const rowsQuery = useQuery({
    queryKey: ['viz-rows', datasetId],
    queryFn: () => fetchAllRows(datasetId),
    enabled: Boolean(datasetId),
  })

  const rows = rowsQuery.data?.rows ?? []
  const columns = useMemo(() => Object.keys(rows[0] ?? {}), [rows])
  const numericColumns = useMemo(
    () => columns.filter((column) => rows.some((row) => toNumber(row[column]) !== null)),
    [columns, rows],
  )
  const categoricalColumns = useMemo(() => columns.filter((column) => !numericColumns.includes(column)), [columns, numericColumns])

  const scatterData = useMemo(
    () =>
      rows
        .map((row) => ({ x: toNumber(row[xAxis]), y: toNumber(row[yAxis]) }))
        .filter((r): r is { x: number; y: number } => r.x !== null && r.y !== null)
        .slice(0, 1500),
    [rows, xAxis, yAxis],
  )

  const groupedData = useMemo(() => {
    if (!groupBy || !yAxis) return []
    return groupMean(rows, groupBy, yAxis)
  }, [rows, groupBy, yAxis])

  const histData = useMemo(() => (xAxis ? histogram(rows, xAxis, 12) : []), [rows, xAxis])

  const pieData = useMemo(() => {
    if (!groupBy) return []
    const counts = new Map<string, number>()
    for (const row of rows) {
      const key = String(row[groupBy] ?? 'Unknown')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }))
  }, [rows, groupBy])

  const multiLineData = useMemo(() => {
    if (!xAxis || !yAxis || !groupBy) return []
    const map = new Map<string, Record<string, number>>()
    for (const row of rows) {
      const x = String(row[xAxis] ?? 'Unknown')
      const grp = String(row[groupBy] ?? 'Unknown')
      const value = toNumber(row[yAxis])
      if (value === null) continue
      const existing = map.get(x) ?? {}
      existing[grp] = (existing[grp] ?? 0) + value
      map.set(x, existing)
    }
    return Array.from(map.entries()).map(([name, groups]) => ({ name, ...groups }))
  }, [rows, xAxis, yAxis, groupBy])

  const recommendations = CHART_BY_OBJECTIVE[objective]

  const correlationMatrix = useMemo(() => {
    const matrix: Array<{ x: string; y: string; value: number | null }> = []
    for (const x of numericColumns) {
      for (const y of numericColumns) {
        matrix.push({ x, y, value: correlation(rows, x, y) })
      }
    }
    return matrix
  }, [numericColumns, rows])

  const colors = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#0891b2', '#4f46e5']

  const applyRecommendation = () => {
    setChartType(recommendations.chart)
    void logProgressEvent({ module: 'visualization-lab', event_type: 'recommendation_applied' })
  }

  const exportChartPng = async () => {
    if (!chartRef.current) {
      return
    }
    const dataUrl = await toPng(chartRef.current)
    const anchor = document.createElement('a')
    anchor.download = `chart-${chartType}.png`
    anchor.href = dataUrl
    anchor.click()
    void logProgressEvent({ module: 'visualization-lab', event_type: 'chart_export_png' })
  }

  const exportChartData = () => {
    let rowsToExport: Array<Record<string, string | number>> = []
    if (chartType === 'histogram') {
      rowsToExport = histData
    } else if (chartType === 'pie' || chartType === 'donut' || chartType === 'treemap') {
      rowsToExport = pieData
    } else if (chartType === 'bar' || chartType === 'horizontal_bar') {
      rowsToExport = groupedData
    } else if (chartType === 'stacked_bar' || chartType === 'multi_line') {
      rowsToExport = multiLineData
    } else if (chartType === 'correlation_heatmap') {
      rowsToExport = correlationMatrix.map((item) => ({ x: item.x, y: item.y, correlation: item.value ?? 'NA' }))
    } else {
      rowsToExport = scatterData.map((item) => ({ x: item.x, y: item.y }))
    }
    if (rowsToExport.length === 0) {
      return
    }
    const columns = Object.keys(rowsToExport[0])
    const csv = [columns.join(','), ...rowsToExport.map((row) => columns.map((col) => JSON.stringify(row[col] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `chart-data-${chartType}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    void logProgressEvent({ module: 'visualization-lab', event_type: 'chart_export_data' })
  }

  return (
    <ModulePage
      title="Visualization Lab"
      purpose="Choose valid chart forms, configure them properly, and interpret analytical meaning."
      status="available"
      nextActionLabel="Move to Insights Lab"
      nextActionTo="/insights-lab"
    >
      <section className="card">
        <h3>Help Me Choose a Chart</h3>
        <div className="form-grid">
          <label>
            Analytical objective
            <select value={objective} onChange={(event) => setObjective(event.target.value as Objective)}>
              <option value="compare_categories">Compare categories</option>
              <option value="distribution">Understand distribution</option>
              <option value="relationship">Find a relationship</option>
              <option value="trend">Analyze a trend</option>
              <option value="compare_groups">Compare groups</option>
              <option value="outliers">Find outliers</option>
              <option value="correlation">Understand correlation</option>
              <option value="composition">Show composition</option>
            </select>
          </label>
        </div>
        <p>Recommendation: {recommendations.chart.replace('_', ' ')}</p>
        <p>Reason: {recommendations.reason}</p>
        <p>What to look for: {recommendations.whatToLook}</p>
        <p>Common mistake: {recommendations.commonMistake}</p>
        <div className="button-row">
          <button type="button" className="primary" onClick={applyRecommendation}>
            Apply Recommendation
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Visualization Workspace</h3>
        <div className="form-grid">
          <label>
            Dataset
            <select value={datasetId} onChange={(event) => setDatasetId(event.target.value)}>
              <option value="">Select generated dataset</option>
              {(recentQuery.data ?? []).map((item) => (
                <option key={item.dataset_id} value={item.dataset_id}>
                  {item.dataset_name} | {item.dataset_id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Chart type
            <select value={chartType} onChange={(event) => setChartType(event.target.value as ChartType)}>
              <option value="bar">Bar</option>
              <option value="horizontal_bar">Horizontal Bar</option>
              <option value="stacked_bar">Stacked Bar</option>
              <option value="line">Line</option>
              <option value="multi_line">Multi-Line</option>
              <option value="area">Area</option>
              <option value="scatter">Scatter</option>
              <option value="bubble">Bubble</option>
              <option value="histogram">Histogram</option>
              <option value="pie">Pie</option>
              <option value="donut">Donut</option>
              <option value="treemap">Treemap</option>
              <option value="correlation_heatmap">Correlation Heatmap</option>
            </select>
          </label>
          <label>
            X axis
            <select value={xAxis} onChange={(event) => setXAxis(event.target.value)}>
              <option value="">Select</option>
              {numericColumns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </label>
          <label>
            Y axis
            <select value={yAxis} onChange={(event) => setYAxis(event.target.value)}>
              <option value="">Select</option>
              {numericColumns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </label>
          <label>
            Group
            <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
              <option value="">Select</option>
              {categoricalColumns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </label>
        </div>

        {rowsQuery.isLoading && <p>Loading dataset rows...</p>}
        {!rowsQuery.isLoading && datasetId && rows.length === 0 && <p>No data available for this configuration.</p>}
        {!datasetId && <p>Select a dataset to begin visualization.</p>}

        {rows.length > 0 && chartType !== 'correlation_heatmap' && (
          <div className="chart-area" ref={chartRef}>
            <ResponsiveContainer width="100%" height={360}>
              {chartType === 'bar' ? (
                <BarChart data={groupedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#2563eb" />
                </BarChart>
              ) : chartType === 'horizontal_bar' ? (
                <BarChart data={groupedData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#16a34a" />
                </BarChart>
              ) : chartType === 'stacked_bar' ? (
                <BarChart data={multiLineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {Object.keys(multiLineData[0] ?? {})
                    .filter((k) => k !== 'name')
                    .map((key, idx) => (
                      <Bar key={key} dataKey={key} stackId="a" fill={colors[idx % colors.length]} />
                    ))}
                </BarChart>
              ) : chartType === 'line' ? (
                <LineChart data={scatterData.map((p) => ({ x: p.x, y: p.y }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="y" stroke="#d97706" dot={false} />
                </LineChart>
              ) : chartType === 'multi_line' ? (
                <LineChart data={multiLineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {Object.keys(multiLineData[0] ?? {})
                    .filter((k) => k !== 'name')
                    .map((key, idx) => (
                      <Line key={key} type="monotone" dataKey={key} stroke={colors[idx % colors.length]} dot={false} />
                    ))}
                </LineChart>
              ) : chartType === 'area' ? (
                <AreaChart data={scatterData.map((p) => ({ x: p.x, y: p.y }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="y" stroke="#9333ea" fill="#d8b4fe" />
                </AreaChart>
              ) : chartType === 'scatter' ? (
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" name={xAxis} />
                  <YAxis dataKey="y" name={yAxis} />
                  <Tooltip />
                  <Scatter data={scatterData} fill="#0891b2" />
                </ScatterChart>
              ) : chartType === 'bubble' ? (
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" name={xAxis} />
                  <YAxis dataKey="y" name={yAxis} />
                  <Tooltip />
                  <Scatter data={scatterData.map((p, idx) => ({ ...p, z: (idx % 12) + 4 }))} fill="#ef4444" />
                </ScatterChart>
              ) : chartType === 'histogram' ? (
                <BarChart data={histData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0f766e" />
                </BarChart>
              ) : chartType === 'pie' ? (
                <PieChart>
                  <Tooltip />
                  <Legend />
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={120}>
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={colors[idx % colors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              ) : chartType === 'donut' ? (
                <PieChart>
                  <Tooltip />
                  <Legend />
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={120}>
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={colors[idx % colors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              ) : (
                <Treemap
                  data={pieData.map((item) => ({ ...item, size: item.value }))}
                  dataKey="size"
                  stroke="#fff"
                  fill="#60a5fa"
                />
              )}
            </ResponsiveContainer>
          </div>
        )}

        {rows.length > 0 && chartType === 'correlation_heatmap' && (
          <div className="table-wrap" ref={chartRef}>
            <table>
              <thead>
                <tr>
                  <th>Column A</th>
                  <th>Column B</th>
                  <th>Correlation</th>
                </tr>
              </thead>
              <tbody>
                {correlationMatrix.map((cell) => (
                  <tr key={`${cell.x}-${cell.y}`}>
                    <td>{cell.x}</td>
                    <td>{cell.y}</td>
                    <td>{cell.value ?? 'NA'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="button-row">
          <button type="button" className="ghost" onClick={exportChartPng} disabled={rows.length === 0}>
            Download PNG
          </button>
          <button type="button" className="ghost" onClick={exportChartData} disabled={rows.length === 0}>
            Download Data
          </button>
        </div>

        <p>Use these charts to support reasoning, not causal claims. Correlation does not imply causation.</p>
      </section>
    </ModulePage>
  )
}
