# Upgrade guide

This package, `apollo-link-datadog`, is a fork of `apollo-link-sentry`.

There is no direct upgrade path. If you were using `apollo-link-sentry`, you will need to:

1.  Install `apollo-link-datadog` and `@datadog/browser-rum`.
2.  Remove `apollo-link-sentry` and `@sentry/core` (or `@sentry/browser`).
3.  Update your Apollo Client link setup to use `DatadogLink` instead of `SentryLink`.
4.  Ensure Datadog RUM is initialized in your application.
5.  Adjust any options passed to the link according to the `DatadogLinkOptions` (see README).

## v2 to v3

### Adapt your configuration

The configuration of `SentryLink` has changed.

```

```
