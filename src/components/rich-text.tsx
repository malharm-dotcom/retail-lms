import { Fragment } from "react";

/** Inline **bold** only; everything else is literal text (rendered as React nodes, never HTML). */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : <Fragment key={index}>{part}</Fragment>,
  );
}

/** Tiny block renderer: `## ` / `### ` headings, `- ` bullets, `1. ` steps, blank-line paragraphs. */
export function RichText({ source }: { source: string }) {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(<p key={blocks.length}>{inline(paragraph.join(" "))}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item, index) => <li key={index}>{inline(item)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const step = line.match(/^\d+[.)]\s+(.*)$/);
    if (!line) {
      flushParagraph();
      flushList();
    } else if (line.startsWith("### ") || line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push(line.startsWith("### ") ? <h3 key={blocks.length}>{inline(line.slice(4))}</h3> : <h2 key={blocks.length}>{inline(line.slice(3))}</h2>);
    } else if (bullet || step) {
      flushParagraph();
      const ordered = Boolean(step);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? step)![1]);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return <div className="reading">{blocks}</div>;
}
