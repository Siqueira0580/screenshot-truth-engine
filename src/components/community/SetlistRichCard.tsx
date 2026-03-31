import { Link } from "react-router-dom";
import { ListMusic, ExternalLink, Music2, CalendarDays, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  setlistId: string;
  setlistName: string;
  songCount?: number;
  showDate?: string | null;
  showTime?: string | null;
}

export default function SetlistRichCard({ setlistId, setlistName, songCount, showDate, showTime }: Props) {
  const formattedDate = showDate
    ? format(new Date(showDate), "dd/MM/yyyy", { locale: ptBR })
    : null;

  return (
    <Link to={`/setlists/${setlistId}`} className="block group">
      <Card className="bg-muted/40 border border-border/60 transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:bg-muted/70 cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10 text-primary shrink-0 group-hover:bg-primary/20 transition-colors">
              <ListMusic className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                {setlistName}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {typeof songCount === "number" && songCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Music2 className="h-3.5 w-3.5" />
                    {songCount} música{songCount !== 1 ? "s" : ""}
                  </span>
                )}
                {formattedDate && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formattedDate}
                  </span>
                )}
                {showTime && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {showTime}
                  </span>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" className="shrink-0 gap-1.5 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
