// Splits pasted text into separate messages: blank lines and WhatsApp-style "[time] name:" lines start a new one.
const WA_BRACKET = /^\[[^\]]{3,40}\]\s*[^:\n]{1,40}:\s*/
const WA_DASH = /^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+[\d:.]+\s*(?:[ap]m)?\s*-\s*[^:\n]{1,40}:\s*/i

export function splitMessages(input: string): string[] {
  const out: string[] = []
  let cur: string[] = []
  const flush = () => {
    const t = cur.join('\n').trim()
    if (t) out.push(t)
    cur = []
  }
  for (const line of input.replace(/\r\n/g, '\n').split('\n')) {
    if (line.trim() === '') {
      flush()
      continue
    }
    const m = line.match(WA_BRACKET) ?? line.match(WA_DASH)
    if (m) {
      flush()
      cur.push(line.slice(m[0].length))
    } else {
      cur.push(line)
    }
  }
  flush()
  return out
}
