import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
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

export async function POST(request, { params }) {
  const origin = request.headers.get("origin");
  const allowedOrigin =
    process.env.FRONTEND_ORIGIN || "http://localhost:5173";

  if (origin && origin !== allowedOrigin) {
    return errorResponse("Origin not allowed", 403);
  }

  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return errorResponse("Authentication required", 401);
    }

    if (user.role !== "Student") {
      return errorResponse("Only Students can enroll", 403);
    }

    const { course_id } = await params;

    if (
      typeof course_id !== "string" ||
      !/^[a-fA-F0-9]{24}$/.test(course_id)
    ) {
      return errorResponse("Invalid course ID", 400);
    }

    const db = await getDb();
    const courses = db.collection("courses");
    const courseObjectId = new ObjectId(course_id);

    // All enrollment restrictions are checked in one atomic update.
    const result = await courses.updateOne(
      {
        _id: courseObjectId,
        status: "Open",
        studentIds: { $ne: user._id },
        $expr: {
          $lt: [
            { $size: { $ifNull: ["$studentIds", []] } },
            "$maxStudents",
          ],
        },
      },
      {
        $addToSet: { studentIds: user._id },
        $set: { updatedAt: new Date() },
      },
    );

    if (result.modifiedCount === 1) {
      return successResponse(
        { message: "Enrollment successful" },
        200,
      );
    }

    const course = await courses.findOne(
      {
        _id: courseObjectId,
        status: { $ne: "Cancel" },
      },
      { projection: { _id: 1 } },
    );

    if (!course) {
      return errorResponse("Course not found or unavailable", 404);
    }

    return errorResponse(
      "Cannot enroll: course is not Open, is full, or you are already enrolled",
      409,
    );
  } catch (error) {
    printExceptionLog("Enroll in course", error);
    return errorResponse("Internal server error", 500);
  }
}