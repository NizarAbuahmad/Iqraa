/**
 * The drawing format, as the exam and lesson prompts describe it to the model.
 * Every number comes from `FIGURE_LIMITS`, so the prompt cannot drift from the
 * gate; the examples are tested against the gate.
 */
import { FIGURE_LIMITS as L } from "@workspace/figure";

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
