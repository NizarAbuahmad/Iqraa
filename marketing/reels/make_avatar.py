#!/usr/bin/env python3
"""The Iqrra host — an illustrated virtual teacher («معلّمة اقرأ»), drawn as stackable SVG layers.

Every layer is one 720x800 transparent canvas in the same coordinate frame, so the compositor (`build_avatar_video.py`)
only has to stack them: body, head, hair, glasses, eyes (open / closed), brows, six mouth shapes, a waving arm and a
pointing arm. It animates them from a voice recording (mouth from loudness, blinks, a small head bob, gestures on cues).

    python3 make_avatar.py && node render_html.js avatar.html overlays_avatar 720 800

Style: flat shapes in the Iqrra palette (teal blazer, ink, the yellow highlighter as a pin). She is a character, not a
photograph, and is always labelled as a virtual presenter in the video.
"""
SKIN, SKIN_D = "#E8B48F", "#D39A74"
HAIR, HAIR_L = "#2A1B17", "#45312A"
TEAL, TEAL_D, INK, YEL = "#006D65", "#00504A", "#0B1B33", "#FFC93C"
BLAZER, LAPEL = INK, "#1A3358"      # ink blazer: it has to read against both the sand ground and the teal disc
LIP, MOUTH_IN = "#B5473E", "#5A1F24"

W, H = 720, 800
CX = 300                         # the face's centre line
EY = 300                         # eye line
MY = 382                         # mouth centre

HEAD = f"""
  <path d="M266,396 L334,396 L338,486 L262,486 Z" fill="{SKIN_D}"/>
  <path d="M262,470 Q300,500 338,470 L338,486 L262,486 Z" fill="{SKIN_D}"/>
  <ellipse cx="186" cy="306" rx="17" ry="27" fill="{SKIN}"/><ellipse cx="414" cy="306" rx="17" ry="27" fill="{SKIN}"/>
  <path d="M188,290 C188,200 240,165 300,165 C360,165 412,200 412,290 C412,370 360,432 300,432 C240,432 188,370 188,290 Z" fill="{SKIN}"/>
  <circle cx="230" cy="348" r="24" fill="#F2A38A" opacity=".33"/><circle cx="370" cy="348" r="24" fill="#F2A38A" opacity=".33"/>
  <path d="M296,318 Q288,343 304,347" fill="none" stroke="{SKIN_D}" stroke-width="5" stroke-linecap="round"/>
"""

LAYERS = {}

