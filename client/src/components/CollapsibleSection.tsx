import { useState, type ReactNode } from "react";

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  nested?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  nested = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={nested ? "collapsible-nested" : "panel collapsible-panel"}>
      <button type="button" className="collapsible-header" onClick={() => setOpen(!open)}>
        <h2 className={nested ? "collapsible-title-nested" : undefined}>{title}</h2>
        <span className="collapsible-chevron">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </section>
  );
}
