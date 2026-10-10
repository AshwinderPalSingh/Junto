import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type InputProps = Omit<React.ComponentProps<"input">, "type" | "className" | "children"> & {
  type?: "checkbox" | "radio";
};

/**
 * Selectable chips and cards built on real <input>s: they work in plain HTML
 * forms (Server Actions), with the keyboard, and with screen readers.
 */
export function ChoiceChip({
  children,
  className,
  type = "checkbox",
  ...input
}: InputProps & { children: React.ReactNode; className?: string }) {
  return (
    <label
      className={cn(
        "relative inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-[var(--glass-fill)] px-3.5 text-sm backdrop-blur-md transition-all select-none",
        "hover:border-foreground/30 has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
        "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-35",
        className,
      )}
    >
      <input type={type} className="peer sr-only" {...input} />
      {children}
    </label>
  );
}

export function ChoiceCard({
  title,
  description,
  icon,
  className,
  type = "radio",
  ...input
}: InputProps & {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "glass group relative flex cursor-pointer items-start gap-3 p-4 transition-all select-none",
        "hover:border-foreground/25 has-[:checked]:border-foreground has-[:checked]:shadow-[inset_0_0_0_1px_var(--foreground)]",
        "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
        className,
      )}
    >
      <input type={type} className="peer sr-only" {...input} />
      {icon && <span className="mt-0.5 text-foreground [&_svg]:size-5">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {description && <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cn("mt-0.5 grid size-5 shrink-0 place-items-center border border-input text-transparent transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground", type === "radio" ? "rounded-full" : "rounded-sm")}
      >
        {type === "radio" ? <span className="size-2 rounded-full bg-current" /> : <Check className="size-3.5" strokeWidth={3} />}
      </span>
    </label>
  );
}