LAYERS["body"] = f"""
  <path d="M70,800 L70,650 C70,540 150,492 262,478 L338,478 C450,492 530,540 530,650 L530,800 Z" fill="{BLAZER}"/>
  <path d="M262,478 L300,566 L338,478 Z" fill="#fff"/>
  <path d="M262,478 L300,574 L236,650 L196,534 Z" fill="{LAPEL}"/><path d="M338,478 L300,574 L364,650 L404,534 Z" fill="{LAPEL}"/>
  <path d="M276,478 Q300,512 324,478" fill="none" stroke="{SKIN_D}" stroke-width="10"/>
  <circle cx="404" cy="604" r="11" fill="{YEL}"/><circle cx="404" cy="604" r="5" fill="{BLAZER}"/>
"""
LAYERS["hairback"] = f"""
  <path d="M168,300 C148,190 218,116 300,116 C382,116 452,190 432,300 C444,390 440,480 410,540 L190,540 C160,480 156,390 168,300 Z" fill="{HAIR}"/>
"""
LAYERS["head"] = HEAD
LAYERS["hairfront"] = f"""
  <path d="M186,272 C182,170 246,136 306,138 C384,140 420,194 414,268 C392,214 344,190 276,198 C228,204 200,236 186,272 Z" fill="{HAIR}"/>
  <path d="M232,176 C262,158 304,156 336,166" fill="none" stroke="{HAIR_L}" stroke-width="8" stroke-linecap="round" opacity=".7"/>
"""
LAYERS["glasses"] = f"""
  <circle cx="250" cy="{EY}" r="40" fill="none" stroke="{INK}" stroke-width="6"/><circle cx="350" cy="{EY}" r="40" fill="none" stroke="{INK}" stroke-width="6"/>
  <path d="M290,{EY - 4} Q300,{EY - 12} 310,{EY - 4}" fill="none" stroke="{INK}" stroke-width="6"/>
  <path d="M210,{EY - 4} L190,{EY - 10}" stroke="{INK}" stroke-width="6" stroke-linecap="round"/><path d="M390,{EY - 4} L410,{EY - 10}" stroke="{INK}" stroke-width="6" stroke-linecap="round"/>
"""
LAYERS["eyes_open"] = f"""
  <ellipse cx="250" cy="{EY}" rx="23" ry="16" fill="#fff"/><ellipse cx="350" cy="{EY}" rx="23" ry="16" fill="#fff"/>
  <circle cx="252" cy="{EY}" r="12" fill="#4B2E22"/><circle cx="352" cy="{EY}" r="12" fill="#4B2E22"/>
  <circle cx="252" cy="{EY}" r="6" fill="{INK}"/><circle cx="352" cy="{EY}" r="6" fill="{INK}"/>
  <circle cx="257" cy="{EY - 5}" r="3.6" fill="#fff"/><circle cx="357" cy="{EY - 5}" r="3.6" fill="#fff"/>
  <path d="M226,{EY - 4} Q250,{EY - 22} 274,{EY - 4}" fill="none" stroke="{HAIR}" stroke-width="5" stroke-linecap="round"/>
  <path d="M326,{EY - 4} Q350,{EY - 22} 374,{EY - 4}" fill="none" stroke="{HAIR}" stroke-width="5" stroke-linecap="round"/>
"""
LAYERS["eyes_closed"] = f"""
  <path d="M226,{EY + 2} Q250,{EY + 18} 274,{EY + 2}" fill="none" stroke="{HAIR}" stroke-width="6" stroke-linecap="round"/>
  <path d="M326,{EY + 2} Q350,{EY + 18} 374,{EY + 2}" fill="none" stroke="{HAIR}" stroke-width="6" stroke-linecap="round"/>
"""
LAYERS["brows"] = f"""
  <path d="M220,{EY - 38} Q250,{EY - 54} 280,{EY - 40}" fill="none" stroke="{HAIR}" stroke-width="9" stroke-linecap="round"/>
  <path d="M320,{EY - 40} Q350,{EY - 54} 380,{EY - 38}" fill="none" stroke="{HAIR}" stroke-width="9" stroke-linecap="round"/>
"""
# mouths, centred on (CX, MY)
LAYERS["m_closed"] = f"""<path d="M268,{MY - 6} Q300,{MY + 18} 332,{MY - 6}" fill="none" stroke="{LIP}" stroke-width="9" stroke-linecap="round"/>"""
LAYERS["m_small"] = f"""<ellipse cx="{CX}" cy="{MY}" rx="22" ry="10" fill="{MOUTH_IN}"/><path d="M278,{MY - 4} Q300,{MY - 14} 322,{MY - 4}" fill="none" stroke="{LIP}" stroke-width="7" stroke-linecap="round"/>"""
LAYERS["m_open"] = f"""
  <path d="M266,{MY - 8} Q300,{MY - 18} 334,{MY - 8} Q330,{MY + 36} 300,{MY + 36} Q270,{MY + 36} 266,{MY - 8} Z" fill="{MOUTH_IN}"/>
  <path d="M278,{MY + 22} Q300,{MY + 10} 322,{MY + 22} Q312,{MY + 34} 300,{MY + 34} Q288,{MY + 34} 278,{MY + 22} Z" fill="#D9737A"/>
  <path d="M266,{MY - 8} Q300,{MY - 18} 334,{MY - 8}" fill="none" stroke="{LIP}" stroke-width="7" stroke-linecap="round"/>"""
