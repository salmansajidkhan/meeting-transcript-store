# Meeting Transcript Store

> A persistent, searchable SQLite database of meeting transcripts with full-text search, auto-tagging, expert discovery, and action item extraction.

**Status:** Experimental

---

## The Problem

Meeting transcripts are write-once, read-never. They're locked inside calendar apps, unsearchable across meetings, and impossible to query programmatically. You can't answer questions like *"What did we decide about X last quarter?"* or *"Who is the expert on Y?"* without manually reviewing dozens of recordings.

## The Solution

A local SQLite database that turns months of meeting history into instant, queryable institutional knowledge - optimized for AI agent consumption.

## Features

- **Full-text search** - FTS5 with porter stemming and unicode61 tokenization across all transcript chunks
- **Auto-tagging** - ~50 configurable regex-based keyword tags applied on ingest, zero manual curation
- **Expert discovery** - Weighted ranking algorithm that identifies subject-matter experts from speaker, organizer, and action-item signals
- **Action item extraction** - Parses owners and due dates from transcript chunks; generates structured payloads for calendar events, reminder emails, and channel notifications
- **Attachment search** - Converts meeting attachments (PDF, PPTX, DOCX, XLSX, images) to Markdown via [Markitdown](https://github.com/microsoft/markitdown) and indexes alongside transcripts
- **Chunked storage** - Topic-level summaries, not verbatim transcripts - dramatically more token-efficient and produces better search results

## Architecture

```
Meeting Source ──► Ingestion Pipeline ──► Topic-level chunks (typed: summary | discussion | decision | action_item)
                                       ├─► Auto-tag by ~50 keyword patterns
                                       └─► SQLite + FTS5 index

Attachments (PDF/PPTX/DOCX) ──► Markitdown ──► Markdown ──► FTS5

Action Items (extracted) ──► Structured payloads (Calendar / Mail / Teams)
                           └─► Expert discovery signals
```

**Key design choice:** Store topic-level summaries, not verbatim transcripts. Each chunk is a coherent topic - better search relevance, dramatically lower token cost when consumed by AI agents.

### Project Structure

```
Meeting Transcript Store/
  db.mjs                  Core: schema, search, tagging, expert finder, CLI
  ingest-bulk.mjs         Bulk ingestion pipeline (idempotent upserts)
  ingest-attachment.mjs   Convert meeting attachments via Markitdown
  action-items.mjs        Extract action items + payload generators
  store.db                SQLite database (auto-created on init)
  package.json
```

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `meetings` | Meeting metadata - title, date, organizer, attendees, duration |
| `transcript_chunks` | Topic-level sections with type, content, speaker, sort order |
| `tags` | Tag dictionary (~50 configurable domain keywords) |
| `meeting_tags` | Meeting ↔ tag many-to-many |
| `chunk_tags` | Chunk ↔ tag many-to-many |
| `chunks_fts` | FTS5 virtual table for full-text search |
| `attachments` | Markitdown-converted meeting files (PDF, PPTX, DOCX, etc.) |
| `attachments_fts` | FTS5 virtual table for attachment content |
| `attachment_tags` | Attachment ↔ tag many-to-many |
| `action_items` | Extracted action items with owner, status, due date |

### Chunk Types

| Type | Purpose |
|------|---------|
| `summary` | High-level meeting overview |
| `discussion` | Detailed topic discussion (most common) |
| `decision` | Explicit decision or commitment |
| `action_item` | Task assigned to someone |

### FTS5 Configuration

```sql
CREATE VIRTUAL TABLE chunks_fts USING fts5(
    content, meeting_title, chunk_type,
    content='transcript_chunks', content_rowid='id',
    tokenize='porter unicode61'
);
```

- **Porter stemming** - `"virtualizing"` matches `"virtual"`, `"securing"` matches `"security"`
- **Unicode61 tokenizer** - Case-insensitive, handles international characters
- **Content table linking** - FTS5 reads from physical table (saves disk space)
- **Auto-sync triggers** - INSERT/DELETE triggers keep the index consistent

## CLI Commands

```bash
node db.mjs init                              # Create / reset database
node db.mjs search "query"                    # Full-text search
node db.mjs search "auth" --from 2025-01-01   # Date-filtered search
node db.mjs search-attachments "API design"   # Search converted attachments
node db.mjs tags "security"                   # Tag-based lookup
node db.mjs find-experts "topic"              # Rank people by expertise signals
node db.mjs action-items                      # List open action items
node db.mjs stats                             # Database statistics
```

### Search Query Syntax (FTS5)

| Syntax | Example | Behavior |
|--------|---------|----------|
| `OR` | `"VBS OR HVCI"` | Either term |
| `AND` | `"HVCI AND attestation"` | Both terms |
| `NOT` | `"VBS NOT kernel"` | Exclude term |
| `"..."` | `"virtual machine"` | Exact phrase |
| `*` | `"remote*"` | Prefix wildcard |

### Attachment Ingestion

```bash
node ingest-attachment.mjs <meeting-id> ./slides.pptx ./report.pdf
```

Converts files via Markitdown (PDF, PPTX, DOCX, XLSX, images, audio). Auto-tags the converted Markdown. FTS5-indexed alongside transcripts.

### Action Item Pipeline

```bash
node action-items.mjs extract <meeting-id>      # Extract from transcript chunks
node action-items.mjs list                       # List all open action items
node action-items.mjs list <meeting-id>          # List for a specific meeting
node action-items.mjs complete <action-item-id>  # Mark as done
```

### Bulk Ingestion

```bash
node ingest-bulk.mjs    # Idempotent - safe to re-run (upserts by meeting ID)
```

## JavaScript API

```javascript
import {
  search, searchByTag, searchAttachments,
  findExperts, getStats,
  ingestMeeting, ingestAttachment, autoTagText,
  getDb, initDb
} from "./db.mjs";

// Full-text search with filters
const results = search("runtime security", {
  limit: 20,
  tagFilter: "security",
  dateFrom: "2025-01-01",
  dateTo: "2025-06-30"
});

// Tag-based lookup
const tagged = searchByTag("architecture");

// Search meeting attachments
const attachResults = searchAttachments("API design");

// Expert discovery
const experts = findExperts("authentication OR identity", {
  limit: 15,
  dateFrom: "2025-01-01"
});
// → [{ name, score, meeting_count, latest_activity, signal_types, evidence[] }]
```

## Expert Discovery

The `find-experts` command identifies subject-matter experts by aggregating four weighted signal types from meeting data:

| Signal | Weight | Source |
|--------|--------|--------|
| `speaker` | 3 | Person spoke about the topic in a meeting |
| `organizer` | 2 | Person organized a meeting where the topic was discussed |
| `action-item-owner` | 2 | Person owns an action item related to the topic |
| `attendee` | 1 | Person attended a meeting where the topic was discussed |

Results are ranked by weighted score, then meeting count. Evidence snippets are included for the top signals per person.

**Example output:**
```
1. Jane Smith  (score: 24, 8 meetings, last active: 2025-03-09)
   Signal types: speaker, organizer, action-item-owner
   [speaker] Architecture Review (2025-03-09) - "...authentication requirements..."
   [organizer] Weekly Sync (2025-02-09) - Organized meeting
```

## Action Item Payloads

Generates structured payloads ready for calendar, email, and messaging integrations:

```javascript
import {
  extractActionItems,
  generateCalendarEvent,
  generateReminderEmail,
  generateTeamsNotification
} from "./action-items.mjs";

const result = extractActionItems("2025-10-20-design-review");
for (const item of result.items) {
  const calEvent = generateCalendarEvent(item);   // Calendar event payload
  const email    = generateReminderEmail(item);    // Reminder email payload
  const message  = generateTeamsNotification(item); // Channel notification payload
}
```

## Auto-Tagging

~50 regex patterns across configurable categories, applied automatically on ingest:

| Category | Examples |
|----------|---------|
| **Security** | encryption, authentication, authorization, certificates |
| **Infrastructure** | networking, storage, compute, deployment |
| **Architecture** | microservices, API, scalability, performance |
| **Process** | planning, retrospective, onboarding, compliance |
| **Platform** | mobile, web, cloud, desktop |
| **Projects** | *(your team's project names)* |

Tags are applied to meeting titles, chunk content, and attachment Markdown. Deduplicated via `INSERT OR IGNORE`. All chunk-level tags roll up to meeting-level tags automatically.

**Customize:** Edit the `TAG_KEYWORDS` object in `db.mjs`. Each key is a tag name, each value is a regex pattern.

## Setup

```bash
# 1. Initialize
npm install

# 2. Create the database
node db.mjs init

# 3. Ingest meeting data
node ingest-bulk.mjs

# 4. Search
node db.mjs search "your topic"
node db.mjs find-experts "your topic"
```

## Dependencies

| Package | Purpose |
|---------|---------|
| [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) | Synchronous SQLite3 bindings for Node.js - enables FTS5 virtual tables |

## How It Compounds

| Meetings Ingested | Capability |
|-------------------|------------|
| **5** | Basic search - find specific discussions |
| **15** | Expert finder produces meaningful rankings |
| **30+** | Institutional knowledge - *"What did we decide about X last quarter?"* is answerable |
| **50+** | Pattern detection - recurring topics, key contributors, decision history |

The database is append-mostly. Each new meeting enriches every query. Auto-tagging and FTS5 indexing mean zero manual curation after ingestion.

## Known Limitations

| Issue | Workaround |
|-------|-----------|
| FTS5 treats hyphens as `NOT` operator | Quote hyphenated terms: `"auto-tag"` not `auto-tag` |
| OLE2/DRM-protected files | Markitdown may fail on DRM-locked `.docx` - use alternative conversion |
| Decision chunks may produce false positive action items | Filter to `action_item` chunk type for precision |

---

## License

MIT
