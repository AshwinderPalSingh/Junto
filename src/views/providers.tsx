"use client";

import { MotionConfig } from "motion/react";
import { Toaster } from "@/views/ui/sonner";
import { TooltipProvider } from "@/views/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={250}>
        {children}
        <Toaster position="top-center" closeButton offset={16} />
      </TooltipProvider>
    </MotionConfig>
  );
}
