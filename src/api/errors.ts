import { AxiosError } from 'axios';
import type { ApiFailure, ErrorCode, FieldError } from './types';

/** Transport-level codes the client adds on top of the server's ErrorCode list. */
export type ClientErrorCode = 'NETWORK_ERROR' | 'CANCELLED' | 'UNKNOWN_ERROR';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | ClientErrorCode | (string & {});
  readonly fields: FieldError[];
  readonly retryAfterSeconds?: number;
  /** Field path in react-hook-form style ("lines.1.accountCode") to its message. */
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: FieldError[] = [], retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.retryAfterSeconds = retryAfterSeconds;
    this.fieldErrors = {};
    for (const f of fields) {
      const path = toFormPath(f.field);
      this.fieldErrors[path] = this.fieldErrors[path] ? `${this.fieldErrors[path]} ${f.message}` : f.message;
    }
  }

  hasFieldErrors(): boolean {
    return this.fields.length > 0;
  }
}

/** "lines[1].accountCode" -> "lines.1.accountCode", the path react-hook-form uses. */
export function toFormPath(apiPath: string): string {
  return apiPath.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');
}

export const NETWORK_MESSAGE = "Can't reach the server. Check your connection and try again.";

function isFailure(body: unknown): body is ApiFailure {
  return !!body && typeof body === 'object' && (body as ApiFailure).success === false && !!(body as ApiFailure).error;
}

/** Turns anything thrown into an ApiError. The envelope's `message` is user-facing; branch on `code`. */
export function normaliseError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof AxiosError) {
    if (error.code === AxiosError.ERR_CANCELED) return new ApiError(0, 'CANCELLED', 'Request cancelled.');
    const res = error.response;
    if (!res) return new ApiError(0, 'NETWORK_ERROR', NETWORK_MESSAGE);
    if (isFailure(res.data)) {
      const e = res.data.error;
      const retry = e.retryAfterSeconds ?? (Number(res.headers?.['retry-after']) || undefined);
      return new ApiError(res.status, e.code, res.data.message, e.fields ?? [], retry);
    }
    // Not JSON: a proxy error page or the server being down.
    if (res.status >= 500 || typeof res.data !== 'object') return new ApiError(res.status, 'NETWORK_ERROR', NETWORK_MESSAGE);
    return new ApiError(res.status, 'UNKNOWN_ERROR', 'Something went wrong. Please try again.');
  }
  if (error instanceof Error) return new ApiError(0, 'UNKNOWN_ERROR', error.message);
  return new ApiError(0, 'UNKNOWN_ERROR', 'Something went wrong. Please try again.');
}

export function isApiError(error: unknown, ...codes: string[]): error is ApiError {
  return error instanceof ApiError && (codes.length === 0 || codes.includes(error.code));
}

/** Someone else acted on the record first (README §8.4): show the message, refetch, re-render the actions. */
export function isStaleConflict(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.code === 'CONCURRENT_MODIFICATION' || error.code === 'DATA_CONFLICT'
    || error.code.endsWith('_WRONG_STATUS') || /_ALREADY_/.test(error.code) || error.code === 'MEMBER_INVALID_STATE';
}
