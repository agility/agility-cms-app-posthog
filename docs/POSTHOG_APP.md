# PostHog Analytics & A/B Testing App

This app integrates PostHog analytics and A/B testing directly into the Agility CMS content editor, giving content teams visibility into how their content performs and how experiments are progressing—without leaving the CMS.

## Overview

The PostHog app provides three surfaces:

### Dashboard

A site-wide analytics dashboard displayed in the main dashboard area with:

| Widget | Description |
|--------|-------------|
| **Summary Stats** | Total page views, unique visitors, avg scroll depth, avg time on page |
| **Page Views Trend** | Daily page views chart with configurable date range |
| **Top Pages** | Most visited pages with view counts |
| **Engagement Metrics** | Scroll depth and time on page distributions |
| **Top Referrers** | Traffic sources ranked by volume |
| **Locale Distribution** | Breakdown by language/locale |

### Content Item Sidebar

A tabbed interface for content items with:

| Tab | Features |
|-----|----------|
| **Analytics** | Content impressions, scroll depth, time on page, CTA clicks, pages using this content |
| **A/B Testing** | Experiment status, variant performance, statistical significance, live results |

### Page Sidebar

Analytics for the currently selected page:

| Metric | Description |
|--------|-------------|
| **Page Views** | Total views for this page |
| **Unique Visitors** | Distinct users who viewed the page |
| **Avg Scroll Depth** | How far users scroll on this page |
| **Avg Time on Page** | How long users spend on this page |
| **Scroll Distribution** | Breakdown by 25%, 50%, 75%, 100% |
| **Time Distribution** | Breakdown by 30s, 60s, 2m, 5m |
| **Top Referrers** | Where traffic comes from |
| **UTM Sources** | Campaign tracking sources |

## Installation

### 1. Register the App

In Agility CMS, go to **Settings → Apps → Install App** and enter the app URL:

```
https://your-posthog-app-url.com
```

The app manifest is served at `/.well-known/agility-app.json`.

### 2. Configure PostHog Credentials

After installation, configure the app with your PostHog credentials:

| Setting | Description | Where to Find |
|---------|-------------|---------------|
| `POSTHOG_API_KEY` | Personal API key (Bearer token) | PostHog → Settings → Personal API Keys |
| `POSTHOG_PROJECT_ID` | Your project identifier | PostHog → Settings → Project → Project ID |

**Note:** The API key needs read access to experiments and the ability to run HogQL queries.

### 3. Enable App Surfaces

- **Dashboard** - Available in the main dashboard section for site-wide analytics
- **Content Item Sidebar** - Add to content models for content analytics and A/B testing
- **Page Sidebar** - Add to pages for page-level analytics

---

## Frontend Implementation

> **Framework Note:** While the examples below use Next.js with React, the concepts apply to any frontend framework (Vue, Nuxt, SvelteKit, Astro, vanilla JavaScript, etc.). The key is sending the correct event properties to PostHog—how you structure your components and track events is flexible.

For the analytics and A/B testing data to appear in the CMS sidebar, your frontend site must track the appropriate events with specific properties.

### Required Event Properties

All events should include these Agility CMS properties:

```typescript
interface AgilityEventProperties {
  pageID: number;        // Agility CMS page ID (from data-agility-page attribute)
  contentIDs: number[];  // Array of all content IDs rendered on the page
  contentID?: number;    // Specific content ID for component-level interactions
  locale: string;        // Language code, e.g., "en-us"
}
```

### Events Required for Analytics

| Event | Properties | Purpose |
|-------|------------|---------|
| `$pageview` | `pageID`, `contentIDs`, `locale` | Content impressions & page views |
| `scroll_milestone` | `depth`, `pageID`, `contentIDs`, `locale` | Scroll tracking |
| `time_milestone` | `seconds`, `pageID`, `contentIDs`, `locale` | Time on page |
| `outbound_link_clicked` | `contentID`, `url`, `text`, `locale` | CTA/link clicks |

---

## Next.js Implementation Guide

### Step 1: Install PostHog

```bash
npm install posthog-js
# or
yarn add posthog-js
```

### Step 2: Environment Variables

Add your PostHog credentials to `.env.local`:

```env
NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### Step 3: Initialize PostHog (Option A - Instrumentation File)

For Next.js 15+, use the instrumentation file for early initialization:

```typescript
// src/instrumentation-client.ts
import posthog from 'posthog-js'

declare global {
  interface Window {
    posthog?: typeof posthog
  }
}

const postHogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
const postHogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST

if (postHogKey && postHogHost) {
  posthog.init(postHogKey, {
    api_host: postHogHost,
    capture_pageview: false, // We'll handle this manually with CMS context
    capture_pageleave: true,
  })
  // Expose on window for provider access
  window.posthog = posthog
}
```

### Step 3: Initialize PostHog (Option B - Provider Pattern)

Create a provider component that initializes PostHog and provides helper functions:

```tsx
// src/components/providers/PostHogProvider.tsx
"use client"

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { createContext, useContext, ReactNode } from 'react'

// Initialize PostHog on the client
if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    capture_pageview: false, // We'll handle this manually with CMS context
    capture_pageleave: true,
  })
}

