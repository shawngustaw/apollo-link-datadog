import {
  ApolloError,
  ApolloLink,
  execute,
  gql,
  ServerError,
} from '@apollo/client/core';
import { datadogRum } from '@datadog/browser-rum';
import { GraphQLError } from 'graphql';
import { Observable } from 'zen-observable-ts';

import { DatadogLink } from '../src';

jest.mock('@datadog/browser-rum', () => ({
  datadogRum: {
    init: jest.fn(),
    addError: jest.fn(),
  },
}));

const createMockLink = (
  resultData?: Record<string, unknown>,
  errors?: readonly GraphQLError[],
) => {
  return new ApolloLink(
    () =>
      new Observable((observer) => {
        observer.next({ data: resultData, errors });
        observer.complete();
      }),
  );
};

const createErrorLink = (error: Error | ServerError) => {
  return new ApolloLink(
    () => new Observable((observer) => observer.error(error)),
  );
};

const mockDatadogRum = datadogRum as jest.Mocked<typeof datadogRum>;

describe('DatadogLink', () => {
  beforeEach(() => {
    mockDatadogRum.addError.mockClear();
  });

  it('should not call addError for successful operations', (done) => {
    const query = gql`
      query Success {
        foo
      }
    `;
    const mockLink = createMockLink({ foo: 'bar' });
    const link = ApolloLink.from([new DatadogLink(), mockLink]);

    execute(link, { query }).subscribe({
      complete: () => {
        expect(mockDatadogRum.addError).not.toHaveBeenCalled();
        done();
      },
      error: done,
    });
  });

  it('should call addError with context for network errors', (done) => {
    const query = gql`
      query NetworkError {
        foo
      }
    `;
    const variables = { id: 1 };
    const networkError = new Error('Network failure');
    const errorLink = createErrorLink(networkError);
    const link = ApolloLink.from([new DatadogLink(), errorLink]);

    execute(link, { query, variables }).subscribe({
      error: (err) => {
        expect(err).toBe(networkError);
        expect(mockDatadogRum.addError).toHaveBeenCalledTimes(1);
        expect(mockDatadogRum.addError).toHaveBeenCalledWith(
          networkError,
          expect.objectContaining({
            operationName: 'NetworkError',
            query: expect.stringContaining('query NetworkError'),
            variables: variables,
          }),
        );
        done();
      },
      complete: () => done('Should not complete'),
    });
  });

  it('should call addError with context for server errors', (done) => {
    const query = gql`
      query ServerErrorTest {
        foo
      }
    `;
    const serverError: ServerError = {
      name: 'ServerError',
      message: 'Internal server error',
      statusCode: 500,
      response: {} as Response,
      result: { message: 'Internal server error' },
    };
    const errorLink = createErrorLink(serverError);
    const link = ApolloLink.from([new DatadogLink(), errorLink]);

    execute(link, { query }).subscribe({
      error: (err) => {
        expect(err).toBe(serverError);
        expect(mockDatadogRum.addError).toHaveBeenCalledTimes(1);
        expect(mockDatadogRum.addError).toHaveBeenCalledWith(
          serverError,
          expect.objectContaining({
            operationName: 'ServerErrorTest',
            query: expect.stringContaining('query ServerErrorTest'),
            variables: {},
            statusCode: 500,
          }),
        );
        done();
      },
      complete: () => done('Should not complete'),
    });
  });

  it('should call addError for GraphQL errors in the result', (done) => {
    const query = gql`
      query GraphQLErrorTest {
        foo
      }
    `;
    const graphQLErrors = [new GraphQLError('Thing not found')];
    const mockLink = createMockLink({ foo: null }, graphQLErrors);
    const link = ApolloLink.from([new DatadogLink(), mockLink]);

    execute(link, { query }).subscribe({
      complete: () => {
        expect(mockDatadogRum.addError).toHaveBeenCalledTimes(1);
        const capturedError = mockDatadogRum.addError.mock
          .calls[0][0] as ApolloError;
        const capturedContext = mockDatadogRum.addError.mock.calls[0][1];

        expect(capturedError).toBeInstanceOf(ApolloError);
        expect(capturedError.graphQLErrors).toBe(graphQLErrors);

        expect(capturedContext).toEqual(
          expect.objectContaining({
            operationName: 'GraphQLErrorTest',
            query: expect.stringContaining('query GraphQLErrorTest'),
            variables: {},
          }),
        );
        done();
      },
      error: done,
    });
  });

  it('should allow filtering out operations with shouldHandleOperation', (done) => {
    const queryHandled = gql`
      query Handle {
        foo
      }
    `;
    const queryDiscarded = gql`
      query Discard {
        bar
      }
    `;
    const networkError = new Error('Network failure');
    const errorLink = createErrorLink(networkError);

    const datadogLink = new DatadogLink({
      shouldHandleOperation: (operation) =>
        operation.operationName === 'Handle',
    });

    const linkHandled = ApolloLink.from([datadogLink, errorLink]);
    const linkDiscarded = ApolloLink.from([datadogLink, errorLink]);

    execute(linkHandled, { query: queryHandled }).subscribe({
      error: () => {
        execute(linkDiscarded, { query: queryDiscarded }).subscribe({
          error: () => {
            expect(mockDatadogRum.addError).toHaveBeenCalledTimes(1);
            expect(mockDatadogRum.addError).toHaveBeenCalledWith(
              networkError,
              expect.objectContaining({ operationName: 'Handle' }),
            );
            done();
          },
          complete: () => done('Second query should not complete'),
        });
      },
      complete: () => done('First query should not complete'),
    });
  });

  it('should allow custom context generation with generateContext', (done) => {
    const query = gql`
      query CustomContext {
        foo
      }
    `;
    const networkError = new Error('Network failure');
    const errorLink = createErrorLink(networkError);
    const customContext = { custom: 'data', timestamp: Date.now() };

    const datadogLink = new DatadogLink({
      generateContext: (operation, error) => ({
        ...customContext,
        opName: operation.operationName,
        errMsg: error.message,
      }),
    });
    const link = ApolloLink.from([datadogLink, errorLink]);

    execute(link, { query }).subscribe({
      error: (err) => {
        expect(err).toBe(networkError);
        expect(mockDatadogRum.addError).toHaveBeenCalledTimes(1);
        expect(mockDatadogRum.addError).toHaveBeenCalledWith(networkError, {
          ...customContext,
          opName: 'CustomContext',
          errMsg: 'Network failure',
        });
        done();
      },
      complete: () => done('Should not complete'),
    });
  });
});
