import type { LucideIcon } from "lucide-react";
import { ReportCard } from "@/components/reports/ReportCard";
import { getRankingColors } from "@/components/reports/chartTheme";
import type { ParticipantCount } from "@/lib/statistics";

interface RankingCardProps {
  icon: LucideIcon;
  title: string;
  items: ParticipantCount[];
}

export function RankingCard({ icon, title, items }: RankingCardProps) {
  return (
    <ReportCard icon={icon} title={title}>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">Sem dados</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.name} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
              <span
                className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
                style={getRankingColors(index)}
              >
                {index + 1}
              </span>
              <span className="flex-1 truncate">{item.name}</span>
              <span className="font-medium">{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </ReportCard>
  );
}
