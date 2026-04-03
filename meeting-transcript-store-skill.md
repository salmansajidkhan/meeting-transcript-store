# Meeting Transcript Store Skill

A persistent, searchable database of meeting transcripts optimized for AI agent consumption. Turns months of meeting history into instant, queryable institutional knowledge.

## The Problem

Meeting transcripts are trapped in M365. You can't search across meetings, find who discussed what, track action items, or identify experts on a topic. By the time you need the information, you've forgotten which meeting it was in.

## What This Skill Does

Gives your AI assistant a local SQLite database with:
- **Full-text search** across all meeting transcripts (FTS5 with porter stemming)
- **Auto-tagging** with ~50 domain keywords so you can browse by topic
- **Expert finder** that ranks people by how often they speak about, organize meetings on, or own action items for a topic
- **Attachment search** across converted PDFs, decks, and docs shared in meetings
- **Action item tracking** with M365 Calendar/Mail/Teams payload generators

## Architecture

```
M365 Meeting --> WorkIQ Ingest --> Topic-level chunks (not verbatim)
                                --> Auto-tag by ~50 keywords
                                --> SQLite + FTS5 index

Attachments (PDF/PPTX/DOCX) --> Markitdown CLI --> Markdown --> FTS5

Action Items (extracted) --> M365 payloads (Calendar/Mail/Teams)
                          --> Expert Finder signals
```

**Key design choice:** Store topic-level summaries, not verbatim transcripts. This is dramatically more token-efficient and produces better search results because each chunk is already a coherent topic.

### Directory Structure
```
Meeting Transcript Store/
  db.mjs                    <- Core: schema, search, tagging, expert finder, CLI
  ingest-bulk.mjs           <- Bulk ingestion (28+ meetings, idempotent)
  ingest-attachment.mjs     <- Convert meeting attachments via Markitdown
  action-items.mjs          <- Extract action items + M365 payload generators
  store.db                  <- SQLite database (auto-created)
  package.json              <- Dependencies: better-sqlite3
  README.md
```

## Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `meetings` | Meeting metadata (id, title, date, organizer, attendees, duration) |
| `transcript_chunks` | Topic-level sections (chunk_type, content, speaker, sort_order) |
| `tags` | Tag dictionary (~50 domain keywords) |
| `meeting_tags` | Meeting-to-tag associations |
| `chunk_tags` | Chunk-to-tag associations |
| `chunks_fts` | FTS5 virtual table for full-text search |
| `attachments` | Markitdown-converted meeting files |
| `attachments_fts` | FTS5 for attachment content |
| `attachment_tags` | Attachment-to-tag associations |
| `action_items` | Extracted action items with owner, status, due date |

### Chunk Types
- `summary` -- High-level meeting overview
- `discussion` -- Detailed topic discussion (most common)
- `decision` -- Explicit decision or commitment
- `action_item` -- Task assigned to someone

### FTS5 Configuration
```sql
CREATE VIRTUAL TABLE chunks_fts USING fts5(
    content, meeting_title, chunk_type,
    content='transcript_chunks', content_rowid='id',
    tokenize='porter unicode61'
);
```
- **Porter stemming**: "virtualizing" matches "virtual"
- **Unicode61**: Case-insensitive, handles international characters
- **Content table linking**: FTS5 reads from physical table (saves space)
- **Auto-sync triggers**: INSERT/DELETE triggers keep FTS5 in sync

## CLI Commands

```bash
node db.mjs init                        # Create/reset database
node db.mjs search "VBS OR HVCI"        # Full-text search
node db.mjs search "attestation" --from 2026-01-01 --limit 50
node db.mjs tags "anti-cheat"           # Tag-based lookup
node db.mjs search-attachments "API"    # Search converted attachments
node db.mjs find-experts "topic"        # Rank people by expertise signals
node db.mjs action-items                # List open action items
node db.mjs stats                       # Database statistics
```

### Search Query Syntax
- `VBS OR HVCI` -- Either term
- `HVCI AND attestation` -- Both terms
- `VBS NOT kernel` -- Exclude term
- `"virtual machine"` -- Exact phrase
- `remote*` -- Prefix wildcard

## JavaScript API

```javascript
import {
  search, searchByTag, searchAttachments,
  findExperts, getStats,
  ingestMeeting, ingestAttachment, autoTagText,
  getDb, initDb
} from "./db.mjs";

// Full-text search with filters
const results = search("VBS", {
  limit: 20, tagFilter: "ea",
  dateFrom: "2026-01-01", dateTo: "2026-02-28"
});

// Expert finder
const experts = findExperts("attestation OR HVCI", {
  limit: 15, dateFrom: "2026-01-01"
});

// Returns ranked list:
// { name, score, meeting_count, latest_activity, signal_types, evidence[] }
```

## Ingestion Pipelines

### Pipeline 1: Bulk Transcript Ingestion
```bash
node ingest-bulk.mjs
```
Loads meeting data from hardcoded JSON objects. Idempotent (upserts by meeting ID). Auto-tags all text. Each meeting has metadata + an array of typed chunks.

**Meeting data format:**
```javascript
{
  meeting: { id, title, date, organizer, attendees, duration_minutes, is_transcribed },
  chunks: [
    { chunk_type: "discussion", content: "...", speaker: "Name" },
    { chunk_type: "action_item", content: "Name: do the thing", speaker: null }
  ]
}
```

