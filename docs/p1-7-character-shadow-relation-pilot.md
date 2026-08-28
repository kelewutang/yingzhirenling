# P1-7：Character Shadow Data + Relation Boundary Pilot

## Scope and decision

This pilot adds a second Entity type to the existing Knowledge Schema `1.0-implementation`: Character. It is a shadow-data and validation exercise only. No Character is published, no Character detail page or route is generated, and production Search remains limited to the two approved Weapon entities.

The pilot stores two independently evidenced Character-to-Character Relation records. The reviewed official material does not directly support a `character uses weapon` relationship for any existing Weapon entity; a visual encounter or weapon held in footage would not establish that stronger semantic claim. No Character-to-Weapon Relation is therefore inferred.

## Entity boundary

A Character Entity represents one continuous, independently named in-game identity. Titles, translated names, romanization, and other verified language forms remain aliases on the same Entity; they are not separate characters. Identity split/merge is reserved for genuine later correction and continues to use the existing Entity `resolution` rules.

The three deliberately small draft samples are:

| Entity | Main display | Verified aliases | Facts | Evidence boundary |
| --- | --- | --- | --- | --- |
| `character:soul` | 魂 | Soul | existence, name, protagonist role | Official PlayStation Blog text calls Soul the protagonist. |
| `character:mo-yuan` | 魔渊 | Mó Yuan | existence, name | The official Relation record, rather than `character.role`, stores the father relationship. The source uses traditional Chinese “魔淵”; the existing site’s simplified display form is retained. |
| `character:the-hunt` | The Hunt | none | existence, name | The official Relation record, rather than `character.role`, stores the former-companion relationship. The official Traditional Chinese article itself uses the untranslated name “The Hunt”; no Chinese translation is invented. |

All seven Facts are `official`, each has an `authority=official` direct source, and every Entity is `recordState: draft` with `publishedAt: null`. `character.role` is now used only for Soul’s work-level identity as protagonist; it does not encode Character-to-Character relationships. No `release-verified`, editorial, observed combat, build, stat, or weapon-association Fact was added.

## Source reuse

The existing S-GAME PlayStation Blog State of Play article is reused for Soul and Mó Yuan. A separate official Traditional Chinese PlayStation Blog preorder article is stored once as `source:playstation-blog-preorder-2026-08-12`, because it directly provides the Chinese-facing names and The Hunt statement. The data records only article text, never an inference from accompanying video or imagery.

## Minimal Fact keys

P1-7 adds only three reusable Character keys:

- `character.exists` — boolean evidence that an identity is explicitly present or named;
- `character.name` — a source’s direct name form;
- `character.role` — a directly stated identity, story, or relationship position.

`character.role` is intentionally not a combat class, faction inference, strength rating, or Build field. More specific keys require a later evidence-led need.

## Search shadow contract

`scripts/build-search-index.mjs` now reads Weapon and Character records. Draft Characters are included in `generated/search-index.shadow.json` with `documentType: entity`, `entityType: character`, aliases, conservative keywords, summary, `recordState`, and `sourceSchemaVersion`.

Character shadow documents always route to `/characters`, the existing collection page. They never manufacture `/characters/{slug}` because no Character detail page exists. Production mode excludes every draft Character; it also fails closed if a future Character is marked published before a Character production page contract exists. This leaves production Search at exactly:

- `weapon:tang-hengdao` → `/weapons/tang-hengdao`
- `weapon:ya-hengdao` → `/weapons/ya-hengdao`

## Validation and fixtures

The validator is minimally generalized from Weapon-only to Weapon + Character while preserving existing Fact, Source, publication, resolution, version, and scope rules. It keeps IDs globally unique and slugs unique per Entity type.

`tests/fixtures/character-schema-cases.json` covers a valid draft Character, the currently allowed historical non-null `publishedAt` on a draft, invalid slug, duplicate ID, duplicate Character slug, unowned summary Fact, missing Source, and prohibited pre-release `release-verified`. Search fixtures additionally prove that a draft Character appears in shadow at `/characters` and is absent in production.

## Relation boundary

The existing Schema already describes Relation as an independently sourced, directed record with source/target Entity, a controlled relation type, status, sourceIds, checkedAt, version, and scope. P1-7 implements the smallest vocabulary that the direct evidence needs:

- `character:mo-yuan` → `parentOf` → `character:soul`;
- `character:the-hunt` → `formerCompanionOf` → `character:soul`.

Both records are `official` and cite the same direct official article. `parentOf` is directional; `formerCompanionOf` is stored once only, without a redundant reverse record. The validator currently limits this pilot vocabulary to these two evidence-led types, rejects invalid targets, self relations, duplicate source/type/target tuples, unsupported types, and official records lacking an official Source.

Neither relation is a Character-to-Weapon relation, and the available official text does not identify a specific Weapon as equipped, used, or permanently associated by these Characters. When such direct evidence exists, its Relation must carry its own ID, sourceIds, status, checkedAt, version, and scope; it must not inherit those from either Entity Fact or be duplicated in reverse.

## Architecture assessment and next gate

P1-7 does not add a second detail template, route family, sitemap projection, metadata projection, or Fact renderer. It therefore does **not** add a new Astro Migration Preparation signal beyond the existing P1-6 technical debt. The current JSON + Node generator + static-output approach remains appropriate for this shadow-only step.

Recommended P1-8: a Character Publication and Detail-Page Readiness Gate. It should first require enough independently sourced Character Facts and a publication contract; only if it approves a second production detail template should the project perform the Astro Migration Preparation audit before implementation.
