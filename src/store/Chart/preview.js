import { create } from "zustand";

export const useChatPreviewStore = create((set) => ({
  is_show_preview: false,
  setIsShowPreview: (is_show_preview) => {
    set({ is_show_preview });
  },
  preview_file: null,
  setPreviewFile: (preview_file) => {
    set({ preview_file });
  },
}));
