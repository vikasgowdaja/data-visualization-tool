import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import ModulePage from '../components/ModulePage'
import { ROUTES } from '../constants/routes'
import { projectTemplates } from '../features/learningContent'
import { createSession } from '../services/platform'

export default function ProjectsPage() {
  const [selectedProjectId, setSelectedProjectId] = useState(projectTemplates[0]?.id ?? '')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('')

  const saveSessionMutation = useMutation({
    mutationFn: createSession,
    onSuccess: () => setStatus('Project session saved successfully.'),
    onError: () => setStatus('Could not save project session.'),
  })

  const selectedProject = projectTemplates.find((p) => p.id === selectedProjectId)

  const save = () => {
    if (!selectedProject) return
    saveSessionMutation.mutate({
      name: `${selectedProject.title} Session`,
      dataset_id: selectedProject.id,
      state_json: JSON.stringify({ notes, tasks: selectedProject.objectives }),
    })
  }

  return (
    <ModulePage
      title="Projects"
      purpose="Complete mini-project workflows from problem framing to reflection."
      status="available"
      nextActionLabel="Learning Path"
      nextActionTo={ROUTES.LEARNING_PATH}
    >
      <section className="card">
        <label>
          Choose project
          <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
            {projectTemplates.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
      </section>

      {selectedProject && (
        <section className="card">
          <h3>{selectedProject.title}</h3>
          <p>Problem: {selectedProject.problem}</p>
          <h4>Objectives</h4>
          <ul>
            {selectedProject.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
          <label>
            Analysis Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} />
          </label>
          <div className="button-row">
            <button type="button" className="primary" onClick={save}>
              Save Project Session
            </button>
          </div>
          <p>{status}</p>
        </section>
      )}
    </ModulePage>
  )
}
