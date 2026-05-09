import { useEffect, useMemo, useState } from "react";
import { todayIso } from "../domain/date";
import { getAppearanceTheme, getPlanTheme } from "../domain/themes";
import { useAppStore } from "../storage/useAppStore";
import { DateWorkspace } from "./DateWorkspace";
import { KnowledgePanel } from "./KnowledgePanel";
import { MonthPage } from "./MonthPage";
import { NotebookPage } from "./NotebookPage";
import { PlansPage } from "./PlansPage";
import { ProgressPage } from "./ProgressPage";
import { SettingsPage } from "./SettingsPage";
import { Sidebar, type AppView } from "./Sidebar";
import { TodayOverview } from "./TodayOverview";
import { TitleBar } from "./TitleBar";

export function App() {
  const store = useAppStore();
  const [view, setView] = useState<AppView>(store.data.startupView);
  const [focusDate, setFocusDate] = useState(todayIso());

  const activeTheme = useMemo(
    () => getPlanTheme(store.activePlan?.themeId ?? "sage"),
    [store.activePlan?.themeId],
  );
  const appearanceTheme = useMemo(
    () => getAppearanceTheme(store.data.appearanceThemeId, store.data.customAppearanceThemes),
    [store.data.appearanceThemeId, store.data.customAppearanceThemes],
  );

  useEffect(() => {
    window.ebbinghausDesktop?.setTitleBarTheme({
      color: appearanceTheme.surface,
      symbolColor: appearanceTheme.ink,
    });
  }, [appearanceTheme.ink, appearanceTheme.surface]);

  useEffect(() => {
    window.ebbinghausDesktop
      ?.setWindowPreferences({
        launchAtLogin: store.data.launchAtLogin,
        closeBehavior: store.data.closeBehavior,
      })
      .catch(() => undefined);
  }, [store.data.closeBehavior, store.data.launchAtLogin]);

  function openPlan(planId: string, date = todayIso()) {
    store.setActivePlan(planId);
    setFocusDate(date);
    setView("planDetail");
  }

  return (
    <main
      className="app-frame"
      style={
        {
          "--accent": activeTheme.accent,
          "--accent-strong": activeTheme.accentStrong,
          "--accent-soft": activeTheme.accentSoft,
          "--theme-ink": activeTheme.ink,
          "--app-paper": appearanceTheme.paper,
          "--app-surface": appearanceTheme.surface,
          "--app-ink": appearanceTheme.ink,
          "--app-muted": appearanceTheme.muted,
          "--app-line": appearanceTheme.line,
          "--app-accent": appearanceTheme.accent,
          "--app-accent-strong": appearanceTheme.accentStrong,
          "--app-accent-soft": appearanceTheme.accentSoft,
          "--app-weak": appearanceTheme.weak,
          "--title-font": appearanceTheme.titleFont,
          "--body-font": appearanceTheme.bodyFont,
        } as React.CSSProperties
      }
    >
      <TitleBar />
      <div className="app-body">
        <Sidebar activeView={view} onChangeView={setView} />

        <section className="content-shell">
          {view === "today" ? (
            <TodayOverview
              plans={store.data.plans}
              knowledgeItems={store.data.knowledgeItems}
              scheduleEntries={store.data.scheduleEntries}
              today={todayIso()}
              onOpenPlan={openPlan}
              onToggleEntry={store.toggleEntry}
              onCompleteEntry={store.completeEntry}
              onPostponeEntry={store.postponeEntry}
              onSkipEntry={store.skipEntry}
            />
          ) : null}

          {view === "plans" ? (
            <PlansPage
              plans={store.data.plans}
              knowledgeItems={store.data.knowledgeItems}
              scheduleEntries={store.data.scheduleEntries}
              onCreatePlan={store.createPlan}
              onUpdatePlan={store.updatePlan}
              onDeletePlan={store.deletePlan}
              onOpenPlan={openPlan}
            />
          ) : null}

          {view === "month" ? (
            <MonthPage
              plans={store.data.plans}
              knowledgeItems={store.data.knowledgeItems}
              scheduleEntries={store.data.scheduleEntries}
              onOpenPlan={openPlan}
              onToggleEntry={store.toggleEntry}
            />
          ) : null}

          {view === "notebook" ? (
            <NotebookPage
              plans={store.data.plans}
              knowledgeItems={store.data.knowledgeItems}
              scheduleEntries={store.data.scheduleEntries}
              onOpenPlan={openPlan}
              onUpdateNote={store.updateKnowledgeNote}
              onUpdateTitle={store.updateKnowledgeTitle}
              onUpdateTags={store.updateKnowledgeTags}
              onDeleteKnowledge={store.deleteKnowledge}
            />
          ) : null}

          {view === "progress" ? (
            <ProgressPage
              plans={store.data.plans}
              knowledgeItems={store.data.knowledgeItems}
              scheduleEntries={store.data.scheduleEntries}
              onOpenPlan={openPlan}
            />
          ) : null}

          {view === "settings" ? (
            <SettingsPage
              activeThemeId={store.data.appearanceThemeId}
              customThemes={store.data.customAppearanceThemes}
              onChangeTheme={store.setAppearanceTheme}
              onCreateTheme={store.createAppearanceTheme}
              onDeleteTheme={store.deleteAppearanceTheme}
              appData={store.rawData}
              startupView={store.data.startupView}
              launchAtLogin={store.data.launchAtLogin}
              closeBehavior={store.data.closeBehavior}
              onChangeStartupView={store.setStartupView}
              onChangeLaunchAtLogin={store.setLaunchAtLogin}
              onChangeCloseBehavior={store.setCloseBehavior}
              onReplaceData={store.replaceData}
            />
          ) : null}

          {view === "planDetail" && store.activePlan ? (
            <section className="plan-detail-page">
              <div className="page-heading">
                <div>
                  <p className="eyebrow">Plan</p>
                  <h1>{store.activePlan.name}</h1>
                  <p className="page-subtitle">
                    {store.activePlan.startDate} 起，共 {store.activePlan.dayCount} 天
                  </p>
                </div>
                <button className="quiet-button" onClick={() => setView("plans")}>
                  返回计划
                </button>
              </div>
              <section className="workspace-grid">
                <DateWorkspace
                  plan={store.activePlan}
                  focusDate={focusDate}
                  knowledgeItems={store.activePlanItems}
                  scheduleEntries={store.activePlanEntries}
                  onAddKnowledge={store.addKnowledge}
                  onToggleEntry={store.toggleEntry}
                />
                <KnowledgePanel
                  knowledgeItems={store.activePlanItems}
                  scheduleEntries={store.activePlanEntries}
                  title={store.activePlan.kind === "task" ? "已有事项" : "已有知识点"}
                  planKind={store.activePlan.kind}
                  onUpdateNote={store.updateKnowledgeNote}
                  onUpdateTitle={store.updateKnowledgeTitle}
                  onUpdateTags={store.updateKnowledgeTags}
                  onDeleteKnowledge={store.deleteKnowledge}
                />
              </section>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}
