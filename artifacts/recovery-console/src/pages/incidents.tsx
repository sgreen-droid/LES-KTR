import { Link, useLocation } from "wouter";
import { useListRecoveryIncidents } from "@/hooks/api";
import { formatRecoveryDate } from "@/lib/recovery-dates";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert, AlertTriangle, Search, Loader2, CheckCircle2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function IncidentsList() {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();
  const { data, isLoading, isError } = useListRecoveryIncidents({ request: { credentials: "include" } });

  const filteredIncidents = data?.incidents.filter((inc) => 
    inc.title.toLowerCase().includes(search.toLowerCase()) || 
    (inc.caseNumber && inc.caseNumber.toLowerCase().includes(search.toLowerCase())) ||
    (inc.owner && inc.owner.toLowerCase().includes(search.toLowerCase()))
  ) || [];

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "OPEN": return { color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: AlertTriangle };
      case "ESCALATED": return { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", icon: ShieldAlert };
      case "RECOVERED": return { color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20", icon: CheckCircle2 };
      case "CLOSED": return { color: "text-muted-foreground", bg: "bg-muted", border: "border-border", icon: Lock };
      default: return { color: "text-foreground", bg: "bg-muted", border: "border-border", icon: AlertTriangle };
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight uppercase font-mono">Active Incidents</h1>
          <p className="text-muted-foreground">Manage and track persistent recovery operations.</p>
        </div>
        <Button onClick={() => setLocation("/")} className="font-mono uppercase tracking-wider text-xs rounded-none">
          New Incident
        </Button>
      </div>

      <Card className="rounded-none border-t-4 border-t-primary">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="uppercase tracking-widest text-sm text-muted-foreground">Incident Log</CardTitle>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search case, title, or owner..." 
                className="pl-9 rounded-none font-mono text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left font-mono">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-y border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold tracking-widest">Case / Title</th>
                  <th className="px-6 py-4 font-semibold tracking-widest">Status</th>
                  <th className="px-6 py-4 font-semibold tracking-widest">Owner</th>
                  <th className="px-6 py-4 font-semibold tracking-widest">Targets</th>
                  <th className="px-6 py-4 font-semibold tracking-widest">Reported</th>
                  <th className="px-6 py-4 font-semibold tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mb-4 text-primary" />
                        <p className="uppercase tracking-widest text-xs">Decrypting records...</p>
                      </div>
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-destructive uppercase tracking-widest text-xs font-bold">
                      Failed to load incident log
                    </td>
                  </tr>
                ) : filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-muted-foreground">
                      <ShieldAlert className="h-8 w-8 mx-auto mb-4 opacity-20" />
                      <p className="uppercase tracking-widest text-xs">No incidents match criteria</p>
                    </td>
                  </tr>
                ) : (
                  filteredIncidents.map((incident) => {
                    const StatusIcon = getStatusConfig(incident.status).icon;
                    return (
                      <tr key={incident.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-foreground">
                              {incident.caseNumber ? `#${incident.caseNumber}` : "UNASSIGNED"}
                            </span>
                            <span className="text-muted-foreground truncate max-w-[250px]" title={incident.title}>
                              {incident.title}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className={`rounded-none px-2 py-1 ${getStatusConfig(incident.status).bg} ${getStatusConfig(incident.status).color} ${getStatusConfig(incident.status).border} flex items-center gap-1.5 w-fit`}>
                            <StatusIcon className="h-3 w-3" />
                            {incident.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {incident.owner || "-"}
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-secondary/20 text-secondary-foreground px-2 py-1 text-xs">
                            {incident.endpointCount} {incident.endpointCount === 1 ? "DEVICE" : "DEVICES"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground text-xs">
                          {formatRecoveryDate(incident.reportedAt, "MMM dd, HH:mm")}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="outline" size="sm" asChild className="rounded-none hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors uppercase text-[10px] font-bold tracking-widest">
                            <Link href={`/incidents/${incident.id}`}>
                              Open Case
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
