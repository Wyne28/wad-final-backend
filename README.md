# WAD Final Examination — Course Management

## Student Information

- Student Name: Wyne Nadi
- Student ID: 6611919

## Submission Links

- Backend repository: https://github.com/Wyne28/wad-final-backend
- Frontend repository: https://github.com/Wyne28/wad-final-frontend
- Deployed backend: ADD URL
- Deployed frontend: ADD URL

## Prerequisites

- Node.js and npm
- MongoDB Atlas database
- Both backend and frontend source code

## Backend Setup

Open a terminal inside `next-backend`.

```bash
npm install
```

Create `.env.local`:

```dotenv
MONGODB_URI=YOUR_MONGODB_CONNECTION_STRING
MONGODB_DB=wad_final
JWT_SECRET=YOUR_RANDOM_SECRET
FRONTEND_ORIGIN=http://localhost:5173
```

Create the six test accounts and start the backend:

```bash
npm run seed
npm run dev
```

Backend address: http://localhost:3000

The seed command resets the six test accounts to the credentials below.

## Frontend Setup

Open another terminal inside `react-frontend`.

```bash
npm install
```

Create `.env.local`:

```dotenv
VITE_API_URL=http://localhost:3000
```

Start the frontend:

```bash
npm run dev
```

Open http://localhost:5173. Keep the backend running.

## Test Credentials

| Role | Email | Password |
|---|---|---|
| Teacher | teacher1@example.com | Teacher1!Exam |
| Teacher | teacher2@example.com | Teacher2!Exam |
| Teacher | teacher3@example.com | Teacher3!Exam |
| Student | student1@example.com | Student1!Exam |
| Student | student2@example.com | Student2!Exam |
| Student | student3@example.com | Student3!Exam |

## Testing Walkthrough

### Teacher

1. Log in with a Teacher account.
2. Create a course with a name, duration, topics, price, maximum Students, and status.
3. View the course details and edit the course.
4. Confirm the course list shows only that Teacher’s courses.
5. After a Student enrolls, open the course details to view enrolled Students.
6. Confirm a course with enrollments cannot be deleted.
7. Confirm another Teacher cannot access or modify the course through the API.

### Student

1. Log in with a Student account.
2. Browse courses and search by part of the course name or Teacher username.
3. Open an Open course with available seats and enroll.
4. Open My Courses to confirm the enrollment.
5. Confirm duplicate enrollment is rejected.
6. Confirm full and Close courses reject enrollment.
7. Confirm Cancel courses are hidden and reject enrollment.

### Authentication

1. Confirm incorrect credentials are rejected.
2. Refresh after login and confirm authentication is maintained.
3. Log out and confirm protected API requests return `401`.

## Validation Commands

Run these separately in the backend and frontend folders:

```bash
npm run lint
npm run build
```

## Notes

- Roles, ownership, enrollment, capacity, and course-status restrictions are enforced by the backend.
- Environment files contain private configuration and are excluded from Git.
- The application is based on the instructor’s starter repository: https://github.com/pop2518hotmailcom/wad-final-2026-01