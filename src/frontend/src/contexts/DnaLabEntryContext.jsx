import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { toPng } from "html-to-image";
import { useTranslation } from "./LanguageContext";
import DnaLabTransitionLayer from "../components/dna-lab/DnaLabTransitionLayer";

const INTRO_SEEN_KEY = "dnaIntroSeen";
const DNA_TRANSITION_LOG = "[DNA-Transition]";

function getIntroPlayed() {
  if (typeof window === "undefined") return true;
  if (new URLSearchParams(window.location.search).get("dnaForceIntro") === "1") return false;
  return sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
}

function setIntroPlayed() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(INTRO_SEEN_KEY, "1");
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const DnaLabEntryContext = createContext(null);

export function useDnaLabEntry() {
  const ctx = useContext(DnaLabEntryContext);
  return ctx;
}

const CAPTURE_SELECTOR = "[data-dna-capture-root]";

/** FSM: idle | confirm | capturing | flying | revealingDNA | done */
const PHASE_TIMING = {
  a: 220,
  b: 750,
  c: 400,
  d: 900,
};
const TRANSITION_PHASES = ["flying", "flying-a", "flying-b", "flying-c", "flying-d", "revealingDNA"];

function addBodyTransitionClass() {
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("dna-transition");
    document.body.classList.add("dna-transition");
  }
}

function removeBodyTransitionClass() {
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("dna-transition");
    document.body.classList.remove("dna-transition");
  }
}

export function DnaLabEntryProvider({ children }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("idle");
  const [captureDataUrl, setCaptureDataUrl] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fullscreenPreferred, setFullscreenPreferred] = useState(true);
  const reducedMotion = useRef(prefersReducedMotion());
  const animTimers = useRef([]);

  const finishTransition = useCallback(() => {
    console.log(DNA_TRANSITION_LOG, "finishTransition");
    setIntroPlayed();
    setPhase("done");
    setCaptureDataUrl(null);
    removeBodyTransitionClass();
  }, []);

  const finishAndNavigate = useCallback(() => {
    console.log(DNA_TRANSITION_LOG, "finishAndNavigate");
    navigate("/dna-lab");
    finishTransition();
  }, [navigate, finishTransition]);

  const requestDnaLabEntry = useCallback(() => {
    const introPlayed = getIntroPlayed();
    const forceIntro = new URLSearchParams(window.location.search).get("dnaForceIntro") === "1";
    let hint = "add ?dnaForceIntro=1 to URL to force transition";
    if (introPlayed && !forceIntro) hint = "clear sessionStorage.dnaIntroSeen or add ?dnaForceIntro=1";
    console.log(DNA_TRANSITION_LOG, "requestDnaLabEntry", { phase, introPlayed, forceIntro, hint });
    if (phase !== "idle" && phase !== "done") {
      console.log(DNA_TRANSITION_LOG, "requestDnaLabEntry blocked: phase not idle/done");
      return;
    }
    if (introPlayed) {
      console.log(DNA_TRANSITION_LOG, "requestDnaLabEntry: intro already seen, navigating directly (no transition)");
      navigate("/dna-lab");
      return;
    }
    console.log(DNA_TRANSITION_LOG, "requestDnaLabEntry: showing confirm modal");
    addBodyTransitionClass();
    setConfirmOpen(true);
    setPhase("confirm");
  }, [navigate, phase]);

  const closeConfirm = useCallback(() => {
    console.log(DNA_TRANSITION_LOG, "closeConfirm");
    setConfirmOpen(false);
    setPhase("idle");
    removeBodyTransitionClass();
  }, []);

  const startDive = useCallback(async () => {
    console.log(DNA_TRANSITION_LOG, "startDive", { phase, fullscreenPreferred, reducedMotion: reducedMotion.current });
    if (phase !== "confirm") {
      console.log(DNA_TRANSITION_LOG, "startDive blocked: phase !== confirm");
      return;
    }
    setConfirmOpen(false);
    if (fullscreenPreferred && document.documentElement.requestFullscreen) {
      try {
        console.log(DNA_TRANSITION_LOG, "startDive: requesting fullscreen");
        await document.documentElement.requestFullscreen();
      } catch (e) {
        console.warn(DNA_TRANSITION_LOG, "startDive: fullscreen failed", e);
      }
    }

    setPhase("capturing");
    console.log(DNA_TRANSITION_LOG, "startDive: phase=capturing");
    const el = document.querySelector(CAPTURE_SELECTOR);
    if (!el) {
      console.error(DNA_TRANSITION_LOG, "startDive: CAPTURE_SELECTOR not found, skipping to DNA Lab");
      finishAndNavigate();
      return;
    }
    console.log(DNA_TRANSITION_LOG, "startDive: capture element found", el);

    const origPointerEvents = el.style.pointerEvents;
    el.style.pointerEvents = "none";

    try {
      console.log(DNA_TRANSITION_LOG, "startDive: toPng capture start");
      const dataUrl = await toPng(el, {
        pixelRatio: window.devicePixelRatio || 1,
        cacheBust: true,
      });
      el.style.pointerEvents = origPointerEvents;
      console.log(DNA_TRANSITION_LOG, "startDive: toPng capture done", { dataUrlLen: dataUrl?.length ?? 0 });
      setCaptureDataUrl(dataUrl);

      console.log(DNA_TRANSITION_LOG, "startDive: waiting 2 rAF for snapshot paint");
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      setPhase("flying");
      console.log(DNA_TRANSITION_LOG, "startDive: phase=flying, navigating early for data preload");
      navigate("/dna-lab");
      console.log(DNA_TRANSITION_LOG, "startDive: scheduling animation phases");

      if (reducedMotion.current) {
        console.log(DNA_TRANSITION_LOG, "startDive: reducedMotion, skipping fly animation");
        const t = setTimeout(finishAndNavigate, 350);
        animTimers.current.push(t);
        return;
      }

      const total = PHASE_TIMING.a + PHASE_TIMING.b + PHASE_TIMING.c + PHASE_TIMING.d;
      console.log(DNA_TRANSITION_LOG, "startDive: timings", { ...PHASE_TIMING, total });

      let t1 = setTimeout(() => setPhase("flying-a"), 0);
      animTimers.current.push(t1);
      let t2 = setTimeout(() => setPhase("flying-b"), PHASE_TIMING.a);
      animTimers.current.push(t2);
      let t3 = setTimeout(() => setPhase("flying-c"), PHASE_TIMING.a + PHASE_TIMING.b);
      animTimers.current.push(t3);
      let t4 = setTimeout(
        () => setPhase("flying-d"),
        PHASE_TIMING.a + PHASE_TIMING.b + PHASE_TIMING.c
      );
      animTimers.current.push(t4);
      let t5 = setTimeout(() => finishTransition(), total);
      animTimers.current.push(t5);
    } catch (err) {
      console.error(DNA_TRANSITION_LOG, "startDive: error", err);
      el.style.pointerEvents = origPointerEvents;
      finishAndNavigate();
    }
  }, [fullscreenPreferred, finishAndNavigate, finishTransition, phase, navigate]);

  useEffect(() => {
    return () => {
      animTimers.current.forEach(clearTimeout);
      animTimers.current = [];
    };
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== "Escape") return;
      if (phase === "confirm") {
        closeConfirm();
      } else if (phase === "capturing" || TRANSITION_PHASES.includes(phase)) {
        finishAndNavigate();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [phase, closeConfirm, finishAndNavigate]);

  const value = {
    requestDnaLabEntry,
    phase,
    captureDataUrl,
    confirmOpen,
    closeConfirm,
    startDive,
    fullscreenPreferred,
    setFullscreenPreferred,
    finishAndNavigate,
    reducedMotion: reducedMotion.current,
  };

  const showTransitionLayer = TRANSITION_PHASES.includes(phase);
  if (showTransitionLayer) {
    console.log(DNA_TRANSITION_LOG, "render TransitionLayer", { phase, hasCapture: Boolean(captureDataUrl) });
  }
  const transitionLayerContent =
    showTransitionLayer &&
    createPortal(
      <DnaLabTransitionLayer
        phase={phase}
        captureDataUrl={captureDataUrl}
        onSkip={finishAndNavigate}
        reducedMotion={reducedMotion.current}
      />,
      document.body
    );

  return (
    <DnaLabEntryContext.Provider value={value}>
      {children}
      {confirmOpen && (
        <DnaLabConfirmModal
          onConfirm={startDive}
          onCancel={closeConfirm}
          fullscreenPreferred={fullscreenPreferred}
          onFullscreenChange={setFullscreenPreferred}
        />
      )}
      {transitionLayerContent}
    </DnaLabEntryContext.Provider>
  );
}

