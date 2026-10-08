/** Short "how long ago" for a chat thread — shared by the inbox and the bell's panel. */
export function relativeTime(iso: string, lang: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === 'ar' ? 'الآن' : 'now';
  if (mins < 60) return lang === 'ar' ? `${mins}د` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === 'ar' ? `${hrs}س` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return lang === 'ar' ? `${days}ي` : `${days}d`;
  const wks = Math.floor(days / 7);
  return lang === 'ar' ? `${wks}أ` : `${wks}w`;
}
