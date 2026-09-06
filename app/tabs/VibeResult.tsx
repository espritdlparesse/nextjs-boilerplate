export function MarkdownText({ text }: { text: string }) {
  // Рендерим **жирный** и абзацы
  const paragraphs = text.split(/\n\n+/);
  return (
    <div>
      {paragraphs.map((para, i) => {
        const parts = para.split(/\*\*(.+?)\*\*/g);
        return (
          <p key={i} style={{margin: i === 0 ? 0 : "12px 0 0 0"}}>
            {parts.map((part, j) =>
              j % 2 === 1 ? <strong key={j}>{part}</strong> : part
            )}
          </p>
        );
      })}
    </div>
  );
}

export function VibeResult({ summary }: { summary: string }) {
  return (
    <div>
      <div className="vibe-text">{summary.trim()}</div>
    </div>
  );
}
