import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserCircle, LogOut, Menu } from "lucide-react";
import { Logo } from "./logo";

export function Navbar() {
  const { user, logoutMutation } = useAuth();

  return (
    <div className="border-b">
      <div className="container mx-auto px-2 sm:px-4 flex h-20 items-center justify-between">
        <div className="flex items-center min-w-0">
          <div className="mr-3 sm:mr-6 flex-shrink-0">
            <Logo />
          </div>
          <NavigationMenu className="hidden sm:block">
            <NavigationMenuList>
              <NavigationMenuItem>
                <Link href="/">
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                    <span className="hidden lg:inline">Dashboard</span>
                    <span className="lg:hidden">Home</span>
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>

              {user?.role === "admin" && (
                <NavigationMenuItem>
                  <Link href="/admin/committees">
                    <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                      Committees
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
              )}
              
              <NavigationMenuItem>
                <Link href="/workshops">
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                    Workshops
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>

              {user?.role === "admin" && (
                <NavigationMenuItem>
                  <Link href="/surveys">
                    <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                      <span className="hidden lg:inline">Surveys</span>
                      <span className="lg:hidden">Surveys</span>
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
              )}
              
              <NavigationMenuItem>
                <Link href="/profile">
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                    User Profile
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>

              {user?.role === "admin" && (
                <NavigationMenuItem>
                  <Link href="/users">
                    <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                      <span className="hidden lg:inline">Admin Users</span>
                      <span className="lg:hidden">Admins</span>
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
              )}
            </NavigationMenuList>
          </NavigationMenu>
          
          {/* Mobile Menu */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/">Dashboard</Link>
                </DropdownMenuItem>
                {user?.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/committees">Committees</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/workshops">Workshops</Link>
                </DropdownMenuItem>
                {user?.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/surveys">Surveys</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/profile">User Profile</Link>
                </DropdownMenuItem>
                {user?.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/users">Admin Users</Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="text-sm mr-2 hidden lg:block">
            <span className="text-muted-foreground font-medium">Signed in as </span>
            <span className="font-medium">{user?.username}</span>
          </div>
          <Link href="/profile" className="hidden sm:block">
            <Button variant="ghost" size="icon" title="Profile">
              <UserCircle className="h-5 w-5" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              console.log("Logout button clicked");
              logoutMutation.mutate();
            }}
            disabled={logoutMutation.isPending}
            className="flex items-center gap-1 sm:gap-2 text-muted-foreground font-medium hover:text-destructive hover:bg-destructive/10"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">
              {logoutMutation.isPending ? "Signing Out..." : "Sign Out"}
            </span>
            <span className="sm:hidden">
              {logoutMutation.isPending ? "..." : "Exit"}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
