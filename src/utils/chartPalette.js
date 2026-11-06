// The colours a chart draws with. ECharts paints a canvas, which CSS variables
// do not reach, so each chart takes its colours from here, for the scheme the
// page is in (hooks/usePrefersDark). Both sides mirror tokens.css.
//
// Series colours, in this order and never cycled. The previous light set
// opened with #0e3880 and #0077b6, two blues a reader could not tell apart, so
// a blood-pressure chart drew systolic and diastolic in what looked like one
// colour; the dataviz palette check failed it on four of five counts. The
// light order passes all of them on the chart's light surface; the dark order
// is the same hues lifted until each clears 4.5:1 on the dark card.
const LIGHT = {
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"],
  single: "#0e3880",
  singleFaint: "rgba(14, 56, 128, 0.3)",
  ink: "#1a1a1a",
  inkSoft: "#5c5a57",
  inkFaint: "#9b9894",
  line: "#e8e4dc",
  surface: "#ffffff",
  surfaceAlt: "#f1efe8",
  // a label printed on a filled series shape (a funnel step)
  onSeries: "#ffffff",
  out: "#c0392b",
  inRange: "#2f6b3f",
  band: "rgba(47, 107, 63, 0.09)",
};

const DARK = {
  series: ["#6aa5f2", "#f2915f", "#3fcc96", "#f2b632", "#f09cbe", "#62c462", "#a397f2"],
  single: "#9db8ec",
  singleFaint: "rgba(157, 184, 236, 0.35)",
  ink: "#ece8e1",
  inkSoft: "#b4afa7",
  inkFaint: "#8a857e",
  line: "#34312d",
  surface: "#1c1b19",
  surfaceAlt: "#24221f",
  onSeries: "#141311",
  out: "#ec8a7f",
  inRange: "#8fbf9f",
  band: "rgba(143, 191, 159, 0.12)",
};

export const chartPalette = (dark) => (dark ? DARK : LIGHT);

/** ECharts' default tooltip is a white card with dark text in either scheme. */
export const tooltipColours = (p) => ({
  backgroundColor: p.surface,
  borderColor: p.line,
  textStyle: { color: p.ink },
});
