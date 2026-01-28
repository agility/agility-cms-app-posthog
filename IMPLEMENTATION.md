# PostHog App Implementation Guide

This document outlines the implementation plan for enhancing the Agility CMS PostHog app with analytics dashboards, page sidebars, and an improved content item sidebar with tabbed interface.

## Overview

The app will have three main capabilities:

| Capability | Description | Status |
|------------|-------------|--------|
| **Dashboard App** | High-level analytics overview for the entire project | New |
| **Page Sidebar** | Analytics for the currently viewed page (by pageID) | New |
| **Content Item Sidebar** | Tabbed interface: Analytics + A/B Testing | Enhanced |

## Analytics Data Source

The demo site tracks these properties in PostHog events:

```typescript
// Tracked on every event
{
  pageID: number      // Agility CMS Page ID (from data-agility-page attribute)
  contentIDs: number[] // All content IDs on page (dynamic + component)
  contentID: number   // Specific component for interaction events
  locale: string      // e.g., "en-us", "fr-ca"
}
```

### Key Events

| Event | Properties | Use Case |
|-------|------------|----------|
| `$pageview` | `pageID`, `contentIDs`, `locale`, `audience`, `region` | Page traffic |
| `scroll_milestone` | `depth` (25/50/75/100), `timeToReach`, `pageID`, `contentIDs` | Scroll engagement |
| `time_milestone` | `seconds` (30/60/120/300), `pageID`, `contentIDs` | Time engagement |
| `outbound_link_clicked` | `url`, `text`, `pageID`, `contentID` | Link clicks |
| `personalization_applied` | `audience`, `region`, `component`, `contentID` | Personalization |
| `experiment_exposure` | `experimentKey`, `variant`, `contentID` | A/B test exposure |

---

## 1. Dashboard App

### App Definition Update

Add to `public/.well-known/agility-app.json`:

```json
{
  "capabilities": {
    "dashboard": {
      "description": "PostHog Analytics Dashboard",
      "defaultPath": "/dashboard"
    },
    "contentItemSidebar": {
      "description": "Analytics and A/B Testing"
    },
    "pageSidebar": {
      "description": "Page Analytics"
    },
    "installScreen": false
  }
}
```

### Create Dashboard Page

Create `src/app/dashboard/page.tsx`:

```tsx
"use client"

import { useAgilityAppSDK } from "@agility/app-sdk"
import { useEffect, useState, useMemo } from "react"

// Components to create:
// - PageViewsChart (line chart of $pageview over time)
// - TopPagesTable (pageID with most views, resolve to page names)
// - EngagementFunnel (pageview → scroll 50% → time 60s)
// - LocaleDistribution (pie chart by locale)
// - WebVitalsCard (LCP, CLS, FID averages)

export default function DashboardPage() {
  const { appInstallContext, initializing } = useAgilityAppSDK()

  const postHogAPIKey = useMemo(() =>
    appInstallContext?.configuration?.POSTHOG_API_KEY || null,
    [appInstallContext?.configuration?.POSTHOG_API_KEY]
  )

  const postHogProjectId = useMemo(() =>
    appInstallContext?.configuration?.POSTHOG_PROJECT_ID || null,
    [appInstallContext?.configuration?.POSTHOG_PROJECT_ID]
  )

  // Fetch and display dashboard data...
}
```

### PostHog HogQL Queries

**Page Views Over Time:**
```sql
SELECT
  toDate(timestamp) as date,
  count() as views
FROM events
WHERE event = '$pageview'
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY date
ORDER BY date
```

**Top Pages by Traffic:**
```sql
SELECT
  properties.pageID as pageID,
  count() as views
FROM events
WHERE event = '$pageview'
  AND properties.pageID IS NOT NULL
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY pageID
ORDER BY views DESC
LIMIT 10
```

**Engagement Funnel:**
```sql
-- Use PostHog Funnel API instead of raw HogQL
POST /api/projects/{project_id}/insights/funnel
{
  "events": [
    {"id": "$pageview", "name": "Page View"},
    {"id": "scroll_milestone", "name": "Scrolled 50%", "properties": [{"key": "depth", "value": 50}]},
    {"id": "time_milestone", "name": "60s on Page", "properties": [{"key": "seconds", "value": 60}]}
  ],
  "date_from": "-30d"
}
```

**Locale Distribution:**
```sql
SELECT
  properties.locale as locale,
  count() as views
FROM events
WHERE event = '$pageview'
  AND properties.locale IS NOT NULL
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY locale
```

