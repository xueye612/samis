import type { Page } from '@playwright/test';

const severePatterns = [
  /vue runtime/i,
  /failed to fetch/i,
  /cannot read properties of undefined/i,
  /unhandled error/i,
  /uncaught/i,
  /syntaxerror/i,
  /typeerror/i,
  /referenceerror/i,
  /internal server error/i,
];

const ignoredPatterns = [
  /favicon/i,
  /devtools/i,
  /download the vue devtools/i,
];

export interface ConsoleErrorWatcher {
  errors: string[];
  assertNoSevereErrors(): void;
}

export function watchConsoleErrors(page: Page): ConsoleErrorWatcher {
  const errors: string[] = [];

  const record = (message: string) => {
    if (ignoredPatterns.some((pattern) => pattern.test(message))) return;
    if (severePatterns.some((pattern) => pattern.test(message))) {
      errors.push(message);
    }
  };

  page.on('console', (message) => {
    if (message.type() === 'error') record(message.text());
    if (message.type() === 'warning' && /\[Vue warn\]/i.test(message.text())) record(message.text());
  });

  page.on('pageerror', (error) => {
    record(error.message);
  });

  return {
    errors,
    assertNoSevereErrors() {
      if (errors.length > 0) {
        throw new Error(`Severe browser errors detected:\n${errors.map((item) => `- ${item}`).join('\n')}`);
      }
    },
  };
}