// Context for Agility-specific tracking
interface AgilityTrackingContextType {
  trackPageView: (pageID: number, contentIDs: number[], locale: string) => void
  trackScrollMilestone: (depth: number, pageID: number, contentIDs: number[], locale: string) => void
  trackTimeMilestone: (seconds: number, pageID: number, contentIDs: number[], locale: string) => void
  trackOutboundClick: (contentID: number, url: string, text: string, locale: string) => void
}

const AgilityTrackingContext = createContext<AgilityTrackingContextType | null>(null)

export function useAgilityTracking() {
  const context = useContext(AgilityTrackingContext)
  if (!context) {
    throw new Error('useAgilityTracking must be used within PostHogProvider')
  }
  return context
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  // Tracking functions that include Agility-specific properties
  const trackingFunctions: AgilityTrackingContextType = {
    trackPageView: (pageID, contentIDs, locale) => {
      posthog.capture('$pageview', {
        pageID,
        contentIDs,
        locale,
        $current_url: window.location.href,
      })
    },

    trackScrollMilestone: (depth, pageID, contentIDs, locale) => {
      posthog.capture('scroll_milestone', {
        depth,
        pageID,
        contentIDs,
        locale,
      })
    },

    trackTimeMilestone: (seconds, pageID, contentIDs, locale) => {
      posthog.capture('time_milestone', {
        seconds,
        pageID,
        contentIDs,
        locale,
      })
    },

    trackOutboundClick: (contentID, url, text, locale) => {
      posthog.capture('outbound_link_clicked', {
        contentID,
        url,
        text,
        locale,
      })
    },
  }

  return (
    <PHProvider client={posthog}>
      <AgilityTrackingContext.Provider value={trackingFunctions}>
        {children}
      </AgilityTrackingContext.Provider>
    </PHProvider>
  )
}
```

### Production-Ready: Event Queuing Pattern

PostHog may not be ready when your app starts. Use a provider abstraction that queues events and flushes them when PostHog loads:

```typescript
// src/lib/analytics/posthog-provider.ts
import posthog from 'posthog-js'

interface QueuedEvent {
  type: 'page' | 'track'
  name?: string
  event?: string
  properties?: Record<string, any>
}

// Check if PostHog is loaded and ready
function getPostHog() {
  if (typeof window === 'undefined') return null
  const ph = (window as any).posthog
  return ph?.__loaded ? ph : null
}

// Queue events that arrive before PostHog is ready
const eventQueue: QueuedEvent[] = []
let flushScheduled = false

function waitForPostHogAndFlush() {
  if (flushScheduled) return
  flushScheduled = true

  const checkAndFlush = () => {
    const ph = getPostHog()
    if (ph) {
      // Flush all queued events
      while (eventQueue.length > 0) {
        const event = eventQueue.shift()!
        if (event.type === 'page') {
          ph.capture('$pageview', event.properties)
        } else if (event.type === 'track' && event.event) {
          ph.capture(event.event, event.properties)
        }
      }
      flushScheduled = false
    } else {
      // Check again in 100ms
      setTimeout(checkAndFlush, 100)
    }
  }

  checkAndFlush()
}

export const analytics = {
  page(properties: { pageID: number; contentIDs: number[]; locale: string; path: string; title: string }) {
    const ph = getPostHog()
    const eventProps = {
      $current_url: typeof window !== 'undefined' ? window.location.href : '',
      $pathname: properties.path,
      $title: properties.title,
      locale: properties.locale,
      pageID: properties.pageID,
      contentIDs: properties.contentIDs,
    }

    if (!ph) {
      eventQueue.push({ type: 'page', properties: eventProps })
      waitForPostHogAndFlush()
      return
    }

    ph.capture('$pageview', eventProps)
  },

  track(event: string, properties?: Record<string, any>) {
    const ph = getPostHog()
    if (!ph) {
      eventQueue.push({ type: 'track', event, properties })
      waitForPostHogAndFlush()
      return
    }
    ph.capture(event, properties)
  },

  isReady(): boolean {
    return getPostHog() !== null
  }
}
```

### Step 3: Add Provider to Layout

```tsx
// src/app/layout.tsx
import { PostHogProvider } from '@/components/providers/PostHogProvider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}
```

### Step 4: Create the Page Tracker Component

This component handles pageview tracking and collects all content IDs from the page:

```tsx
// src/components/tracking/PageTracker.tsx
"use client"

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAgilityTracking } from '@/components/providers/PostHogProvider'

interface PageTrackerProps {
  pageID: number
  locale: string
}

export function PageTracker({ pageID, locale }: PageTrackerProps) {
  const { trackPageView } = useAgilityTracking()
  const pathname = usePathname()
  const hasTracked = useRef(false)

  useEffect(() => {
    // Reset tracking flag on route change
    hasTracked.current = false
  }, [pathname])

  useEffect(() => {
    if (hasTracked.current) return
    hasTracked.current = true

    // Collect all content IDs from the page
    // Components should have data-agility-component={contentID} attribute
    const contentElements = document.querySelectorAll('[data-agility-component]')
    const contentIDs = Array.from(contentElements)
      .map(el => parseInt(el.getAttribute('data-agility-component') || '0', 10))
      .filter(id => id > 0)

    // Track the pageview with all content IDs
    trackPageView(pageID, contentIDs, locale)
  }, [pageID, locale, pathname, trackPageView])

  return null
}
```

### Step 5: Create the Scroll Tracker Component

```tsx
// src/components/tracking/ScrollTracker.tsx
"use client"

