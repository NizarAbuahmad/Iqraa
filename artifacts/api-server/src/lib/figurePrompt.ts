/**
 * The drawing format, as the exam and lesson prompts describe it to the model.
 * Every number comes from `FIGURE_LIMITS`, so the prompt cannot drift from the
 * gate; the examples are tested against the gate.
 */
import { FIGURE_LIMITS as L, PHYSICS_UNITS, SCENE_LIMITS as S } from "@workspace/figure";

const EXAMPLES = [
  '{"kind":"function-graph","functions":[{"expr":"x^2 - 4","label":"f"}],"x":[-3,3],"points":[{"at":1,"label":"A"}]}',
  '{"kind":"vectors","vectors":[{"from":[0,0],"to":[3,2],"label":"u"},{"from":[0,0],"to":[-1,2.5],"label":"v"}],"components":true}',
];

export function figureFormatEn(): string {
  return [
    "A drawing is one of two kinds. A drawing outside these limits is dropped whole and the text stands alone:",
    `- "function-graph": {"kind","functions":[{"expr","label"}] (1 to ${L.maxFunctions}; expr is Latin, in x, using numbers only (no pi, no e), + - * / ^ ( ) and sin/cos/tan in radians, at most ${L.maxExprChars} characters, values below ${L.maxSampleAbs} in magnitude), "x":[from,to] (width ${L.minXWidth} to ${L.maxXWidth}), optional "y":[from,to] (height ${L.minYHeight} to ${L.maxYHeight}), optional "points":[{"at": an x value inside "x","label"}] (at most ${L.maxPoints}; the point is placed on the FIRST function's curve, you give only x, and it must fall inside "y" when "y" is given; mark only a point the question names, never the answer: not a root, vertex or intercept the question asks for)}.`,
    `- "vectors": {"kind","vectors":[{"from":[x,y],"to":[x,y],"label"}] (1 to ${L.maxVectors}; every coordinate a multiple of 0.5 with absolute value at most ${L.maxCoord}), optional "components": true (dashed horizontal and vertical parts)}.`,
    "Never repeat a function (the same expr) or a vector (the same from and to) in one drawing, and never reuse a label.",
    "A label is 1 to 3 letters, optionally followed by one digit or a prime (A, u, f, v1, B'). Never put a value, coordinates or an equation in a label, and never a word that names a number (six, ten): the drawing is shown to the student and must not give the answer away.",
    "Examples:",
    ...EXAMPLES,
  ].join("\n");
}

export function figureFormatAr(): string {
  return [
    "الرسم من نوعين، والرسم الذي يتجاوز هذه الحدود يُحذف كاملًا فيبقى النص وحده:",
    `- "function-graph": {"kind","functions":[{"expr","label"}] (من 1 إلى ${L.maxFunctions}؛ expr بالأحرف اللاتينية بدلالة x وتستعمل + - * / ^ ( ) و sin/cos/tan بالراديان وبأعداد فقط (دون pi أو e)، بحدٍّ أقصى ${L.maxExprChars} حرفًا، وقيمها أقل من ${L.maxSampleAbs} بالقيمة المطلقة)، "x":[من,إلى] (العرض من ${L.minXWidth} إلى ${L.maxXWidth})، و"y":[من,إلى] اختياري (الارتفاع من ${L.minYHeight} إلى ${L.maxYHeight})، و"points":[{"at": قيمة x داخل "x","label"}] اختياري (حتى ${L.maxPoints}؛ تُوضع النقطة على منحنى الاقتران الأول وأنت تعطي x فقط، ويجب أن تقع داخل "y" إن ذُكر؛ علّم نقطةً ذكرها السؤال فقط ولا تعلّم الإجابة: لا جذرًا ولا رأسًا ولا نقطة تقاطع يطلبها السؤال)}.`,
    `- "vectors": {"kind","vectors":[{"from":[x,y],"to":[x,y],"label"}] (من 1 إلى ${L.maxVectors}؛ كل إحداثي من مضاعفات 0.5 وقيمته المطلقة ${L.maxCoord} على الأكثر)، و"components": true اختياري (الجزآن الأفقي والرأسي بخط متقطع)}.`,
    "لا تكرّر اقترانًا (expr نفسه) ولا متجهًا (from و to نفسهما) في الرسم الواحد، ولا تستعمل الوسم نفسه مرتين.",
    "الوسم من 1 إلى 3 أحرف، ويجوز أن يليها رقم واحد أو شرطة عليا (A، u، f، v1، B'). لا تكتب في الوسم قيمةً أو إحداثيات أو معادلة، ولا كلمة تدل على عدد (ستة، عشر، six): الرسم يُعرض على الطالب ويجب ألّا يكشف الإجابة.",
    "أمثلة:",
    ...EXAMPLES,
  ].join("\n");
}

