/**
 * The topic summary under a released result (`topics`, since 2026-11-27), as the card
 * reads it: the objective names in the reader's language, «ما أُتقن» and «ما يحتاج إلى
 * مراجعة». What may be listed is the server's decision (`topicSummary` in the API:
 * names only, two questions or more, at most three each way); this only picks the
 * language and tolerates an older server that sends no `topics`.
 */
export interface ResultTopic {
  objectiveId: string;
  title: string;
  titleAr: string;
}

export interface ResultTopics {
  strong: ResultTopic[];
  weak: ResultTopic[];
}

export function resultTopicLines(
  topics: Partial<ResultTopics> | null | undefined,
  lang: 'ar' | 'en',
): { strong: string[]; weak: string[] } {
  const name = (t: ResultTopic) => ((lang === 'ar' ? t.titleAr || t.title : t.title || t.titleAr) || '').trim();
  const lines = (list: ResultTopic[] | undefined) => (Array.isArray(list) ? list.map(name).filter(Boolean) : []);
  return { strong: lines(topics?.strong), weak: lines(topics?.weak) };
}
