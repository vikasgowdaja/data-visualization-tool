import { toNumber, groupMean, histogram, correlation, getOutlierCount } from './utils/dataMath'
import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

type Project = {
  id: DatasetId
  title: string
  description: string
}

type DataRow = Record<string, string | number | null>

type DatasetSummary = {
  dataset_id: string
  dataset_name: string
  rows: number
  columns: number
  target_suggestion: string
  difficulty: string
  column_descriptions: Record<string, string>
  data_types: Record<string, string>
  missing_summary: Record<string, number>
  preview: Array<DataRow>
  suggested_questions: string[]
}

type DatasetId =
  | 'student_performance'
  | 'house_prices'
  | 'customer_churn'
  | 'movie_success'
  | 'retail_sales'
  | 'environmental_data'

type DatasetPayload = {
  dataset: DatasetId
  num_records: number
  include_missing_values: boolean
  include_outliers: boolean
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

type RowsResponse = {
  dataset_id: string
  rows: DataRow[]
}

type LearningSection = {
  title: string
  learningGoal: string
  whatToDo: string
  whatToObserve: string
  outcome: string
}

type FeedbackResult = {
  level: 'excellent' | 'good' | 'improve'
  score: number
  message: string
  detected: {
    trend: string[]
    evidence: string[]
    decision: string[]
    chartSpecific: string[]
  }
  weighted: {
    trend: number
    evidence: number
    decision: number
    chartSpecific: number
    total: number
    max: number
  }
}

const configuredApiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
const isConfiguredLocalTarget =
  !!configuredApiBase && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configuredApiBase)
const inferredApiBase = isLocalHost ? 'http://localhost:8000/api' : '/api'
const API_BASE = (
  configuredApiBase && configuredApiBase.length > 0 && (isLocalHost || !isConfiguredLocalTarget)
    ? configuredApiBase
    : inferredApiBase
).replace(
  /\/$/,
  '',
)

const projects: Project[] = [
  {
    id: 'student_performance',
    title: 'Student Performance',
    description: 'Predict student final performance.',
  },
  {
    id: 'house_prices',
    title: 'House Prices',
    description: 'Analyze and predict house prices.',
  },
  {
    id: 'customer_churn',
    title: 'Customer Churn',
    description: 'Understand why customers leave.',
  },
  {
    id: 'movie_success',
    title: 'Movie Success',
    description: 'Analyze factors associated with movie success.',
  },
  {
    id: 'retail_sales',
    title: 'Retail Sales',
    description: 'Analyze sales and predict future outcomes.',
  },
  {
    id: 'environmental_data',
    title: 'Environmental Data',
    description: 'Analyze temperature, rainfall, and pollution variables.',
  },
]

function getInterpretationPrompt(
  chartType: 'scatter' | 'bar' | 'line' | 'histogram',
  xAxis: string,
  yAxis: string,
): string {
  if (chartType === 'scatter') {
    return `Describe the relationship between ${xAxis} and ${yAxis}. Mention trend direction and any unusual points.`
  }
  if (chartType === 'line') {
    return `Describe how ${yAxis} changes as ${xAxis} changes. Mention whether the pattern is stable or fluctuating.`
  }
  if (chartType === 'bar') {
    return `Compare groups and identify which category has the highest and lowest average ${yAxis}.`
  }
  return `Describe the distribution of ${xAxis}: center, spread, and whether there are extreme values.`
}

