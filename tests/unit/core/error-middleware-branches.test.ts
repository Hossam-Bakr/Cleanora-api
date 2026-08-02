import { createErrorMiddleware } from '../../../src/middlewares/error.middleware.js';

function invoke(error: unknown) {
  const logger = { error: vi.fn() };
  const response = {
    status: vi.fn(),
    json: vi.fn()
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);

  createErrorMiddleware(logger as never)(
    error,
    { requestId: 'request-1' } as never,
    response as never,
    vi.fn()
  );

  return { logger, response };
}

describe('safe error cause alternatives', () => {
  it('logs an Error without a code without inventing or leaking cause metadata', () => {
    const { logger, response } = invoke(new Error('private provider failure'));
    const context = logger.error.mock.calls[0]?.[1];

    expect(context).toMatchObject({ causeName: 'Error' });
    expect(context).not.toHaveProperty('causeCode');
    expect(context).not.toHaveProperty('causeSafeMessage');
    expect(response.json.mock.calls[0]?.[0]).toMatchObject({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        statusCode: 500,
        message: 'Internal server error'
      }
    });
    expect(response.json.mock.calls[0]?.[0]).not.toHaveProperty('error.details');
  });

  it('logs only a string cause code', () => {
    const coded = Object.assign(new Error('private database failure'), { code: 'P2034' });
    const numeric = Object.assign(new Error('private numeric failure'), { code: 500 });

    expect(invoke(coded).logger.error.mock.calls[0]?.[1]).toMatchObject({
      causeName: 'Error',
      causeCode: 'P2034'
    });
    expect(invoke(numeric).logger.error.mock.calls[0]?.[1]).not.toHaveProperty('causeCode');
  });

  it('recognizes only the fixed transaction-start timeout phrase', () => {
    const { logger } = invoke(new Error(
      'Unable to start a transaction in the given time; private connection context'
    ));

    expect(logger.error.mock.calls[0]?.[1]).toMatchObject({
      causeName: 'Error',
      causeSafeMessage: 'Unable to start a transaction in the given time'
    });
    expect(logger.error.mock.calls[0]?.[1]).not.toHaveProperty('message');
  });
});
