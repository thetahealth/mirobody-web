import { create } from "zustand";
import { USER_ID } from "../../enum/storage";
import getWebSocketManager from "../../utils/websocket/WebSocketManager";
import { useUploadStore } from "../upload";

export const useDriveStore = create((set, get) => ({
  menu_expanded: false,
  setMenuExpanded: (expanded) =>
    set((state) => ({
      menu_expanded: typeof expanded === "boolean" ? expanded : !state.menu_expanded,
    })),
  current_drive_user_id: localStorage.getItem(USER_ID) || "",
  setCurrentDriveUserId: (userId) => {
    const oldUserId = get().current_drive_user_id;

    // Update state first
    set({ current_drive_user_id: userId });

    if (oldUserId !== userId && userId) {
      // Ensure new user's connection object exists
      getWebSocketManager().getConnection(userId);
      useUploadStore.getState().clearUploadingFiles();
    }
  },
}));