import { useEffect, useRef } from 'react'
import { useAgilityTracking } from '@/components/providers/PostHogProvider'

interface ScrollTrackerProps {
  pageID: number
  locale: string
}

// Milestones to track (percentages)
const SCROLL_MILESTONES = [25, 50, 75, 100]

export function ScrollTracker({ pageID, locale }: ScrollTrackerProps) {
  const { trackScrollMilestone } = useAgilityTracking()
  const trackedMilestones = useRef<Set<number>>(new Set())

  useEffect(() => {
    // Reset on mount
    trackedMilestones.current = new Set()

    const handleScroll = () => {
      // Calculate scroll percentage
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0

      // Get content IDs currently on page
      const contentElements = document.querySelectorAll('[data-agility-component]')
      const contentIDs = Array.from(contentElements)
        .map(el => parseInt(el.getAttribute('data-agility-component') || '0', 10))
        .filter(id => id > 0)

      // Track milestones
      SCROLL_MILESTONES.forEach(milestone => {
        if (scrollPercent >= milestone && !trackedMilestones.current.has(milestone)) {
          trackedMilestones.current.add(milestone)
          trackScrollMilestone(milestone, pageID, contentIDs, locale)
        }
      })
    }

    // Throttle scroll handler for performance
    let ticking = false
    const throttledScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll()
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', throttledScroll, { passive: true })
    return () => window.removeEventListener('scroll', throttledScroll)
  }, [pageID, locale, trackScrollMilestone])

  return null
}
```

### Step 6: Create the Time Tracker Component

```tsx
// src/components/tracking/TimeTracker.tsx
"use client"

import { useEffect, useRef } from 'react'
import { useAgilityTracking } from '@/components/providers/PostHogProvider'

interface TimeTrackerProps {
  pageID: number
  locale: string
}

// Time milestones to track (in seconds)
const TIME_MILESTONES = [30, 60, 120, 300] // 30s, 1m, 2m, 5m

export function TimeTracker({ pageID, locale }: TimeTrackerProps) {
  const { trackTimeMilestone } = useAgilityTracking()
  const trackedMilestones = useRef<Set<number>>(new Set())
  const startTime = useRef<number>(Date.now())

  useEffect(() => {
    // Reset on mount
    trackedMilestones.current = new Set()
    startTime.current = Date.now()

    const checkMilestones = () => {
      const elapsedSeconds = Math.floor((Date.now() - startTime.current) / 1000)

      // Get content IDs currently on page
      const contentElements = document.querySelectorAll('[data-agility-component]')
      const contentIDs = Array.from(contentElements)
        .map(el => parseInt(el.getAttribute('data-agility-component') || '0', 10))
        .filter(id => id > 0)

      // Track milestones
      TIME_MILESTONES.forEach(milestone => {
        if (elapsedSeconds >= milestone && !trackedMilestones.current.has(milestone)) {
          trackedMilestones.current.add(milestone)
          trackTimeMilestone(milestone, pageID, contentIDs, locale)
        }
      })
    }

    // Check every 5 seconds
    const interval = setInterval(checkMilestones, 5000)
    return () => clearInterval(interval)
  }, [pageID, locale, trackTimeMilestone])

  return null
}
```

### Step 7: Create the Outbound Link Tracker

```tsx
// src/components/tracking/OutboundLinkTracker.tsx
"use client"

import { useEffect } from 'react'
import { useAgilityTracking } from '@/components/providers/PostHogProvider'

interface OutboundLinkTrackerProps {
  locale: string
}

export function OutboundLinkTracker({ locale }: OutboundLinkTrackerProps) {
  const { trackOutboundClick } = useAgilityTracking()

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const link = target.closest('a')

      if (!link) return

      // Check if it's an outbound link
      const href = link.getAttribute('href')
      if (!href || !href.startsWith('http')) return

      // Check if it's external
      const linkUrl = new URL(href)
      if (linkUrl.hostname === window.location.hostname) return

      // Find the parent component's content ID
      const componentEl = link.closest('[data-agility-component]')
      const contentID = componentEl
        ? parseInt(componentEl.getAttribute('data-agility-component') || '0', 10)
        : 0

      if (contentID > 0) {
        trackOutboundClick(
          contentID,
          href,
          link.textContent?.trim() || '',
          locale
        )
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [locale, trackOutboundClick])

  return null
}
```

### Step 8: Add Trackers to Your Page Layout

```tsx
// src/components/layout/AgilityPageLayout.tsx
import { PageTracker } from '@/components/tracking/PageTracker'
import { ScrollTracker } from '@/components/tracking/ScrollTracker'
import { TimeTracker } from '@/components/tracking/TimeTracker'
import { OutboundLinkTracker } from '@/components/tracking/OutboundLinkTracker'

interface AgilityPageLayoutProps {
  pageID: number
  locale: string
  children: React.ReactNode
}

