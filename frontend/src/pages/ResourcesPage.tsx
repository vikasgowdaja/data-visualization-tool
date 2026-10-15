import { Link } from 'react-router-dom'
import ModulePage from '../components/ModulePage'
import { ROUTES } from '../constants/routes'
import { resourcesCatalog } from '../features/learningContent'

export default function ResourcesPage() {
  return (
    <ModulePage
      title="Resources"
      purpose="Use practical references for cleaning, visualization, and interpretation decisions."
      status="available"
      nextActionLabel="Track Progress"
      nextActionTo={ROUTES.PROGRESS}
    >
      <section className="card dataset-grid">
        {resourcesCatalog.map((resource) => (
          <article key={resource.title} className="dataset-card">
            <h3>{resource.title}</h3>
            <p>{resource.description}</p>
            <Link className="text-link" to={resource.targetRoute}>
              Open Resource Module
            </Link>
          </article>
        ))}
      </section>
    </ModulePage>
  )
}
