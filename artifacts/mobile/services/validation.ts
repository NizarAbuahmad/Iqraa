/**
 * validateTopic
 * Returns true only when the topic string has at least one non-whitespace character.
 * Used by every builder screen to gate the generate/build action.
 */
export function validateTopic(topic: string): boolean {
  return topic.trim().length > 0;
}
