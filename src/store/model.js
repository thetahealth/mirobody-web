import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  SELECTED_MODELS_AGENTS,
  SELECTED_MODELS_AGENTS_CN,
  SELECTED_PROMPT,
  SELECTED_PROMPT_CN,
} from "../enum/storage";
import { useSystemStore } from "./system";
import api from "../api";
import consola from "consola";

/**
 * One model id per entry. There used to be an `agent` dimension here: the
 * backend answered `GET /api/models` with `"Agent/provider"` strings and this
 * store split them on `/`, so a selection was a (agent, model) pair and the
 * dropdown grouped by agent.
 *
 * Mirobody 1.4.0 removed that: there is one agent, `/api/models` returns bare
 * provider names, and `/api/agents` is gone. So the model id IS the provider
 * name and there is nothing to split.
 *
 * @param {string} name - e.g. "gpt-5.2"
 * @returns {{ id: string, provider: string, show_name: string }}
 */
const parseModelName = (name) => ({
  id: name,
  provider: name,
  show_name: name,
});

/**
 * Get storage key based on environment
 * @returns {string}
 */
const getModelsStorageKey = () => {
  const { isCNEnvironment } = useSystemStore.getState();
  return isCNEnvironment ? SELECTED_MODELS_AGENTS_CN : SELECTED_MODELS_AGENTS;
};

/**
 * Load selected model IDs from localStorage.
 *
 * A stored id from before 1.4.0 looks like `"Deep/gpt-5.2"`. Migrated in place
 * rather than discarded: dropping it would silently reset every existing
 * user's model choice on first load after the upgrade, and the provider half
 * is exactly the new id. The storage KEY is unchanged for the same reason.
 *
 * @returns {string[]}
 */
const loadSelectedModelIds = () => {
  try {
    const stored = localStorage.getItem(getModelsStorageKey());
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((id) => typeof id === "string" && id)
          .map((id) => (id.includes("/") ? id.split("/").slice(1).join("/") : id));
      }
    }
  } catch {
    // ignore parse errors
  }
  return [];
};

/**
 * Save selected model IDs to localStorage
 * @param {string[]} selectedIds
 */
const saveSelectedModelIds = (selectedIds) => {
  try {
    localStorage.setItem(getModelsStorageKey(), JSON.stringify(selectedIds));
  } catch {
    // ignore save errors
  }
};

/**
 * Compute vs_list from model_list.
 *
 * `vs_list` keeps its name: it is the compare selection, not an agent concept,
 * and it is read in sixteen places (send button, chart store, `canSend`).
 * Renaming it would be churn with no behaviour behind it.
 *
 * @param {Array} model_list
 * @returns {Array}
 */
const computeVsList = (model_list) => {
  return model_list
    .filter((m) => m.is_selected)
    .map(({ id, provider, show_name }) => ({ id, provider, show_name }));
};

/**
 * Apply disabled state based on selection count
 * If 2 items are selected, disable all unselected items
 * @param {Array} list - mutable draft array from immer
 */
const applyDisabledState = (list) => {
  const selectedCount = list.filter((m) => m.is_selected).length;
  list.forEach((m) => {
    m.is_disabled = !m.is_selected && selectedCount >= 2;
  });
};

