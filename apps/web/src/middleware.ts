import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { isProtected } from "@/lib/protectedRoutes";

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isProtected(req.nextUrl.pathname)) await auth.protect();
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (process.env.NEXT_PUBLIC_DEV_MODE === "true") {
    return NextResponse.next();
  }
  return clerkHandler(req, event);
}

export const config = {
  matcher: [
    // Exclude _next, api/v1 proxy routes, and static file extensions from Clerk middleware.
    // /api/v1/* is handled by the Next.js rewrite proxy — the FastAPI backend validates auth itself.
    "/((?!_next|api/v1|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
