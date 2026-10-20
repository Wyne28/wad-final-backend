import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "./lib/auth";
import corsHeaders from "./lib/cors";
import {
  X_HEADER_USER_EMAIL,
  X_HEADER_USER_ID,
  X_HEADER_USER_NAME,
} from "./lib/constant";

export async function proxy(request) {
  const user = await getAuthenticatedUser(request);

  // implement the code 
  // allow browser CORS preflight without authentication
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204, 
      headers: corsHeaders, 
    });
  }
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);

  const origin = request.headers.get("origin");
  const allowedOrigins = process.env.FONTEND_ORIGINS || "http://localhost:5173";

  if (isMutation && origin && origin !== allowedOrigins) {
    return NextResponse.json(
      { message: "Origin not allowed" },
      { status: 403, headers: corsHeaders },
    );
  }

  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401, headers: corsHeaders },
      );
    }
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(X_HEADER_USER_ID, user.id);
    requestHeaders.set(X_HEADER_USER_EMAIL, user.email);
    requestHeaders.set(X_HEADER_USER_NAME, user.username);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error("Proxy authentication failed:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: corsHeaders },
    );
  }
}

export const config = {
  matcher: ["/api/course/:path*", "/api/user/:path*"],
};