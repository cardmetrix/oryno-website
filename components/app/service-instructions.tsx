"use client";

import { MotionSection } from "@/components/app/motion-section";
import {
  SERVICE_INSTRUCTIONS,
  type ServiceInstructionId,
} from "@/lib/service-instructions";
import { cn } from "@/lib/utils";

type ServiceInstructionsProps = {
  service: ServiceInstructionId;
  /** Framer motion delay for MotionSection */
  delay?: number;
  className?: string;
};

export function ServiceInstructions({
  service,
  delay = 0.08,
  className,
}: ServiceInstructionsProps) {
  const content = SERVICE_INSTRUCTIONS[service];

  return (
    <MotionSection
      delay={delay}
      className={cn(
        "rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <h2 className="text-base font-semibold text-foreground">Instructions</h2>
      <p className="mt-1 text-xs text-muted-foreground">{content.subtitle}</p>
      <ol className="mt-4 space-y-3">
        {content.steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-oryno-orange-muted text-xs font-bold text-primary">
              {index + 1}
            </span>
            <p className="pt-1 text-sm leading-relaxed text-foreground">
              {step}
            </p>
          </li>
        ))}
      </ol>
    </MotionSection>
  );
}
