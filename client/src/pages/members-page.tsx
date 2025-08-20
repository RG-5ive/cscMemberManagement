import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Search, Upload, ChevronDown } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import AddMemberDialog from '@/components/admin/add-member-dialog';

// Canadian province codes
const CANADIAN_PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];

// Member type from database
interface Member {
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
  hasPortalAccess?: boolean; // Tracks if member has registered via portal
  importedAt: string;
  
  // For backward compatibility during transitions
  member_number?: string;
  last_name?: string;
  first_name?: string;
  known_as?: string;
  home_phone?: string;
  cell_phone?: string;
  web_reel?: string;
  is_active?: boolean;
  imported_at?: string;
}

export default function MembersPage() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentTab, setCurrentTab] = useState('all');
  const [importInProgress, setImportInProgress] = useState(false);
  const [highlightedMemberId, setHighlightedMemberId] = useState<number | null>(null);
  
  // Infinite scroll state
  const [displayedMembers, setDisplayedMembers] = useState<Member[]>([]);
  const [itemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  
  // Refs for table rows to enable scrolling
  const tableRowRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Check if user is admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast({
        title: "Access Denied",
        description: "You need administrator privileges to access this page.",
        variant: "destructive",
      });
      setLocation('/');
    }
  }, [user, setLocation, toast]);
  
  // Fetch all members when component mounts
  useEffect(() => {
    async function fetchMembers() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await apiRequest('GET', '/api/members?limit=1000');
        const data = await response.json();
        
        // Check if data has the expected structure with members array
        if (data.members && Array.isArray(data.members)) {
          setMembers(data.members);
          setTotalCount(data.pagination?.total || data.members.length);
          
          // Extract unique categories and provinces
          const uniqueCategories = Array.from(
            new Set(data.members.map((member: Member) => member.category))
          ).filter(Boolean) as string[];
          
          // Extract unique provinces and categorize non-Canadian locations as "International"
          const processedProvinces = data.members.map((member: Member) => {
            const province = member.province;
            // If province is not a Canadian province code, mark as "International"
            return CANADIAN_PROVINCES.includes(province) ? province : "International";
          });
          
          const uniqueProvinces = Array.from(
            new Set(processedProvinces)
          ).filter(Boolean).sort() as string[];
          
          setCategories(uniqueCategories);
          setProvinces(uniqueProvinces);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (err) {
        console.error('Error fetching members:', err);
        setError('Failed to load members. Please try again later.');
        toast({
          title: "Error",
          description: "Failed to load members. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    
    if (user && user.role === 'admin') {
      fetchMembers();
    }
  }, [user, toast]);
  
  // State to track if search is in progress
  const [searching, setSearching] = useState(false);
  // State to track what we want to search for after typing is complete
  const [pendingSearchQuery, setPendingSearchQuery] = useState('');
  // Track when the user last typed
  const lastTypedRef = useRef<number>(0);
  
  // Function to toggle member payment status
  const togglePaymentStatus = async (memberId: number, isPaid: boolean) => {
    try {
      const response = await apiRequest('PATCH', `/api/members/${memberId}`, {
        isActive: isPaid
      });
      
      if (response.ok) {
        // Update the member in local state
        setMembers(prev => prev.map(member => 
          member.id === memberId ? { ...member, isActive: isPaid } : member
        ));
        
        toast({
          title: "Payment Status Updated",
          description: `Member payment status changed to ${isPaid ? 'Paid' : 'Not Paid'}`,
        });
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update payment status. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Function to toggle portal access status
  const togglePortalAccess = async (memberId: number, currentAccess: boolean) => {
    try {
      const response = await apiRequest('PATCH', `/api/members/${memberId}`, {
        hasPortalAccess: !currentAccess
      });
      
      if (response.ok) {
        // Update the member in local state
        setMembers(prev => prev.map(member => 
          member.id === memberId ? { ...member, hasPortalAccess: !currentAccess } : member
        ));
        
        toast({
          title: "Portal Access Updated",
          description: `Portal access ${!currentAccess ? 'granted' : 'revoked'} for member`,
        });
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update portal access. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Reference to the timeout for debounce
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchBufferRef = useRef<NodeJS.Timeout | null>(null);
  
  // Handle user input change - only update the input value, don't search
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    setPendingSearchQuery(newValue);
    
    // Clear any existing timeouts
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    if (searchBufferRef.current) {
      clearTimeout(searchBufferRef.current);
    }
    
    // Don't perform search automatically - only on Enter key
  };
  
  // Handle Enter key press to trigger search
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      console.log("Enter key pressed - triggering search for:", searchQuery);
      performSearch(searchQuery);
    }
  };
  
  // Client-side search function for reliable highlighting and scrolling
  const performClientSideSearch = (query: string, membersToSearch: Member[]) => {
    if (!query.trim()) {
      return membersToSearch;
    }
    
    const searchTerm = query.toLowerCase();
    const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0);
    
    return membersToSearch.filter(member => {
      const searchableText = [
        member.firstName || member.first_name || '',
        member.lastName || member.last_name || '',
        member.knownAs || member.known_as || '',
        member.email || '',
        member.occupation || '',
        member.memberNumber || member.member_number || '',
        member.homePhone || member.home_phone || '',
        member.cellPhone || member.cell_phone || '',
        member.province || ''
      ].join(' ').toLowerCase();
      
      // Check if all search words are found in the searchable text
      return searchWords.every(word => searchableText.includes(word));
    });
  };

  // Separate function to perform the actual search
  const performSearch = async (query: string) => {
    // Don't perform search if already searching
    if (searching) return;
    
    try {
      setSearching(true);
      
      // Call the search API if we have a query
      if (query.trim()) {
        console.log("Performing search for:", query);
        console.log("Total members available:", members.length);
        
        // Start with all members and apply client-side search
        let filtered = performClientSideSearch(query, members);
        console.log("Filtered results:", filtered.length);
        
        // Apply category filter if needed
        if (selectedCategory) {
          filtered = filtered.filter((member: Member) => member.category === selectedCategory);
        }
        
        // Apply province filter if needed
        if (selectedProvince) {
          if (selectedProvince === "International") {
            // For International, filter out all Canadian provinces
            filtered = filtered.filter((member: Member) => !CANADIAN_PROVINCES.includes(member.province));
          } else {
            // For Canadian provinces, filter normally
            filtered = filtered.filter((member: Member) => member.province === selectedProvince);
          }
        }
        
        console.log("Search results:", filtered.length, "members found");
        setFilteredMembers(filtered);
        
        // Scroll to first match and highlight it
        if (filtered.length > 0) {
          const firstMatch = filtered[0];
          console.log("First match:", firstMatch.firstName, firstMatch.lastName, "ID:", firstMatch.id);
          setHighlightedMemberId(firstMatch.id);
          
          // Check if the first match is in the currently displayed members
          const firstMatchIndex = filtered.findIndex(member => member.id === firstMatch.id);
          
          // If the match is not in the first page of results, we need to scroll to the top
          // and ensure it gets loaded in the displayed members
          if (firstMatchIndex >= itemsPerPage) {
            console.log("Match is beyond first page, scrolling to top and loading");
            // Reset to show the search results from the beginning
            const initialDisplayed = filtered.slice(0, itemsPerPage);
            setDisplayedMembers(initialDisplayed);
            setCurrentPage(1);
            setHasMoreItems(filtered.length > itemsPerPage);
            
            // Scroll container to top first
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
            
            // Then scroll to the highlighted member with multiple attempts
            setTimeout(() => {
              console.log("First scroll attempt after reset");
              scrollToHighlightedMember(firstMatch.id);
            }, 500);
            
            setTimeout(() => {
              console.log("Second scroll attempt after reset");
              scrollToHighlightedMember(firstMatch.id);
            }, 1000);
          } else {
            // Match is in the current view, scroll to it with multiple attempts
            setTimeout(() => {
              console.log("First scroll attempt in current view");
              scrollToHighlightedMember(firstMatch.id);
            }, 200);
            
            setTimeout(() => {
              console.log("Second scroll attempt in current view");
              scrollToHighlightedMember(firstMatch.id);
            }, 800);
            
            setTimeout(() => {
              console.log("Third scroll attempt in current view");
              scrollToHighlightedMember(firstMatch.id);
            }, 1500);
          }
        } else {
          setHighlightedMemberId(null);
          console.log("No search results found");
        }
      } 
      // Otherwise just apply current filters
      else {
        // Use our applyFilters function for consistency
        applyFilters(selectedCategory, selectedProvince);
        setHighlightedMemberId(null); // Clear highlighting when no search query
      }
    } catch (error) {
      console.error('Error searching members:', error);
      toast({
        title: "Search Error",
        description: "Failed to search members. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };
  
  // Cleanup timeouts on unmount and clear highlighting when search is cleared
  useEffect(() => {
    if (!searchQuery.trim()) {
      setHighlightedMemberId(null);
    }
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (searchBufferRef.current) {
        clearTimeout(searchBufferRef.current);
      }
    };
  }, [searchQuery]);
  
  // Initial population of filtered members and displayed members
  useEffect(() => {
    if (members.length > 0 && !filteredMembers.length) {
      setFilteredMembers(members);
    }
  }, [members, filteredMembers.length]);
  
  // Update displayed members when filtered members change
  useEffect(() => {
    if (filteredMembers.length > 0) {
      const initialDisplayed = filteredMembers.slice(0, itemsPerPage);
      setDisplayedMembers(initialDisplayed);
      setCurrentPage(1);
      setHasMoreItems(filteredMembers.length > itemsPerPage);
    } else {
      setDisplayedMembers([]);
      setHasMoreItems(false);
    }
  }, [filteredMembers, itemsPerPage]);
  
  // Handle tab change
  const handleTabChange = (value: string) => {
    setCurrentTab(value);
    
    if (value === 'all') {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(value);
    }
    
    // Apply filters to members
    applyFilters(value, selectedProvince);
  };
  
  // Handle province change
  const handleProvinceChange = (province: string | null) => {
    setSelectedProvince(province);
    
    // Apply filters with current category and new province
    applyFilters(selectedCategory, province);
  };
  
  // Apply both category and province filters
  const applyFilters = (category: string | null, province: string | null) => {
    let result = [...members];
    
    // Apply category filter if selected
    if (category) {
      result = result.filter(member => member.category === category);
    }
    
    // Apply province filter if selected
    if (province) {
      if (province === "International") {
        // For International, filter out all Canadian provinces
        result = result.filter(member => !CANADIAN_PROVINCES.includes(member.province));
      } else {
        // For Canadian provinces, filter normally
        result = result.filter(member => member.province === province);
      }
    }
    
    setFilteredMembers(result);
  };
  
  // Function to scroll to the highlighted member using container-aware scrolling
  const scrollToHighlightedMember = (memberId: number) => {
    console.log("=== ScrollToHighlightedMember called for ID:", memberId, "===");
    console.log("All available refs:", Object.keys(tableRowRefs.current));
    console.log("Container ref:", scrollContainerRef.current);
    
    const container = scrollContainerRef.current;
    if (!container) {
      console.log("❌ No scroll container found");
      return;
    }

    // Log container details
    console.log("Container details:", {
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
      clientHeight: container.clientHeight
    });

    // Try to find the element by ref first
    const rowElement = tableRowRefs.current[memberId];
    if (rowElement) {
      console.log("✅ Found element by ref:", rowElement);
      
      // No visual effects - just scroll
      
      // Get element position relative to container
      const elementRect = rowElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      console.log("Element rect:", elementRect);
      console.log("Container rect:", containerRect);
      
      // Find the element's actual position within the scrollable container
      console.log("Finding element position in scrollable content");
      
      // Walk up to find the actual scrollable content parent
      let scrollableContent = rowElement.parentElement;
      while (scrollableContent && !scrollableContent.closest('.overflow-y-auto')) {
        scrollableContent = scrollableContent.parentElement;
      }
      
      if (scrollableContent) {
        // Get all member rows to find the index
        const allRows = Array.from(scrollableContent.querySelectorAll('.grid.grid-cols-7.gap-4.py-3'));
        const rowIndex = allRows.indexOf(rowElement);
        
        console.log("Row index found:", rowIndex, "out of", allRows.length);
        
        if (rowIndex >= 0) {
          // Calculate approximate scroll position based on row height
          const estimatedRowHeight = 60; // approximate height of each row
          const targetScrollPosition = (rowIndex * estimatedRowHeight) - (container.clientHeight / 2);
          
          console.log("Calculated scroll position:", {
            rowIndex,
            estimatedRowHeight,
            targetScrollPosition,
            currentScroll: container.scrollTop
          });
          
          // Force immediate scroll without smooth behavior first
          container.scrollTop = Math.max(0, targetScrollPosition);
          
          // Then do a slight adjustment with smooth scrolling
          setTimeout(() => {
            container.scrollTo({
              top: Math.max(0, targetScrollPosition),
              behavior: 'smooth'
            });
          }, 100);
          
          console.log("Forced scroll to position:", Math.max(0, targetScrollPosition));
        }
      }
      
      console.log("✅ Scrolled to member using ref:", memberId);
      return;
    }
    
    // Fallback: Find by highlighting classes with more aggressive selectors
    console.log("🔄 Trying fallback: Finding by highlighted classes");
    
    const selectors = [
      'div[class*="bg-blue-50"]',
      'div[class*="animate-pulse"]', 
      '.grid.grid-cols-7.gap-4.py-3',
      'div.grid:has([class*="bg-blue"])',
      'div.grid[class*="bg-blue"]'
    ];
    
    let highlightedElement = null;
    for (const selector of selectors) {
      highlightedElement = document.querySelector(selector);
      if (highlightedElement) {
        console.log("Found element with selector:", selector);
        break;
      }
    }
    
    if (highlightedElement) {
      console.log("✅ Found highlighted element:", highlightedElement);
      
      // No visual effects - just scroll
      
      // Fallback: Find element by calculating position in list
      console.log("Using fallback position calculation");
      
      // Get all grid rows and find the highlighted one
      const allRows = Array.from(container.querySelectorAll('.grid.grid-cols-7.gap-4.py-3'));
      const rowIndex = allRows.indexOf(highlightedElement);
      
      console.log("Fallback row index:", rowIndex, "out of", allRows.length);
      
      if (rowIndex >= 0) {
        const estimatedRowHeight = 60;
        const targetScrollPosition = (rowIndex * estimatedRowHeight) - (container.clientHeight / 2);
        
        console.log("Fallback scroll calculation:", {
          rowIndex,
          estimatedRowHeight,
          targetScrollPosition,
          currentScroll: container.scrollTop
        });
        
        // Force immediate scroll
        container.scrollTop = Math.max(0, targetScrollPosition);
        
        // Then smooth scroll
        setTimeout(() => {
          container.scrollTo({
            top: Math.max(0, targetScrollPosition),
            behavior: 'smooth'
          });
        }, 100);
        
        console.log("Fallback forced scroll to:", Math.max(0, targetScrollPosition));
      }
      
      console.log("✅ Scrolled using fallback method");
    } else {
      console.log("❌ No highlighted element found with any selector");
      
      // Final fallback: just scroll to top
      console.log("🔄 Final fallback: scrolling to top of container");
      container.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };
  
  // Function to return text without highlighting
  const highlightSearchTerm = (text: string, searchTerm: string) => {
    // Just return the plain text without any highlighting
    return text;
  };
  
  // Load more items for infinite scroll
  const loadMoreItems = useCallback(() => {
    if (isLoadingMore || !hasMoreItems) return;
    
    setIsLoadingMore(true);
    
    // Simulate loading delay for smooth UX
    setTimeout(() => {
      const nextPage = currentPage + 1;
      const startIndex = currentPage * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const newItems = filteredMembers.slice(startIndex, endIndex);
      
      if (newItems.length > 0) {
        setDisplayedMembers(prev => [...prev, ...newItems]);
        setCurrentPage(nextPage);
        setHasMoreItems(endIndex < filteredMembers.length);
      } else {
        setHasMoreItems(false);
      }
      
      setIsLoadingMore(false);
    }, 300);
  }, [currentPage, filteredMembers, hasMoreItems, isLoadingMore, itemsPerPage]);
  
  // Infinite scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const bottomThreshold = 200; // Start loading when 200px from bottom
    
    if (scrollHeight - scrollTop <= clientHeight + bottomThreshold) {
      loadMoreItems();
    }
  }, [loadMoreItems]);
  
  // Handle continue import
  const handleContinueImport = async () => {
    try {
      setImportInProgress(true);
      
      const response = await apiRequest('POST', '/api/members/continue-import');
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Import Started",
          description: "The import process has started. This may take a few minutes. You can refresh the page to see new members as they are imported.",
        });
        
        // Set a timer to refresh the list after a delay
        setTimeout(() => {
          window.location.reload();
        }, 10000); // Refresh after 10 seconds to show initial import progress
      } else {
        throw new Error(data.error || "Unknown error occurred");
      }
    } catch (err) {
      console.error('Error starting import:', err);
      toast({
        title: "Import Failed",
        description: "Failed to start the import process. Please try again.",
        variant: "destructive",
      });
    } finally {
      setImportInProgress(false);
    }
  };
  
  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
        <span className="ml-2">Loading member data...</span>
      </div>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-destructive text-xl mb-4">{error}</div>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Member Management</h1>
      
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Total Members</CardTitle>
            <CardDescription>Total members in database</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalCount}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Categories</CardTitle>
            <CardDescription>Member categories</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{categories.length}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Filtered Results</CardTitle>
            <CardDescription>Current view count</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{filteredMembers.length}</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex flex-col lg:flex-row justify-between items-start gap-4 mb-6">
        {/* Search input */}
        <div className="w-full lg:w-1/2 xl:w-1/3 space-y-1">
          <div className="relative">
            {searching ? (
              <LoadingSpinner className="h-4 w-4 absolute left-3 top-3 text-primary animate-spin" />
            ) : (
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            )}
            <Input
              placeholder="Search by name, email, phone, etc... (Press Enter to search)"
              value={searchQuery}
              onChange={handleSearchInputChange}
              onKeyDown={handleSearchKeyDown}
              className="pl-10"
              disabled={searching}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoCapitalize="off"
              inputMode="text"
            />
            {searchQuery.trim() && (
              <div className="absolute right-3 top-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">
                {searching ? 'Searching...' : `${filteredMembers.length} results`}
              </div>
            )}
          </div>
          <div className="flex justify-between">
            <p className="text-xs text-muted-foreground">
              Search by name, email, phone, member number, province, occupation, etc.
            </p>
            {filteredMembers.length < members.length && searchQuery.trim() && (
              <p className="text-xs text-primary">
                Showing {filteredMembers.length} of {members.length} members
              </p>
            )}
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <Button variant="outline" onClick={() => window.location.reload()} className="flex-1 sm:flex-none">
            <RefreshCw className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
            <span className="sm:hidden">Refresh</span>
          </Button>
          
          <Button 
            onClick={handleContinueImport} 
            disabled={importInProgress}
            className="flex-1 sm:flex-none"
          >
            {importInProgress ? (
              <>
                <LoadingSpinner className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Importing...</span>
                <span className="sm:hidden">Importing</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Continue Import</span>
                <span className="sm:hidden">Import</span>
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Category tabs */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className="mb-4">
        <TabsList className="mb-4 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="all" className="text-xs sm:text-sm px-2 sm:px-3">
            <span className="hidden sm:inline">All Members</span>
            <span className="sm:hidden">All</span>
          </TabsTrigger>
          {categories.map(category => (
            <TabsTrigger key={category} value={category} className="text-xs sm:text-sm px-2 sm:px-3">
              <span className="hidden sm:inline">{category}</span>
              <span className="sm:hidden">{category.slice(0, 8)}{category.length > 8 ? '...' : ''}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      
      {/* Province filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="text-sm font-medium min-w-fit">Filter by Province:</div>
        <div className="flex items-center gap-3 flex-1">
          <Select
            value={selectedProvince || "all"}
            onValueChange={(value) => handleProvinceChange(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Provinces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Provinces</SelectItem>
              {provinces.map(province => (
                <SelectItem key={province} value={province}>
                  {province}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProvince && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => handleProvinceChange(null)}
              className="h-8 px-2 text-xs whitespace-nowrap"
            >
              Clear
            </Button>
          )}
        </div>
      </div>
      
      {/* Members table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Member List</CardTitle>
            <CardDescription>
              {selectedCategory || selectedProvince 
                ? `Showing ${displayedMembers.length} of ${filteredMembers.length} members ${selectedCategory ? `in ${selectedCategory}` : ''} ${selectedProvince ? (selectedProvince === "International" ? `from International locations` : `from ${selectedProvince}`) : ''}`
                : `Showing ${displayedMembers.length} of ${filteredMembers.length} members`}
            </CardDescription>
          </div>
          <AddMemberDialog />
        </CardHeader>
        <CardContent className="p-0">
          <div 
            ref={scrollContainerRef}
            className="h-[400px] sm:h-[500px] lg:h-[600px] overflow-y-auto"
            onScroll={handleScroll}
          >
            {/* Table Header - Fixed - Desktop Only */}
            <div className="hidden md:block sticky top-0 bg-background border-b border-border p-4 z-10">
              <div className="grid grid-cols-9 gap-4 font-medium text-sm text-muted-foreground">
                <div className="w-12">#</div>
                <div>Name</div>
                <div>Category</div>
                <div>Email</div>
                <div>Province</div>
                <div>Occupation</div>
                <div className="text-center">Paid</div>
                <div className="text-center">Portal Access</div>
                <div className="text-right">Actions</div>
              </div>
            </div>
            
            {/* Members List */}
            <div className="px-4">
              {displayedMembers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No members found. Try adjusting your search or filters.
                </div>
              ) : (
                displayedMembers.map((member, index) => (
                  <div
                    key={member.id}
                    ref={(el) => {
                      if (el) {
                        tableRowRefs.current[member.id] = el;
                        console.log("Setting ref for member ID:", member.id, "Element:", el);
                      }
                    }}
                    className="border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    {/* Desktop View - Table Row */}
                    <div className="hidden md:grid md:grid-cols-9 gap-4 py-3">
                      <div className="w-12 text-sm font-medium">
                        {member.memberNumber || member.member_number || index + 1}
                      </div>
                      <div className="text-sm">
                        <div>
                          {highlightSearchTerm(
                            `${member.firstName || member.first_name} ${member.lastName || member.last_name}`,
                            searchQuery
                          )}
                        </div>
                        {(member.knownAs || member.known_as) && (
                          <div className="text-xs text-muted-foreground">
                            ({highlightSearchTerm((member.knownAs || member.known_as || ''), searchQuery)})
                          </div>
                        )}
                      </div>
                      <div>
                        <Badge variant="outline" className="text-xs">
                          {member.category || 'Unknown'}
                        </Badge>
                      </div>
                      <div className="text-sm truncate">
                        <a href={`mailto:${member.email}`} className="text-primary hover:underline">
                          {highlightSearchTerm(member.email || '', searchQuery)}
                        </a>
                      </div>
                      <div className="text-sm">
                        {(() => {
                          if (!CANADIAN_PROVINCES.includes(member.province)) {
                            return (
                              <span title={member.province}>
                                <Badge variant="outline" className="bg-blue-50 text-xs">International</Badge>
                                {member.province && <span className="ml-1 text-xs text-muted-foreground">({member.province})</span>}
                              </span>
                            );
                          }
                          return member.province;
                        })()}
                      </div>
                      <div className="text-sm truncate">
                        {highlightSearchTerm(member.occupation || '', searchQuery)}
                      </div>
                      <div className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant={member.isActive ? "default" : "destructive"}
                              size="sm"
                              className={`h-7 px-3 text-xs ${member.isActive ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                            >
                              {member.isActive ? "Paid" : "Not Paid"}
                              <ChevronDown className="h-3 w-3 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem 
                              onClick={() => togglePaymentStatus(member.id, true)}
                              className="text-green-600"
                            >
                              Paid
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => togglePaymentStatus(member.id, false)}
                              className="text-red-600"
                            >
                              Not Paid
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="text-center">
                        <Button
                          variant={member.hasPortalAccess ? "default" : "secondary"}
                          size="sm"
                          onClick={() => togglePortalAccess(member.id, member.hasPortalAccess || false)}
                          className="h-7 px-3 text-xs"
                        >
                          {member.hasPortalAccess ? "Active" : "Not Active"}
                        </Button>
                      </div>
                      <div className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setLocation(`/admin/members/${member.id}`)}
                          className="h-7 px-2 text-xs"
                        >
                          View
                        </Button>
                      </div>
                    </div>

                    {/* Mobile View - Card Layout */}
                    <div className="md:hidden p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-sm">
                            {highlightSearchTerm(
                              `${member.firstName || member.first_name} ${member.lastName || member.last_name}`,
                              searchQuery
                            )}
                          </div>
                          {(member.knownAs || member.known_as) && (
                            <div className="text-xs text-muted-foreground">
                              ({highlightSearchTerm((member.knownAs || member.known_as || ''), searchQuery)})
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {member.category || 'Unknown'}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Email: </span>
                          <a href={`mailto:${member.email}`} className="text-primary hover:underline">
                            {highlightSearchTerm(member.email || '', searchQuery)}
                          </a>
                        </div>
                        
                        <div>
                          <span className="text-muted-foreground">Location: </span>
                          {(() => {
                            if (!CANADIAN_PROVINCES.includes(member.province)) {
                              return (
                                <span>
                                  <Badge variant="outline" className="bg-blue-50 text-xs">International</Badge>
                                  {member.province && <span className="ml-1 text-muted-foreground">({member.province})</span>}
                                </span>
                              );
                            }
                            return member.province;
                          })()}
                        </div>
                        
                        {member.occupation && (
                          <div>
                            <span className="text-muted-foreground">Occupation: </span>
                            {highlightSearchTerm(member.occupation || '', searchQuery)}
                          </div>
                        )}
                      </div>
                      
                      {/* Status buttons for mobile */}
                      <div className="flex gap-2 pt-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant={member.isActive ? "default" : "destructive"}
                              size="sm"
                              className={`h-7 px-2 text-xs flex-1 ${member.isActive ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                            >
                              {member.isActive ? "Paid" : "Not Paid"}
                              <ChevronDown className="h-3 w-3 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem 
                              onClick={() => togglePaymentStatus(member.id, true)}
                              className="text-green-600"
                            >
                              Paid
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => togglePaymentStatus(member.id, false)}
                              className="text-red-600"
                            >
                              Not Paid
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant={member.hasPortalAccess ? "default" : "secondary"}
                          size="sm"
                          onClick={() => togglePortalAccess(member.id, member.hasPortalAccess || false)}
                          className="h-7 px-2 text-xs flex-1"
                        >
                          Portal: {member.hasPortalAccess ? "Active" : "Not Active"}
                        </Button>
                      </div>
                      
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-xs text-muted-foreground">
                          #{member.memberNumber || member.member_number || index + 1}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setLocation(`/admin/members/${member.id}`)}
                          className="h-7 px-2 text-xs"
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              {/* Loading indicator */}
              {isLoadingMore && (
                <div className="flex justify-center py-4">
                  <LoadingSpinner className="h-6 w-6" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading more members...</span>
                </div>
              )}
              
              {/* End of list indicator */}
              {!hasMoreItems && displayedMembers.length > 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  End of members list ({filteredMembers.length} total)
                </div>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {filteredMembers.length} of {totalCount} members
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}