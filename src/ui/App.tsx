import { useCallback, useEffect, useMemo, useState } from "react";
import { getAppearanceTheme, getPlanTheme } from "../domain/themes";
import { subscribe as subscribeDirty, hasAnyDirty } from "../storage/unsavedGuard";
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
import { UnsavedGuardProvider, useUnsavedGuard } from "./useUnsavedGuard";
import { ErrorBoundary } from "./ErrorBoundary";

export function App() {
  return (
    <ErrorBoundary>
      <UnsavedGuardProvider>
        <AppShell />
      </UnsavedGuardProvider>
    </ErrorBoundary>
  );
}

function AppShell() {
  const store = useAppStore();
  const [view, setView] = useState<AppView>(store.data.startupView);
  const [focusDate, setFocusDate] = useState(store.today);
  const [focusKnowledgeId, setFocusKnowledgeId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const guard = useUnsavedGuard();

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
      paper: appearanceTheme.paper,
    });
  }, [appearanceTheme.ink, appearanceTheme.paper, appearanceTheme.surface]);

  useEffect(() => {
    window.ebbinghausDesktop
      ?.setWindowPreferences({
        launchAtLogin: store.data.launchAtLogin,
        closeBehavior: store.data.closeBehavior,
      })
      .catch(() => undefined);
  }, [store.data.closeBehavior, store.data.launchAtLogin]);

  // Reflect dirty state in the document title so users get a visible hint.
  useEffect(() => {
    const update = () => {
      const dirty = hasAnyDirty();
      setDirty(dirty);
      document.title = dirty ? "● Mnemo" : "Mnemo";
      window.ebbinghausDesktop?.setDirtyState?.(dirty);
    };
    update();
    return subscribeDirty(update);
  }, []);

  // Main-process asks the renderer to confirm a close. We always flush the
  // latest store synchronously first so any pending async save (file storage
  // writes go through IPC and would otherwise be aborted when the window is
  // destroyed) is guaranteed to land on disk.
  useEffect(() => {
    const api = window.ebbinghausDesktop;
    if (!api?.onConfirmClose || !api?.respondConfirmClose) return;
    return api.onConfirmClose(() => {
      const flushAndDiscard = () => {
        store.flushPendingSavesSync();
        api.respondConfirmClose("discard");
      };

      if (!hasAnyDirty()) {
        flushAndDiscard();
        return;
      }
      void guard
        .runGuarded(flushAndDiscard, { allowSave: false })
        .then((ok) => {
          if (!ok) api.respondConfirmClose("cancel");
        });
    });
  }, [guard, store]);

  const changeView = useCallback(
    (nextView: AppView) => {
      void guard.runGuarded(() => setView(nextView));
    },
    [guard],
  );

  const openPlan = useCallback(
    (planId: string, date = store.today) => {
      void guard.runGuarded(() => {
        store.setActivePlan(planId);
        setFocusDate(date);
        setView("planDetail");
      });
    },
    [guard, store],
  );

  const openKnowledgeNote = useCallback(
    (knowledgeId: string) => {
      void guard.runGuarded(() => {
        setFocusKnowledgeId(knowledgeId);
        setView("notebook");
      });
    },
    [guard],
  );

  const backToPlans = useCallback(() => {
    void guard.runGuarded(() => setView("plans"));
  }, [guard]);

  if (!store.loaded) {
    return (
      <main
        className="app-frame app-splash"
        style={
          {
            "--app-paper": appearanceTheme.paper,
            "--app-surface": appearanceTheme.surface,
            "--app-ink": appearanceTheme.ink,
            "--app-muted": appearanceTheme.muted,
            "--app-line": appearanceTheme.line,
            "--title-font": appearanceTheme.titleFont,
            "--body-font": appearanceTheme.bodyFont,
          } as React.CSSProperties
        }
      >
        <TitleBar title="Mnemo" />
        <div className="app-splash-body" role="status" aria-live="polite">
          <p className="eyebrow">Mnemo</p>
          <h1>正在加载...</h1>
        </div>
      </main>
    );
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
      <TitleBar title={dirty ? "● Mnemo" : "Mnemo"} />
      {store.saveError ? (
        <div className="save-error-banner" role="alert">
          <span>{store.saveError}</span>
          <button
            type="button"
            className="save-error-dismiss"
            onClick={store.clearSaveError}
            aria-label="关闭提示"
          >
            知道了
          </button>
        </div>
      ) : null}
      <div className="app-body">
        <Sidebar activeView={view} onChangeView={changeView} />

        <section className="content-shell">
          {view === "today" ? (
            <TodayOverview
              plans={store.data.plans}
              knowledgeItems={store.data.knowledgeItems}
              scheduleEntries={store.data.scheduleEntries}
              today={store.today}
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
              focusKnowledgeId={focusKnowledgeId}
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
                <button className="quiet-button" onClick={backToPlans}>
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
                  onOpenNote={openKnowledgeNote}
                />
              </section>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}
