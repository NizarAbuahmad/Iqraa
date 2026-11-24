// The shared text field (`components/ui/Input.tsx`) on the web.
//
// react-native-web renders the field as an `<input size="20">` inside a flex
// row, and a flex item's `min-width` defaults to `auto`, so the `<input>` keeps
// its built-in ~20-character width however narrow the row is. On sign-up the
// first and last name share one line, and each `<input>` ran 80–112px past its
// rounded border (measured in Chromium at 1000px, 2026-11-24); the browser's
// own focus ring, drawn around the `<input>` and not the row, made it visible
// as a square box hanging off the field (reported from Safari). The row already
// shows focus (its border turns `colors.primary`), so the browser ring is a
// second, misplaced one.
//
// This reads the source because the mobile runner cannot load react-native.
// Check the real thing in a browser: `/register`, focus «اسم العائلة».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'components', 'ui', 'Input.tsx'),
  'utf8',
);

const inputStyle = src.match(/^\s*input:\s*\{([^}]*)\}/m)?.[1] ?? '';

test('the field may shrink below its built-in width', () => {
  assert.match(inputStyle, /minWidth:\s*0\b/, 'styles.input needs minWidth: 0');
});

test('the browser does not draw a second focus ring inside the field', () => {
  assert.match(inputStyle, /outlineStyle:\s*'none'/, "styles.input needs outlineStyle: 'none'");
});
