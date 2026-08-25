import { useParams, Link, useLocation } from "wouter";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import { useGetRecoveryDevice, useCreateRecoveryIncident, getListRecoveryIncidentsQueryKey } from "@/hooks/api";
import { getGetRecoveryDeviceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  MapPin, 
  ShieldAlert, 
  Clock, 
  ServerCrash,
  AlertTriangle,
  MonitorSmartphone,
  Info,
  ExternalLink,
  MapIcon,
  Crosshair,
  Loader2
} from "lucide-react";

export default function DeviceDetail() {
  const params = useParams();
  const endpointId = params.endpointId || "";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [isIncidentDialogOpen, setIsIncidentDialogOpen] = useState(false);
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentCase, setIncidentCase] = useState("");
  const [incidentOwner, setIncidentOwner] = useState("");
  const [incidentNote, setIncidentNote] = useState("");

  const { data: device, isLoading, isError } = useGetRecoveryDevice(endpointId, {
    query: { enabled: !!endpointId, queryKey: getGetRecoveryDeviceQueryKey(endpointId) },
    request: { credentials: "include" }
  });

  const createIncident = useCreateRecoveryIncident({ request: { credentials: "include" } });

  const handleCreateIncident = () => {
    if (!incidentTitle.trim()) return;

    createIncident.mutate({
      data: {
        title: incidentTitle,
        endpointIds: [endpointId],
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
    setIncidentTitle(`Target: ${device?.computerName || endpointId}`);
    setIncidentCase("");
    setIncidentOwner("");
    setIncidentNote("");
    setIsIncidentDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <div><Skeleton className="h-8 w-24 mb-6 rounded-none" /></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-none"><CardContent className="h-64 pt-6"><Skeleton className="h-full w-full rounded-none" /></CardContent></Card>
            <Card className="rounded-none"><CardContent className="h-48 pt-6"><Skeleton className="h-full w-full rounded-none" /></CardContent></Card>
          </div>
          <div className="space-y-6">
            <Card className="rounded-none"><CardContent className="h-64 pt-6"><Skeleton className="h-full w-full rounded-none" /></CardContent></Card>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !device) {
    return (
      <div className="space-y-6 font-mono">
        <Link href="/" className="inline-flex items-center text-xs uppercase tracking-widest font-bold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Radar
        </Link>
        <Card className="border-t-4 border-t-destructive rounded-none max-w-2xl shadow-none">
          <CardContent className="p-8 flex items-start gap-4 text-destructive">
            <ServerCrash className="h-8 w-8 mt-1" />
            <div>
              <p className="font-bold text-lg uppercase tracking-widest">Asset Not Found</p>
              <p className="font-sans mt-2 opacity-90">The requested endpoint could not be localized on the Action1 network.</p>
              <Button variant="outline" className="mt-6 rounded-none border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground uppercase tracking-widest text-xs font-bold" asChild>
                <Link href="/">Return to Radar</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasLocation = !!device.latitude && !!device.longitude;
  const isStale = device.recoveryStatus === 'STALE';
  const hasIntegrityIssues = device.locationIntegrity && device.locationIntegrity !== 'OK';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center text-xs uppercase tracking-widest font-bold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Radar
        </Link>
        <Button 
          onClick={openDialog}
          className="rounded-none uppercase text-xs font-bold tracking-widest gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
        >
          <Crosshair className="h-4 w-4" />
          Initialize Incident
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3 font-mono uppercase">
            <MonitorSmartphone className="h-8 w-8 text-primary" />
            {device.computerName}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-mono uppercase tracking-widest">
            {device.organizationName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-none text-[10px] px-2 py-1 font-mono uppercase tracking-widest border-border text-muted-foreground bg-muted/50">
            ID: {device.endpointId}
          </Badge>
          <Badge 
            variant="outline"
            className={`rounded-none text-[10px] px-3 py-1 font-mono uppercase tracking-widest font-bold
              ${device.recoveryStatus === 'ACTIVE' ? 'border-green-500 text-green-600 bg-green-500/10' : 
                device.recoveryStatus === 'STALE' ? 'border-orange-500 text-orange-600 bg-orange-500/10' : 
                'border-muted-foreground text-muted-foreground bg-muted'}
            `}
          >
            {device.recoveryStatus || device.endpointStatus}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Location Map & Details */}
          <Card className="rounded-none border-t-4 border-t-primary shadow-none overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <CardTitle className="uppercase tracking-widest text-sm text-foreground">Target Coordinates</CardTitle>
                </div>
                {device.locationUpdated && (
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1 bg-primary/10 px-2 py-1">
                    <Clock className="h-3 w-3" />
                    Updated {formatDistanceToNow(parseISO(device.locationUpdated), { addSuffix: true })}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {hasLocation ? (
                <div className="flex flex-col">
                  {/* Map area */}
                  <div className="relative w-full h-96 bg-secondary flex items-center justify-center border-b border-border overflow-hidden">
                    {/* Scanline overlay effect */}
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] z-10"></div>
                    
                    {device.isMapSafe && device.mapEmbedUrl ? (
                      <iframe 
                        src={device.mapEmbedUrl}
                        width="100%" 
                        height="100%" 
                        style={{ border: 0, filter: 'contrast(1.2) saturate(1.1) brightness(0.9)' }} 
                        allowFullScreen={false} 
                        loading="lazy" 
                        referrerPolicy="no-referrer-when-downgrade"
                        className="absolute inset-0"
                        title="Device Location"
                      />
                    ) : (
                      <div className="text-center p-6 text-secondary-foreground flex flex-col items-center">
                        <MapIcon className="h-12 w-12 mb-3 opacity-50" />
                        <p className="font-mono text-sm uppercase tracking-widest text-secondary-foreground/70">Visual Intel Unavailable</p>
                      </div>
                    )}
                    
                    {/* Floating precision indicator */}
                    <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-md border-l-2 border-l-primary p-3 text-xs flex flex-col gap-1 z-20 font-mono">
                      <span className="font-bold uppercase tracking-widest flex items-center gap-1 text-primary">
                        Precision: {device.accuracy || "Unknown"}
                      </span>
                      <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Source: {device.locationSource || device.positionSource || "GPS/IP"}</span>
                    </div>
                  </div>
                  
                  {/* Location Context */}
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 bg-card">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Raw Coordinates</p>
                      <p className="font-mono text-sm font-bold text-foreground bg-muted/50 p-2 inline-block border-l-2 border-l-border">{device.locationCoordinates}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Intel Summary</p>
                      <p className="text-sm font-sans">{device.locationSummary || "No intel available"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-16 flex flex-col items-center justify-center text-center bg-muted/20 border-b border-border">
                  <Crosshair className="h-16 w-16 text-muted-foreground/30 mb-6" />
                  <h3 className="text-lg font-bold text-foreground uppercase tracking-widest font-mono">Signal Lost</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm font-sans">
                    Asset has not transmitted telemetry or location services are disabled.
                  </p>
                </div>
              )}
            </CardContent>
            {device.mapLink && hasLocation && (
              <CardFooter className="bg-muted/30 p-4 border-t border-border flex justify-end">
                <a href={device.mapLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors font-mono">
                  Launch External Tactical Map <ExternalLink className="h-3 w-3" />
                </a>
              </CardFooter>
            )}
          </Card>

          {/* Assessment Warnings */}
          {(isStale || hasIntegrityIssues || device.locationError) && (
            <Card className="rounded-none border-t-4 border-t-orange-500 bg-orange-500/5 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm uppercase tracking-widest font-bold flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="h-4 w-4" />
                  Operational Warnings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 font-mono text-sm">
                {isStale && (
                  <div className="flex items-start gap-3 p-3 bg-orange-500/10 border-l-2 border-orange-500">
                    <Clock className="h-4 w-4 mt-0.5 text-orange-600" />
                    <div>
                      <span className="font-bold text-orange-700">STALE INTEL:</span> Target telemetry is {device.locationAgeMinutes} minutes old. Do not use for live tracking.
                    </div>
                  </div>
                )}
                {hasIntegrityIssues && (
                  <div className="flex items-start gap-3 p-3 bg-red-500/10 border-l-2 border-red-500">
                    <ShieldAlert className="h-4 w-4 mt-0.5 text-red-600" />
                    <div className="text-red-700">
                      <span className="font-bold">INTEGRITY COMPROMISED:</span> {device.locationIntegrity}. Suspect spoofing or tampering.
                    </div>
                  </div>
                )}
                {device.locationError && (
                  <div className="flex items-start gap-3 p-3 bg-muted border-l-2 border-muted-foreground">
                    <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <span className="font-bold">SYSTEM ERROR:</span> {device.locationError}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <Card className="rounded-none border-t-4 border-t-secondary shadow-none">
            <CardHeader className="pb-4 bg-muted/30 border-b border-border">
              <CardTitle className="uppercase tracking-widest text-sm text-foreground">Asset Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-5 font-mono">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">OS Environment</p>
                <p className="text-sm font-bold">{device.operatingSystem || "UNKNOWN"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Agent Version</p>
                <p className="text-xs bg-muted px-2 py-1 inline-block border-l-2 border-border">{device.agentVersion || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Last Network Ping</p>
                <p className="text-sm flex items-center gap-2">
                  <Clock className="h-3 w-3 text-primary" />
                  {device.lastSeen ? format(parseISO(device.lastSeen), "MMM dd, HH:mm:ss") : "UNKNOWN"}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Agent Health</p>
                <Badge variant="outline" className={`rounded-none text-[10px] uppercase tracking-widest font-bold ${device.agentHealth === "OK" ? "bg-green-500/10 text-green-600 border-green-500" : "bg-muted text-muted-foreground border-border"}`}>
                  {device.agentHealth || "UNKNOWN"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-t-4 border-t-secondary shadow-none">
            <CardHeader className="pb-4 bg-muted/30 border-b border-border">
              <CardTitle className="uppercase tracking-widest text-sm text-foreground">Telemetry Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-5 font-mono">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Permissions</p>
                <p className="text-sm font-bold uppercase">{device.locationPermission || "UNKNOWN"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sync Attempt</p>
                <p className="text-xs text-muted-foreground">
                  {device.lastAttempt ? format(parseISO(device.lastAttempt), "MMM dd, HH:mm:ss") : "NEVER"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sync Success</p>
                <p className="text-sm font-bold">
                  {device.lastSuccess ? format(parseISO(device.lastSuccess), "MMM dd, HH:mm:ss") : "NEVER"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Incident Dialog */}
      <Dialog open={isIncidentDialogOpen} onOpenChange={setIsIncidentDialogOpen}>
        <DialogContent className="rounded-none border-t-4 border-t-primary font-mono sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-widest">Initialize Recovery Incident</DialogTitle>
            <DialogDescription className="font-sans">
              Lock in endpoint <span className="font-bold">{device?.computerName}</span> as evidence for a new persistent recovery operation.
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
              className="rounded-none uppercase tracking-widest text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90" 
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
