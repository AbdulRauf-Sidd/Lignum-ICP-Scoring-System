// Validated categorical / sequential / status palette — see the dataviz skill.
// Fixed hue order; never cycled or reassigned per filter state.
export const CATEGORICAL_LIGHT = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];

export const CATEGORICAL_DARK = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
];

// Ordinal ramp (single hue, light -> dark) for ordered discrete marks (tiers).
export const ORDINAL_LIGHT = ["#86b6ef", "#3987e5", "#184f95"];
export const ORDINAL_DARK = ["#9ec5f4", "#5598e7", "#0d366b"];

export const STATUS_COLORS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
};

export const CHART_INK_LIGHT = {
  text: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
};

export const CHART_INK_DARK = {
  text: "#c3c2b7",
  muted: "#898781",
  grid: "#2c2c2a",
  axis: "#383835",
};
