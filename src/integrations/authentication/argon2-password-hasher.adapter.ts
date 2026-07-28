import type { PasswordHasherPort } from '#modules/authentication';
import type { HashOptions } from 'argon2';

const argon2 = require('argon2') as typeof import('argon2');

const options: HashOptions & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32
};

export class Argon2PasswordHasherAdapter implements PasswordHasherPort {
  private readonly dummyHash: Promise<string> = argon2.hash(
    'cleanora-dummy-password-not-a-user-value', options
  );

  hash(password: string): Promise<string> {
    return argon2.hash(password, options);
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  async dummyVerify(password: string): Promise<void> {
    await argon2.verify(await this.dummyHash, password);
  }
}
