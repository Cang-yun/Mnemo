import type { AppearanceTheme, AppearanceThemeId, PlanTheme, PlanThemeId } from "./types";

export const planThemes: PlanTheme[] = [
  {
    id: "ink",
    name: "墨砚",
    accent: "#4a4a42",
    accentStrong: "#2e2e28",
    accentSoft: "#e6e5df",
    ink: "#242320",
  },
  {
    id: "madder",
    name: "茜草",
    accent: "#c06052",
    accentStrong: "#8a3a30",
    accentSoft: "#f2e0dc",
    ink: "#2e201d",
  },
  {
    id: "clay",
    name: "朱砂",
    accent: "#c87848",
    accentStrong: "#8a4e28",
    accentSoft: "#f2e5d8",
    ink: "#2e241c",
  },
  {
    id: "amber",
    name: "橘暖",
    accent: "#c08838",
    accentStrong: "#8a5e20",
    accentSoft: "#f2e8d2",
    ink: "#2b2418",
  },
  {
    id: "sage",
    name: "苔色",
    accent: "#889050",
    accentStrong: "#5a6032",
    accentSoft: "#eaecde",
    ink: "#262820",
  },
  {
    id: "pine",
    name: "松针",
    accent: "#4a7a62",
    accentStrong: "#2a503e",
    accentSoft: "#dceae2",
    ink: "#1e2822",
  },
  {
    id: "teal",
    name: "青碧",
    accent: "#4a8892",
    accentStrong: "#2a5a62",
    accentSoft: "#daecee",
    ink: "#1c282a",
  },
  {
    id: "lake",
    name: "蔚蓝",
    accent: "#487098",
    accentStrong: "#284868",
    accentSoft: "#dce6f2",
    ink: "#1c242e",
  },
  {
    id: "plum",
    name: "堇紫",
    accent: "#6858a2",
    accentStrong: "#3e3070",
    accentSoft: "#e4e0f2",
    ink: "#201e2e",
  },
  {
    id: "rose",
    name: "梅子",
    accent: "#985878",
    accentStrong: "#68324e",
    accentSoft: "#f0dce4",
    ink: "#2a1e24",
  },
];

export function getPlanTheme(themeId: PlanThemeId) {
  return planThemes.find((theme) => theme.id === themeId) ?? planThemes[0];
}

export const appearanceThemes: AppearanceTheme[] = [
  {
    id: "frostGray",
    name: "霜灰",
    description: "冷调灰蓝、低饱和，界面安静沉稳不刺眼。",
    titleFont: "\"Noto Serif SC\", Georgia, serif",
    bodyFont: "\"Inter\", \"Noto Sans SC\", \"Microsoft YaHei\", system-ui, sans-serif",
    paper: "#F2F3F5",
    surface: "#FAFBFC",
    ink: "#2A2E32",
    muted: "#80868C",
    line: "#D8DCE0",
    accent: "#607888",
    accentStrong: "#3A5060",
    accentSoft: "#E2E8EC",
    weak: "#9A6070",
  },
  {
    id: "graphite",
    name: "墨蓝",
    description: "冷静蓝灰、清晰利落，适合专注研究和长时间阅读。",
    titleFont: "\"Noto Serif SC\", \"LXGW WenKai Screen\", Georgia, serif",
    bodyFont: "\"Inter\", \"Noto Sans SC\", \"Microsoft YaHei\", system-ui, sans-serif",
    paper: "#F5F6F3",
    surface: "#FFFFFF",
    ink: "#252A2D",
    muted: "#7A858C",
    line: "#D9DEDD",
    accent: "#536D7A",
    accentStrong: "#365766",
    accentSoft: "#E2EAEC",
    weak: "#A65F63",
  },
  {
    id: "carbon",
    name: "炭墨",
    description: "炭灰纸面、高对比文字，适合深度整理和内容创作。",
    titleFont: "\"Noto Serif SC\", \"Libre Baskerville\", Georgia, serif",
    bodyFont: "\"Inter\", \"Noto Sans SC\", \"Microsoft YaHei\", system-ui, sans-serif",
    paper: "#F1F0EB",
    surface: "#FBFAF6",
    ink: "#181A18",
    muted: "#6E706C",
    line: "#D3D1CA",
    accent: "#30342F",
    accentStrong: "#171A17",
    accentSoft: "#E3E3DC",
    weak: "#9D524B",
  },
  {
    id: "teaCream",
    name: "茶白",
    description: "暖调米纸、低对比度，适合长时间阅读不易疲劳。",
    titleFont: "\"Noto Serif SC\", \"Songti SC\", Georgia, serif",
    bodyFont: "\"Segoe UI\", \"Noto Sans SC\", \"Microsoft YaHei\", system-ui, sans-serif",
    paper: "#F3EFE4",
    surface: "#FDFAF2",
    ink: "#3D3832",
    muted: "#8A8278",
    line: "#DDD6C8",
    accent: "#889068",
    accentStrong: "#5A6040",
    accentSoft: "#EAECDC",
    weak: "#B87658",
  },
];

export function getAppearanceThemes(customThemes: AppearanceTheme[] = []) {
  return [...appearanceThemes, ...customThemes];
}

export function getAppearanceTheme(themeId: AppearanceThemeId, customThemes: AppearanceTheme[] = []) {
  return getAppearanceThemes(customThemes).find((theme) => theme.id === themeId) ?? appearanceThemes[0];
}
