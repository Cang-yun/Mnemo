import { BarChart3, BookOpen, CalendarCheck, CalendarRange, Library, SlidersHorizontal } from "lucide-react";

export type AppView = "today" | "month" | "plans" | "notebook" | "progress" | "settings" | "planDetail";

interface SidebarProps {
  activeView: AppView;
  onChangeView(view: AppView): void;
}

const navItems: Array<{
  view: Exclude<AppView, "planDetail">;
  label: string;
  icon: typeof CalendarCheck;
}> = [
  { view: "today", label: "今日任务", icon: CalendarCheck },
  { view: "month", label: "月任务", icon: CalendarRange },
  { view: "plans", label: "计划", icon: Library },
  { view: "notebook", label: "笔记", icon: BookOpen },
  { view: "progress", label: "进度", icon: BarChart3 },
  { view: "settings", label: "设置", icon: SlidersHorizontal },
];

export function Sidebar({ activeView, onChangeView }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <h2>Mnemo</h2>
        <p>Memory planner</p>
      </div>
      <nav className="side-nav" aria-label="应用导航">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.view || (activeView === "planDetail" && item.view === "plans");
          return (
            <button
              key={item.view}
              className={active ? "side-nav-item active" : "side-nav-item"}
              onClick={() => onChangeView(item.view)}
            >
              <Icon size={15} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
