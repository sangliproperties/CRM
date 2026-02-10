import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, TrendingUp, Users, Building2, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import * as XLSX from 'xlsx';
import type { Lead, Property } from "@shared/schema";

export default function Reports() {
  const { toast } = useToast();

  const { data: reportData, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/summary"],
  });

  const handleExport = async (type: string) => {
    try {
      const response = await fetch(`/api/reports/export/${type}`);
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: `${type} report exported successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export report",
        variant: "destructive",
      });
    }
  };

  const handleExcelExport = async (type: string) => {
    try {
      let data: any[] = [];
      let worksheetName = '';
      
      if (type === 'leads') {
        const response = await fetch('/api/leads');
        if (!response.ok) throw new Error("Failed to fetch leads data");
        const leads: Lead[] = await response.json();
        worksheetName = 'Leads';
        data = leads.map(lead => ({
          'Name': lead.name,
          'Phone': lead.phone,
          'Email': lead.email || '',
          'Source': lead.source,
          'Budget': lead.budget || '',
          'Preferred Location': lead.preferredLocation || '',
          'Stage': lead.stage,
          'Assigned To': lead.assignedTo || '',
          'Next Follow Up': lead.nextFollowUp ? new Date(lead.nextFollowUp).toLocaleDateString() : '',
          'Created At': lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '',
        }));
      } else if (type === 'properties') {
        const response = await fetch('/api/properties');
        if (!response.ok) throw new Error("Failed to fetch properties data");
        const properties: Property[] = await response.json();
        worksheetName = 'Properties';
        data = properties.map(prop => ({
          'Title': prop.title,
          'Location': prop.location,
          'Price': prop.price,
          'Area (sqft)': prop.area,
          'Type': prop.type,
          'Status': prop.status,
          'Latitude': prop.latitude || '',
          'Longitude': prop.longitude || '',
          'Description': prop.description || '',
          'Created At': prop.createdAt ? new Date(prop.createdAt).toLocaleDateString() : '',
        }));
      } else if (type === 'sales') {
        const response = await fetch('/api/dashboard/sales');
        if (!response.ok) throw new Error("Failed to fetch sales data");
        const salesData: any[] = await response.json();
        worksheetName = 'Sales';
        data = salesData.map(item => ({
          'Month': item.month,
          'Sales': item.sales,
        }));
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, worksheetName);
      
      XLSX.writeFile(workbook, `${type}_report_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast({
        title: "Success",
        description: `${type} report exported as Excel successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export Excel report",
        variant: "destructive",
      });
    }
  };

  const handlePDFExport = async (type: 'leads' | 'sales-summary') => {
    try {
      const response = await fetch(`/api/pdf/${type}`);
      if (!response.ok) throw new Error("PDF export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: `${type.replace('-', ' ')} PDF exported successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export PDF",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground">Export and analyze business data</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border border-card-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads Generated</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{reportData?.totalLeads || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-card-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Properties Listed</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{reportData?.totalProperties || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-card-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{reportData?.conversionRate || 0}%</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Export Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover-elevate border border-card-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" />
              <div>
                <CardTitle>Leads Report</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Export all leads data</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              className="w-full" 
              onClick={() => handleExport('leads')}
              data-testid="button-export-leads-csv"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => handleExcelExport('leads')}
              data-testid="button-export-leads-excel"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => handlePDFExport('leads')}
              data-testid="button-export-leads-pdf"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate border border-card-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-gold" />
              <div>
                <CardTitle>Properties Report</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Export all properties data</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              className="w-full" 
              onClick={() => handleExport('properties')}
              data-testid="button-export-properties-csv"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => handleExcelExport('properties')}
              data-testid="button-export-properties-excel"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate border border-card-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-chart-3" />
              <div>
                <CardTitle>Sales Report</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Export sales and revenue data</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              className="w-full" 
              onClick={() => handleExport('sales')}
              data-testid="button-export-sales-csv"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => handleExcelExport('sales')}
              data-testid="button-export-sales-excel"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => handlePDFExport('sales-summary')}
              data-testid="button-export-sales-pdf"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance Report */}
      <Card className="border border-card-border">
        <CardHeader>
          <CardTitle>Agent Performance Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))
            ) : reportData?.agentPerformance && reportData.agentPerformance.length > 0 ? (
              reportData.agentPerformance.map((agent: any) => (
                <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg bg-card">
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-sm text-muted-foreground">{agent.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{agent.deals} Deals</p>
                    <p className="text-sm text-muted-foreground">₹{agent.revenue?.toLocaleString() || 0}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No agent data available</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
