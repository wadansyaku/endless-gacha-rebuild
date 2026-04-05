import type { ReactNode } from "react";
import { classLabels, factionLabels, missionKindLabels, rarityLabels } from "./labels";
import type { ClassType, Faction, MissionKind, Rarity } from "@endless-gacha/shared";

type ClassNameValue = string | undefined | null | false;

export const cn = (...values: ClassNameValue[]) => values.filter(Boolean).join(" ");

export type ShellProps = {
  title: string;
  subtitle?: string;
  topActions?: ReactNode;
  nav?: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
};

export function Shell({ title, subtitle, topActions, nav, sidebar, children }: ShellProps) {
  return (
    <div className="eg-app">
      <div className="eg-bg" />
      <div className="eg-shell">
        <header className="eg-header">
          <div>
            <p className="eg-eyebrow">Endless Gacha</p>
            <h1 className="eg-title">{title}</h1>
            {subtitle ? <p className="eg-subtitle">{subtitle}</p> : null}
          </div>
          {topActions ? <div className="eg-header-actions">{topActions}</div> : null}
        </header>
        {nav ? <div className="eg-nav-strip">{nav}</div> : null}
        <div className="eg-layout">
          <main className="eg-main">{children}</main>
          {sidebar ? <aside className="eg-sidebar">{sidebar}</aside> : null}
        </div>
      </div>
    </div>
  );
}

export type CardProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Card({ title, subtitle, actions, children, className }: CardProps) {
  return (
    <section className={cn("eg-card", className)}>
      {(title || subtitle || actions) && (
        <header className="eg-card-head">
          <div>
            {title ? <h2 className="eg-card-title">{title}</h2> : null}
            {subtitle ? <p className="eg-card-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="eg-card-actions">{actions}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}

export type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
};

export function Button({
  children,
  onClick,
  variant = "secondary",
  type = "button",
  disabled,
  className
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn("eg-button", `eg-button-${variant}`, disabled && "is-disabled", className)}
    >
      {children}
    </button>
  );
}

export type BadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "accent" | "good" | "warn" | "danger";
  className?: string;
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return <span className={cn("eg-badge", `eg-badge-${tone}`, className)}>{children}</span>;
}

export type StatProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
};

export function Stat({ label, value, hint }: StatProps) {
  return (
    <div className="eg-stat">
      <div className="eg-stat-label">{label}</div>
      <div className="eg-stat-value">{value}</div>
      {hint ? <div className="eg-stat-hint">{hint}</div> : null}
    </div>
  );
}

export type ProgressProps = {
  value: number;
  max?: number;
  label?: string;
  tone?: "cyan" | "gold" | "rose" | "violet";
};

export function Progress({ value, max = 100, label, tone = "cyan" }: ProgressProps) {
  const width = `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
  return (
    <div className="eg-progress-wrap">
      {label ? <div className="eg-progress-label">{label}</div> : null}
      <div className={cn("eg-progress", `eg-progress-${tone}`)}>
        <div className="eg-progress-bar" style={{ width }} />
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="eg-empty">
      <div className="eg-empty-title">{title}</div>
      <p className="eg-empty-desc">{description}</p>
      {action ? <div className="eg-empty-action">{action}</div> : null}
    </div>
  );
}

export type TabItem = {
  id: string;
  label: string;
  href: string;
};

export function Tabs({ items, activeId }: { items: TabItem[]; activeId: string }) {
  return (
    <nav className="eg-tabs" aria-label="Navigation">
      {items.map((item) => (
        <a key={item.id} href={item.href} className={cn("eg-tab", item.id === activeId && "is-active")}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function HeroBanner({
  rarity,
  title,
  subtitle,
  badge
}: {
  rarity?: Rarity;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
}) {
  return (
    <div className={cn("eg-hero-banner", rarity ? `eg-rarity-${rarity}` : "")}>
      <div className="eg-hero-copy">
        {badge ? <div className="eg-hero-badge">{badge}</div> : null}
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </div>
  );
}

export function SplitGrid({ children }: { children: ReactNode }) {
  return <div className="eg-split-grid">{children}</div>;
}

export function Chip({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "good" | "warn" | "danger";
}) {
  return <span className={cn("eg-chip", `eg-chip-${tone}`)}>{children}</span>;
}

export function SectionLabel({
  label,
  meta
}: {
  label: string;
  meta?: string;
}) {
  return (
    <div className="eg-section-label">
      <span>{label}</span>
      {meta ? <span>{meta}</span> : null}
    </div>
  );
}

export function PanelList({ children }: { children: ReactNode }) {
  return <div className="eg-list">{children}</div>;
}

export function PanelRow({
  primary,
  secondary,
  right
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="eg-row">
      <div>
        <div className="eg-row-primary">{primary}</div>
        {secondary ? <div className="eg-row-secondary">{secondary}</div> : null}
      </div>
      {right ? <div className="eg-row-right">{right}</div> : null}
    </div>
  );
}

export function makeLabel(kind: MissionKind, faction?: Faction, classType?: ClassType) {
  const pieces = [missionKindLabels[kind]];
  if (faction) pieces.push(factionLabels[faction]);
  if (classType) pieces.push(classLabels[classType]);
  return pieces.join(" · ");
}

export { classLabels, factionLabels, missionKindLabels, rarityLabels };
