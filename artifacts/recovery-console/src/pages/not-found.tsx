import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background text-center p-4">
      <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">404</h1>
      <p className="text-muted-foreground mb-6">The page you are looking for does not exist.</p>
      <Link href="/" className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
        Return to Dashboard
      </Link>
    </div>
  );
}