### Dashboard UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  PostHog Analytics Dashboard                        [Last 30 Days ▼]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐│
│  │ Total Views  │ │ Unique Pages │ │ Avg Time     │ │ Avg Scroll  ││
│  │   12,450     │ │     45       │ │   2m 34s     │ │    68%      ││
│  │   ↑ 12%      │ │   ─ 0%      │ │   ↓ 5%       │ │   ↑ 3%      ││
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘│
│                                                                     │
│  ┌─────────────────────────────────┐ ┌─────────────────────────────┐│
│  │ Page Views Over Time            │ │ Top Pages                   ││
│  │ [Line Chart]                    │ │ 1. /home (3,200)            ││
│  │                                 │ │ 2. /pricing (2,100)         ││
│  │                                 │ │ 3. /about-us (1,800)        ││
│  │                                 │ │ 4. /blog (1,500)            ││
│  └─────────────────────────────────┘ └─────────────────────────────┘│
│                                                                     │
│  ┌─────────────────────────────────┐ ┌─────────────────────────────┐│
│  │ Engagement Funnel               │ │ Locale Distribution         ││
│  │ Page View    ████████████ 100%  │ │ [Pie Chart]                 ││
│  │ Scroll 50%   ████████░░░░  72%  │ │   en-us: 65%                ││
│  │ Time 60s     █████░░░░░░░  45%  │ │   fr-ca: 20%                ││
│  │                                 │ │   de-de: 15%                ││
│  └─────────────────────────────────┘ └─────────────────────────────┘│
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ Web Vitals                                                      ││
│  │ LCP: 2.1s (Good)   CLS: 0.05 (Good)   FID: 45ms (Good)         ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Page Sidebar

### Create Page Sidebar Route

Create `src/app/page-sidebar/page.tsx`:

```tsx
"use client"

import { useAgilityAppSDK } from "@agility/app-sdk"
import { useEffect, useState, useMemo } from "react"

// The page context provides the current pageID
export default function PageSidebarPage() {
  const { appInstallContext, page, initializing } = useAgilityAppSDK()

  // page.pageID is the Agility CMS page ID
  const pageID = page?.pageID

  const postHogAPIKey = useMemo(() =>
    appInstallContext?.configuration?.POSTHOG_API_KEY || null,
    [appInstallContext?.configuration?.POSTHOG_API_KEY]
  )

  const postHogProjectId = useMemo(() =>
    appInstallContext?.configuration?.POSTHOG_PROJECT_ID || null,
    [appInstallContext?.configuration?.POSTHOG_PROJECT_ID]
  )

  // Fetch analytics for this specific pageID
}
```

### PostHog Queries for Page

**Page Views for Specific Page:**
```sql
SELECT count() as views
FROM events
WHERE event = '$pageview'
  AND properties.pageID = {pageID}
  AND timestamp > now() - INTERVAL 30 DAY
```

**Scroll Depth Distribution:**
```sql
SELECT
  properties.depth as depth,
  count() as count
FROM events
WHERE event = 'scroll_milestone'
  AND properties.pageID = {pageID}
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY depth
ORDER BY depth
```

**Time on Page Distribution:**
```sql
SELECT
  properties.seconds as seconds,
  count() as count
FROM events
WHERE event = 'time_milestone'
  AND properties.pageID = {pageID}
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY seconds
ORDER BY seconds
```

**Referrer Sources:**
```sql
SELECT
  properties.referrer as referrer,
  count() as count
FROM events
WHERE event = '$pageview'
  AND properties.pageID = {pageID}
  AND properties.referrer IS NOT NULL
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY referrer
ORDER BY count DESC
LIMIT 5
```

### Page Sidebar UI

```
┌─────────────────────────────────────┐
│ Page Analytics (Last 30 Days)       │
├─────────────────────────────────────┤
│ Views: 2,450          ↑ 12%         │
│ Avg Time: 2m 34s      ↓ 5%          │
│ Avg Scroll: 68%       ─ 0%          │
│                                     │
│ Scroll Distribution                 │
│ 25% ████████████████████ 95%        │
│ 50% ██████████████░░░░░░ 72%        │
│ 75% ████████░░░░░░░░░░░░ 45%        │
│ 100% ████░░░░░░░░░░░░░░░ 23%        │
│                                     │
│ Time Milestones                     │
│ 30s  ████████████████████ 85%       │
│ 60s  ██████████████░░░░░░ 62%       │
│ 120s ████████░░░░░░░░░░░░ 38%       │
│ 300s ███░░░░░░░░░░░░░░░░░ 15%       │
│                                     │
│ Top Referrers                       │
│ 1. google.com (45%)                 │
│ 2. direct (30%)                     │
│ 3. linkedin.com (15%)               │
│                                     │
│ [View in PostHog →]                 │
└─────────────────────────────────────┘
```

