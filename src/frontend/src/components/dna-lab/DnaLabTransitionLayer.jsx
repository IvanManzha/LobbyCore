import React from "react";

/**
 * Fullscreen overlay: underlay (dark) + snapshot (fly animation) + Skip.
 * Capturing: underlay only. Flying: underlay + snapshot with perspective/scale/blur.
 * Portaled to body by DnaLabEntryContext.
 */
const DNA_TRANSITION_LOG = "[DNA-Transition]";

export default function DnaLabTransitionLayer({
  phase,
  captureDataUrl,
  onSkip,
  reducedMotion,
}) {
  const showSnapshot = Boolean(captureDataUrl);
  console.log(DNA_TRANSITION_LOG, "TransitionLayer render", {
    phase,
    showSnapshot,
    captureDataUrlLen: captureDataUrl?.length ?? 0,
    reducedMotion,
  });

  const phaseClass =
    phase === "flying-b"
      ? "dnaTransition--b"
      : phase === "flying-c"
        ? "dnaTransition--c"
        : phase === "flying-d"
          ? "dnaTransition--d"
          : "dnaTransition--a";

  return (
    <div
      className={`dnaLabTransitionLayer ${phaseClass} ${reducedMotion ? "dnaLabTransitionLayer--reduced" : ""}`}
      role="presentation"
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, zIndex: 99999, width: "100vw", height: "100vh" }}
    >
      <div className="dnaTransitionUnderlay" />
      <div className="dnaLabTransitionBg" />
      {showSnapshot && (
        <div className="dnaLabTransitionCaptureWrap">
          <img
            src={captureDataUrl}
            alt=""
            className="dnaLabTransitionCapture"
          />
        </div>
      )}
      <button
        type="button"
        className="dnaLabTransitionSkip"
        onClick={onSkip}
        aria-label="Skip intro"
      >
        Skip
      </button>
    </div>
  );
}
