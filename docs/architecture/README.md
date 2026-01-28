# Architecture

System design and architecture documentation.

| Doc | Purpose |
|-----|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | High-level system design (React → Zustand → Services → IndexedDB) |
| [PROVIDER_ARCHITECTURE.md](./PROVIDER_ARCHITECTURE.md) | How AI adapters abstract Gemini/Claude/OpenAI/DeepSeek |
| [ADRs](../adr/) | Architecture Decision Records (why we built things this way) |

## Missing Documentation

- [ ] **Data flow diagram**: Visual showing URL → Adapter → Service → Store → Component

## Cross-References

- **IndexedDB schema**: See [guides/INDEXEDDB_SCHEMA.md](../guides/INDEXEDDB_SCHEMA.md)
