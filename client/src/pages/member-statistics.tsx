import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Award, Globe2, BarChart3 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// Enhanced color palette with contrasting colors
const CATEGORY_COLORS: { [key: string]: string } = {
  'Full': '#2563eb',          // Blue
  'Associate': '#7c3aed',     // Purple  
  'Companion': '#db2777',     // Pink
  'Student': '#ea580c',       // Orange
  'Honorary': '#84cc16',      // Lime
  'Staff': '#06b6d4',         // Cyan
  'Affiliate': '#eab308',     // Yellow
  'LifeFull': '#1e40af',      // Dark Blue
  'LifeAssociate': '#6d28d9', // Dark Purple
  'LifeCompanion': '#be185d', // Dark Pink
  'LifeAffiliate': '#ca8a04'  // Dark Yellow
};

const GENDER_COLORS: { [key: string]: string } = {
  'Male': '#3b82f6',
  'Female': '#ec4899',
  'Non-binary': '#8b5cf6',
  'Prefer not to say': '#94a3b8',
  'Not Specified': '#cbd5e1'
};

const STATUS_COLORS = {
  'Yes': '#22c55e',
  'No': '#ef4444',
  'Prefer not to say': '#f59e0b',
  'Not Specified': '#94a3b8'
};

const PROVINCE_COLORS: { [key: string]: string } = {
  'ON': '#2563eb',
  'BC': '#7c3aed',
  'QC': '#db2777',
  'AB': '#ea580c',
  'MB': '#84cc16',
  'SK': '#06b6d4',
  'NS': '#eab308',
  'NB': '#f97316',
  'NL': '#14b8a6',
  'PE': '#a855f7',
  'NT': '#06b6d4',
  'NU': '#8b5cf6',
  'YT': '#f59e0b'
};

