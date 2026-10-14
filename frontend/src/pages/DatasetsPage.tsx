import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import ModulePage from '../components/ModulePage'
import { ROUTES } from '../constants/routes'
import { fetchRecentDatasets } from '../services/datasets'
import { fetchVersions } from '../services/platform'
import { PROJECTS } from '../services/projects'
import type { DatasetId } from '../types/dataset'

export default function DatasetsPage() {
  const [searchText, setSearchText] = useState('')
  const [selectedVersionDataset, setSelectedVersionDataset] = useState<DatasetId>(PROJECTS[0]?.id ?? 'student_performance')
  const recentDatasetsQuery = useQuery({
    queryKey: ['recent-datasets', 'hub'],
    queryFn: () => fetchRecentDatasets(100),
  })
  const versionsQuery = useQuery({
    queryKey: ['dataset-versions', selectedVersionDataset],
    queryFn: () => fetchVersions(selectedVersionDataset, 8),
  })

  const filteredProjects = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    if (!query) {
      return PROJECTS
    }
    return PROJECTS.filter(
      (project) =>
        project.title.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query) ||
        project.domain.toLowerCase().includes(query),
    )
  }, [searchText])

  const byName = useMemo(() => {
    const map = new Map<string, { rows: number; columns: number; count: number }>()
    for (const item of recentDatasetsQuery.data ?? []) {
      const key = item.dataset_name
      const existing = map.get(key)
      if (!existing) {
        map.set(key, { rows: item.rows_count, columns: item.columns_count, count: 1 })
      } else {
        existing.rows = item.rows_count
        existing.columns = item.columns_count
        existing.count += 1
      }
    }
    return map
  }, [recentDatasetsQuery.data])

  return (
    <ModulePage
      title="Dataset Hub"
      purpose="Choose project datasets with context and learning objective alignment."
      status="in-progress"
      nextActionLabel="Generate and Explore Dataset"
      nextActionTo={ROUTES.DATA_EXPLORER}
    >
      <section className="card">
        <label className="search-field">
          Search datasets
          <input
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search by name, description, or domain"
          />
        </label>
        {recentDatasetsQuery.isLoading && <p>Loading recent dataset activity...</p>}
        {recentDatasetsQuery.isError && <p>Could not load recent generated dataset stats.</p>}
      </section>

      <section className="card dataset-grid">
        {filteredProjects.map((project) => (
          <article key={project.id} className="dataset-card">
            <h2>{project.title}</h2>
            <p>{project.description}</p>
            <p>Domain: {project.domain}</p>
            <p>Difficulty: {project.difficulty}</p>
            <p>Recent generated versions: {byName.get(project.id)?.count ?? 0}</p>
            <p>Latest rows: {byName.get(project.id)?.rows ?? 0}</p>
            <p>Latest columns: {byName.get(project.id)?.columns ?? 0}</p>
            <Link className="text-link" to={ROUTES.DATA_EXPLORER}>
              Open in Data Explorer
            </Link>
          </article>
        ))}
      </section>

      <section className="card">
        <h3>Dataset Versions</h3>
        <div className="form-grid">
          <label>
            Dataset
            <select value={selectedVersionDataset} onChange={(event) => setSelectedVersionDataset(event.target.value as DatasetId)}>
              {PROJECTS.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        {versionsQuery.isLoading && <p>Loading versions...</p>}
        {versionsQuery.isError && <p>Could not load versions.</p>}
        {versionsQuery.data && versionsQuery.data.length === 0 && <p>No versions yet. Generate datasets to create versions.</p>}
        {versionsQuery.data && versionsQuery.data.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Dataset ID</th>
                  <th>Config</th>
                  <th>Metrics</th>
                </tr>
              </thead>
              <tbody>
                {versionsQuery.data.map((version) => (
                  <tr key={`${version.dataset_name}-${version.version_number}`}>
                    <td>v{version.version_number}</td>
                    <td>{version.dataset_id.slice(0, 10)}</td>
                    <td>{version.config_json}</td>
                    <td>{version.metrics_json}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </ModulePage>
  )
}
