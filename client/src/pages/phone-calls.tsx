import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Phone, ExternalLink } from "lucide-react";

type PhoneCallActivity = {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  leadId?: string | null;
};

type ParsedCall = {
  id: string;
  createdAt: string;
  caller: string | null;
  office: string | null;
  status: string | null;
  duration: string | null;
  recordingUrl: string | null;
};

function parseDescription(activity: PhoneCallActivity): ParsedCall {
  const parts = activity.description.split("|").map((p) => p.trim());
  const data: any = {
    id: activity.id,
    createdAt: activity.createdAt,
    caller: null,
    office: null,
    status: null,
    duration: null,
    recordingUrl: null,
  };

  for (const part of parts) {
    const [labelRaw, ...valueParts] = part.split(":");
    const label = (labelRaw || "").trim().toLowerCase();
    const value = valueParts.join(":").trim();

    if (label.startsWith("caller")) data.caller = value;
    else if (label.startsWith("office")) data.office = value;
    else if (label.startsWith("status")) data.status = value;
    else if (label.startsWith("duration")) data.duration = value;
    else if (label.startsWith("recording")) data.recordingUrl = value;
  }

  return data as ParsedCall;
}

export default function PhoneCallsPage() {
  const { data, isLoading, error } = useQuery<PhoneCallActivity[]>({
    queryKey: ["phone-calls"],
    queryFn: async () => {
      const res = await fetch("/api/phone-calls");
      if (!res.ok) throw new Error("Failed to fetch phone calls");
      return res.json();
    },
  });

  const calls = (data || []).map(parseDescription);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            <CardTitle>Phone Calls</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading calls...</p>}
          {error && (
            <p className="text-sm text-red-500">
              {(error as Error).message || "Failed to load phone calls"}
            </p>
          )}

          {!isLoading && !error && calls.length === 0 && (
            <p className="text-sm text-muted-foreground">No phone calls recorded yet.</p>
          )}

          {!isLoading && !error && calls.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date &amp; Time</TableHead>
                    <TableHead>Caller</TableHead>
                    <TableHead>Office Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Recording</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>
                        {call.createdAt
                          ? new Date(call.createdAt).toLocaleString()
                          : "-"}
                      </TableCell>
                      <TableCell>{call.caller || "-"}</TableCell>
                      <TableCell>{call.office || "-"}</TableCell>
                      <TableCell>{call.status || "-"}</TableCell>
                      <TableCell>{call.duration || "-"}</TableCell>
                      <TableCell>
                        {call.recordingUrl ? (
                          <a
                            href={call.recordingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs underline"
                          >
                            Open <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
