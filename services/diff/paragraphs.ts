// Reader paragraph hashes and diff-analysis chunk IDs share this text contract.
export const splitIntoParagraphSegments = (text: string): Array<{ raw: string }> => {
  const segments: Array<{ raw: string }> = [];
  const boundaryRegex = /(?:<br\s*\/?>\s*){2,}|<hr\s*\/?>|<\/p>\s*<p[^>]*>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boundaryRegex.exec(text)) !== null) {
    segments.push({ raw: text.slice(lastIndex, match.index) });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ raw: text.slice(lastIndex) });
  }

  return segments;
};

export const normalizeParagraphText = (html: string): string => {
  let output = html;
  output = output.replace(/(<br\s*\/?>\s*){2,}/gi, '\n\n');
  output = output.replace(/<br\s*\/?>/gi, '\n');
  output = output.replace(/<hr\s*\/?>/gi, '\n\n');
  output = output.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
  output = output.replace(/<\/?p[^>]*>/gi, '');
  output = output.replace(/<\/?[^>]+>/g, '');
  output = output.replace(/&nbsp;/gi, ' ');
  output = output.replace(/\r\n/g, '\n');
  output = output.replace(/\n{3,}/g, '\n\n');
  output = output.replace(/[ \t]+\n/g, '\n');
  return output;
};
