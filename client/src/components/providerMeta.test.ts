import { beforeEach, describe, expect, it } from 'vitest';
import { getVisibleProviderIds, PROVIDER_MAP, setVisibleProviderIds } from './providerMeta';

describe('getVisibleProviderIds', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the full provider catalog by default when no visibility state is stored', () => {
    const ids = getVisibleProviderIds();

    expect(ids).toEqual(expect.arrayContaining(Object.keys(PROVIDER_MAP)));
    expect(ids).toHaveLength(Object.keys(PROVIDER_MAP).length);
  });

  it('returns persisted visibility ids when they exist', () => {
    setVisibleProviderIds(['local', 'openai']);

    expect(getVisibleProviderIds()).toEqual(['local', 'openai']);
  });
});
