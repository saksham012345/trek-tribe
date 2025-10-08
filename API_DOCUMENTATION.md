# Trek Tribe API Documentation

## 🌐 Base URL
- **Development**: `http://localhost:4000`
- **Production**: `https://your-api-domain.com`

## 🔐 Authentication
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## 🔑 Authentication Endpoints

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "name": "John Doe",
  "role": "traveler" // optional: "traveler" | "organizer"
}
```

**Response (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `400` - Validation error (invalid email/password)
- `409` - Email already in use

### POST /auth/login
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com", 
  "password": "SecurePassword123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `400` - Validation error
- `401` - Invalid credentials

### GET /auth/me
Get current user profile information.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "user": {
    "id": "647abc123def456789",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "traveler",
    "phone": "+1234567890",
    "bio": "Adventure enthusiast",
    "profilePhoto": "https://example.com/photo.jpg",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /auth/forgot-password
Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

### POST /auth/reset-password
Reset password using token from email.

**Request Body:**
```json
{
  "email": "user@example.com",
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePassword123"
}
```

**Response (200):**
```json
{
  "message": "Password reset successful. You can now log in with your new password."
}
```

---

## 🗺️ Trip Endpoints

### GET /trips
Get all trips with optional filtering.

**Query Parameters:**
- `q` - Text search (title, description, destination)
- `category` - Filter by category
- `minPrice` - Minimum price filter
- `maxPrice` - Maximum price filter  
- `dest` - Destination filter
- `from` - Start date filter (YYYY-MM-DD)
- `to` - End date filter (YYYY-MM-DD)

**Example:** `/trips?q=himalaya&category=trekking&minPrice=1000&maxPrice=5000`

**Response (200):**
```json
[
  {
    "_id": "647abc123def456789",
    "organizerId": "647abc123def456788",
    "title": "Himalayan Adventure Trek",
    "description": "Experience the breathtaking beauty of the Himalayas...",
    "categories": ["trekking", "adventure", "mountains"],
    "destination": "Nepal",
    "location": {
      "type": "Point",
      "coordinates": [85.3240, 27.7172]
    },
    "schedule": [
      {
        "day": 1,
        "title": "Arrival in Kathmandu",
        "activities": ["Airport pickup", "Hotel check-in", "Welcome dinner"]
      }
    ],
    "images": ["image1.jpg", "image2.jpg"],
    "coverImage": "cover.jpg",
    "capacity": 15,
    "price": 2500,
    "startDate": "2024-03-15T00:00:00.000Z",
    "endDate": "2024-03-25T00:00:00.000Z",
    "participants": ["user-id-1", "user-id-2"],
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### POST /trips
Create a new trip (Organizer/Admin only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "Himalayan Adventure Trek",
  "description": "Experience the breathtaking beauty of the Himalayas...",
  "categories": ["trekking", "adventure"],
  "destination": "Nepal",
  "location": {
    "coordinates": [85.3240, 27.7172]
  },
  "schedule": [
    {
      "day": 1,
      "title": "Arrival in Kathmandu",
      "activities": ["Airport pickup", "Hotel check-in"]
    }
  ],
  "images": ["image1.jpg", "image2.jpg"],
  "capacity": 15,
  "price": 2500,
  "startDate": "2024-03-15T00:00:00.000Z",
  "endDate": "2024-03-25T00:00:00.000Z"
}
```

**Response (201):**
```json
{
  "message": "Trip created successfully",
  "trip": {
    "id": "647abc123def456789",
    "title": "Himalayan Adventure Trek",
    "destination": "Nepal",
    "price": 2500,
    "capacity": 15,
    "startDate": "2024-03-15T00:00:00.000Z",
    "endDate": "2024-03-25T00:00:00.000Z",
    "categories": ["trekking", "adventure"]
  }
}
```

### GET /trips/:id
Get trip details by ID.

**Response (200):**
```json
{
  "_id": "647abc123def456789",
  "organizerId": {
    "_id": "647abc123def456788",
    "name": "Trek Organizer",
    "email": "organizer@example.com"
  },
  "title": "Himalayan Adventure Trek",
  "description": "Experience the breathtaking beauty...",
  "categories": ["trekking", "adventure"],
  "destination": "Nepal",
  "schedule": [...],
  "images": [...],
  "capacity": 15,
  "price": 2500,
  "startDate": "2024-03-15T00:00:00.000Z",
  "endDate": "2024-03-25T00:00:00.000Z",
  "participants": [...],
  "participantDetails": [
    {
      "userId": "user-id-1",
      "emergencyContactName": "Jane Doe",
      "emergencyContactPhone": "+1234567890",
      "medicalConditions": "None",
      "experienceLevel": "intermediate",
      "joinedAt": "2024-01-15T00:00:00.000Z"
    }
  ],
  "status": "active",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### POST /trips/:id/join
Join a trip (Authenticated users only).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Successfully joined trip",
  "trip": { /* Updated trip object */ }
}
```

**Errors:**
- `400` - Trip is full / Already joined
- `404` - Trip not found

### DELETE /trips/:id/leave
Leave a trip (Authenticated users only).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Successfully left trip",
  "trip": { /* Updated trip object */ }
}
```

---

## 👨‍💼 Admin Endpoints

### GET /admin/stats
Get comprehensive admin dashboard statistics.

**Headers:** `Authorization: Bearer <admin-token>`

**Response (200):**
```json
{
  "overview": {
    "totalUsers": 150,
    "totalTrips": 25,
    "totalBookings": 300,
    "totalRevenue": 750000,
    "totalReviews": 85,
    "totalWishlists": 120
  },
  "users": {
    "total": 150,
    "byRole": [
      { "role": "traveler", "count": 120 },
      { "role": "organizer", "count": 25 },
      { "role": "admin", "count": 3 },
      { "role": "agent", "count": 2 }
    ],
    "recentUsers": [...]
  },
  "trips": {
    "total": 25,
    "byStatus": [
      { "status": "active", "count": 20 },
      { "status": "completed", "count": 4 },
      { "status": "cancelled", "count": 1 }
    ],
    "recentTrips": [...],
    "totalBookings": 300,
    "totalRevenue": 750000
  }
}
```

### GET /admin/users
Get all users with pagination and search.

**Headers:** `Authorization: Bearer <admin-token>`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `search` - Search by name or email
- `role` - Filter by role

**Response (200):**
```json
{
  "users": [
    {
      "_id": "647abc123def456789",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "traveler",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastActive": "2024-01-15T00:00:00.000Z"
    }
  ],
  "pagination": {
    "current": 1,
    "pages": 15,
    "total": 150
  }
}
```

### GET /admin/trips  
Get all trips with pagination and search.

**Headers:** `Authorization: Bearer <admin-token>`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `search` - Search by title or destination
- `status` - Filter by status

**Response (200):**
```json
{
  "trips": [
    {
      "_id": "647abc123def456789",
      "title": "Himalayan Adventure Trek",
      "destination": "Nepal",
      "price": 2500,
      "capacity": 15,
      "participants": ["user-id-1", "user-id-2"],
      "status": "active",
      "organizerId": {
        "name": "Trek Organizer",
        "email": "organizer@example.com"
      },
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "current": 1,
    "pages": 3,
    "total": 25
  }
}
```

### PATCH /admin/users/:id/role
Update user role.

**Headers:** `Authorization: Bearer <admin-token>`

**Request Body:**
```json
{
  "role": "organizer" // "traveler" | "organizer" | "admin" | "agent"
}
```

**Response (200):**
```json
{
  "message": "User role updated successfully",
  "user": { /* Updated user object */ }
}
```

### DELETE /admin/users/:id
Delete user account and cleanup related data.

**Headers:** `Authorization: Bearer <admin-token>`

**Response (200):**
```json
{
  "message": "User deleted successfully"
}
```

### PATCH /admin/trips/:id/status
Update trip status.

**Headers:** `Authorization: Bearer <admin-token>`

**Request Body:**
```json
{
  "status": "cancelled" // "active" | "cancelled" | "completed"
}
```

**Response (200):**
```json
{
  "message": "Trip status updated successfully",
  "trip": { /* Updated trip object */ }
}
```

### DELETE /admin/trips/:id
Delete trip and cleanup related data.

**Headers:** `Authorization: Bearer <admin-token>`

**Response (200):**
```json
{
  "message": "Trip deleted successfully"
}
```

### POST /admin/cleanup
Perform system cleanup operations.

**Headers:** `Authorization: Bearer <admin-token>`

**Response (200):**
```json
{
  "message": "System cleanup completed successfully",
  "results": {
    "orphanedReviews": 5,
    "orphanedWishlists": 3,
    "expiredTrips": 2
  }
}
```

---

## 🎧 Agent Endpoints

### GET /agent/stats
Get agent dashboard statistics and performance metrics.

**Headers:** `Authorization: Bearer <agent-token>`

**Response (200):**
```json
{
  "tickets": {
    "total": 45,
    "open": 12,
    "inProgress": 8,
    "resolved": 23,
    "unassigned": 5
  },
  "performance": {
    "avgResolutionTimeHours": 6.5,
    "avgSatisfactionRating": 4.2,
    "resolvedLast30Days": 18
  },
  "recentActivity": [
    {
      "_id": "ticket-id-1",
      "ticketId": "TT-12345678-0001",
      "subject": "Booking Issue",
      "status": "in-progress",
      "priority": "high",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### GET /agent/tickets
Get support tickets with filtering and pagination.

**Headers:** `Authorization: Bearer <agent-token>`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `status` - Filter by status
- `priority` - Filter by priority
- `category` - Filter by category
- `assigned` - Filter by assignment ("me" | "unassigned" | "all")
- `search` - Search tickets

**Response (200):**
```json
{
  "tickets": [
    {
      "_id": "ticket-id-1",
      "ticketId": "TT-12345678-0001",
      "subject": "Payment Issue with Booking",
      "status": "open",
      "priority": "high", 
      "category": "payment",
      "customerName": "John Doe",
      "customerEmail": "john@example.com",
      "customerPhone": "+1234567890",
      "assignedAgentId": null,
      "createdAt": "2024-01-15T09:00:00.000Z",
      "updatedAt": "2024-01-15T09:00:00.000Z"
    }
  ],
  "pagination": {
    "current": 1,
    "pages": 5,
    "total": 87
  }
}
```

### GET /agent/tickets/:ticketId
Get detailed ticket information.

**Headers:** `Authorization: Bearer <agent-token>`

**Response (200):**
```json
{
  "ticket": {
    "_id": "ticket-id-1",
    "ticketId": "TT-12345678-0001",
    "subject": "Payment Issue with Booking",
    "description": "Unable to process payment for trip booking...",
    "status": "open",
    "priority": "high",
    "category": "payment",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "customerPhone": "+1234567890",
    "userId": {
      "_id": "user-id-1",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890"
    },
    "assignedAgentId": {
      "_id": "agent-id-1",
      "name": "Agent Smith",
      "email": "agent@example.com"
    },
    "relatedTripId": {
      "_id": "trip-id-1",
      "title": "Himalayan Trek",
      "destination": "Nepal",
      "startDate": "2024-03-15T00:00:00.000Z"
    },
    "messages": [
      {
        "sender": "customer",
        "senderName": "John Doe",
        "message": "I'm having trouble with payment processing...",
        "timestamp": "2024-01-15T09:00:00.000Z"
      },
      {
        "sender": "agent", 
        "senderName": "Agent Smith",
        "message": "I'll help you resolve this issue...",
        "timestamp": "2024-01-15T09:15:00.000Z"
      }
    ],
    "createdAt": "2024-01-15T09:00:00.000Z"
  }
}
```

### POST /agent/tickets/:ticketId/assign
Assign ticket to agent.

**Headers:** `Authorization: Bearer <agent-token>`

**Request Body:**
```json
{
  "assignedAgentId": "agent-id-1" // Optional: if not provided, assigns to current agent
}
```

**Response (200):**
```json
{
  "ticket": { /* Updated ticket object */ },
  "message": "Ticket assigned successfully"
}
```

### PATCH /agent/tickets/:ticketId/status
Update ticket status.

**Headers:** `Authorization: Bearer <agent-token>`

**Request Body:**
```json
{
  "status": "in-progress" // "open" | "in-progress" | "waiting-customer" | "resolved" | "closed"
}
```

**Response (200):**
```json
{
  "ticket": { /* Updated ticket object */ },
  "message": "Ticket status updated successfully"
}
```

### POST /agent/tickets/:ticketId/messages
Add message to ticket conversation.

**Headers:** `Authorization: Bearer <agent-token>`

**Request Body:**
```json
{
  "message": "I've reviewed your case and here's the solution...",
  "attachments": ["file1.jpg", "file2.pdf"] // Optional
}
```

**Response (200):**
```json
{
  "ticket": { /* Updated ticket with new message */ },
  "message": "Message added successfully"
}
```

### POST /agent/tickets
Create new support ticket on behalf of customer.

**Headers:** `Authorization: Bearer <agent-token>`

**Request Body:**
```json
{
  "userId": "customer-user-id",
  "subject": "Booking Assistance Required",
  "description": "Customer needs help with trip booking process...",
  "category": "booking", // "booking" | "payment" | "technical" | "general" | "complaint" | "refund"
  "priority": "medium", // "low" | "medium" | "high" | "urgent"
  "relatedTripId": "trip-id-1", // Optional
  "relatedBookingId": "booking-id-1" // Optional
}
```

**Response (201):**
```json
{
  "ticket": { /* Created ticket object */ },
  "message": "Ticket created successfully"
}
```

### GET /agent/customers/search
Search customers by name, email, or phone.

**Headers:** `Authorization: Bearer <agent-token>`

**Query Parameters:**
- `q` - Search query (minimum 2 characters)

**Response (200):**
```json
{
  "customers": [
    {
      "_id": "user-id-1",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "role": "traveler",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET /agent/customers/:userId
Get customer details with booking and support history.

**Headers:** `Authorization: Bearer <agent-token>`

**Response (200):**
```json
{
  "customer": {
    "_id": "user-id-1",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "role": "traveler",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "bookingHistory": [
    {
      "_id": "trip-id-1",
      "title": "Himalayan Trek",
      "destination": "Nepal",
      "startDate": "2024-03-15T00:00:00.000Z",
      "organizerId": {
        "name": "Trek Organizer",
        "email": "organizer@example.com",
        "phone": "+0987654321"
      }
    }
  ],
  "supportHistory": [
    {
      "_id": "ticket-id-1",
      "ticketId": "TT-12345678-0001",
      "subject": "Payment Issue",
      "status": "resolved",
      "createdAt": "2024-01-15T09:00:00.000Z",
      "assignedAgentId": {
        "name": "Agent Smith",
        "email": "agent@example.com"
      }
    }
  ]
}
```

### POST /agent/whatsapp/send
Send WhatsApp message to customer.

**Headers:** `Authorization: Bearer <agent-token>`

**Request Body:**
```json
{
  "phone": "+1234567890",
  "message": "Hello! This is regarding your recent trip booking..."
}
```

**Response (200):**
```json
{
  "message": "WhatsApp message sent successfully"
}
```

**Errors:**
- `503` - WhatsApp service not available

### GET /agent/services/status
Get status of email and WhatsApp services.

**Headers:** `Authorization: Bearer <agent-token>`

**Response (200):**
```json
{
  "email": {
    "isReady": true,
    "hasCredentials": true,
    "lastTest": true
  },
  "whatsapp": {
    "isReady": true,
    "isInitializing": false,
    "clientInfo": "connected"
  }
}
```

---

## 💬 Review Endpoints

### GET /reviews
Get reviews with optional filtering.

**Query Parameters:**
- `tripId` - Filter reviews by trip
- `organizerId` - Filter reviews by organizer
- `reviewType` - Filter by type ("trip" | "organizer")

**Response (200):**
```json
[
  {
    "_id": "review-id-1",
    "title": "Amazing Experience!",
    "comment": "This trip exceeded all my expectations...",
    "rating": 5,
    "reviewType": "trip",
    "targetId": "trip-id-1",
    "reviewerId": {
      "_id": "user-id-1",
      "name": "John Doe"
    },
    "createdAt": "2024-01-15T00:00:00.000Z"
  }
]
```

### POST /reviews
Create a new review.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "Amazing Experience!",
  "comment": "This trip exceeded all my expectations...",
  "rating": 5, // 1-5
  "reviewType": "trip", // "trip" | "organizer"
  "targetId": "trip-id-1" // Trip ID or Organizer ID
}
```

**Response (201):**
```json
{
  "message": "Review created successfully",
  "review": { /* Created review object */ }
}
```

---

## 💝 Wishlist Endpoints

### GET /wishlist
Get user's wishlist.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "wishlist": [
    {
      "_id": "wishlist-id-1",
      "tripId": {
        "_id": "trip-id-1",
        "title": "Himalayan Trek",
        "destination": "Nepal",
        "price": 2500,
        "coverImage": "cover.jpg"
      },
      "addedAt": "2024-01-15T00:00:00.000Z"
    }
  ]
}
```

### POST /wishlist
Add trip to wishlist.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "tripId": "trip-id-1"
}
```

**Response (201):**
```json
{
  "message": "Trip added to wishlist",
  "wishlist": { /* Updated wishlist */ }
}
```

### DELETE /wishlist/:tripId
Remove trip from wishlist.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Trip removed from wishlist"
}
```

---

## 🖼️ File Upload Endpoints

### POST /files/upload
Upload files (images, PDFs, etc.).

**Headers:** `Authorization: Bearer <token>`

**Request:** Multipart form data with files

**Response (200):**
```json
{
  "files": [
    {
      "filename": "image1.jpg",
      "url": "https://your-domain.com/uploads/image1.jpg",
      "size": 1024000,
      "mimeType": "image/jpeg"
    }
  ]
}
```

**Errors:**
- `400` - File too large / Invalid file type
- `413` - Payload too large

---

## 📊 System Endpoints

### GET /health
System health check (public endpoint).

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "mongodb": {
    "status": "connected",
    "ping": "successful"
  },
  "uptime": 86400,
  "memory": {
    "used": 134217728,
    "total": 536870912
  },
  "version": "v20.10.0"
}
```

---

## 🚨 Error Responses

All API endpoints return consistent error responses:

### 400 Bad Request
```json
{
  "error": "Invalid request data",
  "details": "Validation error details"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 409 Conflict
```json
{
  "error": "Email already in use"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## 📝 Notes

### Rate Limiting
- Default: 100 requests per minute per IP
- Configurable via `RATE_LIMIT_MAX` environment variable

### File Upload Limits
- Maximum file size: 10MB (configurable)
- Allowed types: Images (JPEG, PNG, GIF, WebP), PDFs
- Multiple files supported in single request

### Pagination
- Default page size: 10 items
- Maximum page size: 100 items
- Always includes pagination metadata in response

### Search
- Full-text search available on indexed fields
- Case-insensitive matching
- Supports partial matches

### Date Formats
- All dates in ISO 8601 format (UTC)
- Example: `2024-01-15T12:00:00.000Z`

### Geographic Data
- Location coordinates in [longitude, latitude] format
- Uses GeoJSON Point format for storage
- Supports geographic queries (proximity search)

---

This API documentation covers all endpoints available in the Trek Tribe platform. For additional support or questions, please refer to the main documentation or contact the development team.