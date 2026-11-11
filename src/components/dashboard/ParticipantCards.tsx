import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Users, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSessionDayMonth } from "@/components/dashboard/participantDates";
import type { ParticipantOccurrence } from "@/lib/statistics";

/** Quantidade de registros exibidos em cada card antes do "Ver todos". */
export const DASHBOARD_PREVIEW_SIZE = 5;

function PositionBadge({ position }: { position: number }) {
  return (
    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-xs font-medium text-primary">
      {position}
    </span>
  );
}

function ViewAllButton({ onClick, className }: { onClick: () => void; className: string }) {
  return (
    <Button variant="ghost" size="sm" className={className} onClick={onClick}>
      Ver todos
      <ArrowRight className="h-3 w-3 ml-1" />
    </Button>
  );
}

interface DashboardCardProps {
  icon: LucideIcon;
  title: string;
  animationDelay: string;
  children: ReactNode;
}

function DashboardCard({ icon: Icon, title, animationDelay, children }: DashboardCardProps) {
  const style: CSSProperties = { animationDelay };
  return (
    <Card className="animate-slide-up" style={style}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

interface RecentParticipantsCardProps {
  icon: LucideIcon;
  title: string;
  animationDelay: string;
  entries: ParticipantOccurrence[];
  onViewAll: () => void;
  /** Quando informado, exibe o atalho para os sócios que ainda não participaram. */
  onViewMissing?: () => void;
}

export function RecentParticipantsCard({
  icon,
  title,
  animationDelay,
  entries,
  onViewAll,
  onViewMissing,
}: RecentParticipantsCardProps) {
  return (
    <DashboardCard icon={icon} title={title} animationDelay={animationDelay}>
      <div className="space-y-3">
        {entries.slice(0, DASHBOARD_PREVIEW_SIZE).map((entry, index) => (
          <div key={`${entry.name}-${index}`} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PositionBadge position={index + 1} />
              <div className="flex flex-col">
                <span className="text-sm truncate max-w-[120px]">{entry.name}</span>
                <span className="text-xs text-muted-foreground">{entry.type}</span>
              </div>
            </div>
            <span className="text-sm text-muted-foreground">{formatSessionDayMonth(entry.date)}</span>
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro</p>}
      </div>
      {entries.length > 0 && (
        onViewMissing ? (
          <div className="flex flex-col gap-2 mt-3">
            <ViewAllButton onClick={onViewAll} className="w-full" />
            <Button variant="outline" size="sm" className="w-full" onClick={onViewMissing}>
              <UserX className="h-3 w-3 mr-1" />
              Quem não participou
            </Button>
          </div>
        ) : (
          <ViewAllButton onClick={onViewAll} className="w-full mt-3" />
        )
      )}
    </DashboardCard>
  );
}

interface AssistantSequenceCardProps {
  entries: ParticipantOccurrence[];
  onViewAll: () => void;
}

export function AssistantSequenceCard({ entries, onViewAll }: AssistantSequenceCardProps) {
  if (entries.length === 0) return null;

  return (
    <DashboardCard icon={Users} title="Mestres Assistentes" animationDelay="0.4s">
      <div className="space-y-3">
        {entries.slice(0, DASHBOARD_PREVIEW_SIZE).map((entry, index) => (
          <div key={`${entry.name}-${index}`} className="flex items-center gap-2">
            <PositionBadge position={index + 1} />
            <span className="text-sm">{entry.name}</span>
          </div>
        ))}
      </div>
      {entries.length > DASHBOARD_PREVIEW_SIZE && (
        <ViewAllButton onClick={onViewAll} className="w-full mt-3" />
      )}
    </DashboardCard>
  );
}
