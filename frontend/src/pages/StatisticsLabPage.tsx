import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import ModulePage from '../components/ModulePage'
import { ROUTES } from '../constants/routes'
import { fetchRecentDatasets } from '../services/datasets'
import { fetchDatasetProfile } from '../services/explorer'
import '../App.css'

const metricGuide: Array<{ key: string; definition: string; whenToUse: string; interpretation: string }> = [
  {
    key: 'mean',
    definition: 'Average value across observations.',
    whenToUse: 'Central tendency for roughly symmetric distributions.',
    interpretation: 'High sensitivity to extreme values.',
  },
  {
    key: 'median',
    definition: 'Middle value when sorted.',
    whenToUse: 'Robust center for skewed distributions.',
    interpretation: 'Less affected by outliers than mean.',
  },
  {
    key: 'std_dev',
    definition: 'Average spread around mean.',
    whenToUse: 'Quantifying variability and dispersion.',
    interpretation: 'Higher value means greater dispersion.',
  },
  {
    key: 'min/max',
    definition: 'Smallest and largest observed values.',
    whenToUse: 'Range boundary checks and anomaly scanning.',
    interpretation: 'Can be heavily influenced by outliers.',
  },
]

export default function StatisticsLabPage() {
  const [datasetId, setDatasetId] = useState('')
  const [showGuide, setShowGuide] = useState(false)

  const recentQuery = useQuery({
    queryKey: ['recent-datasets', 'statistics-lab'],
    queryFn: () => fetchRecentDatasets(40),
  })

  const profileQuery = useQuery({
    queryKey: ['stats-profile', datasetId],
    queryFn: () => fetchDatasetProfile(datasetId),
    enabled: Boolean(datasetId),
  })

  return (
    <ModulePage
      title="Statistics Lab"
      purpose="Interpret descriptive statistics with practical context and appropriate metric selection."
      status="available"
      nextActionLabel="Apply Insights"
      nextActionTo={ROUTES.INSIGHTS_LAB}
    >
      <section className="card">
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
        </div>
      </section>

      <section className="card">
        <h3>Computed Statistics</h3>
        {!datasetId && <p>Select a dataset to view statistics.</p>}
        {profileQuery.isLoading && <p>Loading statistics...</p>}
        {profileQuery.isError && <p>Could not load statistics.</p>}
        {profileQuery.data && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Count</th>
                  <th>Mean</th>
                  <th>Median</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Std Dev</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(profileQuery.data.numeric_stats).map(([column, stats]) => (
                  <tr key={column}>
                    <td>{column}</td>
                    <td>{stats.count}</td>
                    <td>{stats.mean}</td>
                    <td>{stats.median}</td>
                    <td>{stats.min}</td>
                    <td>{stats.max}</td>
                    <td>{stats.std_dev}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="button-row">
          <button type="button" className="ghost" onClick={() => setShowGuide((prev) => !prev)}>
            {showGuide ? 'Hide' : 'Show'} Metric Guide
          </button>
        </div>
        {showGuide && (
          <ul>
            {metricGuide.map((metric) => (
              <li key={metric.key}>
                <strong>{metric.key}</strong>: {metric.definition} | When to use: {metric.whenToUse} | Interpretation: {metric.interpretation}
              </li>
            ))}
          </ul>
        )}
      </section>
    </ModulePage>
  )
}
