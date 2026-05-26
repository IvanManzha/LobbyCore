import React from "react";
import tier1Img from "../../assets/dna-tiers/1 тир-edited-free (carve.photos).png";
import tier2Img from "../../assets/dna-tiers/2 тир-edited-free (carve.photos) (3).png";
import tier3Img from "../../assets/dna-tiers/3 тир-no-bg-preview (carve.photos).png";
import tier4Img from "../../assets/dna-tiers/4 тир-edited-free (carve.photos) (3).png";
import tier5Img from "../../assets/dna-tiers/5 тир-edited-free (carve.photos).png";
import tier6Img from "../../assets/dna-tiers/6 тир-edited-free (carve.photos).png";
import tier7Img from "../../assets/dna-tiers/7 тир-edited-free (carve.photos).png";
import tier8Img from "../../assets/dna-tiers/8 тир-no-bg-preview (carve.photos).png";

const TIER_CONFIG = {
  1: { label: "Tier 1", src: tier1Img },
  2: { label: "Tier 2", src: tier2Img },
  3: { label: "Tier 3", src: tier3Img },
  4: { label: "Tier 4", src: tier4Img },
  5: { label: "Tier 5", src: tier5Img },
  6: { label: "Tier 6", src: tier6Img },
  7: { label: "Tier 7", src: tier7Img },
  8: { label: "Tier 8", src: tier8Img },
};

export default function DnaTierBadge({ tier }) {
  const t = Number.isFinite(tier) ? tier : 1;
  const cfg = TIER_CONFIG[t] || TIER_CONFIG[1];

  return (
    <span className={`dnaTierBadge dnaTierBadge--tier-${t}`} title={`${cfg.label}`}>
      <img src={cfg.src} alt={cfg.label} className="dnaTierBadgeImage" />
    </span>
  );
}

