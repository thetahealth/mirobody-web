// Bar chart, not a dollar sign: the popover reports token USAGE only. The
// backend stopped computing dollar amounts — its hardcoded price table went
// stale faster than anyone refreshed it.
import { BarChartOutlined } from "@ant-design/icons";
import { Popover, Descriptions } from "antd";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import consola from "consola";

/**
 * Parse cost statistics content from Python dict format string or object to object
 * @param {string|object} content - Python dict format string like "{'key': 'value'}" or already parsed object
 * @returns {object|null} - Parsed object or null if parsing fails
 */
const parseCostContent = (content) => {
  if (!content) return null;

  // If content is already an object, return it directly
  if (typeof content === "object" && content !== null) {
    return content;
  }

  // If content is a string, parse it (Python dict format with single quotes)
  if (typeof content === "string") {
    try {
      // Content is in Python dict format (single quotes), convert to JSON format
      const jsonContent = content.replace(/'/g, '"');
      return JSON.parse(jsonContent);
    } catch (e) {
      consola.error("Failed to parse cost statistics:", e);
      return null;
    }
  }

  return null;
};

const CostStatisticsContent = ({ data }) => {
  const { t } = useTranslation();
  const {
    model,
    input_tokens,
    output_tokens,
    total_tokens,
    thought_tokens,
    cache_read_tokens,
    cache_creation_tokens,
  } = data;

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
 * CostIcon component - displays cost statistics in a popover
 * @param {object} datasource - The raw message object containing content string
 * @param {string} datasource.content - Python dict format string to be parsed
 */
const CostIcon = ({ datasource }) => {
  const costData = useMemo(
    () => parseCostContent(datasource?.content),
    [datasource?.content],
  );

  if (!costData) return null;

  return (
    <div className="flex items-center justify-center w-[32px] h-[32px] select-none">
      <Popover
        trigger="click"
        content={<CostStatisticsContent data={costData} />}
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
