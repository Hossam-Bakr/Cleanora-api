import type { RequestHandler } from 'express';
import { authenticationError } from '../domain/authentication.errors.js';

export function requireTrustedOrigin(origins: readonly string[]): RequestHandler {
  return (request, _response, next) => {
    const origin = request.get('origin');
    if (origin === undefined || !origins.includes(origin)) { next(authenticationError('AUTH_REQUEST_ORIGIN_REJECTED')); return; }
    next();
  };
}