export function AgilityPageLayout({ pageID, locale, children }: AgilityPageLayoutProps) {
  return (
    <main data-agility-page={pageID}>
      {/* Analytics Trackers */}
      <PageTracker pageID={pageID} locale={locale} />
      <ScrollTracker pageID={pageID} locale={locale} />
      <TimeTracker pageID={pageID} locale={locale} />
      <OutboundLinkTracker locale={locale} />

      {/* Page Content */}
      {children}
    </main>
  )
}
```

### Step 9: Mark Your Components with Content IDs

Every component that renders content from Agility CMS should include the `data-agility-component` attribute:

```tsx
// Example: A Hero component
interface HeroProps {
  contentID: number
  title: string
  description: string
  ctaUrl: string
  ctaText: string
}

export function Hero({ contentID, title, description, ctaUrl, ctaText }: HeroProps) {
  return (
    <section data-agility-component={contentID} className="hero">
      <h1>{title}</h1>
      <p>{description}</p>
      <a href={ctaUrl}>{ctaText}</a>
    </section>
  )
}
```

### Step 10: Complete Page Example

```tsx
// src/app/[...slug]/page.tsx
import { getPage, getPageModules } from '@/lib/agility'
import { AgilityPageLayout } from '@/components/layout/AgilityPageLayout'
import { ModuleRenderer } from '@/components/ModuleRenderer'

interface PageProps {
  params: { slug: string[] }
}

export default async function Page({ params }: PageProps) {
  const locale = 'en-us'
  const slug = '/' + (params.slug?.join('/') || '')

  // Fetch page data from Agility CMS
  const page = await getPage({ path: slug, locale })
  const modules = await getPageModules({ pageID: page.pageID, locale })

  return (
    <AgilityPageLayout pageID={page.pageID} locale={locale}>
      {modules.map((module) => (
        <ModuleRenderer
          key={module.contentID}
          module={module}
          locale={locale}
        />
      ))}
    </AgilityPageLayout>
  )
}
```

---

## Production Implementation Notes

### Event Batching

PostHog batches events and sends them periodically (~30 seconds) or on page unload. Events won't appear instantly in the Network tab during development. Use PostHog's Live Events view to verify tracking is working.

### Bot Detection

PostHog filters bot traffic by default. Automated testing environments (Playwright, Puppeteer, Chrome DevTools Protocol) may trigger bot detection because `navigator.webdriver = true`. Events won't be sent in these environments, which is typically the desired behavior.

### Container Component Pattern

When building reusable wrapper components, ensure they pass through data attributes so content ID tracking works:

```tsx
// src/components/Container.tsx
import clsx from 'clsx'

export function Container({
  className,
  children,
  ...props  // This spreads data-agility-component and other attributes
}: {
  className?: string
  children: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx(className, 'px-6 lg:px-8')} {...props}>
      <div className="mx-auto max-w-2xl lg:max-w-7xl">{children}</div>
    </div>
  )
}

// Usage - data attribute is passed through to the outer div
<Container data-agility-component={contentID}>
  <HeroContent />
</Container>
```

### Extracting CMS Context from DOM

Create a utility to extract Agility context from data attributes:

```typescript
// src/lib/agility-context.ts
export interface AgilityContext {
  pageID?: number
  contentIDs: number[]
}

export function getAgilityContext(): AgilityContext {
  if (typeof document === 'undefined') {
    return { contentIDs: [] }
  }

  const contentIDs: number[] = []

  // Find page ID from layout
  const pageElement = document.querySelector('[data-agility-page]')
  const pageID = pageElement?.getAttribute('data-agility-page')

  // Find all component content IDs
  document.querySelectorAll('[data-agility-component]').forEach((el) => {
    const id = parseInt(el.getAttribute('data-agility-component') || '', 10)
    if (!isNaN(id) && !contentIDs.includes(id)) {
      contentIDs.push(id)
    }
  })

  return {
    pageID: pageID ? parseInt(pageID, 10) : undefined,
    contentIDs
  }
}
```

---

## A/B Testing Implementation

### Step 1: Add PostHog Feature Flags

Ensure your PostHog provider has feature flags enabled:

```tsx
// In PostHogProvider.tsx, PostHog already handles feature flags
// Just make sure you're using the React SDK
import { useFeatureFlagVariantKey } from 'posthog-js/react'
```

### Step 2: Create an A/B Test Component with Flicker Prevention

Use skeleton loaders while waiting for feature flag evaluation to prevent content flicker. The variant should only render after `useFeatureFlagVariantKey` returns a defined value:

```tsx
// src/components/ABTestHero.tsx
"use client"

import { useState, useEffect } from 'react'
import { useFeatureFlagVariantKey, usePostHog } from 'posthog-js/react'

interface Variant {
  variant: string  // "control", "variant-a", "variant-b", etc.
  title: string
  description: string
  ctaUrl: string
  ctaText: string
}

interface ABTestHeroProps {
  contentID: number
  experimentKey: string
  controlVariant: Variant
  variants: Variant[]
}

