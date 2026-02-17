import type {
  Job,
  MaterialRequirement,
  Operation,
  Resource
} from '@shadowops/core'

export type IQMSJobRow = Record<string, unknown>
export type IQMSOperationRow = Record<string, unknown>
export type IQMSResourceRow = Record<string, unknown>
export type IQMSMaterialRow = Record<string, unknown>

export function mapIQMSJob(row: IQMSJobRow): Job {
  return {
    job_id: String(row.WORKORDER ?? row.workorder ?? ''),
    due_date: String(row.DUE_DATE ?? row.due_date ?? ''),
    priority: typeof row.PRIORITY === 'number' ? row.PRIORITY : undefined,
    status: String(row.STATUS ?? row.status ?? 'open'),
    remaining_work: Number(row.REMAINING_WORK ?? row.remaining_work ?? 0),
    risk_score: 0
  }
}

export function mapIQMSOperation(row: IQMSOperationRow): Operation {
  return {
    operation_id: String(row.OPER_ID ?? row.operation_id ?? ''),
    job_id: String(row.WORKORDER ?? row.workorder ?? ''),
    resource_id: String(row.RESOURCE_ID ?? row.resource_id ?? ''),
    sequence: Number(row.SEQUENCE ?? row.sequence ?? 0),
    standard_rate: Number(row.STD_RATE ?? row.standard_rate ?? 0),
    actual_rate: Number(row.ACT_RATE ?? row.actual_rate ?? 0),
    remaining_time: Number(row.REMAINING_TIME ?? row.remaining_time ?? 0)
  }
}

export function mapIQMSResource(row: IQMSResourceRow): Resource {
  return {
    resource_id: String(row.RESOURCE_ID ?? row.resource_id ?? ''),
    resource_type: String(row.RESOURCE_TYPE ?? row.resource_type ?? ''),
    available_capacity: Number(row.AVAILABLE_CAPACITY ?? row.available_capacity ?? 0),
    scheduled_load: Number(row.SCHEDULED_LOAD ?? row.scheduled_load ?? 0)
  }
}

export function mapIQMSMaterial(row: IQMSMaterialRow): MaterialRequirement {
  const requiredQty = Number(row.REQUIRED_QTY ?? row.required_qty ?? 0)
  const issuedQty = Number(row.ISSUED_QTY ?? row.issued_qty ?? 0)
  return {
    job_id: String(row.WORKORDER ?? row.workorder ?? ''),
    item_id: String(row.ITEM_ID ?? row.item_id ?? ''),
    required_qty: requiredQty,
    issued_qty: issuedQty,
    availability_flag: issuedQty >= requiredQty
  }
}
