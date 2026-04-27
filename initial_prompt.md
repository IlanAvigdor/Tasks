PROMPT:
Build a simple and efficient task management web app (MVP) with the following requirements:
Goal
A minimal app where a manager assigns daily recurring tasks to workers, workers update task status, and the manager monitors progress in real time.
User Roles
Admin (Manager)
Worker (Employee)

Core Features:

1. Recurring Tasks (IMPORTANT)
Admin can create reusable recurring tasks (templates)
Each task includes:
title
short description (to explain what to do)
assigned users (one or multiple)
These tasks are reused daily without needing to recreate them
2. Task Status System (Simple)
Each task has only 2 statuses:
"red" = not completed
"green" = completed
3. Worker Actions
Workers can:
view all tasks
see assigned users for each task
update task status from "red" → "green"
All workers can see all tasks (full transparency)
4. Admin Dashboard
A. Task Management Screen
Create/edit recurring tasks
Assign workers
Add description
B. Task Status Screen (IMPORTANT)
Display all tasks
Tasks marked "green" should automatically appear at the top
Show:
task name
description
assigned users
current status
5. Notifications (IMPORTANT)
When a worker marks a task as "green":
Admin receives a notification
Notifications can be simple (in-app notification or alert)
UI Requirements
Very simple and clean interface
Mobile-friendly
Use colors clearly:
red = not completed
green = completed
Two main screens for admin:
Task Setup
Task Status
One main screen for workers:
Task list with update button
Data Structure (Simple)
Users
id
name
role (admin / worker)
Tasks (Recurring Templates)
id
title
description
assignedTo (array of user IDs)
TaskStatus (Daily state)
id
taskId
date
status ("red" / "green")
Tech Stack
Frontend: React
Backend: Firebase (Firestore + Auth)
Real-time updates (Firestore listeners)
Code Requirements
Keep it minimal and clean
No unnecessary features
Ready to run
Basic UI only