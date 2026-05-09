import { Check, ChevronDown, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getAppearanceThemes } from "../domain/themes";
import type {
  AppData,
  AppearanceTheme,
  AppearanceThemeId,
  CloseBehavior,
  StartupView,
} from "../domain/types";

interface SettingsPageProps {
  activeThemeId: AppearanceThemeId;
  customThemes: AppearanceTheme[];
  onChangeTheme(themeId: AppearanceThemeId): void;
  onCreateTheme(theme: Omit<AppearanceTheme, "id">): void;
  onDeleteTheme(themeId: AppearanceThemeId): void;
  appData: AppData;
  startupView: StartupView;
  launchAtLogin: boolean;
  closeBehavior: CloseBehavior;
  onChangeStartupView(view: StartupView): void;
  onChangeLaunchAtLogin(value: boolean): void;
  onChangeCloseBehavior(value: CloseBehavior): void;
  onReplaceData(rawData: unknown): void;
}

type ThemeDraft = Omit<AppearanceTheme, "id">;

const defaultDraft: ThemeDraft = {
  name: "My Theme",
  description: "自定义纸张、文字和强调色。",
  titleFont: "\"Noto Serif SC\", \"Songti SC\", \"SimSun\", Georgia, serif",
  bodyFont: "\"Segoe UI\", \"Noto Sans SC\", \"Microsoft YaHei\", system-ui, sans-serif",
  paper: "#F6F2EA",
  surface: "#FFFCF7",
  ink: "#2C3029",
  muted: "#7E7B70",
  line: "#DCD6CA",
  accent: "#5F7258",
  accentStrong: "#3F503A",
  accentSoft: "#E5ECDE",
  weak: "#A9654F",
};

const colorFields: Array<{ key: keyof ThemeDraft; label: string }> = [
  { key: "paper", label: "纸张" },
  { key: "surface", label: "表面" },
  { key: "ink", label: "文字" },
  { key: "muted", label: "弱文字" },
  { key: "line", label: "分隔线" },
  { key: "accent", label: "强调" },
  { key: "accentStrong", label: "深强调" },
  { key: "accentSoft", label: "浅强调" },
  { key: "weak", label: "薄弱" },
];

const startupViews: Array<{ id: StartupView; label: string }> = [
  { id: "today", label: "今日任务" },
  { id: "month", label: "月任务" },
  { id: "plans", label: "计划" },
  { id: "notebook", label: "笔记" },
  { id: "progress", label: "进度" },
];

const closeBehaviors: Array<{ id: CloseBehavior; label: string; description: string }> = [
  { id: "quit", label: "直接关闭", description: "点击关闭后退出应用" },
  { id: "tray", label: "最小化到托盘", description: "点击关闭后保留后台托盘入口" },
];

const launchOptions: Array<{ id: "off" | "on"; label: string; value: boolean }> = [
  { id: "off", label: "不自动启动", value: false },
  { id: "on", label: "开机自动启动", value: true },
];

