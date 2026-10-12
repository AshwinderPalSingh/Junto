import { ShieldCheck } from "lucide-react";
import { Button } from "@/views/ui/button";

export function CampusSignIn() {
  return <div className="mt-6">
    <Button asChild size="xl" className="w-full px-3">
      <a href="/auth/campus/start"><ShieldCheck />Continue with Thapar</a>
    </Button>
    <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground" role="separator">
      <span className="h-px flex-1 bg-border" />or use your campus password<span className="h-px flex-1 bg-border" />
    </div>
  </div>;
}