/** One example per kind, in the order the format lists them. Tested against the gate. */
export const PHYSICS_FIGURE_EXAMPLES = [
  '{"kind":"forces","body":"block","incline":30,"arrows":[{"dir":270,"size":3,"label":"W","value":{"n":49,"unit":"N"}},{"dir":120,"size":2,"label":"N"},{"dir":210,"size":1,"label":"f"}]}',
  '{"kind":"attraction","bodies":["m1","m2"],"force":"F","distance":{"label":"r","value":{"n":2,"unit":"m"}}}',
  '{"kind":"projectile","launch":"ground","angle":30,"speed":{"n":20,"unit":"m/s"},"marks":["v0","H","R"]}',
  '{"kind":"circular","radius":{"label":"r","value":{"n":0.5,"unit":"m"}},"turning":"ccw","arrows":["v","F"]}',
  '{"kind":"wave","cycles":2,"marks":["crest","trough","A","lambda"]}',
  '{"kind":"vectors","vectors":[{"from":[0,0],"to":[3,0],"label":"A"},{"from":[0,0],"to":[0,4],"label":"B"}]}',
] as const;

/**
 * The physics drawing format. Every number comes from `SCENE_LIMITS` / `FIGURE_LIMITS`
 * and the units from `PHYSICS_UNITS`, so the prompt cannot promise what the gate refuses.
 */
export function physicsFigureFormatEn(): string {
  return [
    "A drawing is one of six kinds. A drawing outside these limits is dropped whole and the question keeps only its text:",
    `- "forces": {"kind","body":"block" or "point","incline": optional, whole degrees ${S.minIncline} to ${S.maxIncline} (a block on a slope; "block" only),"arrows":[{"dir": whole degrees 0 to 359, counter-clockwise from the right (270 is straight down),"size": 1, 2 or 3 (relative strength),"label","value": optional}] (1 to ${S.maxArrows}; no two arrows less than ${S.minArrowGap}° apart; weight points 270, a normal force is perpendicular to the surface)}.`,
    `- "attraction": {"kind","bodies":[label,label],"force": label,"distance": optional {"label","value": optional}}.`,
    `- "projectile": {"kind","launch":"ground" (needs "angle", whole degrees ${S.minAngle} to ${S.maxAngle}) or "horizontal" (off a height: no "angle", optional "height" value),"speed": optional value (needs "v0" in "marks"),"marks": any of "v0","vx","vy","H","R" ("H" never with "horizontal"; "H" and "R" never carry a value: they are what questions ask for)}.`,
    `- "circular": {"kind","turning":"cw" or "ccw","arrows": one or two of "v","F","a" ("F" and "a" never together),"radius": optional {"label","value": optional}}.`,
    `- "wave": {"kind","cycles": 1 to ${S.maxCycles},"marks": any of "crest","trough","A","lambda"; "second": optional {"phase":"in" or "out","sum": false} (a second wave drawn with the first),"amplitude" and "wavelength": optional values}.`,
    `- "vectors": {"kind","vectors":[{"from":[x,y],"to":[x,y],"label"}] (1 to ${L.maxVectors}; every coordinate a multiple of 0.5 with absolute value at most ${L.maxCoord}), optional "components": true}. It is drawn on a numbered grid, so the question must state every non-zero coordinate of each end point and every non-zero component; draw vectors from [0,0] unless the question gives their positions, and never draw a vector that is a sum or difference of drawn vectors, or the negative of their sum.`,
    `A value is {"n": a number from 0 to ${S.maxValue} with at most ${S.valueDecimals} decimals,"unit": one of ${PHYSICS_UNITS.join(", ")}}, printed in Latin as written.`,
    "A label is 1 to 3 letters (Latin, Arabic, or one of λ θ α β ω Δ μ), optionally followed by one digit or a prime (F, N, m1, v0, θ). Never a value or a word that names a number.",
    "Never repeat a vector (the same from and to) or draw one of zero length, and never use one label twice in one drawing; in \"attraction\" the two bodies and the force have three different labels.",
    "Every number the drawing shows (a value, an angle, an incline) must appear in the question text, with the same value. Never put on the drawing the quantity the question asks for: a drawing that prints a number the question does not state is dropped.",
    "Never draw a resultant or net force, an equilibrant, or the sum of two waves: those are what questions ask for.",
    "Examples:",
    ...PHYSICS_FIGURE_EXAMPLES,
  ].join("\n");
}

