/**
 * Action Item Pipeline
 * ====================
 * Extracts action items from meeting transcripts and provides integration
 * points with M365 Agents Toolkit for Calendar events and Mail reminders.
 *
 * Usage:
 *   node action-items.mjs extract <meeting-id>     — Extract action items from transcript chunks
 *   node action-items.mjs list                      — List all open action items
 *   node action-items.mjs list <meeting-id>         — List action items for a meeting
 *   node action-items.mjs complete <action-item-id> — Mark an action item as done
 *
 * M365 Agents Toolkit Integration:
 *   This module exports functions for use with the M365 Agents Toolkit MCP tools:
 *   - generateCalendarEvent(actionItem) → returns event payload for Calendar MCP
 *   - generateReminderEmail(actionItem) → returns email payload for Mail MCP
 *   - generateTeamsNotification(actionItem) → returns message payload for Teams MCP
 *
 *   When running in Copilot CLI with M365 Agents Toolkit MCP enabled, these
 *   payloads can be passed directly to the corresponding MCP tools.
 */

import { getDb, getAllOpenActionItems, upsertActionItem, updateActionItemStatus } from "./db.mjs";

// ── Action Item Extraction ──────────────────────────────────────────────────

const ACTION_PATTERNS = [
  /^(?:action[:\s-]*items?|follow[- ]?ups?|next[- ]?steps?|to[- ]?do)/im,
  /\b(?:will|should|needs? to|must|action|follow up|schedule|send|draft|review|share|coordinate|reach out)\b/i,
];

export function extractActionItems(meetingId) {
  const db = getDb();

  const meeting = db.prepare("SELECT * FROM meetings WHERE id = ?").get(meetingId);
  if (!meeting) {
    db.close();
    throw new Error(`Meeting not found: ${meetingId}`);
  }

  // Pull action_item chunks and relevant discussion chunks
  const chunks = db.prepare(
    `SELECT * FROM transcript_chunks
     WHERE meeting_id = ? AND (chunk_type = 'action_item' OR chunk_type = 'decision')
     ORDER BY sort_order`
  ).all(meetingId);

  const items = [];
  for (const chunk of chunks) {
    // Split multi-line action items
    const lines = chunk.content.split(/\n|(?<=\.)\s+(?=[A-Z])/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 10) continue;

      // Try to extract owner from "Name: action" pattern
      const ownerMatch = trimmed.match(/^([A-Z][a-z]+ (?:[A-Z][a-z]+)?(?:\s+\([^)]+\))?)\s*[:—–-]\s*(.+)/);
      const owner = ownerMatch ? ownerMatch[1].trim() : null;
      const description = ownerMatch ? ownerMatch[2].trim() : trimmed;

      // Try to extract due date
      const dateMatch = description.match(/\b(?:by|before|due|until)\s+(\d{4}-\d{2}-\d{2}|\w+ \d{1,2}(?:,? \d{4})?)\b/i);
      const dueDate = dateMatch ? dateMatch[1] : null;

      const info = upsertActionItem(db, meetingId, owner, description, dueDate);
      items.push({ id: info.lastInsertRowid, owner, description, dueDate });
    }
  }

  db.close();
  return { meeting: meeting.title, date: meeting.date, items };
}

// ── M365 Agents Toolkit Payload Generators ──────────────────────────────────

/**
 * Generate a Calendar event payload for the M365 Agents Toolkit.
 * Pass this to the Calendar MCP tool to create a follow-up event.
 */
export function generateCalendarEvent(actionItem, { daysFromNow = 3 } = {}) {
  const startDate = actionItem.due_date
    ? new Date(actionItem.due_date)
    : new Date(Date.now() + daysFromNow * 86400000);

  return {
    subject: `Follow-up: ${actionItem.description.slice(0, 80)}`,
    body: {
      contentType: "text",
      content: [
        `Action item from: ${actionItem.meeting_title || "meeting"}`,
        `Owner: ${actionItem.owner || "Unassigned"}`,
        `Description: ${actionItem.description}`,
        actionItem.due_date ? `Original due date: ${actionItem.due_date}` : "",
      ].filter(Boolean).join("\n"),
    },
    start: { dateTime: startDate.toISOString(), timeZone: "Pacific Standard Time" },
    end: { dateTime: new Date(startDate.getTime() + 1800000).toISOString(), timeZone: "Pacific Standard Time" },
    isReminderOn: true,
    reminderMinutesBeforeStart: 15,
  };
}

