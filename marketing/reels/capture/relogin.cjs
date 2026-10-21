// Non-recorded: sign the demo teacher in through the real login screen and save a fresh browser session.
// (Access tokens last 15 minutes and refresh tokens rotate, so a saved session goes stale between takes.)
const { launch, login } = require('./common.cjs');
(async () => {
  const [email, name] = process.argv.slice(2);
  const { browser, ctx, page } = await launch({ dsf: 2 });
  await login(page, { email, password: 'DemoReel2026!' });
  await ctx.storageState({ path: `state/${name}.json` });
  console.log(name, '->', page.url());
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
