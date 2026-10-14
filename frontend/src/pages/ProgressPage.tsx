import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ModulePage from '../components/ModulePage'
import {
  createSession,
  deleteSession,
  duplicateSession,
  fetchProgressSummary,
  listSessions,
  updateSession,
} from '../services/platform'
import { ROUTES } from '../constants/routes'
import { getLastDatasetTitle, getLastModule } from '../services/studentState'

export default function ProgressPage() {
  const lastDataset = getLastDatasetTitle()
  const lastModule = getLastModule() ?? 'No recorded module yet'
  const [sessionName, setSessionName] = useState('My Analysis Session')
  const [resumeMessage, setResumeMessage] = useState('')
  const queryClient = useQueryClient()

  const progressQuery = useQuery({
    queryKey: ['progress-summary', 'progress-page'],
    queryFn: fetchProgressSummary,
  })

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'progress-page'],
    queryFn: () => listSessions(50),
  })

  const createMutation = useMutation({
    mutationFn: createSession,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sessions', 'progress-page'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateSession(id, { name }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sessions', 'progress-page'] }),
  })

  const duplicateMutation = useMutation({
    mutationFn: duplicateSession,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sessions', 'progress-page'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSession,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sessions', 'progress-page'] }),
  })

  const resumeSession = (sessionId: string) => {
    localStorage.setItem('dslab:activeSessionId', sessionId)
    setResumeMessage(`Session ${sessionId.slice(0, 8)} selected for resume.`)
  }

  return (
    <ModulePage
      title="Progress"
      purpose="Track verifiable learning activity and performance signals from saved work."
      status="available"
      nextActionLabel="Continue Learning"
      nextActionTo={ROUTES.DASHBOARD}
    >
      <section className="card">
        <p>Last dataset used: {lastDataset}</p>
        <p>Last module visited: {lastModule}</p>
        <p>Total recorded events: {progressQuery.data?.total_events ?? 0}</p>
        <ul>
          {Object.entries(progressQuery.data?.by_module ?? {}).map(([module, count]) => (
            <li key={module}>
              {module}: {count}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>Save and Resume Sessions</h3>
        <div className="form-grid">
          <label>
            Session name
            <input value={sessionName} onChange={(event) => setSessionName(event.target.value)} />
          </label>
        </div>
        <div className="button-row">
          <button
            type="button"
            className="primary"
            onClick={() => createMutation.mutate({ name: sessionName, state_json: '{}' })}
          >
            Save Session
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Saved Sessions</h3>
        {sessionsQuery.isLoading && <p>Loading sessions...</p>}
        {sessionsQuery.isError && <p>Could not load sessions.</p>}
        {sessionsQuery.data && sessionsQuery.data.length === 0 && <p>No saved sessions yet.</p>}
        {sessionsQuery.data && sessionsQuery.data.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Dataset</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessionsQuery.data.map((session) => (
                  <tr key={session.session_id}>
                    <td>{session.name}</td>
                    <td>{session.dataset_id ?? 'None'}</td>
                    <td>{session.updated_at}</td>
                    <td>
                      <div className="button-row">
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => resumeSession(session.session_id)}
                        >
                          Resume
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => updateMutation.mutate({ id: session.session_id, name: `${session.name} (Renamed)` })}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => duplicateMutation.mutate(session.session_id)}
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => deleteMutation.mutate(session.session_id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {resumeMessage && <p>{resumeMessage}</p>}
      </section>
    </ModulePage>
  )
}
