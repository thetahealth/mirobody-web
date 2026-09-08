import { create } from "zustand";

export const useChatMenuStore = create((set) => ({
  is_menu_open: false,
  switchChatMenu: () => {
    set((state) => ({ is_menu_open: !state.is_menu_open }));
  },
  currentPersonName: "",
  setCurrentPersonName: (currentPersonName) => {
    set({ currentPersonName });
  },
}));
