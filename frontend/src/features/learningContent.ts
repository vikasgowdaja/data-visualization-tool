export const learningModules = [
  {
    id: 'data-literacy',
    title: '01 Data Literacy',
    concept: 'Data is evidence, not proof by itself.',
    activity: 'Inspect one dataset and describe variable types and quality concerns.',
    takeaway: 'Reliable decisions depend on data quality and context.',
  },
  {
    id: 'understanding-datasets',
    title: '02 Understanding Datasets',
    concept: 'Every dataset is a model of reality with limitations.',
    activity: 'Compare two generated versions and identify differences.',
    takeaway: 'Synthetic data helps practice workflows but is not a population truth.',
  },
  {
    id: 'data-cleaning',
    title: '03 Data Cleaning',
    concept: 'Cleaning is hypothesis-driven, not mechanical.',
    activity: 'Try fill median vs remove rows and compare outcomes.',
    takeaway: 'Document every cleaning decision and its trade-offs.',
  },
  {
    id: 'visualization',
    title: '04 Data Visualization',
    concept: 'Choose charts by analytical objective, not aesthetics alone.',
    activity: 'Use recommendation engine then justify chart choice.',
    takeaway: 'Correct chart selection reduces interpretation errors.',
  },
]

export const projectTemplates = [
  {
    id: 'student_performance',
    title: 'Student Performance Project',
    problem: 'Identify factors linked with student scores and suggest interventions.',
    objectives: ['Inspect data quality', 'Compare key groups', 'Interpret responsibly', 'Recommend action'],
  },
  {
    id: 'house_prices',
    title: 'House Prices Project',
    problem: 'Estimate pricing patterns and assess reliability of predictors.',
    objectives: ['Check outliers', 'Visualize relationships', 'Assess context bias'],
  },
  {
    id: 'customer_churn',
    title: 'Customer Churn Project',
    problem: 'Identify churn risk factors and propose retention strategies.',
    objectives: ['Profile class distribution', 'Evaluate feature signals', 'Frame decisions'],
  },
]

export const learningPathLevels = [
  'Level 1: Data Literacy',
  'Level 2: Data Exploration',
  'Level 3: Data Cleaning',
  'Level 4: Visualization',
  'Level 5: Statistics',
  'Level 6: Interpretation',
  'Level 7: Decision Making',
  'Level 8: Applied Data Science',
]

import { ROUTES } from '../constants/routes'

export const resourcesCatalog = [
  {
    title: 'Data Quality Checklist',
    description: 'Missing values, duplicates, outliers, and schema sanity checks before analysis.',
    targetRoute: ROUTES.DATA_CLEANING_LAB,
  },
  {
    title: 'Chart Selection Guide',
    description: 'Map analytical objective to valid visual forms and known pitfalls.',
    targetRoute: ROUTES.VISUALIZATION_LAB,
  },
  {
    title: 'Interpretation Framework',
    description: 'Use DIKW and avoid correlation-causation fallacies.',
    targetRoute: ROUTES.INSIGHTS_LAB,
  },
]

export const practiceQuestionBank = [
  {
    id: 'p1',
    difficulty: 'beginner',
    type: 'MCQ',
    question: 'Which chart is most suitable for checking relationship between two numeric variables?',
    options: ['Pie chart', 'Scatter plot', 'Treemap', 'Stacked bar'],
    answer: 'Scatter plot',
  },
  {
    id: 'p2',
    difficulty: 'beginner',
    type: 'True/False',
    question: 'Correlation proves causation.',
    options: ['True', 'False'],
    answer: 'False',
  },
  {
    id: 'p3',
    difficulty: 'intermediate',
    type: 'Decision',
    question: 'For a skewed distribution with outliers, which center metric is safer?',
    options: ['Mean', 'Median', 'Mode', 'Range'],
    answer: 'Median',
  },
]
