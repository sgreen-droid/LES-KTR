import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ShieldCheck, LockIcon, Radio, ShieldAlert } from "lucide-react";
import { useDeleteRecoverySession } from "@/hooks/api";
import { useQueryClient } from "@tanstack/react-query";
import { getGetRecoverySessionQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: ReactNode }) {
  const deleteSession = useDeleteRecoverySession({ request: { credentials: "include" } });
  const queryClient = useQueryClient();
  const [location] = useLocation();

  const handleLock = () => {
    deleteSession.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRecoverySessionQueryKey() });
      }
    });
  };

  const navItems = [
    { href: "/", label: "Fleet Radar", icon: Radio },
    { href: "/incidents", label: "Active Incidents", icon: ShieldAlert },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-transparent">
      <header className="sticky top-0 z-50 w-full border-b-2 border-primary/20 bg-background/95 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="bg-primary p-1.5 text-primary-foreground shadow-sm shadow-primary/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="font-bold tracking-tight text-foreground uppercase tracking-widest text-sm">
                LES Recovery
              </span>
            </div>
            
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
                return (
                  <Link 
                    key={item.href} 
                    href={item.href} 
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
                      isActive 
                        ? "text-primary border-b-2 border-primary -mb-[18px] pb-[16px]" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hidden sm:inline-block border px-2 py-1 bg-muted/50">
              Clearance: High
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLock}
              className="gap-2 text-muted-foreground hover:text-destructive hover:border-destructive hover:bg-destructive/5 font-mono text-xs uppercase"
              disabled={deleteSession.isPending}
            >
              <LockIcon className="h-3 w-3" />
              <span className="hidden sm:inline-block">Lock</span>
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