function DnaLabConfirmModal({
  onConfirm,
  onCancel,
  fullscreenPreferred,
  onFullscreenChange,
}) {
  const { t } = useTranslation();

  const content = (
    <div
      className="dnaLabConfirmOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dna-lab-confirm-title"
    >
      <div className="dnaLabConfirmBackdrop" onClick={onCancel} aria-hidden="true" />
      <div className="dnaLabConfirmModal">
        <h2 id="dna-lab-confirm-title" className="dnaLabConfirmTitle">
          {t("dnaLab.enterTitle")}
        </h2>
        <p className="dnaLabConfirmSubtitle">{t("dnaLab.enterSubtitle")}</p>
        <label className="dnaLabConfirmFullscreen">
          <input
            type="checkbox"
            checked={fullscreenPreferred}
            onChange={(e) => onFullscreenChange(e.target.checked)}
          />
          <span className="dnaLabConfirmFullscreenLabel">{t("dnaLab.fullscreenLabel")}</span>
        </label>
        <p className="dnaLabConfirmFullscreenHint">{t("dnaLab.fullscreenHint")}</p>
        <div className="dnaLabConfirmActions">
          <button type="button" className="dnaLabConfirmBtn dnaLabConfirmBtnPrimary" onClick={onConfirm}>
            {t("dnaLab.dive")}
          </button>
          <button type="button" className="dnaLabConfirmBtn dnaLabConfirmBtnSecondary" onClick={onCancel}>
            {t("dnaLab.cancel")}
          </button>
        </div>
        <p className="dnaLabConfirmHints">
          {t("dnaLab.hintEsc")} · {t("dnaLab.hintH")}
        </p>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
