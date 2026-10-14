import { useMemo, useState } from 'react'
import ModulePage from '../components/ModulePage'
import { ROUTES } from '../constants/routes'
import { logProgressEvent } from '../services/platform'

const steps = [
  'Inspect dataset',
  'Identify quality problems',
  'Clean data',
  'Choose visualization',
  'Analyze relationship',
  'Interpret result',
  'Make recommendation',
]

export default function ChallengesPage() {
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [reflection, setReflection] = useState('')

  const completed = useMemo(() => steps.filter((step) => done[step]).length, [done])
  const score = Math.round((completed / steps.length) * 100)

  const toggle = (step: string) => {
    setDone((prev) => ({ ...prev, [step]: !prev[step] }))
  }

  const submitChallenge = () => {
    void logProgressEvent({
      module: 'challenges',
      event_type: 'challenge_submitted',
      score,
      metadata_json: JSON.stringify({ completed, reflectionLength: reflection.length }),
    })
  }

  return (
    <ModulePage
      title="Challenges"
      purpose="Complete scenario-based analytics from exploration to recommendation."
      status="available"
      nextActionLabel="Open Projects"
      nextActionTo={ROUTES.PROJECTS}
    >
      <section className="card">
        <h3>Scenario: University Student Performance Review</h3>
        <p>Work through the full data science flow and score your completion quality.</p>
        <ul>
          {steps.map((step) => (
            <li key={step}>
              <label>
                <input type="checkbox" checked={Boolean(done[step])} onChange={() => toggle(step)} /> {step}
              </label>
            </li>
          ))}
        </ul>
        <label>
          Reflection
          <textarea value={reflection} onChange={(event) => setReflection(event.target.value)} rows={4} />
        </label>
        <div className="button-row">
          <button type="button" className="primary" onClick={submitChallenge}>
            Submit Challenge
          </button>
        </div>
      </section>

      <section className="card summary-grid">
        <div>
          <span>Completed Steps</span>
          <strong>{completed}/{steps.length}</strong>
        </div>
        <div>
          <span>Challenge Score</span>
          <strong>{score}</strong>
        </div>
      </section>
    </ModulePage>
  )
}
