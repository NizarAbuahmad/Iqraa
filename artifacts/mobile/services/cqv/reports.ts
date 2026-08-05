import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getArtifactDef } from './artifacts';
import { getCqvLesson } from './catalog';
import {
  CQV_ARTIFACT_IDS,
  type CqvArtifactId,
  type CqvReport,
  type CqvScores,
  type CqvVerdict,
} from './types';

const STORAGE_KEY = '@iqra_cqv_reports_v1';

const EMPTY_SCORES: CqvScores = {
  educationalQuality: null,
  arabicLanguage: null,
  curriculumAlignment: null,
  teacherUsability: null,
  formatting: null,
  teacherTrust: null,
};

function reportId(lessonId: string, artifactId: CqvArtifactId) {
  return `${lessonId}__${artifactId}`;
}

export function createEmptyReport(lessonId: string, artifactId: CqvArtifactId): CqvReport | null {
  const lesson = getCqvLesson(lessonId);
  if (!lesson) return null;
  const artifact = getArtifactDef(artifactId);
  const now = new Date().toISOString();
  return {
    id: reportId(lessonId, artifactId),
    lessonId,
    lessonName: lesson.lessonName,
    lessonNameAr: lesson.lessonNameAr,
    semester: lesson.semester,
    unitId: lesson.unitId,
    unitName: lesson.unitName,
    unitNameAr: lesson.unitNameAr,
    artifactId,
    artifactLabel: artifact.label,
    verdict: 'pending',
    scores: { ...EMPTY_SCORES },
    notes: '',
    improvements: '',
    reviewedAt: null,
    updatedAt: now,
    generatedAt: null,
    generationError: null,
    savedMaterialId: null,
  };
}

/** Normalize older stored reports that predate generation fields. */
export function normalizeReport(report: CqvReport): CqvReport {
  return {
    ...report,
    generatedAt: report.generatedAt ?? null,
    generationError: report.generationError ?? null,
    savedMaterialId: report.savedMaterialId ?? null,
    scores: { ...EMPTY_SCORES, ...report.scores },
  };
}

async function readAll(): Promise<Record<string, CqvReport>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw) as Record<string, CqvReport>;
    for (const id of Object.keys(map)) {
      map[id] = normalizeReport(map[id]!);
    }
    return map;
  } catch {
    return {};
  }
}

const OUTPUTS_KEY = '@iqra_cqv_outputs_v1';

export type CqvGeneratedOutput = {
  reportId: string;
  lessonId: string;
  artifactId: CqvArtifactId;
  title: string;
  content: string;
  materialType: 'lesson' | 'worksheet' | 'quiz' | 'flow';
  generatedAt: string;
};

