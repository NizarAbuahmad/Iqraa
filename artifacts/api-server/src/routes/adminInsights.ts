/**
 * The admin insights page (docs/superpowers/specs/2026-11-19-admin-user-insights-design.md):
 *
 *   GET /admin/insights?days=7|30|90         — where time goes, top features, returning and
 *                                              churned users, weekly cohorts, the most frequent
 *                                              users, what they like, who the teachers are.
 *   GET /admin/insights/users/:id?days=…      — one person's activity and details.
 *
 * System admin only: it spans every school and names individuals. Reads through `systemDb`
 * (listed in lib/__tests__/systemDbFiles.test.ts) because it reads every user's rows.
 *
 * "Active on a day" means any of: a time-spent beat (`usage_minutes`), an AI generation, a saved
 * material, an exam created, a homework posted, a chat message sent — one row per person per Amman
 * day whatever the mix. Time spent exists only from the day the heartbeat shipped
 * (`trackingSince`); the other sources go back as far as their tables.
 *
 * Demographic and "what they like" breakdowns hide any group of 1–2 people (lib/insights.ts,
 * `breakdown`). The frequent-users list and the per-user page name people on purpose — that is
 * what an admin asked for — and are admin-only for that reason.
 */
import { Router } from "express";
import { systemDb as db } from "@workspace/db";
import { sql, type SQL } from "drizzle-orm";
import { authMiddleware, requireRole } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { UUID } from "../lib/adminMetrics.js";
import { AMMAN_OFFSET_HOURS, addDays, ammanDay, ammanDayStart } from "../lib/dailyActivity.js";
import {
  ACTIVITY_LOOKBACK_DAYS,
  breakdown,
  buildCohorts,
  multiValueBreakdown,
  parseInsightsDays,
  summarizeActivity,
  weekStartOf,
} from "../lib/insights.js";

const router = Router();

const TOP_USERS = 50;
const COHORT_WEEKS = 8;

/** A timestamp column as its Amman calendar day. */
const local = (col: SQL) => sql`((${col} at time zone 'UTC') + make_interval(hours => ${AMMAN_OFFSET_HOURS}))::date`;

/** (person, Amman day) for every activity source, since `sinceDay` — optionally one person only. */
function activitySql(sinceDay: string, userId?: string): SQL {
  const since = ammanDayStart(sinceDay);
  const who = (col: SQL) => (userId ? sql` and ${col} = ${userId}` : sql``);
  return sql`
    select user_id, day from usage_minutes where day >= ${sinceDay}::date ${who(sql`user_id`)}
    union select user_id, ${local(sql`created_at`)} from ai_generations
      where created_at >= ${since} and user_id is not null ${who(sql`user_id`)}
    union select user_id, ${local(sql`created_at`)} from saved_materials
      where created_at >= ${since} ${who(sql`user_id`)}
    union select teacher_id, ${local(sql`created_at`)} from evaluations
      where created_at >= ${since} ${who(sql`teacher_id`)}
    union select teacher_id, ${local(sql`created_at`)} from homework
      where created_at >= ${since} ${who(sql`teacher_id`)}
    union select sender_id, ${local(sql`created_at`)} from chat_messages
      where created_at >= ${since} ${who(sql`sender_id`)}`;
}

const rowsOf = async <T extends Record<string, unknown>>(q: SQL): Promise<T[]> => (await db.execute<T>(q)).rows as T[];

/** One entry per day, oldest first, zero-filled. */
function dailySeries(endDay: string, days: number, rows: { day: string; minutes: number }[]) {
  const by = new Map(rows.map((r) => [r.day, r.minutes]));
  const out: { day: string; minutes: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(endDay, -i);
    out.push({ day, minutes: by.get(day) ?? 0 });
  }
  return out;
}

