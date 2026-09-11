# PBZ Serif self-hosted subset

- **Upstream project:** [Adobe Source Han Serif](https://github.com/adobe-fonts/source-han-serif), release `2.003R` / `release` branch.
- **Upstream source:** `Variable/WOFF2/OTF/Subset/SourceHanSerifCN-VF.otf.woff2` from <https://raw.githubusercontent.com/adobe-fonts/source-han-serif/release/Variable/WOFF2/OTF/Subset/SourceHanSerifCN-VF.otf.woff2> (10,421,244 bytes; SHA-256 `808cb3203bb9cdd6b166a8a656a0c7608a7dc2a31c41c2cd0374550cae445471`). The full upstream asset is intentionally not stored under `public/`.
- **Production asset:** `PBZSerif-Display-Subset.woff2` (273,920 bytes; SHA-256 `2941862462e1d40daf5df5cdd703281bb1537c0f4d44921efb3156130170dd0b`). It is a project-generated subset that retains the variable `wght` axis only from 400 through 700.
- **License:** SIL Open Font License 1.1. The required Adobe copyright notice and complete license text are in [`OFL.txt`](OFL.txt), copied from <https://raw.githubusercontent.com/adobe-fonts/source-han-serif/release/LICENSE.txt>.
- **Modified naming:** this subset is a modified distribution. Its embedded family and the CSS family are `PBZ Serif`; it does not use Adobe's Reserved Font Name as its primary font name.

## Regeneration

Regeneration is an explicit maintenance action, never part of the normal production build. It requires Python `fonttools` with Brotli support, then uses the checked-in deterministic generator:

```sh
python3 -m pip install --user 'fonttools[brotli]'
curl --fail --location --output /tmp/SourceHanSerifCN-VF.otf.woff2 \
  https://raw.githubusercontent.com/adobe-fonts/source-han-serif/release/Variable/WOFF2/OTF/Subset/SourceHanSerifCN-VF.otf.woff2
PBZ_FONTTOOLS_PYTHON=python3 node scripts/fonts/build-pbz-serif-subset.mjs \
  --source /tmp/SourceHanSerifCN-VF.otf.woff2
```

The generator derives a sorted corpus from current Knowledge data, Astro static-template text, legacy bridge display headings, shared brand text, required ASCII, and Chinese punctuation. Production-validation fixtures currently use ASCII-only titles, which are included by the mandatory ASCII range. It limits the variable axis to 400–700, subsets the official source, and renames the modified font to `PBZ Serif`.

When future display content introduces a character outside this subset, `npm run test:font` and `npm run build` validation must fail with the character and code point. Regenerate the subset with the updated corpus and review the resulting WOFF2 diff as a production asset; do not accept silent fallback as normal maintenance behavior.
