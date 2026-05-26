import React, { useState, useEffect, useRef } from "react";

const INTRO_SEEN_KEY = "dnaIntroSeen";

export function useDnaIntroSeen() {
  if (typeof window === "undefined") return true;
  return sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
}

export function setDnaIntroSeen() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(INTRO_SEEN_KEY, "1");
}

const prefersReducedMotion = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

/**
 * DNA Dive intro: "UI flies into player" — 1 time per session.
 * Phases: A freeze → B fly → C dissolve → D lab appear → E ready.
 * Skip always available. Reduced motion: simple fade only.
 */
export default function DnaDiveIntro({ onComplete }) {
  const [phase, setPhase] = useState("a");
  const [visible, setVisible] = useState(true);
  const reduced = useRef(prefersReducedMotion());

  useEffect(() => {
    if (reduced.current) {
      setPhase("e");
      const t = setTimeout(() => {
        setDnaIntroSeen();
        setVisible(false);
        onComplete?.();
      }, 400);
      return () => clearTimeout(t);
    }

    const phases = [
      { phase: "a", delay: 200 },
      { phase: "b", delay: 450 },
      { phase: "c", delay: 300 },
      { phase: "d", delay: 450 },
      { phase: "e", delay: 400 },
    ];

    let i = 0;
    const timers = [];

    function runNext() {
      if (i >= phases.length) {
        setDnaIntroSeen();
        setVisible(false);
        onComplete?.();
        return;
      }
      const { phase: p, delay } = phases[i];
      setPhase(p);
      i++;
      const t = setTimeout(runNext, delay);
      timers.push(t);
    }

    runNext();
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const handleSkip = () => {
    setDnaIntroSeen();
    setVisible(false);
    onComplete?.();
  };

  if (!visible) return null;

  return (
    <div
      className={`dnaDiveIntro dnaDiveIntro--${phase} ${reduced.current ? "dnaDiveIntro--reduced" : ""}`}
      role="presentation"
      aria-hidden="true"
    >
      <div className="dnaDiveIntroOverlay" />
      <div className="dnaDiveIntroSite" aria-hidden="true" />
      <button
        type="button"
        className="dnaDiveIntroSkip"
        onClick={handleSkip}
        aria-label="Skip intro"
      >
        Skip
      </button>
    </div>
  );
}
