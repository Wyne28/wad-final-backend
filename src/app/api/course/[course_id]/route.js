//src/app/api/course/[course_id]/route.js

/**
 * Specific course id API endpoints go here.
 */

// implementation start here
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

function isValidId(id) {
  return typeof id === "string" && /^[a-fA-F0-9]{24}$/.test(id);
}

function isAllowedOrigin(request) {
  const origin = request.headers.get("origin");
  const allowedOrigin =
    process.env.FRONTEND_ORIGIN || "http://localhost:5173";

  return !origin || origin === allowedOrigin;
}

// GET /api/course/:course_id
export async function GET(request, { params }) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return errorResponse("Authentication required", 401);
    }

    if (!["Teacher", "Student"].includes(user.role)) {
      return errorResponse("Role not permitted", 403);
    }

    const { course_id } = await params;

    if (!isValidId(course_id)) {
      return errorResponse("Invalid course ID", 400);
    }

    const db = await getDb();

    const filter = {
      _id: new ObjectId(course_id),
    };

    if (user.role === "Teacher") {
      // Teachers can view only their own courses.
      filter.teacherId = user._id;
    } else {
      // Cancel courses are unavailable to Students.
      filter.status = { $ne: "Cancel" };
    }

    const course = await db.collection("courses").findOne(filter);

    if (!course) {
      return errorResponse("Course not found or unavailable", 404);
    }

    const studentIds = course.studentIds || [];

    const teacher = await db.collection("users").findOne(
      { _id: course.teacherId },
      {
        projection: {
          _id: 1,
          username: 1,
        },
      },
    );

    const courseDetails = { ...course };
    delete courseDetails.studentIds;

    const result = {
      ...courseDetails,
      teacher,
      enrolledCount: studentIds.length,
      remainingSeats: Math.max(
        0,
        course.maxStudents - studentIds.length,
      ),
      isEnrolled: studentIds.some(
        (id) => id.toString() === user._id.toString(),
      ),
    };

    // Only the owning Teacher receives enrolled Student details.
    if (user.role === "Teacher") {
      result.students = await db
        .collection("users")
        .find(
          {
            _id: { $in: studentIds },
            role: "Student",
          },
          {
            projection: {
              _id: 1,
              username: 1,
              email: 1,
            },
          },
        )
        .toArray();
    }

    return successResponse({ course: result }, 200);
  } catch (error) {
    printExceptionLog("Get course details", error);
    return errorResponse("Internal server error", 500);
  }
}

