import { create } from "zustand";

// Mobile-only drawer open state. `navDrawer` = top-nav (Header hamburger);
// `sidebarDrawer` = page sidebar (Chat sessions / Drive menu). Two separate
// concerns, two separate flags.
export const useUiStore = create((set) => ({
  navDrawerOpen: false,
  sidebarDrawerOpen: false,
  setNavDrawerOpen: (open) => set({ navDrawerOpen: open }),
  setSidebarDrawerOpen: (open) => set({ sidebarDrawerOpen: open }),
  closeAllDrawers: () => set({ navDrawerOpen: false, sidebarDrawerOpen: false }),
}));
