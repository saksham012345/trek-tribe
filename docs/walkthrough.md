# Walkthrough - Advanced Admin Analytics

## Goal
Implement deep analytical insights for Admins, specifically focusing on User Retention and Activity patterns, to go beyond basic counts.

## Changes

### Backend (`services/api`)
#### [analytics.ts](file:///c:/Users/hp/Desktop/trek-tribe/services/api/src/routes/analytics.ts)
-   **Added `GET /retention`**: Calculates monthly cohort retention. Group users by registration month and tracks their booking activity in subsequent months.
-   **Added `GET /activity`**: Aggregates booking timestamps by Day of Week and Hour of Day to create a heatmap of platform usage.
-   **Added `GET /top-organizers`**: Ranks organizers by revenue and booking volume.

### Frontend (`web/src`)
#### [AdminDashboard.tsx](file:///c:/Users/hp/Desktop/trek-tribe/web/src/pages/AdminDashboard.tsx)
-   **New "Analytics" Tab**: Added a dedicated tab for these new insights.
-   **Visualizations**:
    -   **Retention Table**: Color-coded cohort matrix to easily spot drop-offs.
    -   **Activity Chart**: Stacked bar chart showing peak activity times by day.
    -   **Top Organizers**: Horizontal bar chart comparing organizer revenue.
-   **Dependencies**: Integrated `chart.js` and `react-chartjs-2` for responsive, interactive charts.

## Verification Results
### Automated Checks
-   [x] Backend endpoints compiled without errors.
-   [x] Frontend dependencies (`chart.js`) confirmed installed.

### Manual Verification Steps
1.  **Access**: Login as Admin.
2.  **Navigation**: Click "Analytics" tab in Dashboard.
3.  **Charts**:
    -   Verify Retention table rows match last 6 months.
    -   Verify Activity chart shows bars for active days.
    -   Verify Top Organizers chart lists high-performing organizers.