// Skeleton loader to prevent flicker
function HeroSkeleton() {
  return (
    <section className="animate-pulse">
      <div className="h-12 bg-gray-200 rounded w-3/4 mb-4" />
      <div className="h-6 bg-gray-200 rounded w-1/2 mb-6" />
      <div className="h-10 bg-gray-200 rounded w-32" />
    </section>
  )
}

export function ABTestHero({
  contentID,
  experimentKey,
  controlVariant,
  variants
}: ABTestHeroProps) {
  const posthog = usePostHog()
  const flagVariant = useFeatureFlagVariantKey(experimentKey)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Only render content once we have a definite variant
    if (flagVariant !== undefined) {
      setIsLoading(false)

      // Optionally track experiment exposure
      posthog?.capture('$experiment_exposure', {
        experimentName: experimentKey,
        variantKey: flagVariant,
        contentID: contentID
      })
    }
  }, [flagVariant, experimentKey, contentID, posthog])

  // Show skeleton while loading to prevent flicker
  if (isLoading) {
    return <HeroSkeleton />
  }

  // Find the matching variant, or fall back to control
  const selectedVariant = flagVariant
    ? variants.find(v => v.variant === flagVariant) || controlVariant
    : controlVariant

  return (
    <section
      data-agility-component={contentID}
      data-experiment={experimentKey}
      data-variant={selectedVariant.variant}
    >
      <h1>{selectedVariant.title}</h1>
      <p>{selectedVariant.description}</p>
      <a href={selectedVariant.ctaUrl}>{selectedVariant.ctaText}</a>
    </section>
  )
}
```

### Why Flicker Prevention Matters

Without the loading state check:
1. Component renders with control variant immediately
2. PostHog evaluates the feature flag (async)
3. Component re-renders with the assigned variant
4. User sees a "flash" of the control before seeing their assigned variant

This can skew experiment results because users briefly see both variants.

### Step 3: Content Model Setup - ABTestHero Example

The **A/B Test Hero** component model in Agility CMS demonstrates the recommended pattern for A/B testing components:

**ABTestHero Component Model Fields:**

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| `ExperimentKey` | Text (required) | The PostHog feature flag key. Must match exactly. |
| **Tab: Control** | Tab | Groups the control variant fields |
| `Heading` | Text (required) | Control variant heading |
| `Description` | Long Text (required) | Control variant description |
| `CallToAction` | Link | Control variant CTA button |
| `Image` | Image (required) | Control variant hero image |
| `ImagePosition` | Dropdown | Image position (left/right) |
| **Tab: Variants** | Tab | Groups the variant configuration |
| `Variants` | Linked Content (Nested Grid) | List of test variants linked to ABTestHeroItem model |

**Key Design Pattern:** The control variant content is stored directly on the component, while test variants are stored in a nested content list. This allows content editors to:
1. Edit the control (default) content directly on the component
2. Add multiple test variants in the Variants tab
3. Preview each variant independently

### Step 4: Variant Content Model - ABTestHeroItem

The **A/B Test Hero Item** model stores each test variant:

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| `Variant` | Text (required) | Variant key (e.g., "variant_a", "Analytics", "Engagement"). This must match the PostHog feature flag variant key. |
| `Heading` | Text (required) | Variant-specific heading |
| `Description` | Long Text (required) | Variant-specific description |
| `CallToAction` | Link | Variant-specific CTA button |
| `Image` | Image (required) | Variant-specific hero image |
| `ImagePosition` | Dropdown | Image position (left/right) |

**Important:** The `Variant` field value becomes the feature flag variant key in PostHog. Use consistent naming conventions like `variant_a`, `variant_b` or descriptive names like `Analytics`, `Engagement`.

---

## Other Framework Examples

While the detailed examples above use Next.js, here are quick snippets for other frameworks:

### Vue.js / Nuxt

```javascript
// plugins/posthog.client.js
import posthog from 'posthog-js'

export default defineNuxtPlugin(() => {
  posthog.init(process.env.POSTHOG_KEY, {
    api_host: 'https://app.posthog.com',
    capture_pageview: false,
  })

  return {
    provide: {
      posthog: posthog
    }
  }
})

// In your component
const { $posthog } = useNuxtApp()

$posthog.capture('$pageview', {
  pageID: 123,
  contentIDs: [1, 2, 3],
  locale: 'en-us'
})
```

### Vanilla JavaScript

```html
<script>
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  posthog.init('YOUR_API_KEY', {api_host: 'https://app.posthog.com', capture_pageview: false})
</script>

<script>
  // Get page data from Agility
  const pageID = parseInt(document.querySelector('[data-agility-page]')?.dataset.agilityPage || '0')
  const locale = document.documentElement.lang || 'en-us'

  // Collect all content IDs
  const contentIDs = Array.from(document.querySelectorAll('[data-agility-component]'))
    .map(el => parseInt(el.dataset.agilityComponent, 10))
    .filter(id => id > 0)

  // Track pageview
  posthog.capture('$pageview', { pageID, contentIDs, locale })

  // Track scroll milestones
  const scrollMilestones = new Set()
  window.addEventListener('scroll', () => {
    const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    [25, 50, 75, 100].forEach(milestone => {
      if (scrollPercent >= milestone && !scrollMilestones.has(milestone)) {
        scrollMilestones.add(milestone)
        posthog.capture('scroll_milestone', { depth: milestone, pageID, contentIDs, locale })
      }
    })
  })
