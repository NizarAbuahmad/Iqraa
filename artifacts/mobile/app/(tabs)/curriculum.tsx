/**
 * The «المكتبة» tab. The route file keeps its old name so every link to
 * `/(tabs)/curriculum` and the student allowlist prefix stay valid; the
 * subject grid it used to show now lives at `/curriculum/browse`, reached
 * from the المنهاج card at the top of the library.
 */
import React from 'react';
import { LibraryScreen } from '../curriculum/resources';

export default function CurriculumTab() {
  return <LibraryScreen asTab />;
}
