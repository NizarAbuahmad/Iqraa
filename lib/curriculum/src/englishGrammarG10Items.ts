/**
 * Grade 10 grammar: the eleven authored Semester 1 lessons whose book statement is a grammar topic (spec:
 * docs/superpowers/specs/2026-10-23-english-corner-grammar-g10-design.md). Every item is a whole sentence with its
 * correct answer and a distractor, written by us and checked by a teacher on the printed form; nothing here is pictured.
 *
 * The rule for a distractor: it is `form` (ungrammatical in standard English: the bare verb or the wrong inflection,
 * the wrong agreement, `to` or -ing after the wrong verb, a missing or doubled auxiliary, a plainly wrong article) or
 * `meaning` (grammatical, but excluded by a marker in the sentence itself: a habit or «now» word, a count, a duration
 * on a finished task, an event that cuts an action short, «by the time», a time word that fixes remember or forget).
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

export const G10_ITEM_LESSONS: { lessonId: string; statement: string; items: GrammarItem[] }[] = [
  {
    lessonId: L('u1_l1'),
    statement: 'I can use Present Simple and Present Continuous to talk about habits and temporary situations.',
    items: [
      // A habit word (every day, usually, often, rarely, never, on Fridays) rules out the continuous.
      ...items('habit-markers', 'meaning', [
        ['She usually walks to school.', 'walks', 'is walking'],
        ['My father rarely wears a suit.', 'wears', 'is wearing'],
        ['We often celebrate birthdays at home.', 'celebrate', 'are celebrating'],
        ['He never wears his uniform at weekends.', 'wears', 'is wearing'],
        ['The shop opens at eight every day.', 'opens', 'is opening'],
        ['My brother plays football on Fridays.', 'plays', 'is playing'],
        ['Mum usually cooks dinner.', 'cooks', 'is cooking'],
        ['Students rarely dress casually at our school.', 'dress', 'are dressing'],
        ['We never wear jeans to school.', 'wear', 'are wearing'],
        ['She checks her email every day.', 'checks', 'is checking'],
        ['We visit our grandparents on Fridays.', 'visit', 'are visiting'],
        ['Dad often reads the newspaper in the morning.', 'reads', 'is reading'],
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
        ['We have been cleaning the house all morning.', 'have been cleaning', 'have cleaned'],
        ['How long have you been doing your homework?', 'been doing', 'done'],
        ['Dad has been repairing the car since lunch.', 'has been repairing', 'has repaired'],
        ['He has been painting the kitchen for three hours.', 'has been painting', 'has painted'],
        ['I have been fixing my bike all afternoon.', 'have been fixing', 'have fixed'],
        ['How long has she been making that cake?', 'been making', 'made'],
        ['Mum has been cooking dinner since five.', 'has been cooking', 'has cooked'],
        ['He has been learning the poem since breakfast.', 'has been learning', 'has learned'],
        ['I have been drawing this map for two hours.', 'have been drawing', 'have drawn'],
        ['She has been packing her bag for an hour.', 'has been packing', 'has packed'],
        ['How long have you been washing the dishes?', 'been washing', 'washed'],
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
        ['By the time I answered, the ringing had stopped.', 'had stopped', 'stopped'],
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
];
