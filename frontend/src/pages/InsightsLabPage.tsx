import { useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import ModulePage from '../components/ModulePage'
import { ROUTES } from '../constants/routes'
import { logProgressEvent } from '../services/platform'

type Aspect = 'trend' | 'strength' | 'evidence' | 'exceptions' | 'outliers' | 'stat_language' | 'causation' | 'clarity'

const aspectRules: Record<Aspect, RegExp[]> = {
  trend: [/increase|decrease|trend|higher|lower/i],
  strength: [/strong|weak|moderate|clear/i],
  evidence: [/because|based on|average|median|correlation|value/i],
  exceptions: [/however|except|although|while/i],
  outliers: [/outlier|extreme|anomaly/i],
  stat_language: [/distribution|variance|std|percentile|quartile/i],
  causation: [/causes|cause|because of/i],
  clarity: [/recommend|decision|action|therefore|so/i],
}

export default function InsightsLabPage() {
  const [observation, setObservation] = useState('')
  const [evidence, setEvidence] = useState('')
  const [meaning, setMeaning] = useState('')
  const [decision, setDecision] = useState('')
  const [feedbackVisible, setFeedbackVisible] = useState(false)

  const fullText = `${observation} ${evidence} ${meaning} ${decision}`.trim()

  const feedback = useMemo(() => {
    const matches: Record<Aspect, boolean> = {
      trend: false,
      strength: false,
      evidence: false,
      exceptions: false,
      outliers: false,
      stat_language: false,
      causation: false,
      clarity: false,
    }

    ;(Object.keys(aspectRules) as Aspect[]).forEach((aspect) => {
      if (aspect === 'causation') {
        matches[aspect] = aspectRules[aspect].some((rule) => rule.test(fullText))
        return
      }
      matches[aspect] = aspectRules[aspect].some((rule) => rule.test(fullText))
    })

    const positive = ['trend', 'strength', 'evidence', 'exceptions', 'outliers', 'stat_language', 'clarity'].filter(
      (aspect) => matches[aspect as Aspect],
    ).length
    const penalty = matches.causation ? 1 : 0
    const score = Math.max(1, Math.min(5, positive - penalty))

    return {
      score,
      matches,
      positives: [
        matches.trend ? 'Trend direction is identified.' : '',
        matches.evidence ? 'Evidence-based language is present.' : '',
        matches.clarity ? 'Decision-oriented conclusion is present.' : '',
      ].filter(Boolean),
      missing: [
        !matches.strength ? 'Add strength qualifiers (strong/moderate/weak).' : '',
        !matches.exceptions ? 'Mention exceptions or boundary conditions.' : '',
        !matches.outliers ? 'Discuss possible outliers or anomalies.' : '',
        !matches.stat_language ? 'Use statistical terms to support interpretation.' : '',
      ].filter(Boolean),
      warning: matches.causation
        ? 'Causation phrasing detected. Correlation does not prove causation unless experimental design supports it.'
        : '',
    }
  }, [fullText])

  const checkInterpretation = () => {
    setFeedbackVisible(true)
    void logProgressEvent({
      module: 'insights-lab',
      event_type: 'interpretation_checked',
      score: feedback.score,
      metadata_json: JSON.stringify({ length: fullText.length }),
    })
  }

  const exportPdf = () => {
    const doc = new jsPDF()
    const lines = [
      'DataScience Lab Analysis Report',
      '',
      'Data:',
      observation || 'N/A',
      '',
      'Information/Evidence:',
      evidence || 'N/A',
      '',
      'Context:',
      meaning || 'N/A',
      '',
      'Wisdom/Decision:',
      decision || 'N/A',
      '',
      `Interpretation Score: ${feedback.score}/5`,
      feedback.warning ? `Warning: ${feedback.warning}` : 'No causation warning detected.',
    ]
    doc.setFontSize(12)
    let y = 12
    for (const line of lines) {
      const wrapped = doc.splitTextToSize(line, 180)
      doc.text(wrapped, 14, y)
      y += wrapped.length * 6
      if (y > 270) {
        doc.addPage()
        y = 12
      }
    }
    doc.save('datascience-lab-analysis-report.pdf')
    void logProgressEvent({ module: 'insights-lab', event_type: 'analysis_export_pdf', score: feedback.score })
  }

  return (
    <ModulePage
      title="Insights Lab"
      purpose="Move from data observations to information, context, wisdom, and decision-ready insights."
      status="available"
      nextActionLabel="Practice Questions"
      nextActionTo={ROUTES.PRACTICE}
    >
      <section className="card">
        <h3>DIKW Reflection Flow</h3>
        <div className="form-grid">
          <label>
            Data: What do you observe?
            <textarea value={observation} onChange={(event) => setObservation(event.target.value)} rows={4} />
          </label>
          <label>
            Information: What evidence supports this?
            <textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} rows={4} />
          </label>
          <label>
            Context: Why might it matter?
            <textarea value={meaning} onChange={(event) => setMeaning(event.target.value)} rows={4} />
          </label>
          <label>
            Wisdom: What decision could it support?
            <textarea value={decision} onChange={(event) => setDecision(event.target.value)} rows={4} />
          </label>
        </div>
        <div className="button-row">
          <button type="button" className="primary" onClick={checkInterpretation}>
            Check Interpretation
          </button>
          <button type="button" className="ghost" onClick={exportPdf}>
            Export PDF Report
          </button>
        </div>
      </section>

      {feedbackVisible && (
        <section className="card">
          <h3>Interpretation Checker 2.0</h3>
          <p>Score: {feedback.score}/5</p>
          {feedback.warning && <p>{feedback.warning}</p>}
          <h4>What you did well</h4>
          {feedback.positives.length === 0 ? <p>No strong signals yet.</p> : <ul>{feedback.positives.map((item) => <li key={item}>{item}</li>)}</ul>}
          <h4>What is missing</h4>
          {feedback.missing.length === 0 ? <p>Coverage is strong across key dimensions.</p> : <ul>{feedback.missing.map((item) => <li key={item}>{item}</li>)}</ul>}
          <h4>Suggested direction</h4>
          <p>Write one clear trend sentence, one numeric evidence sentence, and one action sentence.</p>
        </section>
      )}
    </ModulePage>
  )
}
