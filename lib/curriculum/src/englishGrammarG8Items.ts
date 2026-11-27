/**
 * Grade 8 grammar items for the English corner: the authored Semester 1 lessons whose book statement is a grammar topic
 * (spec: docs/superpowers/specs/2026-11-04-english-corner-grammar-g8-s1-design.md). Every item is a whole sentence with
 * its correct answer and a distractor, written by us and checked by a teacher on the printed form; nothing here is pictured.
 *
 * The rule for a distractor: it is `form` (ungrammatical in standard English: the bare verb or a wrong -s, the wrong
 * auxiliary or agreement, `to` or -ing after a modal, an adverb in a position English does not allow, the wrong be-form,
 * `some` in a negative, `a` with an uncountable noun, a misspelt inflection in the spelling sub-topics only) or `meaning`
 * (grammatical, but excluded by a word in the sentence itself: here only a `so` or `but` clause that states why someone
 * can or can't do a chore). Never a form that could fit, and `meaning` only in the sub-topics the test pins as `meaning`.
 * Every sentence is nine words or fewer, so Build always takes it whole. No names: a pronoun, a family word (`Mum`, `Dad`)
 * or a Jordanian place. `statement` is the book's own «I can» line for the lesson id (its `objectives[0]`, read back by a test).
 *
 * Imports only types from the engine: `englishGrammar.ts` imports `englishGrammarG8.ts`, which imports this file.
 */
import type { GrammarItem } from './englishGrammar.ts';

type Row = [text: string, answer: string, distractor: string];
const items = (topic: string, kind: GrammarItem['kind'], rows: Row[]): GrammarItem[] =>
  rows.map(([text, answer, distractor]) => ({ topic, kind, text, answer, distractor }));

const L = (s: string) => `kbl-g8-eng-s1-nccd-${s}`;

