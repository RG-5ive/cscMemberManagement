import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bell, Check, X, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DemographicChangeRequest {
  id: number;
  requesterId: number;
  memberId: number;
  requestedChanges: Record<string, any>;
  currentValues: Record<string, any>;
  status: "pending" | "approved" | "rejected";
  reasonForChange?: string;
  reviewNotes?: string;
  reviewedById?: number;
  reviewedAt?: string;
  createdAt: string;
  requesterName: string;
  memberName: string;
}

export function DiversityCommitteeRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<DemographicChangeRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: pendingRequests = [], isLoading } = useQuery<DemographicChangeRequest[]>({
    queryKey: ["/api/demographic-change-requests/pending"],
    refetchInterval: 30000, // Check for new requests every 30 seconds
  });

  const reviewRequestMutation = useMutation({
    mutationFn: async ({ requestId, status, reviewNotes }: { requestId: number; status: "approved" | "rejected"; reviewNotes: string }) => {
      return apiRequest(`/api/demographic-change-requests/${requestId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, reviewNotes }),
      });
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.status === "approved" ? "Request Approved" : "Request Rejected",
        description: `The demographic change request has been ${variables.status}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/demographic-change-requests/pending"] });
      setSelectedRequest(null);
      setReviewNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to review request",
        variant: "destructive",
      });
    },
  });

  const handleReviewRequest = async (status: "approved" | "rejected") => {
    if (!selectedRequest) return;
    
    await reviewRequestMutation.mutateAsync({
      requestId: selectedRequest.id,
      status,
      reviewNotes,
    });
  };

  const formatFieldName = (field: string): string => {
    const fieldLabels: Record<string, string> = {
      gender: "Gender",
      lgbtqStatus: "LGBTQ2+ Status",
      bipocStatus: "BIPOC Status",
      ethnicBackground: "Ethnic Background",
      blackStatus: "Black",
      eastAsianStatus: "East Asian",
      indigenousStatus: "Indigenous",
      latinoStatus: "Latino/Hispanic",
      southAsianStatus: "South Asian",
      southeastAsianStatus: "Southeast Asian",
      westAsianArabStatus: "West Asian/Arab",
      whiteStatus: "White",
      provinceTerritory: "Province/Territory",
      languagesSpoken: "Languages Spoken",
    };
    return fieldLabels[field] || field;
  };

  const formatValue = (value: any): string => {
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    return value?.toString() || "Not specified";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Pending Demographic Change Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading requests...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Pending Demographic Change Requests
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingRequests.length} pending
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Review and approve or reject demographic information change requests from members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No pending demographic change requests.
            </p>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <Card key={request.id} className="border-l-4 border-l-yellow-500">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{request.memberName}</h4>
                          <Badge variant="outline">
                            {Object.keys(request.requestedChanges).length} change{Object.keys(request.requestedChanges).length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Requested by: {request.requesterName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                        </p>
                        {request.reasonForChange && (
                          <p className="text-sm italic">
                            Reason: {request.reasonForChange}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedRequest(request)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Review Demographic Change Request</DialogTitle>
                              <DialogDescription>
                                Review the requested changes for {request.memberName}
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <h4 className="font-medium mb-3">Current Values</h4>
                                  <div className="space-y-2">
                                    {Object.entries(request.requestedChanges).map(([field, _]) => (
                                      <div key={field} className="p-3 bg-muted/50 rounded">
                                        <div className="text-sm font-medium">{formatFieldName(field)}</div>
                                        <div className="text-sm text-muted-foreground">
                                          {formatValue(request.currentValues[field])}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="font-medium mb-3">Requested Changes</h4>
                                  <div className="space-y-2">
                                    {Object.entries(request.requestedChanges).map(([field, newValue]) => (
                                      <div key={field} className="p-3 bg-green-50 border border-green-200 rounded">
                                        <div className="text-sm font-medium">{formatFieldName(field)}</div>
                                        <div className="text-sm text-green-700">
                                          {formatValue(newValue)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="reviewNotes">Review Notes (Optional)</Label>
                                <Textarea
                                  id="reviewNotes"
                                  value={reviewNotes}
                                  onChange={(e) => setReviewNotes(e.target.value)}
                                  placeholder="Add any notes about your decision..."
                                  rows={3}
                                />
                              </div>
                              
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="destructive"
                                  onClick={() => handleReviewRequest("rejected")}
                                  disabled={reviewRequestMutation.isPending}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                                <Button
                                  onClick={() => handleReviewRequest("approved")}
                                  disabled={reviewRequestMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}