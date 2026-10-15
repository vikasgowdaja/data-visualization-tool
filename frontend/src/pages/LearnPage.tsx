import ModulePage from '../components/ModulePage'
import { ROUTES } from '../constants/routes'
import { learningModules } from '../features/learningContent'
import { logProgressEvent } from '../services/platform'

export default function LearnPage() {
  const markComplete = (moduleId: string) => {
    void logProgressEvent({
      module: 'learn',
      event_type: 'module_completed',
      metadata_json: JSON.stringify({ moduleId }),
    })
  }

  return (
    <ModulePage
      title="Learn"
      purpose="Connect concepts to practical labs using structured modules."
      status="in-progress"
      nextActionLabel="Open Data Explorer Activity"
      nextActionTo={ROUTES.DATA_EXPLORER}
    >
      <section className="card">
        <h2>Learning Modules</h2>
        <div className="dataset-grid">
          {learningModules.map((item) => (
            <article key={item.id} className="dataset-card">
              <h3>{item.title}</h3>
              <p>Concept: {item.concept}</p>
              <p>Interactive activity: {item.activity}</p>
              <p>Key takeaway: {item.takeaway}</p>
              <div className="button-row">
                <button type="button" className="ghost" onClick={() => markComplete(item.id)}>
                  Mark Completed
                </button>
              </div>
            </article>
          ))}
        </div>
        <p>Each module will include concept, example, interactive activity, reflection, practice, and key takeaway.</p>
      </section>
    </ModulePage>
  )
}
