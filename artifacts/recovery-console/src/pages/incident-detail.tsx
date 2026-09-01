import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetRecoveryIncident, useUpdateRecoveryIncident, useExportRecoveryIncident, getGetRecoveryIncidentQueryKey, getListRecoveryIncidentsQueryKey } from "@/hooks/api";
import { formatRecoveryDate } from "@/lib/recovery-dates";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, ShieldAlert, Clock, FileJson, FileText, Printer,
  ServerCrash, Loader2, AlertTriangle, CheckCircle2, Lock, Activity, MapPin,
  MonitorSmartphone
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RecoveryIncidentUpdateStatus } from "@workspace/api-client-react";

export default function IncidentDetail() {
  const params = useParams();
  const incidentId = params.incidentId || "";
  const queryClient = useQueryClient();

  const { data: incident, isLoading, isError } = useGetRecoveryIncident(incidentId, {
    query: { enabled: !!incidentId, queryKey: getGetRecoveryIncidentQueryKey(incidentId) },
    request: { credentials: "include" }
  });

  const updateIncident = useUpdateRecoveryIncident({ request: { credentials: "include" } });
  const exportIncident = useExportRecoveryIncident({ request: { credentials: "include" } });

  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState<string>("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (incident && !isEditing) {
      setTitle(incident.title);
      setCaseNumber(incident.caseNumber || "");
      setOwner(incident.owner || "");
      setStatus(incident.status);
      setNote(""); // Notes are append-only mostly, but API allows update to add a note
    }
  }, [incident, isEditing]);

  const handleSave = () => {
    if (!incident) return;
    
    updateIncident.mutate({
      incidentId,
      data: {
        title,
        caseNumber: caseNumber || undefined,
        owner: owner || undefined,
        status: status as RecoveryIncidentUpdateStatus,
        note: note || undefined
      }
    }, {
      onSuccess: () => {
        toast.success("Incident record updated");
        queryClient.invalidateQueries({ queryKey: getGetRecoveryIncidentQueryKey(incidentId) });
        queryClient.invalidateQueries({ queryKey: getListRecoveryIncidentsQueryKey() });
        setIsEditing(false);
        setNote(""); // clear note field after successful append
      },
      onError: () => {
        toast.error("Failed to update incident");
      }
    });
  };

  const handleExportJson = () => {
    exportIncident.mutate({
      incidentId,
      data: { format: "json" }
    }, {
      onSuccess: (data) => {
        // Create a blob and download it
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `incident-${incidentId}-evidence.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Evidence exported to JSON");
      }
    });
  };

  const requestEvidenceExport = async (format: "csv" | "print") => {
    const response = await fetch(`/api/recovery/incidents/${incidentId}/export`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format }),
    });
    if (!response.ok) {
      throw new Error("Evidence export request failed.");
    }
    return response;
  };

  const handleExportCsv = async () => {
    try {
      const response = await requestEvidenceExport("csv");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `incident-${incidentId}-evidence.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Evidence exported to CSV");
    } catch {
      toast.error("Failed to generate CSV evidence");
    }
  };

  const handlePrint = async () => {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      toast.error("Allow pop-ups to open the print-ready evidence packet.");
      return;
    }
    try {
      const response = await requestEvidenceExport("print");
      const documentHtml = await response.text();
      printWindow.document.open();
      printWindow.document.write(documentHtml);
      printWindow.document.close();
      printWindow.focus();
      printWindow.onload = () => printWindow.print();
      toast.success("Print-ready evidence packet opened");
    } catch {
      printWindow.close();
      toast.error("Failed to generate print-ready evidence");
    }
  };

  const getStatusConfig = (s: string) => {
    switch (s) {
      case "OPEN": return { color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: AlertTriangle };
      case "ESCALATED": return { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", icon: ShieldAlert };
      case "RECOVERED": return { color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20", icon: CheckCircle2 };
      case "CLOSED": return { color: "text-muted-foreground", bg: "bg-muted", border: "border-border", icon: Lock };
      default: return { color: "text-foreground", bg: "bg-muted", border: "border-border", icon: AlertTriangle };
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in pb-20">
        <div><Skeleton className="h-8 w-64 mb-6 rounded-none" /></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-none"><CardContent className="h-48 pt-6"><Skeleton className="h-full w-full rounded-none" /></CardContent></Card>
            <Card className="rounded-none"><CardContent className="h-64 pt-6"><Skeleton className="h-full w-full rounded-none" /></CardContent></Card>
          </div>
          <div className="space-y-6">
            <Card className="rounded-none"><CardContent className="h-64 pt-6"><Skeleton className="h-full w-full rounded-none" /></CardContent></Card>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !incident) {
    return (
      <div className="space-y-6 font-mono">
        <Link href="/incidents" className="inline-flex items-center text-xs uppercase tracking-widest font-bold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Incidents
        </Link>
        <Card className="border-t-4 border-t-destructive rounded-none max-w-2xl shadow-none">
          <CardContent className="p-8 flex items-start gap-4 text-destructive">
            <ServerCrash className="h-8 w-8 mt-1" />
            <div>
              <p className="font-bold text-lg uppercase tracking-widest">Incident Not Found</p>
              <p className="font-sans mt-2 opacity-90">The requested operational record is inaccessible or does not exist.</p>
              <Button variant="outline" className="mt-6 rounded-none border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground uppercase tracking-widest text-xs font-bold" asChild>
                <Link href="/incidents">Return to Incident Log</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = getStatusConfig(incident.status).icon;
  const statusCfg = getStatusConfig(incident.status);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link href="/incidents" className="inline-flex items-center text-xs uppercase tracking-widest font-bold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Log
        </Link>
        
        <div className="flex gap-2 font-mono">
          <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-none uppercase tracking-widest text-[10px] font-bold h-8">
            <Printer className="h-3 w-3 mr-2" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="rounded-none uppercase tracking-widest text-[10px] font-bold h-8">
            <FileText className="h-3 w-3 mr-2" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJson} disabled={exportIncident.isPending} className="rounded-none uppercase tracking-widest text-[10px] font-bold h-8 bg-secondary text-secondary-foreground hover:bg-secondary/80">
            {exportIncident.isPending ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <FileJson className="h-3 w-3 mr-2" />}
            JSON
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase font-mono">
              {incident.title}
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm font-mono uppercase tracking-widest">
            Case: <span className="font-bold text-foreground">{incident.caseNumber || "UNASSIGNED"}</span>
          </p>
        </div>
        
        <Badge variant="outline" className={`rounded-none px-3 py-1.5 ${statusCfg.bg} ${statusCfg.color} border-${statusCfg.border} flex items-center gap-2 w-fit uppercase tracking-widest font-bold text-xs`}>
          <StatusIcon className="h-4 w-4" />
          {incident.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Case Info */}
          <Card className="rounded-none border-t-4 border-t-primary shadow-none">
            <CardHeader className="bg-muted/30 pb-4 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="uppercase tracking-widest text-sm text-foreground">Operation Parameters</CardTitle>
              {!isEditing && (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="rounded-none uppercase text-[10px] font-bold tracking-widest h-7">
                  Edit Brief
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-6 font-mono">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="uppercase text-[10px] tracking-widest font-bold text-muted-foreground">Title</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="uppercase text-[10px] tracking-widest font-bold text-muted-foreground">Case Number</Label>
                      <Input value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="uppercase text-[10px] tracking-widest font-bold text-muted-foreground">Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="rounded-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="OPEN">OPEN</SelectItem>
                          <SelectItem value="ESCALATED">ESCALATED</SelectItem>
                          <SelectItem value="RECOVERED">RECOVERED</SelectItem>
                          <SelectItem value="CLOSED">CLOSED</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[10px] tracking-widest font-bold text-muted-foreground">Owner</Label>
                    <Input value={owner} onChange={(e) => setOwner(e.target.value)} className="rounded-none" />
                  </div>
                  <div className="space-y-2 pt-2 border-t border-border mt-4">
                    <Label className="uppercase text-[10px] tracking-widest font-bold text-primary">Append Note to Audit</Label>
                    <Textarea 
                      placeholder="Add a new situational update..." 
                      value={note} 
                      onChange={(e) => setNote(e.target.value)} 
                      className="rounded-none min-h-[100px]"
                    />
                  </div>
                  <div className="flex gap-2 pt-2 justify-end">
                    <Button variant="outline" onClick={() => setIsEditing(false)} className="rounded-none uppercase text-[10px] font-bold tracking-widest">
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={updateIncident.isPending} className="rounded-none uppercase text-[10px] font-bold tracking-widest bg-primary text-primary-foreground hover:bg-primary/90">
                      {updateIncident.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                      Save Updates
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Owner</p>
                    <p className="text-sm font-bold truncate" title={incident.owner || "UNASSIGNED"}>{incident.owner || "UNASSIGNED"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Targets</p>
                    <p className="text-sm font-bold bg-muted/50 px-2 py-0.5 inline-block border-l-2 border-border">{incident.endpointCount}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Reported</p>
                    <p className="text-xs">{formatRecoveryDate(incident.reportedAt, "MMM dd, HH:mm")}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resolved</p>
                    <p className="text-xs">{formatRecoveryDate(incident.resolvedAt, "MMM dd, HH:mm", "-")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Locked Evidence */}
          <Card className="rounded-none border-t-4 border-t-secondary shadow-none">
            <CardHeader className="bg-muted/30 pb-4 border-b border-border">
              <CardTitle className="uppercase tracking-widest text-sm text-foreground flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" /> 
                Immutable Target Evidence
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {incident.evidence.map((ev) => (
                  <div key={ev.endpointId} className="p-4 space-y-3 font-mono text-sm bg-card hover:bg-muted/10 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <div className="font-bold flex items-center gap-2">
                          <MonitorSmartphone className="h-4 w-4 text-primary" />
                          {ev.device.computerName}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">
                          Endpoint: {ev.endpointId} | Device ID: {ev.device.deviceId || "Not reported"} | {ev.organizationName}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="rounded-none text-[10px] uppercase tracking-widest border-border bg-muted/30">
                          Captured: {formatRecoveryDate(ev.capturedAt, "PP p")}
                        </Badge>
                      </div>
                    </div>
                    
                    {ev.device.latitude !== null && ev.device.longitude !== null ? (
                      <div className="bg-muted/30 border border-border p-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> Last-known location
                          </p>
                          <p className="text-xs font-bold border-l-2 border-primary pl-2">{ev.device.locationCoordinates}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Source: {ev.device.locationSource || ev.device.positionSource || "Action1 recovery attribute"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Assessment / provenance</p>
                          <p className="text-xs truncate" title={ev.device.locationSummary || ""}>
                            <span className={ev.device.locationIntegrity?.toUpperCase() === "VALID" ? "text-green-600" : ev.device.locationIntegrity?.toUpperCase() === "INVALID" ? "text-destructive font-bold" : "text-muted-foreground"}>
                              Integrity: {ev.device.locationIntegrity || "UNKNOWN"}
                            </span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Status: {ev.device.locationStatus || "Unavailable"} · Action1 snapshot: {formatRecoveryDate(ev.sourceRefreshedAt, "PP p")}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted/20 border border-dashed border-border p-3 text-center">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">No last-known location was available in the Action1 snapshot at capture time</p>
                      </div>
                    )}
                  </div>
                ))}
                {incident.evidence.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground font-mono">
                    <p className="uppercase text-xs tracking-widest">No target evidence attached</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Audit Timeline Sidebar */}
        <div className="space-y-6">
          <Card className="rounded-none border-t-4 border-t-secondary shadow-none h-full flex flex-col max-h-[800px]">
            <CardHeader className="bg-muted/30 pb-4 border-b border-border shrink-0">
              <CardTitle className="uppercase tracking-widest text-sm text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto grow">
              <div className="relative pl-6 py-6 pr-4 space-y-8 font-mono">
                {/* Timeline vertical line */}
                <div className="absolute top-6 bottom-6 left-[31px] w-[2px] bg-border z-0"></div>
                
                {incident.audit.map((entry) => {
                  let badgeColor = "bg-muted border-border text-foreground";
                  if (entry.eventType.includes("CREATE")) badgeColor = "bg-primary/20 border-primary text-primary";
                  if (entry.eventType.includes("UPDATE")) badgeColor = "bg-blue-500/20 border-blue-500 text-blue-500";
                  if (entry.eventType.includes("NOTE")) badgeColor = "bg-secondary border-border text-secondary-foreground";
                  
                  return (
                    <div key={entry.id} className="relative z-10">
                      <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-background border-2 border-border shadow-sm"></div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className={`rounded-none text-[8px] uppercase tracking-widest px-1.5 py-0 ${badgeColor}`}>
                            {entry.eventType}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{formatRecoveryDate(entry.occurredAt, "MMM dd, HH:mm")}</span>
                        </div>
                        <div className="text-xs mt-1 bg-card border border-border p-2 shadow-sm whitespace-pre-wrap font-sans">
                          {entry.summary}
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-widest text-right">
                          by {entry.actorLabel}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
