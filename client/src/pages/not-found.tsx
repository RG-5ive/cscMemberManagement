import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertCircle, UserCircle, ShieldCheck } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-4">
      <h1 className="text-3xl font-bold text-primary mb-8">CSC Member Portal</h1>
      
      <Card className="w-full max-w-md mb-6">
        <CardHeader>
          <CardTitle className="text-xl text-center">Welcome to the Member Management System</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            This system provides comprehensive member management capabilities, including user authentication, 
            profile management, messaging, and workshop registration.
          </p>
          <p className="text-gray-600">
            Please use the appropriate login portal based on your role:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="flex flex-col items-center p-4 border rounded-lg">
              <UserCircle className="h-10 w-10 text-blue-500 mb-2" />
              <h3 className="font-medium">Member Login</h3>
              <p className="text-sm text-gray-500 text-center mb-4">
                For committee members and regular users
              </p>
              <Button asChild className="w-full">
                <Link href="/auth">Member Portal</Link>
              </Button>
            </div>
            
            <div className="flex flex-col items-center p-4 border rounded-lg">
              <ShieldCheck className="h-10 w-10 text-green-500 mb-2" />
              <h3 className="font-medium">Admin Login</h3>
              <p className="text-sm text-gray-500 text-center mb-4">
                For administrators and system managers
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/admin-login">Admin Portal</Link>
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center border-t pt-4">
          <p className="text-sm text-gray-500">
            Demo credentials: Check .env file for current admin login
          </p>
        </CardFooter>
      </Card>
      
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
