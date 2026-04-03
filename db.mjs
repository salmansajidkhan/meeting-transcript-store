/**
 * Meeting Transcript Store — DB Management
 * =========================================
 * SQLite + FTS5 database for storing and searching meeting transcript data.
 * Designed for efficient AI agent consumption (Copilot CLI).
 *
 * Usage:
 *   node db.mjs init              — Create/reset the database
 *   node db.mjs search "VBS"      — Full-text search across all transcript chunks
 *   node db.mjs tags "anti-cheat" — Find all chunks with a specific tag
 *   node db.mjs stats             — Show database statistics
 */

import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, "store.db");

// ── Tag taxonomy with keyword patterns ──────────────────────────────────────
const TAG_KEYWORDS = {
  // Security
  vbs: /\bvbs\b|virtualization.based.security/i,
  hvci: /\bhvci\b|hypervisor.protected.code.integrity|code.integrity/i,
  "secure-boot": /\bsecure.boot\b|uefi.secure/i,
  attestation: /\battestation\b|attest\b/i,
  enclaves: /\benclaves?\b|sgx\b|confidential/i,
  kernel: /\bkernel\b|kernel.mode|ring.0|ntoskrnl/i,
  drivers: /\bdrivers?\b|wdm\b|kmdf\b|wdf\b/i,
  dma: /\bdma\b|dma.remapping|iommu/i,
  security: /\bsecurity\b|secure\b|vulnerability|exploit|protection/i,
  // Anti-cheat
  "anti-cheat": /\banti.cheat\b|anticheat\b|anti_cheat\b|cheat.detection/i,
  eac: /\beac\b|easy.anti.cheat/i,
  battleye: /\bbattleye\b|battle.eye/i,
  vanguard: /\bvanguard\b/i,
  ricochet: /\bricochet\b/i,
  denuvo: /\bdenuvo\b/i,
  xigncode: /\bxigncode\b|wellbia\b/i,
  gameguard: /\bgameguard\b|nprotect\b/i,
  griffin: /\bgriffin\b/i,
  theia: /\btheia\b/i,
  // Partners
  riot: /\briot\b|riot.games/i,
  ea: /\b(?:ea|electronic.arts)\b/i,
  activision: /\bactivision\b|blizzard\b|activision.blizzard/i,
  epic: /\bepic\b|epic.games|unreal/i,
  tencent: /\btencent\b|tencent.ace/i,
  ubisoft: /\bubisoft\b/i,
  embark: /\bembark\b|embark.studios/i,
  bethesda: /\bbethesda\b/i,
  mihoyo: /\bmihoyo\b|hoyoverse/i,
  netease: /\bnetease\b/i,
  roblox: /\broblox\b/i,
  "zero-it": /\bzero.it\b|zero.it.lab/i,
  krafton: /\bkrafton\b/i,
  smilegate: /\bsmilegate\b/i,
  "2k": /\b2k\b|take.two/i,
  // Programs
  mvi: /\bmvi\b|microsoft.virus.initiative/i,
  macp: /\bmacp\b|anti.cheat.compatibility.program/i,
  eeap: /\beeap\b/i,
  collaborate: /\bcollaborate\b/i,
  // Platform
  arm: /\barm\b|arm64\b|aarch64\b|windows.on.arm|woa\b|snapdragon/i,
  gaming: /\bgaming\b|games?\b|titles?\b|steam\b|xbox\b/i,
  hotpatching: /\bhotpatch\b|hot.patch/i,
  prism: /\bprism\b|emulation\b|x86.on.arm/i,
  // Projects
  "onboarding-agent": /\bonboarding.agent\b|partner.onboarding|mvi.onboarding/i,
  "expert-finder": /\bexpert.finder\b/i,
  workiq: /\bworkiq\b|work.iq/i,
  copilot: /\bcopilot\b|github.copilot|copilot.cli/i,
  mcp: /\bmcp\b|model.context.protocol/i,
  // Meeting types
  triage: /\btriage\b/i,
  demo: /\bdemos?\b|demonstration/i,
  review: /\breview\b/i,
  planning: /\bplanning\b|roadmap\b|okr\b/i,
  fhl: /\bfhl\b|fix.hack.learn/i,
};

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    organizer TEXT,
    attendees TEXT,
    duration_minutes INTEGER,
    is_transcribed INTEGER DEFAULT 0,
    source_url TEXT,
    ingested_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transcript_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id TEXT NOT NULL REFERENCES meetings(id),
    chunk_type TEXT NOT NULL,
    content TEXT NOT NULL,
    speaker TEXT,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS meeting_tags (
    meeting_id TEXT NOT NULL REFERENCES meetings(id),
    tag_id INTEGER NOT NULL REFERENCES tags(id),
    PRIMARY KEY (meeting_id, tag_id)
);

