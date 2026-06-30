import { ApiError } from '@/lib/api-error'

export class ServiceError extends ApiError {
  constructor(message: string, code: string, status: number) {
    super(message, status, code)
    this.name = 'ServiceError'
  }
}
