import React, { useEffect, useState } from "react";
import { Modal } from '@/shared/ui';
import tier1Img from "../../assets/dna-tiers/1 тир-edited-free (carve.photos).png";
import tier2Img from "../../assets/dna-tiers/2 тир-edited-free (carve.photos) (3).png";
import tier3Img from "../../assets/dna-tiers/3 тир-no-bg-preview (carve.photos).png";
import tier4Img from "../../assets/dna-tiers/4 тир-edited-free (carve.photos) (3).png";
import tier5Img from "../../assets/dna-tiers/5 тир-edited-free (carve.photos).png";
import tier6Img from "../../assets/dna-tiers/6 тир-edited-free (carve.photos).png";
import tier7Img from "../../assets/dna-tiers/7 тир-edited-free (carve.photos).png";
import tier8Img from "../../assets/dna-tiers/8 тир-no-bg-preview (carve.photos).png";

/** Границы рейтинга для тиров (совпадают с dnaEngine: 800–2200, 8 тиров). */
const DNA_RATING_MIN = 800;
const DNA_RATING_MAX = 2200;
const TIER_COUNT = 8;
const STEP = (DNA_RATING_MAX - DNA_RATING_MIN) / TIER_COUNT;

const TIER_IMGS = {
  1: tier1Img,
  2: tier2Img,
  3: tier3Img,
  4: tier4Img,
  5: tier5Img,
  6: tier6Img,
  7: tier7Img,
  8: tier8Img,
};

function getTierRanges() {
  const ranges = [];
  for (let t = 1; t <= TIER_COUNT; t++) {
    const min = Math.round(DNA_RATING_MIN + (t - 1) * STEP);
    ranges.push({ tier: t, min });
  }
  return ranges;
}

const TIER_RANGES = getTierRanges();

export default function TierExplanationModal({ open, onClose, variant = "dnaLab" }) {
  const overlayClass = `tierExplanationModal tierExplanationModal--${variant}`;
  const modalClass = `tierExplanationModal-modal tierExplanationModal-modal--${variant}`;
  const [hoveredTier, setHoveredTier] = useState(null);

  useEffect(() => {
    try {
      if (open) {
        document.body?.setAttribute("data-dna-modal-open", "true");
      } else {
        document.body?.removeAttribute("data-dna-modal-open");
      }
    } catch {
      // ignore
    }
    return () => {
      try {
        document.body?.removeAttribute("data-dna-modal-open");
      } catch {
        // ignore
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <Modal
      title="DNA тиры: рейтинг"
      onClose={onClose}
      overlayClassName={overlayClass}
      modalClassName={modalClass}
    >
      <p className="tierExplanationModal-text">
        Рейтинг DNA лежит в диапазоне 800–2200 и делится на 8 тиров. Наведи на эмблему, чтобы увидеть рейтинг для выбранного тира.
      </p>
      <div
        className="tierExplanationModal-grid"
        onMouseLeave={() => setHoveredTier(null)}
      >
        {TIER_RANGES.map(({ tier }) => (
          <button
            key={tier}
            type="button"
            className={`tierExplanationModal-tierItem ${tier === 4 ? "tier-row-4" : "tier-row-other"} ${
              hoveredTier === tier ? "is-active" : ""
            }`}
            onMouseEnter={() => setHoveredTier(tier)}
          >
            <img src={TIER_IMGS[tier]} alt="" className="tierExplanationModal-tierImg" />
            <span className="tierExplanationModal-tierLabel">Тир {tier}</span>
          </button>
        ))}
      </div>
      <div className="tierExplanationModal-rangePanel">
        {(() => {
          const current =
            hoveredTier != null
              ? TIER_RANGES.find((r) => r.tier === hoveredTier)
              : null;
          const value = current ? `${current.min}+` : "";
          return (
            <span
              className={`tierExplanationModal-rangeText${
                hoveredTier != null ? " is-visible" : ""
              }`}
            >
              {value}
            </span>
          );
        })()}
      </div>
    </Modal>
  );
}
