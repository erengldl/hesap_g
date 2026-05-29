import Link from "next/link";
import { ArrowRight } from "lucide-react";

type ModuleHeroAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

type ModuleHeroProps = {
  eyebrow?: string;
  title: string;
  description: string;
  badges?: string[];
  actions?: ModuleHeroAction[];
};

export default function ModuleHero({
  eyebrow,
  title,
  description,
  badges = [],
  actions = [],
}: ModuleHeroProps) {
  return (
    <section className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff,#ffffff)] p-6 shadow-[var(--shadow-card)] sm:p-7">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
      ) : null}
      <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-[2rem] font-semibold tracking-[-0.05em] text-slate-900 sm:text-[2.4rem]">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
          {badges.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500"
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {actions.map((action) => (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                className={
                  action.variant === "primary"
                    ? "btn-primary px-5 py-3 text-sm"
                    : "btn-secondary px-5 py-3 text-sm"
                }
              >
                {action.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
