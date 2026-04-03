/**
 * Markitdown Attachment Ingestion
 * ================================
 * Converts meeting attachments (PDF, PPTX, DOCX, XLSX, images) to Markdown
 * via the Markitdown MCP server, then stores in the Meeting Transcript Store.
 *
 * Prerequisites:
 *   - markitdown-mcp installed (pip install markitdown-mcp)
 *   - OR markitdown CLI available (pip install markitdown)
 *
 * Usage:
 *   node ingest-attachment.mjs <meeting-id> <file-path>
 *   node ingest-attachment.mjs <meeting-id> <file-path> [<file-path2> ...]
 *
 * Examples:
 *   node ingest-attachment.mjs "2025-10-20-secure-runtime" ./slides.pptx
 *   node ingest-attachment.mjs "2026-01-15-riot-sync" ./notes.pdf ./diagram.png
 *
 * MCP Integration:
 *   When running inside Copilot CLI with Markitdown MCP server enabled,
 *   the conversion happens via the MCP tool. For standalone use, this
 *   module shells out to the `markitdown` CLI.
 */

import { execSync } from "child_process";
import { basename, extname } from "path";
import { existsSync, readFileSync } from "fs";
import { getDb, ingestAttachment } from "./db.mjs";

const SUPPORTED_FORMATS = new Set([
  ".pdf", ".pptx", ".docx", ".xlsx", ".xls",
  ".html", ".htm", ".csv", ".json", ".xml",
  ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff",
  ".mp3", ".wav", ".m4a",
  ".md", ".txt",
]);

function convertWithMarkitdown(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!SUPPORTED_FORMATS.has(ext)) {
    throw new Error(`Unsupported format: ${ext}. Supported: ${[...SUPPORTED_FORMATS].join(", ")}`);
  }

  // For plain text/markdown, read directly
  if (ext === ".md" || ext === ".txt") {
    return readFileSync(filePath, "utf-8");
  }

  try {
    const result = execSync(`markitdown "${filePath}"`, {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024, // 50MB for large docs
      timeout: 120_000, // 2 minutes
    });
    return result;
  } catch (err) {
    throw new Error(`Markitdown conversion failed for ${filePath}: ${err.message}`);
  }
}

function formatForDisplay(ext) {
  const map = {
    ".pdf": "PDF", ".pptx": "PowerPoint", ".docx": "Word",
    ".xlsx": "Excel", ".xls": "Excel", ".html": "HTML",
    ".htm": "HTML", ".csv": "CSV", ".json": "JSON",
    ".jpg": "Image", ".jpeg": "Image", ".png": "Image",
    ".gif": "Image", ".bmp": "Image", ".tiff": "Image",
    ".mp3": "Audio", ".wav": "Audio", ".m4a": "Audio",
    ".md": "Markdown", ".txt": "Text",
  };
  return map[ext] || ext.slice(1).toUpperCase();
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const [,, meetingId, ...filePaths] = process.argv;

if (!meetingId || filePaths.length === 0) {
  console.log("Usage: node ingest-attachment.mjs <meeting-id> <file-path> [<file-path2> ...]");
  console.log("\nConverts files to Markdown via Markitdown and stores alongside meeting transcripts.");
  console.log(`\nSupported formats: ${[...SUPPORTED_FORMATS].join(", ")}`);
  process.exit(1);
}

const db = getDb();

// Verify meeting exists
const meeting = db.prepare("SELECT id, title FROM meetings WHERE id = ?").get(meetingId);
if (!meeting) {
  console.error(`Meeting not found: ${meetingId}`);
  console.log("Available meetings:");
  for (const m of db.prepare("SELECT id, title, date FROM meetings ORDER BY date DESC LIMIT 10").all()) {
    console.log(`  ${m.id} — ${m.title} (${m.date})`);
  }
  db.close();
  process.exit(1);
}

console.log(`📎 Ingesting attachments for: ${meeting.title}`);

let ingested = 0;
for (const filePath of filePaths) {
  if (!existsSync(filePath)) {
    console.error(`  ✗ File not found: ${filePath}`);
    continue;
  }

  const filename = basename(filePath);
  const ext = extname(filePath).toLowerCase();
  const format = formatForDisplay(ext);

  try {
    console.log(`  Converting ${filename} (${format})...`);
    const markdown = convertWithMarkitdown(filePath);

    if (!markdown || markdown.trim().length === 0) {
      console.error(`  ✗ Empty conversion result for ${filename}`);
      continue;
    }

    const attachId = ingestAttachment(db, meetingId, filename, markdown, format, filePath);
    console.log(`  ✓ ${filename} → ${markdown.length} chars, attachment #${attachId}`);
    ingested++;
  } catch (err) {
    console.error(`  ✗ ${filename}: ${err.message}`);
  }
}

db.close();
console.log(`\nDone: ${ingested}/${filePaths.length} attachments ingested.`);
