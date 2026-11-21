/**
 * The real client, bound to `apiFetch`. Kept apart from `parentProjectApi.ts` because `apiClient` pulls in
 * react-native and secure storage at module scope, which `node --test` cannot load.
 */
import { apiFetch } from './apiClient.ts';
import { makeParentProjectApi } from './parentProjectApi.ts';

export const parentProjectApi = makeParentProjectApi({ apiFetch });
