# Iqrra social media covers

Cover images for the Iqrra pages on Facebook, YouTube and LinkedIn, made 2026-10-30.
Upload the files in `out/` without a suffix. The `-guides` copies show the safe
zones and are for checking only.

| Platform | File | Size | Safe zone used |
| --- | --- | --- | --- |
| Facebook Page | `iqrra-facebook-cover-1640x624.png` | 1640 × 624 (2× the 820 × 312 desktop display) | Centre 1110 px wide, which is what the phone app shows after cropping the sides. Bottom-left 420 × 154 kept clear for the profile photo on desktop. |
| YouTube channel | `iqrra-youtube-banner-2560x1440.png` | 2560 × 1440 | All copy and the logo sit inside the centre **1546 × 423**, which every device shows. Tablets show 1855 × 423, desktop 2560 × 423 and TV the full image, so the area outside the safe zone holds decoration only. |
| LinkedIn company page | `iqrra-linkedin-company-2256x382.png` | 2256 × 382 (2× the 1128 × 191 display) | Bottom-left 600 × 242 kept clear for the company logo. Content kept inside the centre ~1800 px (×2 of the ~900 px the phone app shows). |
| LinkedIn personal profile | `iqrra-linkedin-profile-1584x396.png` | 1584 × 396 | Bottom-left 540 × 226 kept clear for the profile photo. |

Published platform sizes move, and third-party guides disagree on the crops.
After uploading, check each one in the platform's own preview, on desktop and in
the phone app.

## The copy

- «ذكاء يساعدك لتعليم أفضل» is the existing tagline.
- «خطط دروس، أوراق عمل واختبارات — مبنية على المنهاج الأردني»
- *Iqrra · AI teaching assistant for Jordanian teachers*. This line is left off the LinkedIn banners: LinkedIn shows them at about half size, so it would render at roughly 8 px.
- `iqrra.com`

## Rebuilding

The covers are one template, `covers.html`, rendered by Playwright:

```bash
node marketing/social-covers/build.mjs
```

The build fails if any logo or text block spills outside its cover's content box.
Each content box sits inside that platform's safe zone and clear of its avoid
zones. To see one cover with the guides, open `covers.html?c=youtube&guides=1`;
the cover names are `facebook`, `youtube`, `linkedin_company` and
`linkedin_profile`. Note that the lockup path is injected by `build.mjs`, so a
browser opened directly shows the lockup without its wordmark.

- **Logo:** the vector lockup, read from `artifacts/mobile/constants/brandMark.ts`
  at build time, so it can never drift from the app's.
- **Colours:** Midnight Ink `#0B1B33`, Brand Teal `#00A99D`, Soft Aqua `#34D6C6`
  and Primary Teal `#006D65`, from `artifacts/mobile/constants/colors.ts`.
- **Type:** IBM Plex Sans Arabic, the wordmark's own family, in `fonts/`. It is
  licensed under the SIL Open Font License 1.1, so it may be redistributed.
- **Line art:** a parabola for maths, a benzene ring and an atom for chemistry.
  These are the two launch subjects.
