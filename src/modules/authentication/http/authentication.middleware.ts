import type { RequestHandler } from 'express';
import type { AuthenticationPrincipal } from '../domain/authentication.types.js';
import type { AuthenticationService } from '../application/authentication.service.js';
import { authenticationError } from '../domain/authentication.errors.js';

export function createAuthenticateAccess(service: AuthenticationService): RequestHandler {
  return async (request, response, next) => {
    try {
      const header = request.get('authorization');
      if (!header?.startsWith('Bearer ')) throw authenticationError('AUTHENTICATION_REQUIRED');
      response.locals['authenticationPrincipal'] = await service.authenticateAccess(header.slice(7));
      next();
    } catch (error) { next(error); }
  };
}


/** Allow sensitive account mutations only after the mandatory verification gate. */
export const requireFullAuthentication: RequestHandler = (_request, response, next) => {
  const principal = response.locals['authenticationPrincipal'] as AuthenticationPrincipal | undefined;
  if (principal === undefined) return next(authenticationError('AUTHENTICATION_REQUIRED'));
  if (principal.verificationOnly) return next(authenticationError('AUTH_VERIFICATION_REQUIRED'));
  next();
};