</script>
```

---

## CMS Surfaces

### Content Item Sidebar

#### Analytics Tab

The Analytics tab shows performance metrics for the current content item over the last 30 days, filtered by locale.

**Metrics Displayed:**

| Metric | Description |
|--------|-------------|
| **Views** | Total pageviews where this content appeared |
| **Pages** | Number of different pages containing this content |
| **Scroll** | Average scroll depth on pages with this content |
| **Clicks** | Clicks on outbound links within this component |

**Scroll Depth Distribution** - Shows how far users scroll: 25%, 50%, 75%, 100%

**Time on Page Distribution** - Shows engagement time: 30s, 60s, 2m, 5m

**Top Pages** - Lists the pages where this content appears, ranked by traffic.

#### A/B Testing Tab

The A/B Testing tab shows experiment details and live results from PostHog.

**Requirements** - Your content model needs:
1. **ExperimentKey field** (Text) - The PostHog feature flag key
2. **Variants field** (Linked Content List, optional) - For creating experiments from Agility

**Experiment Information** - When an experiment exists, the sidebar shows:

| Field | Description |
|-------|-------------|
| **Name** | Experiment name from PostHog |
| **Status** | Active, Concluded, Archived, or Deleted |
| **Feature Flag Key** | The key used in your frontend code |
| **Type** | Product or Web experiment |
| **Start/End Date** | Experiment duration |
| **Conclusion** | If concluded, shows the winning variant |

**Live Results** - The sidebar fetches real-time experiment results including:
- **Statistical Significance** - Shows whether results are significant and the winning variant
- **Variant Performance** - Exposures, probability, confidence interval, conversion rate per variant
- **Primary Metrics** - Results for each metric configured in PostHog

#### Creating Experiments (Modal UI)

The PostHog app includes a full-featured **Create Experiment** modal that guides content editors through experiment setup without leaving the CMS.

#### How It Works

When you open the A/B Test tab in the content item sidebar:
1. The app checks PostHog for an experiment with a matching `feature_flag_key`
2. If no experiment exists, a "Create Experiment" button appears
3. Clicking the button opens a 3-step modal wizard

#### Variant Validation

Before the modal allows experiment creation, it validates that:
- The content item has been saved (has a contentID)
- At least one variant exists in the Variants nested content list
- Each variant has a unique `Variant` field value

If no variants are found, the modal displays instructions for adding them.

#### Step 1: Choose Template

Select from pre-configured experiment templates:

| Template | Description | Default Metrics |
|----------|-------------|-----------------|
| **CTA Optimization** | Test button text, color, or placement | CTA Clicks |
| **Content Engagement** | Test headlines, descriptions, or layouts | Scroll Depth, Time on Page |
| **Conversion Funnel** | Track multi-step conversion flows | View to Click Conversion |
| **Custom Experiment** | Configure your own metrics | (none - add manually) |

#### Step 2: Configure

Customize the experiment settings:

**Basic Settings:**
- **Experiment Name** - Descriptive name for the experiment
- **Description** - What you're testing and why

**Experiment Type:**
- **Product** (Recommended) - For in-app features, CTAs, and content. Tracks identified users across sessions.
- **Web** - For landing pages and marketing. Session-based visitor tracking.

**Metrics:**
- Add or remove metrics to track
- Supports **Mean** (count events) and **Funnel** (multi-step conversion) metrics
- Choose from common events like Page View, CTA Click, Scroll Milestone, Form Submitted, etc.
- For funnel metrics, define the sequence of steps (e.g., pageview → CTA click)

**Targeting:**
- **Filter test accounts** - Exclude internal/test users
- **Traffic allocation** - Control what percentage of users enter the experiment (10-100%)

#### Step 3: Review

Review all settings before creation:
- Experiment name and feature flag key
- Experiment type (Product/Web)
- Traffic allocation percentage
- All variants with traffic split calculation
- Configured metrics

Click **Create Experiment** to create in PostHog.

#### What Gets Created

The modal creates a complete experiment in PostHog:

1. **Feature flag** with multivariate variants (control + your CMS variants)
2. **Traffic distribution** evenly split across all variants
3. **Configured metrics** based on your template and customizations
4. **Targeting rules** based on your settings
5. **Immediate start** - experiment begins collecting data right away

#### Prerequisites

Before creating an experiment:

1. **Save the content item** - The item must have a contentID
2. **Add at least one variant** - Create items in the Variants nested list
3. **Set variant keys** - Each variant item needs a unique `Variant` field value
4. **Configure PostHog credentials** - API key must have `experiment:write` scope

#### Example: Features Page Hero Experiment

**Agility CMS Setup:**
- ExperimentKey: `features-page-hero`
- Control: Default hero content on the component
- Variants: Analytics, Engagement, Security, Integrations

**Using the Modal:**
1. Select "CTA Optimization" template
2. Name: "Features Page Hero Test"
3. Type: Product (recommended)
4. Metrics: CTA Clicks (default from template)
5. Traffic: 100%

**PostHog Result:**
- 5 variants at 20% each: `control`, `Analytics`, `Engagement`, `Security`, `Integrations`
- Primary metric: CTA Clicks
- Feature flag: `features-page-hero` (auto-created and activated)

### Page Sidebar

The Page Sidebar shows analytics for the currently selected page in the Pages section of Agility CMS.

**Metrics Displayed:**

| Metric | Description |
|--------|-------------|
| **Page Views** | Total pageviews for this specific page |
| **Unique Visitors** | Number of distinct users who viewed the page |
| **Avg Scroll Depth** | Average percentage scrolled on this page |
| **Avg Time on Page** | Average time users spend on this page |

**Additional Data:**
- **Scroll Depth Distribution** - 25%, 50%, 75%, 100% reached
- **Time on Page Distribution** - 30s, 60s, 2m, 5m
- **Top Referrers** - Top 5 referring domains/URLs
- **UTM Sources** - Campaign tracking sources

**How Page Tracking Works** - The page sidebar queries PostHog using the `pageID` property. Your frontend must include `pageID` in tracked events:

```typescript
// Include pageID in all events
posthog.capture('$pageview', {
  pageID: 123,  // Agility CMS page ID
  // ... other properties
})
```

The `pageID` should come from the `data-agility-page` attribute on your page layout.

### Dashboard

The Dashboard provides a site-wide view of your PostHog analytics, accessible from the main dashboard area in Agility CMS.

**Summary Statistics** - Four key metrics: Total Page Views, Unique Visitors, Avg Scroll Depth, Avg Time on Page

**Date Range Selector** - Choose from: Last 7, 14, 30 (default), 60, or 90 days

**Widgets:**
- **Page Views Trend** - Interactive bar chart showing daily page views
- **Top Pages** - Ranked list of most visited pages with view counts
- **Engagement Metrics** - Scroll depth and time on page distributions
- **Top Referrers** - Traffic sources bringing visitors to your site
- **Locale Distribution** - Breakdown by language/locale (if tracked)

---

## API Reference

The app uses these PostHog API endpoints:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/projects/{id}/experiments/` | List all experiments |
| `GET /api/projects/{id}/experiments/{id}/` | Get experiment details |
| `POST /api/projects/{id}/query/` | Query experiment results and run HogQL analytics queries |
| `POST /api/projects/{id}/experiments/` | Create new experiment |

