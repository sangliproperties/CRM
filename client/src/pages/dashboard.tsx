import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, TrendingUp, DollarSign, Phone, Mail, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";


export default function Dashboard() {
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: salesData, isLoading: salesLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/sales"],
  });

  const { data: leadSourceData, isLoading: leadSourceLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/lead-sources"],
  });

  const { data: topAgents, isLoading: agentsLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/top-agents"],
  });

  const { data: recentActivities, isLoading: activitiesLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/recent-activities"],
  });

  const { data: dailyActivities, isLoading: dailyActivitiesLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/daily-activities"],
  });

  const { data: pendingSellBrokerage = [], isLoading: pendingSellLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/pending-sell-brokerage", 10],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/dashboard/pending-sell-brokerage?limit=10");
      return r.json();
    },
  });

  const { data: expiringAgreements = [], isLoading: expiringLoading } = useQuery<any[]>({
    queryKey: ["/api/rent-agreements/ending-soon", 30],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/rent-agreements/ending-soon?days=30");
      return r.json();
    },
  });

  const activeExpiringAgreements =
    (expiringAgreements ?? []).filter(
      (a: any) => a.agreementStatus !== "Agreement Cancel"
    );


  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  function startOfTodayLocal() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function daysLeft(endDate: string | Date | null | undefined) {
    if (!endDate) return null;
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    const today = startOfTodayLocal();
    const diff = Math.ceil((end.getTime() - today.getTime()) / MS_PER_DAY);
    return diff;
  }

  function rowStyleByDaysLeft(d: number | null) {
    // tweak as you like
    if (d === null) return "";
    if (d <= 7) return "bg-red-50";      // urgent
    if (d <= 15) return "bg-orange-50";  // warning
    return "bg-green-50";               // ok (still within 30)
  }

  function badgeVariantByDaysLeft(d: number | null) {
    if (d === null) return "secondary";
    if (d <= 7) return "destructive";
    if (d <= 15) return "default";
    return "secondary";
  }


  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/sales"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/lead-sources"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/top-agents"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-activities"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/daily-activities"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/expiring-agreements"] }); // 👈 add this
    await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/pending-sell-brokerage"] });
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (statsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user?.firstName || "User"}!</p>
        </div>

        {/* RIGHT SIDE: 2 NEW CARDS + REFRESH */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Total Properties For Rent */}
          <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
            <CardContent className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="leading-tight">
                <p className="text-[11px] font-semibold text-slate-500 tracking-wide uppercase">
                  Total Properties For Rent
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {stats?.totalRentProperties || 0}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Total Properties For Sell */}
          <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
            <CardContent className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-orange-600" />
              </div>
              <div className="leading-tight">
                <p className="text-[11px] font-semibold text-slate-500 tracking-wide uppercase">
                  Total Properties For Sell
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {stats?.totalSellProperties || 0}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="button-refresh-dashboard"
            className="h-[44px]"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>


      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Leads */}
        <Card
          className="rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow"
          data-testid="stat-total-leads"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[11px] font-semibold text-slate-500 tracking-wide uppercase">
              Total Leads
            </CardTitle>
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {stats?.totalLeads || 0}
            </div>
            <p className="text-xs text-slate-500">
              {stats?.activeLeads || 0} active
            </p>
          </CardContent>
        </Card>

        {/* Properties */}
        <Card
          className="rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow"
          data-testid="stat-properties"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[11px] font-semibold text-slate-500 tracking-wide uppercase">
              Properties
            </CardTitle>
            <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {stats?.totalProperties || 0}
            </div>
            <p className="text-xs text-slate-500">
              {stats?.availableProperties || 0} available
            </p>
          </CardContent>
        </Card>

        {/* Closed Deals */}
        <Card
          className="rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow"
          data-testid="stat-closed-deals"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[11px] font-semibold text-slate-500 tracking-wide uppercase">
              Closed Deals
            </CardTitle>
            <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {stats?.closedDeals || 0}
            </div>
            <p className="text-xs text-slate-500">This month</p>
          </CardContent>
        </Card>

        {/* Total Revenue (Admin only) */}
        {user?.role === "Admin" || user?.role === "SuperAdmin" ? (
          <Card
            className="rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow"
            data-testid="stat-revenue"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[11px] font-semibold text-slate-500 tracking-wide uppercase">
                Total Revenue
              </CardTitle>
              <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                ₹{stats?.totalRevenue?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-slate-500">All time</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Agreements Ending Soon (Next 30 Days) */}
      <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Agreements Ending Soon (Next 30 Days)
            <Badge variant="secondary" className="ml-2">
              {activeExpiringAgreements.length}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent>
          {expiringLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : expiringAgreements && expiringAgreements.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Client</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Owner</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Property</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Location</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Start Date</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">End Date</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Days Left</th>
                  </tr>
                </thead>
                <tbody>
                  {activeExpiringAgreements.map((a: any) => {
                    const end = a.agreementEndDate ? new Date(a.agreementEndDate) : null;

                    // days left (rounded up)
                    const daysLeft =
                      end ? Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

                    // row color classes
                    const rowClass =
                      daysLeft === null
                        ? "hover:bg-muted/40"
                        : daysLeft <= 7
                          ? "bg-red-50 hover:bg-red-100"
                          : daysLeft <= 15
                            ? "bg-orange-50 hover:bg-orange-100"
                            : "bg-emerald-50 hover:bg-emerald-100";

                    // badge classes
                    const badgeClass =
                      daysLeft === null
                        ? "bg-slate-100 text-slate-700"
                        : daysLeft <= 7
                          ? "bg-red-100 text-red-800"
                          : daysLeft <= 15
                            ? "bg-orange-100 text-orange-800"
                            : "bg-emerald-100 text-emerald-800";

                    // clickable link target:
                    // If you do NOT have /properties/:id page, this still opens Properties page with search.
                    const propertyHref =
                      a.propertyId
                        ? `/properties?search=${encodeURIComponent(a.propertyCode || a.propertyTitle || "")}`
                        : "/properties";

                    return (
                      <tr
                        key={a.id}
                        className={`border-b border-border last:border-0 ${rowClass}`}
                      >
                        <td className="py-3 px-4">
                          {a.clientName}
                          {a.clientPhone ? ` (${a.clientPhone})` : ""}
                        </td>

                        <td className="py-3 px-4">
                          {a.ownerName}
                          {a.ownerPhone ? ` (${a.ownerPhone})` : ""}
                        </td>

                        <td className="py-3 px-4">
                          {a.propertyTitle}
                          {a.propertyCode ? ` - ${a.propertyCode}` : ""}
                        </td>

                        {/* ✅ Location column + clickable */}
                        <td className="py-3 px-4">
                          <a
                            href={propertyHref}
                            className="text-blue-700 hover:underline"
                            title="Open property"
                          >
                            {a.propertyLocation || "-"}
                          </a>
                        </td>

                        <td className="py-3 px-4">
                          {a.agreementStartDate
                            ? new Date(a.agreementStartDate).toLocaleDateString()
                            : "-"}
                        </td>

                        <td className="py-3 px-4 font-semibold text-orange-700 whitespace-nowrap">
                          {a.agreementEndDate ? new Date(a.agreementEndDate).toLocaleDateString() : "-"}
                        </td>

                        {/* ✅ Days Left column */}
                        <td className="py-3 px-4 text-right whitespace-nowrap align-middle">
                          {daysLeft === null ? (
                            "-"
                          ) : (
                            <span
                              className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold ${badgeClass}`}
                            >
                              {daysLeft <= 0 ? "Expired" : `${daysLeft} days left`}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No agreements ending in the next 30 days.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pending Sell Brokerage (Remaining Brokerage) */}
      <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Pending Sell Brokerage Agreements (Remaining)
            <Badge variant="secondary" className="ml-2">
              {pendingSellBrokerage.length}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent>
          {pendingSellLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : pendingSellBrokerage.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Client</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Owner</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Property</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Location</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">
                      Property Reg Date
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">
                      Sell Agreement Date
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">
                      Final Deal Price
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">
                      Total Brokerage
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">
                      Remaining Brokerage
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {pendingSellBrokerage.map((a: any) => (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="py-3 px-4">
                        {a.clientName || "-"}
                        {a.clientPhone ? ` (${a.clientPhone})` : ""}
                      </td>

                      <td className="py-3 px-4">
                        {a.ownerName || "-"}
                        {a.ownerPhone ? ` (${a.ownerPhone})` : ""}
                      </td>

                      <td className="py-3 px-4">{a.propertyTitle || "-"}</td>

                      <td className="py-3 px-4">{a.propertyLocation || "-"}</td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {a.propertyRegistrationDate
                          ? new Date(a.propertyRegistrationDate).toLocaleDateString()
                          : "-"}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {a.sellAgreementDate ? new Date(a.sellAgreementDate).toLocaleDateString() : "-"}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {a.finalDealPrice ? `₹${Number(a.finalDealPrice).toLocaleString()}` : "-"}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {a.totalBrokerage ? `₹${Number(a.totalBrokerage).toLocaleString()}` : "-"}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap font-semibold text-red-600">
                        {a.remainingBrokerage ? `₹${Number(a.remainingBrokerage).toLocaleString()}` : "-"}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">{a.agreementStatus || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No sell agreements with remaining brokerage.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Sales Chart */}
        <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Monthly Sales</CardTitle>
          </CardHeader>
          <CardContent>
            {salesLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={salesData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Lead Sources Chart */}
        <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Lead Sources</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            {leadSourceLoading ? (
              <Skeleton className="h-64 w-64 rounded-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={leadSourceData || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(leadSourceData || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Executive Activities Report */}
      <Card className="border border-card-border">
        <CardHeader>
          <CardTitle>Today's Executive Activities</CardTitle>
          <p className="text-sm text-muted-foreground">Track daily lead assignments, site visits, and closures by each executive</p>
        </CardHeader>
        <CardContent>
          {dailyActivitiesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : dailyActivities && dailyActivities.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Executive</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Role</th>
                    <th className="text-center py-3 px-4 font-medium text-sm text-muted-foreground">Leads Assigned</th>
                    <th className="text-center py-3 px-4 font-medium text-sm text-muted-foreground">Site Visits</th>
                    <th className="text-center py-3 px-4 font-medium text-sm text-muted-foreground">Leads Closed</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyActivities.map((exec: any) => (
                    <tr key={exec.userId} className="border-b border-border last:border-0 hover-elevate" data-testid={`daily-activity-${exec.userId}`}>
                      <td className="py-3 px-4">
                        <p className="font-medium text-sm">{exec.name}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-muted-foreground">{exec.role}</span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                          {exec.leadsAssigned}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-semibold text-sm">
                          {exec.siteVisits}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-semibold text-sm">
                          {exec.leadsClosed}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No activities recorded today</p>
          )}
        </CardContent>
      </Card>

      {/* Bottom Row: Top Agents & Recent Activities */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        {/* Top Agents */}
        <Card className="border border-card-border">
          <CardHeader>
            <CardTitle>Top Performing Agents</CardTitle>
          </CardHeader>
          <CardContent>
            {agentsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : topAgents && topAgents.length > 0 ? (
              <div className="space-y-3">
                {topAgents.map((agent: any, index: number) => (
                  <div key={agent.id} className="flex items-center gap-3 p-3 rounded-lg bg-card hover-elevate">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${index === 0 ? 'bg-gold text-gold-foreground' :
                      index === 1 ? 'bg-chart-1 text-white' :
                        'bg-chart-3 text-white'
                      }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.deals} deals closed</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No agent data available</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-3 w-full mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivities && recentActivities.length > 0 ? (
              <div className="space-y-3">
                {recentActivities.map((activity: any) => (
                  <div key={activity.id} className="flex gap-3 items-start">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${activity.type === 'call' ? 'bg-blue-100 text-blue-600' :
                      activity.type === 'meeting' ? 'bg-green-100 text-green-600' :
                        activity.type === 'email' ? 'bg-purple-100 text-purple-600' :
                          'bg-gray-100 text-gray-600'
                      }`}>
                      {activity.type === 'call' ? <Phone className="w-4 h-4" /> :
                        activity.type === 'email' ? <Mail className="w-4 h-4" /> :
                          <Users className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">{activity.timeAgo}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activities</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