function evaluateInterpretation(
  chartType: 'scatter' | 'bar' | 'line' | 'histogram',
  text: string,
): FeedbackResult {
  const normalized = text.trim().toLowerCase()
  if (normalized.length < 35) {
    return {
      level: 'improve',
      score: 2,
      message: 'Add more detail. Mention what the graph shows and what it means for decision-making.',
      detected: {
        trend: [],
        evidence: [],
        decision: [],
        chartSpecific: [],
      },
      weighted: {
        trend: 0,
        evidence: 0,
        decision: 0,
        chartSpecific: 0,
        total: 0,
        max: 8,
      },
    }
  }

  const trendWords = ['increase', 'decrease', 'higher', 'lower', 'positive', 'negative', 'trend', 'relation']
  const evidenceWords = ['average', 'most', 'least', 'outlier', 'spread', 'distribution', 'cluster', 'group', 'better']
  const decisionWords = ['therefore', 'so', 'recommend', 'action', 'decision', 'should', 'focus']
  const trendPhrases = [
    { label: 'higher attendance leads to better scores', regex: /higher\s+attendance.*(better|higher)\s+scores?/i },
    { label: 'more study hours improve scores', regex: /(more|higher)\s+study\s+hours.*(improve|increase|higher)\s+scores?/i },
    { label: 'as x increases y increases', regex: /as\s+\w+\s+increases?,?\s+\w+\s+increases?/i },
    { label: 'negative relationship', regex: /negative\s+(relationship|correlation)/i },
    { label: 'positive relationship', regex: /positive\s+(relationship|correlation)/i },
  ]
  const evidencePhrases = [
    { label: 'highest average', regex: /highest\s+average/i },
    { label: 'lowest average', regex: /lowest\s+average/i },
    { label: 'majority of students', regex: /majority\s+of\s+students/i },
    { label: 'most students', regex: /most\s+students/i },
    { label: 'clear outlier', regex: /clear\s+outlier/i },
    {
      label: 'group performing better',
      regex: /\b(?:non[- ]binary|male|female|group|students?)\b.*\b(performs?|performing|scores?)\b.*\b(better|higher)\b/i,
    },
  ]
  const decisionPhrases = [
    { label: 'we should focus on', regex: /we\s+should\s+focus\s+on/i },
    { label: 'this suggests that', regex: /this\s+suggests\s+that/i },
    { label: 'recommended action', regex: /recommended\s+action/i },
    { label: 'based on this we can', regex: /based\s+on\s+this\s+we\s+can/i },
    { label: 'therefore we should', regex: /therefore\s+we\s+should/i },
  ]
  const chartNeedle: Record<'scatter' | 'bar' | 'line' | 'histogram', string[]> = {
    scatter: ['relationship', 'trend', 'outlier', 'cluster'],
    bar: ['group', 'highest', 'lowest', 'average'],
    line: ['change', 'pattern', 'fluctuate', 'stable'],
    histogram: ['distribution', 'range', 'spread', 'extreme'],
  }
  const chartPhrases: Record<'scatter' | 'bar' | 'line' | 'histogram', Array<{ label: string; regex: RegExp }>> = {
    scatter: [
      { label: 'upward trend', regex: /upward\s+trend/i },
      { label: 'downward trend', regex: /downward\s+trend/i },
      { label: 'points are clustered', regex: /points?\s+(are\s+)?clustered/i },
    ],
    bar: [
      { label: 'highest group', regex: /highest\s+group/i },
      { label: 'lowest group', regex: /lowest\s+group/i },
      { label: 'group comparison', regex: /group\s+comparison/i },
      { label: 'performing better', regex: /performing\s+better|scores?\s+(higher|better)/i },
    ],
    line: [
      { label: 'gradual increase', regex: /gradual\s+increase/i },
      { label: 'sharp drop', regex: /sharp\s+drop/i },
      { label: 'fluctuating pattern', regex: /fluctuating\s+pattern/i },
    ],
    histogram: [
      { label: 'right skewed', regex: /right\s+skewed/i },
      { label: 'left skewed', regex: /left\s+skewed/i },
      { label: 'normal distribution', regex: /normal\s+distribution/i },
    ],
  }

  const phraseMatches = (patterns: Array<{ label: string; regex: RegExp }>) =>
    patterns.filter((pattern) => pattern.regex.test(text)).map((pattern) => pattern.label)

  const trendMatches = Array.from(
    new Set([...trendWords.filter((word) => normalized.includes(word)), ...phraseMatches(trendPhrases)]),
  )
  const evidenceMatches = Array.from(
    new Set([...evidenceWords.filter((word) => normalized.includes(word)), ...phraseMatches(evidencePhrases)]),
  )
  const decisionMatches = Array.from(
    new Set([...decisionWords.filter((word) => normalized.includes(word)), ...phraseMatches(decisionPhrases)]),
  )
  const chartSpecificMatches = Array.from(
    new Set([
      ...chartNeedle[chartType].filter((word) => normalized.includes(word)),
      ...phraseMatches(chartPhrases[chartType]),
    ]),
  )

  const hasTrend = trendMatches.length > 0
  const hasEvidence = evidenceMatches.length > 0
  const hasDecision = decisionMatches.length > 0
  const hasChartSpecific = chartSpecificMatches.length > 0

  const trendPhraseCount = phraseMatches(trendPhrases).length
  const evidencePhraseCount = phraseMatches(evidencePhrases).length
  const decisionPhraseCount = phraseMatches(decisionPhrases).length
  const chartPhraseCount = phraseMatches(chartPhrases[chartType]).length

  const weightCategory = (hasKeyword: boolean, phraseCount: number): number => {
    if (!hasKeyword && phraseCount === 0) {
      return 0
    }
    const base = hasKeyword ? 1 : 0
    const phraseBonus = Math.min(1, phraseCount)
    return base + phraseBonus
  }

  const weighted = {
    trend: weightCategory(hasTrend, trendPhraseCount),
    evidence: weightCategory(hasEvidence, evidencePhraseCount),
    decision: weightCategory(hasDecision, decisionPhraseCount),
    chartSpecific: weightCategory(hasChartSpecific, chartPhraseCount),
    total: 0,
    max: 8,
  }

  const relevantByChart: Record<'scatter' | 'bar' | 'line' | 'histogram', Array<keyof typeof weighted>> = {
    scatter: ['trend', 'evidence', 'decision', 'chartSpecific'],
    line: ['trend', 'evidence', 'decision', 'chartSpecific'],
    bar: ['evidence', 'decision', 'chartSpecific'],
    histogram: ['evidence', 'decision', 'chartSpecific'],
  }

  const relevant = relevantByChart[chartType]
  weighted.total = relevant.reduce((acc, key) => acc + weighted[key], 0)
  weighted.max = relevant.length * 2

  const score = Math.max(1, Math.round((weighted.total / weighted.max) * 5))
  const ratio = weighted.total / weighted.max

  const detected = {
    trend: trendMatches,
    evidence: evidenceMatches,
    decision: decisionMatches,
    chartSpecific: chartSpecificMatches,
  }

  if (ratio >= 0.75) {
    return {
      level: 'excellent',
      score: 5,
      message: 'Excellent interpretation. Strong phrase-level reasoning was detected across key categories.',
      detected,
      weighted,
    }
  }
  if (ratio >= 0.45) {
    return {
      level: 'good',
      score: Math.max(3, score),
      message: 'Good start. Add more complete analytical phrases to strengthen evidence and decision quality.',
      detected,
      weighted,
    }
  }
  return {
    level: 'improve',
    score,
    message: 'Try again with this structure: trend phrase, evidence phrase, then a clear action phrase.',
    detected,
    weighted,
  }
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderHighlightedText(text: string, words: string[]): Array<{ text: string; highlighted: boolean }> {
  if (!text.trim() || words.length === 0) {
    return [{ text, highlighted: false }]
  }

  const uniqueWords = Array.from(new Set(words)).sort((a, b) => b.length - a.length)
  const pattern = uniqueWords.map((word) => escapeRegExp(word)).join('|')
  if (!pattern) {
    return [{ text, highlighted: false }]
  }

  const regex = new RegExp(`(${pattern})`, 'gi')
  const fragments = text.split(regex)
  return fragments.filter(Boolean).map((fragment) => {
    const highlighted = uniqueWords.some((word) => fragment.toLowerCase() === word.toLowerCase())
    return { text: fragment, highlighted }
  })
}

function App() {
  const [selectedProject, setSelectedProject] = useState<DatasetId>('student_performance')
  const [numRecords, setNumRecords] = useState<number>(500)
  const [includeMissingValues, setIncludeMissingValues] = useState(true)
  const [includeOutliers, setIncludeOutliers] = useState(true)
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner')
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(null)
  const [datasetRows, setDatasetRows] = useState<DataRow[]>([])
  const [statusMessage, setStatusMessage] = useState('Generate your first dataset to begin.')
  const [chartType, setChartType] = useState<'scatter' | 'bar' | 'line' | 'histogram'>('scatter')
  const [xAxis, setXAxis] = useState('')
  const [yAxis, setYAxis] = useState('')
  const [interpretations, setInterpretations] = useState<Record<'scatter' | 'bar' | 'line' | 'histogram', string>>({
    scatter: '',
    bar: '',
    line: '',
    histogram: '',
  })
  const [feedbackByChart, setFeedbackByChart] = useState<
    Partial<Record<'scatter' | 'bar' | 'line' | 'histogram', FeedbackResult>>
  >({})
  const [learningPage, setLearningPage] = useState<'data' | 'information' | 'context' | 'wisdom'>('data')

  const fetchRows = async (datasetId: string) => {
    const response = await axios.get<RowsResponse>(`${API_BASE}/datasets/${datasetId}/rows`)
    setDatasetRows(response.data.rows)
  }

  const generateMutation = useMutation({
    mutationFn: async (payload: DatasetPayload) => {
      const response = await axios.post<DatasetSummary>(`${API_BASE}/datasets/generate`, payload)
      return response.data
    },
    onSuccess: (data) => {
      setDatasetSummary(data)
      void fetchRows(data.dataset_id)
      setStatusMessage('Dataset generated successfully. Visualize it and review insights below.')
    },
    onError: (error) => {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.detail ?? error.message
        : 'Failed to generate dataset.'
      setStatusMessage(String(message))
    },
  })

  const resetMutation = useMutation({
    mutationFn: async (datasetId: string) => {
      await axios.delete(`${API_BASE}/datasets/${datasetId}`)
    },
    onSuccess: () => {
      setDatasetSummary(null)
      setDatasetRows([])
      setStatusMessage('Dataset reset complete. Generate a new one when ready.')
    },
    onError: () => {
      setStatusMessage('Could not reset dataset right now. Please try again.')
    },
  })

  const selectedProjectTitle =
    useMemo(() => projects.find((project) => project.id === selectedProject)?.title, [selectedProject]) ??
    'Student Performance'

  const numericColumns = useMemo(() => {
    if (!datasetSummary) {
      return []
    }
    return Object.entries(datasetSummary.data_types)
      .filter(([, dtype]) => dtype === 'int' || dtype === 'float')
      .map(([name]) => name)
  }, [datasetSummary])

  const categoricalColumns = useMemo(() => {
    if (!datasetSummary) {
      return []
    }
    return Object.entries(datasetSummary.data_types)
      .filter(([, dtype]) => dtype === 'str')
      .map(([name]) => name)
  }, [datasetSummary])

  useEffect(() => {
    if (numericColumns.length === 0) {
      setXAxis('')
      setYAxis('')
      return
    }

    const target = datasetSummary?.target_suggestion ?? ''
    const nextY = numericColumns.includes(target) ? target : numericColumns[numericColumns.length - 1]
    const nextX = numericColumns.find((column) => column !== nextY) ?? numericColumns[0]

    if (!numericColumns.includes(xAxis)) {
      setXAxis(nextX)
    }
    if (!numericColumns.includes(yAxis)) {
      setYAxis(nextY)
    }
  }, [datasetSummary, numericColumns, xAxis, yAxis])

  const chartXAxis = useMemo(() => {
    if (numericColumns.includes(xAxis)) {
      return xAxis
    }
    const target = datasetSummary?.target_suggestion ?? ''
    return numericColumns.find((column) => column !== target) ?? numericColumns[0] ?? ''
  }, [datasetSummary, numericColumns, xAxis])

  const chartYAxis = useMemo(() => {
    if (numericColumns.includes(yAxis)) {
      return yAxis
    }
    const target = datasetSummary?.target_suggestion ?? ''
    if (numericColumns.includes(target)) {
      return target
    }
    return numericColumns[numericColumns.length - 1] ?? ''
  }, [datasetSummary, numericColumns, yAxis])

  const scatterLineData = useMemo(
    () =>
      datasetRows
        .map((row) => ({
          x: toNumber(row[chartXAxis]),
          y: toNumber(row[chartYAxis]),
        }))
        .filter((row): row is { x: number; y: number } => row.x !== null && row.y !== null)
        .slice(0, 450),
    [datasetRows, chartXAxis, chartYAxis],
  )

  const barChartData = useMemo(() => {
    const groupKey = categoricalColumns[0]
    if (!groupKey || !chartYAxis) {
      return []
    }
    return groupMean(datasetRows, groupKey, chartYAxis).sort((a, b) => b.value - a.value)
  }, [datasetRows, chartYAxis, categoricalColumns])

  const histogramData = useMemo(() => histogram(datasetRows, chartXAxis), [datasetRows, chartXAxis])

  const insightCards = useMemo(() => {
    if (!datasetSummary || datasetRows.length === 0) {
      return []
    }

    const target = datasetSummary.target_suggestion
    const numericTarget = numericColumns.includes(target)
    const targetValues = datasetRows
      .map((row) => toNumber(row[target]))
      .filter((value): value is number => value !== null)
    const nonTargetNumeric = numericColumns.filter((column) => column !== target)
    const bestCorrelation = nonTargetNumeric
      .map((column) => ({ column, value: correlation(datasetRows, column, target) }))
      .filter((item): item is { column: string; value: number } => item.value !== null)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0]
    const topGroup =
      numericTarget && categoricalColumns.length > 0 ? groupMean(datasetRows, categoricalColumns[0], target).sort((a, b) => b.value - a.value)[0] : null
    const avgTarget =
      targetValues.length > 0
        ? Number((targetValues.reduce((acc, value) => acc + value, 0) / targetValues.length).toFixed(2))
        : 0

    const classBreakdown = new Map<string, number>()
    if (!numericTarget) {
      for (const row of datasetRows) {
        const key = String(row[target] ?? 'Unknown')
        classBreakdown.set(key, (classBreakdown.get(key) ?? 0) + 1)
      }
    }
    const topClass = Array.from(classBreakdown.entries()).sort((a, b) => b[1] - a[1])[0]

    return [
      {
        title: 'Data',
        text: `Rows: ${datasetSummary.rows}, Columns: ${datasetSummary.columns}, Missing cells: ${Object.values(
          datasetSummary.missing_summary,
        ).reduce((acc, value) => acc + value, 0)}.`,
      },
      {
        title: 'Information',
        text: numericTarget
          ? `Average ${target} is ${avgTarget}. Strongest feature relation: ${bestCorrelation?.column ?? 'NA'} (${bestCorrelation?.value ?? 'NA'}).`
          : `Most frequent target class: ${topClass?.[0] ?? 'NA'} (${topClass?.[1] ?? 0} rows).`,
      },
      {
        title: 'Context',
        text:
          numericTarget && topGroup
            ? `Top ${categoricalColumns[0]} group by average ${target}: ${topGroup.name} (${topGroup.value}).`
            : `Use column descriptions and missing-value summary to judge reliability before modeling decisions.`,
      },
      {
        title: 'Wisdom',
        text: `Prioritize data cleaning and feature checks first, then design actions linked to ${target}.`,
      },
    ]
  }, [datasetSummary, datasetRows, numericColumns, categoricalColumns])

  const meritsDemerits = useMemo(() => {
    if (!datasetSummary || datasetRows.length === 0) {
      return { merits: [], demerits: [] }
    }

    const target = datasetSummary.target_suggestion
    const numericTarget = numericColumns.includes(target)
    const targetValues = datasetRows
      .map((row) => toNumber(row[target]))
      .filter((value): value is number => value !== null)
    const outliers = getOutlierCount(targetValues)

    const classBreakdown = new Map<string, number>()
    if (!numericTarget) {
      for (const row of datasetRows) {
        const key = String(row[target] ?? 'Unknown')
        classBreakdown.set(key, (classBreakdown.get(key) ?? 0) + 1)
      }
    }
    const topClass = Array.from(classBreakdown.entries()).sort((a, b) => b[1] - a[1])[0]
    const topClassShare = topClass ? ((topClass[1] / datasetSummary.rows) * 100).toFixed(1) : null

    return {
      merits: [
        'Contains both numerical and categorical variables, useful for full data science workflow practice.',
        `Target variable (${target}) is clearly identified for modeling activities.`,
        `Dataset size (${datasetSummary.rows} rows) is good for beginner model experiments.`,
      ],
      demerits: [
        'Generated data may not represent all real-world conditions.',
        numericTarget
          ? `Potential outliers detected in ${target}: ${outliers}. This can affect model stability if not handled.`
          : `Possible class imbalance: ${topClass?.[0] ?? 'NA'} is about ${topClassShare ?? '0.0'}% of records.`,
        'Correlation does not prove cause and effect; domain context must guide final decisions.',
      ],
    }
  }, [datasetSummary, datasetRows, numericColumns])

  const learningSections: Record<'data' | 'information' | 'context' | 'wisdom', LearningSection> = {
    data: {
      title: 'Page 1: Data',
      learningGoal: 'Understand what raw data is and what each column means.',
      whatToDo: 'Review preview table, missing-value summary, and data types.',
      whatToObserve: 'Identify numeric vs categorical columns and noisy values.',
      outcome: 'You can describe the dataset structure clearly.',
    },
    information: {
      title: 'Page 2: Information',
      learningGoal: 'Convert raw rows into statistics and patterns.',
      whatToDo: 'Use the chart builder and summary cards to inspect distributions and relationships.',
      whatToObserve: 'Notice which features show stronger association with the chosen target.',
      outcome: 'You can report findings with evidence.',
    },
    context: {
      title: 'Page 3: Context',
      learningGoal: 'Explain why findings matter in a real decision-making setting.',
      whatToDo: 'Compare key groups and consider data collection limitations.',
      whatToObserve: 'Recognize where data may be biased or incomplete.',
      outcome: 'You can connect analysis to practical context.',
    },
    wisdom: {
      title: 'Page 4: Wisdom',
      learningGoal: 'Turn context-aware insights into better decisions.',
      whatToDo: 'Review merits, demerits, and recommendation panel.',
      whatToObserve: 'Balance prediction output with limitations and ethics.',
      outcome: 'You can suggest responsible actions from data outcomes.',
    },
  }

  const activeInterpretation = interpretations[chartType]
  const activeFeedback = feedbackByChart[chartType]
  const highlightedFragments = useMemo(() => {
    if (!activeFeedback) {
      return []
    }
    const words = [
      ...activeFeedback.detected.trend,
      ...activeFeedback.detected.evidence,
      ...activeFeedback.detected.decision,
      ...activeFeedback.detected.chartSpecific,
    ]
    return renderHighlightedText(activeInterpretation, words)
  }, [activeFeedback, activeInterpretation])

  const handleInterpretationSubmit = () => {
    const result = evaluateInterpretation(chartType, activeInterpretation)
    setFeedbackByChart((prev) => ({ ...prev, [chartType]: result }))
  }

  const handleGenerate = () => {
    generateMutation.mutate({
      dataset: selectedProject,
      num_records: numRecords,
      include_missing_values: includeMissingValues,
      include_outliers: includeOutliers,
      difficulty,
    })
  }

  const handleReset = () => {
    if (!datasetSummary) {
      return
    }
    resetMutation.mutate(datasetSummary.dataset_id)
  }

  const handleDownload = () => {
    if (!datasetSummary) {
      return
    }
    window.open(`${API_BASE}/datasets/${datasetSummary.dataset_id}/download`, '_blank')
  }

  return (
    <div className="lab-shell">
      <header className="hero-panel">
        <p className="eyebrow">DataScience Lab</p>
        <h1>Welcome to DataScience Lab</h1>
        <p className="hero-subtitle">
          Start with data. Ask questions. Write code. Discover patterns. Build predictions.
        </p>
      </header>

      <section className="project-grid">
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            className={`project-card ${selectedProject === project.id ? 'active' : ''}`}
            onClick={() => setSelectedProject(project.id)}
          >
            <h2>{project.title}</h2>
            <p>{project.description}</p>
          </button>
        ))}
      </section>

      <section className="generator-layout">
        <article className="card controls-card">
          <h3>Dataset Generator</h3>
          <div className="form-grid">
            <label>
              Dataset
              <select value={selectedProject} onChange={(event) => setSelectedProject(event.target.value as DatasetId)}>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Number of records
              <input
                type="number"
                value={numRecords}
                min={100}
                max={5000}
                onChange={(event) => setNumRecords(Number(event.target.value) || 500)}
              />
            </label>
            <label>
              Difficulty
              <select
                value={difficulty}
                onChange={(event) =>
                  setDifficulty(event.target.value as 'beginner' | 'intermediate' | 'advanced')
                }
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
          </div>

          <div className="toggle-row">
            <label className="toggle">
              <input
                type="checkbox"
                checked={includeMissingValues}
                onChange={(event) => setIncludeMissingValues(event.target.checked)}
              />
              Include missing values
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={includeOutliers}
                onChange={(event) => setIncludeOutliers(event.target.checked)}
              />
              Include outliers
            </label>
          </div>

          <div className="button-row">
            <button type="button" className="primary" onClick={handleGenerate}>
              {generateMutation.isPending ? 'Generating...' : 'Generate Dataset'}
            </button>
            <button type="button" className="ghost" onClick={handleDownload} disabled={!datasetSummary}>
              Download CSV
            </button>
            <button type="button" className="danger" onClick={handleReset} disabled={!datasetSummary}>
              Reset Dataset
            </button>
          </div>
          <p className="status-message">{statusMessage}</p>
        </article>

        <article className="card summary-card">
          <h3>{selectedProjectTitle} Explorer</h3>
          {datasetSummary ? (
            <div className="summary-grid">
              <div>
                <span>Rows</span>
                <strong>{datasetSummary.rows}</strong>
              </div>
              <div>
                <span>Columns</span>
                <strong>{datasetSummary.columns}</strong>
              </div>
              <div>
                <span>Target</span>
                <strong>{datasetSummary.target_suggestion}</strong>
              </div>
              <div>
                <span>Difficulty</span>
                <strong>{datasetSummary.difficulty}</strong>
              </div>
            </div>
          ) : (
            <p className="placeholder">No dataset yet. Generate one from the controls.</p>
          )}
        </article>
      </section>

      {datasetSummary && (
        <section className="data-section">
          <article className="card">
            <h3>Dataset Preview</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {Object.keys(datasetSummary.preview[0] ?? {}).map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datasetSummary.preview.map((row, index) => (
                    <tr key={`${datasetSummary.dataset_id}-${index}`}>
                      {Object.entries(row).map(([column, value]) => (
                        <td key={`${column}-${index}`}>{value === null ? 'NULL' : String(value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card chart-card">
            <h3>Visualization Builder</h3>
            <div className="viz-controls">
              <label>
                Chart Type
                <select value={chartType} onChange={(event) => setChartType(event.target.value as typeof chartType)}>
                  <option value="scatter">Scatter Plot</option>
                  <option value="line">Line Plot</option>
                  <option value="bar">Bar Chart (Grouped Mean)</option>
                  <option value="histogram">Histogram</option>
                </select>
              </label>
              <label>
                X Axis
                <select
                  value={chartXAxis}
                  onChange={(event) => setXAxis(event.target.value)}
                  disabled={numericColumns.length === 0}
                >
                  {numericColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Y Axis
                <select
                  value={chartYAxis}
                  onChange={(event) => setYAxis(event.target.value)}
                  disabled={numericColumns.length === 0}
                >
                  {numericColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="chart-area">
              <ResponsiveContainer width="100%" height={330}>
                {chartType === 'scatter' ? (
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" name={chartXAxis} />
                    <YAxis dataKey="y" name={chartYAxis} />
                    <Tooltip />
                    <Scatter data={scatterLineData} fill="#0ea5e9" />
                  </ScatterChart>
                ) : chartType === 'line' ? (
                  <LineChart data={scatterLineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="y" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                ) : chartType === 'bar' ? (
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f59e0b" />
                  </BarChart>
                ) : (
                  <BarChart data={histogramData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            <div className="interpretation-box">
              <h4>Student Interpretation</h4>
              <p className="interpretation-prompt">{getInterpretationPrompt(chartType, chartXAxis || 'x-axis', chartYAxis || 'y-axis')}</p>
              <textarea
                value={activeInterpretation}
                onChange={(event) =>
                  setInterpretations((prev) => ({
                    ...prev,
                    [chartType]: event.target.value,
                  }))
                }
                placeholder="Write your analytical conclusion here..."
                rows={5}
              />
              <div className="button-row">
                <button type="button" className="primary" onClick={handleInterpretationSubmit}>
                  Check My Interpretation
                </button>
              </div>
              {activeFeedback && (
                <div className={`feedback-panel ${activeFeedback.level}`}>
                  <strong>Auto-feedback ({activeFeedback.score}/5):</strong>
                  <p>{activeFeedback.message}</p>
                  <p>
                    Weighted score: {activeFeedback.weighted.total}/{activeFeedback.weighted.max}
                    {' | '}Trend {activeFeedback.weighted.trend}/2
                    {' | '}Evidence {activeFeedback.weighted.evidence}/2
                    {' | '}Decision {activeFeedback.weighted.decision}/2
                    {' | '}Chart {activeFeedback.weighted.chartSpecific}/2
                  </p>
                  <div className="keyword-grid">
                    <div>
                      <span>Trend terms:</span>
                      <div className="keyword-chips">
                        {activeFeedback.detected.trend.length > 0 ? (
                          activeFeedback.detected.trend.map((word) => (
                            <span key={`trend-${word}`} className="chip chip-trend">
                              {word}
                            </span>
                          ))
                        ) : (
                          <span className="chip chip-empty">none</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span>Evidence terms:</span>
                      <div className="keyword-chips">
                        {activeFeedback.detected.evidence.length > 0 ? (
                          activeFeedback.detected.evidence.map((word) => (
                            <span key={`evidence-${word}`} className="chip chip-evidence">
                              {word}
                            </span>
                          ))
                        ) : (
                          <span className="chip chip-empty">none</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span>Decision terms:</span>
                      <div className="keyword-chips">
                        {activeFeedback.detected.decision.length > 0 ? (
                          activeFeedback.detected.decision.map((word) => (
                            <span key={`decision-${word}`} className="chip chip-decision">
                              {word}
                            </span>
                          ))
                        ) : (
                          <span className="chip chip-empty">none</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span>Chart-specific terms:</span>
                      <div className="keyword-chips">
                        {activeFeedback.detected.chartSpecific.length > 0 ? (
                          activeFeedback.detected.chartSpecific.map((word) => (
                            <span key={`chart-${word}`} className="chip chip-chart">
                              {word}
                            </span>
                          ))
                        ) : (
                          <span className="chip chip-empty">none</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="answer-preview">
                    <span>Detected keywords highlighted in your answer:</span>
                    <p>
                      {highlightedFragments.length > 0
                        ? highlightedFragments.map((part, idx) =>
                            part.highlighted ? <mark key={idx}>{part.text}</mark> : <span key={idx}>{part.text}</span>,
                          )
                        : activeInterpretation}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </article>

          <article className="card insights-grid">
            <h3>Insights: Data → Information → Context → Wisdom</h3>
            <div className="insight-list">
              {insightCards.map((insight) => (
                <div key={insight.title} className="insight-item">
                  <h4>{insight.title}</h4>
                  <p>{insight.text}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="card twin-columns">
            <div>
              <h3>Advantages / Merits</h3>
              <ul>
                {meritsDemerits.merits.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Disadvantages / Demerits</h3>
              <ul>
                {meritsDemerits.demerits.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </article>

          <article className="card learning-card">
            <h3>Page-Wise Learning Sections</h3>
            <div className="learning-tabs">
              <button type="button" onClick={() => setLearningPage('data')} className={learningPage === 'data' ? 'active' : ''}>
                Data
              </button>
              <button
                type="button"
                onClick={() => setLearningPage('information')}
                className={learningPage === 'information' ? 'active' : ''}
              >
                Information
              </button>
              <button
                type="button"
                onClick={() => setLearningPage('context')}
                className={learningPage === 'context' ? 'active' : ''}
              >
                Context
              </button>
              <button
                type="button"
                onClick={() => setLearningPage('wisdom')}
                className={learningPage === 'wisdom' ? 'active' : ''}
              >
                Wisdom
              </button>
            </div>
            <div className="learning-content">
              <h4>{learningSections[learningPage].title}</h4>
              <p>
                <strong>Goal:</strong> {learningSections[learningPage].learningGoal}
              </p>
              <p>
                <strong>Action:</strong> {learningSections[learningPage].whatToDo}
              </p>
              <p>
                <strong>Observe:</strong> {learningSections[learningPage].whatToObserve}
              </p>
              <p>
                <strong>Outcome:</strong> {learningSections[learningPage].outcome}
              </p>
            </div>
          </article>

          <article className="card twin-columns">
            <div>
              <h3>Column Descriptions</h3>
              <ul>
                {Object.entries(datasetSummary.column_descriptions).map(([column, description]) => (
                  <li key={column}>
                    <strong>{column}</strong>: {description}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Data Types</h3>
              <ul>
                {Object.entries(datasetSummary.data_types).map(([column, dtype]) => (
                  <li key={column}>
                    <strong>{column}</strong>: {dtype}
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <article className="card twin-columns">
            <div>
              <h3>Missing Value Summary</h3>
              <ul>
                {Object.entries(datasetSummary.missing_summary).map(([column, count]) => (
                  <li key={column}>
                    <strong>{column}</strong>: {count}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Suggested Questions</h3>
              <ol>
                {datasetSummary.suggested_questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ol>
            </div>
          </article>
        </section>
      )}
    </div>
  )
}

export default App
