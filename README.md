# Apollo Link Datadog

Apollo Link to send GraphQL errors to [Datadog RUM](https://docs.datadoghq.com/real_user_monitoring/browser/).

[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

[![npm-version](https://img.shields.io/npm/v/apollo-link-datadog)](https://www.npmjs.com/package/apollo-link-datadog)
[![npm-downloads](https://img.shields.io/npm/dt/apollo-link-datadog)](https://www.npmjs.com/package/apollo-link-datadog)

## Installation

```bash
yarn add apollo-link-datadog @datadog/browser-rum
# or
npm install apollo-link-datadog @datadog/browser-rum
```

**Note**: This link requires `@apollo/client` v3+ and `@datadog/browser-rum` v5+ (check `package.json` for specific peer dependency versions).

## Features

This link automatically captures network and GraphQL errors that occur during your Apollo Client operations and reports them to Datadog RUM using `datadogRum.addError`.

It attaches context to the error report, including:

- Operation Name
- GraphQL Query (excluding fragments by default)
- Variables (if any)
- HTTP Status Code (for server errors)

You can customize the context attached using the `generateContext` option.

## Basic setup

Initialize Datadog RUM as you would normally. Then, add `apollo-link-datadog` to your Apollo Client's `link` array:

```javascript
import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
} from '@apollo/client';
import { datadogRum } from '@datadog/browser-rum';
import { DatadogLink } from 'apollo-link-datadog';

// Initialize Datadog RUM first
datadogRum.init({
  applicationId: 'YOUR_APPLICATION_ID',
  clientToken: 'YOUR_CLIENT_TOKEN',
  site: 'datadoghq.com', // or 'datadoghq.eu', etc.
  service: 'your-service-name',
  // ... other configuration
  sessionSampleRate: 100,
  sessionReplaySampleRate: 20, // or 0 if not needed
  trackUserInteractions: true,
  trackResources: true,
  trackLongTasks: true,
  defaultPrivacyLevel: 'mask-user-input',
});

const client = new ApolloClient({
  link: ApolloLink.from([
    new DatadogLink(/* See options */),
    new HttpLink({ uri: 'http://localhost:4000' }),
  ]),
  cache: new InMemoryCache(),
});
```

## Options

```typescript
import { Operation, ServerError } from '@apollo/client/core';

export interface DatadogLinkOptions {
  /**
   * Determines if the given operation should be handled or discarded.
   *
   * If undefined, all operations will be included.
   * @default () => true
   */
  shouldHandleOperation?: (operation: Operation) => boolean;

  /**
   * Function to generate custom context attached to the Datadog error.
   *
   * Defaults to extracting operationName, query, variables, and statusCode.
   */
  generateContext?: (
    operation: Operation,
    error: Error | ServerError,
  ) => Record<string, unknown>;
}
```

### `shouldHandleOperation`

Use this function to prevent certain operations from being reported to Datadog. For example, you might want to ignore errors from a specific query:

```javascript
new DatadogLink({
  shouldHandleOperation: (operation) =>
    operation.operationName !== 'IntrospectionQuery',
});
```

### `generateContext`

Provide a function to customize the context object sent along with the error to `datadogRum.addError`. The function receives the Apollo `Operation` and the `Error` (or `ServerError`) object.

```javascript
import { print } from 'graphql';

new DatadogLink({
  generateContext: (operation, error) => {
    const baseContext = {
      operationName: operation.operationName,
      query: print(operation.query),
      variables: operation.variables,
      // Add custom context
      userId: getCurrentUserId(),
    };
    if (error.statusCode) {
      // Check if it's a ServerError
      baseContext.statusCode = error.statusCode;
    }
    return baseContext;
  },
});
```

## Development

See `package.json` for scripts related to building, testing, and linting.

- `yarn build`
- `yarn test`
- `yarn lint`
- `yarn validate`

## Contributing

Please refer to the original repository's contribution guidelines if applicable, or establish new ones for this fork.

## License

MIT
