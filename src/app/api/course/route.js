//src/app/api/course/route.js

/**
 * Course endpoints go here
 */

// implementation start here
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

// Treat search input as literal text, not a regular expression.
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/course
// GET /api/course?search=english
// GET /api/course?enrolled=true
export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return errorResponse("Authentication required", 401);
    }

    if (!["Teacher", "Student"].includes(user.role)) {
      return errorResponse("Role not permitted", 403);
    }

    const db = await getDb();
    const url = new URL(request.url);

    const search = (url.searchParams.get("search") || "").trim();
    const enrolledOnly =
      url.searchParams.get("enrolled") === "true";

    if (search.length > 100) {
      return errorResponse("Search must be 100 characters or fewer", 400);
    }

    const filter = {};

    if (user.role === "Teacher") {
      // Teachers see only their own courses.
      filter.teacherId = user._id;

      if (enrolledOnly) {
        return errorResponse(
          "Only Students can request enrolled courses",
          403,
        );
      }
    } else {
      // Students must never see Cancel courses in the list.
      filter.status = { $ne: "Cancel" };

      if (enrolledOnly) {
        filter.studentIds = user._id;
      }
    }

    if (search) {
      const pattern = {
        $regex: escapeRegex(search),
        $options: "i",
      };

      const matchingTeachers = await db
        .collection("users")
        .find(
          {
            role: "Teacher",
            username: pattern,
          },
          {
            projection: { _id: 1 },
          },
        )
        .toArray();

      filter.$or = [
        { name: pattern },
        {
          teacherId: {
            $in: matchingTeachers.map((teacher) => teacher._id),
          },
        },
      ];
    }

    const courses = await db
      .collection("courses")
      .aggregate([
        { $match: filter },
        { $sort: { createdAt: -1, _id: -1 } },
        {
          $lookup: {
            from: "users",
            let: { ownerId: "$teacherId" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$ownerId"] },
                },
              },
              {
                $project: {
                  _id: 1,
                  username: 1,
                },
              },
            ],
            as: "teacher",
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            durationDays: 1,
            topics: 1,
            price: 1,
            maxStudents: 1,
            status: 1,
            teacherId: 1,
            createdAt: 1,
            updatedAt: 1,
            teacher: { $arrayElemAt: ["$teacher", 0] },
            enrolledCount: {
              $size: { $ifNull: ["$studentIds", []] },
            },
            isEnrolled: {
              $in: [
                user._id,
                { $ifNull: ["$studentIds", []] },
              ],
            },
          },
        },
      ])
      .toArray();

    return successResponse(
      {
        courses: courses.map((course) => ({
          ...course,
          remainingSeats: Math.max(
            0,
            course.maxStudents - course.enrolledCount,
          ),
        })),
      },
      200,
    );
  } catch (error) {
    printExceptionLog("List courses", error);
    return errorResponse("Internal server error", 500);
  }
}

// POST /api/course
export async function POST(request) {
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

    if (user.role !== "Teacher") {
      return errorResponse("Only Teachers can create courses", 403);
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
      Array.isArray(body)
    ) {
      return errorResponse("A course object is required", 400);
    }

    // Ownership and enrollments are controlled by the server.
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

    const {
      name,
      durationDays,
      topics,
      price,
      maxStudents,
      status,
    } = body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 150
    ) {
      return errorResponse(
        "Course name must contain 1 to 150 characters",
        400,
      );
    }

    if (!Number.isSafeInteger(durationDays) || durationDays < 1) {
      return errorResponse(
        "Duration must be a positive whole number",
        400,
      );
    }

    if (
      !Array.isArray(topics) ||
      topics.length === 0 ||
      topics.length > 50 ||
      topics.some(
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

    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      return errorResponse(
        "Price must be a nonnegative number",
        400,
      );
    }

    if (!Number.isSafeInteger(maxStudents) || maxStudents < 1) {
      return errorResponse(
        "Max Student must be a positive whole number",
        400,
      );
    }

    if (!["Open", "Close", "Cancel"].includes(status)) {
      return errorResponse(
        "Status must be Open, Close, or Cancel",
        400,
      );
    }

    const db = await getDb();
    const now = new Date();

    const course = {
      name: name.trim(),
      durationDays,
      topics: [...new Set(topics.map((topic) => topic.trim()))],
      price,
      maxStudents,
      status,
      teacherId: user._id,
      studentIds: [],
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("courses").insertOne(course);

    return successResponse(
      {
        message: "Course created",
        course: {
          _id: result.insertedId,
          name: course.name,
          durationDays: course.durationDays,
          topics: course.topics,
          price: course.price,
          maxStudents: course.maxStudents,
          status: course.status,
          teacherId: course.teacherId,
          createdAt: now,
          updatedAt: now,
          enrolledCount: 0,
          remainingSeats: course.maxStudents,
        },
      },
      201,
    );
  } catch (error) {
    printExceptionLog("Create course", error);
    return errorResponse("Internal server error", 500);
  }
}