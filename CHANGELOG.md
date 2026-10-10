# Changelog

## [3.4.0] - 2026-10-10

### Added

- Images accept an https URL as `imagePath` in `pdf-document` and `pdf-layout`; it is downloaded once into `~/.mcp-z/mcp-pdf/cache/images/`. Width or height left out comes from the image's own size.
- `text-measure` takes the `markdown` option (default `true`) and reports the size `pdf-document` and `pdf-layout` draw the same text at.

### Changed

- Local image paths are only read when the server runs over stdio. Over HTTP they are refused, so remote callers cannot read the server's files; pass an https URL instead.
- Font and image URLs must be https on a public address, checked again on every redirect, and at most 20 MB. Fonts are cached per URL in `~/.mcp-z/mcp-pdf/cache/fonts/` instead of by file name in the system temp directory, so two URLs ending in the same file name no longer share one cached font.
- Resume pages break between lines instead of keeping whole sections together. Section titles and entry headers stay with the line after them, so a long section starts under its header instead of leaving the rest of the page empty.

### Fixed

- Moonshot (Kimi) rejected `pdf-document` and `pdf-layout` because of the custom page size schema; it is now a two-number array.
- Chinese and Japanese text with markdown or emoji did not wrap and ran off the page.
- Text placed at a fixed position could spill onto a new page; it stays on its page.
- `continued` text ignored markdown in the text that followed it.
- Resume sections of entries without a title, and sections using a custom template, printed nothing.

## [3.3.0] - 2026-10-09

### Added

- Bold and italic in any font: a font's own bold and italic faces are used when it has them, and a font file with a single style gets synthesized ones (thickened outlines, slanted text), as browsers do.
- `.ttc` font collections can be passed as `font`; each collection supplies whichever regular, bold and italic faces it contains, matched by style flags or weight.
- `fonts.standardFonts(name)` returns the faces of a built-in font family, and `fonts.createFontValidator(fonts)` checks text against a font set from `fonts.setupFonts`. `FontConfig` gains `synthetic` (styles drawn without a face of their own) and `file`.

### Changed

- Inline markdown is parsed by default in `pdf-document`, `pdf-layout` and `pdf-resume`: `**bold**`, `*italic*`, `[links](url)`, `` `code` `` and backslash escapes. Line-start syntax stays literal, so `1. Led the team` or `# C# expert` prints as written, and line breaks are kept. Text that relies on literal `*`, `_` or `[..](..)` needs `markdown: false` or backslash escapes.
- The `font` option is honored: the default `auto` system font and font file paths or URLs render in that font. Previously every font other than Helvetica, Times-Roman and Courier was replaced by Helvetica, so non-Latin text did not render; default output now uses the system Unicode font.
- Resume field templates produce markdown, and every value inserted into one is escaped so it prints as written; `| raw` inserts a value that is already markdown. Template formatting applies whatever the `markdown` setting.
- Skills render through the `skill` field template like every other section. The default, `**{{ name }}**{% if level %} ({{ level }}){% endif %}: {{ keywords | join: ', ' }}`, bolds the name only and now includes the level.
- An invalid field template fails the call with an error naming the template instead of printing its source.

### Fixed

- Award, certificate and publication detail lines printed raw template code; they show the title and its awarder, issuer or publisher.
- Text item `color`, `oblique`, `underline`, `strike`, `link`, `continued` and `lineBreak` were accepted but ignored by `pdf-document` and `pdf-layout`.
- Bold and italic markdown spans were always drawn black, ignoring the text color.
- Text containing both emoji and markdown drew the literal `**` and link markup and styled the wrong words.
- Bold or italic ending inside a word (`**Tools**:`) styled the whole word.
- Wrapped markdown text was measured shorter than it was drawn, so resume summaries could overlap the next block.
- A partial nested resume `typography` override, such as `header.name.marginBottom`, discarded its sibling defaults such as the name's font size.
- Empty template values counted as present, so a skill without a level printed `()`.
- Character warnings for a font file check the glyphs that font actually has.

## [3.2.0] - 2026-09-07

### Changed

- Clients speaking the 2026-07-28 protocol revision now receive cache hints on list results: `tools/list`, `prompts/list`, `resources/templates/list` and `server/discover` carry a five-minute TTL and `cacheScope: 'public'`, while `resources/list` and `resources/read` stay `private` with no TTL because they vary by account. Previously every cacheable result used the SDK's conservative `ttlMs: 0` / `private` default, which caches nothing. 2025-era clients are unaffected — the fields do not exist on that revision.
- Tools, resources and prompts are now registered in name order, so `tools/list` returns the same order from every connection and a client can keep a cached catalog valid across a reconnect. The listed order differs from previous releases; no tool is added, removed or renamed.

## [3.1.0] - 2026-09-06

### Added

- Serves the 2026-07-28 MCP protocol revision alongside the existing 2025 revision, over both HTTP and stdio. A client speaking either one reaches the same tools; the 2026 revision is stateless, so such a client sends no `initialize` handshake. Legacy 2025 clients are unaffected.

### Fixed

- The MCP server is now built per request (HTTP) and per connection (stdio) rather than shared. The SDK caches the negotiated protocol revision on the server instance, so a shared one pinned itself to whichever revision arrived first and answered the other with `-32601 Method not found`.

## [3.0.0] - 2026-09-06

### Changed

- Migrated to the v2 MCP SDK by way of `@mcp-z/server` 2.x. Error types are `ProtocolError` / `ProtocolErrorCode` (the wire codes are unchanged), and the SDK surface is reached through `@mcp-z/server` rather than imported directly.
- The 2.x line is maintained on `support/2.x` and published under the `support-2` dist-tag.

## [2.2.1] - 2026-09-05

### Fixed

- Origin validation and loopback bind for the HTTP transport (DNS rebinding).

## [2.2.0] - 2026-09-02

### Removed

- Obsolete PDF resume tests and fixtures.

## [2.1.0] - 2026-08-29

### Changed

- Dependency refresh.

## [2.0.0] - 2025-12-28

Initial 2.x release.