### Experiment Results Query

Experiment results are fetched using PostHog's Query API with the `ExperimentQuery` kind:

```typescript
// POST /api/projects/{projectId}/query/
{
  "query": {
    "kind": "ExperimentQuery",
    "experiment_id": 123,
    "metric": {
      "kind": "ExperimentMetric",
      "name": "CTA Clicks",
      "uuid": "metric-uuid",
      "series": [{ "kind": "EventsNode", "event": "cta_click" }],
      "metric_type": "funnel"
    }
  }
}
```

The response includes:
- `baseline`: Control variant data with `number_of_samples`, `step_counts`, `chance_to_win`
- `variant_results`: Array of other variants with the same structure
- `significant`: Whether results are statistically significant
- `credible_intervals`: 95% confidence intervals for each variant

### HogQL Queries Used

#### Content Item Analytics

```sql
-- Content impressions (with locale filter)
SELECT count() as impressions
FROM events
WHERE event = '$pageview'
  AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString({contentID}))
  AND JSONExtractString(properties, 'locale') = '{locale}'
  AND timestamp > now() - INTERVAL 30 DAY

-- Pages using this content
SELECT JSONExtractInt(properties, 'pageID') as pageID, count() as views
FROM events
WHERE event = '$pageview'
  AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString({contentID}))
  AND JSONExtractString(properties, 'locale') = '{locale}'
GROUP BY pageID
ORDER BY views DESC
LIMIT 5

-- Average scroll depth
SELECT avg(JSONExtractInt(properties, 'depth')) as avgDepth
FROM events
WHERE event = 'scroll_milestone'
  AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString({contentID}))
  AND JSONExtractString(properties, 'locale') = '{locale}'

-- CTA clicks
SELECT count() as clicks
FROM events
WHERE event = 'outbound_link_clicked'
  AND JSONExtractInt(properties, 'contentID') = {contentID}
  AND JSONExtractString(properties, 'locale') = '{locale}'
```

#### Page Analytics

```sql
-- Page views
SELECT count() as pageViews
FROM events
WHERE event = '$pageview'
  AND JSONExtractInt(properties, 'pageID') = {pageID}
  AND timestamp > now() - INTERVAL 30 DAY

-- Unique visitors
SELECT count(DISTINCT distinct_id) as uniqueVisitors
FROM events
WHERE event = '$pageview'
  AND JSONExtractInt(properties, 'pageID') = {pageID}
  AND timestamp > now() - INTERVAL 30 DAY

-- Scroll depth distribution
SELECT JSONExtractInt(properties, 'depth') as depth, count() as count
FROM events
WHERE event = 'scroll_milestone'
  AND JSONExtractInt(properties, 'pageID') = {pageID}
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY depth
ORDER BY depth

-- Top referrers
SELECT JSONExtractString(properties, '$referrer') as referrer, count() as count
FROM events
WHERE event = '$pageview'
  AND JSONExtractInt(properties, 'pageID') = {pageID}
  AND JSONExtractString(properties, '$referrer') != ''
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY referrer
ORDER BY count DESC
LIMIT 5
```

