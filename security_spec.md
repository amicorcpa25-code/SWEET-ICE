# Security Specification: Task Management System

## Data Invariants
1. A new user registers with status `PENDING`. They cannot access any business data (tasks, projects, chats) until changed to `APPROVED`.
2. Only an Admin or Manager can approve a user by changing their status to `APPROVED`.
3. An Admin or Manager can block a user (status `BLOCKED`) to immediately revoke all access.
4. Tasks can only be updated by their creator, an assigned member, an Admin, or a Manager—and only if the user is `APPROVED`.
5. Bootstrap Admin (`waralaliju@gmail.com`) is always `APPROVED` and `ADMIN` even if the record is missing.

## Dirty Dozen Payloads (Rejection Tests)
1. **Unapproved Data Access**: A `PENDING` user trying to read Tasks.
   - `GET /tasks` -> `PERMISSION_DENIED`
2. **Self-Approval**: A `PENDING` user trying to set their own status to `APPROVED`.
   - `PATCH /users/X { "status": "APPROVED" }` -> `PERMISSION_DENIED`
3. **Manager Role Escalation**: A `MANAGER` trying to make themselves an `ADMIN`.
   - `PATCH /users/MANAGER_ID { "role": "ADMIN" }` -> `PERMISSION_DENIED`
4. **Blocked Access**: A `BLOCKED` user trying to send a chat message.
   - `POST /chats/C/messages { ... }` -> `PERMISSION_DENIED`
5. **Malicious Role Escalation**: User `X` trying to update their own role from `USER` to `ADMIN`.
   - `PATCH /users/X { "role": "ADMIN" }` -> `PERMISSION_DENIED`
2. **Task Hijacking**: User `Y` (not assigned, not creator) trying to update Task `T`.
   - `PATCH /tasks/T { "status": "COMPLETED" }` -> `PERMISSION_DENIED`
3. **Ghost Task Creation**: Providing a non-existent `creatorId` during task creation.
   - `POST /tasks { "creatorId": "WRONG_ID", ... }` -> `PERMISSION_DENIED` (due to `auth.uid` check)
4. **Chat Eavesdropping**: User `Z` trying to read messages from `chat/PRIVATE` where they are not a member.
   - `GET /chats/PRIVATE/messages` -> `PERMISSION_DENIED`
5. **Notification Forgery**: User `A` creating a notification for User `B`.
   - `POST /notifications { "userId": "B", ... }` -> `PERMISSION_DENIED`
6. **Audit Log Erasure**: Any user trying to delete an audit log.
   - `DELETE /auditLogs/LOG_ID` -> `PERMISSION_DENIED`
7. **Identity Spoofing**: Setting `senderId` to another user's ID in a message.
   - `POST /chats/C/messages { "senderId": "VICTIM_ID", ... }` -> `PERMISSION_DENIED`
8. **Resource Poisoning**: Sending a 2MB description in a task.
   - `POST /tasks { "description": "[2MB STRING]", ... }` -> `PERMISSION_DENIED` (size check)
9. **State Shortcutting**: Updating a task status from `PENDING` to `COMPLETED` without going through `IN_PROGRESS` (if we enforce state machine, though here we might be more flexible).
10. **Shadow Field Injection**: Adding `isVerified: true` to a user profile when it's not in the schema.
    - `PATCH /users/X { "isVerified": true }` -> `PERMISSION_DENIED` (affectedKeys check)
11. **Invalid ID Format**: Using a 1KB string as a task ID.
    - `SET /tasks/[1KB STRING]` -> `PERMISSION_DENIED`
12. **PII Leak**: A `USER` trying to list all users' private bio or customFields.
    - `GET /users` (list) -> `PERMISSION_DENIED` (if not properly scoped)
