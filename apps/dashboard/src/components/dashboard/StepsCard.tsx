import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";
import { useMemo } from "react";

type Step = {
  title: string | JSX.Element;
  description?: string;
  completed: boolean;
  children: React.ReactNode;
  showCompletedChildren?: boolean;
};

interface StepsCardProps {
  title: string;
  description?: string;
  steps: Step[];
  delay?: number;
}

export const StepsCard: React.FC<StepsCardProps> = ({
  title,
  description,
  steps,
}) => {
  const firstIncomplete = steps.findIndex((step) => !step.completed);
  const lastStepCompleted =
    firstIncomplete === -1 ? steps.length - 1 : firstIncomplete - 1;
  const percentage = ((lastStepCompleted + 1) / steps.length) * 100;
  const isComplete = useMemo(() => firstIncomplete === -1, [firstIncomplete]);

  if (steps.length === 0 || isComplete) {
    return null;
  }

  return (
    <div
      className={cn("border border-border rounded-lg p-4 lg:p-6 bg-muted/30")}
    >
      {/* Title + Desc */}
      <h2 className="text-xl lg:text-2xl font-semibold tracking-tight text-left mb-3">
        {title}
      </h2>

      {/* Progress */}
      <div className="mb-8 flex flex-col gap-2">
        {description && (
          <p className="text-muted-foreground text-sm lg:text-base">
            {description}
          </p>
        )}

        <Progress value={Math.max(percentage, 10)} className="h-2" />

        <p className="text-link-foreground text-xs lg:text-sm">
          {lastStepCompleted + 1}/{steps.length} tasks completed
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full">
        {steps.map(({ children, ...step }, index) => {
          const showChildren =
            !step.completed || (step.completed && step.showCompletedChildren);
          return (
            <div
              className="flex flex-col md:flex-row gap-2 lg:gap-3 md:items-start"
              // biome-ignore lint/suspicious/noArrayIndexKey: FIXME
              key={index}
            >
              <StepNumberBadge
                number={index + 1}
                isCompleted={step.completed}
              />

              <div className="grow">
                {/* Heading + Desc */}
                <div className="flex flex-col mb-3">
                  {typeof step.title === "string" ? (
                    <h3
                      className={cn(
                        "text-base font-medium",
                        step.completed && "text-muted-foreground",
                      )}
                    >
                      {step.title}
                    </h3>
                  ) : (
                    step.title
                  )}

                  {step.description && (
                    <p className="text-muted-foreground/70 text-sm">
                      {step.description}
                    </p>
                  )}
                </div>

                {showChildren && <div className="w-full">{children}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function StepNumberBadge(props: {
  number: number;
  isCompleted: boolean;
}) {
  return (
    <div className="border border-border shrink-0 rounded-full flex items-center justify-center self-start size-7 bg-muted/50">
      {props.isCompleted ? (
        <CheckIcon className="size-4 text-green-500" />
      ) : (
        <span className="text-sm">{props.number}</span>
      )}
    </div>
  );
}
