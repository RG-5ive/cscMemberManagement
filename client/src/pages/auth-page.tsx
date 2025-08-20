import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, verificationInputSchema, passwordResetSchema, type InsertUser, type VerificationInput, type PasswordReset } from "@shared/schema";
import { Link, Redirect, useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { useState, useEffect } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/layout/logo";

// Define form schemas with proper types
const loginSchema = z.object({
  email: z.string().email("Valid email address is required"),
  password: z.string().min(1, "Password is required")
});

// Define form schema for admin login
const adminLoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});

type LoginFormData = z.infer<typeof loginSchema>;
type AdminLoginFormData = z.infer<typeof adminLoginSchema>;

// Define email verification schema
const verifyEmailSchema = z.object({
  email: z.string().email("Valid email is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});
type VerifyEmailData = z.infer<typeof verifyEmailSchema>;

// Define code verification schema
const verifyCodeSchema = z.object({
  email: z.string().email("Valid email is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  code: z.string().length(7, "Verification code must be 7 digits"),
});
type VerifyCodeData = z.infer<typeof verifyCodeSchema>;

// Define password setup schema
const passwordSetupSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});
type PasswordSetupData = z.infer<typeof passwordSetupSchema>;

export default function AuthPage({ isAdminLogin = false }: { isAdminLogin?: boolean }) {
  const { user, adminLoginMutation, memberLoginMutation, registerMutation } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [showOnboardingCompleteAlert, setShowOnboardingCompleteAlert] = useState(false);
  
  // State for forms and steps
  const [isVerifyEmailStep, setIsVerifyEmailStep] = useState(false);
  const [isVerifyCodeStep, setIsVerifyCodeStep] = useState(false);
  const [isPasswordStep, setIsPasswordStep] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isForgotPasswordEmailStep, setIsForgotPasswordEmailStep] = useState(false);
  const [isForgotPasswordCodeStep, setIsForgotPasswordCodeStep] = useState(false);
  const [isForgotPasswordResetStep, setIsForgotPasswordResetStep] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  
  // Data states
  const [verificationData, setVerificationData] = useState<{
    email: string;
    firstName: string;
    lastName: string;
    token?: string;
    code?: string;
    memberLevel?: string;
  } | null>(null);
  
  const [passwordResetData, setPasswordResetData] = useState<{
    email: string;
    token?: string;
    code?: string;
  } | null>(null);
  
  // Check if the user just completed onboarding
  useEffect(() => {
    const fromOnboarding = localStorage.getItem('onboardingComplete');
    if (fromOnboarding) {
      setShowOnboardingCompleteAlert(true);
      localStorage.removeItem('onboardingComplete'); // Clear the flag
    }
  }, []);
  
  // Redirect if the user is already logged in
  useEffect(() => {
    if (user) {
      console.log("AuthPage: User is authenticated, redirecting to dashboard", user);
      // Determine where to redirect based on role and current page
      const redirectPath = user.role === "admin" ? "/admin" : "/";
      
      // Use setTimeout with 0ms to ensure this happens after render
      setTimeout(() => {
        setLocation(redirectPath);
      }, 0);
    }
  }, [user, setLocation, isAdminLogin]);

  // Initialize the forms
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const adminLoginForm = useForm<AdminLoginFormData>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      username: "",
      password: ""
    }
  });

  const registerForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: ""
    }
  });
  
  const verifyEmailForm = useForm<VerifyEmailData>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: ""
    }
  });
  
  const verifyCodeForm = useForm<VerifyCodeData>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      code: ""
    }
  });

  // Update the form when verificationData changes
  useEffect(() => {
    if (verificationData && isVerifyCodeStep) {
      verifyCodeForm.setValue("code", "");
    }
  }, [verificationData, isVerifyCodeStep, verifyCodeForm]);
  
  const passwordForm = useForm<PasswordReset>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      password: "",
      confirmPassword: ""
    }
  });

  const passwordSetupForm = useForm<PasswordSetupData>({
    resolver: zodResolver(passwordSetupSchema),
    defaultValues: {
      password: "",
      confirmPassword: ""
    }
  });
  
  // Form for the forgot password email step
  const forgotPasswordEmailForm = useForm<{ email: string }>({
    resolver: zodResolver(z.object({
      email: z.string().email("Valid email address is required")
    })),
    defaultValues: {
      email: ""
    }
  });
  
  // Form for the forgot password code verification step
  const forgotPasswordCodeForm = useForm<{ email: string, code: string }>({
    resolver: zodResolver(z.object({
      email: z.string().email("Valid email address is required"),
      code: z.string().length(7, "Verification code must be 7 digits")
    })),
    defaultValues: {
      email: passwordResetData?.email || "",
      code: ""
    }
  });
  
  // Form for the new password step
  const forgotPasswordResetForm = useForm<PasswordReset>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      password: "",
      confirmPassword: ""
    }
  });
  
  // Reset verification steps
  const resetVerificationFlow = () => {
    setIsVerifyEmailStep(false);
    setIsVerifyCodeStep(false);
    setIsPasswordStep(false);
    setVerificationData(null);
  };
  
  // Reset password reset flow
  const resetPasswordResetFlow = () => {
    setIsForgotPasswordEmailStep(false);
    setIsForgotPasswordCodeStep(false);
    setIsForgotPasswordResetStep(false);
    setPasswordResetData(null);
  };
  
  // Handle login/register success
  const handleSuccess = (user: any) => {
    const redirectPath = user.role === "admin" ? "/admin" : "/";
    setLocation(redirectPath);
    toast({
      title: `${user.role === 'admin' ? 'Admin' : 'Member'} Login Successful`,
      description: `Welcome back, ${user.firstName || user.username}!`
    });
  };

  // If user is already authenticated, redirect
  if (user) {
    return <Redirect to="/" />;
  }

  return (
    <div className={`min-h-screen flex flex-col ${isAdminLogin ? 'bg-gray-800' : 'bg-background'}`}>
      {/* Top Navigation Bar */}
      <div className={`w-full p-3 sm:p-4 ${isAdminLogin ? 'bg-gray-900 text-gray-100' : 'bg-primary text-primary-foreground'}`}>
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center min-w-0 flex-1">
            <div className="mr-2 sm:mr-3 flex-shrink-0">
              <Logo />
            </div>
            <div className="text-sm sm:text-lg lg:text-xl font-bold truncate">
              {isAdminLogin ? "CSC Admin Portal" : "CSC Member Portal"}
            </div>
          </div>
          <div className="flex flex-wrap gap-1 sm:gap-2 lg:gap-3">
            <Button 
              variant="secondary" 
              asChild
              className="px-1 py-1 text-xs h-6 sm:px-2 sm:h-7 lg:px-3"
            >
              <Link href="/auth">
                <span className="hidden sm:inline">Member Login</span>
                <span className="sm:hidden">Member</span>
              </Link>
            </Button>
            <Button 
              variant="secondary" 
              asChild
              className="px-1 py-1 text-xs h-6 sm:px-2 sm:h-7 lg:px-3"
            >
              <Link href="/chair-login">
                <span className="hidden sm:inline">Chair Login</span>
                <span className="sm:hidden">Chair</span>
              </Link>
            </Button>
            <Button 
              variant="secondary" 
              asChild
              className="px-1 py-1 text-xs h-6 sm:px-2 sm:h-7 lg:px-3"
            >
              <Link href="/admin-login">
                <span className="hidden sm:inline">Admin Login</span>
                <span className="sm:hidden">Admin</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4 lg:p-6">
        <div className="w-full max-w-7xl grid lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="hidden lg:flex flex-col justify-center min-h-[500px] xl:min-h-[600px]">
            <div className="flex flex-col items-center mb-8">
              <img
                src="/assets/csc-logo.png"
                alt="CSC Logo"
                className="h-32 sm:h-48 xl:h-64 mb-4"
              />
              <h1 className={`text-2xl sm:text-3xl xl:text-4xl font-bold tracking-tight mb-2 text-center min-h-[60px] sm:min-h-[80px] xl:min-h-[96px] flex items-center justify-center ${isAdminLogin ? 'text-gray-100' : ''}`}>
                {isAdminLogin 
                  ? "CSC Administrative Portal" 
                  : "Welcome to CSC Member Portal"
                }
              </h1>
            </div>
            <p className={`text-center text-sm sm:text-base min-h-[48px] sm:min-h-[60px] xl:min-h-[72px] flex items-center justify-center px-4 ${isAdminLogin ? 'text-gray-300' : 'text-muted-foreground'}`}>
              {isAdminLogin 
                ? "Access administrative tools, manage memberships, and handle organizational tasks."
                : "Access exclusive member benefits, connect with fellow members, and stay updated with the latest CSC news and events."
              }
            </p>
          </div>

          <Card className={`w-full min-h-[500px] sm:min-h-[550px] xl:min-h-[600px] flex flex-col ${isAdminLogin ? 'bg-gray-700 border-gray-600' : ''}`}>
            <CardHeader className="pb-4">
              <CardTitle className={`text-xl ${isAdminLogin ? 'text-gray-100' : ''}`}>{isAdminLogin ? "Admin Login" : "Member Login"}</CardTitle>
              <CardDescription className={`min-h-[20px] ${isAdminLogin ? 'text-gray-300' : ''}`}>
                {showOnboardingCompleteAlert ? (
                  <Alert className="mb-2">
                    <AlertTitle>Profile Setup Complete!</AlertTitle>
                    <AlertDescription>
                      You've successfully completed your profile setup. Please log in with your email address and password to continue.
                    </AlertDescription>
                  </Alert>
                ) : (
                  isAdminLogin 
                    ? "Enter your administrator credentials"
                    : "Enter your member credentials"
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {isAdminLogin ? (
                // Admin Login Form
                <div className="flex-1 flex flex-col justify-center">
                  <Form {...adminLoginForm}>
                    <form
                      onSubmit={adminLoginForm.handleSubmit((data) => {
                        console.log("Submitting admin login with:", data);
                        adminLoginMutation.mutate(data, {
                          onSuccess: (user) => {
                            toast({
                              title: "Admin Login Successful",
                              description: `Welcome back, ${user.firstName || user.username}!`
                            });
                            setLocation("/admin");
                          }
                        });
                      })}
                      className="space-y-4"
                    >
                      <FormField
                        control={adminLoginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-200">Admin Username or Email</FormLabel>
                            <FormControl>
                              <Input 
                                id="username"
                                type="text" 
                                autoComplete="username"
                                className="bg-gray-600 border-gray-500 text-gray-100 placeholder-gray-400 focus:border-gray-400"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={adminLoginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-200">Password</FormLabel>
                            <FormControl>
                              <Input 
                                id="password"
                                type="password" 
                                autoComplete="current-password"
                                className="bg-gray-600 border-gray-500 text-gray-100 placeholder-gray-400 focus:border-gray-400"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className="w-full bg-gray-600 hover:bg-gray-500 text-gray-100 border-gray-500"
                        disabled={adminLoginMutation.isPending}
                      >
                        {adminLoginMutation.isPending ? "Logging in..." : "Login as Administrator"}
                      </Button>
                    </form>
                  </Form>
                </div>
              ) : (
                // Member Portal Tabs
                <div className="flex-1 flex flex-col justify-center">
                <Tabs defaultValue="login">
                  <TabsList className="grid w-full grid-cols-2 gap-2 p-1">
                    <TabsTrigger value="login" className="px-6 py-2">Login</TabsTrigger>
                    <TabsTrigger value="register" className="px-6 py-2">Register</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <Form {...loginForm}>
                      <form
                        onSubmit={loginForm.handleSubmit((data: LoginFormData) =>
                          memberLoginMutation.mutate(data, {
                            onSuccess: handleSuccess
                          })
                        )}
                        className="space-y-4"
                      >
                        <FormField
                          control={loginForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input type="email" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={loginForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="w-full"
                          disabled={memberLoginMutation.isPending}
                        >
                          {memberLoginMutation.isPending ? "Logging in..." : "Login"}
                        </Button>
                        
                        <div className="text-center mt-4">
                          <button
                            type="button"
                            onClick={() => {
                              resetPasswordResetFlow();
                              setIsForgotPasswordEmailStep(true);
                            }}
                            className="text-sm text-primary hover:underline"
                          >
                            Forgot your password?
                          </button>
                        </div>
                      </form>
                    </Form>
                  </TabsContent>

                  <TabsContent value="register">
                    {isVerifyCodeStep ? (
                      <div className="space-y-4">
                        <div className="text-center mb-4">
                          <h3 className="text-lg font-medium">Enter Verification Code</h3>
                          <p className="text-sm text-muted-foreground">
                            Please enter the 7-digit verification code sent to:
                          </p>
                          <p className="text-sm font-medium text-primary mt-1">
                            {verificationData?.email}
                          </p>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                              Verification Code
                            </label>
                            <Input 
                              placeholder="Enter 7-digit code" 
                              maxLength={7}
                              autoFocus
                              type="text"
                              autoComplete="off"
                              value={verifyCodeForm.watch("code")}
                              onChange={(e) => verifyCodeForm.setValue("code", e.target.value)}
                              className="mt-2"
                            />
                          </div>
                          
                          <Button 
                            onClick={async () => {
                              if (!verificationData) return;
                              
                              const code = verifyCodeForm.getValues("code");
                              if (!code || code.length !== 7) {
                                toast({
                                  title: "Invalid Code",
                                  description: "Please enter a 7-digit verification code.",
                                  variant: "destructive"
                                });
                                return;
                              }
                              
                              setIsVerifying(true);
                              try {
                                const response = await apiRequest("POST", "/api/verify/code", {
                                  email: verificationData.email,
                                  firstName: verificationData.firstName,
                                  lastName: verificationData.lastName,
                                  code: code
                                });
                                const result = await response.json();
                                
                                if (response.ok) {
                                  setVerificationData({
                                    ...verificationData,
                                    token: result.token,
                                    code: code,
                                    memberLevel: result.memberLevel || verificationData.memberLevel
                                  });
                                  console.log("Updated verification data:", {
                                    ...verificationData,
                                    token: result.token,
                                    code: code,
                                    memberLevel: result.memberLevel || verificationData.memberLevel
                                  });
                                  setIsVerifyCodeStep(false);
                                  setIsPasswordStep(true);
                                  toast({
                                    title: "Code Verified Successfully",
                                    description: "You can now set up your password."
                                  });
                                } else {
                                  throw new Error(result.error || "Code verification failed");
                                }
                              } catch (error) {
                                toast({
                                  title: "Code Verification Failed",
                                  description: error instanceof Error ? error.message : "Please check your code and try again.",
                                  variant: "destructive"
                                });
                              } finally {
                                setIsVerifying(false);
                              }
                            }}
                            className="w-full" 
                            disabled={isVerifying}
                          >
                            {isVerifying ? "Verifying..." : "Verify Code"}
                          </Button>
                          
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsVerifyCodeStep(false);
                              setIsVerifyEmailStep(true);
                            }}
                            className="w-full"
                          >
                            Back to Email Verification
                          </Button>
                        </div>
                      </div>
                    ) : isPasswordStep ? (
                      <div className="space-y-4">
                        <div className="text-center mb-4">
                          <h3 className="text-lg font-medium">Set Up Your Password</h3>
                          <p className="text-sm text-muted-foreground">
                            Create a secure password for your account
                          </p>
                          <p className="text-sm font-medium text-primary mt-1">
                            {verificationData?.email}
                          </p>
                        </div>
                        
                        <Form {...passwordSetupForm}>
                          <form
                            onSubmit={passwordSetupForm.handleSubmit(async (data) => {
                              if (!verificationData) return;
                              
                              setIsVerifying(true);
                              try {
                                console.log("Sending registration data:", {
                                  email: verificationData.email,
                                  firstName: verificationData.firstName,
                                  lastName: verificationData.lastName,
                                  password: data.password,
                                  memberLevel: verificationData.memberLevel,
                                  role: "user"
                                });
                                
                                const response = await apiRequest("POST", "/api/register", {
                                  email: verificationData.email,
                                  firstName: verificationData.firstName,
                                  lastName: verificationData.lastName,
                                  password: data.password,
                                  memberLevel: verificationData.memberLevel,
                                  role: "user"
                                });
                                const result = await response.json();
                                
                                if (response.ok) {
                                  toast({
                                    title: "Registration Successful",
                                    description: "Your account has been created. Please complete your profile."
                                  });
                                  // Redirect to onboarding
                                  setLocation("/onboarding");
                                } else {
                                  throw new Error(result.error || "Registration failed");
                                }
                              } catch (error) {
                                toast({
                                  title: "Registration Failed",
                                  description: error instanceof Error ? error.message : "Please try again.",
                                  variant: "destructive"
                                });
                              } finally {
                                setIsVerifying(false);
                              }
                            })}
                            className="space-y-4"
                          >
                            <FormField
                              control={passwordSetupForm.control}
                              name="password"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Password</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="password" 
                                      placeholder="Enter password"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={passwordSetupForm.control}
                              name="confirmPassword"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Confirm Password</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="password" 
                                      placeholder="Confirm password"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <Button type="submit" className="w-full" disabled={isVerifying}>
                              {isVerifying ? "Creating Account..." : "Create Account"}
                            </Button>
                            
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setIsPasswordStep(false);
                                setIsVerifyCodeStep(true);
                              }}
                              className="w-full"
                            >
                              Back to Verification
                            </Button>
                          </form>
                        </Form>
                      </div>
                    ) : !isVerifyEmailStep ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            resetVerificationFlow();
                            setIsVerifyEmailStep(true);
                          }}
                          className="w-full mb-4"
                        >
                          CSC Member Registration
                        </Button>
                        
                        <p className="text-sm text-muted-foreground mt-2 mb-4">
                          Are you a member of the Canadian Society of Cinematographers? Register here with your membership details.
                        </p>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-center mb-4">
                          <h3 className="text-lg font-medium">Verify Your Membership</h3>
                          <p className="text-sm text-muted-foreground">
                            Enter your details to verify your CSC membership
                          </p>
                        </div>
                        
                        <Form {...verifyEmailForm}>
                          <form
                            onSubmit={verifyEmailForm.handleSubmit(async (data) => {
                              setIsVerifying(true);
                              try {
                                const response = await apiRequest("POST", "/api/verify/member", data);
                                const result = await response.json();
                                
                                if (response.ok) {
                                  setVerificationData({
                                    ...data,
                                    token: result.token,
                                    memberLevel: result.memberLevel
                                  });
                                  setIsVerifyEmailStep(false);
                                  setIsVerifyCodeStep(true);
                                  toast({
                                    title: "Verification Email Sent",
                                    description: "Please check your email for the verification code."
                                  });
                                } else {
                                  throw new Error(result.error || "Verification failed");
                                }
                              } catch (error) {
                                toast({
                                  title: "Verification Failed",
                                  description: error instanceof Error ? error.message : "Please check your details and try again.",
                                  variant: "destructive"
                                });
                              } finally {
                                setIsVerifying(false);
                              }
                            })}
                            className="space-y-4"
                          >
                            <FormField
                              control={verifyEmailForm.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email Address</FormLabel>
                                  <FormControl>
                                    <Input type="email" placeholder="your.email@example.com" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={verifyEmailForm.control}
                              name="firstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>First Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="John" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={verifyEmailForm.control}
                              name="lastName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Last Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Doe" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <Button type="submit" className="w-full" disabled={isVerifying}>
                              {isVerifying ? "Verifying..." : "Verify Membership"}
                            </Button>
                            
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsVerifyEmailStep(false)}
                              className="w-full"
                            >
                              Back
                            </Button>
                          </form>
                        </Form>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}