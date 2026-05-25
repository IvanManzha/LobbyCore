import React, { useEffect } from "react";
import Modal from "../Modal";

/** Краткие описания архетипов (RU). */
const ARCHETYPE_DESCRIPTIONS = {
  Aggressor:
    "Высокий комбат и давление. Игрок активно идёт в контакт и давит противника, доминирует в перестрелках.",
  Skirmisher:
    "Давление и комбат. Стиль быстрых перестрелок и контроля темпа — сквирмы и агрессивные ротации.",
  Closer:
    "Конвертация и комбат. Сильно добивает цели и выигрывает дуэли, превращает попадания в киллы.",
  Finisher:
    "Конвертация и комбат. Фокус на завершении фреймов — эффективно закрывает ноки и добивает врагов.",
  Tactician:
    "Позиционирование, командная игра и выживание. Умный выбор позиций и ротаций, игра головой.",
  Anchor:
    "Выживание и позиционирование. Держит точку, переживает круги и создаёт стабильность для команды.",
  Survivor:
    "Выживание и позиция в приоритете. Максимизирует шанс дожить до финальных кругов.",
  Stabilizer:
    "Командная игра и восстановление. Стабилизирует команду после потерь и отыгрывает сложные ситуации.",
  Support:
    "Командная игра и восстановление. Поддерживает союзников, отыгрывает ноки и перезаряжает команду.",
  Predator:
    "Высокий комбат. Агрессивный дуэлянт, ищет и выигрывает перестрелки.",
  Frontline:
    "Комбат или давление. Играет на передовой, принимает первый контакт и создаёт пространство.",
  Controller:
    "Позиционирование и выживание. Контролирует зону и позицию, минимизирует риски.",
  "All-Rounder":
    "Универсал без выраженного доминирования одного стиля. Сбалансированные гены.",
};

export default function ArchetypeExplanationModal({ open, onClose, archetype, mode = "why-this" }) {
  const overlayClass = "archetypeExplanationModal archetypeExplanationModal--dnaLab";
  const modalClass = "archetypeExplanationModal-modal archetypeExplanationModal-modal--dnaLab";
  const isWhatIsMode = mode === "what-is";

  const title = isWhatIsMode
    ? "Что такое архетип?"
    : archetype
      ? `Архетип: ${archetype}`
      : "Архетип";

  const baseDescription =
    "Архетип — это доминирующий стиль игры по генам DNA. Он показывает, за счёт каких сильных сторон (комбат, давление, выживание, позиционирование, командная игра и т.д.) игрок чаще всего выигрывает ситуации.";

  const archetypeSpecific =
    archetype && ARCHETYPE_DESCRIPTIONS[archetype]
      ? ARCHETYPE_DESCRIPTIONS[archetype]
      : null;

  const description = isWhatIsMode
    ? baseDescription
    : archetypeSpecific || baseDescription;

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
      title={title}
      onClose={onClose}
      overlayClassName={overlayClass}
      modalClassName={modalClass}
    >
      <p className="archetypeExplanationModal-text">{description}</p>
    </Modal>
  );
}
