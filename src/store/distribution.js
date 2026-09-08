import { create } from "zustand";
import api from "../api";
import { useDriveStore } from "./Drive";
import { useAccountStore } from "./account";
import consola from "consola";

export const useDistributionStore = create((set, get) => ({
  // Internal state: AbortController
  _distributionController: null,

  distribution_list: [],
  total_categories: 0,
  total_records: 0,
  loading_distribution: false,

  fetchDistribution: async () => {
    const { _distributionController } = get();

    // Cancel previous request if exists
    if (_distributionController) {
      _distributionController.abort();
    }

    // Create new controller and store it
    const newController = new AbortController();
    set({ _distributionController: newController, loading_distribution: true });

    try {
      const { current_drive_user_id } = useDriveStore.getState();
      const { user_id: currentUserId } = useAccountStore.getState();
      // Only pass user_id when viewing other user's data
      const params =
        current_drive_user_id && current_drive_user_id !== currentUserId
          ? { user_id: current_drive_user_id }
          : {};
      const { distribution, total_categories, total_records } =
        await api.dataDistribution(params, newController.signal);
      set({
        distribution_list: distribution,
        total_categories: total_categories,
        total_records: total_records,
        loading_distribution: false,
        _distributionController: null,
      });
    } catch (error) {
      if (error.name === "AbortError" || error.name === "CanceledError") {
        return;
      }
      consola.error("ERROR: fetchDistribution", error);
      set({ loading_distribution: false, _distributionController: null });
    }
  },
}));
