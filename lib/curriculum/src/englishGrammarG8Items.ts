/**
 * Grade 8 grammar items for the English corner: the authored Semester 1 lessons whose book statement is a grammar topic
 * (spec: docs/superpowers/specs/2026-11-04-english-corner-grammar-g8-s1-design.md). Every item is a whole sentence with
 * its correct answer and a distractor, written by us and checked by a teacher on the printed form; nothing here is pictured.
 *
 * The rule for a distractor: it is `form` (ungrammatical in standard English: the bare verb or a wrong -s, the wrong
 * auxiliary or agreement, `to` or -ing after a modal, an adverb in a position English does not allow, the wrong be-form,
 * `some` in a negative, `a` with an uncountable noun, a past form after `did`, a Continuous of a stative verb, a misspelt
 * inflection in the spelling sub-topics only) or `meaning` (grammatical, but excluded by a word in the sentence itself: a
 * `so` or `but` clause that states why someone can or can't do a chore, a habit word or a now word that decides Simple
 * against Continuous, a past time word that rules out the present). Never a form that could fit, and `meaning` only in
 * the sub-topics the test pins as `meaning`.
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
  {
    lessonId: L('u3_l4'),
    statement: 'I can use quantifiers to talk about amounts.',
    items: [
      // many goes with a countable plural, much with an uncountable noun; both only in a negative sentence or a question
      // here (a lot of is the positive form), so no row has «much» in a positive. The distractor is the other word, which
      // cannot stand before that kind of noun («many milk», «much eggs»).
      ...items('much-many', 'form', [
        ["There aren't many eggs.", 'many', 'much'],
        ["We don't have much milk.", 'much', 'many'],
        ['Do you have many friends?', 'many', 'much'],
        ["I don't have much money.", 'much', 'many'],
        ["There aren't many chairs in the room.", 'many', 'much'],
        ['Is there much traffic in Amman?', 'much', 'many'],
        ["She doesn't eat much rice.", 'much', 'many'],
        ['Are there many shops near here?', 'many', 'much'],
        ["He doesn't drink much water.", 'much', 'many'],
        ["They don't have many books.", 'many', 'much'],
        ["We don't have much time today.", 'much', 'many'],
        ['Are there many students in your class?', 'many', 'much'],
        ["There isn't much bread left.", 'much', 'many'],
        ["I don't have much homework today.", 'much', 'many'],
      ]),
      // a few before a countable plural, a little before an uncountable noun; the distractor is the other, which cannot
      // stand before that noun («a few milk», «a little eggs»).
      ...items('a-few-a-little', 'form', [
        ['I have a little milk.', 'a little', 'a few'],
        ['She has a few friends in Aqaba.', 'a few', 'a little'],
        ['We need a little rice.', 'a little', 'a few'],
        ['There are a few eggs in the fridge.', 'a few', 'a little'],
        ['Add a little salt to the soup.', 'a little', 'a few'],
        ['He has a few books on his desk.', 'a few', 'a little'],
        ['I have a little time after school.', 'a little', 'a few'],
        ['Mum bought a few tomatoes.', 'a few', 'a little'],
        ['There is a little water in the glass.', 'a little', 'a few'],
        ['A few students are late today.', 'A few', 'A little'],
        ['Dad puts a little honey on his bread.', 'a little', 'a few'],
        ['We have a few apples left.', 'a few', 'a little'],
        ['My sister has a little homework.', 'a little', 'a few'],
        ['I see a few cars outside.', 'a few', 'a little'],
      ]),
      // How many + a plural, How much + an uncountable noun. No price question («How much are the eggs?» is correct with a
      // plural), so every row asks for an amount of the noun itself.
      ...items('how-much-how-many', 'form', [
        ['How many apples do we need?', 'many', 'much'],
        ['How much milk do you drink?', 'much', 'many'],
        ['How many students are in your class?', 'many', 'much'],
        ['How much water is in the bottle?', 'much', 'many'],
        ['How many rooms are there in your house?', 'many', 'much'],
        ['How much rice does Mum cook?', 'much', 'many'],
        ['How many eggs do you want?', 'many', 'much'],
        ['How much homework do you have?', 'much', 'many'],
        ['How many books are on the shelf?', 'many', 'much'],
        ['How much time do we have?', 'much', 'many'],
        ['How many brothers do you have?', 'many', 'much'],
        ['How much cheese is in the sandwich?', 'much', 'many'],
      ]),
    ],
  },
  {
    lessonId: L('u4_l1'),
    statement: 'I can use the Present Continuous to talk about things happening now or temporary situations.',
    items: [
      // am, is or are + the -ing form: the be-form agrees with the subject. The distractor drops be, uses the wrong be-form,
      // or puts the verb after is in the plain -s form. Never «is read», which is a grammatical passive.
      ...items('be-v-ing', 'form', [
        ['She is reading a book.', 'is reading', 'reading'],
        ['They are playing football now.', 'are playing', 'is playing'],
        ['I am doing my homework.', 'am doing', 'are doing'],
        ['He is washing the car.', 'is washing', 'are washing'],
        ['We are cooking dinner.', 'are cooking', 'cooking'],
        ['My brother is sleeping.', 'is sleeping', 'are sleeping'],
        ['The students are writing a test.', 'are writing', 'is writing'],
        ['Mum is making tea.', 'is making', 'is makes'],
        ['I am listening to music.', 'am listening', 'listening'],
        ['The birds are singing outside.', 'are singing', 'is singing'],
        ['She is eating an apple.', 'is eating', 'is eats'],
        ['The children are drawing pictures.', 'are drawing', 'is drawing'],
        ['Dad is driving to work now.', 'is driving', 'driving'],
        ['You are studying English.', 'are studying', 'is studying'],
      ]),
      // The spelling of the -ing form: double the last consonant (running, getting, stopping, shopping, cutting, swimming),
      // drop the silent e (making, writing, having, taking, coming), ie becomes y (dying). The distractor is the misspelt
      // form. A distractor that is another English word (siting, planing, hoping) is never used.
      ...items('spelling-ing', 'form', [
        ['He is running now.', 'running', 'runing'],
        ['She is making a cake.', 'making', 'makeing'],
        ['I am writing a letter.', 'writing', 'writeing'],
        ['She is cutting the bread.', 'cutting', 'cuting'],
        ['They are swimming in the sea.', 'swimming', 'swiming'],
        ['The flowers are dying.', 'dying', 'dieing'],
        ['Dad is getting ready for work.', 'getting', 'geting'],
        ['We are having lunch now.', 'having', 'haveing'],
        ['She is taking a photo.', 'taking', 'takeing'],
        ['The bus is coming now.', 'coming', 'comeing'],
        ['He is stopping the car.', 'stopping', 'stoping'],
        ['Mum is shopping in Amman.', 'shopping', 'shoping'],
      ]),
      // Questions start with Is, Are or Am; negatives take n't or not after be. The distractor puts a do-auxiliary in front
      // of the -ing form, which English never does. No twin is a question in another word order.
      ...items('questions-negatives', 'form', [
        ['Is she sleeping?', 'Is she sleeping', 'Does she sleeping'],
        ['Are they playing outside?', 'Are they playing', 'Do they playing'],
        ["It isn't raining now.", "isn't raining", "don't raining"],
        ['Is your father working today?', 'Is your father working', 'Does your father working'],
        ["We aren't watching TV.", "aren't watching", "don't watching"],
        ['Are you listening to me?', 'Are you listening', 'Do you listening'],
        ["He isn't wearing a coat.", "isn't wearing", "doesn't wearing"],
        ['What are you doing now?', 'are you doing', 'do you doing'],
        ['Where is she going?', 'is she going', 'does she going'],
        ['I am not sleeping.', 'am not sleeping', 'do not sleeping'],
        ['Is the baby crying?', 'Is the baby crying', 'Does the baby crying'],
        ["They aren't studying now.", "aren't studying", "don't studying"],
        ['Are the children eating?', 'Are the children eating', 'Do the children eating'],
        ['Why is he laughing?', 'is he laughing', 'does he laughing'],
      ]),
    ],
  },
  {
    lessonId: L('u4_l3'),
    statement: 'I can use the Present Simple and the Present Continuous to talk about regular actions and activities happening now/temporary situations.',
    items: [
      // MEANING: both tenses are grammatical, and a habit word (every day, every morning, on Fridays, often, usually,
      // rarely) is what rules the Continuous out. Never «always» or «this week»: both fit either tense.
      ...items('habit-markers', 'meaning', [
        ['We play chess every day.', 'play', 'are playing'],
        ['She walks to school every morning.', 'walks', 'is walking'],
        ['The sun rises in the east every morning.', 'rises', 'is rising'],
        ['I brush my teeth every night.', 'brush', 'am brushing'],
        ['He rarely eats fish.', 'rarely eats', 'is rarely eating'],
        ['Dad reads the news every evening.', 'reads', 'is reading'],
        ['The school bus leaves at seven every day.', 'leaves', 'is leaving'],
        ['We often eat lunch at school.', 'often eat', 'are often eating'],
        ['Mum cooks rice every week.', 'cooks', 'is cooking'],
        ['My sister usually wakes up at six.', 'usually wakes', 'is usually waking'],
        ['I wash my hands before every meal.', 'wash', 'am washing'],
        ['The moon goes round the Earth every month.', 'goes', 'is going'],
      ]),
      // MEANING: a now word (now, right now, Look!, Listen!, at the moment) is what rules the Simple out. Where the text has
      // two sentences the answer sits in the second one.
      ...items('now-markers', 'meaning', [
        ['Look! It is raining.', 'is raining', 'rains'],
        ['Listen! The baby is crying.', 'is crying', 'cries'],
        ['Dad is cooking dinner right now.', 'is cooking', 'cooks'],
        ['We are studying at the moment.', 'are studying', 'study'],
        ['Look! The children are running.', 'are running', 'run'],
        ['I am reading a book right now.', 'am reading', 'read'],
        ['Listen! Someone is knocking at the door.', 'is knocking', 'knocks'],
        ['My sister is sleeping at the moment.', 'is sleeping', 'sleeps'],
        ['Look! The bus is coming.', 'is coming', 'comes'],
        ['The students are writing a test right now.', 'are writing', 'write'],
        ['Mum is washing the car at the moment.', 'is washing', 'washes'],
        ['He is playing football in the garden right now.', 'is playing', 'plays'],
      ]),
      // A stative verb (like, know, need, believe, own, belong, prefer) has no Continuous: the distractor is the
      // Continuous of the verb. Never love, hate or have: «I am loving it» and «I am having lunch» are ordinary English.
      ...items('stative-verbs', 'form', [
        ['I like pizza.', 'like', 'am liking'],
        ['She knows the answer.', 'knows', 'is knowing'],
        ['We need a new table.', 'need', 'are needing'],
        ['We believe the teacher.', 'believe', 'are believing'],
        ['Dad owns a small shop.', 'owns', 'is owning'],
        ['This book belongs to my sister.', 'belongs', 'is belonging'],
        ['I know your brother.', 'know', 'am knowing'],
        ['Mum prefers fish to meat.', 'prefers', 'is preferring'],
      ]),
      // Questions in either tense, decided by the auxiliary: Do or Does with the base verb, Is or Are with the -ing form.
      // The distractor puts the wrong auxiliary in front, which makes an ungrammatical question.
      ...items('questions', 'form', [
        ['Do you play chess every day?', 'Do you play', 'Are you play'],
        ['Are you listening to me now?', 'Are you listening', 'Do you listening'],
        ['Does she walk to school every day?', 'Does she walk', 'Is she walk'],
        ['Is he sleeping at the moment?', 'Is he sleeping', 'Does he sleeping'],
        ['What are you eating now?', 'are you eating', 'do you eating'],
        ['Does your father work on Fridays?', 'Does your father work', 'Is your father work'],
        ['Where do you go on Fridays?', 'do you go', 'are you go'],
        ['Are the children playing outside now?', 'Are the children playing', 'Do the children playing'],
      ]),
    ],
  },
  {
    lessonId: L('u5_l1'),
    statement: 'I can use the Past Simple to talk about the past.',
    items: [
      // The regular -ed, with the spelling rules (-ied after a consonant and y, a doubled consonant, -d after e). The
      // distractor is the base form after a singular subject (which is ungrammatical, so never after «they» or «we»), a
      // misspelt -ed, or «did» with the -ed form.
      ...items('regular-ed', 'form', [
        ['She walked to school.', 'walked', 'walk'],
        ['He studied English at home.', 'studied', 'studyed'],
        ['The bus stopped at the corner.', 'stopped', 'stoped'],
        ['We cleaned the kitchen after dinner.', 'cleaned', 'did cleaned'],
        ['My mother cooked rice for lunch.', 'cooked', 'cook'],
        ['He carried the heavy bag.', 'carried', 'carryed'],
        ['They played football after school.', 'played', 'plaied'],
        ['She danced at the party.', 'danced', 'danceed'],
        ['Dad dropped me at school.', 'dropped', 'droped'],
        ['He tried to open the door.', 'tried', 'tryed'],
        ['We visited our aunt in Aqaba.', 'visited', 'visitted'],
        ['The baby cried all night.', 'cried', 'cryed'],
      ]),
      // The second form of an irregular verb. The distractor is the regularised form (goed, eated), or the base form after a
      // singular subject, which is ungrammatical. Never «sawed» for saw, which is a real verb form.
      ...items('irregular', 'form', [
        ['We went to the park.', 'went', 'goed'],
        ['She saw her friend at school.', 'saw', 'see'],
        ['We had lunch at one.', 'had', 'haved'],
        ['He ate two sandwiches.', 'ate', 'eated'],
        ['Mum took the bus to work.', 'took', 'taked'],
        ['The dog ran across the road.', 'ran', 'runned'],
        ['My cousin came from Irbid.', 'came', 'comed'],
        ['She wrote a letter to her aunt.', 'wrote', 'writed'],
        ['Dad bought a new car.', 'bought', 'buyed'],
        ['We met our teacher in the park.', 'met', 'meeted'],
        ['I gave my pen to my brother.', 'gave', 'gived'],
        ['They drank some water.', 'drank', 'drinked'],
        ['He made a cake for Mum.', 'made', 'make'],
        ['I got a new bag.', 'got', 'getted'],
      ]),
      // MEANING: a past time word (yesterday, last week, last night, two days ago) rules the present form out. The
      // distractor is the Present Simple of the same verb; the sentence has no other tense clue.
      ...items('past-time-markers', 'meaning', [
        ['She visited her aunt yesterday.', 'visited', 'visits'],
        ['We played football last week.', 'played', 'play'],
        ['I watched a film two days ago.', 'watched', 'watch'],
        ['Dad bought a new car last year.', 'bought', 'buys'],
        ['My brother went to Aqaba last summer.', 'went', 'goes'],
        ['They cleaned the house yesterday morning.', 'cleaned', 'clean'],
        ['He ate fish for dinner last night.', 'ate', 'eats'],
        ['Mum cooked rice an hour ago.', 'cooked', 'cooks'],
        ['We saw a film last Friday.', 'saw', 'see'],
        ['The students had a test yesterday.', 'had', 'have'],
        ['I finished my homework ten minutes ago.', 'finished', 'finish'],
        ['Our teacher came late last Monday.', 'came', 'comes'],
        ['She wrote a letter three days ago.', 'wrote', 'writes'],
        ['We stayed at home last night.', 'stayed', 'stay'],
      ]),
    ],
  },
  {
    lessonId: L('u5_l4'),
    statement: 'I can use the Past Simple to ask questions and give affirmative or negative answers.',
    items: [
      // Did + subject + the base verb. The distractor keeps the past form after the auxiliary (Did you saw), or swaps the
      // auxiliary for a present one (Do you saw): neither is English. No twin is a question in another word order.
      ...items('did-questions', 'form', [
        ['Did you see the film?', 'Did you see', 'Did you saw'],
        ['Did she go to Aqaba?', 'Did she go', 'Did she went'],
        ['Did they play football?', 'Did they play', 'Do they played'],
        ['Did your brother eat lunch?', 'Did your brother eat', 'Did your brother ate'],
        ['Did he buy a new bag?', 'Did he buy', 'Does he bought'],
        ['Did the children finish the homework?', 'Did the children finish', 'Did the children finished'],
        ['Did you write a letter?', 'Did you write', 'Did you wrote'],
        ['Did Mum cook dinner?', 'Did Mum cook', 'Did Mum cooked'],
        ['Did we have a test last week?', 'Did we have', 'Did we had'],
        ['Did your uncle come to the party?', 'Did your uncle come', 'Did your uncle came'],
        ['Did the bus arrive on time?', 'Did the bus arrive', 'Did the bus arrived'],
        ['Did you meet your teacher?', 'Did you meet', 'Do you met'],
        ['Did she take her bag?', 'Did she take', 'Did she took'],
        ['Did they visit Petra?', 'Did they visit', 'Did they visited'],
      ]),
      // didn't + the base verb. The distractor keeps the past form after didn't (didn't went), or uses «not» with the past
      // form and no auxiliary («Dad not drove»), which English does not have.
      ...items('didnt-negatives', 'form', [
        ["He didn't go to school.", "didn't go", "didn't went"],
        ["We didn't see the film.", "didn't see", "didn't saw"],
        ["She didn't eat breakfast.", "didn't eat", "didn't ate"],
        ["I didn't buy any milk.", "didn't buy", "didn't bought"],
        ["They didn't play football yesterday.", "didn't play", "didn't played"],
        ["Mum didn't cook dinner.", "didn't cook", "didn't cooked"],
        ["My brother didn't do his homework.", "didn't do", "didn't did"],
        ["The bus didn't stop here.", "didn't stop", 'not stopped'],
        ["We didn't have a lesson today.", "didn't have", "didn't had"],
        ["She didn't come to the party.", "didn't come", "didn't came"],
        ["I didn't write a letter.", "didn't write", "didn't wrote"],
        ["Dad didn't drive to work.", "didn't drive", 'not drove'],
        ["The students didn't finish the test.", "didn't finish", "didn't finished"],
        ["He didn't take his bag.", "didn't take", "didn't took"],
      ]),
      // A wh-word + did + subject + the base verb. The distractor keeps the past form after did, uses a present auxiliary with
      // it, or leaves the auxiliary out (a question with no auxiliary is ungrammatical here; never a question in another
      // word order).
      ...items('wh-did', 'form', [
        ['Where did she go?', 'did she go', 'did she went'],
        ['What did you eat for lunch?', 'did you eat', 'did you ate'],
        ['When did the lesson start?', 'did the lesson start', 'did the lesson started'],
        ['Why did he leave early?', 'did he leave', 'did he left'],
        ['Who did you see at the party?', 'did you see', 'do you saw'],
        ['How did they get to school?', 'did they get', 'did they got'],
        ['What did Mum buy yesterday?', 'did Mum buy', 'does Mum bought'],
        ['Where did your father work?', 'did your father work', 'your father worked'],
        ['Which bus did you take?', 'did you take', 'did you took'],
        ['What time did the film finish?', 'did the film finish', 'the film finished'],
        ['How did you learn English?', 'did you learn', 'did you learned'],
        ['Why did they close the shop?', 'did they close', 'did they closed'],
      ]),
    ],
  },
];