CREATE TABLE IF NOT EXISTS chunk_tags (
    chunk_id INTEGER NOT NULL REFERENCES transcript_chunks(id),
    tag_id INTEGER NOT NULL REFERENCES tags(id),
    PRIMARY KEY (chunk_id, tag_id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
    content,
    meeting_title,
    chunk_type,
    content='transcript_chunks',
    content_rowid='id',
    tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON transcript_chunks BEGIN
    INSERT INTO chunks_fts(rowid, content, meeting_title, chunk_type)
    SELECT NEW.id, NEW.content,
           (SELECT title FROM meetings WHERE id = NEW.meeting_id),
           NEW.chunk_type;
END;

CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON transcript_chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, content, meeting_title, chunk_type)
    VALUES('delete', OLD.id, OLD.content,
           (SELECT title FROM meetings WHERE id = OLD.meeting_id),
           OLD.chunk_type);
END;

CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id TEXT NOT NULL REFERENCES meetings(id),
    filename TEXT NOT NULL,
    original_format TEXT,
    markdown_content TEXT NOT NULL,
    source_path TEXT,
    ingested_at TEXT DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS attachments_fts USING fts5(
    markdown_content,
    filename,
    content='attachments',
    content_rowid='id',
    tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS attach_ai AFTER INSERT ON attachments BEGIN
    INSERT INTO attachments_fts(rowid, markdown_content, filename)
    VALUES (NEW.id, NEW.markdown_content, NEW.filename);
END;

CREATE TRIGGER IF NOT EXISTS attach_ad AFTER DELETE ON attachments BEGIN
    INSERT INTO attachments_fts(attachments_fts, rowid, markdown_content, filename)
    VALUES('delete', OLD.id, OLD.markdown_content, OLD.filename);
END;

CREATE TABLE IF NOT EXISTS attachment_tags (
    attachment_id INTEGER NOT NULL REFERENCES attachments(id),
    tag_id INTEGER NOT NULL REFERENCES tags(id),
    PRIMARY KEY (attachment_id, tag_id)
);

CREATE TABLE IF NOT EXISTS action_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id TEXT NOT NULL REFERENCES meetings(id),
    owner TEXT,
    description TEXT NOT NULL,
    due_date TEXT,
    status TEXT DEFAULT 'open',
    calendar_event_id TEXT,
    email_sent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date);
CREATE INDEX IF NOT EXISTS idx_chunks_meeting ON transcript_chunks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_chunks_type ON transcript_chunks(chunk_type);
CREATE INDEX IF NOT EXISTS idx_mtags_tag ON meeting_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_ctags_tag ON chunk_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_attach_meeting ON attachments(meeting_id);
CREATE INDEX IF NOT EXISTS idx_atags_tag ON attachment_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_action_meeting ON action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_action_status ON action_items(status);
`;

// ── Database helpers ────────────────────────────────────────────────────────

export function getDb() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function initDb() {
  const db = getDb();
  db.exec(SCHEMA_SQL);
  db.close();
  console.log(`Database initialized at ${DB_PATH}`);
}

export function autoTagText(text) {
  const matched = new Set();
  for (const [tag, pattern] of Object.entries(TAG_KEYWORDS)) {
    if (pattern.test(text)) matched.add(tag);
  }
  return matched;
}

function ensureTags(db, tagNames) {
  const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)");
  const getTag = db.prepare("SELECT id FROM tags WHERE name = ?");
  const tagMap = {};
  for (const name of tagNames) {
    insertTag.run(name);
    tagMap[name] = getTag.get(name).id;
  }
  return tagMap;
}

export function ingestMeeting(db, meetingData, chunks) {
  const ingestTx = db.transaction(() => {
    const existing = db
      .prepare("SELECT id FROM meetings WHERE id = ?")
      .get(meetingData.id);

    if (existing) {
      db.prepare(`UPDATE meetings SET title=?, date=?, organizer=?, attendees=?,
        duration_minutes=?, is_transcribed=?, source_url=?, ingested_at=datetime('now')
        WHERE id=?`).run(
        meetingData.title, meetingData.date, meetingData.organizer || null,
        meetingData.attendees || null, meetingData.duration_minutes || null,
        meetingData.is_transcribed || 0, meetingData.source_url || null,
        meetingData.id
      );
      db.prepare("DELETE FROM chunk_tags WHERE chunk_id IN (SELECT id FROM transcript_chunks WHERE meeting_id=?)").run(meetingData.id);
      db.prepare("DELETE FROM meeting_tags WHERE meeting_id=?").run(meetingData.id);
      db.prepare("DELETE FROM transcript_chunks WHERE meeting_id=?").run(meetingData.id);
    } else {
      db.prepare(`INSERT INTO meetings (id, title, date, organizer, attendees, duration_minutes, is_transcribed, source_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        meetingData.id, meetingData.title, meetingData.date,
        meetingData.organizer || null, meetingData.attendees || null,
        meetingData.duration_minutes || null, meetingData.is_transcribed || 0,
        meetingData.source_url || null
      );
    }

    const allMeetingTags = autoTagText(meetingData.title);
    const insertChunk = db.prepare(`INSERT INTO transcript_chunks (meeting_id, chunk_type, content, speaker, sort_order) VALUES (?, ?, ?, ?, ?)`);
    const insertChunkTag = db.prepare("INSERT OR IGNORE INTO chunk_tags (chunk_id, tag_id) VALUES (?, ?)");
    const insertMeetingTag = db.prepare("INSERT OR IGNORE INTO meeting_tags (meeting_id, tag_id) VALUES (?, ?)");

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const info = insertChunk.run(meetingData.id, chunk.chunk_type, chunk.content, chunk.speaker || null, i);
      const chunkId = info.lastInsertRowid;

      const chunkTags = autoTagText(chunk.content);
      for (const t of chunkTags) allMeetingTags.add(t);

      if (chunkTags.size > 0) {
        const tagMap = ensureTags(db, chunkTags);
        for (const [, tagId] of Object.entries(tagMap)) {
          insertChunkTag.run(chunkId, tagId);
        }
      }
    }

    if (allMeetingTags.size > 0) {
      const tagMap = ensureTags(db, allMeetingTags);
      for (const [, tagId] of Object.entries(tagMap)) {
        insertMeetingTag.run(meetingData.id, tagId);
      }
    }
  });

  ingestTx();
}

