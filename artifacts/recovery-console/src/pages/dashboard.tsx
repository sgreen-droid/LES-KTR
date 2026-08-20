import { formatDistanceToNow, parseISO } from "date-fns";
import { Link } from "wouter";
import { useGetAction1Readiness, useGetRecoverySummary, useListRecoveryDevices } from "@/hooks/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Activity, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  Search,
  Filter,
  MonitorSmartphone,
  ServerCrash,
  Loader2,
  RefreshCw,
  CheckCircle2
} from "lucide-react";
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";

function SummaryCards() {
  const { data: summary, isLoading, isError } = useGetRecoverySummary({ request: { credentials: "include" } });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="p-6 flex items-center gap-4 text-destructive">
          <ServerCrash className="h-6 w-6" />
          <div>
            <p className="font-semibold">Action1 Connection Unavailable</p>
            <p className="text-sm opacity-90">Could not retrieve fleet summary.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card>
        <CardContent className="p-4 flex flex-col gap-1">
          <div className="flex items-center text-muted-foreground gap-2">
            <MonitorSmartphone className="h-4 w-4" />
            <span className="text-sm font-medium">Total Devices</span>
          </div>
          <span className="text-2xl font-bold text-foreground">{summary.totalDevices}</span>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4 flex flex-col gap-1">
          <div className="flex items-center text-muted-foreground gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Active Locations</span>
          </div>
          <span className="text-2xl font-bold text-primary">{summary.activeLocations}</span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex flex-col gap-1">
          <div className="flex items-center text-muted-foreground gap-2">
            <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
            <span className="text-sm font-medium">Stale Locations</span>
          </div>
          <span className="text-2xl font-bold text-foreground">{summary.staleLocations}</span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex flex-col gap-1">
          <div className="flex items-center text-muted-foreground gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">Attention Req.</span>
          </div>
          <span className="text-2xl font-bold text-foreground">{summary.attentionRequired}</span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex flex-col gap-1">
          <div className="flex items-center text-muted-foreground gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium">Integrity Issues</span>
          </div>
          <span className="text-2xl font-bold text-destructive">{summary.integrityIssues}</span>
        </CardContent>
      </Card>
    </div>
  );
}

function Action1ReadinessBanner() {
  const {
    data: readiness,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useGetAction1Readiness({ request: { credentials: "include" } });
  const isReady = readiness?.status === "READY" && !isError;

  return (
    <Card
      data-testid="action1-readiness"
      className={isReady ? "border-green-600/30 bg-green-600/5" : "border-destructive/40 bg-destructive/5"}
    >
      <CardContent className="p-4 flex items-start gap-3">
        {isLoading ? (
          <Loader2 className="h-5 w-5 mt-0.5 text-muted-foreground animate-spin" />
        ) : isReady ? (
          <CheckCircle2 className="h-5 w-5 mt-0.5 text-green-600 dark:text-green-500" />
        ) : (
          <ServerCrash className="h-5 w-5 mt-0.5 text-destructive" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">Action1 recovery readiness</p>
            <Badge variant={isReady ? "success" : "destructive"}>
              {isLoading ? "Checking" : isReady ? "Ready" : "Action required"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Verifying authentication and recovery read access..."
              : isReady
                ? "Authentication and recovery read access are ready."
                : readiness?.message ??
                  "Action1 recovery data is temporarily unavailable. Retry the readiness check shortly."}
          </p>
        </div>
        {!isReady && (
          <Button
            aria-label="Retry Action1 readiness check"
            disabled={isFetching}
            onClick={() => void refetch()}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [freshness, setFreshness] = useState<"ALL" | "ACTIVE" | "STALE">("ALL");

  const { data: deviceList, isLoading, isError } = useListRecoveryDevices(
    {
      search: debouncedSearch || undefined,
      freshness: freshness === "ALL" ? undefined : freshness
    },
    { request: { credentials: "include" } }
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Fleet Overview</h1>
        <p className="text-muted-foreground">Monitor and assess endpoint recovery status across the organization.</p>
      </div>

      <Action1ReadinessBanner />
      <SummaryCards />

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle>Recovery Endpoints</CardTitle>
            <CardDescription>
              {deviceList ? `${deviceList.devices.length} endpoints found` : "Loading endpoints..."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search endpoints..." 
                className="pl-8" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex border rounded-md overflow-hidden bg-background">
              <button 
                onClick={() => setFreshness("ALL")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${freshness === "ALL" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                All
              </button>
              <button 
                onClick={() => setFreshness("ACTIVE")}
                className={`px-3 py-1.5 text-xs font-medium border-l transition-colors ${freshness === "ACTIVE" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                Active
              </button>
              <button 
                onClick={() => setFreshness("STALE")}
                className={`px-3 py-1.5 text-xs font-medium border-l transition-colors ${freshness === "STALE" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                Stale
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Endpoint</th>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Location Health</th>
                  <th className="px-4 py-3 font-medium">Last Seen</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center">
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mb-2" />
                        <p>Loading endpoints...</p>
                      </div>
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-destructive">
                      Error loading endpoints. Ensure Action1 connection is active.
                    </td>
                  </tr>
                ) : deviceList?.devices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No endpoints found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  deviceList?.devices.map((device) => (
                    <tr key={device.endpointId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{device.computerName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{device.operatingSystem}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {device.organizationName}
                      </td>
                      <td className="px-4 py-3">
                        <Badge 
                          variant={
                            device.recoveryStatus === 'ACTIVE' ? 'success' : 
                            device.recoveryStatus === 'STALE' ? 'warning' : 'secondary'
                          }
                        >
                          {device.recoveryStatus || device.endpointStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-foreground">
                            {device.locationStatus || "Unknown"}
                          </span>
                          {device.locationIntegrity && device.locationIntegrity !== "OK" && (
                            <span className="text-[10px] text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {device.locationIntegrity}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {device.lastSeen ? formatDistanceToNow(parseISO(device.lastSeen), { addSuffix: true }) : "Never"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/devices/${device.endpointId}`}>
                            Inspect
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
