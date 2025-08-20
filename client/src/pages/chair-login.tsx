import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Link } from "wouter";
import { Logo } from "@/components/layout/logo";

// Login validation schema
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function ChairLoginPage() {
  const { user, isLoading, loginMutation } = useAuth();
  const { toast } = useToast();
  const [isBusy, setIsBusy] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      setIsBusy(true);
      
      // Transform data to match what the server expects for chair login
      const loginData = {
        username: data.username, // Send username field directly
        password: data.password
      };
      
      // Use regular login endpoint
      await loginMutation.mutateAsync(loginData);
      
      toast({
        title: "Login successful",
        description: "Welcome back",
      });
    } catch (error) {
      console.error("Login error:", error);
      
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsBusy(false);
    }
  };

  // If already logged in, redirect to appropriate page
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (user) {
    if (user.role === "committee_chair" || user.role === "committee_cochair") {
      return <Redirect to="/committee-admin" />;
    } else if (user.role === "admin") {
      return <Redirect to="/admin" />;
    } else {
      return <Redirect to="/" />;
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation Bar */}
      <div className="w-full bg-primary text-primary-foreground p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <div className="mr-3">
              <Logo />
            </div>
            <div className="text-xl font-bold">
              CSC Chair Portal
            </div>
          </div>
          <div className="flex space-x-3">
            <Button 
              variant="secondary" 
              asChild
              className="px-2 py-1 text-xs h-7"
            >
              <Link href="/auth">Member Login</Link>
            </Button>
            <Button 
              variant="secondary" 
              asChild
              className="px-2 py-1 text-xs h-7"
            >
              <Link href="/chair-login">Chair Login</Link>
            </Button>
            <Button 
              variant="secondary" 
              asChild
              className="px-2 py-1 text-xs h-7"
            >
              <Link href="/admin-login">Admin Login</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6">
          <div className="hidden md:flex flex-col justify-center h-[600px]">
            <div className="flex flex-col items-center mb-8">
              <img
                src="/assets/csc-logo.png"
                alt="CSC Logo"
                className="h-64 mb-4"
              />
              <h1 className="text-4xl font-bold tracking-tight mb-2 text-center min-h-[96px] flex items-center justify-center">
                CSC Committee Chair Portal
              </h1>
            </div>
            <p className="text-muted-foreground text-center min-h-[72px] flex items-center justify-center">
              Access committee management tools, coordinate events, manage member participation, and oversee committee activities.
            </p>
          </div>

          <Card className="w-full h-[600px] flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Committee Chair Login</CardTitle>
              <CardDescription className="min-h-[20px]">
                Enter your credentials to access your committee management portal
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 flex flex-col justify-center">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter your password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isBusy || loginMutation.isPending}
                >
                  {(isBusy || loginMutation.isPending) ? (
                    <>
                      <LoadingSpinner className="mr-2" />
                      Logging in...
                    </>
                  ) : (
                    "Log in"
                  )}
                </Button>
                  </form>
                </Form>
              </div>
            </CardContent>
          <CardFooter className="flex justify-center border-t pt-4">
            <div className="text-sm text-muted-foreground text-center">
              Access for Committee Chairs and Co-chairs only
            </div>
          </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}