import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock, Timer, Users, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SetlistHeaderProps {
  name: string;
  itemCount: number;
  showDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  intervalDuration?: number | null;
  showDuration?: number | null;
  musicians?: string[] | null;
  onSettingsClick?: () => void;
  children?: React.ReactNode;
}

export default function SetlistHeader({
  name,
  itemCount,
  showDate,
  startTime,
  endTime,
  intervalDuration,
  showDuration,
  musicians,
  onSettingsClick,
  children,
}: SetlistHeaderProps) {
  const hasSchedule = showDate || startTime || (musicians && musicians.length > 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{name}</h1>
            {onSettingsClick && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSettingsClick} title="Configurações do Show">
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {itemCount} música{itemCount !== 1 ? "s" : ""}
          </p>
        </div>
        {children}
      </div>

      {hasSchedule && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground rounded-lg border border-border bg-card/50 px-3 py-2">
          {showDate && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              {format(new Date(showDate), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          )}
          {startTime && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              {startTime}
              {endTime && ` às ${endTime}`}
            </span>
          )}
          {(intervalDuration != null && intervalDuration > 0) && (
            <span className="flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5 text-primary" />
              Intervalo: {intervalDuration}m
            </span>
          )}
          {showDuration != null && showDuration > 0 && (
            <Badge variant="outline" className="text-xs font-normal">
              {showDuration}min de show
            </Badge>
          )}
          {musicians && musicians.length > 0 && (
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" />
              {musicians.join(", ")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
