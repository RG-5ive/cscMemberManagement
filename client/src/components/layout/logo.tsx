import { Link } from "wouter";

export function Logo() {
  return (
    <Link href="/" className="flex-shrink-0">
      <img
        src="/assets/csc-logo.png"
        alt="CSC Logo"
        className="h-10 sm:h-12 lg:h-16 w-auto object-contain"
      />
    </Link>
  );
}