import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setDnaLastMode } from '@/shared/lib/dnaPreferences';

export default function DnaMapRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    setDnaLastMode("map");
    navigate("/dna-lab", { replace: true });
  }, [navigate]);

  return null;
}

