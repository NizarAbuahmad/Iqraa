/**
 * The real client, bound to `apiFetch`. Kept apart from `teacherSubmissionsApi.ts` because `apiClient` pulls in
 * react-native and secure storage at module scope, which `node --test` cannot load.
 */
import { apiFetch } from './apiClient.ts';
import { makeTeacherSubmissionsApi } from './teacherSubmissionsApi.ts';

export const teacherSubmissionsApi = makeTeacherSubmissionsApi({ apiFetch });