export const G8_ITEM_LESSONS: { lessonId: string; statement: string; items: GrammarItem[] }[] = [
  {
    lessonId: L('u1_l1'),
    statement: 'I can use the Present Simple to talk about daily routines.',
    items: [
      // The subject is he, she, it or one person or thing, so the verb takes -s; the distractor is the bare verb.
      ...items('third-person-s', 'form', [
        ['She walks to school.', 'walks', 'walk'],
        ['He gets up at six.', 'gets', 'get'],
        ['My brother plays football after school.', 'plays', 'play'],
        ['Mum cooks dinner at six.', 'cooks', 'cook'],
        ['Dad drives to work every day.', 'drives', 'drive'],
        ['The bus leaves at seven.', 'leaves', 'leave'],
        ['Our teacher starts the lesson at eight.', 'starts', 'start'],
        ['He eats breakfast with his family.', 'eats', 'eat'],
        ['My sister reads a book at night.', 'reads', 'read'],
        ['The shop opens at nine.', 'opens', 'open'],
        ['She helps her mother in the kitchen.', 'helps', 'help'],
        ['It rains a lot in winter.', 'rains', 'rain'],
        ['My uncle works in a bank.', 'works', 'work'],
        ['He lives in Amman.', 'lives', 'live'],
      ]),
      // -es after -ch, -sh, -s, -x, -o; -ies after a consonant and y. The distractor is the plain -s (or -ys) misspelling.
      ...items('spelling-es', 'form', [
        ['He watches TV at night.', 'watches', 'watchs'],
        ['She studies English every day.', 'studies', 'studys'],
        ['My father goes to work early.', 'goes', 'gos'],
        ['She washes the dishes after dinner.', 'washes', 'washs'],
        ['The teacher teaches us maths.', 'teaches', 'teachs'],
        ['He tries hard in every lesson.', 'tries', 'trys'],
        ['Dad fixes the car on Fridays.', 'fixes', 'fixs'],
        ['Mum brushes her hair in the morning.', 'brushes', 'brushs'],
        ['The baby cries at night.', 'cries', 'crys'],
        ['She finishes work at five.', 'finishes', 'finishs'],
        ['My sister carries the bag to school.', 'carries', 'carrys'],
        ['She relaxes at home after school.', 'relaxes', 'relaxs'],
      ]),
      // doesn't (he, she, it, one thing) or don't (I, we, they, plural) takes the base verb. The distractor keeps the -s,
      // or has no auxiliary at all. Never «don't» after a singular subject: some dialects accept it.
      ...items('negatives', 'form', [
        ["She doesn't play tennis.", "doesn't play", "doesn't plays"],
        ["He doesn't eat meat.", "doesn't eat", "doesn't eats"],
        ["We don't go to school on Fridays.", "don't go", "don't goes"],
        ["They don't watch TV at night.", "don't watch", "don't watches"],
        ["My father doesn't work on Fridays.", "doesn't work", "doesn't works"],
        ["I don't drink milk.", "don't drink", "don't drinks"],
        ["The bank doesn't open at night.", "doesn't open", "doesn't opens"],
        ["Mum doesn't cook fish.", "doesn't cook", "doesn't cooks"],
        ["My sisters don't like maths.", "don't like", 'not like'],
        ["It doesn't rain in summer.", "doesn't rain", "doesn't rains"],
        ["My brother doesn't like carrots.", "doesn't like", 'not like'],
        ["We don't have school today.", "don't have", 'not have'],
        ["The students don't wear jeans.", "don't wear", "don't wears"],
        ["Dad doesn't drive to work.", "doesn't drive", "doesn't drives"],
      ]),
    ],
  },
  {
    lessonId: L('u1_l3'),
    statement: 'I can ask and answer questions about everyday life and use adverbs of frequency.',
    items: [
      // Do or Does + subject + base verb: Does goes with he, she, it and one person or thing, Do with the rest. The
      // distractor is the wrong auxiliary for the subject, or the verb with a wrong -s.
      ...items('do-does-questions', 'form', [
        ['Does he walk to school?', 'Does he walk', 'Do he walk'],
        ['Do you like pizza?', 'Do you like', 'Does you like'],
        ['Does she play tennis?', 'Does she play', 'Does she plays'],
        ['Do they live in Amman?', 'Do they live', 'Does they live'],
        ['Does your father work in a bank?', 'Does your father work', 'Do your father work'],
        ['Do we have maths today?', 'Do we have', 'Does we have'],
        ['Does the bus stop here?', 'Does the bus stop', 'Do the bus stop'],
        ['Do you walk to school?', 'Do you walk', 'Do you walks'],
        ['Does it rain in Aqaba?', 'Does it rain', 'Does it rains'],
        ['Do your friends play football?', 'Do your friends play', 'Do your friends plays'],
        ['Does Mum cook on Fridays?', 'Does Mum cook', 'Do Mum cook'],
        ['Do the students wear a uniform?', 'Do the students wear', 'Does the students wear'],
        ['Does she have a brother?', 'Does she have', 'Does she has'],
        ['Do you speak Arabic?', 'Do you speak', 'Does you speak'],
      ]),
      // A wh-word + do or does + subject + base verb. The distractor leaves the auxiliary out or breaks its agreement.
      ...items('question-words', 'form', [
        ['Where do you live?', 'do you live', 'you live'],
        ['What time does the lesson start?', 'does the lesson start', 'the lesson start'],
        ['Why does she walk to school?', 'does she walk', 'do she walk'],
        ['What do you eat for breakfast?', 'do you eat', 'you eat'],
        ['When does your father come home?', 'does your father come', 'your father comes'],
        ['How do you go to school?', 'do you go', 'you go'],
        ['Who does he play with?', 'does he play', 'he plays'],
        ['Where does Mum work?', 'does Mum work', 'Mum works'],
        ['What do they watch on Fridays?', 'do they watch', 'they watch'],
        ['Why do you study English?', 'do you study', 'does you study'],
        ['How often does she visit Petra?', 'does she visit', 'do she visit'],
        ['Which bus do you take?', 'do you take', 'you take'],
      ]),
      // An adverb of frequency goes before a main verb, never between the verb and its object. It sits inside the answer,
      // so the false twin keeps standard order everywhere else. Never «sometimes» (it can go first or last), never a twin
      // that puts the adverb at the end of the sentence (English allows that for «often» and «usually»), and never a
      // sentence with «be»: «always is» and «usually is» are acceptable English, with stress or without.
      ...items('adverb-position', 'form', [
        ['She always eats breakfast at home.', 'always eats', 'eats always'],
        ['He usually walks to school.', 'usually walks', 'walks usually'],
        ['We often play football after school.', 'often play', 'play often'],
        ['They often visit their grandparents.', 'often visit', 'visit often'],
        ['My father always drives to work.', 'always drives', 'drives always'],
        ['My brother usually plays tennis on Fridays.', 'usually plays', 'plays usually'],
        ['I never eat breakfast at school.', 'never eat', 'eat never'],
        ['Dad never watches TV at night.', 'never watches', 'watches never'],
        ['She often helps her mother.', 'often helps', 'helps often'],
        ['We always do our homework at four.', 'always do', 'do always'],
        ['We usually have lunch at two.', 'usually have', 'have usually'],
        ['He never plays chess.', 'never plays', 'plays never'],
        ['The students always wear a uniform.', 'always wear', 'wear always'],
        ['Dad usually reads the newspaper.', 'usually reads', 'reads usually'],
      ]),
    ],
  },
  {
    lessonId: L('u2_l1'),
    statement: 'I can use there is/there are and some and any to talk about my home.',
    items: [
      // there is + one thing or an uncountable noun, there are + more than one. The distractor is the other be-form.
      ...items('there-is-are', 'form', [
        ['There are two beds in my room.', 'are', 'is'],
        ['There is a sofa in the living room.', 'is', 'are'],
        ['There are three chairs in the kitchen.', 'are', 'is'],
        ['There is a big window in my room.', 'is', 'are'],
        ['There are many books on the shelf.', 'are', 'is'],
        ['There is a garden behind our house.', 'is', 'are'],
        ['There are four bedrooms in our flat.', 'are', 'is'],
        ['There is a lamp next to the bed.', 'is', 'are'],
        ['There is some milk in the fridge.', 'is', 'are'],
        ['There are some pictures on the wall.', 'are', 'is'],
        ['There is a carpet on the floor.', 'is', 'are'],
        ['There are some plates on the table.', 'are', 'is'],
        ['There is some water in the bottle.', 'is', 'are'],
        ['There is a TV in the living room.', 'is', 'are'],
      ]),
      // some in a positive sentence, any in a negative. No question here: «Are there some …?» is acceptable English, and
      // an offer («Would you like some …?») keeps «some», so neither is written.
      ...items('some-any', 'form', [
        ['There are some books on the desk.', 'some', 'any'],
        ['There is some bread on the table.', 'some', 'any'],
        ['We have some chairs in the garden.', 'some', 'any'],
        ['There are some flowers in the garden.', 'some', 'any'],
        ['We have some cups in the kitchen.', 'some', 'any'],
        ['There is some cheese in the fridge.', 'some', 'any'],
        ['There are some chairs in the living room.', 'some', 'any'],
        ["There aren't any chairs.", 'any', 'some'],
        ["There isn't any rice in the kitchen.", 'any', 'some'],
        ["There aren't any plants in our house.", 'any', 'some'],
        ["There aren't any windows in the bathroom.", 'any', 'some'],
        ["I don't have any brothers.", 'any', 'some'],
        ["There aren't any rugs in my room.", 'any', 'some'],
        ["There aren't any lamps in the kitchen.", 'any', 'some'],
      ]),
      // Questions and negatives are decided by agreement with the noun after them (a singular or uncountable noun takes
      // Is there / isn't, a plural takes Are there / aren't), never by word order alone.
      ...items('questions-negatives', 'form', [
        ['Are there any books on the shelf?', 'Are there', 'Is there'],
        ['Is there a park near your house?', 'Is there', 'Are there'],
        ['Are there any chairs in the kitchen?', 'Are there', 'Is there'],
        ['Is there any milk in the fridge?', 'Is there', 'Are there'],
        ['Is there a garden behind the house?', 'Is there', 'Are there'],
        ['Are there two beds in your room?', 'Are there', 'Is there'],
        ["There isn't a sofa in my room.", "isn't", "aren't"],
        ["There aren't many shops near our house.", "aren't", "isn't"],
        ["There isn't a lift in our building.", "isn't", "aren't"],
        ["There isn't a bathroom downstairs.", "isn't", "aren't"],
        ['How many beds are there in your room?', 'are', 'is'],
        ['Is there any water in the bottle?', 'Is there', 'Are there'],
      ]),
    ],
  },
  {
    lessonId: L('u2_l3'),
    statement: "I can use can and can't to talk about household chores.",
    items: [
      // can or can't + the base verb: no «to», no -s, no -ing. The distractor adds one of them.
      ...items('can-form', 'form', [
        ['She can cook dinner.', 'can cook', 'can cooks'],
        ['He can wash the car.', 'can wash', 'can washes'],
        ['I can help my mother.', 'can help', 'can to help'],
        ['We can clean the kitchen.', 'can clean', 'can cleaning'],
        ['My brother can fix the bike.', 'can fix', 'can fixes'],
        ['They can carry the bags.', 'can carry', 'can to carry'],
        ['My sister can wash the dishes.', 'can wash', 'can washes'],
        ['Dad can paint the wall.', 'can paint', 'can to paint'],
        ['I can make the beds.', 'can make', 'can makes'],
        ['She can sweep the floor.', 'can sweep', 'can sweeps'],
        ['We can tidy our room.', 'can tidy', 'can tidies'],
        ["Mum can't lift the heavy table.", "can't lift", "can't lifts"],
        ["I can't iron my shirt.", "can't iron", "can't irons"],
        ['He can take out the rubbish.', 'can take', 'can takes'],
      ]),
      // A question starts with Can + subject + base verb. The distractor is «Do you can», an added «to» or a verb with -s.
      ...items('can-questions', 'form', [
        ['Can you wash the car?', 'Can you', 'Do you can'],
        ['Can she cook dinner?', 'Can she', 'Does she can'],
        ['Can your brother fix the bike?', 'Can your brother fix', 'Can your brother fixes'],
        ['Can they help me today?', 'Can they', 'Do they can'],
        ['Can he carry the bags?', 'Can he carry', 'Can he to carry'],
        ['Can you open the window?', 'Can you open', 'Can you to open'],
        ['Can we clean the kitchen now?', 'Can we', 'Do we can'],
        ['Can I help you?', 'Can I', 'Do I can'],
        ['Can your sister make the beds?', 'Can your sister', 'Does your sister can'],
        ['Can she sweep the floor?', 'Can she sweep', 'Can she sweeps'],
        ['Can the children tidy the room?', 'Can the children', 'Do the children can'],
        ['Can you take out the rubbish?', 'Can you take', 'Can you takes'],
      ]),
      // MEANING: both modals are grammatical, and the clause with «so» or «but» is what rules one out: a reason that makes
      // the chore impossible (so ... can't), possible (so ... can), or a contrast (can ..., but ... can't). The reviewer
      // must be able to name the word that excludes the distractor.
      ...items('can-vs-cant', 'meaning', [
        ["He is three, so he can't wash dishes.", "can't", 'can'],
        ['She is strong, so she can carry boxes.', 'can', "can't"],
        ["My hand hurts, so I can't wash the dishes.", "can't", 'can'],
        ['I have a broom, so I can sweep.', 'can', "can't"],
        ["The baby is asleep, so I can't vacuum now.", "can't", 'can'],
        ["It is raining, so I can't dry clothes outside.", "can't", 'can'],
        ["The oven is broken, so Mum can't bake today.", "can't", 'can'],
        ['I am tall, so I can reach the shelf.', 'can', "can't"],
        ["Mum is busy today, so she can't make dinner.", "can't", 'can'],
        ["He can wash cars, but he can't paint walls.", "can't", 'can'],
        ["She can iron shirts, but she can't sew buttons.", "can't", 'can'],
        ["The box is heavy, so I can't lift it.", "can't", 'can'],
        ['Dad has a ladder, so he can clean windows.', 'can', "can't"],
        ['The room is empty, so we can play here.', 'can', "can't"],
      ]),
    ],
  },
  {
    lessonId: L('u3_l1'),
    statement: 'I can use countable and uncountable nouns to talk about diets.',
    items: [
      // After a number or many a countable noun is plural; the distractor is the singular. No «some» before the noun,
      // because «some tomato» is acceptable English, and no spelling distractor (only the spelling sub-topics have one).
      ...items('plural-nouns', 'form', [
        ['I need three apples.', 'apples', 'apple'],
        ['My brother eats two eggs for breakfast.', 'eggs', 'egg'],
        ['There are five oranges in the bag.', 'oranges', 'orange'],
        ['My mother buys six bananas.', 'bananas', 'banana'],
        ['He eats two sandwiches at lunch.', 'sandwiches', 'sandwich'],
        ['We need four tomatoes.', 'tomatoes', 'tomato'],
        ['She cuts three carrots for the soup.', 'carrots', 'carrot'],
        ['He eats five dates every day.', 'dates', 'date'],
        ['We buy ten potatoes every week.', 'potatoes', 'potato'],
        ['There are many lemons in the garden.', 'lemons', 'lemon'],
        ['We have three meals a day.', 'meals', 'meal'],
        ['Two children are eating lunch.', 'children', 'child'],
      ]),
      // Only nouns with no ordinary plural (milk, rice, bread, meat, butter, cheese, water): never sugar, fruit, paper,
      // chicken, coffee, tea, cake, glass or juice, which a teacher could use in the plural or with «a». The distractor is
      // «a» before the noun, or the plural verb with it.
      ...items('uncountable', 'form', [
        ['Mum buys some rice every week.', 'some rice', 'a rice'],
        ['Mum cooks some meat for lunch.', 'some meat', 'a meat'],
        ['She eats some bread at breakfast.', 'some bread', 'a bread'],
        ['He buys some meat on Fridays.', 'some meat', 'a meat'],
        ['Dad puts some butter in the pan.', 'some butter', 'a butter'],
        ['Add some butter to the rice.', 'some butter', 'a butter'],
        ['Milk is good for you.', 'is', 'are'],
        ['The water is cold.', 'is', 'are'],
        ['Rice is cheap here.', 'is', 'are'],
        ['The meat is fresh today.', 'is', 'are'],
        ['Butter is yellow.', 'is', 'are'],
        ['The bread is on the table.', 'is', 'are'],
        ['The cheese is in the fridge.', 'is', 'are'],
        ['I put some butter on my bread.', 'some butter', 'a butter'],
      ]),
      // a before a consonant sound and an before a vowel sound with a singular noun; some with a plural or an uncountable
      // noun. The distractor is the wrong one of the three, never «some» before a singular countable noun, and never «a» or
      // «an» before a drink or cheese (milk, water, juice, coffee, tea, cheese): «a milk», «a water» mean a serving and are
      // ordinary English. A / an before rice, meat, butter or bread, or before a plural, is wrong without argument.
      ...items('a-an-some', 'form', [
        ['She eats some grapes after lunch.', 'some', 'a'],
        ['We need some rice.', 'some', 'a'],
        ['I eat an apple every day.', 'an', 'a'],
        ['She has a sandwich for lunch.', 'a', 'an'],
        ['He eats an egg for breakfast.', 'an', 'a'],
        ['I want an orange.', 'an', 'a'],
        ['Dad buys a watermelon.', 'a', 'an'],
        ['I want some bread.', 'some', 'a'],
        ['She buys some apples every week.', 'some', 'an'],
        ['We eat some dates after dinner.', 'some', 'a'],
        ['He eats some nuts at night.', 'some', 'a'],
        ['My sister has a pear for lunch.', 'a', 'an'],
        ['Please give me some meat.', 'some', 'an'],
        ['She eats an onion with lunch.', 'an', 'a'],
      ]),
    ],
  },
];