async function readOutputs(): Promise<Record<string, CqvGeneratedOutput>> {
  try {
    const raw = await AsyncStorage.getItem(OUTPUTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CqvGeneratedOutput>;
  } catch {
    return {};
  }
}

async function writeOutputs(map: Record<string, CqvGeneratedOutput>): Promise<void> {
  await AsyncStorage.setItem(OUTPUTS_KEY, JSON.stringify(map));
}

export async function saveGeneratedOutput(output: CqvGeneratedOutput): Promise<void> {
  const map = await readOutputs();
  map[output.reportId] = output;
  await writeOutputs(map);
}

export async function getGeneratedOutput(
  lessonId: string,
  artifactId: CqvArtifactId,
): Promise<CqvGeneratedOutput | null> {
  const map = await readOutputs();
  return map[reportId(lessonId, artifactId)] ?? null;
}

async function writeAll(map: Record<string, CqvReport>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export async function getReport(
  lessonId: string,
  artifactId: CqvArtifactId,
): Promise<CqvReport> {
  const map = await readAll();
  const id = reportId(lessonId, artifactId);
  return map[id] ?? createEmptyReport(lessonId, artifactId)!;
}

export async function getReportsForLesson(lessonId: string): Promise<CqvReport[]> {
  const map = await readAll();
  return CQV_ARTIFACT_IDS.map(artifactId => {
    const id = reportId(lessonId, artifactId);
    return map[id] ?? createEmptyReport(lessonId, artifactId)!;
  });
}

export async function saveReport(report: CqvReport): Promise<CqvReport> {
  const map = await readAll();
  const next: CqvReport = {
    ...report,
    updatedAt: new Date().toISOString(),
    reviewedAt: report.verdict === 'pending' ? report.reviewedAt : (report.reviewedAt ?? new Date().toISOString()),
  };
  map[next.id] = next;
  await writeAll(map);
  return next;
}

export async function getAllReports(): Promise<CqvReport[]> {
  const map = await readAll();
  return Object.values(map);
}

export async function clearAllReports(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

function scoreLine(label: string, value: number | null) {
  return `- **${label}:** ${value == null ? '_not scored_' : `${value}/10`}`;
}

export function reportToMarkdown(report: CqvReport): string {
  const lesson = getCqvLesson(report.lessonId);
  const artifact = getArtifactDef(report.artifactId);
  const s = report.scores;
  const verdict = report.verdict.toUpperCase();

  return `# CQV Report — ${report.lessonNameAr}

## Scope
- **Curriculum:** Jordan Curriculum
- **Grade:** 10
- **Subject:** Mathematics / الرياضيات
- **Semester:** ${report.semester} (${lesson?.semesterLabelAr ?? ''})
- **Unit:** ${report.unitNameAr} (${report.unitName})
- **Lesson:** ${report.lessonNameAr}
- **Lesson ID:** \`${report.lessonId}\`
- **Artifact:** ${artifact.labelAr} / ${artifact.label} (\`${report.artifactId}\`)

## Verdict
- **Pass / Fail:** **${verdict}**
- **Generated at:** ${report.generatedAt ?? '_not generated_'}
- **Reviewed at:** ${report.reviewedAt ?? '_not reviewed_'}
- **Updated at:** ${report.updatedAt}
- **Workspace id:** ${report.savedMaterialId ?? '_none_'}

## Scores (1–10)
${scoreLine('Educational Quality', s.educationalQuality)}
${scoreLine('Arabic Language', s.arabicLanguage)}
${scoreLine('Curriculum Alignment', s.curriculumAlignment)}
${scoreLine('Teacher Usability', s.teacherUsability)}
${scoreLine('Formatting', s.formatting)}
${scoreLine('Teacher Trust', s.teacherTrust)}

## Notes
${report.notes.trim() || '_None_'}

## Recommended improvements
${report.improvements.trim() || '_None_'}

---
_Generated by IQRA CQV (internal tooling). Not part of Investor MVP UI._
`;
}

export function lessonSummaryMarkdown(lessonId: string, reports: CqvReport[]): string {
  const lesson = getCqvLesson(lessonId);
  if (!lesson) return `# CQV — Unknown lesson \`${lessonId}\`\n`;

  const lines = reports.map(r => {
    const avg = averageScore(r.scores);
    return `| ${r.artifactLabel} | ${r.verdict} | ${avg == null ? '—' : avg.toFixed(1)} |`;
  });

  return `# CQV Lesson Summary — ${lesson.lessonNameAr}

- **Semester:** ${lesson.semesterLabelAr}
- **Unit:** ${lesson.unitNameAr}
- **Lesson ID:** \`${lesson.lessonId}\`

| Artifact | Verdict | Avg score |
|----------|---------|-----------|
${lines.join('\n')}

## Individual reports

${reports.map(r => reportToMarkdown(r)).join('\n\n')}
`;
}

export function averageScore(scores: CqvScores): number | null {
  const vals = Object.values(scores).filter((v): v is number => typeof v === 'number');
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Web-only download helper. No-op on native. */
export function downloadMarkdown(filename: string, content: string): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  try {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

export function clampScore(n: number | null): number | null {
  if (n == null || Number.isNaN(n)) return null;
  return Math.max(1, Math.min(10, Math.round(n)));
}

export function parseVerdict(v: string): CqvVerdict {
  if (v === 'pass' || v === 'fail' || v === 'pending') return v;
  return 'pending';
}