/**
 * Generate an email reminder payload for the M365 Agents Toolkit.
 * Pass this to the Mail MCP tool to send a reminder.
 */
export function generateReminderEmail(actionItem, { recipientEmail } = {}) {
  return {
    subject: `Action Item Reminder: ${actionItem.description.slice(0, 60)}`,
    body: {
      contentType: "text",
      content: [
        `Hi ${actionItem.owner || "team"},`,
        "",
        `Following up on an action item from our meeting${actionItem.meeting_title ? ` "${actionItem.meeting_title}"` : ""}${actionItem.meeting_date ? ` on ${actionItem.meeting_date}` : ""}:`,
        "",
        `  ${actionItem.description}`,
        "",
        actionItem.due_date ? `This was targeted for ${actionItem.due_date}.` : "",
        "",
        "Can you share a quick status update?",
        "",
        "Thanks, -Salman",
      ].filter(Boolean).join("\n"),
    },
    toRecipients: recipientEmail ? [{ emailAddress: { address: recipientEmail } }] : [],
  };
}

/**
 * Generate a Teams notification payload for the M365 Agents Toolkit.
 * Pass this to the Teams MCP tool to post a follow-up message.
 */
export function generateTeamsNotification(actionItem) {
  return {
    body: {
      content: [
        `📋 **Action Item Follow-up**`,
        `From: ${actionItem.meeting_title || "meeting"} (${actionItem.meeting_date || "unknown date"})`,
        `Owner: ${actionItem.owner || "Unassigned"}`,
        `Task: ${actionItem.description}`,
        actionItem.due_date ? `Due: ${actionItem.due_date}` : "",
      ].filter(Boolean).join("\n"),
    },
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const [,, cmd, ...args] = process.argv;

if (cmd === "extract") {
  const meetingId = args[0];
  if (!meetingId) { console.log("Usage: node action-items.mjs extract <meeting-id>"); process.exit(1); }
  const result = extractActionItems(meetingId);
  console.log(`\n📋 Extracted ${result.items.length} action items from "${result.meeting}" (${result.date}):\n`);
  for (const item of result.items) {
    console.log(`  [#${item.id}] ${item.owner || "Unassigned"}: ${item.description}`);
    if (item.dueDate) console.log(`         Due: ${item.dueDate}`);
  }
  if (result.items.length > 0) {
    console.log(`\nM365 Toolkit integration:`);
    console.log(`  • Use generateCalendarEvent() to create follow-up calendar events`);
    console.log(`  • Use generateReminderEmail() to draft and send reminders via Mail MCP`);
    console.log(`  • Use generateTeamsNotification() to post to a Teams channel`);
  }
} else if (cmd === "list") {
  const meetingId = args[0];
  if (meetingId) {
    const db = getDb();
    const items = db.prepare("SELECT * FROM action_items WHERE meeting_id = ? ORDER BY created_at").all(meetingId);
    db.close();
    if (!items.length) { console.log("No action items for this meeting."); }
    else {
      for (const item of items) {
        const due = item.due_date ? `due ${item.due_date}` : "no due date";
        console.log(`  [${item.status}] #${item.id} ${item.owner || "Unassigned"}: ${item.description} — ${due}`);
      }
    }
  } else {
    const items = getAllOpenActionItems();
    if (!items.length) { console.log("No open action items."); }
    else {
      console.log(`\n📋 ${items.length} open action items:\n`);
      for (const item of items) {
        const due = item.due_date ? `due ${item.due_date}` : "no due date";
        console.log(`  [#${item.id}] ${item.owner || "Unassigned"}: ${item.description}`);
        console.log(`         ${item.meeting_title} (${item.meeting_date}) — ${due}`);
      }
    }
  }
} else if (cmd === "complete") {
  const id = parseInt(args[0]);
  if (!id) { console.log("Usage: node action-items.mjs complete <action-item-id>"); process.exit(1); }
  updateActionItemStatus(id, "done");
  console.log(`✓ Action item #${id} marked as done.`);
} else {
  console.log("Usage:");
  console.log("  node action-items.mjs extract <meeting-id>     — Extract action items from transcript");
  console.log("  node action-items.mjs list [<meeting-id>]      — List action items");
  console.log("  node action-items.mjs complete <action-item-id> — Mark as done");
}
