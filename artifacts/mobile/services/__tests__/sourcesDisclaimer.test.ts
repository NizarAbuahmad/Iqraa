/**
 * What this guards: «المصادر وإخلاء المسؤولية», the screen Play's review reads
 * against the store listing.
 *
 * - the disclaimer is the listing's sentence, word for word (brand «إقرأ»);
 * - the two official links are the exact addresses, over https;
 * - the screen opens signed out, and the login, register and Settings screens
 *   link to it — a reviewer has to be able to reach it cold;
 * - the source credit sits under textbook figures and on the curriculum lesson.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { displayUrl, SOURCE_LINKS, SOURCES_COPY, SOURCES_ROUTE, sourcesCopy } from '../../constants/sources.ts';
import { isPublicRoute } from '../routeGating.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const LISTING_DISCLAIMER_AR =
  '«إقرأ» تطبيق مستقل، وليس تطبيقًا حكوميًا. لا يمثّل وزارة التربية والتعليم وتنمية الموارد البشرية، ولا المركز الوطني لتطوير المناهج، ولا أي جهة حكومية أردنية، ولا يرتبط بها أو يحظى بتزكيتها.';

describe('sources and disclaimer', () => {
  it('says the store listing’s disclaimer word for word', () => {
    assert.equal(SOURCES_COPY.ar.disclaimer, LISTING_DISCLAIMER_AR);
    assert.equal(SOURCES_COPY.ar.title, 'المصادر وإخلاء المسؤولية');
    assert.equal(SOURCES_COPY.ar.credit, 'المصدر: المركز الوطني لتطوير المناهج');
  });

  it('links to exactly the two official sources', () => {
    assert.deepEqual(
      SOURCE_LINKS.map(l => [l.url, l.label.ar]),
      [
        ['https://nccd.gov.jo/Ar/Pages/textbooks', 'الكتب المدرسية – المركز الوطني لتطوير المناهج'],
        ['https://moehrd.gov.jo/', 'وزارة التربية والتعليم وتنمية الموارد البشرية'],
      ],
    );
    for (const l of SOURCE_LINKS) assert.ok(l.label.en.trim(), `${l.url} has no English label`);
    assert.deepEqual(SOURCE_LINKS.map(l => displayUrl(l.url)), ['nccd.gov.jo/Ar/Pages/textbooks', 'moehrd.gov.jo']);
  });

  it('has every string in both languages, and falls back to Arabic', () => {
    for (const lang of ['ar', 'en'] as const) {
      for (const [key, value] of Object.entries(SOURCES_COPY[lang])) {
        assert.ok(value.trim(), `${lang}.${key} is empty`);
      }
    }
    assert.equal(sourcesCopy('fr'), SOURCES_COPY.ar);
    assert.equal(sourcesCopy('en'), SOURCES_COPY.en);
  });

  it('opens signed out, as its own screen', () => {
    assert.equal(isPublicRoute(SOURCES_ROUTE), true);
    assert.ok(existsSync(join(ROOT, 'app/legal/sources.tsx')), 'app/legal/sources.tsx is missing');
  });

  it('is linked from login, register and Settings', () => {
    for (const rel of ['app/(auth)/login.tsx', 'app/(auth)/register.tsx']) {
      assert.match(read(rel), /<SourcesAuthLink \/>/, `${rel} does not link to the sources screen`);
    }
    assert.match(read('components/ui/SourcesAuthLink.tsx'), /SOURCES_ROUTE/);
    assert.match(read('app/settings.tsx'), /router\.push\(SOURCES_ROUTE/);
  });

  it('credits the NCCD under textbook figures and on the curriculum lesson', () => {
    assert.match(read('components/ui/BookFiguresPanel.tsx'), /<SourceCredit \/>/);
    assert.match(read('app/curriculum/lesson-detail.tsx'), /<SourceCredit \/>/);
  });
});
