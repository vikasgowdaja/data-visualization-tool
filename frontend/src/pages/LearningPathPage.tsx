import { useQuery } from '@tanstack/react-query'
import ModulePage from '../components/ModulePage'
import { ROUTES } from '../constants/routes'
import { learningPathLevels } from '../features/learningContent'
import { fetchProgressSummary } from '../services/platform'

export default function LearningPathPage() {
  const progressQuery = useQuery({
    queryKey: ['progress-summary', 'learning-path'],
    queryFn: fetchProgressSummary,
  })

  const eventCount = progressQuery.data?.total_events ?? 0

  return (
    <ModulePage
      title="Learning Path"
      purpose="Track progression from fundamentals to applied data science practice."
      status="available"
      nextActionLabel="Begin with Learn Module"
      nextActionTo={ROUTES.LEARN}
    >
      <section className="card">
        <p>Total learning events captured: {eventCount}</p>
        {progressQuery.isLoading && <p>Loading progress state...</p>}
        <ul className="simple-list">
          {learningPathLevels.map((level, idx) => (
            <li key={level}>
              {level} - {idx < Math.floor(eventCount / 3) ? 'Completed' : idx === Math.floor(eventCount / 3) ? 'In Progress' : 'Available'}
            </li>
          ))}
        </ul>
      </section>
    </ModulePage>
  )
}
