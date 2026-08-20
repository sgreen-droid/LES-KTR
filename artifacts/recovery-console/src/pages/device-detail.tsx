import { useParams, Link } from "wouter";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import { useGetRecoveryDevice } from "@/hooks/api";
import { getGetRecoveryDeviceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  MapIcon
} from "lucide-react";

export default function DeviceDetail() {
  const params = useParams();
  const endpointId = params.endpointId || "";
  
  const { data: device, isLoading, isError } = useGetRecoveryDevice(endpointId, {
    query: { enabled: !!endpointId, queryKey: getGetRecoveryDeviceQueryKey(endpointId) },
    request: { credentials: "include" }
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <div><Skeleton className="h-8 w-24 mb-6" /></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card><CardContent className="h-64 pt-6"><Skeleton className="h-full w-full" /></CardContent></Card>
            <Card><CardContent className="h-48 pt-6"><Skeleton className="h-full w-full" /></CardContent></Card>
          </div>
          <div className="space-y-6">
            <Card><CardContent className="h-64 pt-6"><Skeleton className="h-full w-full" /></CardContent></Card>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !device) {
    return (
      <div className="space-y-6">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Fleet
        </Link>
        <Card className="border-destructive/50 bg-destructive/5 max-w-2xl">
          <CardContent className="p-6 flex items-start gap-4 text-destructive">
            <ServerCrash className="h-6 w-6 mt-1" />
            <div>
              <p className="font-semibold text-lg">Device Not Found or Unavailable</p>
              <p className="opacity-90 mt-1">The requested endpoint could not be retrieved from Action1.</p>
              <Button variant="outline" className="mt-4 border-destructive/20 hover:bg-destructive/10" asChild>
                <Link href="/">Return to Dashboard</Link>
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
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Fleet
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <MonitorSmartphone className="h-8 w-8 text-primary" />
            {device.computerName}
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            {device.organizationName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-sm px-3 py-1 font-mono">ID: {device.endpointId}</Badge>
          <Badge 
            variant={
              device.recoveryStatus === 'ACTIVE' ? 'success' : 
              device.recoveryStatus === 'STALE' ? 'warning' : 'secondary'
            }
            className="text-sm px-3 py-1"
          >
            {device.recoveryStatus || device.endpointStatus}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Location Map & Details */}
          <Card className="overflow-hidden border-primary/20 shadow-sm">
            <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <CardTitle>Recovery Location</CardTitle>
                </div>
                {device.locationUpdated && (
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
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
                  <div className="relative w-full h-80 bg-muted flex items-center justify-center border-b">
                    {device.isMapSafe && device.mapEmbedUrl ? (
                      <iframe 
                        src={device.mapEmbedUrl}
                        width="100%" 
                        height="100%" 
                        style={{ border: 0 }} 
                        allowFullScreen={false} 
                        loading="lazy" 
                        referrerPolicy="no-referrer-when-downgrade"
                        className="absolute inset-0"
                        title="Device Location"
                      />
                    ) : (
                      <div className="text-center p-6 text-muted-foreground flex flex-col items-center">
                        <MapIcon className="h-12 w-12 mb-3 opacity-20" />
                        <p>Map embedding is unavailable or not safe for this location.</p>
                      </div>
                    )}
                    
                    {/* Floating precision indicator */}
                    <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur shadow-sm border rounded-md p-2 text-xs flex flex-col gap-1 z-10 pointer-events-none">
                      <span className="font-semibold flex items-center gap-1">
                        Precision: {device.accuracy || "Unknown"}
                      </span>
                      <span className="text-muted-foreground">Source: {device.locationSource || device.positionSource || "GPS/IP"}</span>
                    </div>
                  </div>
                  
                  {/* Location Context */}
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-card">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Coordinates</p>
                      <p className="font-mono text-sm">{device.locationCoordinates}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Summary</p>
                      <p className="text-sm">{device.locationSummary || "No summary available"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 flex flex-col items-center justify-center text-center bg-muted/20">
                  <MapPin className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium text-foreground">No Location Data Available</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                    This endpoint has not reported location data, or location services are disabled on the device.
                  </p>
                </div>
              )}
            </CardContent>
            {device.mapLink && (
              <CardFooter className="bg-muted/10 p-4 border-t flex justify-end">
                <a href={device.mapLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                  Open in External Map <ExternalLink className="h-4 w-4" />
                </a>
              </CardFooter>
            )}
          </Card>

          {/* Assessment Warnings */}
          {(isStale || hasIntegrityIssues || device.locationError) && (
            <Card className="border-orange-500/30 bg-orange-500/5 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-orange-700 dark:text-orange-500">
                  <AlertTriangle className="h-5 w-5" />
                  Recovery Assessment Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {isStale && (
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 mt-0.5 text-orange-600" />
                    <div>
                      <span className="font-semibold text-orange-800 dark:text-orange-400">Stale Location Data:</span> The location reported is {device.locationAgeMinutes} minutes old and may not represent the current position. Do not use for live tracking.
                    </div>
                  </div>
                )}
                {hasIntegrityIssues && (
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 mt-0.5 text-orange-600" />
                    <div>
                      <span className="font-semibold text-orange-800 dark:text-orange-400">Integrity Warning:</span> {device.locationIntegrity}. The reported location might be mocked, spoofed, or otherwise unreliable.
                    </div>
                  </div>
                )}
                {device.locationError && (
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 text-orange-600" />
                    <div>
                      <span className="font-semibold text-orange-800 dark:text-orange-400">Reported Error:</span> {device.locationError}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Operating System</p>
                <p className="text-sm font-medium">{device.operatingSystem || "Unknown"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agent Version</p>
                <p className="text-sm font-mono bg-muted px-2 py-0.5 rounded-sm inline-block">{device.agentVersion || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Seen by Action1</p>
                <p className="text-sm flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {device.lastSeen ? format(parseISO(device.lastSeen), "PP p") : "Unknown"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agent Health</p>
                <Badge variant={device.agentHealth === "OK" ? "success" : "secondary"} className="mt-1">
                  {device.agentHealth || "Unknown"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Telemetry Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location Permission</p>
                <p className="text-sm">{device.locationPermission || "Unknown"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Sync Attempt</p>
                <p className="text-sm text-muted-foreground">
                  {device.lastAttempt ? format(parseISO(device.lastAttempt), "PP p") : "Never"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Sync Success</p>
                <p className="text-sm font-medium">
                  {device.lastSuccess ? format(parseISO(device.lastSuccess), "PP p") : "Never"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
