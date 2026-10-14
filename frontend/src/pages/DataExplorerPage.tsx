import { toNumber } from '../utils/dataMath'
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Link } from 'react-router-dom'
import ModulePage from '../components/ModulePage'
import '../App.css'
import { PROJECTS } from '../services/projects'
import {
  deleteDataset,
  fetchDatasetProfile,
  fetchDatasetRowsPaginated,
  generateDataset,
  uploadDataset,
  type DatasetSummary,
} from '../services/explorer'
import { API_BASE } from '../services/api'
import { saveLastDataset } from '../services/studentState'
import type { DatasetId, Difficulty } from '../types/dataset'

type ExplorerTab = 'overview' | 'preview' | 'columns' | 'statistics' | 'missing' | 'duplicates' | 'outliers'

type SortDirection = 'asc' | 'desc'

export default function DataExplorerPage() {
  const [selectedProject, setSelectedProject] = useState<DatasetId>('student_performance')
  const [numRecords, setNumRecords] = useState(500)
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const [includeMissingValues, setIncludeMissingValues] = useState(true)
  const [includeOutliers, setIncludeOutliers] = useState(true)
  const [advancedMode, setAdvancedMode] = useState(false)
  const [missingPercentage, setMissingPercentage] = useState(0)
  const [outlierPercentage, setOutlierPercentage] = useState(0)
  const [noiseLevel, setNoiseLevel] = useState(1)
  const [randomSeed, setRandomSeed] = useState('')
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedName, setUploadedName] = useState('')
  const [statusMessage, setStatusMessage] = useState('Generate a dataset to start exploration.')
  const [activeTab, setActiveTab] = useState<ExplorerTab>('overview')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [filterColumn, setFilterColumn] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [numericMinText, setNumericMinText] = useState('')
  const [numericMaxText, setNumericMaxText] = useState('')
  const [missingOnly, setMissingOnly] = useState(false)

  const generateMutation = useMutation({
    mutationFn: generateDataset,
    onSuccess: (data) => {
      setDatasetSummary(data)
      saveLastDataset(data.dataset_name)
      setStatusMessage('Dataset generated. Use tabs to inspect quality and structure.')
      setActiveTab('overview')
      setPage(1)
      setSortBy('')
      setFilterColumn('')
      setFilterValue('')
      setNumericMinText('')
      setNumericMaxText('')
      setMissingOnly(false)
    },
    onError: (error) => {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.detail ?? error.message
        : 'Dataset generation failed.'
      setStatusMessage(String(message))
    },
  })

  const resetMutation = useMutation({
    mutationFn: deleteDataset,
    onSuccess: () => {
      setDatasetSummary(null)
      setStatusMessage('Dataset reset complete. Generate a new one to continue.')
    },
    onError: () => {
      setStatusMessage('Could not reset dataset right now. Please try again.')
    },
  })

  const uploadMutation = useMutation({
    mutationFn: ({ file, datasetName }: { file: File; datasetName?: string }) => uploadDataset(file, datasetName),
    onSuccess: (data) => {
      setDatasetSummary(data)
      saveLastDataset(data.dataset_name)
      setStatusMessage('Dataset uploaded successfully. Use tabs to explore and analyze your own data.')
      setActiveTab('overview')
      setPage(1)
      setSortBy('')
      setFilterColumn('')
      setFilterValue('')
      setNumericMinText('')
      setNumericMaxText('')
      setMissingOnly(false)
      setUploadedFile(null)
    },
    onError: (error) => {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.detail ?? error.message
        : 'Dataset upload failed.'
      setStatusMessage(String(message))
    },
  })

  const queryColumns = useMemo(() => Object.keys(datasetSummary?.data_types ?? {}), [datasetSummary])
  const numericColumns = useMemo(
    () =>
      Object.entries(datasetSummary?.data_types ?? {})
        .filter(([, dtype]) => dtype === 'int' || dtype === 'float')
        .map(([name]) => name),
    [datasetSummary],
  )

  const datasetId = datasetSummary?.dataset_id ?? ''

  const rowsQuery = useQuery({
    queryKey: [
      'dataset-rows',
      datasetId,
      page,
      pageSize,
      search,
      sortBy,
      sortDir,
      filterColumn,
      filterValue,
      numericMinText,
      numericMaxText,
      missingOnly,
    ],
    queryFn: () =>
      fetchDatasetRowsPaginated(datasetId, {
        page,
        page_size: pageSize,
        search,
        sort_by: sortBy,
        sort_dir: sortDir,
        filter_column: filterColumn,
        filter_value: filterValue,
        numeric_min: toNumber(numericMinText) ?? undefined,
        numeric_max: toNumber(numericMaxText) ?? undefined,
        missing_only: missingOnly,
      }),
    enabled: Boolean(datasetId),
    staleTime: 30_000,
  })

  const profileQuery = useQuery({
    queryKey: ['dataset-profile', datasetId],
    queryFn: () => fetchDatasetProfile(datasetId),
    enabled: Boolean(datasetId),
    staleTime: 30_000,
  })

  const selectedProjectTitle =
    useMemo(() => PROJECTS.find((project) => project.id === selectedProject)?.title, [selectedProject]) ??
    'Selected Dataset'

  const handleGenerate = () => {
    generateMutation.mutate({
      dataset: selectedProject,
      num_records: numRecords,
      include_missing_values: includeMissingValues,
      include_outliers: includeOutliers,
      difficulty,
      missing_value_percentage: advancedMode ? missingPercentage : 0,
      outlier_percentage: advancedMode ? outlierPercentage : 0,
      noise_level: advancedMode ? noiseLevel : 1,
      random_seed: randomSeed.trim() ? Number(randomSeed) : undefined,
    })
  }

  const handleReset = () => {
    if (!datasetSummary) {
      return
    }
    resetMutation.mutate(datasetSummary.dataset_id)
  }

  const handleDownload = () => {
    if (!datasetSummary) {
      return
    }
    window.open(`${API_BASE}/datasets/${datasetSummary.dataset_id}/download`, '_blank')
  }

  const handleUpload = () => {
    if (!uploadedFile) {
      setStatusMessage('Select a CSV file to upload.')
      return
    }
    uploadMutation.mutate({ file: uploadedFile, datasetName: uploadedName })
  }

  return (
    <ModulePage
      title="Data Explorer"
      purpose="Inspect dataset structure, quality issues, and descriptive patterns using server-side pagination and filters."
      status="available"
      nextActionLabel="Open Legacy Analysis Workspace"
      nextActionTo="/data-explorer/legacy"
    >
      <section className="card">
        <h2>Dataset Generator 2.0 (Phase 3 Baseline)</h2>
        <div className="form-grid">
          <label>
            Dataset
            <select value={selectedProject} onChange={(event) => setSelectedProject(event.target.value as DatasetId)}>
              {PROJECTS.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Number of rows
            <input
              type="number"
              value={numRecords}
              min={100}
              max={5000}
              onChange={(event) => setNumRecords(Number(event.target.value) || 500)}
            />
          </label>
          <label>
            Difficulty
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
        </div>
        <div className="toggle-row">
          <label className="toggle">
            <input
              type="checkbox"
              checked={includeMissingValues}
              onChange={(event) => setIncludeMissingValues(event.target.checked)}
            />
            Include missing values
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={includeOutliers}
              onChange={(event) => setIncludeOutliers(event.target.checked)}
            />
            Include outliers
          </label>
          <label className="toggle">
            <input type="checkbox" checked={advancedMode} onChange={(event) => setAdvancedMode(event.target.checked)} />
            Advanced mode
          </label>
        </div>
        {advancedMode && (
          <div className="form-grid">
            <label>
              Missing value %
              <input
                type="number"
                value={missingPercentage}
                min={0}
                max={50}
                onChange={(event) => setMissingPercentage(Number(event.target.value) || 0)}
              />
            </label>
            <label>
              Outlier %
              <input
                type="number"
                value={outlierPercentage}
                min={0}
                max={30}
                onChange={(event) => setOutlierPercentage(Number(event.target.value) || 0)}
              />
            </label>
            <label>
              Noise level
              <input
                type="number"
                step="0.1"
                value={noiseLevel}
                min={0.5}
                max={3}
                onChange={(event) => setNoiseLevel(Number(event.target.value) || 1)}
              />
            </label>
            <label>
              Random seed
              <input value={randomSeed} onChange={(event) => setRandomSeed(event.target.value)} placeholder="Optional integer" />
            </label>
          </div>
        )}
        <div className="button-row">
          <button type="button" className="primary" onClick={handleGenerate}>
            {generateMutation.isPending ? 'Generating...' : 'Generate'}
          </button>
          <button type="button" className="ghost" onClick={handleDownload} disabled={!datasetSummary}>
            Download CSV
          </button>
          <button type="button" className="danger" onClick={handleReset} disabled={!datasetSummary}>
            Reset
          </button>
        </div>
        <p className="status-message">{statusMessage}</p>
      </section>

      <section className="card">
        <h3>Upload Your Own Dataset</h3>
        <p>Upload a CSV dataset and use the same explorer, cleaning, statistics, and visualization workflow.</p>
        <div className="form-grid">
          <label>
            Dataset name (optional)
            <input value={uploadedName} onChange={(event) => setUploadedName(event.target.value)} placeholder="My Dataset" />
          </label>
          <label>
            CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setUploadedFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <div className="button-row">
          <button type="button" className="primary" onClick={handleUpload}>
            {uploadMutation.isPending ? 'Uploading...' : 'Upload Dataset'}
          </button>
        </div>
      </section>

      {!datasetSummary && (
        <section className="card">
          <h3>No dataset selected</h3>
          <p>Generate a dataset first, then inspect it through overview, quality, and statistics tabs.</p>
        </section>
      )}

      {datasetSummary && (
        <>
          <section className="card">
            <h3>{selectedProjectTitle}</h3>
            <div className="learning-tabs explorer-tabs">
              <button type="button" onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? 'active' : ''}>
                Overview
              </button>
              <button type="button" onClick={() => setActiveTab('preview')} className={activeTab === 'preview' ? 'active' : ''}>
                Preview
              </button>
              <button type="button" onClick={() => setActiveTab('columns')} className={activeTab === 'columns' ? 'active' : ''}>
                Columns
              </button>
              <button type="button" onClick={() => setActiveTab('statistics')} className={activeTab === 'statistics' ? 'active' : ''}>
                Statistics
              </button>
              <button type="button" onClick={() => setActiveTab('missing')} className={activeTab === 'missing' ? 'active' : ''}>
                Missing Values
              </button>
              <button type="button" onClick={() => setActiveTab('duplicates')} className={activeTab === 'duplicates' ? 'active' : ''}>
                Duplicates
              </button>
              <button type="button" onClick={() => setActiveTab('outliers')} className={activeTab === 'outliers' ? 'active' : ''}>
                Outliers
              </button>
            </div>
          </section>

          {activeTab === 'overview' && (
            <section className="card summary-grid">
              <div>
                <span>Rows</span>
                <strong>{datasetSummary.rows}</strong>
              </div>
              <div>
                <span>Columns</span>
                <strong>{datasetSummary.columns}</strong>
              </div>
              <div>
                <span>Target</span>
                <strong>{datasetSummary.target_suggestion}</strong>
              </div>
              <div>
                <span>Difficulty</span>
                <strong>{datasetSummary.difficulty}</strong>
              </div>
            </section>
          )}

          {activeTab === 'preview' && (
            <section className="card">
              <h3>Preview With Server Pagination and Filters</h3>
              <div className="form-grid">
                <label>
                  Search rows
                  <input
                    type="text"
                    value={search}
                    placeholder="Search any value"
                    onChange={(event) => {
                      setPage(1)
                      setSearch(event.target.value)
                    }}
                  />
                </label>
                <label>
                  Sort by
                  <select
                    value={sortBy}
                    onChange={(event) => {
                      setPage(1)
                      setSortBy(event.target.value)
                    }}
                  >
                    <option value="">None</option>
                    {queryColumns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Sort direction
                  <select
                    value={sortDir}
                    onChange={(event) => {
                      setPage(1)
                      setSortDir(event.target.value as SortDirection)
                    }}
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </label>
                <label>
                  Filter column
                  <select
                    value={filterColumn}
                    onChange={(event) => {
                      setPage(1)
                      setFilterColumn(event.target.value)
                    }}
                  >
                    <option value="">None</option>
                    {queryColumns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Filter value
                  <input
                    type="text"
                    value={filterValue}
                    placeholder="Contains"
                    onChange={(event) => {
                      setPage(1)
                      setFilterValue(event.target.value)
                    }}
                    disabled={!filterColumn}
                  />
                </label>
                <label>
                  Missing only
                  <select
                    value={missingOnly ? 'yes' : 'no'}
                    onChange={(event) => {
                      setPage(1)
                      setMissingOnly(event.target.value === 'yes')
                    }}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>
                <label>
                  Numeric min
                  <input
                    type="number"
                    value={numericMinText}
                    onChange={(event) => {
                      setPage(1)
                      setNumericMinText(event.target.value)
                    }}
                    disabled={!filterColumn || !numericColumns.includes(filterColumn)}
                  />
                </label>
                <label>
                  Numeric max
                  <input
                    type="number"
                    value={numericMaxText}
                    onChange={(event) => {
                      setPage(1)
                      setNumericMaxText(event.target.value)
                    }}
                    disabled={!filterColumn || !numericColumns.includes(filterColumn)}
                  />
                </label>
                <label>
                  Page size
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPage(1)
                      setPageSize(Number(event.target.value))
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
              </div>

              {rowsQuery.isLoading && <p>Loading rows...</p>}
              {rowsQuery.isError && <p>Failed to load rows for this filter configuration.</p>}
              {rowsQuery.data && rowsQuery.data.rows.length === 0 && <p>No rows match your filters.</p>}

              {rowsQuery.data && rowsQuery.data.rows.length > 0 && (
                <>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          {Object.keys(rowsQuery.data.rows[0]).map((column) => (
                            <th key={column}>{column}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rowsQuery.data.rows.map((row, index) => (
                          <tr key={`${datasetId}-${page}-${index}`}>
                            {Object.entries(row).map(([column, value]) => (
                              <td key={`${column}-${index}`}>{value === null ? 'NULL' : String(value)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="button-row">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page <= 1}
                    >
                      Previous
                    </button>
                    <span>
                      Page {rowsQuery.data.page} of {rowsQuery.data.total_pages} | Total matching rows: {rowsQuery.data.total_rows}
                    </span>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setPage((prev) => Math.min(rowsQuery.data.total_pages, prev + 1))}
                      disabled={page >= rowsQuery.data.total_pages}
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {activeTab === 'columns' && (
            <section className="card twin-columns">
              <div>
                <h3>Column Descriptions</h3>
                <ul>
                  {Object.entries(datasetSummary.column_descriptions).map(([column, description]) => (
                    <li key={column}>
                      <strong>{column}</strong>: {description}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Data Types</h3>
                <ul>
                  {Object.entries(datasetSummary.data_types).map(([column, dtype]) => (
                    <li key={column}>
                      <strong>{column}</strong>: {dtype}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {activeTab === 'statistics' && (
            <section className="card">
              <h3>Statistics</h3>
              {profileQuery.isLoading && <p>Loading profile statistics...</p>}
              {profileQuery.isError && <p>Could not load statistics right now.</p>}
              {profileQuery.data && Object.keys(profileQuery.data.numeric_stats).length === 0 && (
                <p>No numeric columns available for statistics.</p>
              )}
              {profileQuery.data && Object.keys(profileQuery.data.numeric_stats).length > 0 && (
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
          )}

          {activeTab === 'missing' && (
            <section className="card">
              <h3>Missing Values</h3>
              <p>Total missing cells: {profileQuery.data?.missing_cells ?? 0}</p>
              <ul>
                {Object.entries(datasetSummary.missing_summary).map(([column, count]) => (
                  <li key={column}>
                    <strong>{column}</strong>: {count}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {activeTab === 'duplicates' && (
            <section className="card">
              <h3>Duplicates</h3>
              {profileQuery.isLoading && <p>Loading duplicate analysis...</p>}
              {profileQuery.isError && <p>Could not load duplicate analysis.</p>}
              {profileQuery.data && <p>Duplicate rows detected: {profileQuery.data.duplicate_rows}</p>}
            </section>
          )}

          {activeTab === 'outliers' && (
            <section className="card">
              <h3>Potential Outliers (IQR Rule)</h3>
              {profileQuery.isLoading && <p>Loading outlier analysis...</p>}
              {profileQuery.isError && <p>Could not load outlier analysis.</p>}
              {profileQuery.data && (
                <ul>
                  {Object.entries(profileQuery.data.outlier_counts).map(([column, count]) => (
                    <li key={column}>
                      <strong>{column}</strong>: {count}
                    </li>
                  ))}
                </ul>
              )}
              <p>Outliers should be investigated, not removed automatically without context.</p>
            </section>
          )}

          <section className="card">
            <h3>Need full visualization + interpretation workflow?</h3>
            <p>
              The complete current workflow remains available in the legacy explorer while Phase 5 upgrades are in
              progress.
            </p>
            <Link className="button-link" to="/data-explorer/legacy">
              Open Legacy Workspace
            </Link>
          </section>
        </>
      )}
    </ModulePage>
  )
}
