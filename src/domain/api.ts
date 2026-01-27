export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL'

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: ApiErrorCode }

export function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data }
}

export function fail(message: string, code?: ApiErrorCode): ApiResponse<never> {
  return { success: false, error: message, code }
}
