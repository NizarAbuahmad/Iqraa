import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What this guards: the wiring of parent approval into the sign-up screen and the three role-switch screens.
 * The runner cannot render React, so the pure decision (`signupPlan`, `switchNeedsAgeConfirmation`) is tested in
 * `signupMethod.test.ts` and this file pins that the screens actually USE it: a screen that stopped calling
 * `signupPlan`, dropped `parentEmail` from a payload, or showed the age tick unconditionally would pass every
 * other test and break either the switch-on flow (no parent is ever asked) or the switch-off flow (today's tick).
 * Comments are stripped before scanning, so a comment may talk about all of this.
 */
const root = join(import.meta.dirname, '..', '..');

function load(...parts: string[]): string {
  const raw = readFileSync(join(root, ...parts), 'utf8');
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** The text from `start` (the index of an opening bracket) to its matching close, brackets inclusive. */
function balanced(src: string, start: number): string {
  const open = src[start];
  const close = open === '(' ? ')' : open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === open) depth += 1;
    else if (src[i] === close) {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`no closing ${close} after index ${start}`);
}

/** The argument list of the first call of `name(` in `src`. */
function callArgs(src: string, name: string): string {
  const at = src.indexOf(`${name}(`);
  assert.ok(at >= 0, `${name}( is not called`);
  return balanced(src, at + name.length);
}

const register = load('app', '(auth)', 'register.tsx');

describe('register.tsx: the sign-up plan', () => {
  it('the source is the real file', () => {
    assert.ok(register.includes('RegisterScreen') && register.includes('loginWithGoogle('), 'register.tsx did not load as expected');
  });

  it('decides what to ask through signupPlan, with the config and its loading state, not needsAgeConfirmation', () => {
    const args = callArgs(register, 'signupPlan');
    assert.ok(args.includes('guardian.enabled') && args.includes('guardian.loading'), `signupPlan( gets ${args}`);
    assert.ok(!register.includes('needsAgeConfirmation('), 'register.tsx calls needsAgeConfirmation( directly: the switch would be ignored');
  });

  it('sends parentEmail in the register payload', () => {
    const payload = callArgs(register, 'register');
    assert.match(payload, /parentEmail:\s*askParent\s*\?\s*parentEmail\.trim\(\)\s*:\s*undefined/);
  });

  it('sends parentEmail in the Google options', () => {
    const payload = callArgs(register, 'loginWithGoogle');
    assert.match(payload, /parentEmail:\s*askParent\s*\?\s*parentEmail\.trim\(\)\s*:\s*undefined/);
  });

  it('the Google handler refuses a missing parent email before it uses the credential', () => {
    const handler = register.slice(register.indexOf('const handleGoogleCredential'));
    const check = handler.indexOf('askParent && !parentOk');
    const use = handler.indexOf('loginWithGoogle(');
    assert.ok(check >= 0, 'the Google handler does not check the parent email');
    assert.ok(use >= 0 && check < use, 'the parent-email check must come BEFORE loginWithGoogle(');
    assert.ok(handler.slice(0, use).includes('askAge && !ageConfirmed'), 'the age check must also stay before loginWithGoogle(');
  });

  it('a stale config is dropped and re-read on a refusal', () => {
    assert.ok(register.includes('guardianConfigStale(') && register.includes('resetGuardianConfigCache()') && register.includes('guardian.refresh()'));
  });

  it('holds the submit until the config is read, and for a parent email that does not look like one', () => {
    assert.match(register, /const readyToSignUp = termsAccepted && \(!askAge \|\| ageConfirmed\) && parentOk && !waitingForConfig;/);
  });

  it('has exactly two CheckRows: the terms row, and the age tick that only shows under askAge', () => {
    assert.equal((register.match(/<CheckRow\b/g) ?? []).length, 2);
    // Teacher, parent and the code form must keep their single checkbox: the e2e test clicks the only one.
    assert.match(register, /\{askAge \? \(\s*<CheckRow\b/);
    const terms = register.indexOf('<CheckRow checked={termsAccepted}');
    const age = register.indexOf('<CheckRow checked={ageConfirmed}');
    assert.ok(terms >= 0 && age > terms, 'the terms row comes first and the age row after it');
  });

  it('shows the parent-email field only under askParent, in the email form, above the agreements', () => {
    const field = register.indexOf('{askParent ? (');
    assert.ok(field >= 0, 'no askParent-guarded field');
    const block = balanced(register, register.indexOf('(', field));
    assert.ok(block.includes('registerParentEmailLabel') && block.includes('keyboardType="email-address"'), 'the guarded block is not the parent email input');
    assert.ok(block.includes('autoComplete="off"') && !block.includes('textContentType="emailAddress"'), 'must not invite autofill of the student\'s own address');
    assert.ok(field < register.indexOf('{agreements}', field - 1), 'the field must sit above {agreements} in the email form');
    // The field is not inside `agreements`, which the code-signup form also renders.
    const agreementsDef = register.indexOf('const agreements = (');
    assert.ok(!balanced(register, register.indexOf('(', agreementsDef)).includes('registerParentEmailLabel'));
  });
});

describe('the role-switch screens pass the parent-approval switch to switchNeedsAgeConfirmation', () => {
  for (const file of ['claim-required.tsx', 'settings.tsx']) {
    it(`${file}: reads the config, passes guardian.enabled, and shows the tick only under askAge`, () => {
      const src = load('app', file);
      assert.match(src, /import \{[^}]*\buseGuardianConfig\b[^}]*\} from '@\/services\/guardianConfig'/);
      assert.match(src, /const guardian = useGuardianConfig\(\)/);
      const args = callArgs(src, 'switchNeedsAgeConfirmation');
      assert.ok(/,\s*guardian\.enabled\s*\)$/.test(args), `${file}: switchNeedsAgeConfirmation${args}`);
      assert.match(src, /\{askAge \? \(\s*<View[^>]*>\s*<CheckRow\b/);
      assert.equal((src.match(/<CheckRow\b/g) ?? []).length, 1);
      assert.ok(src.includes("t('guardianSwitchNote')"), `${file} does not show the parent note`);
    });
  }

  it('setup-subjects.tsx: reads the config, passes guardian.enabled, and switches at once when it is on', () => {
    const src = load('app', 'setup-subjects.tsx');
    assert.match(src, /import \{[^}]*\buseGuardianConfig\b[^}]*\} from '@\/services\/guardianConfig'/);
    assert.match(src, /const guardian = useGuardianConfig\(\)/);
    assert.match(src, /switchNeedsAgeConfirmation\([^)]*,\s*guardian\.enabled\)/);
    // The student pill: with the switch on it calls doSwitch('student') before it would open the box.
    const handleRole = src.slice(src.indexOf('const handleRole'));
    const direct = handleRole.indexOf("if (guardian.enabled)");
    const box = handleRole.indexOf('setStudentPending(true)');
    assert.ok(direct >= 0 && box > direct, 'handleRole must test guardian.enabled before it opens the box');
    assert.ok(handleRole.slice(direct, box).includes("doSwitch('student')"));
    // The tick is shown only under askAge, and the confirm button is held only by it.
    assert.match(src, /\{askAge \? \(\s*<CheckRow\b/);
    assert.equal((src.match(/<CheckRow\b/g) ?? []).length, 1);
    assert.ok(src.includes('disabled={(askAge && !ageOk) || switchingRole}'));
  });

  it('setup-subjects.tsx: a refusal for a missing tick reopens the box instead of leaving a dead end', () => {
    const src = load('app', 'setup-subjects.tsx');
    const stale = src.indexOf('guardianConfigStale(e.code)');
    assert.ok(stale >= 0);
    assert.ok(balanced(src, src.indexOf('{', stale)).includes('setStudentPending(true)'));
  });
});
