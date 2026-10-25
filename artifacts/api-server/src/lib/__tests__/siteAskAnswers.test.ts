/**
 * The site Q&A bot's reviewed fixed answers.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/siteAskAnswers.test.ts
 *
 * Two kinds of test live here. The golden tables pin what a visitor typing a
 * natural question gets back from the matcher (siteAskMatch.ts) when it is
 * given THIS list: each question must route to the stated entry, and each
 * off-topic one must fall through to the AI path (null). The structural tests
 * pin the shape of the reviewed text itself — no digits (a count goes stale),
 * no markup, only the whitelisted links, short enough to read in a chat bubble.
 *
 * The golden questions were fixed by the product owner's reviewer: do not edit,
 * drop or loosen one to make the data pass; change the phrases instead.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { CURATED_ANSWERS } from "../siteAskAnswers.ts";
import { matchCurated, tokenize } from "../siteAskMatch.ts";

const EXPECTED_IDS = [
  "greeting",
  "thanks",
  "what-is",
  "free",
  "curriculum",
  "coverage",
  "outputs",
  "math-check",
  "app-needed",
  "android",
  "iphone",
  "students",
  "privacy",
  "contact",
  "not-a-chatbot",
  "teacher-review",
  "other-countries",
] as const;

const GOLDEN: Record<(typeof EXPECTED_IDS)[number], readonly string[]> = {
  greeting: ["مرحبا", "السلام عليكم", "اهلا", "hello", "hi"],
  thanks: ["شكرا", "شكراً جزيلاً", "thanks", "thank you"],
  "what-is": ["شو هو إقرأ؟", "ما هو تطبيق إقرأ", "what is iqraa?", "tell me about iqraa"],
  free: [
    "هل إقرأ مجاني؟",
    "كم السعر",
    "ببلاش ولا بفلوس؟",
    "is it free",
    "it's free?",
    "how much does iqraa cost",
    "iqraa cost",
    "iqraa price",
    "سعر إقرأ",
    "هل يوجد اشتراك",
  ],
  curriculum: ["هل المحتوى حسب المنهاج الأردني؟", "does it follow the jordanian curriculum", "مرتبط بمنهاج وزارة التربية؟"],
  coverage: ["هل صف العاشر متوفر؟", "which grades and subjects are available", "ما المواد المتاحة"],
  outputs: ["ماذا يمكنني أن أعد باستخدام إقرأ؟", "what can i prepare with iqraa", "هل يعمل ورقة عمل واختبار؟"],
  "math-check": ["كيف يتحقق من الإجابات الرياضية؟", "how are the math answers verified", "هل مفتاح الإجابة للرياضيات صحيح؟"],
  "app-needed": ["هل أحتاج تنزيل تطبيق؟", "do i need to install an app", "هل يعمل على المتصفح؟"],
  android: ["هل يوجد تطبيق اندرويد؟", "is there an android app", "كيف احمل التطبيق من بلاي ستور"],
  iphone: ["هل في نسخة للايفون؟", "is there an iphone app", "تطبيق آيفون"],
  students: ["كيف يدخل الطلاب الاختبار؟", "how do students take the quiz", "كيف يدخل الطالب على الاختبار"],
  privacy: ["هل بياناتي آمنة؟", "what is your privacy policy", "سياسة الخصوصية"],
  contact: ["كيف اتواصل معكم؟", "how can i contact you", "ايميل التواصل"],
  "not-a-chatbot": ["هل هو شات بوت عام؟", "can i ask it anything", "هل هذا مثل شات جي بي تي"],
  "teacher-review": ["هل أستطيع تعديل المخرجات؟", "can i edit what it generates", "هل المحتوى جاهز للطباعة؟"],
  "other-countries": ["هل يدعم منهاج السعودية؟", "does it cover other countries", "is it only for jordan"],
};

const MUST_BE_NULL: readonly string[] = [
  "what is the capital of France",
  "من فاز بكأس العالم",
  "اكتب لي خطة درس عن التفاضل",
  "solve x squared equals four",
  "هل إقرأ أفضل من شات جي بي تي في كتابة الشعر",
  "كم عدد المعلمين المسجلين",
  "who founded iqraa",
  "do you have a referral program",
  "ما هو رقم هاتفكم",
  "tell me a joke",
  "ما هي عاصمة الأردن",
  "asdfgh",
  "؟؟؟",
  "",
  "كيف احضر درس التفاضل للصف العاشر",
  "what is the weather today",
  "can iqraa write my homework for me",
  "هل إقرأ أفضل من منصة أخرى",
];

const idOf = (message: string): string | null => matchCurated(message, CURATED_ANSWERS)?.entry.id ?? null;

describe("CURATED_ANSWERS — the list", () => {
  it("has exactly the seventeen ids, in order, each once", () => {
    assert.deepEqual(
      CURATED_ANSWERS.map(e => e.id),
      [...EXPECTED_IDS],
    );
    assert.equal(new Set(CURATED_ANSWERS.map(e => e.id)).size, EXPECTED_IDS.length);
  });
});

describe("CURATED_ANSWERS — golden questions route to their entry", () => {
  for (const id of EXPECTED_IDS) {
    for (const q of GOLDEN[id]) {
      it(`${id}: ${q}`, () => {
        assert.equal(idOf(q), id);
      });
    }
  }
});

describe("CURATED_ANSWERS — golden questions that must fall through to the AI path", () => {
  for (const q of MUST_BE_NULL) {
    it(`null: ${JSON.stringify(q)}`, () => {
      assert.equal(idOf(q), null);
    });
  }

  it("keeps the words that flip or change a question out of every phrase", () => {
    // If any of these became a phrase word, a question using it would no longer be
    // vetoed as "about something no answer was written for".
    const vocabulary = new Set<string>();
    for (const e of CURATED_ANSWERS) for (const p of e.phrases) for (const t of tokenize(p)) vocabulary.add(t);
    for (const w of [
      "not", "isnt", "dont", "doesnt", "cant", "no",
      "safe", "chatgpt", "gpt", "weather", "today", "referral", "founded", "joke", "capital", "france",
      "write", "homework", "better", "best", "worse", "versus", "vs",
      "افضل", "اسوا", "عاصمه", "شعر", "تفاضل", "هاتفكم", "رقم", "عدد", "مسجلين", "منصه",
    ]) {
      assert.equal(vocabulary.has(w), false, `${w} must not be in any phrase`);
    }
  });
});

describe("CURATED_ANSWERS — the reviewed text", () => {
  const ALLOWED_URLS = ["https://www.iqrra.com/manhaj", "https://www.iqrra.com/privacy", "https://app.iqrra.com"];
  const ALLOWED_EMAIL = "info@iqrra.com";

  /** The answer with each allowed link and the address replaced by a placeholder word, so its dots are not sentence ends. */
  function withoutLinks(text: string): string {
    let out = text;
    for (const url of ALLOWED_URLS) out = out.split(url).join("LINK");
    return out.split(ALLOWED_EMAIL).join("MAILBOX");
  }

  function sentenceCount(text: string): number {
    return (withoutLinks(text).match(/[.!?؟]+/g) ?? []).length;
  }

  const texts = CURATED_ANSWERS.flatMap(e => [
    { where: `${e.id}.ar`, lang: "ar" as const, text: e.ar },
    { where: `${e.id}.en`, lang: "en" as const, text: e.en },
  ]);

  it("has Arabic letters in every ar and none in any en", () => {
    for (const t of texts) {
      const hasArabic = /\p{Script=Arabic}/u.test(t.text);
      assert.equal(hasArabic, t.lang === "ar", t.where);
    }
  });

  it("has no digits, markup characters or emoji", () => {
    for (const t of texts) {
      assert.doesNotMatch(t.text, /[0-9٠-٩۰-۹]/, `${t.where}: digit`);
      assert.doesNotMatch(t.text, /[*#`]/, `${t.where}: markup`);
      assert.doesNotMatch(t.text, /\p{Extended_Pictographic}/u, `${t.where}: emoji`);
      assert.equal(t.text, t.text.trim(), `${t.where}: untrimmed`);
      assert.doesNotMatch(t.text, /\n/, `${t.where}: line break`);
    }
  });

  it("is at most 320 characters and at most 3 sentences, and not empty", () => {
    for (const t of texts) {
      assert.ok(t.text.length > 0, `${t.where}: empty`);
      assert.ok(t.text.length <= 320, `${t.where}: ${t.text.length} characters`);
      assert.ok(sentenceCount(t.text) <= 3, `${t.where}: ${sentenceCount(t.text)} sentences`);
      assert.ok(sentenceCount(t.text) >= 1, `${t.where}: no sentence end`);
    }
  });

  it("links only to the three allowed addresses and mentions only the one mailbox", () => {
    for (const t of texts) {
      for (const link of t.text.match(/https?:\/\/[^\s]*/g) ?? []) {
        assert.ok(
          ALLOWED_URLS.some(u => link === u || link === u + "." || link === u + "،"),
          `${t.where}: ${link}`,
        );
      }
      assert.doesNotMatch(withoutLinks(t.text), /https?:|www\.|\.com/i, `${t.where}: stray link`);
      for (const email of t.text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) {
        assert.equal(email, ALLOWED_EMAIL, `${t.where}: ${email}`);
      }
    }
  });

  it("spells the brand «إقرأ» in Arabic and Iqraa in English", () => {
    for (const t of texts) {
      const prose = withoutLinks(t.text);
      if (t.lang === "ar") {
        for (const m of prose.match(/[اإأ]قر[اأ]/g) ?? []) assert.equal(m, "إقرأ", `${t.where}: ${m}`);
        assert.doesNotMatch(prose, /iqra/i, `${t.where}: latin brand in Arabic text`);
      } else {
        for (const m of prose.match(/iqr+a+/gi) ?? []) assert.equal(m, "Iqraa", `${t.where}: ${m}`);
      }
    }
  });
});

