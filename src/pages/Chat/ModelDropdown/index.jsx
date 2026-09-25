import styles from "./index.module.scss";
import { useModelStore } from "../../../store/model";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import useClickOutside from "../../../hooks/useClickOutside.js";
import useIsMobile from "../../../hooks/useIsMobile";
import { Fragment, useEffect } from "react";

const CheckboxDisabled = () => {
  return <div className={styles.checkbox_disabled}></div>;
};

const CheckboxUnchecked = () => {
  return <div className={styles.checkbox_unchecked}></div>;
};

const CheckboxChecked = () => {
  return (
    <span className={styles.checkbox_checked}>
      <IconCheck size={12} stroke={2.4} aria-hidden="true" />
    </span>
  );
};

/**
 * Footer line. It used to echo the current selection back — which the trigger
 * button already shows, one line above. It now says the only thing the list
 * does not: that a second pick turns this into a side-by-side comparison, and
 * only while that is still true.
 */
const _renderFooterTip = ({ t, model_list, isMobile }) => {
  const selected_count = model_list.filter((m) => m.is_selected).length;
  if (selected_count === 0) {
    return <div className={styles.tip}>{t("select_at_least_one_model")}</div>;
  }
  if (selected_count === 1 && !isMobile) {
    return <div className={styles.tip}>{t("compare_hint")}</div>;
  }
  return null;
};

const ModelDropdown = () => {
  const { t } = useTranslation();
  const is_open = useModelStore((state) => state.is_open);
  const setIsOpen = useModelStore((state) => state.setIsOpen);
  const vs_list = useModelStore((state) => state.vs_list);
  const toggleModel = useModelStore((state) => state.toggleModel);
  const selectSingleModel = useModelStore((state) => state.selectSingleModel);
  const enforceSingleModel = useModelStore((state) => state.enforceSingleModel);
  const isMobile = useIsMobile();
  const model_list = useModelStore((state) => state.model_list);

  const dropdownRef = useClickOutside(() => {
    setIsOpen(false);
  }, is_open);

  // Mobile is single-model (no compare): collapse any carried-over 2-model
  // selection down to one when switching to a narrow viewport.
  useEffect(() => {
    if (isMobile) enforceSingleModel();
  }, [isMobile, enforceSingleModel]);

  const onClickDropdownModelItem = (e, model) => {
    e.stopPropagation();
    if (isMobile) {
      // Single-select: pick replaces, then close the dropdown.
      selectSingleModel(model.id);
      setIsOpen(false);
    } else {
      toggleModel(model.id);
    }
  };

  // ---- Two axes, not one flat list -------------------------------------
  // `/api/models` answers with the cartesian product already collapsed into
  // strings ("Base/dashscope", "Deep/gpt-5.4"), and this list rendered all
  // eight as peers under a heading that promised "Agents / Models". Agent and
  // model are separate choices; showing their product asks the user to pick a
  // pair when they only meant to pick a model. Split here — the payload
  // already carries both halves via parseModelString.
  // There used to be a segmented control here, switching between the "Deep"
  // and "Base" agents, and the list below showed only the models belonging to
  // the active one. Mirobody 1.4.0 has one agent: `/api/models` returns bare
  // provider names, so every entry is selectable and there is no second tab to
  // switch to. The list IS the models.
  return (
    <div id="chat_vs_model" className="relative" ref={dropdownRef}>
      {/* A real button with listbox semantics. This control decides which
          model answers the next message, and it was a bare <div onClick> —
          unreachable by keyboard, and announced as nothing. */}
      <button
        type="button"
        className={styles.vs_wrapper}
        aria-haspopup="listbox"
        aria-expanded={is_open}
        aria-label={t("models")}
        onClick={() => setIsOpen(!is_open)}
      >
        <div className="flex items-center gap-[4px]">
          {vs_list.length === 0 && (
            <div className="text-[var(--color-text-secondary)] text-[13px] font-[500]">
              {t("please_select")}
            </div>
          )}
          {vs_list.map((vs, index) => (
            <Fragment key={vs.id}>
              <div className="flex items-center text-[var(--color-text-secondary)] text-[13px] font-[500]">
                <div>{vs.show_name}</div>
              </div>
              {index < vs_list.length - 1 && (
                <span className="text-[var(--color-text-primary)] text-[13px] font-[600]">
                  vs
                </span>
              )}
            </Fragment>
          ))}
        </div>
        <IconChevronDown
          size={13}
          stroke={1.8}
          className="ml-[8px] text-[var(--color-text-secondary)]"
          aria-hidden="true"
        />
      </button>
      <div
        className={styles.dropdown_content}
        role="listbox"
        style={{ display: is_open ? "flex" : "none" }}
      >
        {/* No title block and no two-line instructions: a picker that needs a
            paragraph to explain it is the wrong picker. The one rule worth
            stating (pick a second model to compare) is a single quiet line at
            the bottom, and only while it is actionable. */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col py-[var(--space-2)]">
            <div className="flex flex-col flex-1 overflow-y-auto">
              {model_list.map((model) => (
                <button
                  type="button"
                  key={model.id}
                  role="option"
                  aria-selected={model.is_selected}
                  disabled={model.is_disabled}
                  className={`${styles.dropdown_item} ${
                    model.is_disabled ? styles.disabled : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!model.is_disabled) {
                      onClickDropdownModelItem(e, model);
                    }
                  }}
                >
                  {isMobile ? (
                    // Single-select on mobile: radio, not checkbox.
                    <div
                      className={`w-[16px] h-[16px] rounded-full border-2 flex items-center justify-center shrink-0 ${
                        model.is_selected
                          ? "border-[var(--color-accent)]"
                          : "border-[var(--color-border)]"
                      }`}
                    >
                      {model.is_selected && (
                        <div className="w-[8px] h-[8px] rounded-full bg-[var(--color-accent)]" />
                      )}
                    </div>
                  ) : model.is_selected ? (
                    <CheckboxChecked />
                  ) : model.is_disabled ? (
                    <CheckboxDisabled />
                  ) : (
                    <CheckboxUnchecked />
                  )}
                  <div className={styles.dropdown_item_text}>
                    {model.provider || model.show_name}
                  </div>
                </button>
              ))}
            </div>
          </div>
          {/* The prompt picker used to live here, and it is not coming back as
              a picker. A user prompt REPLACES the built-in health prompt rather
              than appending to it — a safety-relevant effect behind a control
              that looked like a preference. Mirobody 1.4.0 removed the per-user
              prompt store outright (`/api/user/prompt*`), so `/api/prompts`
              answers with the shipped system templates only. Custom
              instructions belong in Settings, as an opt-in with that warning
              stated. */}
        </div>
        <div className={styles.footer}>
          {_renderFooterTip({ t, model_list, isMobile })}
        </div>
      </div>
    </div>
  );
};

export default ModelDropdown;
