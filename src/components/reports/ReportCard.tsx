import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ReportCardProps {
  icon: LucideIcon;
  title: ReactNode;
  action?: ReactNode;
  contentClassName?: string;
  children: ReactNode;
}

export function ReportCard({ icon: Icon, title, action, contentClassName, children }: ReportCardProps) {
  return (
    <Card>
      <CardHeader className={cn(action && "gap-3 sm:flex-row sm:items-center sm:justify-between")}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

export function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-64 flex items-center justify-center text-muted-foreground">
      {message}
    </div>
  );
}

export function EmptyTable({ message }: { message: string }) {
  return <p className="text-muted-foreground text-center py-8">{message}</p>;
}
