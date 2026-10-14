import { useMemo, useState } from 'react'
import ModulePage from '../components/ModulePage'
import { ROUTES } from '../constants/routes'
import { practiceQuestionBank } from '../features/learningContent'
import { logProgressEvent } from '../services/platform'

type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export default function PracticePage() {
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState('')
  const [correct, setCorrect] = useState(0)
  const [attempted, setAttempted] = useState(0)
  const [feedback, setFeedback] = useState('Select an answer and submit.')

  const filtered = useMemo(
    () => practiceQuestionBank.filter((item) => item.difficulty === difficulty || difficulty === 'advanced'),
    [difficulty],
  )
  const question = filtered[currentIndex]

  const submit = () => {
    if (!question || !selected) {
      setFeedback('Please select an answer first.')
      return
    }
    const isCorrect = selected === question.answer
    setAttempted((prev) => prev + 1)
    if (isCorrect) {
      setCorrect((prev) => prev + 1)
      setFeedback('Correct. Good reasoning.')
    } else {
      setFeedback(`Not correct. Correct answer: ${question.answer}`)
    }
    void logProgressEvent({
      module: 'practice',
      event_type: 'question_attempted',
      score: isCorrect ? 1 : 0,
      metadata_json: JSON.stringify({ questionId: question.id, difficulty }),
    })
  }

  const next = () => {
    if (filtered.length === 0) return
    setCurrentIndex((prev) => (prev + 1) % filtered.length)
    setSelected('')
    setFeedback('Select an answer and submit.')
  }

  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0

  return (
    <ModulePage
      title="Practice"
      purpose="Practice statistical thinking, chart selection, and interpretation decisions."
      status="available"
      nextActionLabel="Start Challenge"
      nextActionTo={ROUTES.CHALLENGES}
    >
      <section className="card">
        <div className="form-grid">
          <label>
            Difficulty
            <select
              value={difficulty}
              onChange={(event) => {
                setDifficulty(event.target.value as Difficulty)
                setCurrentIndex(0)
                setSelected('')
              }}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        {!question && <p>No practice questions available for this level yet.</p>}
        {question && (
          <>
            <p>Type: {question.type}</p>
            <h3>{question.question}</h3>
            <div className="button-row">
              {question.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={selected === option ? 'primary' : 'ghost'}
                  onClick={() => setSelected(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="button-row">
              <button type="button" className="primary" onClick={submit}>
                Submit
              </button>
              <button type="button" className="ghost" onClick={next}>
                Next Question
              </button>
            </div>
            <p>{feedback}</p>
          </>
        )}
      </section>

      <section className="card summary-grid">
        <div>
          <span>Attempted</span>
          <strong>{attempted}</strong>
        </div>
        <div>
          <span>Correct</span>
          <strong>{correct}</strong>
        </div>
        <div>
          <span>Accuracy</span>
          <strong>{accuracy}%</strong>
        </div>
      </section>
    </ModulePage>
  )
}