export function search(query, { limit = 20, tagFilter, dateFrom, dateTo } = {}) {
  const db = getDb();
  let sql = `SELECT c.id, c.chunk_type, c.content, c.speaker,
    m.id as meeting_id, m.title as meeting_title, m.date, m.organizer, rank
    FROM chunks_fts fts
    JOIN transcript_chunks c ON c.id = fts.rowid
    JOIN meetings m ON m.id = c.meeting_id`;
  const params = [];
  const wheres = ["chunks_fts MATCH ?"];
  params.push(query);

  if (tagFilter) {
    sql += " JOIN chunk_tags ct ON ct.chunk_id = c.id JOIN tags t ON t.id = ct.tag_id";
    wheres.push("t.name = ?");
    params.push(tagFilter);
  }
  if (dateFrom) { wheres.push("m.date >= ?"); params.push(dateFrom); }
  if (dateTo) { wheres.push("m.date <= ?"); params.push(dateTo); }

  sql += " WHERE " + wheres.join(" AND ") + " ORDER BY rank LIMIT ?";
  params.push(limit);

  const rows = db.prepare(sql).all(...params);
  db.close();
  return rows;
}

export function searchByTag(tagName, limit = 50) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT c.id, c.chunk_type, c.content, c.speaker,
           m.title as meeting_title, m.date, m.organizer
    FROM transcript_chunks c
    JOIN chunk_tags ct ON ct.chunk_id = c.id
    JOIN tags t ON t.id = ct.tag_id
    JOIN meetings m ON m.id = c.meeting_id
    WHERE t.name = ?
    ORDER BY m.date DESC LIMIT ?
  `).all(tagName, limit);
  db.close();
  return rows;
}

export function ingestAttachment(db, meetingId, filename, markdownContent, originalFormat, sourcePath) {
  const tx = db.transaction(() => {
    const info = db.prepare(
      `INSERT INTO attachments (meeting_id, filename, original_format, markdown_content, source_path)
       VALUES (?, ?, ?, ?, ?)`
    ).run(meetingId, filename, originalFormat || null, markdownContent, sourcePath || null);
    const attachId = info.lastInsertRowid;

    const attachTags = autoTagText(markdownContent);
    if (attachTags.size > 0) {
      const tagMap = ensureTags(db, attachTags);
      const insertAttachTag = db.prepare("INSERT OR IGNORE INTO attachment_tags (attachment_id, tag_id) VALUES (?, ?)");
      for (const [, tagId] of Object.entries(tagMap)) {
        insertAttachTag.run(attachId, tagId);
      }
      // Also tag the parent meeting
      const insertMeetingTag = db.prepare("INSERT OR IGNORE INTO meeting_tags (meeting_id, tag_id) VALUES (?, ?)");
      for (const [, tagId] of Object.entries(tagMap)) {
        insertMeetingTag.run(meetingId, tagId);
      }
    }
    return attachId;
  });
  return tx();
}

export function searchAttachments(query, { limit = 20, tagFilter, dateFrom, dateTo } = {}) {
  const db = getDb();
  let sql = `SELECT a.id, a.filename, a.original_format, a.markdown_content,
    m.id as meeting_id, m.title as meeting_title, m.date, rank
    FROM attachments_fts fts
    JOIN attachments a ON a.id = fts.rowid
    JOIN meetings m ON m.id = a.meeting_id`;
  const params = [];
  const wheres = ["attachments_fts MATCH ?"];
  params.push(query);

  if (tagFilter) {
    sql += " JOIN attachment_tags at2 ON at2.attachment_id = a.id JOIN tags t ON t.id = at2.tag_id";
    wheres.push("t.name = ?");
    params.push(tagFilter);
  }
  if (dateFrom) { wheres.push("m.date >= ?"); params.push(dateFrom); }
  if (dateTo) { wheres.push("m.date <= ?"); params.push(dateTo); }

  sql += " WHERE " + wheres.join(" AND ") + " ORDER BY rank LIMIT ?";
  params.push(limit);

  const rows = db.prepare(sql).all(...params);
  db.close();
  return rows;
}

export function getActionItems(meetingId, { status } = {}) {
  const db = getDb();
  let sql = "SELECT * FROM action_items WHERE meeting_id = ?";
  const params = [meetingId];
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY created_at";
  const rows = db.prepare(sql).all(...params);
  db.close();
  return rows;
}

export function getAllOpenActionItems() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT ai.*, m.title as meeting_title, m.date as meeting_date
    FROM action_items ai
    JOIN meetings m ON m.id = ai.meeting_id
    WHERE ai.status = 'open'
    ORDER BY ai.due_date IS NULL, ai.due_date, ai.created_at
  `).all();
  db.close();
  return rows;
}

