import { create } from "zustand";
import api from "../api";
import { useSystemStore } from "./system";
import { useAccountStore } from "./account";
import consola from "consola";
import { useDriveStore } from "./Drive";

export const useVitalStore = create((set, get) => ({
  // Internal state: AbortControllers
  _pulseProvidersController: null,

  providers_list: [],
  loading_providers: false,
  total_providers: 0,
  setProvidersList: (providersList) => {
    set({ providers_list: providersList });
  },

  fetchProvidersList: async () => {
    const { _pulseProvidersController } = get();
    const { isShowMobileSource } = useSystemStore.getState();

    // Skip request if mobile source is not enabled
    if (!isShowMobileSource) {
      set({ providers_list: [], total_providers: 0, loading_providers: false });
      return;
    }

    // Cancel previous request if exists
    if (_pulseProvidersController) {
      _pulseProvidersController.abort();
    }

    // Create new controller and store it
    const newController = new AbortController();
    set({ _pulseProvidersController: newController, loading_providers: true, providers_list: [] });
    const { current_drive_user_id } = useDriveStore.getState();
    const { user_id: currentUserId } = useAccountStore.getState();
    try {
      // Only pass owner_user_id when viewing other user's data
      const data =
        current_drive_user_id && current_drive_user_id !== currentUserId
          ? { owner_user_id: current_drive_user_id }
          : {};
      const { providers, total } = await api.getPulseProviders({
        signal: newController.signal,
        data,
      });
      set({
        providers_list: providers || [],
        total_providers: total || 0,
        loading_providers: false,
        _pulseProvidersController: null,
      });
    } catch (error) {
      if (error.name === "AbortError" || error.name === "CanceledError") {
        return;
      }
      consola.error("ERROR: fetchProvidersList", error);
      set({ loading_providers: false, _pulseProvidersController: null });
    }
  },

}));