export default function MemberStatisticsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDemographics, setSelectedDemographics] = useState<string[]>(["membership", "gender"]);
  
  // Comparison state - now supports multiple groups
  const [selectedComparisonGroups, setSelectedComparisonGroups] = useState<string[]>([]);
  const [comparisonType, setComparisonType] = useState<string>("gender"); // gender, ethnicity, category, etc.
  const [genderFilter, setGenderFilter] = useState<string>("all"); // Filter comparison by gender
  
  const { data: membersData, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/members/statistics"],
    retry: 2,
    staleTime: 0,
    refetchOnMount: true,
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
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12 flex-col space-y-4">
          <div className="text-lg text-red-500">Failed to load statistics.</div>
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

  // Filter members
  const filteredMembers = selectedCategory === "all" 
    ? allMembers 
    : allMembers.filter((m: any) => m.category === selectedCategory);

  const totalMembers = filteredMembers.length;

  // Calculate category distribution
  type DistributionItem = { name: string; count: number; percentage: string };
  
  const categoryMap = new Map<string, number>();
  allCategories.forEach((cat) => {
    const count = filteredMembers.filter((m: any) => m.category === cat).length;
    if (count > 0) categoryMap.set(cat as string, count);
  });
  
  const categoryDistribution: DistributionItem[] = Array.from(categoryMap.entries())
    .map(([name, count]): DistributionItem => ({
      name,
      count,
      percentage: ((count / totalMembers) * 100).toFixed(1)
    }))
    .sort((a: DistributionItem, b: DistributionItem) => b.count - a.count);

  // Gender distribution
  const genderMap = new Map<string, number>();
  filteredMembers.forEach((m: any) => {
    const gender = m.gender || 'Not Specified';
    genderMap.set(gender, (genderMap.get(gender) || 0) + 1);
  });
  
  const genderDistribution: DistributionItem[] = Array.from(genderMap.entries())
    .map(([name, count]): DistributionItem => ({
      name,
      count,
      percentage: ((count / totalMembers) * 100).toFixed(1)
    }))
    .sort((a: DistributionItem, b: DistributionItem) => b.count - a.count);

  // BIPOC distribution
  const bipocMap = new Map<string, number>();
  filteredMembers.forEach((m: any) => {
    const status = m.bipocStatus || m.bipoc_status || 'Not Specified';
    bipocMap.set(status, (bipocMap.get(status) || 0) + 1);
  });
  
  const bipocDistribution: DistributionItem[] = Array.from(bipocMap.entries())
    .map(([name, count]): DistributionItem => ({
      name,
      count,
      percentage: ((count / totalMembers) * 100).toFixed(1)
    }))
    .sort((a: DistributionItem, b: DistributionItem) => b.count - a.count);

  // LGBTQ2+ distribution
  const lgbtqMap = new Map<string, number>();
  filteredMembers.forEach((m: any) => {
    const status = m.lgbtqStatus || m.lgbtq_status || 'Not Specified';
    lgbtqMap.set(status, (lgbtqMap.get(status) || 0) + 1);
  });
  
  const lgbtqDistribution: DistributionItem[] = Array.from(lgbtqMap.entries())
    .map(([name, count]): DistributionItem => ({
      name,
      count,
      percentage: ((count / totalMembers) * 100).toFixed(1)
    }))
    .sort((a: DistributionItem, b: DistributionItem) => b.count - a.count);

  // Province distribution
  const provinceMap = new Map<string, number>();
  filteredMembers.forEach((m: any) => {
    const province = m.provinceTerritory || m.province_territory || 'Not Specified';
    if (province && province !== 'Not Specified') {
      provinceMap.set(province, (provinceMap.get(province) || 0) + 1);
    }
  });
  
  const provinceDistribution: DistributionItem[] = Array.from(provinceMap.entries())
    .map(([name, count]): DistributionItem => ({
      name,
      count,
      percentage: ((count / totalMembers) * 100).toFixed(1)
    }))
    .sort((a: DistributionItem, b: DistributionItem) => b.count - a.count);

  // Ethnic distribution from ethnic_background field
  const ethnicMap = new Map<string, number>();
  filteredMembers.forEach((m: any) => {
    const ethnicity = m.ethnicBackground || m.ethnic_background || '';
    if (ethnicity && ethnicity !== '' && ethnicity !== '-') {
      // Clean up the ethnicity label for display
      let cleanLabel = ethnicity;
      
      // Map long descriptions to shorter labels
      if (ethnicity.includes('White')) {
        cleanLabel = 'White (European descent)';
      } else if (ethnicity.includes('East Asian')) {
        cleanLabel = 'East Asian';
      } else if (ethnicity.includes('Southeast Asian')) {
        cleanLabel = 'Southeast Asian';
      } else if (ethnicity.includes('South Asian')) {
        cleanLabel = 'South Asian';
      } else if (ethnicity.includes('Black')) {
        cleanLabel = 'Black (African, Afro-Caribbean)';
      } else if (ethnicity.includes('Latino') || ethnicity.includes('Latina') || ethnicity.includes('Latinx')) {
        cleanLabel = 'Latino/Latina/Latinx';
      } else if (ethnicity.includes('West Asian') || ethnicity.includes('Arab')) {
        cleanLabel = 'West Asian/Arab';
      } else if (ethnicity.includes('Indigenous')) {
        cleanLabel = 'Indigenous';
      }
      
      ethnicMap.set(cleanLabel, (ethnicMap.get(cleanLabel) || 0) + 1);
    }
  });
  
  const ethnicDistribution: DistributionItem[] = Array.from(ethnicMap.entries())
    .map(([name, count]): DistributionItem => ({
      name,
      count,
      percentage: ((count / totalMembers) * 100).toFixed(1)
    }))
    .sort((a: DistributionItem, b: DistributionItem) => b.count - a.count);

  const getColorForCategory = (name: string, type: 'category' | 'gender' | 'status' | 'province') => {
    if (type === 'category') return CATEGORY_COLORS[name] || '#64748b';
    if (type === 'gender') return GENDER_COLORS[name] || '#94a3b8';
    if (type === 'status') return STATUS_COLORS[name as keyof typeof STATUS_COLORS] || '#94a3b8';
    if (type === 'province') return PROVINCE_COLORS[name] || '#64748b';
    return '#64748b';
  };

  const getProvinceDisplayName = (code: string) => {
    const map: {[key: string]: string} = {
      'ON': 'Ontario', 'BC': 'British Columbia', 'QC': 'Quebec', 'AB': 'Alberta',
      'MB': 'Manitoba', 'SK': 'Saskatchewan', 'NS': 'Nova Scotia', 'NB': 'New Brunswick',
      'NL': 'Newfoundland & Labrador', 'PE': 'Prince Edward Island', 
      'NT': 'Northwest Territories', 'NU': 'Nunavut', 'YT': 'Yukon'
    };
    return map[code] || code;
  };

  // Get comparison options based on type
  const getComparisonOptions = (type: string) => {
    switch(type) {
      case 'gender':
        return genderDistribution.map(d => d.name).filter(n => n);
      case 'ethnicity':
        return ethnicDistribution.map(d => d.name).filter(n => n);
      case 'category':
        return categoryDistribution.map(d => d.name).filter(n => n);
      case 'bipoc':
        return bipocDistribution.map(d => d.name).filter(n => n);
      case 'lgbtq':
        return lgbtqDistribution.map(d => d.name).filter(n => n);
      default:
        return [];
    }
  };

  // Toggle group selection
  const toggleGroupSelection = (group: string) => {
    setSelectedComparisonGroups(prev => 
      prev.includes(group) 
        ? prev.filter(g => g !== group)
        : [...prev, group]
    );
  };

  // Select all groups
  const selectAllGroups = () => {
    const allOptions = getComparisonOptions(comparisonType);
    setSelectedComparisonGroups(allOptions);
  };

  // Clear all selections
  const clearAllGroups = () => {
    setSelectedComparisonGroups([]);
  };

  // Get unique genders for filter
  const availableGenders: string[] = Array.from(new Set(
    allMembers.map((m: any) => m.gender || 'Not Specified').filter((g: string) => g)
  )).sort();

  // Get members for a specific comparison group (with optional gender filter)
  const getMembersForComparison = (type: string, value: string) => {
    if (!value) return [];
    
    // First apply gender filter if set
    const genderFilteredMembers = genderFilter === 'all' 
      ? filteredMembers 
      : filteredMembers.filter((m: any) => (m.gender || 'Not Specified') === genderFilter);
    
    switch(type) {
      case 'gender':
        return genderFilteredMembers.filter((m: any) => (m.gender || '').trim() === value);
      case 'ethnicity':
        return genderFilteredMembers.filter((m: any) => {
          const ethnicity = m.ethnicBackground || m.ethnic_background || '';
          if (value === 'White (European descent)') return ethnicity.includes('White');
          if (value === 'East Asian') return ethnicity.includes('East Asian');
          if (value === 'Southeast Asian') return ethnicity.includes('Southeast Asian');
          if (value === 'South Asian') return ethnicity.includes('South Asian');
          if (value === 'Black (African, Afro-Caribbean)') return ethnicity.includes('Black');
          if (value === 'Latino/Latina/Latinx') return ethnicity.includes('Latino') || ethnicity.includes('Latina') || ethnicity.includes('Latinx');
          if (value === 'West Asian/Arab') return ethnicity.includes('West Asian') || ethnicity.includes('Arab');
          if (value === 'Indigenous') return ethnicity.includes('Indigenous');
          return false;
        });
      case 'category':
        return genderFilteredMembers.filter((m: any) => m.category === value);
      case 'bipoc':
        return genderFilteredMembers.filter((m: any) => (m.bipocStatus || m.bipoc_status || '').trim() === value);
      case 'lgbtq':
        return genderFilteredMembers.filter((m: any) => (m.lgbtqStatus || m.lgbtq_status || '').trim() === value);
      default:
        return [];
    }
  };

  // Get province distribution for a group
  const getProvinceDistribution = (members: any[]) => {
    const provinceMap = new Map<string, number>();
    members.forEach((m: any) => {
      const province = m.provinceTerritory || m.province_territory || 'Unknown';
      provinceMap.set(province, (provinceMap.get(province) || 0) + 1);
    });
    return Array.from(provinceMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  // Generate colors for comparison groups
  const comparisonColors = [
    '#06b6d4', // cyan
    '#a855f7', // purple
    '#22c55e', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#3b82f6', // blue
    '#ec4899', // pink
    '#8b5cf6', // violet
    '#14b8a6', // teal
    '#f97316', // orange
  ];

  // Calculate comparison data for all selected groups
  const comparisonData = selectedComparisonGroups.map((group, index) => ({
    name: group,
    members: getMembersForComparison(comparisonType, group),
    provinces: getProvinceDistribution(getMembersForComparison(comparisonType, group)),
    color: comparisonColors[index % comparisonColors.length]
  }));

  // Get all unique provinces from all selected groups
  const allComparisonProvinces = Array.from(new Set(
    comparisonData.flatMap(group => group.provinces.map(p => p.name))
  ));

  // Create chart data with all groups
  const comparisonChartData = allComparisonProvinces.map(province => {
    const dataPoint: any = { province };
    comparisonData.forEach(group => {
      dataPoint[group.name] = group.provinces.find(p => p.name === province)?.count || 0;
    });
    return dataPoint;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Member Statistics & Analytics
        </h1>
        <p className="text-muted-foreground font-medium mt-2">
          Comprehensive visual overview of membership distribution and demographics
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-2 border-blue-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filter by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full">
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
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Select Demographics to Compare</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'membership', label: 'Membership Levels', color: 'bg-blue-500' },
                  { id: 'gender', label: 'Gender', color: 'bg-purple-500' },
                  { id: 'bipoc', label: 'BIPOC', color: 'bg-pink-500' },
                  { id: 'lgbtq', label: 'LGBTQ2+', color: 'bg-indigo-500' },
                  { id: 'geography', label: 'Geography', color: 'bg-orange-500' },
                  { id: 'ethnicity', label: 'Ethnicity', color: 'bg-green-500' }
                ].map((demo) => (
                  <button
                    key={demo.id}
                    onClick={() => {
                      if (selectedDemographics.includes(demo.id)) {
                        setSelectedDemographics(selectedDemographics.filter(d => d !== demo.id));
                      } else {
                        setSelectedDemographics([...selectedDemographics, demo.id]);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedDemographics.includes(demo.id)
                        ? `${demo.color} text-white shadow-lg scale-105`
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                    }`}
                    data-testid={`select-demographic-${demo.id}`}
                  >
                    {demo.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Click to select/deselect demographics for comparison ({selectedDemographics.length} selected)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SUMMARY SECTION */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Users className="h-6 w-6 text-blue-600" />
          Member Distribution Summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-600 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{totalMembers}</div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {selectedCategory === "all" ? "All categories" : `${selectedCategory} category`}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-600 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">{categoryDistribution.length}</div>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                Unique membership levels
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-pink-600 bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950 dark:to-pink-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-pink-700 dark:text-pink-300">Locations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-pink-900 dark:text-pink-100">{provinceDistribution.length}</div>
              <p className="text-xs text-pink-600 dark:text-pink-400 mt-1">
                Provinces & territories
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-600 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">Demographics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-900 dark:text-orange-100">{ethnicDistribution.length}</div>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                Ethnic categories tracked
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* DETAILED BREAKDOWN SECTION */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-purple-600" />
          Detailed Member Distribution Breakdown
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Membership Levels Distribution */}
          {selectedDemographics.includes('membership') && (
          <Card className="border-2 border-blue-500/30">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Membership Levels
              </CardTitle>
              <CardDescription className="text-blue-100">
                Distribution by membership category
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {categoryDistribution.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: getColorForCategory(item.name, 'category') }}
                        />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-muted-foreground">{item.count}</span>
                        <span className="text-sm font-bold" style={{ color: getColorForCategory(item.name, 'category') }}>
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                    <Progress 
                      value={parseFloat(item.percentage)} 
                      className="h-3"
                      style={{
                        background: `linear-gradient(to right, ${getColorForCategory(item.name, 'category')} ${item.percentage}%, #e5e7eb ${item.percentage}%)`
                      }}
                    />
                  </div>
                ))}
              </div>
              
              {/* Pie Chart */}
              <div className="mt-6" style={{ height: '500px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryDistribution}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={180}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      labelLine={true}
                    >
                      {categoryDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getColorForCategory(entry.name, 'category')} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ fontSize: '14px', padding: '10px' }}
                      formatter={(value: any) => [`${value} members`, 'Count']}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '14px' }}
                      iconSize={16}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Gender Distribution */}
          {selectedDemographics.includes('gender') && (
          <Card className="border-2 border-purple-500/30">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gender Distribution
              </CardTitle>
              <CardDescription className="text-purple-100">
                Gender identity breakdown
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {genderDistribution.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: getColorForCategory(item.name, 'gender') }}
                        />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-muted-foreground">{item.count}</span>
                        <span className="text-sm font-bold" style={{ color: getColorForCategory(item.name, 'gender') }}>
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                    <Progress 
                      value={parseFloat(item.percentage)} 
                      className="h-3"
                      style={{
                        background: `linear-gradient(to right, ${getColorForCategory(item.name, 'gender')} ${item.percentage}%, #e5e7eb ${item.percentage}%)`
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Pie Chart */}
              <div className="mt-6" style={{ height: '500px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderDistribution}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={180}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      labelLine={true}
                    >
                      {genderDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getColorForCategory(entry.name, 'gender')} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ fontSize: '14px', padding: '10px' }}
                      formatter={(value: any) => [`${value} members`, 'Count']}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '14px' }}
                      iconSize={16}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          )}

          {/* BIPOC Distribution */}
          {selectedDemographics.includes('bipoc') && (
          <Card className="border-2 border-pink-500/30">
            <CardHeader className="bg-gradient-to-r from-pink-500 to-pink-600 text-white">
              <CardTitle>BIPOC Status</CardTitle>
              <CardDescription className="text-pink-100">
                Black, Indigenous, People of Color identification
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {bipocDistribution.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: getColorForCategory(item.name, 'status') }}
                        />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-muted-foreground">{item.count}</span>
                        <span className="text-sm font-bold" style={{ color: getColorForCategory(item.name, 'status') }}>
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                    <Progress 
                      value={parseFloat(item.percentage)} 
                      className="h-3"
                      style={{
                        background: `linear-gradient(to right, ${getColorForCategory(item.name, 'status')} ${item.percentage}%, #e5e7eb ${item.percentage}%)`
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Bar Chart */}
              <div className="mt-6 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bipocDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {bipocDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getColorForCategory(entry.name, 'status')} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          )}

          {/* LGBTQ2+ Distribution */}
          {selectedDemographics.includes('lgbtq') && (
          <Card className="border-2 border-indigo-500/30">
            <CardHeader className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
              <CardTitle>LGBTQ2+ Status</CardTitle>
              <CardDescription className="text-indigo-100">
                LGBTQ2+ identification breakdown
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {lgbtqDistribution.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: getColorForCategory(item.name, 'status') }}
                        />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-muted-foreground">{item.count}</span>
                        <span className="text-sm font-bold" style={{ color: getColorForCategory(item.name, 'status') }}>
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                    <Progress 
                      value={parseFloat(item.percentage)} 
                      className="h-3"
                      style={{
                        background: `linear-gradient(to right, ${getColorForCategory(item.name, 'status')} ${item.percentage}%, #e5e7eb ${item.percentage}%)`
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Bar Chart */}
              <div className="mt-6" style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lgbtqDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ fontSize: '14px', padding: '10px' }}
                      formatter={(value: any) => [`${value} members`, 'Count']}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {lgbtqDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getColorForCategory(entry.name, 'status')} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Geographic Distribution */}
          {selectedDemographics.includes('geography') && (
          <Card className="border-2 border-orange-500/30">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Globe2 className="h-5 w-5" />
                Geographic Distribution
              </CardTitle>
              <CardDescription className="text-orange-100">
                Members by province & territory
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {provinceDistribution.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: getColorForCategory(item.name, 'province') }}
                        />
                        <span className="font-medium">{getProvinceDisplayName(item.name)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-muted-foreground">{item.count}</span>
                        <span className="text-sm font-bold" style={{ color: getColorForCategory(item.name, 'province') }}>
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                    <Progress 
                      value={parseFloat(item.percentage)} 
                      className="h-3"
                      style={{
                        background: `linear-gradient(to right, ${getColorForCategory(item.name, 'province')} ${item.percentage}%, #e5e7eb ${item.percentage}%)`
                      }}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          )}
        </div>
      </div>

      {/* ETHNIC DISTRIBUTION SECTION */}
      {selectedDemographics.includes('ethnicity') && ethnicDistribution.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Ethnic Distribution Overview</h2>
          <Card className="border-2 border-green-500/30">
            <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 text-white">
              <CardTitle>Detailed Ethnic Categories</CardTitle>
              <CardDescription className="text-green-100">
                Self-identified ethnic background breakdown (members who selected "Yes")
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Bar Chart */}
              <div className="h-96 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ethnicDistribution} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={200} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#22c55e" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Detailed List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ethnicDistribution.map((item, index) => (
                  <div key={index} className="p-4 rounded-lg border-2 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-green-900 dark:text-green-100">{item.name}</span>
                      <span className="text-2xl font-bold text-green-600">{item.percentage}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-700 dark:text-green-300">{item.count} members</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Complete Breakdown Table */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Complete Breakdown of Current Selection</h2>
        <Card>
          <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 text-white">
            <CardTitle>Full Statistical Overview</CardTitle>
            <CardDescription className="text-slate-200">
              All metrics for {selectedCategory === "all" ? "all members" : `${selectedCategory} category`}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h3 className="font-bold text-lg text-blue-600 border-b-2 border-blue-600 pb-2">Membership</h3>
                <div className="space-y-2">
                  {categoryDistribution.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-2 rounded bg-slate-50 dark:bg-slate-900">
                      <span className="text-sm">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{item.count}</span>
                        <span className="text-xs text-muted-foreground">({item.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-lg text-purple-600 border-b-2 border-purple-600 pb-2">Gender</h3>
                <div className="space-y-2">
                  {genderDistribution.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-2 rounded bg-slate-50 dark:bg-slate-900">
                      <span className="text-sm">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{item.count}</span>
                        <span className="text-xs text-muted-foreground">({item.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-lg text-pink-600 border-b-2 border-pink-600 pb-2">BIPOC</h3>
                <div className="space-y-2">
                  {bipocDistribution.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-2 rounded bg-slate-50 dark:bg-slate-900">
                      <span className="text-sm">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{item.count}</span>
                        <span className="text-xs text-muted-foreground">({item.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DEMOGRAPHIC COMPARISON SECTION */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-cyan-600" />
          Demographic Comparison & Geographic Analysis
        </h2>
        
        <Card className="border-2 border-cyan-500/30">
          <CardHeader className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white">
            <CardTitle>Compare Multiple Demographics</CardTitle>
            <CardDescription className="text-cyan-100">
              Select one or more groups (or all) to compare their numbers and geographic distribution
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Comparison Type Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Comparison Category</label>
                <Select value={comparisonType} onValueChange={(value) => {
                  setComparisonType(value);
                  setSelectedComparisonGroups([]);
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select comparison type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gender">Gender</SelectItem>
                    <SelectItem value="ethnicity">Ethnicity</SelectItem>
                    <SelectItem value="category">Membership Category</SelectItem>
                    <SelectItem value="bipoc">BIPOC Status</SelectItem>
                    <SelectItem value="lgbtq">LGBTQ2+ Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Filter by Gender (Optional)</label>
                <Select value={genderFilter} onValueChange={setGenderFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All genders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Genders</SelectItem>
                    {availableGenders.map((gender: string) => (
                      <SelectItem key={gender} value={gender}>{gender}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {genderFilter !== 'all' && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  📊 Showing comparison data filtered for: <strong>{genderFilter}</strong> members only
                </p>
              </div>
            )}

            {/* Group Selection with Checkboxes */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium">Select Groups to Compare</label>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={selectAllGroups}
                    data-testid="button-select-all-groups"
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearAllGroups}
                    data-testid="button-clear-all-groups"
                  >
                    Clear All
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900">
                {getComparisonOptions(comparisonType).map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`compare-${option}`}
                      checked={selectedComparisonGroups.includes(option)}
                      onCheckedChange={() => toggleGroupSelection(option)}
                      data-testid={`checkbox-compare-${option.toLowerCase().replace(/\s+/g, '-')}`}
                    />
                    <label
                      htmlFor={`compare-${option}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {option}
                    </label>
                  </div>
                ))}
              </div>
              
              {selectedComparisonGroups.length > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedComparisonGroups.length} group{selectedComparisonGroups.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Comparison Results */}
            {selectedComparisonGroups.length > 0 && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {comparisonData.map((group, index) => (
                    <Card key={group.name} className="border-2" style={{ borderColor: group.color }}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg" style={{ color: group.color }}>{group.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold" style={{ color: group.color }}>{group.members.length}</div>
                        <p className="text-sm text-muted-foreground mt-1">Total members</p>
                        <div className="mt-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Top 3 Provinces:</p>
                          {group.provinces.slice(0, 3).map((p, idx) => (
                            <div key={idx} className="flex justify-between text-sm mb-1">
                              <span>{p.name}</span>
                              <span className="font-bold">{p.count}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Geographic Comparison Bar Chart */}
                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-lg">
                  <h3 className="text-lg font-bold mb-4">Geographic Distribution Comparison</h3>
                  <div style={{ height: '400px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparisonChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="province" />
                        <YAxis />
                        <Tooltip contentStyle={{ fontSize: '14px', padding: '10px' }} />
                        <Legend />
                        {comparisonData.map((group) => (
                          <Bar 
                            key={group.name}
                            dataKey={group.name} 
                            fill={group.color} 
                            name={group.name} 
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Detailed Province Tables */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                  {comparisonData.map((group) => (
                    <div key={group.name} className="space-y-2">
                      <h3 className="font-bold" style={{ color: group.color }}>
                        All Provinces - {group.name}
                      </h3>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Province</TableHead>
                              <TableHead className="text-right">Count</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.provinces.map((p, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{p.name}</TableCell>
                                <TableCell className="text-right font-bold">{p.count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
