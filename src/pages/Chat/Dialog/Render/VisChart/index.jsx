import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as echarts from "echarts";
import { buildEChartsOption } from "./buildOption";
import { parseChartSource } from "./parseSource";
import { IconDownload } from "@tabler/icons-react";
import styles from "./index.module.scss";

// Width buckets: the option is only rebuilt when the width crosses a bucket
// (font sizes, padding and label strategy adapt to it). Every other width
// change is a light resize, so streaming does not make the chart jitter.
function bucketOf(w) {
  if (w < 380) return "xs";
  if (w < 560) return "sm";
  return "lg";
}

// Filename hygiene: drop illegal characters, cap the length.
function safeName(title) {
  const base = (title || "chart").trim().replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60);
  return `${base || "chart"}.png`;
}

// Renders one ```vis-chart block. `source` is the raw JSON inside the fence;
// `complete` says the block's closing fence has arrived (Markdown decides,
// from the block's source span). Until then a parse failure means "draw
// nothing yet": the JSON is unfinished. Once complete, the model's common
// slips are mended (`parseSource.js`), and a block that still cannot be drawn
// says so and shows what it held. It used to draw nothing, with no sign a
// chart was missing: one stray `}` from MiniCPM5-2B on a steps chart.
export default function VisChart({ source, complete = false }) {
  const { t } = useTranslation();
  const elRef = useRef(null);
  const chartRef = useRef(null);
  const configRef = useRef(null);
  const bucketRef = useRef(null);
  const [ready, setReady] = useState(false);

  // What the block holds; mended only once it is finished.
  const parsed = useMemo(() => parseChartSource(source, { repair: complete }), [source, complete]);
  // Finished and still not a chart (unparseable, or a type the protocol does
  // not have): say so rather than leave a blank gap.
  const failed = complete && !(parsed && buildEChartsOption(parsed.config));

  // Parse + render (whenever source changes; safe mid-stream)
  useEffect(() => {
    const el = elRef.current;
    if (!parsed || !el) return; // still streaming: the JSON is not complete yet
    const width = el.clientWidth || 0;
    const option = buildEChartsOption(parsed.config, { width });
    if (!option) return;

    configRef.current = parsed.config;
    bucketRef.current = bucketOf(width);
    if (!chartRef.current) chartRef.current = echarts.init(el);
    chartRef.current.setOption(option, true);
    setReady(true);
  }, [parsed]);

  // Follow the container: watch the chart's own size (expand/collapse, stacking,
  // the sidebar, window zoom all land here).
  // Rebuild the option on a bucket change, otherwise just resize.
  useEffect(() => {
    const el = elRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const chart = chartRef.current;
        const width = el.clientWidth || 0;
        if (!chart || width < 1) return; // hidden (zero width) — skip
        const nextBucket = bucketOf(width);
        if (nextBucket !== bucketRef.current && configRef.current) {
          bucketRef.current = nextBucket;
          const option = buildEChartsOption(configRef.current, { width });
          if (option) chart.setOption(option, true);
        }
        chart.resize();
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // Dispose on unmount, so the instance does not leak
  useEffect(
    () => () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    },
    []
  );

  // Export the current chart as a PNG (2x, white background); the title
  // becomes the filename.
  const handleDownload = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const url = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#fff" });
    const a = document.createElement("a");
    a.href = url;
    a.download = safeName(configRef.current?.title);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // The chart element stays mounted while the note shows, so a block that
  // becomes drawable (a regenerated answer) still has somewhere to draw.
  return (
    <div className={styles.wrapper}>
      <div ref={elRef} className={styles.chart} hidden={failed} />
      {failed && (
        <div className={styles.failed} role="note">
          <p>{t("chart_not_drawn")}</p>
          <details>
            <summary>{t("chart_show_data")}</summary>
            <pre>{String(source).trim()}</pre>
          </details>
        </div>
      )}
      {ready && !failed && (
        <button type="button" className={styles.download} onClick={handleDownload} title={t("download_chart")} aria-label={t("download_chart")}>
          <IconDownload size={15} stroke={1.8} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