router.get("/admin/insights", authMiddleware, requireRole("system_admin"), async (req, res) => {
  const parsed = parseInsightsDays(req.query["days"]);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { days } = parsed;
  try {
    const endDay = ammanDay(new Date());
    const sinceDay = addDays(endDay, -(days - 1));
    const since = ammanDayStart(sinceDay);
    const lookbackDay = addDays(endDay, -(ACTIVITY_LOOKBACK_DAYS - 1));
    const currentWeek = weekStartOf(endDay);
    const firstCohortWeek = addDays(currentWeek, -7 * (COHORT_WEEKS - 1));

    const [
      areaRows,
      dayRows,
      platformRows,
      totals,
      trackingSince,
      generationRows,
      savedRows,
      counts,
      activityRows,
      signupRows,
      minutesByUser,
      areasByUser,
      generationsByUser,
      feedbackRows,
      favouriteRows,
      subjectRows,
      gradeRows,
      teacherTotal,
      genderRows,
      ageRows,
      governorateRows,
      yearsRows,
      teachSubjectRows,
      teachGradeRows,
    ] = await Promise.all([
      rowsOf<{ area: string; minutes: number; users: number }>(sql`
        select area, sum(minutes)::int as minutes, count(distinct user_id)::int as users
        from usage_minutes where day >= ${sinceDay}::date group by area order by 2 desc`),
      rowsOf<{ day: string; minutes: number }>(sql`
        select to_char(day, 'YYYY-MM-DD') as day, sum(minutes)::int as minutes
        from usage_minutes where day >= ${sinceDay}::date group by day`),
      rowsOf<{ platform: string; minutes: number }>(sql`
        select platform, sum(minutes)::int as minutes
        from usage_minutes where day >= ${sinceDay}::date group by platform order by 2 desc`),
      rowsOf<{ minutes: number; user_days: number }>(sql`
        select coalesce(sum(minutes), 0)::int as minutes, count(distinct (user_id, day))::int as user_days
        from usage_minutes where day >= ${sinceDay}::date`),
      rowsOf<{ day: string | null }>(sql`select to_char(min(day), 'YYYY-MM-DD') as day from usage_minutes`),
      rowsOf<{ kind: string; count: number; users: number }>(sql`
        select kind, count(*)::int as count, count(distinct user_id)::int as users
        from ai_generations where created_at >= ${since} and user_id is not null
        group by kind order by 2 desc`),
      rowsOf<{ type: string; count: number; users: number }>(sql`
        select type, count(*)::int as count, count(distinct user_id)::int as users
        from saved_materials where created_at >= ${since} group by type order by 2 desc`),
      rowsOf<{ evaluations: number; homework: number; chat_messages: number }>(sql`
        select
          (select count(*) from evaluations where created_at >= ${since})::int as evaluations,
          (select count(*) from homework where created_at >= ${since})::int as homework,
          (select count(*) from chat_messages where created_at >= ${since})::int as chat_messages`),
      rowsOf<{ user_id: string; day: string }>(sql`
        select a.user_id, to_char(a.day, 'YYYY-MM-DD') as day
        from (${activitySql(lookbackDay)}) a where a.user_id is not null`),
      rowsOf<{ id: string; week: string }>(sql`
        select id, to_char(${local(sql`created_at`)}, 'YYYY-MM-DD') as week
        from users where created_at >= ${ammanDayStart(firstCohortWeek)}`),
      rowsOf<{ user_id: string; minutes: number; last_beat: string }>(sql`
        select user_id, sum(minutes)::int as minutes, max(last_beat_at) as last_beat
        from usage_minutes where day >= ${sinceDay}::date group by user_id`),
      rowsOf<{ user_id: string; area: string; minutes: number }>(sql`
        select user_id, area, sum(minutes)::int as minutes
        from usage_minutes where day >= ${sinceDay}::date group by user_id, area`),
      rowsOf<{ user_id: string; count: number }>(sql`
        select user_id, count(*)::int as count from ai_generations
        where created_at >= ${since} and user_id is not null group by user_id`),
      rowsOf<{ key: string; up: number; down: number }>(sql`
        select coalesce(nullif(tool_id, ''), material_type) as key,
               (count(*) filter (where rating = 'up'))::int as up,
               (count(*) filter (where rating = 'down'))::int as down
        from feedback where created_at >= ${since} and rating in ('up', 'down')
        group by 1 order by (count(*)) desc`),
      rowsOf<{ type: string; count: number }>(sql`
        select type, count(*)::int as count from saved_materials where is_favorite group by type order by 2 desc`),
      rowsOf<{ key: string; count: number }>(sql`
        select nullif(subject, '') as key, count(distinct user_id)::int as count
        from saved_materials where created_at >= ${since} group by 1`),
      rowsOf<{ key: string; count: number }>(sql`
        select nullif(grade, '') as key, count(distinct user_id)::int as count
        from saved_materials where created_at >= ${since} group by 1`),
      rowsOf<{ count: number; with_subjects: number; with_grades: number }>(sql`
        select count(*)::int as count,
               (count(*) filter (where jsonb_array_length(subject_ids) > 0))::int as with_subjects,
               (count(*) filter (where jsonb_array_length(grade_ids) > 0))::int as with_grades
        from users where role = 'teacher'`),
      rowsOf<{ key: string | null; count: number }>(sql`
        select gender as key, count(*)::int as count from users where role = 'teacher' group by 1`),
      rowsOf<{ key: string | null; count: number }>(sql`
        select age_range as key, count(*)::int as count from users where role = 'teacher' group by 1`),
      rowsOf<{ key: string | null; count: number }>(sql`
        select governorate as key, count(*)::int as count from users where role = 'teacher' group by 1`),
      rowsOf<{ key: string | null; count: number }>(sql`
        select years_teaching as key, count(*)::int as count from users where role = 'teacher' group by 1`),
      rowsOf<{ key: string; count: number }>(sql`
        select s as key, count(*)::int as count
        from users, jsonb_array_elements_text(subject_ids) s where role = 'teacher' group by 1`),
      rowsOf<{ key: string; count: number }>(sql`
        select g as key, count(*)::int as count
        from users, jsonb_array_elements_text(grade_ids) g where role = 'teacher' group by 1`),
    ]);

    // ─── activity: active / returning / churned, cohorts ───────────────────
    const activity = activityRows.map((r) => ({ userId: r.user_id, day: r.day }));
    const summary = summarizeActivity(activity, endDay, days);
    const cohorts = buildCohorts(
      currentWeek,
      COHORT_WEEKS,
      signupRows.map((r) => ({ userId: r.id, signupWeek: weekStartOf(r.week) })),
      activity.map((a) => ({ userId: a.userId, week: weekStartOf(a.day) })),
    );

    // ─── the most frequent users ───────────────────────────────────────────
    const minutesOf = new Map(minutesByUser.map((r) => [r.user_id, r]));
    const ranked = [...summary.activeDays.entries()]
      .map(([userId, activeDays]) => ({ userId, activeDays, minutes: minutesOf.get(userId)?.minutes ?? 0 }))
      .sort((a, b) => b.activeDays - a.activeDays || b.minutes - a.minutes)
      .slice(0, TOP_USERS);
    const ids = ranked.map((r) => r.userId);
    const people = ids.length
      ? await rowsOf<{
          id: string;
          first_name: string;
          last_name: string;
          role: string;
          school: string | null;
          grade_ids: string[];
          subject_ids: string[];
          governorate: string | null;
          last_login: string | null;
        }>(sql`
          select u.id, u.first_name, u.last_name, u.role, s.name as school, u.grade_ids, u.subject_ids,
                 u.governorate, u.last_login
          from users u left join schools s on s.id = u.school_id
          where u.id in (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})`)
      : [];
    const personOf = new Map(people.map((p) => [p.id, p]));
    const areasOf = new Map<string, { area: string; minutes: number }[]>();
    for (const r of areasByUser) {
      if (!areasOf.has(r.user_id)) areasOf.set(r.user_id, []);
      areasOf.get(r.user_id)!.push({ area: r.area, minutes: r.minutes });
    }
    const generationsOf = new Map(generationsByUser.map((r) => [r.user_id, r.count]));
    const topUsers = ranked
      .filter((r) => personOf.has(r.userId))
      .map((r) => {
        const p = personOf.get(r.userId)!;
        const lastBeat = minutesOf.get(r.userId)?.last_beat ?? null;
        const lastSeen = [lastBeat, p.last_login].filter(Boolean).map((d) => new Date(d!).getTime());
        return {
          id: p.id,
          name: `${p.first_name} ${p.last_name}`.trim(),
          role: p.role,
          school: p.school,
          gradeIds: p.grade_ids,
          subjectIds: p.subject_ids,
          governorate: p.governorate,
          activeDays: r.activeDays,
          minutes: r.minutes,
          topAreas: (areasOf.get(r.userId) ?? [])
            .sort((a, b) => b.minutes - a.minutes)
            .slice(0, 3)
            .map((a) => a.area),
          generations: generationsOf.get(r.userId) ?? 0,
          lastSeen: lastSeen.length ? new Date(Math.max(...lastSeen)).toISOString() : null,
        };
      });

    const teachers = teacherTotal[0] ?? { count: 0, with_subjects: 0, with_grades: 0 };
    const total = totals[0] ?? { minutes: 0, user_days: 0 };
    const count = counts[0] ?? { evaluations: 0, homework: 0, chat_messages: 0 };
    res.json({
      timezone: "Asia/Amman",
      days,
      since: sinceDay,
      trackingSince: trackingSince[0]?.day ?? null,
      time: {
        totalMinutes: total.minutes,
        avgMinutesPerActiveDay: total.user_days ? Math.round((total.minutes / total.user_days) * 10) / 10 : 0,
        byArea: areaRows,
        byDay: dailySeries(endDay, days, dayRows),
        byPlatform: platformRows,
      },
      features: {
        generations: generationRows,
        saved: savedRows,
        evaluations: count.evaluations,
        homework: count.homework,
        chatMessages: count.chat_messages,
      },
      retention: {
        active: summary.active,
        returning: summary.returning,
        churned: summary.churned,
        cohorts,
      },
      topUsers,
      likes: {
        byTool: feedbackRows,
        favourites: favouriteRows,
        subjects: breakdown(subjectRows),
        grades: breakdown(gradeRows),
      },
      teachers: {
        total: teachers.count,
        gender: breakdown(genderRows),
        ageRange: breakdown(ageRows),
        governorate: breakdown(governorateRows),
        yearsTeaching: breakdown(yearsRows),
        // A teacher of two subjects is one teacher: who answered is counted per person, not summed.
        subjects: multiValueBreakdown(teachSubjectRows, teachers.with_subjects, teachers.count),
        grades: multiValueBreakdown(teachGradeRows, teachers.with_grades, teachers.count),
      },
    });
  } catch (err) {
    logger.error({ err }, "admin insights failed");
    res.status(500).json({ error: "Failed to load insights" });
  }
});

