import ModulePage from '../components/ModulePage'

const courseObjectives = [
  'Develop a clear understanding of data visualization concepts and business use cases.',
  'Train students to transform raw data into meaningful insights and actionable stories.',
  'Strengthen analytical thinking through hands-on lab work and guided interpretation.',
  'Prepare learners to communicate findings confidently in academic and professional contexts.',
]

const courseOutcomes = [
  'Students can explain the purpose and value of data-driven decision-making.',
  'Students can choose appropriate visualizations for different analytical objectives.',
  'Students can interpret trends, patterns, anomalies, and evidence-based conclusions.',
  'Students can present insights with clarity, accuracy, and practical recommendations.',
]

const trainerDetails = [
  {
    name: 'Dr. Ananya Nair',
    role: 'Lead Trainer',
    expertise: 'Advanced data storytelling, visualization design, and outcome-based learning.',
  },
  {
    name: 'Mr. Rahul Mehta',
    role: 'Mentor & Lab Facilitator',
    expertise: 'Hands-on practice, lab execution, and student feedback support.',
  },
]

const sessionPlan = [
  {
    session: 'Session 1',
    purpose: 'Orientation and foundation',
    delivered: 'Introduced course goals, data literacy framework, and core concepts.',
    outcome: 'Students understood the scope of the program and expected learning outcomes.',
    roadmap: 'Continue with data interpretation and basic visualization techniques.',
  },
  {
    session: 'Session 2',
    purpose: 'Data cleaning and preparation',
    delivered: 'Covered missing values, data quality checks, and exploratory analysis.',
    outcome: 'Students gained confidence in preparing data before analysis.',
    roadmap: 'Move to chart selection and pattern recognition.',
  },
  {
    session: 'Session 3',
    purpose: 'Visualization and analysis',
    delivered: 'Taught charts, comparisons, trend detection, and interpretation strategies.',
    outcome: 'Students could map analytical questions to suitable chart types.',
    roadmap: 'Advance into insight generation and evidence-based recommendations.',
  },
  {
    session: 'Session 4',
    purpose: 'Insight communication',
    delivered: 'Focused on interpreting results, summarizing conclusions, and presenting recommendations.',
    outcome: 'Students improved decision-making communication and result articulation.',
    roadmap: 'Support students with capstone-level reflection and future skill development.',
  },
]

const studentFeedback = [
  {
    name: 'Aisha',
    rating: 5,
    note: 'The sessions were practical and easy to follow. I now understand how to interpret charts more confidently.',
  },
  {
    name: 'Rohan',
    rating: 4,
    note: 'The trainers made the concepts simple and connected them to real-world data problems.',
  },
  {
    name: 'Sneha',
    rating: 5,
    note: 'The structured approach from fundamentals to insights helped me apply the knowledge effectively.',
  },
]

const outcomeMetrics = [
  { metric: 'Course outcome attainment', actual: 92, target: 85 },
  { metric: 'Student satisfaction', actual: 94, target: 90 },
  { metric: 'Practical skill confidence', actual: 89, target: 80 },
  { metric: 'Insight communication quality', actual: 91, target: 85 },
]

const averageRating = Math.round(
  (studentFeedback.reduce((total, item) => total + item.rating, 0) / studentFeedback.length) * 10,
) / 10

export default function TrainingReportPage() {
  return (
    <ModulePage
      title="Training Report"
      purpose="A consolidated record of the training objective, delivery structure, trainer engagement, student feedback, and measured outcomes."
      status="available"
      nextActionLabel="Open Learning Path"
      nextActionTo="/learning-path"
    >
      <section className="card training-report-page">
        <div className="report-summary-grid">
          <div className="report-summary-card">
            <span>Course Objective</span>
            <strong>Build data visualization, interpretation, and evidence-based communication skills.</strong>
          </div>
          <div className="report-summary-card">
            <span>Course Outcome</span>
            <strong>Students can analyze, interpret, and present data insights confidently.</strong>
          </div>
          <div className="report-summary-card">
            <span>Trainer Feedback Score</span>
            <strong>{averageRating}/5 average rating</strong>
          </div>
        </div>

        <div className="report-section">
          <h2>1. Objective of the Course</h2>
          <ul className="simple-list">
            {courseObjectives.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="report-section report-grid">
          <div>
            <h2>2. Course Outcome</h2>
            <ul className="simple-list">
              {courseOutcomes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2>3. Trainer Details</h2>
            <div className="trainer-grid">
              {trainerDetails.map((trainer) => (
                <article key={trainer.name} className="trainer-card">
                  <h3>{trainer.name}</h3>
                  <p>
                    <strong>{trainer.role}</strong>
                  </p>
                  <p>{trainer.expertise}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="report-section">
          <h2>4. How the Course Was Conducted</h2>
          <table className="report-table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Purpose</th>
                <th>What was delivered</th>
                <th>Outcome</th>
                <th>Future roadmap</th>
              </tr>
            </thead>
            <tbody>
              {sessionPlan.map((item) => (
                <tr key={item.session}>
                  <td>{item.session}</td>
                  <td>{item.purpose}</td>
                  <td>{item.delivered}</td>
                  <td>{item.outcome}</td>
                  <td>{item.roadmap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="report-section report-grid">
          <div>
            <h2>5. Students Feedback (Trainer Provided)</h2>
            <div className="feedback-list">
              {studentFeedback.map((entry) => (
                <article key={entry.name} className="feedback-card">
                  <div className="feedback-header">
                    <strong>{entry.name}</strong>
                    <span>{'⭐'.repeat(entry.rating)}</span>
                  </div>
                  <p>{entry.note}</p>
                </article>
              ))}
            </div>
          </div>

          <div>
            <h2>6. Measured Feedback Against Course Outcome</h2>
            <div className="metric-list">
              {outcomeMetrics.map((metric) => (
                <div key={metric.metric} className="metric-card">
                  <div className="metric-header">
                    <span>{metric.metric}</span>
                    <strong>{metric.actual}%</strong>
                  </div>
                  <div className="progress-bar" aria-label={`${metric.metric} progress`}>
                    <span style={{ width: `${metric.actual}%` }} />
                  </div>
                  <p>Target: {metric.target}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="report-section report-summary-box">
          <h2>Overall Training Assessment</h2>
          <p>
            The training achieved its learning objectives effectively. Students demonstrated improved understanding of
            data interpretation, practical analysis, and communication of insights. The measured feedback indicates strong
            alignment between the course outcomes and student performance, validating the success of the methodology.
          </p>
        </div>
      </section>
    </ModulePage>
  )
}
