import { create } from "zustand";
import { TOUR_STEPS, anchorSelector } from "../components/OnboardingTour/steps.js";

// The sidebar walkthrough's switch.
//
// A store rather than state inside the component because there are two triggers
// and they are nowhere near each other: the automatic first run (the component
// itself) and "见过了还想再看" in the account menu, several levels down the
// sidebar. A store saves threading a prop through or inventing a DOM event.
//
// The seen flag is per user id: the same browser signing in as someone else
// should see it again, because the tour describes THEIR sidebar.
const FLAG_PREFIX = "ONBOARDING_TOUR_SEEN_";
const flagKey = (userId) => `${FLAG_PREFIX}${userId}`;

// Both accessors swallow their errors: with site data blocked the tour degrades
// to "plays once per sign-in", which is worse than remembering but far better
// than throwing on the way into the product.
export const hasSeenTour = (userId) => {
  if (!userId) return true; // don't play before we know who this is
  try {
    return localStorage.getItem(flagKey(userId)) === "1";
  } catch {
    return false;
  }
};

export const markTourSeen = (userId) => {
  if (!userId) return;
  try {
    localStorage.setItem(flagKey(userId), "1");
  } catch {
    // Ignored: not remembered this time, so it plays again next sign-in.
  }
};

export const useTourStore = create((set) => ({
  open: false,
  // The steps this run will actually play — key + anchor only. The copy is read
  // at render time so switching language mid-tour re-translates it.
  steps: [],

  // Filtering happens here, not in the component's effect: whether a target
  // exists is a fact about the DOM, and reading it in the action makes the
  // snapshot taken at open time the whole run's definition — the sidebar
  // cannot change the step list out from under a tour that is already playing.
  start: () =>
    set({
      open: true,
      steps: TOUR_STEPS.filter(
        (s) => !s.anchor || document.querySelector(anchorSelector(s.anchor)),
      ),
    }),

  close: () => set({ open: false, steps: [] }),
}));
