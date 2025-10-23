# System Administrator Documentation

## Overview
The System Administrator role allows authorized users to manage application access and user roles. System administrators can authorize or revoke access for Google accounts and assign roles to users.

## Setup

### 1. Configure Authorized Emails
Add your system administrator email addresses to the `.env.local` file:

```bash
AUTHORIZED_EMAILS=your-email@example.com,another-admin@example.com
```

These email addresses will be automatically authorized as system administrators when they first sign in.

### 2. Database Migration
The user authorization system has been added with the migration `20251023_add_user_authorization`. The following fields were added to the User model:

- `role` (String): User role - "user", "admin", or "system_admin"
- `isAuthorized` (Boolean): Whether the user is authorized to access the app
- `authorizedAt` (DateTime): When the user was authorized
- `authorizedBy` (String): Who authorized the user (email address)

## User Roles

### System Admin (`system_admin`)
- Full access to all features
- Can authorize/unauthorize users
- Can manage user roles
- Can access User Management interface at `/admin/users`

### Admin (`admin`)
- Standard administrative access to application features
- Cannot manage user authorization (future feature)

### User (`user`)
- Standard user access
- Cannot access administrative features

## Authorization Flow

### First-Time Users
1. User attempts to sign in with Google account
2. If email is NOT in `AUTHORIZED_EMAILS` list:
   - User is redirected to `/auth/unauthorized` page
   - User must contact system administrator for access
3. If email IS in `AUTHORIZED_EMAILS` list:
   - User is automatically authorized as `system_admin`
   - User can access the application

### Existing Users
1. User signs in with Google account
2. System checks if `isAuthorized` is `true`
3. If not authorized:
   - User is redirected to `/auth/unauthorized` page
4. If authorized:
   - User can access the application based on their role

## User Management Interface

### Accessing the Interface
Navigate to `/admin/users` (only accessible to system administrators)

### Features
- **View All Users**: See all registered users with their authorization status
- **Authorize/Unauthorize Users**: Toggle user access with a switch
- **Change User Roles**: Assign roles (User, Admin, System Admin) from dropdown
- **Search Users**: Filter users by email or name
- **Audit Trail**: View who authorized each user and when

### Managing Users

#### Authorize a User
1. Go to `/admin/users`
2. Find the user in the list
3. Toggle the "Authorized" switch to ON
4. The system records your email and timestamp

#### Change User Role
1. Go to `/admin/users`
2. Find the user in the list
3. Select new role from the dropdown
4. Changes are saved automatically

#### Revoke Access
1. Go to `/admin/users`
2. Find the user in the list
3. Toggle the "Authorized" switch to OFF
4. User will be denied access on next sign-in

## Security Notes

1. **Protected Routes**: The `/admin/users` route is protected and only accessible to system administrators

2. **Self-Protection**: System administrators cannot remove their own authorization or change their own role

3. **Authorization Check**: Authorization is checked at sign-in, so changes take effect on the user's next login

4. **Environment Variable**: Keep `AUTHORIZED_EMAILS` secure and only include trusted email addresses

## API Endpoints

### GET `/api/users`
- **Auth Required**: Yes (System Admin only)
- **Returns**: List of all users with authorization details

### PATCH `/api/users?id=<userId>`
- **Auth Required**: Yes (System Admin only)
- **Body**: `{ isAuthorized?: boolean, role?: string }`
- **Returns**: Updated user object

## Troubleshooting

### "Access Denied" Error
- User is not authorized
- System admin needs to authorize the user at `/admin/users`

### Cannot Access User Management
- Ensure you are signed in with an email in `AUTHORIZED_EMAILS`
- Check your role is set to `system_admin` in the database

### Changes Not Taking Effect
- User needs to sign out and sign back in
- Authorization is checked during sign-in process

## Next Steps

Consider implementing:
- Email notifications when users request access
- Bulk user authorization
- Role-based permissions for specific features
- Audit log for user management actions
