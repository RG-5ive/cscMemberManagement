import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Check, Info, Globe, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

// Chart colors
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D0743C', '#FF6B6B'];

// Canadian provinces
const CANADIAN_PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];

export default function MemberStatisticsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedViews, setSelectedViews] = useState<string[]>(["category"]);
  
  console.log("MemberStatisticsPage rendering");
  
  const { data: membersData, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/members/statistics"],
    retry: 2,
    staleTime: 0, // Always fetch fresh data for statistics
    refetchOnMount: true,
  });

  console.log("Query state:", { 
    isLoading, 
    hasError: !!error, 
    hasData: !!membersData,
    dataKeys: membersData ? Object.keys(membersData) : null
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-lg">Loading member data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    console.error("Member statistics error:", error);
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12 flex-col space-y-4">
          <div className="text-lg text-red-500">Failed to load statistics.</div>
          <div className="text-sm text-gray-500">Error: {(error as any)?.message || String(error)}</div>
          <button 
            onClick={() => refetch()} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry Loading Statistics
          </button>
        </div>
      </div>
    );
  }

  const allMembers = (membersData as any)?.members || [];
  
  if (allMembers.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-lg">No member data available</div>
        </div>
      </div>
    );
  }

  // Get unique categories
  const allCategories = Array.from(new Set(
    allMembers
      .map((m: any) => m.category)
      .filter((cat: any) => cat && cat.trim() !== '')
  )).sort();

  // Filter members based on selected category
  const filteredMembers = selectedCategory === "all" 
    ? allMembers 
    : allMembers.filter((m: any) => m.category === selectedCategory);

  // Calculate basic stats
  const totalMembers = filteredMembers.length;
  const activeMembers = filteredMembers.filter((m: any) => m.is_active === true || m.isactive === true || m.active === true).length;
  const activePercentage = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0;

  // Process chart data based on selected views
  const getChartDataForView = (viewType: string) => {
    const data: Array<{name: string, count: number}> = [];
    
    if (viewType === 'membership-level') {
      // Member Level distribution
      const categoryMap = new Map();
      filteredMembers.forEach((member: any) => {
        const category = member.category || 'Unknown';
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      });
      categoryMap.forEach((count, category) => {
        data.push({ name: category, count });
      });
      
    } else if (viewType === 'gender') {
      // Gender distribution
      const genderMap = new Map();
      filteredMembers.forEach((member: any) => {
        const gender = member.gender || 'Not Specified';
        genderMap.set(gender, (genderMap.get(gender) || 0) + 1);
      });
      genderMap.forEach((count, gender) => {
        data.push({ name: gender, count });
      });
      
    } else if (viewType === 'lgbtq2') {
      // LGBTQ2+ status distribution
      const lgbtqMap = new Map();
      filteredMembers.forEach((member: any) => {
        const lgbtq = member.lgbtqStatus || member.lgbtq_status || 'Not Specified';
        lgbtqMap.set(lgbtq, (lgbtqMap.get(lgbtq) || 0) + 1);
      });
      lgbtqMap.forEach((count, status) => {
        data.push({ name: status, count });
      });
      
    } else if (viewType === 'bipoc') {
      // BIPOC status distribution
      const bipocMap = new Map();
      filteredMembers.forEach((member: any) => {
        const bipoc = member.bipocStatus || member.bipoc_status || 'Not Specified';
        bipocMap.set(bipoc, (bipocMap.get(bipoc) || 0) + 1);
      });
      bipocMap.forEach((count, status) => {
        data.push({ name: status, count });
      });
      
    } else if (viewType === 'black') {
      // Black (African, Afro-Caribbean, African-Canadian) status
      const blackMap = new Map();
      filteredMembers.forEach((member: any) => {
        const black = member.blackStatus || member.black_status || 'Not Specified';
        blackMap.set(black, (blackMap.get(black) || 0) + 1);
      });
      blackMap.forEach((count, status) => {
        data.push({ name: status, count });
      });
      
    } else if (viewType === 'east-asian') {
      // East Asian status
      const eastAsianMap = new Map();
      filteredMembers.forEach((member: any) => {
        const eastAsian = member.eastAsianStatus || member.east_asian_status || 'Not Specified';
        eastAsianMap.set(eastAsian, (eastAsianMap.get(eastAsian) || 0) + 1);
      });
      eastAsianMap.forEach((count, status) => {
        data.push({ name: status, count });
      });
      
    } else if (viewType === 'indigenous') {
      // Indigenous status
      const indigenousMap = new Map();
      filteredMembers.forEach((member: any) => {
        const indigenous = member.indigenousStatus || member.indigenous_status || 'Not Specified';
        indigenousMap.set(indigenous, (indigenousMap.get(indigenous) || 0) + 1);
      });
      indigenousMap.forEach((count, status) => {
        data.push({ name: status, count });
      });
      
    } else if (viewType === 'latino') {
      // Latino/Latina/Latinx status
      const latinoMap = new Map();
      filteredMembers.forEach((member: any) => {
        const latino = member.latinoStatus || member.latino_status || 'Not Specified';
        latinoMap.set(latino, (latinoMap.get(latino) || 0) + 1);
      });
      latinoMap.forEach((count, status) => {
        data.push({ name: status, count });
      });
      
    } else if (viewType === 'south-asian') {
      // South Asian status
      const southAsianMap = new Map();
      filteredMembers.forEach((member: any) => {
        const southAsian = member.southAsianStatus || member.south_asian_status || 'Not Specified';
        southAsianMap.set(southAsian, (southAsianMap.get(southAsian) || 0) + 1);
      });
      southAsianMap.forEach((count, status) => {
        data.push({ name: status, count });
      });
      
    } else if (viewType === 'southeast-asian') {
      // Southeast Asian status
      const southeastAsianMap = new Map();
      filteredMembers.forEach((member: any) => {
        const southeastAsian = member.southeastAsianStatus || member.southeast_asian_status || 'Not Specified';
        southeastAsianMap.set(southeastAsian, (southeastAsianMap.get(southeastAsian) || 0) + 1);
      });
      southeastAsianMap.forEach((count, status) => {
        data.push({ name: status, count });
      });
      
    } else if (viewType === 'west-asian-arab') {
      // West Asian/Arab status
      const westAsianMap = new Map();
      filteredMembers.forEach((member: any) => {
        const westAsian = member.westAsianArabStatus || member.west_asian_arab_status || 'Not Specified';
        westAsianMap.set(westAsian, (westAsianMap.get(westAsian) || 0) + 1);
      });
      westAsianMap.forEach((count, status) => {
        data.push({ name: status, count });
      });
      
    } else if (viewType === 'white') {
      // White (European) status
      const whiteMap = new Map();
      filteredMembers.forEach((member: any) => {
        const white = member.whiteStatus || member.white_status || 'Not Specified';
        whiteMap.set(white, (whiteMap.get(white) || 0) + 1);
      });
      whiteMap.forEach((count, status) => {
        data.push({ name: status, count });
      });
      
    } else if (viewType === 'provinces-territories') {
      // Canadian provinces and territories distribution
      const provinceMap = new Map();
      filteredMembers.forEach((member: any) => {
        const province = member.provinceTerritory || member.province_territory || member.province || 'Not Specified';
        provinceMap.set(province, (provinceMap.get(province) || 0) + 1);
      });
      provinceMap.forEach((count, province) => {
        data.push({ name: province, count });
      });
      
    } else if (viewType === 'international') {
      // International locations (non-Canadian)
      const provinces = ['Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan', 'Nova Scotia', 'New Brunswick', 'Newfoundland and Labrador', 'Prince Edward Island', 'Northwest Territories', 'Nunavut', 'Yukon'];
      const internationalMap = new Map();
      filteredMembers.forEach((member: any) => {
        const location = member.location || member.city || '';
        const province = member.provinceTerritory || member.province_territory || member.province || '';
        const isCanadian = provinces.includes(province) || location.includes('Canada');
        if (!isCanadian && location.length > 0 && !provinces.includes(location)) {
          internationalMap.set(location, (internationalMap.get(location) || 0) + 1);
        }
      });
      internationalMap.forEach((count, location) => {
        data.push({ name: location, count });
      });
      
    } else if (viewType === 'languages') {
      // Languages spoken distribution
      const languageMap = new Map();
      filteredMembers.forEach((member: any) => {
        const languages = member.languagesSpoken || member.languages_spoken || [];
        if (Array.isArray(languages)) {
          languages.forEach((lang: string) => {
            if (lang && lang.trim()) {
              languageMap.set(lang, (languageMap.get(lang) || 0) + 1);
            }
          });
        }
      });
      languageMap.forEach((count, language) => {
        data.push({ name: language, count });
      });
    }
    
    return data.sort((a, b) => b.count - a.count);
  };

  // Get chart data for the primary view (first selected view)
  const primaryChartData = selectedViews.length > 0 ? getChartDataForView(selectedViews[0]) : [];

  const getChartTitle = (viewType: string) => {
    switch (viewType) {
      case 'membership-level': return '1. Member Level';
      case 'gender': return '2. Gender';
      case 'lgbtq2': return '3. LGBTQ2+';
      case 'bipoc': return '4. BIPOC';
      case 'black': return '5. Black (African, Afro-Caribbean, African-Canadian)';
      case 'east-asian': return '6. East Asian (China, South Korea, Japan, Taiwan)';
      case 'indigenous': return '7. Indigenous (First Nations, Métis, Inuk/Inuit)';
      case 'latino': return '8. Latino/Latina/Latinx (Mexican, Central/South American)';
      case 'south-asian': return '9. South Asian (Indian, Pakistani, Nepali, Bangladeshi, Sri Lankan, Indo Caribbean)';
      case 'southeast-asian': return '10. Southeast Asian (Filipino, Thai, Laos, Vietnam)';
      case 'west-asian-arab': return '11. West Asian/Arab (Arab, Afghan, Egyptian, Iranian, Lebanese, Turkish, Kurdish)';
      case 'white': return '12. White (European)';
      case 'provinces-territories': return 'Canadian Provinces & Territories';
      case 'international': return 'International Locations';
      case 'languages': return 'Languages Spoken';
      default: return 'Member Distribution';
    }
  };

  const addDemographicView = (viewType: string) => {
    if (!selectedViews.includes(viewType)) {
      setSelectedViews([...selectedViews, viewType]);
    }
  };

  const removeDemographicView = (viewType: string) => {
    setSelectedViews(selectedViews.filter(v => v !== viewType));
  };

  const availableViews = [
    { id: 'membership-level', label: '1. Member Level' },
    { id: 'gender', label: '2. Gender' },
    { id: 'lgbtq2', label: '3. LGBTQ2+' },
    { id: 'bipoc', label: '4. BIPOC' },
    { id: 'black', label: '5. Black (African, Afro-Caribbean, African-Canadian)' },
    { id: 'east-asian', label: '6. East Asian (China, South Korea, Japan, Taiwan)' },
    { id: 'indigenous', label: '7. Indigenous (First Nations, Métis, Inuk/Inuit)' },
    { id: 'latino', label: '8. Latino/Latina/Latinx (Mexican, Central/South American)' },
    { id: 'south-asian', label: '9. South Asian (Indian, Pakistani, Nepali, Bangladeshi, Sri Lankan, Indo Caribbean)' },
    { id: 'southeast-asian', label: '10. Southeast Asian (Filipino, Thai, Laos, Vietnam)' },
    { id: 'west-asian-arab', label: '11. West Asian/Arab (Arab, Afghan, Egyptian, Iranian, Lebanese, Turkish, Kurdish)' },
    { id: 'white', label: '12. White (European)' },
    { id: 'provinces-territories', label: 'Canadian Provinces & Territories' },
    { id: 'international', label: 'International Locations' },
    { id: 'languages', label: 'Languages Spoken' }
  ];

  const getProvinceDisplayName = (code: string) => {
    const map: {[key: string]: string} = {
      'ON': 'Ontario', 'BC': 'B.C.', 'QC': 'Quebec', 'AB': 'Alberta',
      'MB': 'Manitoba', 'SK': 'Sask.', 'NS': 'N.S.', 'NB': 'N.B.',
      'NL': 'N.L.', 'PE': 'P.E.I.', 'NT': 'N.W.T.', 'NU': 'Nunavut', 'YT': 'Yukon'
    };
    return map[code] || code;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Member Statistics</h1>
        <p className="text-muted-foreground font-medium mt-2">
          Comprehensive overview of membership data and analytics
        </p>
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Category Filter</label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories ({allMembers.length} members)</SelectItem>
              {allCategories.map((category: unknown) => {
                const categoryStr = category as string;
                const count = allMembers.filter((m: any) => m.category === categoryStr).length;
                return (
                  <SelectItem key={categoryStr} value={categoryStr}>
                    {categoryStr} ({count} members)
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Demographic Views</label>
          <div className="space-y-3">
            {/* Selected Views */}
            <div className="flex flex-wrap gap-2">
              {selectedViews.map((view) => (
                <Badge key={view} variant="default" className="flex items-center gap-2">
                  {getChartTitle(view)}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={() => removeDemographicView(view)}
                  />
                </Badge>
              ))}
            </div>
            
            {/* Add New View */}
            <Select value="" onValueChange={addDemographicView}>
              <SelectTrigger>
                <SelectValue placeholder="Add demographic view" />
              </SelectTrigger>
              <SelectContent>
                {availableViews
                  .filter(view => !selectedViews.includes(view.id))
                  .map((view) => (
                    <SelectItem key={view.id} value={view.id}>
                      {view.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Total Members</CardTitle>
            <CardDescription>
              {selectedCategory === 'all' ? 'All registered members' : `${selectedCategory} members`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Users className="h-6 w-6 mr-2 text-primary" />
              <span className="text-3xl font-bold">{totalMembers}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Active Members</CardTitle>
            <CardDescription>Currently active members</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Check className="h-6 w-6 mr-2 text-green-500" />
                  <span className="text-3xl font-bold">{activeMembers}</span>
                </div>
                <span className="text-xl font-semibold">{activePercentage}%</span>
              </div>
              <Progress value={activePercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Categories</CardTitle>
            <CardDescription>Unique member categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Info className="h-6 w-6 mr-2 text-blue-500" />
              <span className="text-3xl font-bold">{allCategories.length}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Selected Views</CardTitle>
            <CardDescription>{selectedViews.length} demographic view{selectedViews.length !== 1 ? 's' : ''} selected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Globe className="h-6 w-6 mr-2 text-purple-500" />
              <span className="text-3xl font-bold">{selectedViews.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts - Multiple Views */}
      <div className="space-y-8 mt-8">
        {selectedViews.length > 0 ? selectedViews.map((viewType, index) => {
          const viewChartData = getChartDataForView(viewType);
          
          const viewPieData = (() => {
            const TOP_ITEMS = 8;
            const topItems = viewChartData.slice(0, TOP_ITEMS);
            
            if (viewChartData.length > TOP_ITEMS) {
              const otherCount = viewChartData.slice(TOP_ITEMS).reduce((sum, item) => sum + item.count, 0);
              return [...topItems, { name: "Other", count: otherCount }];
            }
            
            return topItems;
          })();

          return (
            <div key={viewType} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>{getChartTitle(viewType)}</CardTitle>
                  <CardDescription>
                    {selectedCategory === 'all' ? 'All members' : `${selectedCategory} members only`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  {viewPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={viewPieData}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={120}
                          innerRadius={40}
                          paddingAngle={2}
                          label={({percent}) => 
                            percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                          }
                          labelLine={false}
                        >
                          {viewPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                  <Tooltip 
                    formatter={(value) => [`${value} members`, 'Count']}
                    contentStyle={{ 
                      background: 'rgba(255, 255, 255, 0.95)', 
                      border: 'none', 
                      borderRadius: '4px', 
                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)' 
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No data available for current selection</p>
              </div>
            )}
          </CardContent>
        </Card>
        
              {/* Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>{getChartTitle(viewType)} Breakdown</CardTitle>
                  <CardDescription>Detailed distribution</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  {viewChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={viewChartData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                      >
                        <XAxis type="number" />
                        <YAxis 
                          type="category" 
                          dataKey="name"
                          width={75}
                          tick={{ fontSize: 11 }}
                          tickFormatter={(value: string) => {
                            if (viewType === 'canadian-provinces') {
                              return getProvinceDisplayName(value);
                            }
                            return value.length > 12 ? value.substring(0, 12) + '...' : value;
                          }}
                        />
                        <Tooltip 
                          formatter={(value) => [`${value} members`, 'Count']}
                          contentStyle={{ 
                            background: 'rgba(255, 255, 255, 0.95)', 
                            border: 'none', 
                            borderRadius: '4px', 
                            boxShadow: '0 1px 3px rgba(0,0,0,0.12)' 
                          }}
                        />
                        <Bar 
                          dataKey="count" 
                          fill="#4f46e5"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">No data available for current selection</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        }) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Select demographic views to see charts and statistics</p>
          </div>
        )}
      </div>

      {/* Data Summary Table */}
      {selectedViews.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{getChartTitle(selectedViews[0])} Summary</CardTitle>
            <CardDescription>Complete breakdown of current selection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {primaryChartData.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                  <span className="text-sm font-medium truncate mr-2">
                    {selectedViews[0] === 'canadian-provinces' ? getProvinceDisplayName(item.name) : item.name}
                  </span>
                  <span className="text-sm font-semibold text-primary">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}