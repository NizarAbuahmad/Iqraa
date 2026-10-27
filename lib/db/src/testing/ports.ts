/**
 * The API port for one of the two servers rlsDiff boots side by side.
 *
 * Both used to draw `8500 + random(400)` on their own, and one pair in 400 matched. The second server then
 * failed to bind, the first answered the health check for both, and every request meant for "on" reached
 * "off": a doubled push log on one side, an empty one on the other, and an enforcing server that answered
 * 200 where it must refuse. Each mode now has its own range, so no two draws can meet. The draw is still
 * random inside the range, so two runs on one machine rarely share a port either.
 */
export function rlsDiffPort(enforce: "on" | "off", random: () => number = Math.random): number {
  const first = enforce === "on" ? 8700 : 8500;
  return first + Math.floor(random() * 200);
}
