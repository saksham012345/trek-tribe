# Admin Advanced Analytics Implementation Plan

## Goal Description
Enhance the Admin Dashboard with deeper analytical insights, specifically focusing on User Retention Cohorts, Activity Heatmaps, and detailed Organizer Performance metrics. This moves beyond basic counters to actionable intelligence.

## User Review Required
> [!NOTE]
> Retention analysis requires heavy aggregation queries which might be slow on large datasets. We will implement basic caching or efficient indexing if needed, but for now, we'll run them live.

## Proposed Changes

### Backend (`services/api`)
#### [MODIFY] [analytics.ts](file:///c:/Users/hp/Desktop/trek-tribe/services/api/src/routes/analytics.ts)
-   Add `GET /admin/retention`: Calculate monthly user retention cohorts based on booking activity.
-   Add `GET /admin/activity`: Aggregate activity (bookings/logins) by time of day/week.
-   Add `GET /admin/top-organizers`: Ranking organizers by revenue and customer satisfaction.

### Frontend (`web/src`)
#### [MODIFY] [AdminDashboard.tsx](file:///c:/Users/hp/Desktop/trek-tribe/web/src/pages/AdminDashboard.tsx)
-   Add new "Analytics" tab.
-   Integrate `react-chartjs-2` for visualizations:
    -   **Retention Heatmap**: Table showing % of users returning.
    -   **Activity Chart**: Bar/Line chart of peak activity times.
    -   **Top Organizers**: Horizontal bar chart.

## Verification Plan
### Automated Tests
-   Verify API response structure for new endpoints.
-   Check calculated values against known mock data.

### Manual Verification
1.  Login as Admin.
2.  Navigate to "Analytics" tab.
3.  Verify charts load and display data.
4.  Check that "Retention" numbers make sense (e.g., month 0 is 100%).
