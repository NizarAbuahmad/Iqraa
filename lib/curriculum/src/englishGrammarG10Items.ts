/**
 * Grade 10 grammar: the authored Semester 1 and Semester 2 lessons whose book statement is a grammar topic (specs:
 * docs/superpowers/specs/2026-10-23-english-corner-grammar-g10-design.md for Semester 1,
 * docs/superpowers/specs/2026-10-24-english-corner-grammar-g10-s2-design.md for Semester 2). Every item is a whole sentence with its
 * correct answer and a distractor, written by us and checked by a teacher on the printed form; nothing here is pictured.
 *
 * The rule for a distractor: it is `form` (ungrammatical in standard English: the bare verb or the wrong inflection,
 * the wrong agreement, `to` or -ing after the wrong verb, a missing or doubled auxiliary, a plainly wrong article, the
 * wrong relative word, question word order inside an indirect question) or `meaning` (grammatical, but excluded by a
 * marker in the sentence itself: a habit word, or Look!, Listen!, right now, at the moment, a count, a duration
 * on a finished task, an event that cuts an action short, «by the time», a time word that fixes remember or forget, a
 * past time word, a reason or a second sentence after mustn't or don't have to, a decision made on the spot, a warning
 * or a sign of what is about to happen, a time point with «still» or an activity with no end, «by» with a count, an
 * unreal situation stated in its own sentence before the result (Imagine …, Suppose …), a self-done marker (myself,
 * with her own hands) or a sentence saying the speaker could not or did not do it, or who did (a service), a past time
 * word for an unreal past or a past regret, evidence in the sentence for must or can't).
 * Never a form that could fit, and `meaning` only in the sub-topics the test pins as `meaning`. Every sentence is nine
 * words or fewer, so Build always takes it whole. No names: a pronoun, a family word (`Mum`, `Dad`) or a Jordanian
 * place. `statement` is the book's own «I can» line for the lesson id (its `objectives[0]`, read back by a test).
 *
 * Imports only types from the engine: `englishGrammar.ts` imports `englishGrammarG10.ts`, which imports this file.
 */
import type { GrammarItem } from './englishGrammar.ts';

type Row = [text: string, answer: string, distractor: string];
const items = (topic: string, kind: GrammarItem['kind'], rows: Row[]): GrammarItem[] =>
  rows.map(([text, answer, distractor]) => ({ topic, kind, text, answer, distractor }));

const L = (s: string) => `kbl-eng-s1-nccd-${s}`;
const L2 = (s: string) => `kbl-eng-s2-nccd-${s}`;