router.get("/admin/insights/users/:id", authMiddleware, requireRole("system_admin"), async (req, res) => {
  const id = String(req.params["id"] ?? "");
  if (!UUID.test(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  const parsed = parseInsightsDays(req.query["days"]);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { days } = parsed;
  try {
    const [person] = await rowsOf<{
      id: string;
      first_name: string;
      last_name: string;
      email: string | null;
      role: string;
      school: string | null;
      grade_ids: string[];
      subject_ids: string[];
      gender: string | null;
      age_range: string | null;
      governorate: string | null;
      years_teaching: string | null;
      signup_platform: string | null;
      created_at: string;
      last_login: string | null;
    }>(sql`
      select u.id, u.first_name, u.last_name, u.email, u.role, s.name as school, u.grade_ids, u.subject_ids,
             u.gender, u.age_range, u.governorate, u.years_teaching, u.signup_platform, u.created_at, u.last_login
      from users u left join schools s on s.id = u.school_id where u.id = ${id}`);
    if (!person) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const endDay = ammanDay(new Date());
    const sinceDay = addDays(endDay, -(days - 1));
    const since = ammanDayStart(sinceDay);
    const [minuteRows, activeRows, areaRows, generationRows, savedRows, feedbackRows, lastBeat] = await Promise.all([
      rowsOf<{ day: string; minutes: number }>(sql`
        select to_char(day, 'YYYY-MM-DD') as day, sum(minutes)::int as minutes
        from usage_minutes where user_id = ${id} and day >= ${sinceDay}::date group by day`),
      rowsOf<{ day: string }>(sql`
        select distinct to_char(a.day, 'YYYY-MM-DD') as day from (${activitySql(sinceDay, id)}) a`),
      rowsOf<{ area: string; minutes: number }>(sql`
        select area, sum(minutes)::int as minutes from usage_minutes
        where user_id = ${id} and day >= ${sinceDay}::date group by area order by 2 desc`),
      rowsOf<{ kind: string; count: number }>(sql`
        select kind, count(*)::int as count from ai_generations
        where user_id = ${id} and created_at >= ${since} group by kind order by 2 desc`),
      rowsOf<{ type: string; count: number; favourites: number }>(sql`
        select type, count(*)::int as count, (count(*) filter (where is_favorite))::int as favourites
        from saved_materials where user_id = ${id} group by type order by 2 desc`),
      rowsOf<{ rating: string; tool_id: string; material_type: string; comment: string; created_at: string }>(sql`
        select rating, tool_id, material_type, comment, created_at from feedback
        where user_id = ${id} order by created_at desc limit 20`),
      rowsOf<{ at: string | null }>(sql`select max(last_beat_at) as at from usage_minutes where user_id = ${id}`),
    ]);

    const activeDays = new Set(activeRows.map((r) => r.day));
    const seen = [lastBeat[0]?.at, person.last_login].filter(Boolean).map((d) => new Date(d!).getTime());
    res.json({
      timezone: "Asia/Amman",
      days,
      user: {
        id: person.id,
        name: `${person.first_name} ${person.last_name}`.trim(),
        email: person.email,
        role: person.role,
        school: person.school,
        gradeIds: person.grade_ids,
        subjectIds: person.subject_ids,
        teacherProfile: {
          gender: person.gender,
          ageRange: person.age_range,
          governorate: person.governorate,
          yearsTeaching: person.years_teaching,
        },
        signupPlatform: person.signup_platform,
        createdAt: person.created_at,
        lastSeen: seen.length ? new Date(Math.max(...seen)).toISOString() : null,
      },
      activeDays: activeDays.size,
      daily: dailySeries(endDay, days, minuteRows).map((d) => ({ ...d, active: activeDays.has(d.day) })),
      areas: areaRows,
      generations: generationRows,
      saved: savedRows,
      feedback: feedbackRows.map((f) => ({
        rating: f.rating,
        toolId: f.tool_id,
        materialType: f.material_type,
        comment: f.comment,
        createdAt: f.created_at,
      })),
    });
  } catch (err) {
    logger.error({ err }, "admin insights user failed");
    res.status(500).json({ error: "Failed to load this user's insights" });
  }
});

export default router;
