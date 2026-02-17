import { z } from 'zod'

export const JobSchema = z.object({
  job_id: z.string().min(1),
  due_date: z.string().min(1),
  priority: z.number().optional(),
  status: z.string().min(1),
  remaining_work: z.number(),
  risk_score: z.number(),
  risk_reason: z.string().optional()
})

export const OperationSchema = z.object({
  operation_id: z.string().min(1),
  job_id: z.string().min(1),
  resource_id: z.string().min(1),
  sequence: z.number(),
  standard_rate: z.number(),
  actual_rate: z.number(),
  remaining_time: z.number()
})

export const ResourceSchema = z.object({
  resource_id: z.string().min(1),
  resource_type: z.string().min(1),
  available_capacity: z.number(),
  scheduled_load: z.number()
})

export const MaterialRequirementSchema = z.object({
  job_id: z.string().min(1),
  item_id: z.string().min(1),
  required_qty: z.number(),
  issued_qty: z.number(),
  availability_flag: z.boolean()
})

export type Job = z.infer<typeof JobSchema>
export type Operation = z.infer<typeof OperationSchema>
export type Resource = z.infer<typeof ResourceSchema>
export type MaterialRequirement = z.infer<typeof MaterialRequirementSchema>