export const G10_ITEM_LESSONS: { lessonId: string; statement: string; items: GrammarItem[] }[] = [
  {
    lessonId: L('u1_l1'),
    statement: 'I can use Present Simple and Present Continuous to talk about habits and temporary situations.',
    items: [
      // A habit word (every day, usually, often, rarely, on Fridays, five days a week, once a month) rules out the
      // continuous. An adverb before the verb is inside the answer, so the twin keeps standard order («is usually
      // walking», never «usually is walking»). No «never»: «He is never wearing …» reads as a complaint, like «always».
      ...items('habit-markers', 'meaning', [
        ['She usually walks to school.', 'usually walks', 'is usually walking'],
        ['My father rarely wears a suit.', 'rarely wears', 'is rarely wearing'],
        ['We often celebrate birthdays at home.', 'often celebrate', 'are often celebrating'],
        ['He wears his uniform five days a week.', 'wears', 'is wearing'],
        ['The shop opens at eight every day.', 'opens', 'is opening'],
        ['My brother plays football on Fridays.', 'plays', 'is playing'],
        ['Mum usually cooks dinner.', 'usually cooks', 'is usually cooking'],
        ['Students rarely dress casually at our school.', 'rarely dress', 'are rarely dressing'],
        ['We wear jeans to school once a month.', 'wear', 'are wearing'],
        ['She checks her email every day.', 'checks', 'is checking'],
        ['We visit our grandparents on Fridays.', 'visit', 'are visiting'],
        ['Dad often reads the newspaper in the morning.', 'often reads', 'is often reading'],
      ]),
      // Only now, right now, at the moment, Look! and Listen! (never «this week» or «always»: both forms fit those).
      ...items('temporary-markers', 'meaning', [
        ['Look! The baby is smiling.', 'is smiling', 'smiles'],
        ['Listen! Someone is singing next door.', 'is singing', 'sings'],
        ['We are having lunch right now.', 'are having', 'have'],
        ['Dad is cooking dinner at the moment.', 'is cooking', 'cooks'],
        ['Look! It is raining.', 'is raining', 'rains'],
        ['Listen! The teacher is calling your name.', 'is calling', 'calls'],
        ['I am talking on the phone right now.', 'am talking', 'talk'],
        ['They are watching the match at the moment.', 'are watching', 'watch'],
        ['Look! Your brother is wearing a suit.', 'is wearing', 'wears'],
        ['Right now, the students are taking an exam.', 'are taking', 'take'],
        ['Listen! The phone is ringing.', 'is ringing', 'rings'],
        ['Look! The school-leavers are celebrating.', 'are celebrating', 'celebrate'],
      ]),
      ...items('stative', 'form', [
        ['I know the answer to this question.', 'know', 'am knowing'],
        ['She understands the rules of the game.', 'understands', 'is understanding'],
        ['This uniform belongs to my brother.', 'belongs', 'is belonging'],
        ['He owns three suits.', 'owns', 'is owning'],
        ['I prefer tea to coffee.', 'prefer', 'am preferring'],
        ['This box contains old photos.', 'contains', 'is containing'],
        ['We believe his story.', 'believe', 'are believing'],
        ['Your results seem very good.', 'seem', 'are seeming'],
      ]),
      ...items('questions', 'form', [
        ['Does he play tennis on Fridays?', 'play', 'plays'],
        ['Are you wearing your uniform today?', 'Are', 'Do'],
        ['What are you doing right now?', 'are', 'do'],
        ['Does your school have a uniform?', 'have', 'has'],
        ['Where does your father work?', 'does', 'do'],
        ['Is he listening to music now?', 'listening', 'listen'],
        ['Do they often dress casually?', 'Do', 'Does'],
        ['How often does she check her email?', 'check', 'checks'],
      ]),
    ],
  },
  {
    lessonId: L('u1_l5'),
    statement: 'I can use articles to talk about general and specific things.',
    items: [
      // a or an by the first sound: «a uniform», «a university» (a y sound), «an hour» (a silent h).
      ...items('a-an', 'form', [
        ['She has an umbrella.', 'an', 'a'],
        ['I eat an apple every day.', 'an', 'a'],
        ['He is an engineer.', 'an', 'a'],
        ['It was an easy test.', 'an', 'a'],
        ['She wears a uniform to school.', 'a', 'an'],
        ['We waited for an hour.', 'an', 'a'],
        ['My brother studies at a university.', 'a', 'an'],
        ['He told me an interesting story.', 'an', 'a'],
      ]),
      // The second mention of the same thing takes «the»; «a» would make it another one.
      ...items('already-mentioned', 'meaning', [
        ['I saw a cat. The cat was black.', 'The', 'A'],
        ['I bought a shirt, but the shirt was small.', 'the', 'a'],
        ['She had a dog. The dog was very friendly.', 'The', 'A'],
        ['We stayed in a hotel. The hotel was lovely.', 'The', 'A'],
        ['He gave me a book. The book was boring.', 'The', 'A'],
        ['I ordered a pizza, and the pizza was cold.', 'the', 'a'],
        ['They watched a film. The film was very long.', 'The', 'A'],
        ['My uncle has a car. The car is red.', 'The', 'A'],
        ['I found a key. Is the key yours?', 'the', 'a'],
        ['She wrote a poem. The poem won a prize.', 'The', 'A'],
        ['We bought a cake, but the cake was dry.', 'the', 'a'],
        ['A man knocked. The man wanted directions.', 'The', 'A'],
      ]),
      ...items('unique-things', 'form', [
        ['The sun rises in the east.', 'The', 'A'],
        ['The moon goes round the Earth.', 'The', 'A'],
        ['There are no clouds in the sky.', 'the', 'a'],
        ['The internet is very useful.', 'The', 'An'],
        ['He wants to travel around the world.', 'the', 'a'],
        ['Never look directly at the sun.', 'the', 'a'],
        ['The Earth is our home.', 'The', 'An'],
        ['We watched the moon last night.', 'the', 'a'],
        ['The sky is very blue today.', 'The', 'A'],
        ['The world is getting warmer.', 'The', 'A'],
      ]),
      // No article with a sport, a meal after «have», a language, a school subject, a city, «at night», «on foot».
      ...items('no-article', 'form', [
        ['My brother plays football after school.', 'football', 'the football'],
        ['We have breakfast at seven.', 'breakfast', 'the breakfast'],
        ['She speaks Arabic and English.', 'Arabic', 'the Arabic'],
        ['I study maths and science.', 'maths', 'the maths'],
        ['They live in Amman.', 'Amman', 'the Amman'],
        ['My cousin is learning French.', 'French', 'the French'],
        ['History is my favourite subject.', 'History', 'The history'],
        ['We visited Petra last year.', 'Petra', 'the Petra'],
        ['Owls hunt at night.', 'night', 'the night'],
        ['I go to school on foot.', 'foot', 'the foot'],
      ]),
    ],
  },
  {
    lessonId: L('u2_l1'),
    statement: 'I can distinguish between the Present Perfect Simple and the Present Perfect Continuous to talk about recent finished or unfinished activities.',
    items: [
      // A count or «how many» of finished things takes the simple.
      ...items('result-count', 'meaning', [
        ['I have written five emails today.', 'have written', 'have been writing'],
        ['She has read three books this month.', 'has read', 'has been reading'],
        ['How many pages have you read?', 'read', 'been reading'],
        ['They have launched two spaceships this year.', 'have launched', 'have been launching'],
        ['We have visited four countries so far.', 'have visited', 'have been visiting'],
        ['He has drunk three glasses of water.', 'has drunk', 'has been drinking'],
        ['I have eaten two sandwiches already.', 'have eaten', 'have been eating'],
        ['How many photos have you taken?', 'taken', 'been taking'],
        ['The scientists have found six new planets.', 'have found', 'have been finding'],
        ['She has painted three pictures this week.', 'has painted', 'has been painting'],
        ['Dad has washed the car twice today.', 'has washed', 'has been washing'],
        ['We have watched two films tonight.', 'have watched', 'have been watching'],
        ['He has scored three goals this season.', 'has scored', 'has been scoring'],
        ['I have called her four times.', 'have called', 'have been calling'],
      ]),
      // A duration (for, since, all morning, how long) on one task with an end («her essay», «this book»): the simple
      // would say the task is finished, which the duration contradicts. Verbs that take either form with a duration
      // (live, work, study, wait, rain) are left out.
      ...items('duration', 'meaning', [
        ['She has been writing her essay since seven.', 'has been writing', 'has written'],
        ['I have been reading this book for a week.', 'have been reading', 'have read'],
        ['They have been building the spaceship for years.', 'have been building', 'have built'],
        ['She has been writing this letter all morning.', 'has been writing', 'has written'],
        ['How long have you been doing your homework?', 'been doing', 'done'],
        ['Dad has been repairing the car since lunch.', 'has been repairing', 'has repaired'],
        ['He has been painting the kitchen for three hours.', 'has been painting', 'has painted'],
        ['I have been fixing my bike all afternoon.', 'have been fixing', 'have fixed'],
        ['How long has she been making that cake?', 'been making', 'made'],
        ['Mum has been cooking dinner since five.', 'has been cooking', 'has cooked'],
        ['He has been learning the poem since breakfast.', 'has been learning', 'has learned'],
        ['I have been drawing this map for two hours.', 'have been drawing', 'have drawn'],
        ['She has been packing her bag for an hour.', 'has been packing', 'has packed'],
        ['How long have you been tidying your room?', 'been tidying', 'tidied'],
      ]),
      // A bare verb or the wrong agreement, never a past simple.
      ...items('forms', 'form', [
        ['He has been waiting for an hour.', 'waiting', 'wait'],
        ['She has been working since eight.', 'working', 'work'],
        ['I have been studying all evening.', 'have', 'has'],
        ['They have finished their project.', 'finished', 'finish'],
        ['Has she been crying?', 'Has', 'Have'],
        ['We have been swimming for an hour.', 'swimming', 'swim'],
        ['My sister has written three letters.', 'written', 'write'],
        ["He hasn't been sleeping well.", 'sleeping', 'sleep'],
        ['Have you seen my keys?', 'seen', 'see'],
        ['It has been raining all day.', 'has', 'have'],
        ['The spaceship has landed on the moon.', 'landed', 'land'],
        ['They have been talking for ages.', 'talking', 'talk'],
      ]),
    ],
  },
  {
    lessonId: L('u2_l4'),
    statement: 'I can use a range of verbs taking the infinitive or the -ing form.',
    items: [
      // Verbs that take -ing only.
      ...items('ing', 'form', [
        ['She enjoys reading detective stories.', 'reading', 'to read'],
        ['He finished writing his report.', 'writing', 'to write'],
        ['Would you mind opening the window?', 'opening', 'to open'],
        ['They avoid flying at night.', 'flying', 'to fly'],
        ['I keep forgetting his name.', 'forgetting', 'to forget'],
        ['We practise speaking English every day.', 'speaking', 'to speak'],
        ['She suggested meeting at the library.', 'meeting', 'to meet'],
        ['The company is considering using drones for delivery.', 'using', 'to use'],
        ['I miss playing football with my cousins.', 'playing', 'to play'],
        ['He gave up eating sweets.', 'eating', 'to eat'],
        ['Imagine flying above the clouds!', 'flying', 'to fly'],
        ['They risked losing everything.', 'losing', 'to lose'],
        ['She denied breaking the window.', 'breaking', 'to break'],
        ['Do you fancy watching a film?', 'watching', 'to watch'],
      ]),
      // Verbs that take to only.
      ...items('to', 'form', [
        ['I want to learn French.', 'to learn', 'learning'],
        ['She decided to buy a drone.', 'to buy', 'buying'],
        ['We hope to visit Petra next year.', 'to visit', 'visiting'],
        ['They agreed to help us.', 'to help', 'helping'],
        ['He refused to answer the question.', 'to answer', 'answering'],
        ['I promise to call you tonight.', 'to call', 'calling'],
        ['He seems to know the answer.', 'to know', 'knowing'],
        ['Did you manage to finish the project?', 'to finish', 'finishing'],
        ['My uncle offered to drive us home.', 'to drive', 'driving'],
        ["We can't afford to buy a new car.", 'to buy', 'buying'],
        ['They plan to use drones for weather forecasting.', 'to use', 'using'],
        ['I would like to try aerial photography.', 'to try', 'trying'],
        ['He pretended to be asleep.', 'to be', 'being'],
        ['The drone failed to take off.', 'to take', 'taking'],
      ]),
      // stop, remember, forget: both forms are English, and the rest of the sentence picks one. «stopped to cry» or
      // «stopped to rain» makes no sense; «on the way home» is a pause, not giving up; a past time is a memory
      // (remember doing), a future time a task (remember to do); «so we have none» says it was not bought.
      ...items('change-of-meaning', 'meaning', [
        ['The baby finally stopped crying.', 'crying', 'to cry'],
        ["It stopped raining at six o'clock.", 'raining', 'to rain'],
        ['Please stop making that noise.', 'making', 'to make'],
        ['The phone stopped ringing.', 'ringing', 'to ring'],
        ['On the way home, we stopped to buy bread.', 'to buy', 'buying'],
        ['Stop talking! The exam has started.', 'talking', 'to talk'],
        ['I remember meeting your father last year.', 'meeting', 'to meet'],
        ['Remember to lock the door tonight.', 'to lock', 'locking'],
        ['Please remember to bring your camera tomorrow.', 'to bring', 'bringing'],
        ['I remember visiting Petra when I was seven.', 'visiting', 'to visit'],
        ["Don't forget to call your uncle tomorrow.", 'to call', 'calling'],
        ['I forgot to buy milk, so we have none.', 'to buy', 'buying'],
      ]),
    ],
  },
  {
    lessonId: L('u3_l1'),
    statement: 'I can use the Past Simple, Past Continuous and Past Perfect to talk about past actions.',
    items: [
      // A longer action cut short by an event inside it: «He ran when he fell» or «he was breaking his leg» makes no
      // sense. «While» alone never decides here, because «While we ate, …» is English too.
      ...items('interrupted', 'meaning', [
        ['He was running when he fell.', 'was running', 'ran'],
        ['I was sleeping when the alarm went off.', 'was sleeping', 'slept'],
        ['Dad was driving when the car broke down.', 'was driving', 'drove'],
        ['I was taking a shower when the water stopped.', 'was taking', 'took'],
        ['He was carrying the box when he dropped it.', 'was carrying', 'carried'],
        ['I was reading in bed when I fell asleep.', 'was reading', 'read'],
        ['She was cooking when she burnt her hand.', 'was cooking', 'cooked'],
        ['I was typing when the computer crashed.', 'was typing', 'typed'],
        ['The athlete was training when he injured his knee.', 'was training', 'trained'],
        ['While he was skiing, he broke his leg.', 'broke', 'was breaking'],
        ['While I was running, I dropped my phone.', 'dropped', 'was dropping'],
        ['While I was walking home, I found a key.', 'found', 'was finding'],
        ['While they were playing, the ball broke a window.', 'broke', 'was breaking'],
        ['While she was swimming, she lost her ring.', 'lost', 'was losing'],
      ]),
      // «By the time» needs the past perfect in the other clause. «before» and «already» are left out: the past simple
      // fits after them too.
      ...items('earlier-event', 'meaning', [
        ['By the time we arrived, the film had started.', 'had started', 'started'],
        ['By the time Dad woke up, we had left.', 'had left', 'left'],
        ['By the time she called, I had finished.', 'had finished', 'finished'],
        ['By the time I woke, the sun had risen.', 'had risen', 'rose'],
        ['By the time Mum arrived, the shop had closed.', 'had closed', 'closed'],
        ['By the time I got there, they had eaten.', 'had eaten', 'ate'],
        ['By the time he called, I had gone out.', 'had gone out', 'went out'],
        ['By the time I arrived, the meeting had ended.', 'had ended', 'ended'],
        ['By the time I finished, everyone had gone home.', 'had gone home', 'went home'],
        ['By the time he arrived, the race had begun.', 'had begun', 'began'],
        ['By the time we returned, the cake had disappeared.', 'had disappeared', 'disappeared'],
        ['By the time I arrived, the bus had left.', 'had left', 'left'],
        ['By the time I returned, Dad had fallen asleep.', 'had fallen', 'fell'],
        ['By the time she arrived, I had cleaned up.', 'had cleaned', 'cleaned'],
      ]),
      ...items('forms', 'form', [
        ['She had already left the house.', 'left', 'leave'],
        ['They were playing tennis at five.', 'were', 'was'],
        ['I was watching TV when you called.', 'watching', 'watch'],
        ['We had never seen snow before.', 'seen', 'see'],
        ["He didn't finish the race.", 'finish', 'finished'],
        ['Did you see the match yesterday?', 'see', 'saw'],
        ['The athletes were training all morning.', 'were', 'was'],
        ['She had gone home before we arrived.', 'gone', 'went'],
        ['He injured his knee last week.', 'injured', 'injure'],
        ['Where were you going when I saw you?', 'were', 'was'],
        ['She succeeded because she had trained hard.', 'trained', 'train'],
        ["What were you doing at eight o'clock?", 'doing', 'do'],
      ]),
    ],
  },
  {
    lessonId: L('u3_l4'),
    statement: 'I can use used to and would to talk about past habits and routines.',
    items: [
      // A state verb (have, be, live, know, like, love, own, hate, believe) in the past takes used to, never would. Each
      // sentence carries a past time word («As a child», «Years ago», «when I was ten»), so the twin cannot be read as
      // a conditional («I would have a dog [if …]»).
      ...items('used-to-states', 'meaning', [
        ['As a child, I used to have a dog.', 'used to', 'would'],
        ['As children, we used to live in Irbid.', 'used to', 'would'],
        ['Years ago, this shop used to be a bakery.', 'used to', 'would'],
        ['As a child, he used to love sweets.', 'used to', 'would'],
        ['When I was ten, I used to like football.', 'used to', 'would'],
        ['My grandmother used to own free-range chickens years ago.', 'used to', 'would'],
        ['In the past, this street used to be quiet.', 'used to', 'would'],
        ['When she was young, she used to hate vegetables.', 'used to', 'would'],
        ['As a boy, Dad used to be very shy.', 'used to', 'would'],
        ['Before we moved, we used to have a garden.', 'used to', 'would'],
        ['Years ago, my hair used to be long.', 'used to', 'would'],
        ['As a boy, I used to fear the dark.', 'used to', 'would'],
        ['Long ago, our town used to have one school.', 'used to', 'would'],
        ['At primary school, I used to love maths.', 'used to', 'would'],
      ]),
      // A repeated action in the past takes would. used to and the past simple fit too, so neither is offered; the
      // distractor is will, which the past time word in every sentence («As children», «In those days», «Last summer»)
      // rules out. «every summer» alone would not: «Every summer we will swim here» is English.
      ...items('would-habits', 'meaning', [
        ['As children, we would swim here every summer.', 'would', 'will'],
        ['When I was young, Dad would read me stories.', 'would', 'will'],
        ['In those days, we would walk to school.', 'would', 'will'],
        ['Years ago, my grandmother would bake wholemeal bread.', 'would', 'will'],
        ['As a boy, Dad would play football every evening.', 'would', 'will'],
        ['Back then, we would buy locally grown vegetables.', 'would', 'will'],
        ['As kids, we would visit Aqaba every summer.', 'would', 'will'],
        ['When I was little, Mum would sing to me.', 'would', 'will'],
        ['At my old school, we would sing every morning.', 'would', 'will'],
        ['When Dad was a student, he would study late.', 'would', 'will'],
        ['In the old days, people would cook on fires.', 'would', 'will'],
        ['Last summer, we would go fishing every morning.', 'would', 'will'],
      ]),
      // used to and would take the bare verb; did … use to (not used to) in questions and negatives.
      ...items('forms', 'form', [
        ["She didn't use to like fish.", 'use', 'used'],
        ["We didn't use to eat organic food.", 'use', 'used'],
        ['I used to play football every day.', 'play', 'playing'],
        ['He used to have long hair.', 'have', 'had'],
        ['We used to live near the sea.', 'used', 'use'],
        ['Did your father use to work here?', 'work', 'worked'],
        ['Every evening, my grandfather would tell us stories.', 'tell', 'told'],
        ['We would always drink freshly-squeezed juice.', 'drink', 'drinking'],
        ['They would often swim in the river.', 'swim', 'to swim'],
        ['Mum used to make bread at home.', 'make', 'made'],
        ['There used to be a farm here.', 'be', 'been'],
        ['He used to eat only locally grown fruit.', 'eat', 'eats'],
        ['Did they use to grow vegetables?', 'grow', 'grew'],
        ['Every summer, we would visit our grandparents.', 'visit', 'visiting'],
      ]),
    ],
  },
  {
    lessonId: L('u3_l5'),
    statement: 'I can use indirect questions to make polite requests or to ask for opinions and information.',
    items: [
      // After «Could you tell me», statement order: no inversion and no do. No subject question («who made it»), whose
      // order is the same either way, and no «what» + be + a noun («what the problem is»), where many speakers accept both.
      ...items('could-you-tell', 'form', [
        ['Could you tell me where it is?', 'where it is', 'where is it'],
        ['Could you tell me what time it is?', 'it is', 'is it'],
        ['Could you tell me where the station is?', 'the station is', 'is the station'],
        ['Could you tell me how much this costs?', 'this costs', 'does this cost'],
        ['Could you tell me when the shop opens?', 'the shop opens', 'does the shop open'],
        ['Could you tell me what this word means?', 'this word means', 'does this word mean'],
        ['Could you tell me where the herbs are?', 'the herbs are', 'are the herbs'],
        ['Could you tell me how you cook this?', 'you cook', 'do you cook'],
        ['Could you tell me why the bus is late?', 'the bus is', 'is the bus'],
        ['Could you tell me how fermented food is made?', 'fermented food is', 'is fermented food'],
        ['Could you tell me where I can buy wheat?', 'I can buy', 'can I buy'],
        ['Could you tell me how long the film lasts?', 'the film lasts', 'does the film last'],
        ['Could you tell me how old this building is?', 'this building is', 'is this building'],
        ['Could you tell me what you think?', 'you think', 'do you think'],
      ]),
      // The same after «Do you know» and «Do you have any idea».
      ...items('do-you-know', 'form', [
        ['Do you know where the museum is?', 'the museum is', 'is the museum'],
        ['Do you know what time the bank closes?', 'the bank closes', 'does the bank close'],
        ['Do you know how much wheat costs?', 'wheat costs', 'does wheat cost'],
        ['Do you know why she is upset?', 'she is', 'is she'],
        ['Do you know where they live?', 'they live', 'do they live'],
        ['Do you know what nutrition means?', 'nutrition means', 'does nutrition mean'],
        ['Do you know when the next bus comes?', 'the next bus comes', 'does the next bus come'],
        ['Do you know where I can find fresh produce?', 'I can find', 'can I find'],
        ['Do you know what he wants for lunch?', 'he wants', 'does he want'],
        ['Do you know how long the journey takes?', 'the journey takes', 'does the journey take'],
        ['Do you have any idea where my keys are?', 'my keys are', 'are my keys'],
        ['Do you know what processed food contains?', 'processed food contains', 'does processed food contain'],
        ['Do you know how this machine works?', 'this machine works', 'does this machine work'],
        ['Do you know where the nearest pharmacy is?', 'the nearest pharmacy is', 'is the nearest pharmacy'],
      ]),
      // A yes or no question becomes if or whether + statement order.
      ...items('if-whether', 'form', [
        ['Do you know if he is here?', 'if he is', 'if is he'],
        ['Could you tell me if the shop is open?', 'if the shop is', 'if is the shop'],
        ['I wonder whether it will rain tomorrow.', 'whether it will', 'whether will it'],
        ['Do you know if this bread contains gluten?', 'if this bread contains', 'if does this bread contain'],
        ['Could you tell me whether the train is late?', 'whether the train is', 'whether is the train'],
        ["I'd like to know if you eat meat.", 'if you eat', 'if do you eat'],
        ['Can you tell me whether they are coming?', 'whether they are', 'whether are they'],
        ['Do you know whether the museum opens today?', 'whether the museum opens', 'whether does the museum open'],
        ['I wonder if she likes fermented food.', 'if she likes', 'if does she like'],
        ['Could you tell me if this is organic?', 'if this is', 'if is this'],
        ['Do you know if they have wholemeal bread?', 'if they have', 'if do they have'],
        ["I'm not sure whether he can come.", 'whether he can', 'whether can he'],
      ]),
    ],
  },
  {
    lessonId: L('u4_l1'),
    statement: 'I can use a variety of modal and related verbs.',
    items: [
      // mustn't (it is forbidden) or don't have to (it is not necessary), fixed by the second sentence or clause: a
      // danger or a rule («It's dangerous», «It's not allowed») on something nobody is ever required to do (touch live
      // wires, cheat) makes it a ban; «It's free», «optional», «isn't required», «isn't compulsory» or «but you can» makes it unnecessary.
      // No place or action that could merely be optional («swim here. It's dangerous» reads either way), and no reason
      // that could also be advice («I can hear you»).
      ...items('obligation', 'meaning', [
        ["You mustn't leave bags unattended. Security will remove them.", "mustn't", "don't have to"],
        ["Passengers mustn't smoke on the plane. It's forbidden.", "mustn't", "don't have to"],
        ["You mustn't cheat in exams. It's against the rules.", "mustn't", "don't have to"],
        ["You mustn't touch the wires. They're live.", "mustn't", "don't have to"],
        ["You mustn't drive without a licence. It's illegal.", "mustn't", "don't have to"],
        ["You mustn't play with fire. It's dangerous.", "mustn't", "don't have to"],
        ["Visitors mustn't feed the animals. It's not allowed.", "mustn't", "don't have to"],
        ["You don't have to pay. It's free.", "don't have to", "mustn't"],
        ["You don't have to come, but you can.", "don't have to", "mustn't"],
        ["The trip is optional. You don't have to go.", "don't have to", "mustn't"],
        ["You don't have to stay, but you're welcome to.", "don't have to", "mustn't"],
        ["The museum is free. Visitors don't have to pay.", "don't have to", "mustn't"],
        ["Ties aren't required. You don't have to wear one.", "don't have to", "mustn't"],
        ["Sport isn't compulsory. You don't have to play.", "don't have to", "mustn't"],
      ]),
      // A past time word («when he was five», «Last night») takes could or was able to, a future one («Next year»,
      // «Tomorrow») will be able to; the distractor is the present (can, am able to) or the other tense. could and was
      // able to are never set against each other: both fit too often. No «As a child, I …» here: «As a child, I can't
      // vote» is present.
      ...items('ability-permission', 'meaning', [
        ['He could swim when he was five.', 'could', 'can'],
        ["When I was little, I couldn't stay up late.", "couldn't", "can't"],
        ['Yesterday, I was able to finish early.', 'was able to', 'am able to'],
        ['Next year, she will be able to drive.', 'will be able to', 'was able to'],
        ['Last year, we could wear jeans on Fridays.', 'could', 'can'],
        ["When I was ten, I couldn't ride a bike.", "couldn't", "can't"],
        ["Last night, we weren't able to book a flight.", "weren't able to", "aren't able to"],
        ['Years ago, my grandfather could run very fast.', 'could', 'can'],
        ["Ten years ago, we couldn't buy tickets online.", "couldn't", "can't"],
        ['Tomorrow, we will be able to visit Petra.', 'will be able to', 'were able to'],
        ["Last week, I couldn't find my passport.", "couldn't", "can't"],
        ['When we were young, we could play outside.', 'could', 'can'],
        ["Two days ago, he wasn't able to walk.", "wasn't able to", "isn't able to"],
        ["Last month, she couldn't see clearly.", "couldn't", "can't"],
      ]),
      // A modal takes the bare verb (no to, -ing, -s or past); have to agrees with its subject; ought to is not used here.
      ...items('forms', 'form', [
        ['You must wear a helmet.', 'wear', 'to wear'],
        ['You must fasten your seatbelt.', 'fasten', 'fastens'],
        ['She can speak three languages.', 'speak', 'speaks'],
        ['He has to work at weekends.', 'has', 'have'],
        ['Does she have to wear a uniform?', 'have', 'has'],
        ['Passengers must switch phones to flight mode.', 'switch', 'switching'],
        ["We don't have to book a flight.", "don't", "doesn't"],
        ['They might come later.', 'come', 'coming'],
        ['Bags must go in the overhead locker.', 'go', 'to go'],
        ['Could you help me, please?', 'help', 'to help'],
        ['I had to wait for an hour.', 'wait', 'waited'],
        ["He wasn't able to come yesterday.", 'come', 'came'],
      ]),
    ],
  },
  {
    lessonId: L('u4_l4'),
    statement: 'I can use defining and non-defining relative clauses.',
    items: [
      // A person takes who or that, never which; a thing takes which or that, never who (no animals: a pet can be who).
      ...items('defining', 'form', [
        ['The girl who sits here is my cousin.', 'who', 'which'],
        ['The cyclist who won the race is my brother.', 'who', 'which'],
        ['This is the car which my father bought.', 'which', 'who'],
        ['Pedestrians who cross here must be careful.', 'who', 'which'],
        ['The bus that goes to Aqaba is full.', 'that', 'who'],
        ['Fuels which pollute the air are bad for us.', 'which', 'who'],
        ['The man that fixed our car was friendly.', 'that', 'which'],
        ['I know a teacher who cycles to work.', 'who', 'which'],
        ['Cars that use diesel engines cause smog.', 'that', 'who'],
        ['The road which leads to Petra is busy.', 'which', 'who'],
        ['People who share cars help the environment.', 'who', 'which'],
        ['The pavement that runs past our school is narrow.', 'that', 'who'],
      ]),
      // A clause between commas never takes that.
      ...items('non-defining', 'form', [
        ['My brother, who lives in Aqaba, is a pilot.', 'who', 'that'],
        ['Petra, which is very old, attracts many tourists.', 'which', 'that'],
        ['Our car, which has a diesel engine, is old.', 'which', 'that'],
        ['My uncle, who is a cyclist, never drives.', 'who', 'that'],
        ['Smog, which is toxic, is a big problem.', 'which', 'that'],
        ['Amman, which is the capital, has heavy traffic.', 'which', 'that'],
        ['Our teacher, who walks to school, is very fit.', 'who', 'that'],
        ['The motorway, which opened last year, is very busy.', 'which', 'that'],
        ['My father, who drives every day, hates congestion.', 'who', 'that'],
        ['Carpooling, which saves money, is popular here.', 'which', 'that'],
        ['My sister, who is a doctor, cycles to work.', 'who', 'that'],
        ['Aqaba, which is on the coast, is very hot.', 'which', 'that'],
        ['Our neighbour, who owns a bike shop, is friendly.', 'who', 'that'],
        ['Exhaust fumes, which come from cars, pollute the air.', 'which', 'that'],
      ]),
      // whose for possession (who cannot stand before a noun); where for a place when the clause has no object
      // («where I grew up»: «which I grew up» lacks its «in»).
      ...items('whose-where', 'form', [
        ["That's the man whose car was stolen.", 'whose', 'who'],
        ['I have a friend whose father is a pilot.', 'whose', 'who'],
        ['The cyclist whose bike broke walked home.', 'whose', 'who'],
        ['She is the girl whose brother won.', 'whose', 'who'],
        ['We met a woman whose son drives a bus.', 'whose', 'who'],
        ['The boy whose bag I found thanked me.', 'whose', 'who'],
        ['Drivers whose cars pollute must pay more.', 'whose', 'who'],
        ['This is the house where I grew up.', 'where', 'which'],
        ['Amman is the city where I live.', 'where', 'which'],
        ['That is the street where the accident happened.', 'where', 'which'],
        ['Is this the café where you work?', 'where', 'which'],
        ['The park where children play is clean.', 'where', 'which'],
        ['Aqaba is a city where people swim all year.', 'where', 'which'],
        ['This is the road where cyclists are safe.', 'where', 'which'],
      ]),
    ],
  },
  {
    lessonId: L('u5_l1'),
    statement: 'I can use a variety of forms to talk about future events and situations.',
    items: [
      // A decision made on the spot («The phone's ringing.», «Oh, I forgot …», «OK, …») takes will. going to is not
      // offered (many speakers say «OK, I'm going to call him»); the distractor is the present simple, which cannot
      // make an offer or a decision («I answer it»).
      ...items('will-decisions', 'meaning', [
        ["The phone's ringing. I'll answer it.", "I'll answer", 'I answer'],
        ["Oh, I forgot my keys. I'll go back.", "I'll go", 'I go'],
        ["It's cold in here. I'll close the window.", "I'll close", 'I close'],
        ["OK, I'll have the chicken, please.", "I'll have", 'I have'],
        ["That bag looks heavy. I'll carry it.", "I'll carry", 'I carry'],
        ["Wait, I'll help you with that.", "I'll help", 'I help'],
        ["You look tired. I'll make you some tea.", "I'll make", 'I make'],
        ["I forgot to call Mum! I'll do it now.", "I'll do", 'I do'],
        ["We've got no milk. I'll buy some.", "I'll buy", 'I buy'],
        ["Sorry, I don't understand this. I'll ask the teacher.", "I'll ask", 'I ask'],
      ]),
      // A sign of what is about to happen (dark clouds, «Watch out!», «Careful!») takes going to. will is not offered
      // («Look at those clouds, it'll rain» is English too); the distractor is the present simple, and the warning says
      // the event has not happened, so it cannot be a commentary («Look! He scores!»).
      ...items('going-to-evidence', 'meaning', [
        ["Look at those clouds! It's going to rain.", "It's going to rain", 'It rains'],
        ['Watch out! That glass is going to fall.', 'is going to fall', 'falls'],
        ["Be careful! You're going to drop it.", "You're going to drop", 'You drop'],
        ["Hurry! We're going to miss the bus.", "We're going to miss", 'We miss'],
        ['Watch out! The ball is going to hit you.', 'is going to hit', 'hits'],
        ["Look at the sky! It's going to snow.", "It's going to snow", 'It snows'],
        ["Mind the step! You're going to trip.", "You're going to trip", 'You trip'],
        ['Stop! The milk is going to boil over.', 'is going to boil', 'boils'],
        ["Careful! You're going to spill your tea.", "You're going to spill", 'You spill'],
        ['Look out! That ladder is going to fall.', 'is going to fall', 'falls'],
      ]),
      // A timetable (present simple) or an arrangement (present continuous). Form only: with a fixed time, will, going
      // to and both presents all fit («The train will leave at nine tomorrow» is English), so the errors are in the form.
      ...items('arrangements-timetables', 'form', [
        ['The train leaves at nine tomorrow.', 'leaves', 'leave'],
        ["I'm meeting my cousin tonight.", 'meeting', 'meet'],
        ['We are flying to Aqaba on Friday.', 'flying', 'fly'],
        ['The film starts at eight.', 'starts', 'start'],
        ['What time does the bus leave?', 'leave', 'leaves'],
        ['She is starting her new job on Monday.', 'is', 'are'],
        ['Are you coming to the party tonight?', 'coming', 'come'],
        ['The museum opens at nine tomorrow.', 'opens', 'open'],
        ['My exams begin next week.', 'begin', 'begins'],
        ['They are having a party on Saturday.', 'having', 'have'],
        ['When does the term start?', 'start', 'starts'],
        ["I'm seeing the dentist at four.", 'seeing', 'see'],
      ]),
      ...items('forms', 'form', [
        ["I'm going to study medicine.", 'study', 'studying'],
        ['She will be a responsible leader one day.', 'be', 'is'],
        ['They are going to visit Petra.', 'are', 'is'],
        ['Will you help me tomorrow?', 'help', 'helps'],
        ['My sister is going to be a doctor.', 'be', 'to be'],
        ['I think you will win the competition.', 'win', 'to win'],
        ["We aren't going to give up.", 'give', 'giving'],
        ['Are you going to apply for the job?', 'Are', 'Is'],
      ]),
    ],
  },
  {
    lessonId: L('u5_l3'),
    statement: 'I can use the Future Continuous and the Future Perfect to talk about future events and situations.',
    items: [
      // A time point («At this time tomorrow», «At midnight») with an activity that has no end (sleep, relax, wait,
      // work), or with «still»: the perfect («will have slept», «will still have studied») makes no sense. No activity
      // that ends (watch the match, have dinner), which the perfect fits.
      ...items('continuous', 'meaning', [
        ['At this time tomorrow, I will still be sleeping.', 'be sleeping', 'have slept'],
        ['This time next week, I will be relaxing.', 'will be relaxing', 'will have relaxed'],
        ['At midnight, I will still be studying.', 'be studying', 'have studied'],
        ['At ten tonight, she will still be working.', 'be working', 'have worked'],
        ['At noon, I will be waiting at the airport.', 'will be waiting', 'will have waited'],
        ['This time next year, he will still be training.', 'be training', 'have trained'],
        ['At six tomorrow, Dad will still be driving.', 'be driving', 'have driven'],
        ['At this time tomorrow, they will still be travelling.', 'be travelling', 'have travelled'],
        ["Don't call me at nine. I will be swimming.", 'will be swimming', 'will have swum'],
        ['This time on Friday, we will be camping.', 'will be camping', 'will have camped'],
        ['At six, the children will still be playing outside.', 'be playing', 'have played'],
        ['At four, I will be resting at home.', 'will be resting', 'will have rested'],
        ['When you arrive, we will still be eating.', 'be eating', 'have eaten'],
        ['Next month, I will still be working freelance.', 'be working', 'have worked'],
      ]),
      // «By» + a deadline with a count of events that happen one at a time (won six matches, rung four times) takes the
      // perfect: a continuous cannot hold a count of instant events («By noon, the bell will be ringing four times»).
      // No activity that can be under way at the deadline (build, write, visit, interview), where «will be building
      // three houses» is natural.
      ...items('perfect', 'meaning', [
        ['By Monday, our team will have won six matches.', 'will have won', 'will be winning'],
        ['By half-time, he will have scored two goals.', 'will have scored', 'will be scoring'],
        ['By tonight, I will have sent fifty messages.', 'will have sent', 'will be sending'],
        ['By Saturday, I will have finished four exams.', 'will have finished', 'will be finishing'],
        ['By lunchtime, I will have received ten emails.', 'will have received', 'will be receiving'],
        ['By sunset, we will have caught twenty fish.', 'will have caught', 'will be catching'],
        ['By morning, the baby will have woken twice.', 'will have woken', 'will be waking'],
        ['By bedtime, I will have passed three levels.', 'will have passed', 'will be passing'],
        ['By ten, the bus will have stopped six times.', 'will have stopped', 'will be stopping'],
        ['By tomorrow, I will have called her five times.', 'will have called', 'will be calling'],
        ['By tonight, Mum will have phoned me three times.', 'will have phoned', 'will be phoning'],
        ['By noon, the bell will have rung four times.', 'will have rung', 'will be ringing'],
        ['By Sunday, I will have watered the plants twice.', 'will have watered', 'will be watering'],
        ['By Friday, it will have rained three times.', 'will have rained', 'will be raining'],
      ]),
      // will be + -ing, will have + past participle: a bare verb, the wrong auxiliary or a past simple is a form error.
      ...items('forms', 'form', [
        ['I will be working late tonight.', 'working', 'work'],
        ['She will have finished by noon.', 'finished', 'finish'],
        ['They will be waiting outside.', 'be', 'being'],
        ['He will have left before you arrive.', 'have', 'has'],
        ['Will you be using the car tonight?', 'using', 'use'],
        ['We will have eaten by eight.', 'eaten', 'ate'],
        ['By then, I will have graduated.', 'graduated', 'graduate'],
        ['The employer will be interviewing people all day.', 'interviewing', 'interview'],
        ['Will they have finished by Friday?', 'have', 'has'],
        ["I won't be working overtime tomorrow.", 'working', 'work'],
        ['They will have saved enough money by then.', 'saved', 'save'],
        ['He will be commuting by train next year.', 'commuting', 'commute'],
      ]),
    ],
  },
  {
    lessonId: L2('u6_l1'),
    statement: 'I can use the first and second conditional to talk about possible and hypothetical situations.',
    items: [
      // If + present, will + bare verb. The errors: will inside the if-clause (only with a subject that cannot be
      // willing, so «if you will …» never reads as a polite request), a wrong form after will, the wrong agreement.
      ...items('first-conditional', 'form', [
        ['If it rains, we will stay home.', 'rains', 'will rain'],
        ['If I see Dad, I will tell him.', 'will tell', 'will telling'],
        ['If you study hard, you will pass the exam.', 'will pass', 'will to pass'],
        ['If she misses the bus, she will be late.', 'misses', 'miss'],
        ['If we leave now, we will catch the train.', 'will catch', 'will caught'],
        ['If he eats too much, he will feel sick.', 'eats', 'eat'],
        ['If you are hungry, I will make lunch.', 'will make', 'will makes'],
        ['If it snows, the schools will close.', 'will close', 'will closing'],
        ['If they win, they will celebrate tonight.', 'win', 'wins'],
        ["If you don't hurry, you will miss the bus.", "don't", "doesn't"],
        ["She won't come if she is ill.", 'is', 'are'],
        ['Will you come if she invites you?', 'invites', 'invite'],
      ]),
      // If + past, would + bare verb. The errors: would inside the if-clause (once, with have, which cannot mean «be
      // willing to»: «If you would ask him» is a polite form), would + to, -ing, a past or -s. was and were are never
      // set against each other: both are accepted after I, he, she and it.
      ...items('second-conditional', 'form', [
        ['If I had a car, I would drive.', 'would drive', 'would to drive'],
        ['If she lived in Aqaba, she would swim.', 'would swim', 'would swam'],
        ['If I knew the answer, I would tell you.', 'would tell', 'would told'],
        ['If we had more time, we would visit Petra.', 'had', 'would have'],
        ['If he studied more, he would get better marks.', 'would get', 'would getting'],
        ['If you asked him, he would help.', 'would help', 'would helped'],
        ['If I found a wallet, I would return it.', 'would return', 'would to return'],
        ['If Dad had a day off, he would cook.', 'would cook', 'would cooks'],
        ['If we lived near the sea, we would fish.', 'would fish', 'would fishing'],
        ['If she spoke French, she would teach it.', 'would teach', 'would taught'],
        ['What would you do if you lost your phone?', 'do', 'to do'],
        ["I wouldn't worry if I were you.", 'worry', 'worried'],
      ]),
      // An unreal situation stated in its own first sentence («Imagine …», «Just imagine …», «Suppose …», with a past
      // verb) takes would in the second; will is ruled out by that opener. The twin's second sentence («You will fly.»)
      // is sound English on its own, so the choice turns on meaning, not form. No if-clause with were or could + will
      // (a form error), and no likely condition: after «If it rains, …» a tentative would is accepted too.
      ...items('imagine-vs-real', 'meaning', [
        ['Imagine you had wings. You would fly.', 'would fly', 'will fly'],
        ['Imagine we had no phones. Life would be quiet.', 'would be', 'will be'],
        ['Imagine you were invisible. Nobody would see you.', 'would see', 'will see'],
        ['Imagine I could fly. I would never walk.', 'would never walk', 'will never walk'],
        ['Imagine you lived on the moon. You would float.', 'would float', 'will float'],
        ['Imagine there were no cars. Cities would be quieter.', 'would be', 'will be'],
        ['Imagine you spoke every language. You would travel everywhere.', 'would travel', 'will travel'],
        ['Suppose it snowed in Aqaba. We would build snowmen.', 'would build', 'will build'],
        ['Suppose you met a dinosaur. You would run.', 'would run', 'will run'],
        ["Just imagine we lived underwater. We'd need gills.", "We'd need", "We'll need"],
        ['Suppose you were famous. Everyone would know you.', 'would know', 'will know'],
        ['Imagine the sun never set. We would never sleep.', 'would never sleep', 'will never sleep'],
        ['Suppose animals could talk. My cat would complain.', 'would complain', 'will complain'],
        ['Imagine we had no school. We would get bored.', 'would get', 'will get'],
        ['Suppose the internet stopped working. We would read more.', 'would read', 'will read'],
        ['Imagine you were a giant. Houses would look tiny.', 'would look', 'will look'],
      ]),
    ],
  },
  {
    lessonId: L2('u6_l4'),
    statement: 'I can use the zero conditional to talk about real situations that are always true.',
    items: [
      // If + present simple, present simple: a general truth. No distractor has will or would (a test pins it): «If you
      // heat ice, it will melt» is a sound first conditional. The errors are agreement, -ing, a past participle or a
      // doubled auxiliary. No bare verb that is also an adjective (clean, open, dry), which could fit.
      ...items('if-present', 'form', [
        ['If you heat ice, it melts.', 'melts', 'melt'],
        ['If you eat late, you sleep badly.', 'sleep', 'sleeps'],
        ['If you boil water, it turns into steam.', 'turns', 'turning'],
        ['If it rains, the ground gets wet.', 'gets', 'get'],
        ['If you press this button, the machine stops.', 'stops', 'stopping'],
        ['If you drop glass, it breaks.', 'breaks', 'broken'],
        ['If people eat too much sugar, they gain weight.', 'gain', 'gains'],
        ['If you put oil in water, it floats.', 'floats', 'float'],
        ['If you leave milk out, it goes bad.', 'goes', 'go'],
        ['If babies are hungry, they cry.', 'cry', 'cries'],
        ['If you exercise every day, you feel better.', 'feel', 'feels'],
        ['If iron gets wet, it rusts.', 'gets', 'get'],
        ['If the traffic light is red, cars stop.', 'stop', 'stops'],
        ['If you heat butter, it becomes liquid.', 'becomes', 'is becomes'],
      ]),
      // The same with when, in either clause order.
      ...items('when-general-truths', 'form', [
        ['Plants die when they get no water.', 'get', 'gets'],
        ['When you heat water, it boils.', 'boils', 'boil'],
        ['When it gets dark, the street lights come on.', 'come', 'comes'],
        ["When I drink coffee, I can't sleep.", 'drink', 'drinks'],
        ['Metal expands when you heat it.', 'expands', 'expand'],
        ['When you mix blue and yellow, you get green.', 'mix', 'mixes'],
        ['My dog barks when someone knocks.', 'knocks', 'knock'],
        ['When the bell rings, the students leave.', 'rings', 'ringing'],
        ['Fish die when the water is dirty.', 'is', 'are'],
        ['When people are tired, they make mistakes.', 'make', 'makes'],
        ['When it snows, the roads become dangerous.', 'become', 'becomes'],
        ['Milk turns sour when it gets warm.', 'turns', 'turn'],
        ['When you press the switch, the light comes on.', 'comes', 'come'],
        ['When water freezes, it becomes ice.', 'freezes', 'frozen'],
      ]),
      // Questions and negatives: do/does agrees with the subject and takes the bare verb.
      ...items('questions-negatives', 'form', [
        ['What happens if you freeze water?', 'freeze', 'freezes'],
        ["If you don't water plants, they die.", 'die', 'dies'],
        ['What happens when you heat metal?', 'happens', 'happen'],
        ['Do cats purr when they are happy?', 'purr', 'purrs'],
        ["If you don't sleep, you feel tired.", "don't", "doesn't"],
        ["Buses don't run if it snows.", "don't", "doesn't"],
        ["What does your cat do when it's hungry?", 'does', 'do'],
        ["Iron doesn't float if you put it in water.", 'float', 'floats'],
        ['Why do leaves fall when it gets cold?', 'fall', 'falls'],
        ["If it doesn't rain, the grass turns brown.", "doesn't", "don't"],
        ["Do you get a headache if you don't eat?", 'get', 'gets'],
        ["A car doesn't start if the battery is flat.", 'start', 'starts'],
      ]),
    ],
  },
  {
    lessonId: L2('u7_l1'),
    statement: 'I can use reporting verbs to report stories.',
    items: [
      // promise, offer, refuse, agree, claim, threaten + to-infinitive: -ing or a bare verb is the error. No verb whose
      // -ing or bare form could be a noun after it («offered help»). No tense shift is tested anywhere in this lesson.
      ...items('verb-patterns', 'form', [
        ['She promised to call me.', 'to call', 'calling'],
        ['He offered to carry my bag.', 'to carry', 'carrying'],
        ['They refused to pay for the damage.', 'to pay', 'paying'],
        ['My brother agreed to help me.', 'to help', 'helping'],
        ['The boy promised to return the book.', 'to return', 'returning'],
        ['Dad offered to drive us to Amman.', 'to drive', 'driving'],
        ['She refused to answer my question.', 'to answer', 'answering'],
        ['We agreed to meet at the library.', 'to meet', 'meeting'],
        ['He threatened to tell the teacher.', 'to tell', 'telling'],
        ['The shop agreed to replace the phone.', 'to replace', 'replacing'],
        ['She offered to lend me her notes.', 'to lend', 'lending'],
        ['I promised not to be late.', 'not to be', 'not being'],
        ['He claimed to know the answer.', 'to know', 'knowing'],
        ['My sister refused to share her sweets.', 'to share', 'sharing'],
        ['The teacher agreed to postpone the test.', 'to postpone', 'postponing'],
        ['Mum promised to make a cake.', 'to make', 'make'],
      ]),
      // admit, deny, suggest, apologise for + -ing: the to-infinitive is the error. suggest also takes «that we go», so
      // only the -ing pattern is tested; «admit to doing» is English, so «to» never stands alone as the distractor.
      ...items('admit-deny-suggest', 'form', [
        ['He denied breaking the vase.', 'breaking', 'to break'],
        ['She admitted taking my pen.', 'taking', 'to take'],
        ['She suggested going by bus.', 'going', 'to go'],
        ['The boy admitted cheating in the test.', 'cheating', 'to cheat'],
        ['They denied making the mess.', 'making', 'to make'],
        ['He apologised for being late.', 'being', 'to be'],
        ['Dad suggested eating out tonight.', 'eating', 'to eat'],
        ['She denied eating the last biscuit.', 'eating', 'to eat'],
        ['I admitted forgetting my homework.', 'forgetting', 'to forget'],
        ['We apologised for making so much noise.', 'making', 'to make'],
        ['The teacher suggested reading the story again.', 'reading', 'to read'],
        ['He admitted losing the keys.', 'losing', 'to lose'],
        ['She denied telling anyone the secret.', 'telling', 'to tell'],
        ['Mum suggested visiting our grandparents.', 'visiting', 'to visit'],
      ]),
      // tell, warn, remind, advise, ask + object + to-infinitive. The errors: said for told, a missing object (after
      // tell and remind), -ing or a bare verb after the object. Never asked with and without an object against each
      // other (both are English), and never advise with -ing and no object («advised resting» is English).
      ...items('tell-ask-warn', 'form', [
        ['Mum told me to wait.', 'told me', 'said me'],
        ['The teacher told us to sit down.', 'to sit', 'sitting'],
        ['Dad warned me not to touch the oven.', 'not to touch', 'not touching'],
        ['She reminded me to bring my book.', 'to bring', 'bringing'],
        ['The coach told the players to rest.', 'told the players', 'said the players'],
        ['She asked me to open the window.', 'to open', 'opening'],
        ['The doctor advised me to drink water.', 'to drink', 'drink'],
        ['Our teacher reminded us to switch off our phones.', 'reminded us', 'reminded'],
        ['He told his sister to close the door.', 'told his sister', 'told to his sister'],
        ['The guide warned us to stay together.', 'to stay', 'staying'],
      ]),
    ],
  },
  {
    lessonId: L2('u7_l5'),
    statement: 'I can use reported questions to talk about what someone else said.',
    items: [
      // After asked, wondered or wanted to know, a wh-question takes statement order: no do and no inversion. Pronoun
      // or do-support cases only: no «what» + be + a noun («what the problem was»), where many speakers accept both.
      // The tense is never what differs (both «where I lived» and «where I live» are fine).
      ...items('ask-wonder', 'form', [
        ['He asked where I lived.', 'where I lived', 'where did I live'],
        ['She asked what I wanted.', 'what I wanted', 'what did I want'],
        ['They asked when the film started.', 'the film started', 'did the film start'],
        ['I wondered why she was upset.', 'she was', 'was she'],
        ['Mum asked where I had been.', 'I had been', 'had I been'],
        ['He wondered how the machine worked.', 'the machine worked', 'did the machine work'],
        ['The teacher asked why I was late.', 'I was', 'was I'],
        ['She asked how much the ticket cost.', 'the ticket cost', 'did the ticket cost'],
        ['I wondered what time it was.', 'it was', 'was it'],
        ['They asked where we were going.', 'we were', 'were we'],
        ['He wanted to know what I thought.', 'I thought', 'did I think'],
        ['She wondered who I was talking to.', 'I was', 'was I'],
        ['Dad asked how long the journey took.', 'the journey took', 'did the journey take'],
        ['My friend asked why I had left early.', 'I had left', 'had I left'],
      ]),
      // A yes or no question becomes if or whether + statement order. «that» is never offered: «asked that …» is a
      // request form.
      ...items('if-whether', 'form', [
        ['She asked if I was ready.', 'if I was', 'if was I'],
        ['They wondered whether it was true.', 'whether it was', 'whether was it'],
        ['He asked if I liked football.', 'if I liked', 'if did I like'],
        ['Mum asked whether I had finished.', 'whether I had', 'whether had I'],
        ['The teacher asked if we understood.', 'if we understood', 'if did we understand'],
        ['I wondered if the shop was open.', 'if the shop was', 'if was the shop'],
        ['She asked whether I could swim.', 'whether I could', 'whether could I'],
        ['They asked if we needed help.', 'if we needed', 'if did we need'],
        ['He wanted to know if I was coming.', 'if I was', 'if was I'],
        ['Dad asked whether the bus had left.', 'whether the bus had', 'whether had the bus'],
        ['She wondered if her friends were angry.', 'if her friends were', 'if were her friends'],
        ['The doctor asked if I felt better.', 'if I felt', 'if did I feel'],
      ]),
      // The same order with an object after asked and a modal or an auxiliary in the question.
      ...items('word-order', 'form', [
        ['She asked me where I could park.', 'I could park', 'could I park'],
        ['He asked us how many brothers we had.', 'we had', 'did we have'],
        ['The officer asked me where I was from.', 'I was', 'was I'],
        ['They asked me what I was doing.', 'I was doing', 'was I doing'],
        ['She asked me how I had found it.', 'I had found', 'had I found'],
        ['He asked me which bus I took.', 'I took', 'did I take'],
        ['Mum asked us what we had eaten.', 'we had eaten', 'had we eaten'],
        ['The man asked me where he could buy tickets.', 'he could buy', 'could he buy'],
        ['She asked me how old I was.', 'I was', 'was I'],
        ['They asked us when we would arrive.', 'we would arrive', 'would we arrive'],
        ['He asked me what I meant.', 'I meant', 'did I mean'],
        ["My teacher asked me why I hadn't come.", "I hadn't", "hadn't I"],
        ['She asked me how long I had waited.', 'I had waited', 'had I waited'],
        ['Dad asked me where I had put his keys.', 'I had put', 'had I put'],
      ]),
    ],
  },
  {
    lessonId: L2('u8_l1'),
    statement: 'I can use the passive to talk about different actions.',
    items: [
      // be + past participle, agreeing with the subject. The errors: the bare verb or the past simple for the
      // participle (irregular verbs, so the two differ), or the wrong be. No bare verb that is also an adjective
      // («is clean», «is open»), and no missing be, which can leave a grammatical active («The bridge built»).
      ...items('present-past', 'form', [
        ['The bridge was built long ago.', 'was built', 'was build'],
        ['English is spoken in many countries.', 'spoken', 'spoke'],
        ['This letter was written by my grandfather.', 'written', 'wrote'],
        ['The cakes were eaten in minutes.', 'were', 'was'],
        ['Rice is grown in many hot countries.', 'grown', 'grew'],
        ['My bike was stolen last night.', 'stolen', 'stole'],
        ['The windows are cleaned every week.', 'are', 'is'],
        ['The story was told by my grandmother.', 'told', 'tell'],
        ['These photos were taken in Petra.', 'taken', 'took'],
        ['The car is washed every Friday.', 'is washed', 'is wash'],
        ['The winners were given medals.', 'given', 'gave'],
        ['Our house was painted last year.', 'was painted', 'was paint'],
        ['Arabic is taught at every school.', 'is taught', 'is teach'],
        ['The song was sung by the whole class.', 'sung', 'sang'],
      ]),
      // modal + be + past participle. The errors: no be, to after the modal, been after the modal, a bare verb or a
      // past simple after be.
      ...items('with-modals', 'form', [
        ['The door must be locked.', 'be locked', 'be lock'],
        ['Phones must be switched off.', 'be switched', 'switched'],
        ['This medicine should be kept cold.', 'be kept', 'be keep'],
        ['The homework must be finished today.', 'must be', 'must to be'],
        ['The tickets can be bought online.', 'be bought', 'be buy'],
        ['Plastic bottles can be recycled.', 'can be', 'can'],
        ['The rules must be followed by everyone.', 'be followed', 'be follow'],
        ['The work will be done tomorrow.', 'will be done', 'will be did'],
        ['Students must be told about the test.', 'must be told', 'must told'],
        ['The letter might be sent tomorrow.', 'be sent', 'be send'],
        ["This room can't be used today.", 'be used', 'been used'],
        ['The plants should be watered every day.', 'should be', 'should'],
      ]),
      // A passive question inverts be (no do); a negative puts not after be.
      ...items('questions-negatives', 'form', [
        ['Were the letters sent yesterday?', 'Were', 'Did'],
        ['Was the window broken by the wind?', 'Was', 'Did'],
        ["The match wasn't cancelled.", "wasn't cancelled", "wasn't cancel"],
        ['Are cars made in Jordan?', 'Are', 'Do'],
        ['Where was this photo taken?', 'taken', 'took'],
        ["The sandwiches weren't eaten at the party.", "weren't", "didn't"],
        ['When was the school built?', 'was', 'did'],
        ['Are the rooms cleaned every day?', 'Are', 'Do'],
        ['The emails were not sent.', 'were not', 'not were'],
        ["The homework isn't checked on Fridays.", "isn't checked", "isn't check"],
        ['Why was the trip cancelled?', 'cancelled', 'cancel'],
        ['Is this bread made locally?', 'made', 'make'],
        ["The new rules weren't explained to us.", 'explained', 'explain'],
        ['Who was the prize given to?', 'given', 'gave'],
      ]),
    ],
  },
  {
    lessonId: L2('u8_l6'),
    statement: 'I can use have/get something done to talk about services.',
    items: [
      // have + object + past participle. The errors: the bare verb, -ing or a past simple for the participle, or the
      // wrong have. Never «had repaired my car» (a sound past perfect). No bare verb that makes a noun with the object
      // («the heater check», «car wash», «kitchen paint»), and -ing only where the object cannot do the action.
      ...items('have-something-done', 'form', [
        ['I had my car repaired yesterday.', 'repaired', 'repair'],
        ['Dad had his eyes tested.', 'tested', 'testing'],
        ['They had a swimming pool dug.', 'dug', 'digged'],
        ['She had her bedroom decorated.', 'decorated', 'decorate'],
        ['He had his letter translated into English.', 'translated', 'translate'],
        ["I'm having a new sink installed tomorrow.", 'installed', 'install'],
        ['They had the pizza delivered to school.', 'delivered', 'deliver'],
        ['He has his suits made in Amman.', 'has', 'have'],
        ['Did you have the old tree removed?', 'removed', 'remove'],
        ['We are having the walls knocked down.', 'knocked', 'knock'],
        ['I had the parcel sent to Irbid.', 'sent', 'send'],
        ['We have the lift checked every month.', 'checked', 'checking'],
      ]),
      // get + object + past participle. The errors: the bare verb, a past simple, the wrong get, or the object after
      // the participle («got repaired his watch»). No -ing: «get the engine running» is English.
      ...items('get-something-done', 'form', [
        ['She got her phone fixed.', 'fixed', 'fix'],
        ['Dad got his watch repaired.', 'his watch repaired', 'repaired his watch'],
        ['Where did you get your glasses made?', 'made', 'make'],
        ['You should get your passport renewed.', 'renewed', 'renew'],
        ["I'll get my name written on the cake.", 'written', 'wrote'],
        ['He got his tooth pulled out.', 'pulled', 'pull'],
        ['We got the broken window replaced.', 'replaced', 'replace'],
        ["Let's get the old sofa taken away.", 'taken', 'took'],
        ['She gets her car serviced every spring.', 'gets', 'get'],
        ['I got my school bag mended.', 'my school bag mended', 'mended my school bag'],
        ['Did you get the tickets printed?', 'printed', 'print'],
        ['They got their house painted white.', 'their house painted', 'painted their house'],
      ]),
      // Self-done or a service, decided in the sentence: myself, ourselves or «with her own hands» rules out the
      // service; a sentence saying the speaker cannot do it, was away, did not do it, or who did it rules out the
      // self-done action. Both sides are sound sentences. No «by experts» or «by a tailor» after the self-done twin:
      // «We painted the house by experts» is a form error, not a meaning one.
      ...items('service-vs-self', 'meaning', [
        ['I cleaned the windows myself.', 'cleaned the windows', 'had the windows cleaned'],
        ['We painted our bedroom ourselves.', 'painted our bedroom', 'had our bedroom painted'],
        ["Dad fixed the tap himself. He didn't call anyone.", 'fixed the tap', 'had the tap fixed'],
        ['She knitted this scarf with her own hands.', 'knitted this scarf', 'had this scarf knitted'],
        ["I repaired my bike myself with my dad's tools.", 'repaired my bike', 'had my bike repaired'],
        ['My brother cuts his hair himself.', 'cuts his hair', 'has his hair cut'],
        ['We washed the car ourselves to save money.', 'washed the car', 'had the car washed'],
        ['Mum baked the birthday cake herself.', 'baked the birthday cake', 'had the birthday cake baked'],
        ["I can't cut hair, so I had mine cut.", 'had mine cut', 'cut mine'],
        ["Dad can't repair cars, so he gets his fixed.", 'gets his fixed', 'fixes his'],
        ["She can't sew, so she had the dress made.", 'had the dress made', 'made the dress'],
        ["I didn't iron my shirts. I had them ironed.", 'had them ironed', 'ironed them'],
        ['We were travelling, so we had the plants watered.', 'had the plants watered', 'watered the plants'],
        ['I had my suit shortened. A tailor did it.', 'had my suit shortened', 'shortened my suit'],
        ['We had our photo taken. A photographer took it.', 'had our photo taken', 'took our photo'],
        ['We had our garden designed. An expert did it.', 'had our garden designed', 'designed our garden'],
      ]),
    ],
  },
  {
    lessonId: L2('u9_l1'),
    statement: 'I can use the third conditional to talk about unreal situations in the past.',
    items: [
      // If + past perfect, would have + past participle. The errors: would have inside the if-clause, had + a past
      // simple or a bare verb, would had, would have + a bare verb or a past simple. Never a past simple in the
      // if-clause («If I knew, I would have called» is a sound mixed conditional), and never would + a bare verb in
      // the result («If I had known, I would call you» is one too).
      ...items('third-conditional', 'form', [
        ['If I had known, I would have called.', 'had known', 'would have known'],
        ["If we'd left earlier, we'd have seen the start.", 'have seen', 'have saw'],
        ['If she had studied, she would have passed.', 'had studied', 'would have studied'],
        ['If it had rained, we would have stayed in.', 'had rained', 'had rain'],
        ['If you had phoned, I would have answered.', 'would have answered', 'would have answer'],
        ['If he had seen me, he would have waved.', 'would have waved', 'would had waved'],
        ['If they had trained harder, they would have won.', 'would have won', 'would have win'],
        ['If you had told me, I would have come.', 'had told', 'had tell'],
        ['Our friends would have helped if we had asked.', 'had asked', 'would have asked'],
        ["If he hadn't fallen, he would have finished first.", "hadn't fallen", "hadn't fell"],
        ["We wouldn't have been late if we had hurried.", 'had hurried', 'would have hurried'],
        ["If the bus had come, we'd have taken it.", 'had come', 'had came'],
        ['What would you have done if you had failed?', 'done', 'did'],
        ["If she had driven, we'd have arrived sooner.", 'had driven', 'had drove'],
      ]),
      // A past time word in the result («yesterday», «last night», «two days ago», «last term») takes would have;
      // would + a bare verb is ruled out by it («I'd call yesterday»), as a past time word rules out can in Semester 1.
      // The time word sits in the result, never only in the if-clause: «If it hadn't rained yesterday, we'd play»
      // can be about today. No «last summer» or «as a child», where would can be a past habit.
      ...items('past-unreal', 'meaning', [
        ["You'd have met her yesterday if you'd come.", 'have met', 'meet'],
        ["I'd have called yesterday, but my phone died.", 'have called', 'call'],
        ["Without the storm, we'd have sailed two days ago.", 'have sailed', 'sail'],
        ['She would have won last week with more practice.', 'would have won', 'would win'],
        ["If you'd asked, I'd have helped earlier today.", 'have helped', 'help'],
        ["We'd have arrived an hour ago by taxi.", 'have arrived', 'arrive'],
        ["I was ill. Otherwise, I'd have gone last Friday.", 'have gone', 'go'],
        ["I'd have stayed longer at yesterday's party.", 'have stayed', 'stay'],
        ["With a car, we'd have visited Petra last weekend.", 'have visited', 'visit'],
        ["Without your help, I'd have failed last term.", 'have failed', 'fail'],
        ["If he'd played, he'd have scored last night.", 'have scored', 'score'],
        ["With more money, I'd have flown there last month.", 'have flown', 'fly'],
        ['Outside the freezer, the ice would have melted yesterday.', 'would have melted', 'would melt'],
        ["I'd have told you last night, but I forgot.", 'have told', 'tell'],
      ]),
      // would have + past participle, with or without an if-clause. The errors: would had, would have + a bare verb
      // or a past simple.
      ...items('would-have-forms', 'form', [
        ['She would have helped if she had known.', 'would have helped', 'would had helped'],
        ['I would have bought it, but it was expensive.', 'would have bought', 'would have buy'],
        ['He would have come, but nobody asked him.', 'would have come', 'would have came'],
        ['We would have swum if it had been sunny.', 'swum', 'swam'],
        ['You would have loved the concert.', 'loved', 'love'],
        ["They wouldn't have lost if they had tried.", "wouldn't have lost", "wouldn't have lose"],
        ["I'd have walked, but it was raining.", 'have walked', 'have walk'],
        ['Would you have gone without me?', 'gone', 'went'],
        ['She would have been angry if you had lied.', 'been', 'be'],
        ['The plants would have died without water.', 'died', 'die'],
        ['We would have taken photos, but we forgot.', 'taken', 'took'],
        ['He would have written, but he was busy.', 'written', 'wrote'],
      ]),
    ],
  },
  {
    lessonId: L2('u9_l4'),
    statement: 'I can use I wish and if only to express regrets.',
    items: [
      // wish + past simple (or could) for the present. The errors: the present simple, can, or an -s after wish's
      // subject. No would (a sound complaint: «I wish it would rain»), no past perfect (a sound regret), and were and
      // was are never set against each other.
      ...items('wish-present', 'form', [
        ['I wish I had a bigger room.', 'had', 'have'],
        ['I wish I knew the answer.', 'knew', 'know'],
        ['I wish I lived near the sea.', 'lived', 'live'],
        ['She wishes she had more free time.', 'had', 'has'],
        ['I wish I could speak French.', 'could', 'can'],
        ['I wish my friends were here.', 'were', 'are'],
        ['We wish we owned a car.', 'owned', 'own'],
        ["I wish I didn't have so much homework.", "didn't", "don't"],
        ['He wishes he were taller.', 'were', 'is'],
        ['Do you wish you lived in Amman?', 'lived', 'live'],
        ['My sister wishes she spoke English well.', 'spoke', 'speaks'],
        ['I wish I understood maths better.', 'understood', 'understand'],
        ['I wish the shops opened earlier.', 'opened', 'open'],
        ['I wish my phone worked.', 'worked', 'works'],
      ]),
      // A past time word («last year», «yesterday», «an hour ago») takes wish or if only + past perfect; the past
      // simple, a sound present wish on its own («I wish I studied»), is ruled out by it.
      ...items('wish-past-regrets', 'meaning', [
        ['I wish I had studied last year.', 'had studied', 'studied'],
        ['I wish I had slept more last night.', 'had slept', 'slept'],
        ['She wishes she had come to the party yesterday.', 'had come', 'came'],
        ["I wish I hadn't eaten so much yesterday.", "hadn't eaten", "didn't eat"],
        ['We wish we had visited Petra last spring.', 'had visited', 'visited'],
        ['If only I had saved money last year.', 'had saved', 'saved'],
        ['I wish I had taken photos last summer.', 'had taken', 'took'],
        ["He wishes he hadn't said that last night.", "hadn't said", "didn't say"],
        ['I wish I had left an hour ago.', 'had left', 'left'],
        ['If only we had booked the tickets last week.', 'had booked', 'booked'],
        ['My brother wishes he had trained harder last season.', 'had trained', 'trained'],
        ['I wish I had called my grandmother last weekend.', 'had called', 'called'],
        ["If only I had checked yesterday's homework.", 'had checked', 'checked'],
        ["She wishes she hadn't missed the bus yesterday.", "hadn't missed", "didn't miss"],
      ]),
      // If only + past perfect, could or would. The errors: had + a bare verb or a past simple, to or a past after
      // could, an -s after would. Never a present after if only («If only I have time» is a sound hope).
      ...items('if-only', 'form', [
        ['If only I had listened to Mum!', 'had listened', 'had listen'],
        ['If only I had known the truth!', 'had known', 'had knew'],
        ['If only we had left earlier!', 'had left', 'had leave'],
        ['If only I could swim!', 'could swim', 'could to swim'],
        ['If only it would stop raining!', 'would stop', 'would stops'],
        ["If only I hadn't lost my phone!", "hadn't lost", "hadn't lose"],
        ['If only she had told me sooner!', 'had told', 'had tell'],
        ["If only we hadn't eaten all the cake!", "hadn't eaten", "hadn't ate"],
        ['If only I had brought an umbrella!', 'had brought', 'had bring'],
        ['If only he could drive!', 'could drive', 'could drove'],
        ["If only I hadn't forgotten her birthday!", "hadn't forgotten", "hadn't forget"],
        ['If only the bus had come on time!', 'had come', 'had came'],
      ]),
    ],
  },
  {
    lessonId: L2('u10_l1'),
    statement: 'I can use modal verbs to speculate about the present.',
    items: [
      // A clue in the sentence («so», or a first sentence of evidence) makes must a sure yes or can't a sure no; the
      // other is a sound sentence the clue contradicts. might and could are never set against each other.
      ...items('must-cant', 'meaning', [
        ['The lights are on, so they must be home.', 'must', "can't"],
        ["He has just eaten, so he can't be hungry.", "can't", 'must'],
        ["You've walked for hours. You must be tired.", 'must', "can't"],
        ["She's only ten, so she can't be a teacher.", "can't", 'must'],
        ['Everyone is laughing. The film must be funny.', 'must', "can't"],
        ["He's in Amman, so he can't be in Aqaba.", "can't", 'must'],
        ["It's locked from inside, so they must be in.", 'must', "can't"],
        ["It's very cheap, so it can't be real gold.", "can't", 'must'],
        ['It has my name, so it must be mine.', 'must', "can't"],
        ["The box is empty, so it can't be heavy.", "can't", 'must'],
        ["You're shivering. You must be cold.", 'must', "can't"],
        ["The shop is dark, so it can't be open.", "can't", 'must'],
        ['He won the race, so he must be fast.', 'must', "can't"],
        ["It's midnight, so he can't be at school.", "can't", 'must'],
      ]),
      // might or may + a bare verb. The errors: an -s or is after the modal, to after it, been for be.
      ...items('might-may', 'form', [
        ['She might be late today.', 'might be', 'might is'],
        ['He may be at the library.', 'may be', 'may to be'],
        ['They might not know the answer.', 'might not know', 'might not to know'],
        ['It may rain later.', 'may rain', 'may rains'],
        ['The test might be difficult.', 'be', 'been'],
        ['Your keys may be in the car.', 'may be', 'may are'],
        ['She might not be at home.', 'not be', 'not to be'],
        ['He may have a cold.', 'may have', 'may has'],
        ['We might need more chairs.', 'might need', 'might needs'],
        ['That may not be true.', 'may not be', 'may not'],
        ['The museum might close early today.', 'might close', 'might to close'],
        ['My brother may know her number.', 'may know', 'may knows'],
      ]),
      // modal + be + -ing for what is happening now. The errors: no be, a bare verb after be, is for be. Never the
      // modal + a bare verb («He must sleep» is a sound obligation), and no bare verb that is also a noun after be.
      ...items('be-v-ing', 'form', [
        ['He must be sleeping now.', 'be sleeping', 'sleeping'],
        ['They might be watching TV.', 'be watching', 'be watch'],
        ["She can't be working today.", 'be working', 'working'],
        ['Dad may be cooking dinner.', 'be cooking', 'is cooking'],
        ['You must be joking!', 'be joking', 'be joke'],
        ['It might be raining in Irbid.', 'be raining', 'raining'],
        ["They can't be playing outside in this storm.", 'be playing', 'be play'],
        ['She must be studying for her exam.', 'studying', 'study'],
        ['He might be waiting at the bus stop.', 'waiting', 'wait'],
        ['Mum may be resting, so be quiet.', 'resting', 'rest'],
        ['The children must be having fun.', 'having', 'have'],
        ['Someone might be using the computer.', 'using', 'use'],
        ["His car is here. He can't be driving.", 'be driving', 'driving'],
        ['They must be travelling by train.', 'travelling', 'travel'],
      ]),
    ],
  },
  {
    lessonId: L2('u10_l3'),
    statement: 'I can use modal verbs to speculate about the past.',
    items: [
      // A first sentence of evidence makes must have a sure deduction; can't have, a sound sentence on its own, is
      // contradicted by it.
      ...items('must-have', 'meaning', [
        ['The ground is wet. It must have rained.', 'must have', "can't have"],
        ['Their car is gone. They must have left.', 'must have', "can't have"],
        ["She's holding the cup. She must have won.", 'must have', "can't have"],
        ['He ate three burgers. He must have been hungry.', 'must have', "can't have"],
        ["There's snow everywhere. It must have snowed.", 'must have', "can't have"],
        ["You're soaking! You must have walked in the rain.", 'must have', "can't have"],
        ['The cake is gone. Someone must have eaten it.', 'must have', "can't have"],
        ['The grass is short. Someone must have cut it.', 'must have', "can't have"],
        ['The house smells of bread. Mum must have baked.', 'must have', "can't have"],
        ['The glass is broken. It must have fallen.', 'must have', "can't have"],
        ['My keys are gone. I must have lost them.', 'must have', "can't have"],
        ['There are footprints. Someone must have walked here.', 'must have', "can't have"],
        ['Everyone is clapping. She must have sung well.', 'must have', "can't have"],
        ['A letter has arrived. The postman must have come.', 'must have', "can't have"],
      ]),
      // might have or could have + past participle. The errors: no have, had or has for have, a bare verb or a past
      // simple for the participle. Never a bare verb after might («He might forget» is sound), and never must of.
      ...items('might-could-have', 'form', [
        ['He might have forgotten the key.', 'might have forgotten', 'might forgot'],
        ['She could have missed the bus.', 'could have missed', 'could have miss'],
        ['They might have gone home.', 'have gone', 'had gone'],
        ['You could have left it at school.', 'left', 'leave'],
        ['The letter might have got lost.', 'have got', 'has got'],
        ['He might not have heard you.', 'not have heard', 'not have hear'],
        ['Someone could have taken your pen.', 'taken', 'took'],
        ['It might have been the wind.', 'been', 'be'],
        ['She might have called while we were out.', 'have called', 'called'],
        ['They could have stopped for lunch.', 'have stopped', 'had stopped'],
        ['The dog might have eaten your homework.', 'eaten', 'ate'],
        ['Could he have lost his way?', 'have lost', 'have lose'],
      ]),
      // A first sentence of evidence (where someone was, what they cannot do, what is left) makes can't have a sure
      // no; must have, a sound sentence on its own, is contradicted by it.
      ...items('cant-have', 'meaning', [
        ["She was with me. She can't have taken it.", "can't have", 'must have'],
        ["He was asleep. He can't have called.", "can't have", 'must have'],
        ["The shop was closed. She can't have shopped there.", "can't have", 'must have'],
        ["The food is untouched. They can't have been hungry.", "can't have", 'must have'],
        ["The road is dry. It can't have rained.", "can't have", 'must have'],
        ["He stayed home. He can't have gone shopping.", "can't have", 'must have'],
        ["That's impossible! He can't have finished already.", "can't have", 'must have'],
        ["She's only six. She can't have written this.", "can't have", 'must have'],
        ["I have the only key. He can't have entered.", "can't have", 'must have'],
        ["My phone was off. You can't have reached me.", "can't have", 'must have'],
        ["He was in hospital. He can't have played yesterday.", "can't have", 'must have'],
        ["They were out. They can't have heard the bell.", "can't have", 'must have'],
        ["She doesn't drive. She can't have driven here.", "can't have", 'must have'],
        ["It was dark. You can't have seen his face.", "can't have", 'must have'],
      ]),
    ],
  },
];
