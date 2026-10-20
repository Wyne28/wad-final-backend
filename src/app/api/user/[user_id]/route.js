//src/app/api/user/[user_id]/route.js

/**
 * Specific user id endpoints go here
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

export async function GET(request, { params }) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return errorResponse("Authentication required", 401);
    }

    if (!["Teacher", "Student"].includes(user.role)) {
      return errorResponse("Role not permitted", 403);
    }

    const { user_id } = await params;

    if (
      typeof user_id !== "string" ||
      !/^[a-fA-F0-9]{24}$/.test(user_id)
    ) {
      return errorResponse("Invalid user ID", 400);
    }

    if (user._id.toString() !== user_id.toLowerCase()) {
      return errorResponse("You can only view your own profile", 403);
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
    printExceptionLog("Get user profile", error);
    return errorResponse("Internal server error", 500);
  }
}