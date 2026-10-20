//src/app/api/user/route.js

/**
 *User API endpoints go here
 */

 // Implementation start here
import { getAuthenticatedUser } from "@/lib/auth";
import corsHeaders from "@/lib/cors";
import {
  errorResponse,
  successResponse,
  printExceptionLog,
} from "@/lib/utils";

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return errorResponse("Authentication required", 401);
    }

    if (!["Teacher", "Student"].includes(user.role)) {
      return errorResponse("Role not permitted", 403);
    }

    return successResponse(
      {
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
      200,
    );
  } catch (error) {
    printExceptionLog("Get current user", error);
    return errorResponse("Internal server error", 500);
  }
}