export const useModelStore = create(
  immer((set, get) => ({
    // Internal state: AbortControllers
    _promptsController: null,
    _modelListController: null,

    /* init */
    init: () => {
      const { fetchPromptList, fetchModelList } = get();
      fetchModelList();
      fetchPromptList();
    },

    /* model dropdown ui state */
    is_open: false,
    setIsOpen: (is_open = false) => {
      set((state) => {
        state.is_open = is_open;
      });
    },

    /* model_list - the models GET /api/models offers */
    model_list: [],

    /* vs_list - list of selected models for comparison */
    vs_list: [],

    /**
     * Fetch models from API and initialize selection state
     */
    fetchModelList: async () => {
      const { _modelListController } = get();

      // Cancel previous request if exists
      if (_modelListController) {
        _modelListController.abort();
      }

      // Create new controller and store it
      const newController = new AbortController();
      set((state) => {
        state._modelListController = newController;
      });

      try {
        const res = await api.getModels({ signal: newController.signal });

        // Load saved selection from localStorage
        const savedSelectedIds = loadSelectedModelIds();

        // Parse API response and apply selection state
        const model_list = res.map((name) => {
          const parsed = parseModelName(name);
          return {
            ...parsed,
            is_selected: savedSelectedIds.includes(parsed.id),
            is_disabled: false,
          };
        });

        // Default to the first model the backend offers. This used to prefer
        // an entry whose agent was "Deep", because the alternative
        // (`BaseAgent`) had no virtual filesystem, no QuickJS and no charting
        // — defaulting there meant a new user's first question ran on the
        // agent that could not draw the chart or read the PDF they had just
        // uploaded. There is one agent now, so every entry has that capability
        // and the preference has nothing left to express.
        const selectedCount = model_list.filter((m) => m.is_selected).length;
        if (selectedCount === 0 && model_list.length > 0) {
          model_list[0].is_selected = true;
          saveSelectedModelIds([model_list[0].id]);
        }

        // Apply disabled state (max 2 selected)
        applyDisabledState(model_list);

        // Compute vs_list from updated model_list
        const vs_list = computeVsList(model_list);

        set((state) => {
          state.model_list = model_list;
          state.vs_list = vs_list;
          state._modelListController = null;
        });
      } catch (error) {
        if (error.name === "AbortError" || error.name === "CanceledError") {
          return;
        }
        consola.error("ERROR: fetchModelList", error);
        set((state) => {
          state._modelListController = null;
        });
      }
    },

    /**
     * Toggle model selection
     * Rules: max 2 selected, min 1 selected
     * @param {string} id - model id
     */
    toggleModel: (id) => {
      const { model_list } = get();

      const targetIndex = model_list.findIndex((m) => m.id === id);
      if (targetIndex === -1) return;

      const targetModel = model_list[targetIndex];
      const selectedCount = model_list.filter((m) => m.is_selected).length;

      // If trying to deselect and only 1 selected, do nothing (min 1 rule)
      if (targetModel.is_selected && selectedCount === 1) {
        return;
      }

      // If trying to select and already 2 selected, do nothing (max 2 rule)
      if (!targetModel.is_selected && selectedCount >= 2) {
        return;
      }

      set((state) => {
        // Toggle selection
        state.model_list[targetIndex].is_selected =
          !state.model_list[targetIndex].is_selected;

        // Apply disabled state
        applyDisabledState(state.model_list);

        // Update vs_list
        state.vs_list = computeVsList(state.model_list);

        // Save to localStorage
        const newSelectedIds = state.model_list
          .filter((m) => m.is_selected)
          .map((m) => m.id);
        saveSelectedModelIds(newSelectedIds);
      });
    },

    /**
     * Select exactly one model, deselecting all others (mobile: no compare).
     * @param {string} id
     */
    selectSingleModel: (id) => {
      const { model_list } = get();
      if (model_list.findIndex((m) => m.id === id) === -1) return;
      set((state) => {
        state.model_list.forEach((m) => {
          m.is_selected = m.id === id;
          m.is_disabled = false;
        });
        state.vs_list = computeVsList(state.model_list);
        saveSelectedModelIds([id]);
      });
    },

    /**
     * Collapse a multi-model (compare) selection down to one. Used on mobile,
     * where a 2-model selection carried over from desktop must not start a
     * compare conversation. No-op when 0 or 1 selected.
     */
    enforceSingleModel: () => {
      const selected = get().model_list.filter((m) => m.is_selected);
      if (selected.length <= 1) return;
      get().selectSingleModel(selected[0].id);
    },

    /**
     * Get model show name by provider.
     *
     * Took `(provider, agent)` before 1.4.0 and matched on both. Messages from
     * `/api/history` still carry an `agent` field (`th_messages.agent` now
     * holds `"Mirobody"`), and it must not be branched on — so the second
     * argument is gone rather than ignored, which makes a stale caller a
     * lint error instead of a silent mismatch.
     *
     * @param {string} provider
     * @returns {string}
     */
    getModelShowName: (provider) => {
      const { model_list } = get();
      const found = model_list.find((m) => m.provider === provider);
      return found ? found.show_name : provider || "";
    },

    /* prompts */
    prompt_list: [],
    selected_prompt_id: null,

    fetchPromptList: async () => {
      const { _promptsController } = get();

      // Cancel previous request if exists
      if (_promptsController) {
        _promptsController.abort();
      }

      // Create new controller and store it
      const newController = new AbortController();
      set((state) => {
        state._promptsController = newController;
      });

      try {
        const { isCNEnvironment } = useSystemStore.getState();
        const res = await api.getPrompts({ signal: newController.signal });

        const storageKey = isCNEnvironment
          ? SELECTED_PROMPT_CN
          : SELECTED_PROMPT;
        let selected_prompt_id = null;
        try {
          const stored = localStorage.getItem(storageKey);
          selected_prompt_id = stored || null;
        } catch {
          selected_prompt_id = null;
        }

        // System templates only. `/api/prompts` answered `{system, user}`
        // before 1.4.0; the per-user prompt store and its four endpoints are
        // gone (nothing in this client ever wrote one), so the response is
        // `{"system": [...]}` and there is no `user` list to merge.
        const prompt_list = (Array.isArray(res.system) ? res.system : []).map(
          (prompt_obj) => ({
            id: `system_${prompt_obj.name}`,
            name: prompt_obj.name,
            show_name: prompt_obj.name,
            type: "system",
            is_selected: false,
          }),
        );

        // Default selection: the first template.
        if (!selected_prompt_id && prompt_list.length > 0) {
          selected_prompt_id = prompt_list[0].id;
          localStorage.setItem(storageKey, selected_prompt_id);
        }

        // A stored id from before this change may name a user template that no
        // longer exists. Fall back rather than leaving nothing selected.
        if (
          selected_prompt_id &&
          prompt_list.length > 0 &&
          !prompt_list.some((p) => p.id === selected_prompt_id)
        ) {
          selected_prompt_id = prompt_list[0].id;
          localStorage.setItem(storageKey, selected_prompt_id);
        }

        // Apply selection state
        prompt_list.forEach((prompt) => {
          prompt.is_selected = prompt.id === selected_prompt_id;
        });

        set((state) => {
          state.prompt_list = prompt_list;
          state.selected_prompt_id = selected_prompt_id;
          state._promptsController = null;
        });
      } catch (error) {
        if (error.name === "AbortError" || error.name === "CanceledError") {
          return;
        }
        consola.error("ERROR: fetchPromptList", error);
        set((state) => {
          state._promptsController = null;
        });
      }
    },

    togglePrompt: (prompt_id) => {
      const { isCNEnvironment } = useSystemStore.getState();

      set((state) => {
        // Single selection: deselect all, select only the clicked one
        state.prompt_list.forEach((prompt) => {
          prompt.is_selected = prompt.id === prompt_id;
        });
        state.selected_prompt_id = prompt_id;
      });

      // Save to localStorage
      const storageKey = isCNEnvironment ? SELECTED_PROMPT_CN : SELECTED_PROMPT;
      localStorage.setItem(storageKey, prompt_id);
    },

    // `deletePrompt` is gone with the per-user prompt store: it called
    // `POST /api/user/prompt/delete`, which Mirobody 1.4.0 removed along with
    // `getUserPrompt` / `setUserPrompt`. Nothing in this client called it.
  })),
);
