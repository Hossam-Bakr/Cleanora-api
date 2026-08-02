import type {
  GoogleIdentity,
  GoogleIdentityPort,
  GoogleTransaction,
} from "../../modules/authentication/domain/authentication.ports.js";

interface OidcTokens { claims(): Record<string, unknown> | undefined; }
interface OidcFacade {
  discovery(server: URL, clientId: string, metadata: Record<string, string>): Promise<object>;
  calculatePKCECodeChallenge(verifier: string): Promise<string>;
  buildAuthorizationUrl(configuration: object, parameters: Record<string, string>): URL;
  authorizationCodeGrant(configuration: object, url: URL, checks: Record<string, string>): Promise<OidcTokens>;
}

const oidc = require('openid-client') as OidcFacade;

function safeDisplayName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 200 ? normalized : undefined;
}

function safeAvatarUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export class OpenIdClientGoogleAdapter implements GoogleIdentityPort {
  private configuration?: Promise<object>;
  constructor(private readonly clientId: string, private readonly clientSecret: string, private readonly redirectUri: string) {}

  private configured(): Promise<object> {
    this.configuration ??= oidc.discovery(new URL('https://accounts.google.com'), this.clientId, { client_secret: this.clientSecret });
    return this.configuration;
  }

  async createAuthorizationUrl(transaction: GoogleTransaction): Promise<string> {
    const challenge = await oidc.calculatePKCECodeChallenge(transaction.pkceVerifier);
    return oidc.buildAuthorizationUrl(await this.configured(), {
      redirect_uri: this.redirectUri,
      scope: 'openid email profile', state: transaction.state, nonce: transaction.nonce,
      code_challenge: challenge, code_challenge_method: 'S256'
    }).href;
  }

  async consumeCallback(url: string, transaction: GoogleTransaction): Promise<GoogleIdentity> {
    const tokens = await oidc.authorizationCodeGrant(await this.configured(), new URL(url), {
      expectedState: transaction.state, expectedNonce: transaction.nonce,
      pkceCodeVerifier: transaction.pkceVerifier
    });
    const claims = tokens.claims();
    if (claims === undefined || typeof claims['sub'] !== 'string') throw new Error('OIDC_CLAIMS_INVALID');
    const displayName = safeDisplayName(claims['name']);
    const avatarUrl = safeAvatarUrl(claims['picture']);
    return {
      subject: claims['sub'],
      ...(typeof claims['email'] === 'string' ? { email: claims['email'] } : {}),
      emailVerified: claims['email_verified'] === true,
      ...(displayName === undefined ? {} : { displayName }),
      ...(avatarUrl === undefined ? {} : { avatarUrl }),
    };
  }
}
