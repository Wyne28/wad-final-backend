//src/app/api/auth/logout/route.js

/**
 * Your logout codes goes here
 */

// implement start here
import corsHeaders from "@/lib/cors";
import { errorResponse, successResponse } from "@/lib/utils";

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request) {
  const allowedOrigin =
    process.env.FRONTEND_ORIGIN || "http://localhost:5173";

  const origin = request.headers.get("origin");

  if (origin && origin !== allowedOrigin) {
    return errorResponse("Origin not allowed", 403);
  }

  const response = successResponse(
    { message: "Logout successful" },
    200,
  );

  // Clear the cookie using the same settings as login.
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}