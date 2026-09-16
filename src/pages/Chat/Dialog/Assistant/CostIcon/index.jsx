// Bar chart, not a dollar sign: the popover reports token USAGE only. The
// backend stopped computing dollar amounts — its hardcoded price table went
// stale faster than anyone refreshed it.
import { BarChartOutlined } from "@ant-design/icons";
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
    <div className="min-w-[280px] font-mono">
      <div className="text-center text-[14px] font-semibold text-[var(--color-text-primary)] mb-[12px]">
        {t("cost_statistics")}
      </div>

      <div className="border-t border-dashed border-[var(--color-border)] mb-[12px]"></div>

      <div className="flex flex-col gap-[8px] mb-[12px]">
        <div className="flex justify-between items-center text-[12px] gap-[8px]">
          <span className="text-[var(--color-text-secondary)]">{t("cost_statistics_model")}</span>
          <span className="text-[var(--color-text-primary)] font-medium">{model}</span>
        </div>
        <div className="flex justify-between items-center text-[12px] gap-[8px]">
          <span className="text-[var(--color-text-secondary)]">
            {t("cost_statistics_input_tokens")}
          </span>
          <span className="text-[var(--color-text-primary)]">{input_tokens}</span>
        </div>
        <div className="flex justify-between items-center text-[12px] gap-[8px]">
          <span className="text-[var(--color-text-secondary)]">
            {t("cost_statistics_output_tokens")}
          </span>
          <span className="text-[var(--color-text-primary)]">{output_tokens}</span>
        </div>
        {thought_tokens != null && (
          <div className="flex justify-between items-center text-[12px]">
            <span className="text-[var(--color-text-secondary)]">
              {t("cost_statistics_thought_tokens")}
            </span>
            <span className="text-[var(--color-text-primary)]">{thought_tokens}</span>
          </div>
        )}
        {cache_read_tokens != null && (
          <div className="flex justify-between items-center text-[12px] gap-[8px]">
            <span className="text-[var(--color-text-secondary)]">
              {t("cost_statistics_cache_read_tokens")}
            </span>
            <span className="text-[var(--color-text-primary)]">{cache_read_tokens}</span>
          </div>
        )}
        {cache_creation_tokens != null && (
          <div className="flex justify-between items-center text-[12px] gap-[8px]">
            <span className="text-[var(--color-text-secondary)]">
              {t("cost_statistics_cache_creation_tokens")}
            </span>
            <span className="text-[var(--color-text-primary)]">{cache_creation_tokens}</span>
          </div>
        )}
      </div>
      <div className="border-t border-solid border-[var(--color-border)] pt-[8px]">
        <div className="flex justify-between items-center text-[13px]">
          <span className="text-[var(--color-text-primary)] font-bold">
            {t("cost_statistics_total_tokens")}
          </span>
          <span className="text-[var(--color-text-primary)] font-bold">{total_tokens}</span>
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
  if (!datasource?.total_tokens) return null;

  return (
    <div className="flex items-center justify-center w-[32px] h-[32px] select-none">
      <Popover
        trigger="click"
        content={<CostStatisticsContent data={datasource} />}
      >
        <BarChartOutlined
          className="cursor-pointer"
          style={{ fontSize: "16px", color: "var(--color-text-secondary)" }}
        />
      </Popover>
    </div>
  );
};

export default CostIcon;