---

## Troubleshooting

### No Analytics Data

1. **Verify events are being tracked** - Check PostHog Live Events
2. **Check contentID is included** - Events must have `contentIDs` array or `contentID` property
3. **Verify locale matches** - Content analytics filter by locale from the CMS
4. **Wait for data** - New events may take a few minutes to appear
5. **Check API key permissions** - Key needs read access to run queries

### Experiment Not Found

1. **Verify ExperimentKey matches** - Must exactly match the PostHog feature flag key
2. **Check experiment exists** - Go to PostHog → Experiments
3. **Ensure experiment is linked to feature flag** - The flag key must match

### Results Not Loading

1. **Check experiment has started** - Results appear after experiment begins
2. **Verify users are being exposed** - Check PostHog for `$feature_flag_called` events
3. **API permissions** - Key needs read access to experiments and query endpoints
4. **Check metrics are configured** - Experiments need at least one metric to show results
5. **Wait for data** - Results require sufficient exposures to calculate statistics

### Create Experiment Fails

1. **Content must be saved** - New items need a contentID first
2. **Variants required** - Add at least one variant to the Variants list
3. **Unique variant names** - Each variant needs a unique `Variant` field value

### Page Analytics Not Showing

1. **Verify pageID is tracked** - Events must include the `pageID` property
2. **Check pageID matches** - The pageID in events must match the Agility CMS page ID
3. **Ensure data-agility-page attribute exists** - Your frontend layout should have this attribute
4. **Wait for traffic** - New pages need pageviews before analytics appear

---

## Features

The experiment creation modal includes the following capabilities:

### Configurable Metrics

| Metric Type | Use Case | Example |
|-------------|----------|---------|
| **Mean** | Count events | CTA Clicks, Page Views |
| **Funnel** | Multi-step conversions | View → Click → Purchase |

Content editors can add multiple metrics and choose from common events: Page View, CTA Click, Scroll Milestone, Time Milestone, Form Submitted, Sign Up, Purchase, Outbound Link Click.

### Experiment Templates

| Template | Default Metrics | Description |
|----------|-----------------|-------------|
| **CTA Optimization** | CTA Clicks | Test button text, color, placement |
| **Content Engagement** | Scroll Depth, Time on Page | Test headlines, descriptions |
| **Conversion Funnel** | View to Click Conversion | Test entire user journeys |
| **Custom** | (none) | Configure everything manually |

### Targeting & Traffic

- **Filter test accounts** - Exclude internal/test users from results
- **Traffic allocation** - Control percentage rollout (10-100%)

### Experiment Types

- **Product** (Recommended) - For in-app features, CTAs, content. Tracks identified users across sessions.
- **Web** - For landing pages and marketing. Session-based visitor tracking.

### Variant Validation

The modal validates CMS variants before allowing experiment creation:
- Checks that content item is saved
- Verifies at least one variant exists in the nested content list
- Displays variant count and names on the review screen
- Shows traffic split calculation per variant

### Future Enhancements

#### Custom Event Mapping per Component

Different A/B test components may track different events:

| Component | Primary Event | Secondary Events |
|-----------|---------------|------------------|
| ABTestHero | `cta_clicked` | `experiment_interaction`, `scroll_milestone`, `time_milestone` |
| ABTestPricing | `pricing_plan_selected` | `pricing_faq_expanded` |
| ABTestForm | `form_submitted` | `form_field_focused` |

**Proposed Solution:** Add a configuration setting per component model that maps to specific PostHog events.

#### Advanced Targeting

Extend targeting configuration to include:
- **User properties**: Target by subscription tier, region, etc.
- **Cohorts**: Use existing PostHog cohorts
- **Geographic targeting**: Target by country or region

#### Two-Way Variant Sync

Sync between Agility CMS variants and PostHog:
- **Import variants**: Pull existing feature flag variants into CMS
- **Update variants**: Push CMS variant changes to PostHog
- **Delete handling**: Archive experiments when content is deleted

#### Experiment Scheduling

Allow scheduling experiments:

- **Start date**: Schedule experiment to start in the future
- **End date**: Automatically conclude after a set period
- **Sample size targets**: End when statistical significance is reached

### Implementation Priority

| Priority | Enhancement | Impact |
|----------|-------------|--------|
| **Medium** | Custom event mapping | Component-specific metrics |
| **Medium** | Advanced targeting | Better experiment segmentation |
| **Low** | Two-way variant sync | Keeps CMS and PostHog in sync |
| **Low** | Experiment scheduling | Automated experiment lifecycle |

---

## Related Resources

- [PostHog Documentation](https://posthog.com/docs) - Official PostHog docs
- [PostHog Experiments](https://posthog.com/docs/experiments) - Experiment setup guide
- [PostHog React SDK](https://posthog.com/docs/libraries/react) - Frontend integration
- [PostHog HogQL](https://posthog.com/docs/hogql) - Query language reference
- [Agility CMS Apps SDK](https://agilitycms.com/docs/apps/apps-sdk) - Agility app development
