import React from "react";
import DnaReplayViewerShell from "./DnaReplayViewerShell";
import { useDnaMapStudio } from "@/widgets/dna-map/useDnaMapStudio";
import { useAuth } from "@/features/auth";
import { useDnaLabShell } from "@/contexts/DnaLabShellContext";
import { DEVELOPERS } from "@/shared/config/app";

export default function DnaLabMapView() {
  const { user } = useAuth();
  const shell = useDnaLabShell();
  const playerId = (user?.pubgNick || user?.username || "").trim();
  const isDeveloper = DEVELOPERS.includes((playerId || "").toLowerCase());
  const useDnaTestFromShell = Boolean(isDeveloper && shell?.useDnaTest);

  const studio = useDnaMapStudio({
    autoLoadLastMatch: false,
    replayViewerMode: true,
    initialPrimaryId: playerId || "",
    initialUseDnaTest: useDnaTestFromShell,
    devTools: isDeveloper,
  });

  return (
    <div className="dnaLabMapHost">
      <DnaReplayViewerShell studio={studio} />
    </div>
  );
}
