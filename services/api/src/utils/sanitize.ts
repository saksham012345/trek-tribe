export function sanitizeText(input: any, maxLength = 1000): string {
  if (input === null || input === undefined) return '';
  let text = String(input);
  // Trim and collapse whitespace
  text = text.trim().replace(/\s+/g, ' ');
  if (maxLength && text.length > maxLength) {
    return text.slice(0, maxLength);
  }
  return text;
}

export default sanitizeText;
