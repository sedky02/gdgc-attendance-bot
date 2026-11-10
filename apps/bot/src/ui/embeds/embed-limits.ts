// Discord rejects the whole message when any of these is exceeded:
// https://discord.com/developers/docs/resources/message#embed-object-embed-limits
export const EMBED_FIELD_VALUE_LIMIT = 1024;
export const EMBED_DESCRIPTION_LIMIT = 4096;

const overflowNote = (hiddenCount: number) => `… and ${hiddenCount} more`;

export function fitLines(lines: string[], limit: number): string[] {
  if (lines.join("\n").length <= limit) {
    return lines;
  }

  const kept: string[] = [];
  let length = 0;

  for (const [index, line] of lines.entries()) {
    const remaining = lines.length - index;
    const reserved = overflowNote(remaining).length + 1;
    const separator = kept.length > 0 ? 1 : 0;

    if (length + separator + line.length + reserved > limit) {
      return [...kept, overflowNote(remaining)];
    }
    kept.push(line);
    length += separator + line.length;
  }

  return kept;
}

export function chunkLines(lines: string[], limit: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > limit && current) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}
