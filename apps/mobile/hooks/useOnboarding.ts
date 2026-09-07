import { useState } from "react";
import { setStoredOnboardingDone } from "../lib/api";
import type { LibraryItem } from "../shared/everyyou/domain";

export function useOnboarding(library: LibraryItem[]) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingVariant, setOnboardingVariant] = useState<"fresh" | "linked">("fresh");

  async function finishOnboarding() {
    await setStoredOnboardingDone(true);
    setShowOnboarding(false);
    setOnboardingStep(0);
  }

  function nextOnboardingStep() {
    const lastStep = onboardingVariant === "linked" ? 1 : 2;
    if (onboardingStep >= lastStep) {
      void finishOnboarding();
      return;
    }
    setOnboardingStep((current) => current + 1);
  }

  async function skipOnboarding() {
    await setStoredOnboardingDone(true);
    setShowOnboarding(false);
    setOnboardingStep(0);
  }

  function replayOnboarding() {
    setOnboardingVariant(library.length > 0 ? "linked" : "fresh");
    setOnboardingStep(0);
    setShowOnboarding(true);
  }

  return {
    showOnboarding, onboardingStep, onboardingVariant,
    setShowOnboarding, setOnboardingStep, setOnboardingVariant,
    finishOnboarding, nextOnboardingStep, skipOnboarding, replayOnboarding,
  };
}
