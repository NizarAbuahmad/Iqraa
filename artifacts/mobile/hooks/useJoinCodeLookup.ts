import { useEffect, useState } from 'react';
import { RosterError, lookupJoinCode, type JoinRosterEntry } from '@/services/roster';
import { canSubmitClaim, type JoinCodeState } from '@/services/claimCodeGate';

/**
 * The code-lookup-and-name-picker logic shared by every screen that claims a
 * roster code — `join-class.tsx` (an existing user adding another class) and
 * `claim-required.tsx` (a brand-new parent/student's mandatory first claim).
 *
 * What the lookup turned up is carried as `state`, not inferred from
 * `roster === null`. It used to be: every failure cleared the roster, and a
 * cleared roster meant "per-student code, no picker needed, go ahead and
 * submit". So when `GET /auth/join/:code` began 500ing on classes with an
 * empty roster, the screen quietly offered Continue and the server answered
 * "Choose your name from the class list" — with no list on screen to obey.
 * A 404 is still the ordinary answer for a per-student code; anything else is
 * now `error`, and blocks (services/claimCodeGate.ts).
 */
export function useJoinCodeLookup() {
  const [code, setCode] = useState('');
  /** The class behind a whole-class code. Null until a lookup resolves one. */
  const [roster, setRoster] = useState<JoinRosterEntry[] | null>(null);
  const [className, setClassName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [state, setState] = useState<JoinCodeState>('short');

  // Codes are a fixed six characters, so "long enough to be a code" is the
  // whole trigger — no debounce timer to get wrong.
  useEffect(() => {
    const trimmed = code.trim();
    if (trimmed.length < 6) {
      setRoster(null);
      setClassName('');
      setStudentId('');
      setState('short');
      return;
    }
    let live = true;
    // Blocks submit for the width of the request. Without it, typing the last
    // character and hitting Continue sends the claim before the picker it
    // needs has had a chance to appear.
    setState('checking');
    void lookupJoinCode(trimmed)
      .then(res => {
        if (!live) return;
        setRoster(res.students);
        setClassName(res.class.name);
        setStudentId('');
        // A class with a live code but nobody on the roster yet: the joiner
        // cannot fix this, only their teacher can, so the screen says so
        // rather than offering a button the server will refuse.
        setState(res.students.length > 0 ? 'class' : 'empty-class');
      })
      .catch(err => {
        if (!live) return;
        setRoster(null);
        setClassName('');
        setStudentId('');
        // 404 is not a failure here — it is how a per-student claim code,
        // which names its own student and needs no picker, answers this
        // class-only endpoint. Every other status means we do not know what
        // this code is, which is not the same thing.
        setState(err instanceof RosterError && err.status === 404 ? 'student-code' : 'error');
      });
    return () => {
      live = false;
    };
  }, [code]);

  return {
    code,
    setCode,
    roster,
    className,
    studentId,
    setStudentId,
    state,
    canSubmit: canSubmitClaim(state, studentId),
  };
}
