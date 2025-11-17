# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.1] - 2025-10-05

### Fixed
- **MCP Registry Publication**: Added required `repository.id` field and `registryBaseUrl` to server.json manifest to ensure proper registration in the Model Context Protocol official registry
- **Glama.ai Integration**: Added glama.json with maintainer information for proper author attribution on Glama.ai directory

## [1.1.0] - 2025-10-05

### Added
- MCP registry publication workflow with GitHub Actions
- Automated publishing to Model Context Protocol official registry

## [1.0.4] - 2025-01-05

### Fixed
- **Positioning validation**: Added validation to prevent mixing `x` coordinate with `align` property, which caused unpredictable element placement and could cause AI agents to repeatedly try adjusting layouts without success
- **Emoji positioning**: Fixed emoji rendering to respect explicit x coordinates instead of incorrectly applying alignment offsets
- **Documentation clarity**: Clarified positioning rules and added warnings about conflicting parameters in both tool description and field-level descriptions

### Changed
- Tool description now includes explicit positioning rules with clear warnings
- Field descriptions for `x` and `align` parameters now warn about conflicts
- Error messages provide clear, actionable guidance when invalid parameter combinations are used

### Technical Details
**Breaking Changes**: None for valid usage patterns. The API now rejects previously invalid parameter combinations (using `x` with `align`) with a clear error message instead of silently producing incorrect layouts.

**Migration Guide**: If you encounter errors about using `x` with `align`:
- **For absolute positioning**: Use `x` and `y` coordinates only (remove `align` property)
  ```json
  {"type": "text", "text": "Hello", "x": 100, "y": 200}
  ```
- **For centered elements**: Use `align: "center"` with optional `y` coordinate (remove `x` property)
  ```json
  {"type": "text", "text": "Hello", "y": 200, "align": "center"}
  ```
- **For calculated centering**: Pre-calculate the x position and use absolute positioning
  ```json
  {"type": "text", "text": "Hello", "x": 256, "y": 200}
  ```

**Why This Matters**: The previous behavior of silently accepting both `x` and `align` led to unpredictable positioning where elements wouldn't appear where expected. This caused confusion and made it difficult to create precise layouts. The new validation provides immediate, clear feedback when invalid combinations are used.

## [1.0.3] - 2025-10-03

### Added
- **Sandboxed output directory**: PDFs are now written to a secure sandboxed directory (`~/.server-pdf/` by default) instead of being embedded in responses
- **Filename sanitization**: Added security measures to prevent path traversal attacks - filenames are sanitized and only written to the configured output directory
- **Custom output location**: Set `PDF_OUTPUT_DIR` environment variable to customize the output directory
- **Smithery configuration**: Added `smithery.yaml` for Smithery marketplace integration

### Changed
- **Output model**: Changed from embedded resources (v1.0.2) to filesystem writes with sandboxed security
- **API behavior**: Tools now accept `filename` parameter and return the file path in the sandboxed directory
- **Repository organization**: Moved to @mcp-z GitHub organization with updated URLs

### Why This Change
Version 1.0.2's embedded resource approach (returning PDF data inline) caused token usage issues for large PDFs. This version returns to local filesystem writes but adds proper security controls through sandboxing and filename sanitization.

## [1.0.2] - 2025-10-03

### Added
- **Enhanced Unicode support**: Improved auto-detection and font resolution for Chinese, Japanese, Korean (CJK) and other international characters
- **Logo resource**: Added logo image for marketplace listings
- **Comprehensive CJK tests**: Added extensive tests for Chinese/Cantonese character rendering

### Changed
- **Output model**: Switched from filesystem writes to embedded resources following MCP protocol best practices
- **API change**: Tools return PDF data as base64-encoded embedded resources instead of writing to disk
- **Schema update**: Changed `outputPath` to `filename` parameter (optional)

### Technical
- PDFs are captured in memory and returned via MCP resource protocol
- All tests updated to work with Buffer responses instead of file paths

### Documentation
- Added "Where to Find This Server" section listing all registries (npm, MCP Official, Smithery, etc.)

### Note
**This approach was revised in v1.0.3** - While following MCP protocol patterns, embedding large PDFs inline caused excessive token usage. Version 1.0.3 returns to filesystem writes with added security measures.

## [1.0.1] - 2025-10-03

### Added
- Initial release to npm and MCP Official Registry
- **MCP registry configuration**: Added `.mcpregistry.json` for MCP Official Registry integration
- Basic PDF generation tools with emoji and Unicode support

### Features
- Three tools: `create-simple-pdf`, `create-pdf`, `generate-resume-pdf`
- Color emoji rendering using canvas-based image generation
- Full Unicode support with automatic font detection
- PDFKit integration for flexible PDF creation

## [1.0.0] - 2025-10-03

### Initial Release
- Core PDF generation server for MCP
- Comprehensive font handling with emoji detection
- Resume generation from JSON Resume format
- Test suite covering fonts, emoji, and various PDF generation scenarios
