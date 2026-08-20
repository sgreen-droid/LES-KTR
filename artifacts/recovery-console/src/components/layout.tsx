import { ReactNode } from "react";
import { Link } from "wouter";
import { ShieldCheck, LockIcon } from "lucide-react";
import { useDeleteRecoverySession } from "@/hooks/api";
import { useQueryClient } from "@tanstack/react-query";
import { getGetRecoverySessionQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: ReactNode }) {
  const deleteSession = useDeleteRecoverySession({ request: { credentials: "include" } });
  const queryClient = useQueryClient();

  const handleLock = () => {
    deleteSession.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRecoverySessionQueryKey() });
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="sticky top-0 z-10 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <Link href="/" className="font-semibold tracking-tight text-foreground transition-colors hover:text-primary">
              Recovery Console
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest hidden sm:inline-block">
              Authorized Personnel Only
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLock}
              className="gap-2 text-muted-foreground hover:text-foreground"
              disabled={deleteSession.isPending}
            >
              <LockIcon className="h-4 w-4" />
              <span className="hidden sm:inline-block">Lock Console</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
