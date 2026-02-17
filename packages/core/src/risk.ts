import type { Job } from './schema.js'

export type RiskOptions = {
  asOf?: Date
  availableCapacity?: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function calculateRiskScore(job: Job, options: RiskOptions = {}): number {
  const asOf = options.asOf ?? new Date()
  const dueDate = new Date(job.due_date)
  const daysUntilDue = Math.floor(
    (dueDate.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24)
  )

  let dueScore = 0
  if (!Number.isFinite(daysUntilDue)) {
    dueScore = 0
  } else if (daysUntilDue <= 0) {
    dueScore = 60
  } else if (daysUntilDue <= 3) {
    dueScore = 50
  } else if (daysUntilDue <= 7) {
    dueScore = 40
  } else if (daysUntilDue <= 14) {
    dueScore = 25
  } else if (daysUntilDue <= 30) {
    dueScore = 10
  }

  let capacityScore = 0
  if (options.availableCapacity && options.availableCapacity > 0) {
    const loadRatio = job.remaining_work / options.availableCapacity
    capacityScore = clamp(Math.round((loadRatio - 1) * 40), 0, 40)
  }

  return clamp(dueScore + capacityScore, 0, 100)
}
