import {
  ApolloError,
  ApolloLink,
  FetchResult,
  NextLink,
  Operation,
  ServerError,
} from '@apollo/client/core';
import { datadogRum } from '@datadog/browser-rum';
import { print } from 'graphql';
import { Observable } from 'zen-observable-ts';

export interface DatadogLinkOptions {
  shouldHandleOperation?: (operation: Operation) => boolean;
  generateContext?: (
    operation: Operation,
    error: Error | ServerError,
  ) => Record<string, unknown>;
}

const defaultGenerateContext = (
  operation: Operation,
  error: Error | ServerError,
): Record<string, unknown> => {
  const context: Record<string, unknown> = {
    operationName: operation.operationName,
    query: print(operation.query),
  };
  if (Object.keys(operation.variables).length > 0) {
    context.variables = operation.variables;
  }
  if (isServerError(error)) {
    context.statusCode = error.statusCode;
  }
  return context;
};

export class DatadogLink extends ApolloLink {
  private readonly options: Required<DatadogLinkOptions>;

  constructor(options: DatadogLinkOptions = {}) {
    super();
    this.options = {
      shouldHandleOperation: options.shouldHandleOperation ?? (() => true),
      generateContext: options.generateContext ?? defaultGenerateContext,
    };
  }

  request(
    operation: Operation,
    forward: NextLink,
  ): Observable<FetchResult> | null {
    if (!this.options.shouldHandleOperation(operation)) {
      return forward(operation);
    }

    return new Observable<FetchResult>((observer) => {
      const subscription = forward(operation).subscribe({
        next: (result) => {
          if (result.errors && result.errors.length > 0) {
            const apolloError = new ApolloError({
              graphQLErrors: result.errors,
            });
            const context = this.options.generateContext(
              operation,
              apolloError,
            );
            datadogRum.addError(apolloError, context);
          }
          observer.next(result);
        },
        complete: () => {
          observer.complete();
        },
        error: (error) => {
          const context = this.options.generateContext(operation, error);
          datadogRum.addError(error, context);
          observer.error(error);
        },
      });

      return () => {
        subscription.unsubscribe();
      };
    });
  }
}

function isServerError(error: unknown): error is ServerError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    'result' in error &&
    'statusCode' in error
  );
}
