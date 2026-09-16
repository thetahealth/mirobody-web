import { create } from "zustand";

// Shell UI state.
//
// `sidebarDrawerOpen` is mobile-only: the sidebar is the app's one navigation
// surface, and on phones it opens in a drawer — from the top bar's hamburger,
// or from a page header pointing at the list it holds.
//
// `sidebarCollapsed` is desktop-only: the icon rail. Persisted because it is a
// standing preference about how much screen the chrome gets, not a per-visit
// choice — being expanded again on every reload is the whole reason people
// stop using a collapse.
const SIDEBAR_COLLAPSED = "SIDEBAR_COLLAPSED";

// Reading localStorage can throw (private windows, blocked site data), and a
// preference about sidebar width is never worth failing the app over.
const readCollapsed = () => {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED) === "1";
  } catch {
    return false;
  }
};

export const useUiStore = create((set, get) => ({
  sidebarDrawerOpen: false,
  setSidebarDrawerOpen: (open) => set({ sidebarDrawerOpen: open }),

  sidebarCollapsed: readCollapsed(),
  toggleSidebarCollapsed: () => {
    const next = !get().sidebarCollapsed;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED, next ? "1" : "0");
    } catch {
      // Ignored: not remembered, but the rail still collapses this session.
    }
    set({ sidebarCollapsed: next });
  },
}));
