// Seeds the LOCAL demo database through the app's own API.
//
// Everything here is fictional: teacher «سلمى الخطيب», first-name-only students,
// a parent account that exists only on this machine. Nothing talks to a real
// user — the API runs against a throwaway Postgres on localhost, and there is no
// email service configured, so `email_verified` is set directly (the one step
// the app would normally do by mailing a 6-digit code).
const { execFileSync } = require('child_process');

const API = 'http://localhost:8080/api';
const PASSWORD = 'DemoReel2026!';

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  return json;
}

function sql(q) {
  return execFileSync('su', ['postgres', '-c', `psql iqraa -tA -c "${q.replace(/"/g, '\\"')}"`]).toString().trim();
}

async function account({ email, firstName, lastName, role = 'teacher' }) {
  try {
    await api('/auth/register', {
      method: 'POST',
      body: { firstName, lastName, email, password: PASSWORD, confirmPassword: PASSWORD, role, acceptedTerms: true },
    });
  } catch (e) { if (!/already|exists|409/i.test(String(e))) throw e; }
  sql(`update users set email_verified = true where email = '${email}'`);
  const login = await api('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  return { email, token: login.accessToken, id: sql(`select id from users where email = '${email}'`) };
}

const consent = token => api('/auth/roster-consent', { method: 'POST', token, body: {} });
const createClass = (token, body) => api('/classes', { method: 'POST', token, body }).then(r => r.class);
const addStudents = (token, classId, names) =>
  api(`/classes/${classId}/students`, { method: 'POST', token, body: { students: names.map(displayName => ({ displayName })) } });
const listStudents = (token, classId) => api(`/classes/${classId}`, { token });
const claimCode = (token, studentId) => api(`/students/${studentId}/claim-code`, { method: 'POST', token });
const claim = (token, code) => api('/auth/claim', { method: 'POST', token, body: { claimCode: code } });

module.exports = { api, sql, account, consent, createClass, addStudents, listStudents, claimCode, claim, PASSWORD };
