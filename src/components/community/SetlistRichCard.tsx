import { Link } from "react-router-dom";
import { ListMusic, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  setlistId: string;
  setlistName: string;
  songCount?: number;
}

export default function SetlistRichCard({ setlistId, setlistName, songCount }: Props) {
  return (
    <Card className="bg-muted/50 border border-border/60">
      <CardContent className="p-4">
        <Link to={`/setlists/${setlistId}`} className="flex items-center gap-3 group">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary shrink-0">
            <ListMusic className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {setlistName}
            </p>
            {typeof songCount === "number" && songCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {songCount} música{songCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" className="shrink-0 gap-1.5 text-xs text-primary">
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
