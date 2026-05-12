export function TitleBar({ title = "Mnemo" }: { title?: string }) {
  return (
    <header className="titlebar">
      <div className="titlebar-title">{title}</div>
    </header>
  );
}
