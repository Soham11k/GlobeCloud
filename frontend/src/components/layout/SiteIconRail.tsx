import { Link } from "react-router-dom";
import { Briefcase, Code2, Globe2, Network } from "lucide-react";
import { cn } from "@/lib/utils";

const RAIL_LINKS = [
  { to: "/", icon: Globe2, label: "Home" },
  { to: "/status", icon: Network, label: "Status" },
  { to: "/api/docs", icon: Code2, label: "API docs", external: true },
  { to: "/app", icon: Briefcase, label: "Console" },
] as const;

type Props = {
  className?: string;
  activePath?: string;
};

export function SiteIconRail({ className, activePath = "/app" }: Props) {
  return (
    <aside
      className={cn(
        "auth-rail flex w-14 shrink-0 flex-col items-center gap-0 border-r-2 border-foreground py-4",
        className,
      )}
    >
      {RAIL_LINKS.map(({ to, icon: Icon, label, ...rest }) => {
        const external = "external" in rest && rest.external;
        const active = !external && (to === activePath || activePath.startsWith(to + "/") || (to === "/app" && activePath.startsWith("/app")));
        const cls = cn(
          "flex h-10 w-10 items-center justify-center border-b border-foreground",
          active
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        );
        return external ? (
          <a key={to} href={to} target="_blank" rel="noopener noreferrer" className={cls} title={label}>
            <Icon className="h-[18px] w-[18px]" />
          </a>
        ) : (
          <Link key={to} to={to} className={cls} title={label}>
            <Icon className="h-[18px] w-[18px]" />
          </Link>
        );
      })}
    </aside>
  );
}
