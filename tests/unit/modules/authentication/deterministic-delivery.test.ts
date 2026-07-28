import { DeterministicAuthenticationInbox } from '../../../helpers/authentication/deterministic-delivery.js';

describe('deterministic authentication delivery inbox', () => {
  it('retains values only in process and supports programmable failure/reset', async () => {
    const inbox = new DeterministicAuthenticationInbox('SMS');
    await inbox.send({ idempotencyKey: 'one', destination: '+201000000000', value: '123456' });
    expect(inbox.latest()?.value).toBe('123456');
    inbox.failNext();
    await expect(inbox.send({ idempotencyKey: 'two', destination: '+201000000000', value: '654321' })).rejects.toThrow();
    inbox.reset();
    expect(inbox.all()).toHaveLength(0);
  });
});