---

## 3. Content Item Sidebar (Enhanced)

The existing content item sidebar shows A/B test experiment info. Enhance it with a tabbed interface:

### Tabbed Interface Design

```
┌─────────────────────────────────────┐
│ ┌──────────┐ ┌──────────────┐       │
│ │ Analytics│ │ A/B Testing  │       │
│ └──────────┘ └──────────────┘       │
├─────────────────────────────────────┤
│                                     │
│  [Tab Content Area]                 │
│                                     │
└─────────────────────────────────────┘
```

### Update Content Item Sidebar

Update `src/app/content-item-sidebar/page.tsx`:

```tsx
"use client"

import { useAgilityAppSDK, contentItemMethods } from "@agility/app-sdk"
import { useEffect, useMemo, useState } from "react"
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import clsx from 'clsx'

import { PostHogSidebar } from "@/components/PostHogSidebar"
import { ContentAnalytics } from "@/components/ContentAnalytics"
import Loader from "@/components/Loader"
import { IAgilityContentItem } from "@/types/IAgilityContentItem"

const Page = () => {
  const { appInstallContext, contentItem, initializing } = useAgilityAppSDK()
  const item = contentItem as IAgilityContentItem | null

  const [experimentKey, setExperimentKey] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState(0)

  const postHogAPIKey = useMemo(() =>
    appInstallContext?.configuration?.POSTHOG_API_KEY || null,
    [appInstallContext?.configuration?.POSTHOG_API_KEY]
  )

  const postHogProjectId = useMemo(() =>
    appInstallContext?.configuration?.POSTHOG_PROJECT_ID || null,
    [appInstallContext?.configuration?.POSTHOG_PROJECT_ID]
  )

  // Content ID from the current item
  const contentID = item?.contentID

  useEffect(() => {
    const currentExperimentKey = item?.values?.ExperimentKey
    setExperimentKey(currentExperimentKey || null)

    contentItemMethods.addFieldListener({
      fieldName: "ExperimentKey",
      onChange: (value) => setExperimentKey(value || null)
    })

    return () => {
      contentItemMethods.removeFieldListener({ fieldName: "ExperimentKey" })
    }
  }, [item?.values?.ExperimentKey])

  if (initializing) return <Loader />

  const hasExperiment = !!experimentKey

  return (
    <html>
      <head><title>Content Item Sidebar</title></head>
      <body className="p-4">
        <TabGroup selectedIndex={selectedTab} onChange={setSelectedTab}>
          <TabList className="flex space-x-1 rounded-lg bg-gray-100 p-1 mb-4">
            <Tab className={({ selected }) => clsx(
              'w-full rounded-md py-2 text-sm font-medium leading-5',
              'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-blue-400 ring-white ring-opacity-60',
              selected
                ? 'bg-white shadow text-blue-700'
                : 'text-gray-600 hover:bg-white/[0.5] hover:text-gray-800'
            )}>
              Analytics
            </Tab>
            <Tab className={({ selected }) => clsx(
              'w-full rounded-md py-2 text-sm font-medium leading-5',
              'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-blue-400 ring-white ring-opacity-60',
              selected
                ? 'bg-white shadow text-blue-700'
                : 'text-gray-600 hover:bg-white/[0.5] hover:text-gray-800',
              !hasExperiment && 'opacity-50'
            )}>
              A/B Testing
              {hasExperiment && (
                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              )}
            </Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <ContentAnalytics
                contentID={contentID}
                postHogAPIKey={postHogAPIKey}
                postHogProjectId={postHogProjectId}
              />
            </TabPanel>
            <TabPanel>
              {hasExperiment ? (
                <PostHogSidebar
                  experimentKey={experimentKey}
                  postHogAPIKey={postHogAPIKey}
                  postHogProjectId={postHogProjectId}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No A/B test configured for this content item.</p>
                  <p className="text-sm mt-2">
                    Add an "ExperimentKey" field to enable A/B testing.
                  </p>
                </div>
              )}
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </body>
    </html>
  )
}

export default Page
```