describe("CURATED_ANSWERS — the phrases", () => {
  it("has at least six phrases per entry, each with at least one token", () => {
    for (const e of CURATED_ANSWERS) {
      assert.ok(e.phrases.length >= 6, `${e.id}: ${e.phrases.length} phrases`);
      for (const p of e.phrases) assert.ok(tokenize(p).length >= 1, `${e.id}: «${p}» has no token`);
    }
  });

  it("matches every phrase of every entry to its own entry", () => {
    for (const e of CURATED_ANSWERS) {
      for (const p of e.phrases) {
        const hit = matchCurated(p, CURATED_ANSWERS);
        assert.ok(hit, `no match for «${p}» (${e.id})`);
        assert.equal(hit.entry.id, e.id, `«${p}» went to ${hit.entry.id}, not ${e.id}`);
      }
    }
  });

  it("never gives two entries a phrase with the same token set", () => {
    const owner = new Map<string, string>();
    for (const e of CURATED_ANSWERS) {
      for (const p of e.phrases) {
        const key = [...tokenize(p)].sort().join(" ");
        const seen = owner.get(key);
        if (seen !== undefined) assert.equal(seen, e.id, `«${p}» (${e.id}) has the token set of an ${seen} phrase`);
        owner.set(key, e.id);
      }
    }
  });
});
