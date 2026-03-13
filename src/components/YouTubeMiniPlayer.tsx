import { useState } from "react";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface YouTubeMiniPlayerProps {
  videoId: string;
  title?: string;
  onClose: () => void;
}

export default function YouTubeMiniPlayer({ videoId, title, onClose }: YouTubeMiniPlayerProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`relative w-full rounded-xl shadow-md border border-border bg-card overflow-hidden transition-all duration-300 ${
        expanded ? "max-w-lg aspect-video" : "max-w-sm aspect-video"
      }`}
    >
      <div className="absolute top-1 right-1 z-10 flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 bg-black/50 hover:bg-black/70 text-white rounded-full"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 bg-black/50 hover:bg-black/70 text-white rounded-full"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <iframe
        className="w-full h-full"
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={title || "YouTube Player"}
      />
    </div>
  );
}