### Create Content Analytics Component

Create `src/components/ContentAnalytics.tsx`:

```tsx
"use client"

import { useState, useEffect } from 'react'
import { PostHogLoader } from './PostHogLoader'

interface ContentAnalyticsProps {
  contentID?: number
  postHogAPIKey: string | null
  postHogProjectId: string | null
}

interface ContentStats {
  impressions: number
  uniquePages: number
  avgScrollDepth: number
  avgTimeOnPage: number
  ctaClicks: number
  pages: Array<{ pageID: number; views: number; pageName?: string }>
}

export function ContentAnalytics({
  contentID,
  postHogAPIKey,
  postHogProjectId
}: ContentAnalyticsProps) {
  const [stats, setStats] = useState<ContentStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!contentID || !postHogAPIKey || !postHogProjectId) {
      return
    }

    const fetchStats = async () => {
      setLoading(true)
      setError(null)

      try {
        // Query 1: Count impressions (pageviews where contentIDs contains this ID)
        const impressionsQuery = await runHogQLQuery(postHogAPIKey, postHogProjectId, `
          SELECT count() as impressions
          FROM events
          WHERE event = '$pageview'
            AND has(properties.contentIDs, ${contentID})
            AND timestamp > now() - INTERVAL 30 DAY
        `)

        // Query 2: Unique pages this content appears on
        const pagesQuery = await runHogQLQuery(postHogAPIKey, postHogProjectId, `
          SELECT
            properties.pageID as pageID,
            count() as views
          FROM events
          WHERE event = '$pageview'
            AND has(properties.contentIDs, ${contentID})
            AND timestamp > now() - INTERVAL 30 DAY
          GROUP BY pageID
          ORDER BY views DESC
          LIMIT 5
        `)

        // Query 3: Average scroll depth on pages with this content
        const scrollQuery = await runHogQLQuery(postHogAPIKey, postHogProjectId, `
          SELECT avg(properties.depth) as avgDepth
          FROM events
          WHERE event = 'scroll_milestone'
            AND has(properties.contentIDs, ${contentID})
            AND timestamp > now() - INTERVAL 30 DAY
        `)

        // Query 4: CTA clicks within this component
        const ctaQuery = await runHogQLQuery(postHogAPIKey, postHogProjectId, `
          SELECT count() as clicks
          FROM events
          WHERE event = 'outbound_link_clicked'
            AND properties.contentID = ${contentID}
            AND timestamp > now() - INTERVAL 30 DAY
        `)

        setStats({
          impressions: impressionsQuery.results?.[0]?.[0] || 0,
          uniquePages: pagesQuery.results?.length || 0,
          avgScrollDepth: Math.round(scrollQuery.results?.[0]?.[0] || 0),
          avgTimeOnPage: 0, // Calculate from time_milestone events
          ctaClicks: ctaQuery.results?.[0]?.[0] || 0,
          pages: pagesQuery.results?.map((row: any) => ({
            pageID: row[0],
            views: row[1]
          })) || []
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [contentID, postHogAPIKey, postHogProjectId])

  if (!contentID) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Save this content item to view analytics.</p>
      </div>
    )
  }

  if (loading) {
    return <PostHogLoader title="Loading Analytics" message="Fetching data from PostHog..." />
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-3">
        <p className="text-red-800 text-sm">{error}</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No analytics data available yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-gray-500 uppercase text-xs font-semibold">
        Content Analytics (Last 30 Days)
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-900">
            {stats.impressions.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">Impressions</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-900">
            {stats.uniquePages}
          </div>
          <div className="text-xs text-gray-500">Pages Using</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-900">
            {stats.avgScrollDepth}%
          </div>
          <div className="text-xs text-gray-500">Avg Scroll</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-900">
            {stats.ctaClicks}
          </div>
          <div className="text-xs text-gray-500">CTA Clicks</div>
        </div>
      </div>

      {/* Pages List */}
      {stats.pages.length > 0 && (
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">
            Pages Using This Content
          </div>
          <div className="space-y-2">
            {stats.pages.map((page) => (
              <div
                key={page.pageID}
                className="flex justify-between items-center text-sm"
              >
                <span className="text-gray-600">
                  Page #{page.pageID}
                </span>
                <span className="text-gray-900 font-medium">
                  {page.views.toLocaleString()} views
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View in PostHog Link */}
      {postHogProjectId && (
        <a
          href={`https://app.posthog.com/project/${postHogProjectId}/events?properties=[{"key":"contentIDs","value":${contentID},"operator":"icontains"}]`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-3 py-2 text-sm font-medium bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors w-full justify-center"
        >
          View in PostHog →
        </a>
      )}
    </div>
  )
}

