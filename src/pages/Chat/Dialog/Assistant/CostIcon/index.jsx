// Bar chart, not a coin — the Theta client uses IconCoin for this button, and
// that is deliberately not followed: the popover reports token USAGE only. The
// backend stopped computing dollar amounts — its hardcoded price table went
// stale faster than anyone refreshed it.
import { IconChartBar } from "@tabler/icons-react";
import { Popover } from "antd";
import { useTranslation } from "react-i18next";

// The `usage` block IS LangChain's `usage_metadata`: flat counts, with the
// optional halves nested under `input_token_details` / `output_token_details`.
// It used to be a `costStatistics` chunk whose numbers were strings inside a
// `content` dict, which is why this file had a Python-dict parser.
const CostStatisticsContent = ({ data }) => {
  const { t } = useTranslation();
  const { model, input_tokens, output_tokens, total_tokens } = data;
  const thought_tokens = data.output_token_details?.reasoning;
  const cache_read_tokens = data.input_token_details?.cache_read;
  const cache_creation_tokens = data.input_token_details?.cache_creation;

  return (
    // Mono for the values only — the model id and the counts, which read as
    // aligned figures. The labels stay in the body face: Geist Mono has no CJK.
    <div className="min-w-[280px]">
      <div className="text-center text-[14px] font-semibold text-[var(--color-text-primary)] mb-[12px]">
        {t("cost_statistics")}
      </div>

      <div className="border-t border-dashed border-[var(--color-border)] mb-[12px]"></div>

      <div className="flex flex-col gap-[8px] mb-[12px]">
        <div className="flex justify-between items-center text-[12px] gap-[8px]">
          <span className="text-[var(--color-text-secondary)]">{t("cost_statistics_model")}</span>
          <span className="text-[var(--color-text-primary)] font-mono">{model}</span>
        </div>
        <div className="flex justify-between items-center text-[12px] gap-[8px]">
          <span className="text-[var(--color-text-secondary)]">
            {t("cost_statistics_input_tokens")}
          </span>
          <span className="text-[var(--color-text-primary)] font-mono tabular-nums">{input_tokens}</span>
        </div>
        <div className="flex justify-between items-center text-[12px] gap-[8px]">
          <span className="text-[var(--color-text-secondary)]">
            {t("cost_statistics_output_tokens")}
          </span>
          <span className="text-[var(--color-text-primary)] font-mono tabular-nums">{output_tokens}</span>
        </div>
        {thought_tokens != null && (
          <div className="flex justify-between items-center text-[12px]">
            <span className="text-[var(--color-text-secondary)]">
              {t("cost_statistics_thought_tokens")}
            </span>
            <span className="text-[var(--color-text-primary)] font-mono tabular-nums">{thought_tokens}</span>
          </div>
        )}
        {cache_read_tokens != null && (
          <div className="flex justify-between items-center text-[12px] gap-[8px]">
            <span className="text-[var(--color-text-secondary)]">
              {t("cost_statistics_cache_read_tokens")}
            </span>
            <span className="text-[var(--color-text-primary)] font-mono tabular-nums">{cache_read_tokens}</span>
          </div>
        )}
        {cache_creation_tokens != null && (
          <div className="flex justify-between items-center text-[12px] gap-[8px]">
            <span className="text-[var(--color-text-secondary)]">
              {t("cost_statistics_cache_creation_tokens")}
            </span>
            <span className="text-[var(--color-text-primary)] font-mono tabular-nums">{cache_creation_tokens}</span>
          </div>
        )}
      </div>
      <div className="border-t border-solid border-[var(--color-border)] pt-[8px]">
        <div className="flex justify-between items-center text-[13px]">
          <span className="text-[var(--color-text-primary)] font-bold">
            {t("cost_statistics_total_tokens")}
          </span>
          <span className="text-[var(--color-text-primary)] font-bold font-mono tabular-nums">{total_tokens}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * CostIcon — the token usage popover.
 * @param {object} datasource - the `usage` block, as the backend sent it
 */
const CostIcon = ({ datasource }) => {
  const { t } = useTranslation();
  if (!datasource?.total_tokens) return null;

  return (
    <div className="flex items-center justify-center w-[32px] h-[32px] select-none">
      <Popover
        trigger="click"
        content={<CostStatisticsContent data={datasource} />}
      >
        <button
          type="button"
          className="inline-flex items-center justify-center w-[28px] h-[28px] rounded-[8px] cursor-pointer text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-soft)] hover:text-[var(--color-text-primary)]"
          aria-label={t("token_usage")}
        >
          <IconChartBar size={16} stroke={1.8} aria-hidden="true" />
        </button>
      </Popover>
    </div>
  );
};

export default CostIcon;
