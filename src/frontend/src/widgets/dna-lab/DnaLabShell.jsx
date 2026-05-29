import React, { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { DnaLabShellProvider, useDnaLabShell } from "@/contexts/DnaLabShellContext";
import { useAuth } from "@/features/auth";
import DnaMiniHUD from "./DnaMiniHUD";
import { useDnaIntroSeen } from "./DnaDiveIntro";
import DnaLivingBackground from "./DnaLivingBackground";
import DnaHelpOverlay from "./DnaHelpOverlay";
import DnaShareDrawer from "./DnaShareDrawer";
import DnaMinimalHintOverlay from "./DnaMinimalHintOverlay";
import "../../pages/DnaLab.css";

function DnaLabShellInner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const shell = useDnaLabShell();
  const introSeen = useDnaIntroSeen();
  const [shortFadeClass, setShortFadeClass] = useState(() => (typeof window !== "undefined" && sessionStorage.getItem("dnaIntroSeen") === "1" ? "dnaLabShell--shortFade" : ""));

  useEffect(() => {
    if (!introSeen) return;
    const t = setTimeout(() => setShortFadeClass(""), 400);
    return () => clearTimeout(t);
  }, [introSeen]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.target?.closest?.("input") || e.target?.closest?.("textarea")) return;
      if (e.key === "Escape") {
        if (shell?.helpOpen) {
          shell?.setHelpOpen?.(false);
        } else if (shell?.hintOpen) {
          shell?.setHintOpen?.(false);
        } else if (shell?.dnaMinimal && shell?.activeTab === "genes" && shell?.focusMode) {
          shell?.setFocusMode?.(null);
        } else {
          navigate(-1);
        }
      } else if (e.key === "1") {
        shell?.setActiveTab?.("genes");
      } else if (e.key === "2") {
        shell?.setActiveTab?.("map");
      } else if (e.key === "d" || e.key === "D") {
        shell?.setInspectorOpen?.((o) => !o);
      } else if ((e.key === "h" || e.key === "H") && shell?.dnaMinimal && shell?.activeTab === "genes") {
        shell?.setHintOpen?.(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navigate, shell?.setInspectorOpen, shell?.setHelpOpen, shell?.helpOpen, shell?.setHintOpen, shell?.hintOpen, shell?.dnaMinimal, shell?.activeTab, shell?.focusMode, shell?.setFocusMode, shell?.setActiveTab]);

  const playerName = user?.pubgNick || user?.username || "Player";

  return (
    <div
      className={`dnaLabShell ${shortFadeClass}`.trim()}
      data-reduced-motion={shell?.reducedMotion ? "true" : undefined}
      data-minimal={shell?.dnaMinimal && shell?.activeTab === "genes" ? "true" : undefined}
      data-active-tab={shell?.activeTab ?? "genes"}
    >
      <DnaLivingBackground />
      <DnaMiniHUD
        activeTab={shell?.activeTab ?? "genes"}
        onTabChange={shell?.setActiveTab}
      />
      <div className="dnaLabShellMain">
        <Outlet context={{ dnaLabShell: shell, playerName }} />
      </div>
      {shell?.helpOpen && (
        <DnaHelpOverlay onClose={() => shell?.setHelpOpen?.(false)} />
      )}
      {shell?.shareOpen && (
        <DnaShareDrawer
          open={shell?.shareOpen}
          onClose={() => shell?.setShareOpen?.(false)}
          profile={shell?.shareContext?.profile ?? null}
          activeGeneKey={shell?.shareContext?.activeGeneKey ?? null}
          geneValue={shell?.shareContext?.geneValue ?? null}
        />
      )}
      {shell?.dnaMinimal && shell?.activeTab === "genes" && shell?.hintOpen && (
        <DnaMinimalHintOverlay
          onClose={() => shell?.setHintOpen?.(false)}
          onShowFullUI={() => shell?.setDnaMinimal?.(false)}
        />
      )}
    </div>
  );
}

/**
 * DNA Lab Shell: fullscreen mode, left HUD, no site chrome.
 * Renders when pathname === /dna-lab.
 */
export default function DnaLabShell() {
  const { user } = useAuth();

  return (
    <DnaLabShellProvider user={user}>
      <DnaLabShellInner />
    </DnaLabShellProvider>
  );
}
