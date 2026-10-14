import { Link } from 'react-router-dom'
import { ROUTES } from '../constants/routes'

export default function NotFoundPage() {
  return (
    <section className="module-page">
      <div className="card">
        <h1>Page not found</h1>
        <p>This route does not exist in DataScience Lab.</p>
        <Link className="button-link" to={ROUTES.HOME}>
          Go to Home
        </Link>
      </div>
    </section>
  )
}
