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
				event_name: 'ab_test_cta_click',
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
				funnel_steps: ['$pageview', 'ab_test_cta_click']
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
export const COMMON_EVENTS = [
	{ value: '$pageview', label: 'Page View', description: 'Standard page view event' },
	{ value: 'ab_test_cta_click', label: 'CTA Click', description: 'Click on call-to-action button' },
	{ value: 'scroll_milestone', label: 'Scroll Milestone', description: 'User scrolled to 25%, 50%, 75%, or 100%' },
	{ value: 'time_milestone', label: 'Time Milestone', description: 'User spent 30s, 60s, 2m, or 5m on page' },
	{ value: 'outbound_link_clicked', label: 'Outbound Link Click', description: 'Click on external link' },
	{ value: 'form_submitted', label: 'Form Submitted', description: 'Form submission event' },
	{ value: 'signup', label: 'Sign Up', description: 'User registration event' },
	{ value: 'purchase', label: 'Purchase', description: 'Purchase completion event' }
]

// Helper function to generate a metric ID
export function generateMetricId(): string {
	return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Helper to convert our metric format to PostHog API format
export function convertMetricToPostHogFormat(metric: ExperimentMetric): any {
	if (metric.metric_type === 'funnel' && metric.funnel_steps && metric.funnel_steps.length > 0) {
		return {
			kind: 'ExperimentMetric',
			metric_type: 'funnel',
			name: metric.name,
			series: metric.funnel_steps.map(event => ({
				kind: 'EventsNode',
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
			kind: 'EventsNode',
			event: metric.event_name,
			name: metric.event_name,
			math: metric.math || 'total'
		}
	}
}
