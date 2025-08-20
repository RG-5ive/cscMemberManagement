import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { CheckCircle } from "lucide-react";

interface DemographicFormData {
  gender: string;
  lgbtqStatus: string;
  bipocStatus: string;
  ethnicBackground: string;
  blackStatus: string;
  eastAsianStatus: string;
  indigenousStatus: string;
  latinoStatus: string;
  southAsianStatus: string;
  southeastAsianStatus: string;
  westAsianArabStatus: string;
  whiteStatus: string;
  provinceTerritory: string;
  languagesSpoken: string[];
}

interface MemberProfile {
  member: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    memberNumber: string;
    category: string;
  };
}

export function DemographicChangeRequestForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<DemographicFormData>({
    gender: "",
    lgbtqStatus: "",
    bipocStatus: "",
    ethnicBackground: "",
    blackStatus: "",
    eastAsianStatus: "",
    indigenousStatus: "",
    latinoStatus: "",
    southAsianStatus: "",
    southeastAsianStatus: "",
    westAsianArabStatus: "",
    whiteStatus: "",
    provinceTerritory: "",
    languagesSpoken: []
  });
  
  const [reasonForChange, setReasonForChange] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const { data: memberProfile } = useQuery<MemberProfile>({
    queryKey: ["/api/user/member-profile"],
    enabled: !!user?.email,
  });

  const submitRequestMutation = useMutation({
    mutationFn: async (requestData: any) => {
      return apiRequest("POST", "/api/demographic-change-requests", requestData);
    },
    onSuccess: () => {
      // Show success dialog instead of toast
      setShowSuccessDialog(true);
      // Reset form
      setFormData({
        gender: "",
        lgbtqStatus: "",
        bipocStatus: "",
        ethnicBackground: "",
        blackStatus: "",
        eastAsianStatus: "",
        indigenousStatus: "",
        latinoStatus: "",
        southAsianStatus: "",
        southeastAsianStatus: "",
        westAsianArabStatus: "",
        whiteStatus: "",
        provinceTerritory: "",
        languagesSpoken: []
      });
      setReasonForChange("");
      setSelectedLanguages([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit demographic change request",
        variant: "destructive",
      });
    },
  });

  const handleLanguageChange = (language: string, checked: boolean) => {
    setSelectedLanguages(prev => 
      checked 
        ? [...prev, language]
        : prev.filter(lang => lang !== language)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!memberProfile?.member?.id) {
      toast({
        title: "Error",
        description: "Member profile not found",
        variant: "destructive",
      });
      return;
    }

    // Filter out empty values to only submit changes
    const requestedChanges: any = {};
    if (formData.gender) requestedChanges.gender = formData.gender;
    if (formData.lgbtqStatus) requestedChanges.lgbtqStatus = formData.lgbtqStatus;
    if (formData.bipocStatus) requestedChanges.bipocStatus = formData.bipocStatus;
    if (formData.ethnicBackground) requestedChanges.ethnicBackground = formData.ethnicBackground;
    if (formData.blackStatus) requestedChanges.blackStatus = formData.blackStatus;
    if (formData.eastAsianStatus) requestedChanges.eastAsianStatus = formData.eastAsianStatus;
    if (formData.indigenousStatus) requestedChanges.indigenousStatus = formData.indigenousStatus;
    if (formData.latinoStatus) requestedChanges.latinoStatus = formData.latinoStatus;
    if (formData.southAsianStatus) requestedChanges.southAsianStatus = formData.southAsianStatus;
    if (formData.southeastAsianStatus) requestedChanges.southeastAsianStatus = formData.southeastAsianStatus;
    if (formData.westAsianArabStatus) requestedChanges.westAsianArabStatus = formData.westAsianArabStatus;
    if (formData.whiteStatus) requestedChanges.whiteStatus = formData.whiteStatus;
    if (formData.provinceTerritory) requestedChanges.provinceTerritory = formData.provinceTerritory;
    if (selectedLanguages.length > 0) requestedChanges.languagesSpoken = selectedLanguages;

    if (Object.keys(requestedChanges).length === 0) {
      toast({
        title: "No Changes",
        description: "Please select at least one field to update",
        variant: "destructive",
      });
      return;
    }

    await submitRequestMutation.mutateAsync({
      memberId: memberProfile.member.id,
      requestedChanges,
      reasonForChange: reasonForChange || null,
    });
  };

  const languages = [
    "English", "French", "Spanish", "Mandarin", "Cantonese", "Arabic", "Portuguese", 
    "Hindi", "Urdu", "Punjabi", "Tamil", "Korean", "Japanese", "Vietnamese", "Other"
  ];

  const provinces = [
    "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
    "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island",
    "Quebec", "Saskatchewan", "Yukon"
  ];

  return (
    <>
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Request Demographic Information Update</CardTitle>
          <CardDescription>
            Submit a request to update your demographic information. This request will be reviewed by the Diversity Committee before being applied to your profile.
          </CardDescription>
        </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gender */}
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={formData.gender} onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Non-Binary">Non-Binary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* LGBTQ2+ Status */}
            <div className="space-y-2">
              <Label htmlFor="lgbtqStatus">LGBTQ2+ Status</Label>
              <Select value={formData.lgbtqStatus} onValueChange={(value) => setFormData(prev => ({ ...prev, lgbtqStatus: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select LGBTQ2+ status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* BIPOC Status */}
            <div className="space-y-2">
              <Label htmlFor="bipocStatus">BIPOC Status</Label>
              <Select value={formData.bipocStatus} onValueChange={(value) => setFormData(prev => ({ ...prev, bipocStatus: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select BIPOC status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Province/Territory */}
            <div className="space-y-2">
              <Label htmlFor="provinceTerritory">Province/Territory</Label>
              <Select value={formData.provinceTerritory} onValueChange={(value) => setFormData(prev => ({ ...prev, provinceTerritory: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select province/territory" />
                </SelectTrigger>
                <SelectContent>
                  {provinces.map(province => (
                    <SelectItem key={province} value={province}>{province}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ethnic Background Categories */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Ethnic Background (Select all that apply)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "blackStatus", label: "Black" },
                { key: "eastAsianStatus", label: "East Asian" },
                { key: "indigenousStatus", label: "Indigenous" },
                { key: "latinoStatus", label: "Latino/Hispanic" },
                { key: "southAsianStatus", label: "South Asian" },
                { key: "southeastAsianStatus", label: "Southeast Asian" },
                { key: "westAsianArabStatus", label: "West Asian/Arab" },
                { key: "whiteStatus", label: "White" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <Select 
                    value={formData[key as keyof DemographicFormData] as string} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, [key]: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${label.toLowerCase()} status`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          {/* Languages Spoken */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Languages Spoken (Select all that apply)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {languages.map(language => (
                <div key={language} className="flex items-center space-x-2">
                  <Checkbox
                    id={language}
                    checked={selectedLanguages.includes(language)}
                    onCheckedChange={(checked) => handleLanguageChange(language, checked as boolean)}
                  />
                  <Label htmlFor={language} className="text-sm">{language}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Reason for Change */}
          <div className="space-y-2">
            <Label htmlFor="reasonForChange">Reason for Change (Optional)</Label>
            <Textarea
              id="reasonForChange"
              value={reasonForChange}
              onChange={(e) => setReasonForChange(e.target.value)}
              placeholder="Please explain why you are requesting these changes..."
              rows={3}
            />
          </div>

          <Button 
            type="submit" 
            disabled={submitRequestMutation.isPending}
            className="w-full"
          >
            {submitRequestMutation.isPending ? "Submitting Request..." : "Submit Request"}
          </Button>
        </form>
      </CardContent>
    </Card>

    {/* Success Dialog */}
    <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <DialogTitle>Request Submitted Successfully</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Your demographic change request has been sent to the Diversity Committee for review. 
            You will be notified once the committee has processed your request.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button 
            onClick={() => setShowSuccessDialog(false)}
            className="w-full"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}