/**
 * "Teacher Amal Ammourah" — a Jordanian-curriculum science channel (Grades
 * 4/5/7, one video per lesson plus a solve-the-unit-questions video per unit).
 * When a deck/result asks for a video, a lesson match here beats a generic
 * YouTube search: same curriculum, same dialect, and it costs no search quota
 * (the upload list is read once a day and matched locally).
 *
 * Embed-only: we link/embed, never copy the content (see YouTube licensing).
 */
export const TEACHER_CHANNEL_ID = "UCtpUUHkA-D2cPXZPRiHr79w";

export interface ChannelVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  url: string;
}

const GRADES: Record<string, string> = { الرابع: "4", الخامس: "5", السابع: "7" };

/** Strip diacritics/tatweel and fold the letter variants that differ by typist. */
export function norm(s: string): string {
  return s
    .replace(/[ً-ٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

function gradeOf(s: string): string | null {
  const m = norm(s).match(/للصف (\S+)/);
  return (m && GRADES[m[1]!]) || null;
}

/** «العلوم للصف الخامس الأساسي | الطاقة الميكانيكية» → «الطاقة الميكانيكية» */
function topicOf(title: string): string {
  return norm(title.split("|").pop() ?? "").replace(/\(.*?\)/g, "").trim();
}

/**
 * Best channel video for a lesson query, or null. The query has to contain the
 * whole lesson topic ("الكهرباء" alone must not claim "الكهرباء الساكنة"), the
 * longest topic wins, and a grade named in the query must agree with the video.
 */
export function matchChannelVideos(query: string, videos: ChannelVideo[]): ChannelVideo[] {
  const q = norm(query);
  const qGrade = gradeOf(q) ?? (q.match(/(?:grade|g)\s?-?(4|5|7)\b/i)?.[1] ?? null);
  return videos
    .map(v => ({ v, topic: topicOf(v.title) }))
    .filter(({ v, topic }) => topic.length >= 4 && q.includes(topic) && (!qGrade || gradeOf(v.title) === qGrade))
    .sort((a, b) => b.topic.length - a.topic.length)
    .map(({ v }) => v);
}

const DAY_MS = 24 * 60 * 60 * 1000;
let cache: { at: number; videos: ChannelVideo[] } | null = null;

/** Embeddable uploads, cached a day. [] on any failure — callers fall back. */
export async function getChannelVideos(apiKey: string): Promise<ChannelVideo[]> {
  if (cache && Date.now() - cache.at < DAY_MS) return cache.videos;
  try {
    // The uploads playlist id is the channel id with UC → UU. 1 quota unit a page.
    const playlist = "UU" + TEACHER_CHANNEL_ID.slice(2);
    const ids: string[] = [];
    let page = "";
    for (let i = 0; i < 6; i++) {
      const r = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50`
          + `&playlistId=${playlist}${page ? `&pageToken=${page}` : ""}&key=${apiKey}`,
      );
      if (!r.ok) return cache?.videos ?? [];
      const d = (await r.json()) as {
        nextPageToken?: string;
        items?: Array<{ contentDetails: { videoId: string } }>;
      };
      for (const it of d.items ?? []) ids.push(it.contentDetails.videoId);
      if (!d.nextPageToken) break;
      page = d.nextPageToken;
    }
    const videos: ChannelVideo[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const r = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${ids.slice(i, i + 50).join(",")}&key=${apiKey}`,
      );
      if (!r.ok) return cache?.videos ?? [];
      const d = (await r.json()) as {
        items?: Array<{ id: string; snippet: { title: string; channelTitle: string }; status: { embeddable: boolean } }>;
      };
      for (const it of d.items ?? []) {
        if (!it.status.embeddable) continue;
        videos.push({
          videoId: it.id,
          title: it.snippet.title,
          channelTitle: it.snippet.channelTitle,
          url: `https://www.youtube.com/watch?v=${it.id}`,
        });
      }
    }
    cache = { at: Date.now(), videos };
    return videos;
  } catch {
    return cache?.videos ?? [];
  }
}
