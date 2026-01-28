// Experiment configuration types for enhanced experiment creation

export type MetricType = 'mean' | 'funnel' | 'ratio'

export interface ExperimentMetric {
	id: string
	name: string
	metric_type: MetricType
	event_name: string
	description?: string
	funnel_steps?: string[] // For funnel metrics
	math?: 'total' | 'dau' | 'weekly_active' | 'monthly_active'
}

export interface ExperimentTemplate {
	id: string
	name: string
	description: string
	icon: 'cta' | 'engagement' | 'funnel' | 'custom'
	metrics: ExperimentMetric[]
	recommended_duration_days: number
	minimum_detectable_effect: number
}

export interface TargetingCriteria {
	filter_test_accounts: boolean
	rollout_percentage?: number
	user_properties?: Record<string, string | number | boolean>
	cohort_ids?: number[]
}

export interface ExperimentConfig {
	name: string
	description: string
	type: 'product' | 'web'
	template_id?: string
	metrics: ExperimentMetric[]
	targeting: TargetingCriteria
	start_immediately: boolean
}

// PostHog API types for experiment creation
export interface PostHogEventsNode {
	kind: 'EventsNode'
	event: string
	name: string
	math?: 'total' | 'dau' | 'weekly_active' | 'monthly_active'
}

export interface PostHogMetric {
	kind: 'ExperimentMetric'
	metric_type: MetricType
	name: string
	source?: PostHogEventsNode
	series?: PostHogEventsNode[]
}

export interface PostHogFeatureFlagVariant {
	key: string
	rollout_percentage: number
}

export interface PostHogExperimentPayload {
	name: string
	description: string
	feature_flag_key: string
	start_date: string
	type: 'product' | 'web'
	exposure_criteria: {
		filterTestAccounts: boolean
	}
	metrics: PostHogMetric[]
	parameters: {
		feature_flag_variants: PostHogFeatureFlagVariant[]
		recommended_running_time: number
		recommended_sample_size: number
		minimum_detectable_effect: number
	}
}

// Predefined templates
export const EXPERIMENT_TEMPLATES: ExperimentTemplate[] = [
	{
		id: 'cta_optimization',
		name: 'CTA Optimization',
		description: 'Test button text, color, or placement to improve click-through rates',
		icon: 'cta',
		metrics: [
			{
				id: 'cta_clicks',
				name: 'CTA Clicks',
				metric_type: 'mean',
				event_name: 'cta_clicked',
				description: 'Total clicks on the call-to-action',
				math: 'total'
			}
		],
		recommended_duration_days: 14,
		minimum_detectable_effect: 20
	},
	{
		id: 'content_engagement',
		name: 'Content Engagement',
		description: 'Test headlines, descriptions, or layouts to improve engagement',
		icon: 'engagement',
		metrics: [
			{
				id: 'scroll_depth',
				name: 'Scroll Depth',
				metric_type: 'mean',
				event_name: 'scroll_milestone',
				description: 'How far users scroll on the page',
				math: 'total'
			},
			{
				id: 'time_on_page',
				name: 'Time on Page',
				metric_type: 'mean',
				event_name: 'time_milestone',
				description: 'Time spent viewing the content',
				math: 'total'
			}
		],
		recommended_duration_days: 7,
		minimum_detectable_effect: 25
	},
	{
		id: 'conversion_funnel',
		name: 'Conversion Funnel',
		description: 'Track multi-step conversion flows from view to action',
		icon: 'funnel',
		metrics: [
			{
				id: 'view_to_click',
				name: 'View to Click Conversion',
				metric_type: 'funnel',
				event_name: '$pageview',
				description: 'Conversion from page view to CTA click',
				funnel_steps: ['$pageview', 'cta_clicked']
			}
		],
		recommended_duration_days: 21,
		minimum_detectable_effect: 30
	},
	{
		id: 'custom',
		name: 'Custom Experiment',
		description: 'Configure your own metrics and settings',
		icon: 'custom',
		metrics: [],
		recommended_duration_days: 14,
		minimum_detectable_effect: 30
	}
]

// Common events that can be tracked
// These match the standard event names from the Agility demo site analytics abstraction
export const COMMON_EVENTS = [
	{ value: '$pageview', label: 'Page View', description: 'Standard page view event' },
	{ value: 'cta_clicked', label: 'CTA Click', description: 'Click on call-to-action button' },
	{ value: 'experiment_interaction', label: 'Experiment Interaction', description: 'User interacted with A/B test variant (e.g., CTA click)' },
	{ value: 'scroll_milestone', label: 'Scroll Milestone', description: 'User scrolled to 25%, 50%, 75%, or 100%' },
	{ value: 'time_milestone', label: 'Time Milestone', description: 'User spent 30s, 60s, 2m, or 5m on page' },
	{ value: 'outbound_link_clicked', label: 'Outbound Link Click', description: 'Click on external link' },
	{ value: 'form_submitted', label: 'Form Submitted', description: 'Form submission event' },
	{ value: 'conversion', label: 'Conversion', description: 'Generic conversion goal reached' },
	{ value: 'demo_requested', label: 'Demo Requested', description: 'Demo/contact request submitted' }
]

// Helper function to generate a metric ID
export function generateMetricId(): string {
	return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Helper to extract variant key from Agility CMS content item
// Handles both direct field access and array-wrapped items
export function extractVariantKey(variantItem: Record<string, unknown>): string | null {
	// Try direct field access (case-insensitive)
	const variant = variantItem["Variant"] || variantItem["variant"]
	return typeof variant === 'string' ? variant : null
}

// Helper to extract ALL variant keys from a content list response
// The API may return items as individual objects OR as an array of objects
export function extractAllVariantKeys(items: unknown[]): string[] {
	const variants: string[] = []

	for (const item of items) {
		// If the item itself is an array (nested content list returns all items in one array)
		if (Array.isArray(item)) {
			for (const nestedItem of item) {
				const v = extractVariantKey(nestedItem as Record<string, unknown>)
				if (v) {
					variants.push(v)
				}
			}
		} else {
			// Single item object
			const v = extractVariantKey(item as Record<string, unknown>)
			if (v) {
				variants.push(v)
			}
		}
	}

	return variants
}

// Helper to convert our metric format to PostHog API format
export function convertMetricToPostHogFormat(metric: ExperimentMetric): PostHogMetric {
	if (metric.metric_type === 'funnel' && metric.funnel_steps && metric.funnel_steps.length > 0) {
		return {
			kind: 'ExperimentMetric',
			metric_type: 'funnel',
			name: metric.name,
			series: metric.funnel_steps.map(event => ({
				kind: 'EventsNode' as const,
				event: event,
				name: event
			}))
		}
	}

	return {
		kind: 'ExperimentMetric',
		metric_type: metric.metric_type,
		name: metric.name,
		source: {
			kind: 'EventsNode' as const,
			event: metric.event_name,
			name: metric.event_name,
			math: metric.math || 'total'
		}
	}
}
