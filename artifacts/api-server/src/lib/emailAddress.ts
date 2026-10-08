/**
 * Whether `value` is an address a mail provider can deliver to.
 *
 * Signup used to ask only for an "@", so «info@zarya.gate@gmail.com» created an
 * account and answered "check your email" for a code that could never arrive.
 * This is deliberately the practical subset of RFC 5321, not the whole grammar:
 * one "@", a dotted-atom local part, and a domain of two or more ASCII labels
 * ending in a letters-only TLD. Quoted local parts, comments and IP-literal
 * domains are valid in the RFC and useless for a teacher's inbox.
 *
 * ASCII only on purpose. The sender is Resend, which does not deliver to
 * Arabic-script local parts, so accepting one would reproduce the bug this
 * exists to prevent; an IDN domain has to be given in its punycode form.
 *
 * Judged on the trimmed value, because every caller trims before it stores.
 */
const LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const TLD = /^[A-Za-z]{2,}$/;

export function isValidEmailAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const email = value.trim();
  if (email.length > 254) return false;

  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts as [string, string];

  if (local.length === 0 || local.length > 64 || !LOCAL.test(local)) return false;

  const labels = domain.split(".");
  if (labels.length < 2) return false;
  if (!labels.every((label) => label.length <= 63 && LABEL.test(label))) return false;
  return TLD.test(labels[labels.length - 1]!);
}
