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
  // Whose numbers these are: the person the switcher pointed at when they
  // were asked for, or null before the first answer. The zeros above are
  // placeholders until this is set, so "no data" means `total_records === 0`
  // AND this matching the person on screen — otherwise a first render, or a
  // switch to someone new, reads as an empty record.
  distribution_user_id: null,
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
        distribution_user_id: current_drive_user_id,
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
