import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getSeasons } from "../services/dnaApi";
import { resolveDnaEntry, setDnaLastMode } from '@/shared/lib/dnaPreferences';

const REDUCED_MOTION_KEY = "dnaReducedMotion";
const DNA_TEST_DB_KEY = "dnaUseTestDb";
const DNA_MINIMAL_KEY = "dnaMinimal";
const HELP_SEEN_KEY = "dnaHelpSeen";

const DnaLabShellContext = createContext(null);

export function DnaLabShellProvider({ children, user }) {
  const [seasonId, setSeasonId] = useState("2025");
  const [seasons, setSeasons] = useState(["2025", "2026"]);
  const [activeTab, setActiveTabRaw] = useState(() => resolveDnaEntry());

  const setActiveTab = useCallback((mode) => {
    setActiveTabRaw(mode);
    if (mode) {
      setDnaLastMode(mode);
    }
  }, []);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(REDUCED_MOTION_KEY) === "1";
  });
  const [helpOpen, setHelpOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareContext, setShareContext] = useState({ profile: null, activeGeneKey: null, geneValue: null });
  const [useDnaTest, setUseDnaTest] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(DNA_TEST_DB_KEY) === "1";
  });
  const [dnaMinimal, setDnaMinimal] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(DNA_MINIMAL_KEY);
    return stored === null || stored === "1";
  });
  /** Minimal scene focus: null (idle) | 'gene' | 'core'. Esc closes focus then back. */
  const [focusMode, setFocusMode] = useState(null);

  useEffect(() => {
    localStorage.setItem(DNA_TEST_DB_KEY, useDnaTest ? "1" : "0");
  }, [useDnaTest]);
  useEffect(() => {
    localStorage.setItem(DNA_MINIMAL_KEY, dnaMinimal ? "1" : "0");
  }, [dnaMinimal]);

  useEffect(() => {
    localStorage.setItem(REDUCED_MOTION_KEY, reducedMotion ? "1" : "0");
  }, [reducedMotion]);

  useEffect(() => {
    let cancelled = false;
    getSeasons()
      .then((res) => {
        if (!cancelled && Array.isArray(res?.seasons) && res.seasons.length > 0) {
          setSeasons(res.seasons);
          setSeasonId((prev) => (res.seasons.includes(prev) ? prev : res.seasons[0]));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const value = {
    user,
    seasonId,
    setSeasonId,
    seasons,
    activeTab,
    setActiveTab,
    inspectorOpen,
    setInspectorOpen,
    reducedMotion,
    setReducedMotion,
    helpOpen,
    setHelpOpen,
    hintOpen,
    setHintOpen,
    shareOpen,
    setShareOpen,
    shareContext,
    setShareContext,
    useDnaTest,
    setUseDnaTest,
    dnaMinimal,
    setDnaMinimal,
    focusMode,
    setFocusMode,
    HELP_SEEN_KEY,
  };

  return (
    <DnaLabShellContext.Provider value={value}>
      {children}
    </DnaLabShellContext.Provider>
  );
}

export function useDnaLabShell() {
  const ctx = useContext(DnaLabShellContext);
  return ctx;
}