LAYERS["m_wide"] = f"""
  <path d="M258,{MY - 8} Q300,{MY - 20} 342,{MY - 8} Q340,{MY + 28} 300,{MY + 30} Q260,{MY + 28} 258,{MY - 8} Z" fill="{MOUTH_IN}"/>
  <path d="M268,{MY - 6} Q300,{MY - 14} 332,{MY - 6} L330,{MY + 2} Q300,{MY - 4} 270,{MY + 2} Z" fill="#fff"/>
  <path d="M258,{MY - 8} Q300,{MY - 20} 342,{MY - 8}" fill="none" stroke="{LIP}" stroke-width="7" stroke-linecap="round"/>"""
LAYERS["m_oo"] = f"""<ellipse cx="{CX}" cy="{MY + 2}" rx="14" ry="15" fill="{MOUTH_IN}"/><ellipse cx="{CX}" cy="{MY + 2}" rx="17" ry="18" fill="none" stroke="{LIP}" stroke-width="7"/>"""
LAYERS["m_smile"] = f"""
  <path d="M262,{MY - 10} Q300,{MY + 34} 338,{MY - 10} Q300,{MY + 2} 262,{MY - 10} Z" fill="{MOUTH_IN}"/>
  <path d="M270,{MY - 8} Q300,{MY + 2} 330,{MY - 8} L326,{MY - 1} Q300,{MY + 6} 274,{MY - 1} Z" fill="#fff"/>
  <path d="M262,{MY - 10} Q300,{MY + 34} 338,{MY - 10}" fill="none" stroke="{LIP}" stroke-width="7" stroke-linecap="round"/>"""

# arms. The waving arm (the viewer's left) is drawn upright, hinged at the elbow (60,690); the pointing arm (viewer's
# right) reaches across toward the phone from the shoulder (480,560).
HAND = f"""
  <rect x="-36" y="-44" width="72" height="78" rx="30" fill="{SKIN}"/>
  <rect x="-34" y="-86" width="15" height="52" rx="7.5" fill="{SKIN}"/><rect x="-16" y="-96" width="15" height="62" rx="7.5" fill="{SKIN}"/>
  <rect x="2" y="-94" width="15" height="60" rx="7.5" fill="{SKIN}"/><rect x="20" y="-82" width="15" height="48" rx="7.5" fill="{SKIN}"/>
  <rect x="-58" y="-22" width="15" height="46" rx="7.5" fill="{SKIN}" transform="rotate(-38 -50 0)"/>"""
LAYERS["arm_wave"] = f"""
  <path d="M132,566 L58,690 L84,458" fill="none" stroke="{BLAZER}" stroke-width="74" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M60,478 L112,486" stroke="#fff" stroke-width="16" stroke-linecap="round" transform="rotate(-8 84 482)"/>
  <g transform="translate(88 440) rotate(-6)">{HAND}</g>
"""
LAYERS["arm_point"] = f"""
  <path d="M470,566 L580,668 L640,600" fill="none" stroke="{BLAZER}" stroke-width="74" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M628,616 L654,590" stroke="#fff" stroke-width="16" stroke-linecap="round"/>
  <g transform="translate(676 572) rotate(52)">
    <rect x="-34" y="-34" width="68" height="72" rx="28" fill="{SKIN}"/>
    <rect x="-10" y="-94" width="20" height="66" rx="10" fill="{SKIN}"/>
    <rect x="-34" y="4" width="14" height="30" rx="7" fill="{SKIN_D}"/>
  </g>
"""

CSS = f"""*{{margin:0;padding:0}}html,body{{background:transparent}}
.o{{position:absolute;left:0;top:0;width:{W}px;height:{H}px}}svg{{display:block}}"""


def main():
    out = [f"<!doctype html><meta charset='utf-8'><style>{CSS}</style><body>"]
    for name, body in LAYERS.items():
        out.append(f'<div id="{name}" class="o"><svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{body}</svg></div>')
    open("avatar.html", "w").write("\n".join(out))
    print("wrote avatar.html,", len(LAYERS), "layers")


if __name__ == "__main__":
    main()
