# Changelog

All notable changes to LexiconForge are documented here.

For detailed daily work logs, see [WORKLOG.md](../WORKLOG.md).

---

## [Unreleased]

### Added
- **Sutta Studio**: New feature for Pali sutta translation and study
- **SuttaCentral adapter**: Support for suttacentral.net
- **BookToki adapter**: Support for Korean novels (booktoki468.com)
- **Documentation reorganization**: New folder structure (features/, guides/, roadmaps/, infrastructure/)

### Changed
- ADRs consolidated under `docs/adr/` with domain prefixes (DB-, CORE-, FEAT-, SUTTA-)
- Stale documentation archived with superseded-by headers

### Fixed
- TypeScript errors reduced from 172 to 7

---

## [1.1.0] - December 2025

### Added
- **Novel Gallery**: Netflix-style browsing with cover art
- **Image Generation**: Gemini native image generation, Imagen 3.0/4.0
- **Audio Generation**: PiAPI integration for txt2audio
- **Fan Translation Comparison**: Semantic diff with heatmap visualization

### Changed
- IndexedDB architecture decomposed into modular services
- Legacy repository compatibility layer removed

---

## [1.0.0] - August 12, 2025

### Added
- Initial production release
- 3 AI providers: Gemini, OpenAI, DeepSeek (15+ models)
- 4 novel sites: Kakuyomu, Dxmwx, Kanunu, Novelcool
- Feedback system with translation amendments
- Session persistence and import/export
- EPUB export with custom templates

See: [v1.0.0 Release Notes](../archive/RELEASE_NOTES.md)

---

## Format

This changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

Types of changes:
- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Vulnerability fixes
