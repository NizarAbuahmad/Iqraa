-- Grade 1 evaluations still in draft keep only the question types a six-year-old can answer
-- (FIRST_GRADE_EVALUATION_TYPES in lib/exam-paper, decided 2026-11-13): multiple choice,
-- true/false, matching, fill in the blank, a practical task. Before that the picker offered
-- every type with short answer ticked, so older drafts hold short_answer, open_ended or
-- problem_solving. Generation already narrows them (routes/evaluations.ts); this makes the
-- stored row say the same. A draft left with none keeps choice and true/false
-- (FIRST_GRADE_DEFAULT_TYPES). Order is kept. Published and closed papers are not touched:
-- their types describe questions they already hold and can no longer be regenerated.
UPDATE "evaluations" AS e
SET "assessment_types" = COALESCE(
  (SELECT jsonb_agg(t.value ORDER BY t.ord)
     FROM jsonb_array_elements_text(e."assessment_types") WITH ORDINALITY AS t(value, ord)
    WHERE t.value IN ('multiple_choice', 'true_false', 'matching', 'fill_blank', 'practical_task')),
  '["multiple_choice", "true_false"]'::jsonb)
WHERE e."grade_id" = 'grade-1'
  AND e."status" = 'draft'
  AND jsonb_typeof(e."assessment_types") = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(e."assessment_types") AS t(value)
     WHERE t.value NOT IN ('multiple_choice', 'true_false', 'matching', 'fill_blank', 'practical_task'));