// PATCH /api/course/:course_id
export async function PATCH(request, { params }) {
  if (!isAllowedOrigin(request)) {
    return errorResponse("Origin not allowed", 403);
  }

  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return errorResponse("Authentication required", 401);
    }

    if (user.role !== "Teacher") {
      return errorResponse("Only Teachers can update courses", 403);
    }

    const { course_id } = await params;

    if (!isValidId(course_id)) {
      return errorResponse("Invalid course ID", 400);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length === 0
    ) {
      return errorResponse("Provide at least one course field", 400);
    }

    const allowedFields = new Set([
      "name",
      "durationDays",
      "topics",
      "price",
      "maxStudents",
      "status",
    ]);

    if (Object.keys(body).some((key) => !allowedFields.has(key))) {
      return errorResponse("Unsupported course fields", 400);
    }

    const updates = {};

    if (Object.hasOwn(body, "name")) {
      if (
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.trim().length > 150
      ) {
        return errorResponse(
          "Course name must contain 1 to 150 characters",
          400,
        );
      }

      updates.name = body.name.trim();
    }

    if (Object.hasOwn(body, "durationDays")) {
      if (
        !Number.isSafeInteger(body.durationDays) ||
        body.durationDays < 1
      ) {
        return errorResponse(
          "Duration must be a positive whole number",
          400,
        );
      }

      updates.durationDays = body.durationDays;
    }

    if (Object.hasOwn(body, "topics")) {
      if (
        !Array.isArray(body.topics) ||
        body.topics.length === 0 ||
        body.topics.length > 50 ||
        body.topics.some(
          (topic) =>
            typeof topic !== "string" ||
            !topic.trim() ||
            topic.trim().length > 200,
        )
      ) {
        return errorResponse(
          "Provide 1 to 50 topics, each containing 1 to 200 characters",
          400,
        );
      }

      updates.topics = [
        ...new Set(body.topics.map((topic) => topic.trim())),
      ];
    }

    if (Object.hasOwn(body, "price")) {
      if (
        typeof body.price !== "number" ||
        !Number.isFinite(body.price) ||
        body.price < 0
      ) {
        return errorResponse(
          "Price must be a nonnegative number",
          400,
        );
      }

      updates.price = body.price;
    }

    if (Object.hasOwn(body, "maxStudents")) {
      if (
        !Number.isSafeInteger(body.maxStudents) ||
        body.maxStudents < 1
      ) {
        return errorResponse(
          "Max Student must be a positive whole number",
          400,
        );
      }

      updates.maxStudents = body.maxStudents;
    }

    if (Object.hasOwn(body, "status")) {
      if (!["Open", "Close", "Cancel"].includes(body.status)) {
        return errorResponse(
          "Status must be Open, Close, or Cancel",
          400,
        );
      }

      updates.status = body.status;
    }

    const db = await getDb();
    const courses = db.collection("courses");

    const ownershipFilter = {
      _id: new ObjectId(course_id),
      teacherId: user._id,
    };

    const updateFilter = { ...ownershipFilter };

    // Check capacity atomically with the update.
    if (Object.hasOwn(updates, "maxStudents")) {
      updateFilter.$expr = {
        $lte: [
          { $size: { $ifNull: ["$studentIds", []] } },
          updates.maxStudents,
        ],
      };
    }

    const updatedCourse = await courses.findOneAndUpdate(
      updateFilter,
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      },
      {
        returnDocument: "after",
        includeResultMetadata: false,
        projection: { studentIds: 0 },
      },
    );

    if (!updatedCourse) {
      const ownCourse = await courses.findOne(
        ownershipFilter,
        { projection: { _id: 1 } },
      );

      if (!ownCourse) {
        return errorResponse(
          "Course not found or not owned by you",
          404,
        );
      }

      return errorResponse(
        "Max Student cannot be lower than the enrolled Student count",
        409,
      );
    }

    return successResponse(
      {
        message: "Course updated successfully",
        course: updatedCourse,
      },
      200,
    );
  } catch (error) {
    printExceptionLog("Update course", error);
    return errorResponse("Internal server error", 500);
  }
}

// DELETE /api/course/:course_id
export async function DELETE(request, { params }) {
  if (!isAllowedOrigin(request)) {
    return errorResponse("Origin not allowed", 403);
  }

  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return errorResponse("Authentication required", 401);
    }

    if (user.role !== "Teacher") {
      return errorResponse("Only Teachers can delete courses", 403);
    }

    const { course_id } = await params;

    if (!isValidId(course_id)) {
      return errorResponse("Invalid course ID", 400);
    }

    const db = await getDb();
    const courses = db.collection("courses");

    const ownershipFilter = {
      _id: new ObjectId(course_id),
      teacherId: user._id,
    };

    // Ownership and zero enrollments must both match when deleting.
    const result = await courses.deleteOne({
      ...ownershipFilter,
      studentIds: { $size: 0 },
    });

    if (result.deletedCount === 1) {
      return successResponse(
        { message: "Course deleted successfully" },
        200,
      );
    }

    const ownCourse = await courses.findOne(
      ownershipFilter,
      { projection: { _id: 1 } },
    );

    if (!ownCourse) {
      return errorResponse(
        "Course not found or not owned by you",
        404,
      );
    }

    return errorResponse(
      "Course cannot be deleted unless its studentIds array is empty",
      409,
    );
  } catch (error) {
    printExceptionLog("Delete course", error);
    return errorResponse("Internal server error", 500);
  }
}