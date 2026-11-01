/**
 * Word recordings the speech check (`english-audio-check`) flagged, that a person then
 * listened to and found right. Each entry is the clip's slug and the ETag of the exact
 * file that was heard (the bucket's MD5), so re-voicing a clip makes the entry stop
 * applying and the clip is judged afresh. See «English audio check: a person listened to
 * the 24 flagged words» in docs/status-log.md.
 *
 * Add an entry only after listening to the current file; never to quiet a run.
 */
export const REVIEWED_BY_EAR: Record<string, string> = {
  'a-cold': '"966493a295b78d362781199a79fbda93"',
  'a-cough': '"3294e8b472434d9609b6233f0f058df3"',
  'aunt': '"caeb679376e6b6910a3842b051bd00ea"',
  'ball': '"75b4a5b372bb9725fabd20df0c334ac0"',
  'been': '"6706352234a1f229dc362ab8bee0e45c"',
  'boat': '"1aa2f9016947e43aa8b24c458af6074c"',
  'burned': '"e2bedafaa625b86fcef1945ffdb08093"',
  'cheap': '"e38d1f26570ddacf48e7ed4376fd481a"',
  'chill': '"c73eb620118147c5c1498d5b58e801e5"',
  'fancy': '"ef11e155ab7706c5cdbbc66385165bb0"',
  'fattening': '"6c1bf43a3975f47db18da49f0b23504e"',
  'fit': '"5be42381703a35514f9a7d6308cef43d"',
  'fix-the-gate': '"9fb3433b73cf9c8fbdb2ab25909e93e2"',
  'go-swimming': '"a13f1e4611727f1f210f125457d77532"',
  'hand': '"d702ee17ad88267084a7fa0a795fadef"',
  'honest': '"7c8a33be27e5506d0a99d4bd4b2214e9"',
  'honour': '"ef30c07889eec2f5436a4f7447f1dab1"',
  'house': '"67ba1dd08ec35ca750521d62f0019c11"',
  'look-good-in-front-of-sb': '"dff3cd24a13a2cc2e69566af92860688"',
  'narrow': '"6f50f62e851aaa8f6fa04d181f5631a8"',
  'ring': '"cceb9afd224591231e1f5d0d00a7c595"',
  'shell': '"7ad21f0af9ad809775d6006643e42256"',
  'tummy': '"e1773e0fae7b4f7c5462353240dd54f4"',
  'vain': '"48a7bab23893d10e4e3e5a57fab5f037"',
};