// Helper function for HogQL queries
async function runHogQLQuery(
  apiKey: string,
  projectId: string,
  query: string
): Promise<any> {
  const response = await fetch(
    `https://app.posthog.com/api/projects/${projectId}/query/`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: {
          kind: 'HogQLQuery',
          query: query.trim()
        }
      })
    }
  )

  if (!response.ok) {
    throw new Error(`PostHog API error: ${response.status}`)
  }

  return response.json()
}
```

---

## PostHog API Reference

### Authentication

All requests require the `Authorization: Bearer {POSTHOG_API_KEY}` header.

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects/{id}/query/` | POST | Run HogQL queries |
| `/api/projects/{id}/insights/` | GET/POST | Saved insights |
| `/api/projects/{id}/insights/trend/` | POST | Trend queries |
| `/api/projects/{id}/insights/funnel/` | POST | Funnel queries |
| `/api/projects/{id}/experiments/` | GET/POST | A/B experiments |

### HogQL Query Example

```typescript
const response = await fetch(
  `https://app.posthog.com/api/projects/${projectId}/query/`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query: `
          SELECT count() as views
          FROM events
          WHERE event = '$pageview'
            AND properties.pageID = 123
            AND timestamp > now() - INTERVAL 30 DAY
        `
      }
    })
  }
)
```

### Checking if contentIDs Array Contains a Value

Use HogQL's `has()` function:

```sql
SELECT count()
FROM events
WHERE has(properties.contentIDs, 456)
```

---

## File Structure

```
src/
├── app/
│   ├── page.tsx                    # Home/info page
│   ├── dashboard/
│   │   └── page.tsx                # NEW: Dashboard app
│   ├── page-sidebar/
│   │   └── page.tsx                # NEW: Page sidebar
│   └── content-item-sidebar/
│       └── page.tsx                # ENHANCED: Tabbed interface
├── components/
│   ├── ContentAnalytics.tsx        # NEW: Content analytics tab
│   ├── PageAnalytics.tsx           # NEW: Page sidebar content
│   ├── DashboardCharts.tsx         # NEW: Dashboard visualizations
│   ├── PostHogSidebar.tsx          # Existing: A/B test display
│   ├── CreateExperiment.tsx        # Existing: Create A/B test
│   └── ...
└── lib/
    └── posthog.ts                  # NEW: Shared PostHog API utilities
```

---

## Implementation Order

1. **Create shared PostHog utilities** (`src/lib/posthog.ts`)
   - HogQL query runner
   - Common API calls
   - Type definitions

2. **Implement Content Analytics component** (`src/components/ContentAnalytics.tsx`)
   - Basic stats display
   - Pages list
   - Error handling

3. **Update Content Item Sidebar** (`src/app/content-item-sidebar/page.tsx`)
   - Add HeadlessUI tabs
   - Integrate ContentAnalytics
   - Keep existing A/B testing functionality

4. **Implement Page Sidebar** (`src/app/page-sidebar/page.tsx`)
   - Page-specific analytics
   - Scroll/time distributions
   - Referrer breakdown

5. **Implement Dashboard** (`src/app/dashboard/page.tsx`)
   - Overview stats cards
   - Charts (using recharts - already installed)
   - Top pages table
   - Engagement funnel

6. **Update app definition** (`public/.well-known/agility-app.json`)
   - Add new capabilities
   - Update description

---

## Dependencies to Add

The project already has `recharts` installed for charts. You may want to add:

```bash
# For better data fetching
yarn add swr

# HeadlessUI is already a dependency
```

---

## Testing

### Test Analytics Tab
1. Open any content item in Agility CMS
2. Verify the Analytics tab shows stats
3. Verify "View in PostHog" link works

### Test A/B Testing Tab
1. Open a content item with an ExperimentKey field
2. Verify the A/B Testing tab shows experiment details
3. Create a new experiment and verify it appears

### Test Page Sidebar
1. Open any page in Agility CMS
2. Verify the sidebar shows page analytics
3. Verify scroll/time distributions are accurate

### Test Dashboard
1. Open the dashboard from the app menu
2. Verify all charts load
3. Verify top pages list is accurate
