import type { Plan } from "../domain/types";
import { getPlanTheme } from "../domain/themes";

interface PlanTabsProps {
  plans: Plan[];
  activePlanId: string | null;
  onSelect(planId: string): void;
}

export function PlanTabs({ plans, activePlanId, onSelect }: PlanTabsProps) {
  if (plans.length === 0) return null;

  return (
    <nav className="plan-tabs" aria-label="计划">
      {plans.map((plan) => {
        const theme = getPlanTheme(plan.themeId);
        return (
          <button
            key={plan.id}
            className={plan.id === activePlanId ? "plan-tab active" : "plan-tab"}
            onClick={() => onSelect(plan.id)}
            style={
              {
                "--tab-accent": theme.accent,
                "--tab-soft": theme.accentSoft,
              } as React.CSSProperties
            }
          >
            <span className="swatch" />
            {plan.name}
          </button>
        );
      })}
    </nav>
  );
}
