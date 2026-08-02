import type { SignOptions } from 'jsonwebtoken';
import type {
  AccessTokenClaims,
  IssuedToken,
  RefreshTokenClaims,
  TokenServicePort,
} from "../../modules/authentication/domain/authentication.ports.js";
import { authenticationError } from "../../modules/authentication/domain/authentication.errors.js";

const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');

export interface JwtTokenServiceOptions {
  readonly accessSecret: string;
  readonly refreshSecret: string;
  readonly issuer: string;
  readonly audience: string;
  readonly accessTtlSeconds: number;
}

export class JwtTokenServiceAdapter implements TokenServicePort {
  constructor(private readonly options: JwtTokenServiceOptions) {}

  issueAccess(claims: AccessTokenClaims): IssuedToken {
    return this.sign('access', claims, this.options.accessSecret, this.options.accessTtlSeconds);
  }

  issueRefresh(claims: RefreshTokenClaims, expiresAt: Date): IssuedToken {
    const seconds = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    return this.sign('refresh', claims, this.options.refreshSecret, seconds);
  }

  verifyAccess(token: string): AccessTokenClaims {
    return this.verify('access', token, this.options.accessSecret) as unknown as AccessTokenClaims;
  }

  verifyRefresh(token: string): RefreshTokenClaims {
    return this.verify('refresh', token, this.options.refreshSecret) as unknown as RefreshTokenClaims;
  }

  private sign(type: 'access' | 'refresh', claims: object, secret: string, seconds: number): IssuedToken {
    const expiresAt = new Date(Date.now() + seconds * 1000);
    const token = jwt.sign({ ...claims, typ: type, ver: 1 }, secret, {
      algorithm: 'HS256', issuer: this.options.issuer, audience: this.options.audience,
      expiresIn: seconds, jwtid: crypto.randomUUID()
    } as SignOptions);
    return { token, expiresAt };
  }

  private verify(type: 'access' | 'refresh', token: string, secret: string): Record<string, unknown> {
    try {
      const value = jwt.verify(token, secret, {
        algorithms: ['HS256'], issuer: this.options.issuer, audience: this.options.audience
      });
      if (typeof value === 'string' || value['typ'] !== type || value['ver'] !== 1) throw new Error('claims');
      return value;
    } catch {
      throw authenticationError(
        type === "access"
          ? "AUTH_ACCESS_TOKEN_INVALID"
          : "AUTH_REFRESH_TOKEN_INVALID",
      );
    }
  }
}
