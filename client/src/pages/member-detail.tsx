import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Save, ArrowLeft, Mail, Phone, Globe, Instagram, Users, MapPin } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

// Member type from database
export interface Member {
  id: number;
  memberNumber: string;
  category: string;
  lastName: string;
  firstName: string;
  gender: string;
  knownAs: string;
  province: string;
  affiliation: string;
  occupation: string;
  homePhone: string;
  cellPhone: string;
  email: string;
  website: string;
  webReel: string;
  instagram: string;
  isActive: boolean;
  importedAt: string;
}

// List of member categories
const MEMBER_CATEGORIES = [
  'Associate', 
  'Full', 
  'Affiliate', 
  'Student', 
  'Companion', 
  'LifeFull', 
  'LifeAssociate', 
  'LifeAffiliate', 
  'Honorary', 
  'Staff', 
  'LifeCompanion'
];

// List of Canadian provinces
const PROVINCES = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'
];

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<Member | null>(null);
  
  // Setup form
  const { register, handleSubmit, reset, formState: { errors, isDirty }, setValue, watch } = useForm<Member>();
  
  // Check if user is admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast({
        title: "Access Denied",
        description: "You need administrator privileges to access member details.",
        variant: "destructive",
      });
      setLocation('/');
    }
  }, [user, setLocation, toast]);
  
  // Fetch member data
  useEffect(() => {
    async function fetchMember() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await apiRequest('GET', `/api/members/${id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Member not found");
          } else {
            throw new Error("Failed to load member data");
          }
        }
        
        const data = await response.json();
        setMember(data);
        
        // Set form values
        reset(data);
      } catch (err) {
        console.error('Error fetching member:', err);
        setError((err as Error).message || 'Failed to load member data. Please try again later.');
        toast({
          title: "Error",
          description: "Failed to load member details. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    
    if (user?.role === 'admin' && id) {
      fetchMember();
    }
  }, [id, user, reset, toast]);
  
  // Handle form submission - show confirmation dialog first
  const onSubmit = async (data: Member) => {
    console.log('Form submitted with data:', data);
    setPendingFormData(data);
    setShowConfirmDialog(true);
  };

  // Actually update the member after confirmation
  const confirmUpdate = async () => {
    if (!pendingFormData) return;
    
    try {
      setSaving(true);
      setShowConfirmDialog(false);
      
      console.log('Updating member with data:', pendingFormData);
      
      const response = await fetch(`/api/members/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(pendingFormData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API Error:', errorData);
        throw new Error(errorData.error || "Failed to update member");
      }
      
      const updatedMember = await response.json();
      setMember(updatedMember);
      reset(updatedMember);
      setPendingFormData(null);
      
      toast({
        title: "Success",
        description: "Member information updated successfully.",
      });
    } catch (err) {
      console.error('Error updating member:', err);
      toast({
        title: "Update Failed",
        description: "Failed to update member information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Cancel the update
  const cancelUpdate = () => {
    setShowConfirmDialog(false);
    setPendingFormData(null);
  };
  
  // Handle going back to members list
  const handleBack = () => {
    setLocation('/admin/members');
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
        <span className="ml-2">Loading member data...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-destructive text-xl mb-4">{error}</div>
        <div className="flex gap-4">
          <Button onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Members
          </Button>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }
  
  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-destructive text-xl mb-4">Member not found</div>
        <Button onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Members
        </Button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Members
        </Button>
        
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">Member Details</h1>
          <Badge variant={member.isActive ? "default" : "destructive"}>
            {member.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        
        <div className="w-[100px]"></div> {/* Spacer for balance */}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{member.firstName} {member.lastName}</CardTitle>
            <CardDescription>
              {member.knownAs && `Known as: ${member.knownAs}`} • Member #{member.memberNumber} • Category: {member.category}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form id="member-form" onSubmit={handleSubmit(onSubmit)}>
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="basic">Basic Information</TabsTrigger>
                  <TabsTrigger value="contact">Contact Details</TabsTrigger>
                  <TabsTrigger value="professional">Professional Info</TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" {...register('firstName')} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" {...register('lastName')} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="knownAs">Known As</Label>
                      <Input id="knownAs" {...register('knownAs')} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender</Label>
                      <Input id="gender" {...register('gender')} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="memberNumber">Member Number</Label>
                      <Input id="memberNumber" {...register('memberNumber')} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select 
                        onValueChange={(value) => setValue('category', value)} 
                        defaultValue={member.category}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {MEMBER_CATEGORIES.map(category => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="province">Province</Label>
                      <Select 
                        onValueChange={(value) => setValue('province', value)} 
                        defaultValue={member.province}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a province" />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVINCES.map(province => (
                            <SelectItem key={province} value={province}>
                              {province}
                            </SelectItem>
                          ))}
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center space-x-2 pt-6">
                      <Checkbox 
                        id="isActive" 
                        checked={watch('isActive')}
                        onCheckedChange={(checked) => {
                          setValue('isActive', checked === true);
                        }}
                      />
                      <Label htmlFor="isActive">Active Member</Label>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="contact">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" type="email" {...register('email')} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="cellPhone">Cell Phone</Label>
                      <Input id="cellPhone" {...register('cellPhone')} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="homePhone">Home Phone</Label>
                      <Input id="homePhone" {...register('homePhone')} />
                    </div>
                    
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea id="notes" placeholder="Add notes about this member" />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="professional">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="occupation">Occupation</Label>
                      <Input id="occupation" {...register('occupation')} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="affiliation">Affiliation</Label>
                      <Input id="affiliation" {...register('affiliation')} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input id="website" {...register('website')} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="webReel">Web Reel</Label>
                      <Input id="webReel" {...register('webReel')} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="instagram">Instagram</Label>
                      <Input id="instagram" {...register('instagram')} />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </form>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => reset(member)}>
              Reset
            </Button>
            <Button 
              type="submit" 
              form="member-form" 
              disabled={saving}
            >
              {saving ? (
                <>
                  <LoadingSpinner className="h-4 w-4 mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {member.email && (
                <div className="flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                  <a href={`mailto:${member.email}`} className="text-primary hover:underline">
                    {member.email}
                  </a>
                </div>
              )}
              
              {member.cellPhone && (
                <div className="flex items-center">
                  <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{member.cellPhone}</span>
                </div>
              )}
              
              {member.homePhone && (
                <div className="flex items-center">
                  <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{member.homePhone} (Home)</span>
                </div>
              )}
              
              {member.website && (
                <div className="flex items-center">
                  <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                  <a href={member.website.startsWith('http') ? member.website : `https://${member.website}`} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="text-primary hover:underline"
                  >
                    Website
                  </a>
                </div>
              )}
              
              {member.instagram && (
                <div className="flex items-center">
                  <Instagram className="h-4 w-4 mr-2 text-muted-foreground" />
                  <a href={`https://instagram.com/${member.instagram.replace('@', '')}`} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="text-primary hover:underline"
                  >
                    {member.instagram}
                  </a>
                </div>
              )}
              
              {member.province && (
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{member.province}</span>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Professional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {member.occupation && (
                <div>
                  <h3 className="text-sm font-medium">Occupation</h3>
                  <p>{member.occupation}</p>
                </div>
              )}
              
              {member.affiliation && (
                <div>
                  <h3 className="text-sm font-medium">Affiliation</h3>
                  <p>{member.affiliation}</p>
                </div>
              )}
              
              {member.webReel && (
                <div>
                  <h3 className="text-sm font-medium">Web Reel</h3>
                  <a href={member.webReel.startsWith('http') ? member.webReel : `https://${member.webReel}`} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="text-primary hover:underline"
                  >
                    View Reel
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Membership</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <Badge variant={member.isActive ? "default" : "destructive"}>
                  {member.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Category</span>
                <Badge variant="outline">{member.category}</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Member #</span>
                <span className="font-mono">{member.memberNumber || 'N/A'}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Imported</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(member.importedAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to save these changes to member {member?.firstName} {member?.lastName}? 
              This will update their information in the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelUpdate}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmUpdate} disabled={saving}>
              {saving ? (
                <>
                  <LoadingSpinner className="h-4 w-4 mr-2" />
                  Saving...
                </>
              ) : (
                'Confirm & Save'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}