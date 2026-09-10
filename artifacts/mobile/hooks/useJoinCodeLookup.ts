import { useEffect, useState } from 'react';
import { lookupJoinCode, type JoinRosterEntry } from '@/services/roster';

/**
 * The code-lookup-and-name-picker logic shared by every screen that claims a
 * roster code — `join-class.tsx` (an existing user adding another class) and
 * `claim-required.tsx` (a brand-new parent/student's mandatory first claim).
 * Extracted rather than duplicated a third time; this is lifted verbatim from
 * `join-class.tsx`'s original inline version.
 */
export function useJoinCodeLookup() {
  const [code, setCode] = useState('');
  /** The class behind a whole-class code, or null when the code names its own student (or is simply wrong). */
  const [roster, setRoster] = useState<JoinRosterEntry[] | null>(null);
  const [className, setClassName] = useState('');
  const [studentId, setStudentId] = useState('');

  // Codes are a fixed six characters, so "long enough to be a code" is the
  // whole trigger — no debounce timer to get wrong. A 404 is the ordinary
  // answer for a per-student claim code, which needs no picker, so it clears
  // the roster rather than surfacing an error; the server is still the thing
  // that decides whether the code is real.
  useEffect(() => {
    const trimmed = code.trim();
    if (trimmed.length < 6) {
      setRoster(null);
      setClassName('');
      setStudentId('');
      return;
    }
    let live = true;
    void lookupJoinCode(trimmed)
      .then(res => {
        if (!live) return;
        setRoster(res.students);
        setClassName(res.class.name);
        setStudentId('');
      })
      .catch(() => {
        if (!live) return;
        setRoster(null);
        setClassName('');
        setStudentId('');
      });
    return () => {
      live = false;
    };
  }, [code]);

  const canSubmit = code.trim().length >= 6 && (!roster || roster.length === 0 || studentId !== '');

  return { code, setCode, roster, className, studentId, setStudentId, canSubmit };
}
