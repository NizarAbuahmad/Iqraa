// Fresh fictional data for each reel's demo account. Safe to re-run: it wipes the local DB's users first.
const S = require('./seed.cjs');

(async () => {
  S.sql('truncate users cascade');
  console.log('wiped local demo users');

  // ---- Reel 2: library only needs a teacher
  const t2 = await S.account({ email: 'demo.library@example.com', firstName: 'سلمى', lastName: 'الخطيب' });
  console.log('r2 teacher', t2.id);

  // ---- Reel 3: classes. Two existing classes so the overview has cards; the third is added on camera.
  const t3 = await S.account({ email: 'demo.classes@example.com', firstName: 'سلمى', lastName: 'الخطيب' });
  await S.consent(t3.token);
  const c1 = await S.createClass(t3.token, { name: 'العاشر كيمياء ب', gradeId: 'grade-10', subjectIds: ['chemistry'] });
  await S.addStudents(t3.token, c1.id, ['ليان', 'يوسف', 'سارة', 'عمر', 'ريم', 'كريم']);
  const c2 = await S.createClass(t3.token, { name: 'العاشر رياضيات ج', gradeId: 'grade-10', subjectIds: ['mathematics'] });
  await S.addStudents(t3.token, c2.id, ['هديل', 'زيد', 'مها', 'طارق', 'دانا']);
  console.log('r3 classes', c1.id, c2.id);

  // ---- Reel 4: a science class, two linked parents, class group + direct thread
  const t4 = await S.account({ email: 'demo.messages@example.com', firstName: 'سلمى', lastName: 'الخطيب' });
  await S.consent(t4.token);
  const cls = await S.createClass(t4.token, { name: 'الثامن علوم أ', gradeId: 'grade-8', subjectIds: ['science'] });
  await S.addStudents(t4.token, cls.id, ['ليان', 'يوسف', 'سارة', 'عمر', 'ريم']);
  const detail = await S.listStudents(t4.token, cls.id);
  const studs = detail.students || detail.class?.students || [];
  console.log('r4 class', cls.id, 'students', studs.map(s => s.displayName).join(','));
  // The class group exists BEFORE parents claim, as in a real class: claiming joins the group.
  await S.api('/messaging/threads/class/' + cls.id, { token: t4.token });
  // Three students hold their own accounts — a class group is the teacher plus self-linked students.
  for (const [i, nm] of ['ليان', 'يوسف', 'سارة'].entries()) {
    const acct = await S.account({ email: `demo.student${i + 1}@example.com`, firstName: nm, lastName: 'تجريبي', role: 'student' });
    const me = studs.find(x => x.displayName === nm);
    const { claimCode } = await S.claimCode(t4.token, me.id);
    await S.claim(acct.token, claimCode);
    console.log('student', nm, 'claimed');
  }
  const parents = [
    { email: 'demo.parent.rim@example.com', firstName: 'منى', lastName: 'الحداد', child: 'ريم' },
    { email: 'demo.parent.omar@example.com', firstName: 'خالد', lastName: 'النجار', child: 'عمر' },
  ];
  for (const p of parents) {
    const acct = await S.account({ ...p, role: 'parent' });
    const child = studs.find(s => s.displayName === p.child);
    const { claimCode } = await S.claimCode(t4.token, child.id);
    const r = await S.claim(acct.token, claimCode);
    console.log('parent', p.firstName, 'claimed', p.child, JSON.stringify(r).slice(0, 120));
  }
  require('child_process').execSync('pnpm --filter @workspace/db run seed:assessment', { cwd: '/home/user/Iqraa', stdio: 'ignore' });
  console.log('assessment seed restored');
})().catch(e => { console.error(e); process.exit(1); });
