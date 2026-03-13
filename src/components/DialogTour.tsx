import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DialogTourStep {
  target: string; // CSS selector or "center" for centered overlay
  title: string;
  content: string;
}

interface DialogTourProps {
  steps: DialogTourStep[];
  run: boolean;
  onFinish: () => void;
  scrollContainerSelector?: string;
}

export default function DialogTour({ steps, run, onFinish, scrollContainerSelector }: DialogTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowSide, setArrowSide] = useState<"top" | "bottom">("top");
  const tooltipRef = useRef<HTMLDivElement>(null);

  const positionTooltip = useCallback(() => {
    const step = steps[currentStep];
    if (!step) return;

    if (step.target === "center") {
      setTooltipStyle({
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      });
      setArrowSide("top");
      return;
    }

    const el = document.querySelector(step.target);
    if (!el) {
      // Target not found, skip step
      if (currentStep < steps.length - 1) {
        setCurrentStep((s) => s + 1);
      } else {
        onFinish();
      }
      return;
    }

    // Scroll element into view within the dialog scroll container
    const scrollContainer = scrollContainerSelector
      ? document.querySelector(scrollContainerSelector)
      : el.closest("[data-radix-scroll-area-viewport], .overflow-y-auto, [style*='overflow']");

    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      
      if (elRect.top < containerRect.top || elRect.bottom > containerRect.bottom) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    // Position tooltip after potential scroll
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const tooltipHeight = tooltipRef.current?.offsetHeight || 200;
      const viewportHeight = window.innerHeight;
      
      // Determine if tooltip should go above or below
      const spaceBelow = viewportHeight - rect.bottom;
      const showBelow = spaceBelow > tooltipHeight + 20;

      setTooltipStyle({
        position: "fixed",
        left: `${Math.max(16, Math.min(rect.left, window.innerWidth - 330))}px`,
        top: showBelow ? `${rect.bottom + 12}px` : `${rect.top - tooltipHeight - 12}px`,
        maxWidth: "320px",
        width: "calc(100vw - 32px)",
      });
      setArrowSide(showBelow ? "top" : "bottom");

      // Add highlight to target
      el.classList.add("dialog-tour-highlight");
    });
  }, [currentStep, steps, onFinish, scrollContainerSelector]);

  useEffect(() => {
    if (!run) return;
    setCurrentStep(0);
  }, [run]);

  useEffect(() => {
    if (!run) return;
    
    // Remove previous highlights
    document.querySelectorAll(".dialog-tour-highlight").forEach((el) => {
      el.classList.remove("dialog-tour-highlight");
    });

    const timer = setTimeout(positionTooltip, 100);
    
    return () => {
      clearTimeout(timer);
      document.querySelectorAll(".dialog-tour-highlight").forEach((el) => {
        el.classList.remove("dialog-tour-highlight");
      });
    };
  }, [run, currentStep, positionTooltip]);

  // Reposition on resize
  useEffect(() => {
    if (!run) return;
    window.addEventListener("resize", positionTooltip);
    return () => window.removeEventListener("resize", positionTooltip);
  }, [run, positionTooltip]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      cleanup();
      onFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleSkip = () => {
    cleanup();
    onFinish();
  };

  const cleanup = () => {
    document.querySelectorAll(".dialog-tour-highlight").forEach((el) => {
      el.classList.remove("dialog-tour-highlight");
    });
  };

  if (!run || !steps[currentStep]) return null;

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const isCentered = step.target === "center";

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-[1px]" 
        style={{ zIndex: 9998 }} 
        onClick={handleSkip}
      />
      
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          "rounded-xl border border-border bg-card text-card-foreground p-5 shadow-2xl",
          isCentered && "text-center"
        )}
        style={{ ...tooltipStyle, zIndex: 9999 }}
      >
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Arrow */}
        {!isCentered && (
          <div
            className={cn(
              "absolute w-3 h-3 bg-card border-border rotate-45",
              arrowSide === "top" && "-top-1.5 left-8 border-l border-t",
              arrowSide === "bottom" && "-bottom-1.5 left-8 border-r border-b"
            )}
          />
        )}

        <h3 className="text-base font-bold mb-1.5 pr-5">{step.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{step.content}</p>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-3">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === currentStep ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Pular Tour
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button size="sm" variant="ghost" onClick={handlePrev} className="text-xs h-8">
                Anterior
              </Button>
            )}
            <Button size="sm" onClick={handleNext} className="text-xs h-8 px-4">
              {isLast ? "Concluir" : "Próximo"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
