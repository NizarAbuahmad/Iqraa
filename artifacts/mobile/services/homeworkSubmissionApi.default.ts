/**
 * The real client, bound to `apiFetch`. Kept apart from `homeworkSubmissionApi.ts` because `apiClient` pulls in
 * react-native and secure storage at module scope, which `node --test` cannot load.
 */
import { apiFetch } from './apiClient.ts';
import { makeHomeworkSubmissionApi } from './homeworkSubmissionApi.ts';

export const homeworkSubmissionApi = makeHomeworkSubmissionApi({ apiFetch });