export function physicsFigureFormatAr(): string {
  return [
    "الرسم من ستة أنواع، والرسم الذي يتجاوز هذه الحدود يُحذف كاملًا ويبقى للسؤال نصه وحده:",
    `- "forces": {"kind"، "body": "block" أو "point"، و"incline" اختياري بالدرجات الصحيحة من ${S.minIncline} إلى ${S.maxIncline} (جسم على سطح مائل؛ مع "block" فقط)، و"arrows":[{"dir": بالدرجات الصحيحة من 0 إلى 359 عكس اتجاه عقارب الساعة بدءًا من اليمين (270 إلى الأسفل مباشرة)، "size": 1 أو 2 أو 3 (المقدار النسبي)، "label"، و"value" اختياري}] (من 1 إلى ${S.maxArrows}؛ ولا يقل الفرق بين اتجاهي سهمين عن ${S.minArrowGap}°؛ الوزن باتجاه 270 والقوة العمودية عمودية على السطح)}.`,
    `- "attraction": {"kind"، "bodies":[وسم، وسم]، "force": وسم، و"distance" اختياري {"label"، و"value" اختياري}}.`,
    `- "projectile": {"kind"، "launch": "ground" (يلزمه "angle" بالدرجات الصحيحة من ${S.minAngle} إلى ${S.maxAngle}) أو "horizontal" (من ارتفاع: بلا "angle"، و"height" قيمة اختيارية)، و"speed" قيمة اختيارية (يلزمها "v0" في "marks")، و"marks": أيٌّ من "v0" و"vx" و"vy" و"H" و"R" ("H" لا تأتي مع "horizontal"؛ و"H" و"R" لا تحملان قيمة أبدًا لأنهما ما تسأل عنه الأسئلة)}.`,
    `- "circular": {"kind"، "turning": "cw" أو "ccw"، و"arrows": واحد أو اثنان من "v" و"F" و"a" (لا يجتمع "F" و"a")، و"radius" اختياري {"label"، و"value" اختياري}}.`,
    `- "wave": {"kind"، "cycles": من 1 إلى ${S.maxCycles}، و"marks": أيٌّ من "crest" و"trough" و"A" و"lambda"؛ و"second" اختياري {"phase": "in" أو "out"، "sum": false} (موجة ثانية تُرسم مع الأولى)، و"amplitude" و"wavelength" قيمتان اختياريتان}.`,
    `- "vectors": {"kind"، "vectors":[{"from":[x,y]، "to":[x,y]، "label"}] (من 1 إلى ${L.maxVectors}؛ كل إحداثي من مضاعفات 0.5 وقيمته المطلقة ${L.maxCoord} على الأكثر)، و"components": true اختياري}. يُرسم على شبكة مرقّمة، فيجب أن يذكر السؤال كل إحداثي غير صفري لنهايتي كل متجه وكل مركّبة غير صفرية؛ وارسم المتجهات من [0,0] ما لم يذكر السؤال مواقعها، ولا ترسم متجهًا هو مجموع متجهات مرسومة أو الفرق بينها أو سالب مجموعها.`,
    `القيمة {"n": عدد من 0 إلى ${S.maxValue} بحدٍّ أقصى ${S.valueDecimals} منازل عشرية، "unit": واحدة من ${PHYSICS_UNITS.join("، ")}}، وتُطبع بالأحرف اللاتينية كما كُتبت.`,
    "الوسم من 1 إلى 3 أحرف (لاتينية أو عربية أو واحد من λ θ α β ω Δ μ)، ويجوز أن يليها رقم واحد أو شرطة عليا (F، N، m1، v0، θ). لا تكتب في الوسم قيمة ولا كلمة تدل على عدد.",
    "لا تكرّر متجهًا (from و to نفسهما) ولا ترسم متجهًا طوله صفر، ولا تستعمل الوسم نفسه مرتين في الرسم الواحد؛ وفي \"attraction\" يكون للجسمين وللقوة ثلاثة أوسمة مختلفة.",
    "كل عدد يظهر في الرسم (قيمة أو زاوية أو ميل) يجب أن يرد في نص السؤال بالقيمة نفسها. لا تضع في الرسم الكمية التي يطلبها السؤال: الرسم الذي يطبع عددًا لا يذكره السؤال يُحذف.",
    "لا ترسم محصلةً (لمتجهات أو لقوى) ولا قوةً موازِنة ولا مجموع موجتين: فهذه ما تسأل عنه الأسئلة.",
    "أمثلة:",
    ...PHYSICS_FIGURE_EXAMPLES,
  ].join("\n");
}