export function upsertActionItem(db, meetingId, owner, description, dueDate) {
  return db.prepare(
    `INSERT INTO action_items (meeting_id, owner, description, due_date)
     VALUES (?, ?, ?, ?)`
  ).run(meetingId, owner || null, description, dueDate || null);
}

export function updateActionItemStatus(id, status, calendarEventId, emailSent) {
  const db = getDb();
  const updates = ["status = ?"];
  const params = [status];
  if (calendarEventId !== undefined) { updates.push("calendar_event_id = ?"); params.push(calendarEventId); }
  if (emailSent !== undefined) { updates.push("email_sent = ?"); params.push(emailSent ? 1 : 0); }
  params.push(id);
  db.prepare(`UPDATE action_items SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  db.close();
}

// ── Expert Finder integration ───────────────────────────────────────────────
// Aggregates people signals from transcripts for a topic query.
// Returns ranked list of people with meeting evidence (speaker mentions,
// meetings organized, action items owned).

export function findExperts(query, { limit = 15, dateFrom, dateTo } = {}) {
  const db = getDb();
  const people = {};

  // Sanitize FTS5 query: quote terms with hyphens, preserve OR/AND operators
  const ftsQuery = query.replace(/(?<!\w)([\w][\w-]*[\w])(?!\w)/g, (match) => {
    if (/^(OR|AND|NOT)$/i.test(match)) return match;
    return match.includes("-") ? `"${match}"` : match;
  });

  // Helper to accumulate a person entry
  function addSignal(name, type, meetingTitle, date, detail) {
    if (!name) return;
    const key = name.toLowerCase().trim();
    if (!people[key]) {
      people[key] = { name: name.trim(), signals: [], meetings: new Set(), latestDate: null };
    }
    const p = people[key];
    p.signals.push({ type, meeting: meetingTitle, date, detail });
    p.meetings.add(meetingTitle);
    if (!p.latestDate || date > p.latestDate) p.latestDate = date;
  }

  // 1. Search transcript chunks for speakers who discussed the topic
  try {
    let chunkSql = `SELECT c.speaker, m.title, m.date, c.chunk_type,
      snippet(chunks_fts, 0, '»', '«', '…', 32) as snippet
      FROM chunks_fts fts
      JOIN transcript_chunks c ON c.id = fts.rowid
      JOIN meetings m ON m.id = c.meeting_id
      WHERE chunks_fts MATCH ?`;
    const chunkParams = [ftsQuery];
    if (dateFrom) { chunkSql += " AND m.date >= ?"; chunkParams.push(dateFrom); }
    if (dateTo) { chunkSql += " AND m.date <= ?"; chunkParams.push(dateTo); }
    chunkSql += " ORDER BY rank LIMIT 100";

    const chunkRows = db.prepare(chunkSql).all(...chunkParams);
    for (const r of chunkRows) {
      if (r.speaker) {
        addSignal(r.speaker, "speaker", r.title, r.date, r.snippet);
      }
    }
  } catch { /* FTS query may fail on empty db */ }

  // 2. Find meeting organizers whose meetings match the topic
  try {
    let orgSql = `SELECT DISTINCT m.organizer, m.title, m.date
      FROM chunks_fts fts
      JOIN transcript_chunks c ON c.id = fts.rowid
      JOIN meetings m ON m.id = c.meeting_id
      WHERE chunks_fts MATCH ? AND m.organizer IS NOT NULL`;
    const orgParams = [ftsQuery];
    if (dateFrom) { orgSql += " AND m.date >= ?"; orgParams.push(dateFrom); }
    if (dateTo) { orgSql += " AND m.date <= ?"; orgParams.push(dateTo); }
    orgSql += " LIMIT 50";

    const orgRows = db.prepare(orgSql).all(...orgParams);
    for (const r of orgRows) {
      addSignal(r.organizer, "organizer", r.title, r.date, `Organized meeting: ${r.title}`);
    }
  } catch { /* FTS query may fail */ }

  // 3. Find action item owners related to the topic
  try {
    let aiSql = `SELECT ai.owner, ai.description, ai.status, ai.due_date,
      m.title, m.date
      FROM action_items ai
      JOIN meetings m ON m.id = ai.meeting_id
      WHERE ai.owner IS NOT NULL
      AND (ai.description LIKE ? OR m.title LIKE ?)`;
    const likeQ = `%${query.replace(/\s+OR\s+/gi, "%").replace(/"/g, "")}%`;
    const aiParams = [likeQ, likeQ];
    if (dateFrom) { aiSql += " AND m.date >= ?"; aiParams.push(dateFrom); }
    if (dateTo) { aiSql += " AND m.date <= ?"; aiParams.push(dateTo); }
    aiSql += " LIMIT 50";

    const aiRows = db.prepare(aiSql).all(...aiParams);
    for (const r of aiRows) {
      addSignal(r.owner, "action-item-owner", r.title, r.date,
        `${r.status}: ${r.description}${r.due_date ? ` (due ${r.due_date})` : ""}`);
    }
  } catch { /* query may fail */ }

  // 4. Search meeting attendees field for people in matching meetings
  try {
    let attSql = `SELECT DISTINCT m.attendees, m.title, m.date
      FROM chunks_fts fts
      JOIN transcript_chunks c ON c.id = fts.rowid
      JOIN meetings m ON m.id = c.meeting_id
      WHERE chunks_fts MATCH ? AND m.attendees IS NOT NULL`;
    const attParams = [ftsQuery];
    if (dateFrom) { attSql += " AND m.date >= ?"; attParams.push(dateFrom); }
    if (dateTo) { attSql += " AND m.date <= ?"; attParams.push(dateTo); }
    attSql += " LIMIT 30";

    const attRows = db.prepare(attSql).all(...attParams);
    for (const r of attRows) {
      // attendees is a comma-separated string
      const names = r.attendees.split(",").map(n => n.trim()).filter(Boolean);
      for (const name of names) {
        addSignal(name, "attendee", r.title, r.date, `Attended: ${r.title}`);
      }
    }
  } catch { /* query may fail */ }

  db.close();

  // Rank by: speaker mentions > organizer > action-item-owner > attendee, then by meeting count
  const signalWeight = { speaker: 3, organizer: 2, "action-item-owner": 2, attendee: 1 };
  const ranked = Object.values(people)
    .map(p => ({
      name: p.name,
      score: p.signals.reduce((s, sig) => s + (signalWeight[sig.type] || 1), 0),
      meeting_count: p.meetings.size,
      latest_activity: p.latestDate,
      signal_types: [...new Set(p.signals.map(s => s.type))],
      evidence: p.signals.slice(0, 5).map(s => ({
        type: s.type,
        meeting: s.meeting,
        date: s.date,
        detail: s.detail
      }))
    }))
    .sort((a, b) => b.score - a.score || b.meeting_count - a.meeting_count)
    .slice(0, limit);

  return ranked;
}

export function getStats() {
  const db = getDb();
  const stats = {};
  stats.meetings_total = db.prepare("SELECT COUNT(*) as c FROM meetings").get().c;
  stats.meetings_transcribed = db.prepare("SELECT COUNT(*) as c FROM meetings WHERE is_transcribed=1").get().c;
  stats.chunks_total = db.prepare("SELECT COUNT(*) as c FROM transcript_chunks").get().c;
  stats.tags_total = db.prepare("SELECT COUNT(*) as c FROM tags").get().c;

  const dr = db.prepare("SELECT MIN(date) as mn, MAX(date) as mx FROM meetings").get();
  stats.date_range = dr.mn ? `${dr.mn} to ${dr.mx}` : "empty";

  stats.top_tags = {};
  for (const r of db.prepare("SELECT t.name, COUNT(*) as cnt FROM chunk_tags ct JOIN tags t ON t.id = ct.tag_id GROUP BY t.name ORDER BY cnt DESC LIMIT 15").all()) {
    stats.top_tags[r.name] = r.cnt;
  }

  stats.chunks_by_type = {};
  for (const r of db.prepare("SELECT chunk_type, COUNT(*) as cnt FROM transcript_chunks GROUP BY chunk_type").all()) {
    stats.chunks_by_type[r.chunk_type] = r.cnt;
  }

  stats.attachments_total = db.prepare("SELECT COUNT(*) as c FROM attachments").get()?.c || 0;
  stats.action_items_open = db.prepare("SELECT COUNT(*) as c FROM action_items WHERE status='open'").get()?.c || 0;
  stats.action_items_total = db.prepare("SELECT COUNT(*) as c FROM action_items").get()?.c || 0;

  db.close();
  return stats;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function printResults(results) {
  if (!results.length) { console.log("No results found."); return; }
  let current = null;
  for (const r of results) {
    if (r.meeting_title !== current) {
      current = r.meeting_title;
      console.log(`\n${"=".repeat(60)}`);
      console.log(`📅 ${r.date} — ${r.meeting_title}`);
      if (r.organizer) console.log(`   Organizer: ${r.organizer}`);
      console.log("=".repeat(60));
    }
    console.log(`  [${r.chunk_type}] ${r.content.slice(0, 200)}...`);
    if (r.speaker) console.log(`    — ${r.speaker}`);
  }
}

function printActionItems(items) {
  if (!items.length) { console.log("No action items found."); return; }
  for (const item of items) {
    const due = item.due_date ? `due ${item.due_date}` : "no due date";
    const meeting = item.meeting_title ? ` (${item.meeting_title} — ${item.meeting_date})` : "";
    console.log(`  [${item.status}] ${item.owner || "Unassigned"}: ${item.description} — ${due}${meeting}`);
  }
}

// ── CLI (only when run directly) ────────────────────────────────────────────

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] ||
  process.argv[1] && fileURLToPath(import.meta.url).replace(/\\/g, "/") === process.argv[1].replace(/\\/g, "/");

if (isMainModule) {
const [,, cmd, ...args] = process.argv;
if (cmd === "init") {
  initDb();
} else if (cmd === "search") {
  printResults(search(args.join(" ")));
} else if (cmd === "search-attachments") {
  const results = searchAttachments(args.join(" "));
  if (!results.length) { console.log("No attachment results found."); }
  else {
    for (const r of results) {
      console.log(`\n📎 ${r.filename} (${r.original_format}) — ${r.meeting_title} (${r.date})`);
      console.log(`   ${r.markdown_content.slice(0, 300)}...`);
    }
  }
} else if (cmd === "tags") {
  printResults(searchByTag(args[0]));
} else if (cmd === "find-experts") {
  const results = findExperts(args.join(" "));
  if (!results.length) { console.log("No expertise signals found."); }
  else {
    console.log(`\n🔍 Expertise signals from meeting transcripts:\n`);
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      console.log(`${i + 1}. ${r.name}  (score: ${r.score}, ${r.meeting_count} meeting${r.meeting_count > 1 ? "s" : ""}, last active: ${r.latest_activity})`);
      console.log(`   Signal types: ${r.signal_types.join(", ")}`);
      for (const e of r.evidence) {
        console.log(`   • [${e.type}] ${e.meeting} (${e.date}) — ${e.detail?.slice(0, 120)}`);
      }
      console.log();
    }
  }
} else if (cmd === "action-items") {
  printActionItems(getAllOpenActionItems());
} else if (cmd === "stats") {
  console.log(JSON.stringify(getStats(), null, 2));
} else if (cmd) {
  console.log(`Unknown command: ${cmd}`);
}
} // end isMainModule
