import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { matchChannelVideos, type ChannelVideo } from "../teacherChannel.ts";

const v = (id: string, title: string): ChannelVideo => ({
  videoId: id, title, channelTitle: "t", url: `https://www.youtube.com/watch?v=${id}`,
});
const vids = [
  v("a", "العلوم للصف الرابع الأساسي | الكهرباء"),
  v("b", "العلوم للصف السابع الأساسي | الكهرباء الساكنة"),
  v("c", "العلوم للصف الخامس الأساسي | الطاقة الميكانيكية"),
  v("d", "العلوم للصف الخامس الأساسي | حل أسئلة الوحدة التاسعة (انظر إلى التعليقات)"),
];

describe("matchChannelVideos", () => {
  it("prefers the longest topic so a short one never steals a longer lesson", () => {
    assert.equal(matchChannelVideos("الكهرباء الساكنة", vids)[0]?.videoId, "b");
  });
  it("respects a grade named in the query", () => {
    assert.equal(matchChannelVideos("الكهرباء للصف الرابع", vids)[0]?.videoId, "a");
    assert.equal(matchChannelVideos("الكهرباء للصف السابع", vids).length, 0);
  });
  it("matches through diacritic and hamza variants", () => {
    assert.equal(matchChannelVideos("الطّاقة الميكانيكيّة", vids)[0]?.videoId, "c");
  });
  it("matches unit-question videos and ignores unrelated queries", () => {
    assert.equal(matchChannelVideos("حل أسئلة الوحدة التاسعة", vids)[0]?.videoId, "d");
    assert.equal(matchChannelVideos("المعادلات التربيعية", vids).length, 0);
  });
});
