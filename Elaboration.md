# Project Architecture & Elaboration

## 📂 Project Overview
**TrekTribe** is a MERN (MongoDB, Express, React, Node.js) stack application designed for travel booking and community engagement. It features sophisticated capabilities including AI-powered support, role-based access control (Traveler, Organizer, Admin), and real-time communications.

---

## 🖥️ Frontend (`web/src`)
The React frontend handles the user interface, client-side routing, and state management.

### Key Directories
*   **`components/`**: Reusable UI building blocks.
    *   `auth/`: Authentication guards (`PhoneRequirementGuard`, `ProtectedRoute`) and forms.
    *   `AIChatWidget`: The floating AI assistant interface.
    *   `JoinTripModal`: Critical component for the booking flow.
*   **`pages/`**: Full-screen page components corresponding to routes.
    *   `TripDetails.tsx`: The main product page. Handles SEO tags, booking initiation, and trip info.
    *   `OrganizerCRM.tsx` & `CRMDashboard.tsx`: Feature-rich dashboards for trip organizers.
    *   `CompleteProfile.tsx`: Mandatory onboarding step for new users.
*   **`contexts/`**: Global state management.
    *   `AuthContext.tsx`: The heart of frontend security. Manages user session, login/logout, and token persistence.
*   **`config/`**: External service configuration.
    *   `firebase.ts`: Firebase initialization for file storage.
    *   `api.ts`: Axios instance with interceptors for JWT token handling.
*   **`utils/`**: Helper functions.
    *   `razorpay.ts`: SDK loader for payments.
    *   `fileUpload.ts`: (New) Firebase storage upload logic.

### 🔑 Critical Files
*   **`App.tsx`**: The main application router. Defines all routes, applies global guards (like phone verification), and handles lazy loading of pages.
*   **`index.html` (public)**: The entry point. Now dynamically injected with SEO meta tags by the backend.

---

## ⚙️ Backend (`services/api/src`)
The Express backend serves as the API layer, managing business logic, database interactions, and integrations.

### Key Directories
*   **`models/`**: Mongoose schemas defining the data structure.
    *   `Trip.ts`: Core entity. Recently updated with `slug` for SEO.
    *   `User.ts`: User identity, roles, and verification status.
    *   `Booking.ts`: Transactional records linking Users and Trips.
*   **`routes/`**: API endpoint definitions.
    *   `trips.ts`: Trip management. Includes new `/by-slug/:slug` endpoint.
    *   `auth.ts`: Authentication flows (Google, Email).
    *   `webhooks.ts`: Critical for handling asynchronous payment updates from Razorpay.
*   **`middleware/`**: Request interceptors.
    *   `index.ts` (Main implementation): Contains the **SEO Middleware** that acts as a custom SSR (Server-Side Rendering) lite layer for crawlers.
    *   `rateLimiter.ts`: Security controls for API abuse.
    *   `tripViewTracker.ts`: Analytics for trip views.
*   **`services/`**: Business logic encapsulation (Thick Service Layer).
    *   **AI Services**: `ragService.ts`, `aiConversationService.ts` (Power the AI chat).
    *   **Payment Services**: `razorpayService.ts`, `autoPayService.ts`.
    *   **Communication**: `socketService.ts` (Real-time), `emailService.ts`, `whatsappService.ts`.
    *   `cronScheduler.ts`: Manages background tasks (e.g., subscription expiry).

### 🔑 Critical Files
*   **`index.ts`**: The application entry point.
    *   Initializes Database, Socket.IO, and Cron jobs.
    *   Registers all routes.
    *   **Crucial Role**: Implements the SEO injection logic that intercepts HTML requests to inject metadata before serving the React app.
*   **`scripts/`**: Maintenance tasks.
    *   `generate-slugs.ts`: Migration script for SEO URL upgrades.

---

## 🔄 Key Flows

### 1. SEO & Routing (New)
*   **Flow**: User/Crawler requests `/trips/my-trip` -> Backend `index.ts` detects HTML request -> Fetches trip by slug -> Injects `<meta>` tags -> Returns HTML -> Browser loads React -> `TripDetails` hydrates and takes over.
*   **Responsible**: `index.ts` (Backend), `TripDetails.tsx` (Frontend).

### 2. Payments (Razorpay)
*   **Flow**: User clicks "Join" -> `JoinTripModal` -> Frontend calls API -> Backend `razorpayService` creates order -> Frontend opens Razorpay SDK -> Success/Failure -> Webhook updates Backend.
*   **Responsible**: `razorpayService.ts`, `webhookRoutes.ts`, `TripDetails.tsx`.

### 3. AI Support
*   **Flow**: User chats -> `AIChatWidget` (Frontend) -> Socket.IO -> `socketService` (Backend) -> `aiConversationService` -> `ragService` (vector search) -> LLM -> Response.
*   **Responsible**: `AIChatWidget.tsx`, `socketService.ts`, `ragService.ts`.