### Pipeline 2: Attachment Ingestion
```bash
node ingest-attachment.mjs "meeting-id" ./slides.pptx ./report.pdf
```
Converts files via `markitdown` CLI. Supports PDF, PPTX, DOCX, XLSX, images, audio. Auto-tags converted markdown. FTS5-indexed alongside transcripts.

### Pipeline 3: Action Item Extraction
```bash
node action-items.mjs extract "meeting-id"  # Extract from chunks
node action-items.mjs list                   # List all open
node action-items.mjs complete 42            # Mark done
```
Parses owner and due date from action_item chunks. Pattern: `"Owner Name: description"`. Generates M365 payloads for Calendar events, reminder emails, and Teams notifications.

## Auto-Tagging System

~50 regex patterns across 6 categories, applied automatically on ingest:

| Category | Example Tags |
|----------|-------------|
| **Security** | vbs, hvci, secure-boot, attestation, kernel, drivers, dma |
| **Anti-Cheat** | anti-cheat, eac, battleye, vanguard, ricochet, denuvo |
| **Partners** | riot, ea, activision, epic, tencent, ubisoft, roblox |
| **Programs** | mvi, macp, eeap, collaborate |
| **Platform** | arm, gaming, hotpatching, prism |
| **Projects** | onboarding-agent, expert-finder, workiq, copilot, mcp |

Tags are applied to meeting titles, chunk content, and attachment markdown. Deduplicated via `INSERT OR IGNORE`. All chunk tags roll up to meeting-level tags.

**To customize:** Edit the `TAG_KEYWORDS` object in `db.mjs`. Each key is a tag name, each value is a regex pattern.

## Expert Finder Integration

The `find-experts` command identifies subject-matter experts by aggregating four signal types:

| Signal | Weight | Source |
|--------|--------|--------|
| `speaker` | 3 | Person spoke about the topic in a meeting |
| `organizer` | 2 | Person organized a meeting where topic was discussed |
| `action-item-owner` | 2 | Person owns an action item related to the topic |
| `attendee` | 1 | Person attended a meeting where topic was discussed |

Results are ranked by weighted score, then meeting count. Evidence snippets are included for the top 5 signals per person.

**Example output:**
```
1. Jane Smith  (score: 24, 8 meetings, last active: 2026-03-09)
   Signal types: speaker, organizer, action-item-owner
   [speaker] Security Review (2026-03-09) -- "...attestation requirements..."
   [organizer] Weekly Sync (2026-02-09) -- Organized meeting
```

## M365 Integration

### Action Item Payloads
```javascript
import { generateCalendarEvent, generateReminderEmail, generateTeamsNotification } from "./action-items.mjs";

const calEvent = generateCalendarEvent(actionItem);   // Calendar MCP payload
const email = generateReminderEmail(actionItem);       // Mail MCP payload
const teams = generateTeamsNotification(actionItem);   // Teams MCP payload
```

Each generator produces a ready-to-send payload for the M365 Agents Toolkit MCP server.

## Known Gotchas

| Issue | Workaround |
|-------|-----------|
| **FTS5 treats hyphens as NOT** | Quote hyphenated terms: `"anti-cheat"` not `anti-cheat` |
| **WorkIQ org policy blocks some transcripts** | Meeting-specific, not blanket. Some meetings return empty. |
| **OLE2/DRM files** | Markitdown fails on OneDrive-synced .docx (OLE2). Use COM automation. |
| **Decision chunks produce false positive action items** | Consider filtering to `action_item` chunk type only |
| **ESM import guard** | `db.mjs` CLI block needs `isMainModule` guard to prevent execution on import |

## Setup Guide

### 1. Initialize the project
```bash
mkdir "Meeting Transcript Store"
cd "Meeting Transcript Store"
npm init -y
npm install better-sqlite3
```

### 2. Create db.mjs
Implement the schema, search functions, auto-tagging, and CLI interface. The skill document above describes every table, function, and pattern.

### 3. Create ingest-bulk.mjs
Hardcode your meeting data as JSON objects. Each meeting needs an ID, metadata, and an array of typed chunks. Run `node ingest-bulk.mjs` to populate the database.

### 4. Customize tags
Edit `TAG_KEYWORDS` in db.mjs to match your domain. Add regex patterns for your team's projects, partners, and technical terms.

### 5. Wire into Copilot CLI
Add search commands to your copilot-instructions.md so triggers like `prep 1:1` and `review project` can query the transcript store.

## How It Compounds

| Meetings Ingested | What You Can Do |
|-------------------|----------------|
| 5 | Basic search. Find specific discussions. |
| 15 | Expert finder starts producing meaningful rankings. |
| 30+ | Institutional knowledge. "What did we decide about X last quarter?" is answerable. |
| 50+ | Pattern detection. "Who always discusses Y?" "What topics keep recurring?" |

The database is append-mostly. Each new meeting makes every query richer. The auto-tagging and FTS5 indexing mean zero manual curation after ingestion.

---

*Created by Salman Khan. Built for the Windows Security partner ecosystem, generalizable to any team with regular meetings.*
