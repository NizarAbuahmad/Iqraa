// The lesson-prep panel used to answer every failed generation with the bare
// «تعذّر إتمام العملية. حاول مرة أخرى.», whatever the server said: a teacher whose
// allowance was spent, or whose server had AI switched off, was told to retry
// something that would keep failing. The eight generator screens already map the
// failure through `aiErrorText`; this keeps the panel on the same path. The panel
// reaches react-native, so `node --test` cannot load it and the source is read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const panel = readFileSync(join(import.meta.dirname, '..', '..', 'components', 'ui', 'LessonPrepPanel.tsx'), 'utf8');

test('a failed generation shows the mapped message, not the bare one', () => {
  assert.match(panel, /import \{ aiErrorText \} from '@\/services\/ai\/aiProvenance'/);
  assert.match(panel, /catch \(e\) \{[^}]*setError\(aiErrorText\(e, t\)\)/s);
});

test('the generate call is the only place the panel catches a failed generation', () => {
  // A bare `catch {` followed by the generic line is the shape that threw the reason away.
  const bare = panel.match(/catch \{\s*setError\(t\('generationFailed'\)\)/g) ?? [];
  assert.equal(bare.length, 0);
});
