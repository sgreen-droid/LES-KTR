import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListRecoveryDevices, useCreateRecoveryIncident, getListRecoveryIncidentsQueryKey } from "@/hooks/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  MapPin, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  Search,
  MonitorSmartphone,
  ServerCrash,
  Loader2,
  CheckCircle2,
  Crosshair,
  FileJson,
  FileText,
  History,
  Printer
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useQueryClient } from "@tanstack/react-query";
import { formatRecoveryDate, formatRecoveryDistance } from "@/lib/recovery-dates";
import { exportRecoveryLocationHistory, type RecoveryHistoryExportFormat } from "@/lib/recovery-history-export";
import { toast } from "sonner";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [freshness, setFreshness] = useState<"ALL" | "ACTIVE" | "STALE">("ALL");
  const [selectedEndpoints, setSelectedEndpoints] = useState<Set<string>>(new Set());
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  
  const [isIncidentDialogOpen, setIsIncidentDialogOpen] = useState(false);
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentCase, setIncidentCase] = useState("");
  const [incidentOwner, setIncidentOwner] = useState("");
  const [incidentNote, setIncidentNote] = useState("");

  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: deviceList, isLoading, isError } = useListRecoveryDevices(
    {
      search: debouncedSearch || undefined,
      freshness: freshness === "ALL" ? undefined : freshness
    },
    { request: { credentials: "include" } }
  );

  const createIncident = useCreateRecoveryIncident({ request: { credentials: "include" } });

  const toggleEndpoint = (id: string) => {
    const next = new Set(selectedEndpoints);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedEndpoints(next);
  };

  const toggleAll = () => {
    if (!deviceList) return;
    if (selectedEndpoints.size === deviceList.devices.length) {
      setSelectedEndpoints(new Set());
    } else {
      setSelectedEndpoints(new Set(deviceList.devices.map(d => d.endpointId)));
    }
  };

  const handleCreateIncident = () => {
    if (selectedEndpoints.size === 0 || !incidentTitle.trim()) return;

    createIncident.mutate({
      data: {
        title: incidentTitle,
        endpointIds: Array.from(selectedEndpoints),
        caseNumber: incidentCase || undefined,
        owner: incidentOwner || undefined,
        note: incidentNote || undefined
      }
    }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListRecoveryIncidentsQueryKey() });
        setIsIncidentDialogOpen(false);
        setLocation(`/incidents/${data.id}`);
      }
    });
  };

  const openDialog = () => {
    setIncidentTitle("");
    setIncidentCase("");
    setIncidentOwner("");
    setIncidentNote("");
    setIsIncidentDialogOpen(true);
  };

  const handleHistoryExport = async (
    format: RecoveryHistoryExportFormat,
    scope: "fleet" | "selected",
  ) => {
    try {
      await exportRecoveryLocationHistory({
        endpointIds: scope === "selected" ? selectedEndpoints : undefined,
        from: historyFrom || undefined,
        to: historyTo || undefined,
        format,
      });
      toast.success(
        `${scope === "fleet" ? "Fleet" : "Selected endpoint"} history exported as ${format.toUpperCase()}.`,
      );
    } catch {
      toast.error("Could not create the location history export.");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-mono uppercase">Fleet Radar</h1>
        <p className="text-muted-foreground font-mono text-sm">Monitor and assess endpoint recovery status across the organization.</p>
      </div>

      <Card className="rounded-none border-l-4 border-l-primary shadow-none bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Clock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-primary">Last-known telemetry only</p>
            <p className="text-sm text-muted-foreground">
              Action1 snapshot refreshed {formatRecoveryDate(deviceList?.refreshedAt, "PP p", "when available")}.
              Location timestamps come from the endpoint; a powered-off or disconnected PC cannot be located.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-none border-t-4 border-t-secondary shadow-none">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="uppercase tracking-widest text-sm">Location History Export</CardTitle>
              <CardDescription className="mt-1">
                Create case-ready evidence with fleet coverage, endpoint summaries, chronological observations, and apparent coordinate changes. JSON is structured, CSV is spreadsheet-ready, and Print is optimized for review.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="grid grid-cols-2 gap-3 w-full lg:max-w-md">
            <div className="space-y-1">
              <Label htmlFor="history-from" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">From (UTC)</Label>
              <Input id="history-from" type="date" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} className="rounded-none font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="history-to" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">To (UTC)</Label>
              <Input id="history-to" type="date" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} className="rounded-none font-mono text-xs" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void handleHistoryExport("json", "fleet")} className="rounded-none uppercase text-[10px] font-bold tracking-widest">
              <FileJson className="mr-2 h-3 w-3" /> Evidence JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleHistoryExport("csv", "fleet")} className="rounded-none uppercase text-[10px] font-bold tracking-widest">
              <FileText className="mr-2 h-3 w-3" /> Evidence CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleHistoryExport("print", "fleet")} className="rounded-none uppercase text-[10px] font-bold tracking-widest">
              <Printer className="mr-2 h-3 w-3" /> Print Report
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-none border-t-4 border-t-secondary shadow-none">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="uppercase tracking-widest text-sm text-muted-foreground">Recovery Endpoints</CardTitle>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search endpoints..." 
                className="pl-9 rounded-none font-mono text-sm" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex border border-border w-full sm:w-auto bg-background">
              <button 
                onClick={() => setFreshness("ALL")}
                className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${freshness === "ALL" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                All
              </button>
              <button 
                onClick={() => setFreshness("ACTIVE")}
                className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold uppercase tracking-wider border-l border-border transition-colors ${freshness === "ACTIVE" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                Active
              </button>
              <button 
                onClick={() => setFreshness("STALE")}
                className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold uppercase tracking-wider border-l border-border transition-colors ${freshness === "STALE" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                Stale
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left font-mono">
              <thead className="text-[10px] text-muted-foreground uppercase tracking-widest bg-muted/50 border-y border-border">
                <tr>
                  <th className="px-4 py-4 font-bold w-12 text-center">
                    <Checkbox 
                      checked={deviceList && deviceList.devices.length > 0 && selectedEndpoints.size === deviceList.devices.length}
                      onCheckedChange={toggleAll}
                      aria-label="Select all endpoints"
                    />
                  </th>
                  <th className="px-4 py-4 font-bold">Endpoint</th>
                  <th className="px-4 py-4 font-bold">Organization</th>
                  <th className="px-4 py-4 font-bold">Status</th>
                  <th className="px-4 py-4 font-bold">Location Integrity</th>
                  <th className="px-4 py-4 font-bold">Last Seen</th>
                  <th className="px-4 py-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mb-4 text-primary" />
                        <p className="uppercase tracking-widest text-xs">Scanning Fleet...</p>
                      </div>
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-destructive uppercase tracking-widest text-xs font-bold">
                      Error communicating with action1 node
                    </td>
                  </tr>
                ) : deviceList?.devices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-muted-foreground">
                      <Crosshair className="h-8 w-8 mx-auto mb-4 opacity-20" />
                      <p className="uppercase tracking-widest text-xs">No endpoints found</p>
                    </td>
                  </tr>
                ) : (
                  deviceList?.devices.map((device) => {
                    const isSelected = selectedEndpoints.has(device.endpointId);
                    const locationStatus = device.locationStatus?.toUpperCase();
                    const locationStatusClass =
                      locationStatus === "ACTIVE"
                        ? "text-green-600"
                        : locationStatus === "STALE"
                          ? "text-orange-600"
                          : ["NO LOCATION", "PERMISSION DENIED", "ERROR"].includes(locationStatus ?? "")
                            ? "text-destructive"
                            : "text-muted-foreground";
                    const integrityStatus = device.locationIntegrity?.toUpperCase();
                    const integrityIsInvalid = integrityStatus === "INVALID";
                    const integrityNeedsReview = ["LEGACY", "MISSING"].includes(integrityStatus ?? "");
                    return (
                      <tr key={device.endpointId} className={`transition-colors group ${isSelected ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                        <td className="px-4 py-3 text-center">
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleEndpoint(device.endpointId)}
                            aria-label={`Select ${device.computerName}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-foreground">{device.computerName}</div>
                          <div className="text-[10px] text-muted-foreground">Action1 endpoint: {device.endpointId}</div>
                          <div className="text-[10px] text-muted-foreground">Device ID: {device.deviceId || "Not reported"}</div>
                          <div className="text-[10px] text-muted-foreground">{device.serialNumber ? `Serial: ${device.serialNumber}` : device.operatingSystem}</div>
                          {device.isDuplicateComputerName && (
                            <div className="mt-1 text-[10px] text-orange-600 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Duplicate computer name — use Action1 endpoint ID
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          <div>{device.organizationName}</div>
                          <div className="mt-1 text-[10px] font-mono">
                            {device.nearestAddress ||
                              device.crossStreets ||
                              [device.city, device.state, device.postalCode]
                                .filter(Boolean)
                                .join(", ") ||
                              "Nearest address not reported"}
                          </div>
                          {device.country && (
                            <div className="text-[10px] font-mono">{device.country}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge 
                            variant="outline"
                            className={`rounded-none text-[10px] px-2 py-0.5 uppercase tracking-wider
                              ${device.recoveryStatus === 'ACTIVE' ? 'border-green-500 text-green-600 bg-green-500/10' : 
                                device.recoveryStatus === 'STALE' ? 'border-orange-500 text-orange-600 bg-orange-500/10' : 
                                'border-muted-foreground text-muted-foreground'}
                            `}
                          >
                            {device.recoveryStatus || device.endpointStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs font-bold ${locationStatusClass}`}>
                              {device.locationStatus || "UNKNOWN"}
                            </span>
                            {integrityIsInvalid && (
                              <span className="text-[10px] text-destructive flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Integrity: INVALID
                              </span>
                            )}
                            {integrityNeedsReview && (
                              <span className="text-[10px] text-muted-foreground">
                                Integrity: {integrityStatus}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {formatRecoveryDistance(device.lastSeen, "NEVER")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="outline" size="sm" asChild className="rounded-none hover:bg-secondary hover:text-secondary-foreground uppercase text-[10px] font-bold tracking-widest">
                            <Link href={`/devices/${device.endpointId}`}>
                              Inspect
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

      {/* Floating Action Bar for Selected Endpoints */}
      {selectedEndpoints.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 border-t-2 border-primary shadow-lg backdrop-blur-md z-40 animate-in slide-in-from-bottom-10">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-primary text-primary-foreground h-10 w-10 flex items-center justify-center font-bold text-lg font-mono">
                {selectedEndpoints.size}
              </div>
              <div>
                <p className="font-bold uppercase tracking-widest text-sm">Targets Selected</p>
                <p className="text-xs text-muted-foreground font-mono">Ready for incident creation or history export</p>
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="ghost" className="rounded-none uppercase text-xs font-bold tracking-widest" onClick={() => setSelectedEndpoints(new Set())}>
                Clear
              </Button>
              <Button variant="outline" className="rounded-none uppercase text-xs font-bold tracking-widest gap-2" onClick={() => void handleHistoryExport("json", "selected")}>
                <FileJson className="h-4 w-4" />
                History JSON
              </Button>
              <Button variant="outline" className="rounded-none uppercase text-xs font-bold tracking-widest gap-2" onClick={() => void handleHistoryExport("csv", "selected")}>
                <FileText className="h-4 w-4" />
                History CSV
              </Button>
              <Button className="rounded-none uppercase text-xs font-bold tracking-widest gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={openDialog}>
                <ShieldAlert className="h-4 w-4" />
                Initialize Incident
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Incident Dialog */}
      <Dialog open={isIncidentDialogOpen} onOpenChange={setIsIncidentDialogOpen}>
        <DialogContent className="rounded-none border-t-4 border-t-primary font-mono sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-widest">Initialize Recovery Incident</DialogTitle>
            <DialogDescription className="font-sans">
              Lock in {selectedEndpoints.size} endpoint(s) as evidence for a new persistent recovery operation.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="uppercase text-xs tracking-widest font-bold">Operation Title <span className="text-destructive">*</span></Label>
              <Input 
                id="title" 
                placeholder="e.g. Stolen Laptop - NYC Office" 
                value={incidentTitle}
                onChange={(e) => setIncidentTitle(e.target.value)}
                className="rounded-none font-sans"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="case" className="uppercase text-xs tracking-widest font-bold text-muted-foreground">Case Number (Opt)</Label>
                <Input 
                  id="case" 
                  placeholder="e.g. INC-2023-001" 
                  value={incidentCase}
                  onChange={(e) => setIncidentCase(e.target.value)}
                  className="rounded-none font-sans"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner" className="uppercase text-xs tracking-widest font-bold text-muted-foreground">Owner (Opt)</Label>
                <Input 
                  id="owner" 
                  placeholder="e.g. jsmith@les.com" 
                  value={incidentOwner}
                  onChange={(e) => setIncidentOwner(e.target.value)}
                  className="rounded-none font-sans"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="note" className="uppercase text-xs tracking-widest font-bold text-muted-foreground">Initial Briefing / Notes</Label>
              <Textarea 
                id="note" 
                placeholder="Enter circumstances of loss or recovery notes..." 
                value={incidentNote}
                onChange={(e) => setIncidentNote(e.target.value)}
                className="rounded-none font-sans min-h-[100px]"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" className="rounded-none uppercase tracking-widest text-xs font-bold" onClick={() => setIsIncidentDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="rounded-none uppercase tracking-widest text-xs font-bold" 
              onClick={handleCreateIncident}
              disabled={!incidentTitle.trim() || createIncident.isPending}
            >
              {createIncident.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Initialize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
