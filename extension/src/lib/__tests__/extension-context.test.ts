import { describe, expect, it } from 'vitest';
import { isExtensionContextInvalidated } from '../extension-context';

describe('extension context', () => {
  it('recognises the stale-content-script error', () => {
    expect(isExtensionContextInvalidated(new Error('Extension context invalidated.'))).toBe(true);
    expect(isExtensionContextInvalidated('Extension context invalidated.')).toBe(true);
    expect(isExtensionContextInvalidated(new Error('EXTENSION CONTEXT INVALIDATED'))).toBe(true);
  });

  it('leaves ordinary failures alone', () => {
    expect(isExtensionContextInvalidated(new Error('Failed to fetch'))).toBe(false);
    expect(isExtensionContextInvalidated(undefined)).toBe(false);
    expect(isExtensionContextInvalidated({ message: 'Extension context invalidated.' })).toBe(true);
  });
});
