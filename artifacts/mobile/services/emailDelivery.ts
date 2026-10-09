/**
 * Whether the server said the verification email did NOT go out.
 *
 * `/auth/register` and `/auth/change-unverified-email` answer `emailSent` since
 * 2026-10-07. A server that predates it sends no such field, and that has to
 * read as "sent" — hence `=== false` rather than a falsy test — or every signup
 * against it would open with a false alarm. Imports nothing, so it runs under
 * the bare `node --test` runner.
 */
export function emailNotSent(response: { emailSent?: boolean }): boolean {
  return response.emailSent === false;
}