function StartupViewPicker({
  value,
  onChange,
}: {
  value: StartupView;
  onChange(value: StartupView): void;
}) {
  const [open, setOpen] = useState(false);
  const activeView = startupViews.find((view) => view.id === value) ?? startupViews[0];

  return (
    <div
      className="settings-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="review-template-button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span>{activeView.label}</span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="review-template-menu settings-picker-menu" role="listbox">
          {startupViews.map((view) => (
            <button
              type="button"
              key={view.id}
              className={view.id === value ? "active" : ""}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(view.id);
                setOpen(false);
              }}
            >
              <strong>{view.label}</strong>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LaunchAtLoginPicker({
  value,
  onChange,
}: {
  value: boolean;
  onChange(value: boolean): void;
}) {
  const [open, setOpen] = useState(false);
  const activeOption =
    launchOptions.find((option) => option.value === value) ?? launchOptions[0];

  return (
    <div
      className="settings-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="review-template-button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span>{activeOption.label}</span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="review-template-menu settings-picker-menu" role="listbox">
          {launchOptions.map((option) => (
            <button
              type="button"
              key={option.id}
              className={option.value === value ? "active" : ""}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <strong>{option.label}</strong>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CloseBehaviorPicker({
  value,
  onChange,
}: {
  value: CloseBehavior;
  onChange(value: CloseBehavior): void;
}) {
  const [open, setOpen] = useState(false);
  const activeBehavior =
    closeBehaviors.find((behavior) => behavior.id === value) ?? closeBehaviors[0];

  return (
    <div
      className="settings-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="review-template-button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span>{activeBehavior.label}</span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="review-template-menu settings-picker-menu" role="listbox">
          {closeBehaviors.map((behavior) => (
            <button
              type="button"
              key={behavior.id}
              className={behavior.id === value ? "active" : ""}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(behavior.id);
                setOpen(false);
              }}
            >
              <strong>{behavior.label}</strong>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SettingsPage({
  activeThemeId,
  customThemes,
  onChangeTheme,
  onCreateTheme,
  onDeleteTheme,
  appData,
  startupView,
  launchAtLogin,
  closeBehavior,
  onChangeStartupView,
  onChangeLaunchAtLogin,
  onChangeCloseBehavior,
  onReplaceData,
}: SettingsPageProps) {
  const themes = getAppearanceThemes(customThemes);
  const [draft, setDraft] = useState<ThemeDraft>(defaultDraft);
  const [creating, setCreating] = useState(false);
  const [deletingTheme, setDeletingTheme] = useState<AppearanceTheme | null>(null);
  const [lastBackupPath, setLastBackupPath] = useState("");
  const [dataMessage, setDataMessage] = useState("");
  const [pendingImportData, setPendingImportData] = useState<unknown | null>(null);
  const [clearingData, setClearingData] = useState(false);

  useEffect(() => {
    setLastBackupPath(localStorage.getItem("mnemo:lastBackupPath") ?? "");
  }, []);

  function updateDraft<K extends keyof ThemeDraft>(key: K, value: ThemeDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submitTheme(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreateTheme({
      ...draft,
      name: draft.name.trim() || "Custom Theme",
      description: draft.description.trim() || "自定义配色方案。",
      titleFont: defaultDraft.titleFont,
      bodyFont: defaultDraft.bodyFont,
    });
    setDraft({ ...defaultDraft, name: "My Theme" });
    setCreating(false);
  }

  function deleteTheme(theme: AppearanceTheme) {
    setDeletingTheme(theme);
  }

  function confirmDeleteTheme() {
    if (!deletingTheme) return;
    onDeleteTheme(deletingTheme.id);
    setDeletingTheme(null);
  }

  async function exportBackup() {
    const defaultFileName = `mnemo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const content = JSON.stringify(appData, null, 2);

    if (!window.ebbinghausDesktop?.exportBackup) {
      const blob = new Blob([content], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = defaultFileName;
      link.click();
      URL.revokeObjectURL(url);
      setDataMessage("已准备备份文件。");
      return;
    }

    const result = await window.ebbinghausDesktop.exportBackup({ defaultFileName, content });
    if (result.canceled) {
      setDataMessage("已取消备份。");
      return;
    }

    setLastBackupPath(result.filePath);
    localStorage.setItem("mnemo:lastBackupPath", result.filePath);
    setDataMessage("备份已保存。");
  }

  async function importBackup() {
    if (!window.ebbinghausDesktop?.importBackup) return;

    const result = await window.ebbinghausDesktop.importBackup();
    if (result.canceled) {
      setDataMessage("已取消恢复。");
      return;
    }

    try {
      setPendingImportData(JSON.parse(result.content));
    } catch {
      setDataMessage("恢复失败：备份文件不是有效 JSON。");
    }
  }

  function confirmImportBackup() {
    if (!pendingImportData) return;
    onReplaceData(pendingImportData);
    setPendingImportData(null);
    setDataMessage("数据已恢复。");
  }

  function confirmClearData() {
    onReplaceData({
      ...appData,
      plans: [],
      knowledgeItems: [],
      scheduleEntries: [],
      activePlanId: null,
    });
    setClearingData(false);
    setDataMessage("当前数据已清空。");
  }

  return (
    <section className="settings-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>设置</h1>
          <p className="page-subtitle">选择 Mnemo 的整体纸张、字体和界面气质。</p>
        </div>
        <button className="primary-cta" type="button" onClick={() => setCreating(true)}>
          <Plus size={16} />
          添加配色方案
        </button>
      </div>

      <div className="settings-scroll">
        <section className="settings-section appearance-section">
          <div>
            <p className="eyebrow">Appearance</p>
            <h2>配色方案</h2>
          </div>
          <div className="appearance-theme-grid" aria-label="配色方案">
            {themes.map((theme) => {
              const active = theme.id === activeThemeId;
              const custom = customThemes.some((customTheme) => customTheme.id === theme.id);

              return (
                <article
                  className={active ? "appearance-theme-card active" : "appearance-theme-card"}
                  key={theme.id}
                  style={createPreviewStyle(theme)}
                >
                  <button
                    type="button"
                    className="appearance-theme-main"
                    onClick={() => onChangeTheme(theme.id)}
                  >
                    <span className="appearance-preview">
                      <i />
                      <strong>{theme.name}</strong>
                      <small>Review · Notes · Calendar</small>
                      <em />
                    </span>
                    <span className="appearance-theme-copy">
                      <span>
                        <strong>{theme.name}</strong>
                        <small>{theme.description}</small>
                      </span>
                      {active ? (
                        <em className="appearance-active-mark">
                          <Check size={14} />
                          当前
                        </em>
                      ) : null}
                    </span>
                  </button>
                  {custom ? (
                    <button
                      type="button"
                      className="appearance-delete-button"
                      onClick={() => deleteTheme(theme)}
                      aria-label={`删除配色方案 ${theme.name}`}
                      title="删除配色方案"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="settings-section">
          <div>
            <p className="eyebrow">Data</p>
            <h2>数据管理</h2>
            <p>备份和恢复会包含计划、知识点、笔记、标签、完成状态和外观方案。</p>
            <small>最后备份路径：{lastBackupPath || "暂无备份记录"}</small>
          </div>
          <div className="settings-action-row">
            <button type="button" className="quiet-button" onClick={exportBackup}>
              备份数据
            </button>
            <button type="button" className="danger-button" onClick={importBackup}>
              恢复备份
            </button>
            <button type="button" className="danger-button" onClick={() => setClearingData(true)}>
              清空当前数据
            </button>
          </div>
          {dataMessage ? <p className="quiet-line">{dataMessage}</p> : null}
        </section>

        <section className="settings-section">
          <div>
            <p className="eyebrow">Startup</p>
            <h2>窗口与启动</h2>
            <p>窗口大小和位置会自动记住。你也可以选择下次启动默认打开的页面。</p>
          </div>
          <div className="settings-select-row">
            <span>启动页面</span>
            <StartupViewPicker value={startupView} onChange={onChangeStartupView} />
          </div>
          <div className="settings-select-row">
            <span>开机自动启动</span>
            <LaunchAtLoginPicker value={launchAtLogin} onChange={onChangeLaunchAtLogin} />
          </div>
          <div className="settings-select-row">
            <span>关闭按钮行为</span>
            <CloseBehaviorPicker value={closeBehavior} onChange={onChangeCloseBehavior} />
          </div>
        </section>
      </div>

      {creating ? (
        <div className="theme-modal-backdrop" role="presentation" onMouseDown={() => setCreating(false)}>
          <form
            className="theme-modal"
            onSubmit={submitTheme}
            onMouseDown={(event) => event.stopPropagation()}
            style={createPreviewStyle({ ...draft, id: "draft" })}
          >
            <header>
              <div>
                <p className="eyebrow">Appearance</p>
                <h2>添加配色方案</h2>
                <p>新方案会自动启用，并和内置方案一样显示成卡片。</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setCreating(false)} aria-label="关闭">
                <X size={16} />
              </button>
            </header>

            <div className="theme-modal-body">
              <span className="appearance-preview modal-preview">
                <i />
                <strong>{draft.name || "Custom Theme"}</strong>
                <small>Custom · Palette · Font</small>
                <em />
              </span>

              <div className="appearance-form-fields">
                <input
                  aria-label="方案名称"
                  value={draft.name}
                  onChange={(event) => updateDraft("name", event.target.value)}
                  placeholder="方案名称"
                />
                <input
                  aria-label="方案描述"
                  value={draft.description}
                  onChange={(event) => updateDraft("description", event.target.value)}
                  placeholder="方案描述"
                />
                <div className="appearance-color-grid">
                  {colorFields.map((field) => (
                    <label key={field.key}>
                      <span>{field.label}</span>
                      <input
                        type="color"
                        value={String(draft[field.key])}
                        onChange={(event) => updateDraft(field.key, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <footer>
              <button type="button" className="quiet-button" onClick={() => setCreating(false)}>
                取消
              </button>
              <button className="appearance-create-button" type="submit">
                <Plus size={14} />
                添加并启用
              </button>
            </footer>
          </form>
        </div>
      ) : null}

      {deletingTheme ? (
        <div className="theme-modal-backdrop" role="presentation" onMouseDown={() => setDeletingTheme(null)}>
          <section
            className="theme-modal confirm-modal"
            onMouseDown={(event) => event.stopPropagation()}
            style={createPreviewStyle(deletingTheme)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-theme-title"
          >
            <header>
              <div>
                <p className="eyebrow">Appearance</p>
                <h2 id="delete-theme-title">删除配色方案</h2>
                <p>删除后不会影响已有计划和知识点。</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setDeletingTheme(null)}
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </header>

            <div className="confirm-modal-body">
              <span className="appearance-preview">
                <i />
                <strong>{deletingTheme.name}</strong>
                <small>Custom 路 Palette</small>
                <em />
              </span>
              <div>
                <strong>{deletingTheme.name}</strong>
                <small>{deletingTheme.description}</small>
              </div>
            </div>

            <footer>
              <button type="button" className="quiet-button" onClick={() => setDeletingTheme(null)}>
                取消
              </button>
              <button className="danger-button" type="button" onClick={confirmDeleteTheme}>
                <Trash2 size={14} />
                删除
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {pendingImportData ? (
        <div className="theme-modal-backdrop" role="presentation" onMouseDown={() => setPendingImportData(null)}>
          <section
            className="theme-modal confirm-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-backup-title"
          >
            <header>
              <div>
                <p className="eyebrow">Data</p>
                <h2 id="restore-backup-title">恢复备份</h2>
                <p>恢复会用备份文件覆盖当前数据。建议先备份当前数据。</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setPendingImportData(null)}
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </header>

            <div className="confirm-modal-body restore-confirm-body">
              <div>
                <strong>确认恢复这份备份？</strong>
                <small>计划、知识点、笔记、完成状态和设置都会切换为备份中的内容。</small>
              </div>
            </div>

            <footer>
              <button type="button" className="quiet-button" onClick={() => setPendingImportData(null)}>
                取消
              </button>
              <button className="danger-button" type="button" onClick={confirmImportBackup}>
                恢复
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {clearingData ? (
        <div className="theme-modal-backdrop" role="presentation" onMouseDown={() => setClearingData(false)}>
          <section
            className="theme-modal confirm-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-data-title"
          >
            <header>
              <div>
                <p className="eyebrow">Data</p>
                <h2 id="clear-data-title">清空当前数据</h2>
                <p>清空后会移除所有计划、知识点、笔记和完成记录。</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setClearingData(false)}
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </header>

            <div className="confirm-modal-body restore-confirm-body">
              <div>
                <strong>确认清空当前数据？</strong>
                <small>配色方案、窗口与启动设置会保留；学习内容会被清空。</small>
              </div>
            </div>

            <footer>
              <button type="button" className="quiet-button" onClick={() => setClearingData(false)}>
                取消
              </button>
              <button className="danger-button" type="button" onClick={confirmClearData}>
                清空
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function createPreviewStyle(theme: AppearanceTheme) {
  return {
    "--preview-paper": theme.paper,
    "--preview-surface": theme.surface,
    "--preview-ink": theme.ink,
    "--preview-muted": theme.muted,
    "--preview-line": theme.line,
    "--preview-accent": theme.accent,
    "--preview-accent-soft": theme.accentSoft,
    "--preview-weak": theme.weak,
    "--preview-title-font": theme.titleFont,
    "--preview-body-font": theme.bodyFont,
  } as React.CSSProperties;
}
