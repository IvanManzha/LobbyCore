import React, { useState } from "react";

/**
 * Simple accordion: title + collapsible content. No heavy deps.
 * @param {{ title: string, children: React.ReactNode, defaultOpen?: boolean }} props
 */
export default function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="dnaAccordion">
      <button
        type="button"
        className="dnaAccordionTrigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="dnaAccordionTitle">{title}</span>
        <span className="dnaAccordionIcon" aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && <div className="dnaAccordionContent">{children}</div>}
    </div>
  );
}
