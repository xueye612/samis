export interface NumberedNoteLine {
  index: number;
  content: string;
  raw: string;
  clock?: string;
  displayContent: string;
}

export interface SequenceNoteMarker {
  id: string;
  number: number;
  time: string;
  rowIndex: number;
  tone: 'orange' | 'pink';
  content: string;
  noteKey: 'specialMeds' | 'keyOperations';
}

const NUMBERED_LINE = /^\s*(\d+)[.、)\s]\s*(.*)$/;
const CIRCLE_NUMBERED_LINE = /^\s*([①②③④⑤⑥⑦⑧⑨⑩])\s*(.*)$/;
const CIRCLE_INDEX: Record<string, number> = {
  '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5, '⑥': 6, '⑦': 7, '⑧': 8, '⑨': 9, '⑩': 10,
};
const CLOCK_AT_START = /^\s*(\d{1,2}:\d{2})\b/;
const CLOCK_IN_CONTENT = /(?:^|\s)(\d{1,2}:\d{2})(?:\s|$)/;

export function parseClockFromNoteContent(content: string): string | undefined {
  const atStart = content.match(CLOCK_AT_START);
  if (atStart) return atStart[1];
  const matched = content.match(CLOCK_IN_CONTENT);
  return matched?.[1];
}

export function stripClockFromNoteContent(content: string): string {
  return content.replace(CLOCK_AT_START, '').trim();
}

export function parseNumberedNoteLines(text?: string): NumberedNoteLine[] {
  if (!text?.trim()) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, offset) => {
      const circle = line.match(CIRCLE_NUMBERED_LINE);
      const matched = line.match(NUMBERED_LINE);
      const content = circle ? circle[2].trim() : matched ? matched[2].trim() : line;
      const index = circle
        ? (CIRCLE_INDEX[circle[1]] ?? offset + 1)
        : matched
          ? Number(matched[1]) || offset + 1
          : offset + 1;
      const clock = parseClockFromNoteContent(content);
      return {
        index,
        content,
        raw: line,
        clock,
        displayContent: stripClockFromNoteContent(content),
      };
    });
}

export function buildSequenceMarkersFromNotes(
  lines: NumberedNoteLine[],
  options: {
    rowIndex: number;
    tone: 'orange' | 'pink';
    idPrefix: string;
    noteKey: 'specialMeds' | 'keyOperations';
    clockToIso: (clock: string) => string;
  },
): SequenceNoteMarker[] {
  return lines.flatMap((item) => {
    if (!item.clock) return [];
    return [{
      id: `${options.idPrefix}-${item.index}`,
      number: item.index,
      time: options.clockToIso(item.clock),
      rowIndex: options.rowIndex,
      tone: options.tone,
      content: item.displayContent || item.content,
      noteKey: options.noteKey,
    }];
  });
}

export function formatNumberedNoteLines(lines: string[]): string {
  return lines.filter(Boolean).map((line, index) => `${index + 1}. ${line.replace(NUMBERED_LINE, '$2').trim()}`).join('\n');
}

export function normalizeNumberedNotes(text?: string): string {
  const parsed = parseNumberedNoteLines(text);
  if (!parsed.length) return '';
  return parsed.map((item) => `${item.index}. ${item.content}`).join('\n');
}

export function updateNumberedNoteLineClock(text: string | undefined, lineIndex: number, clock: string): string {
  return parseNumberedNoteLines(text)
    .map((line, offset) => {
      const content = line.index === lineIndex
        ? `${clock} ${line.displayContent || stripClockFromNoteContent(line.content)}`.trim()
        : line.content;
      return `${offset + 1}. ${content}`;
    })
    .join('\n');
}

export function upsertTimedKeyOperationLine(
  notes: string | undefined,
  label: string,
  clock: string,
): string {
  const lines = parseNumberedNoteLines(notes);
  const content = `${clock} ${label}`;
  const normalizedLabel = label.trim();
  const existingIndex = lines.findIndex((line) => {
    const existingLabel = (line.displayContent || line.content).trim();
    return existingLabel === normalizedLabel || existingLabel.includes(normalizedLabel) || normalizedLabel.includes(existingLabel);
  });
  if (existingIndex >= 0) {
    const existing = lines[existingIndex];
    lines[existingIndex] = {
      ...existing,
      content,
      clock,
      displayContent: label,
      raw: `${existing.index}. ${content}`,
    };
  } else {
    const nextIndex = lines.length ? Math.max(...lines.map((line) => line.index)) + 1 : 1;
    lines.push({
      index: nextIndex,
      content,
      clock,
      displayContent: label,
      raw: `${nextIndex}. ${content}`,
    });
  }
  const seen = new Set<string>();
  return lines
    .filter((line) => {
      const key = (line.displayContent || line.content).trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((line, index) => `${index + 1}. ${line.content}`)
    .join('\n');
}
