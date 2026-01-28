import clsx from "clsx"
import { IAgilityContentItem } from "@/types/IAgilityContentItem"
import { useState, useCallback, useEffect } from "react"
import * as mgmtApi from "@agility/management-sdk"
import { ListParams } from "@agility/management-sdk/dist/models/listParams"
import { Experiment } from "./PostHogSidebar"
import {
	ExperimentMetric,
	ExperimentTemplate,
	TargetingCriteria,
	EXPERIMENT_TEMPLATES,
	COMMON_EVENTS,
	generateMetricId,
	convertMetricToPostHogFormat
} from "@/types/ExperimentConfig"

interface CreateExperimentModalProps {
	experimentKey: string
	postHogProjectId: string
	postHogAPIKey?: string | null
	// Content item context passed from sidebar
	contentItem: any
	instance: any
	locale: string
	// Management token passed from sidebar (SDK may not work in modal iframe)
	managementToken: string
	onCreated?: (experiment: Experiment) => void
	onCancel?: () => void
}

// Template icon components
const TemplateIcons = {
	cta: (
		<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
		</svg>
	),
	engagement: (
		<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
		</svg>
	),
	funnel: (
		<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
		</svg>
	),
	custom: (
		<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
		</svg>
	)
}

export const CreateExperimentModal = ({ experimentKey, postHogProjectId, postHogAPIKey, contentItem, instance, locale, managementToken, onCreated, onCancel }: CreateExperimentModalProps) => {

	// Basic state
	const [errorMsg, setErrorMsg] = useState<string | null>(null)
	const [successMsg, setSuccessMsg] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState<boolean>(false)

	// Configuration state
	const [step, setStep] = useState<'template' | 'configure' | 'review'>('template')
	const [selectedTemplate, setSelectedTemplate] = useState<ExperimentTemplate | null>(null)
	const [experimentName, setExperimentName] = useState(`Experiment: ${experimentKey}`)
	const [experimentDescription, setExperimentDescription] = useState('')
	const [experimentType, setExperimentType] = useState<'product' | 'web'>('product')

	// Metrics state
	const [metrics, setMetrics] = useState<ExperimentMetric[]>([])
	const [showAddMetric, setShowAddMetric] = useState(false)
	const [newMetricName, setNewMetricName] = useState('')
	const [newMetricEvent, setNewMetricEvent] = useState('ab_test_cta_click')
	const [newMetricType, setNewMetricType] = useState<'mean' | 'funnel'>('mean')
	const [newFunnelSteps, setNewFunnelSteps] = useState<string[]>(['$pageview', 'ab_test_cta_click'])

	// Targeting state
	const [targeting, setTargeting] = useState<TargetingCriteria>({
		filter_test_accounts: true,
		rollout_percentage: 100
	})

	// Variant sync state
	const [existingVariants, setExistingVariants] = useState<string[]>([])
	const [showSyncOption, setShowSyncOption] = useState(false)

	// CMS variants state
	const [cmsVariants, setCmsVariants] = useState<string[]>([])
	const [variantsLoading, setVariantsLoading] = useState(true)
	const [variantsError, setVariantsError] = useState<string | null>(null)

	// Fetch variants from Agility CMS on mount
	useEffect(() => {
		const fetchCmsVariants = async () => {
			setVariantsLoading(true)
			setVariantsError(null)

			try {
				const item = contentItem as IAgilityContentItem | null

				if (!item || item.contentID < 1) {
					setVariantsError("Please save this content item first before creating an experiment.")
					setVariantsLoading(false)
					return
				}

				if (!instance || !locale) {
					setVariantsError("Could not access Agility instance details.")
					setVariantsLoading(false)
					return
				}

				const variantListReferenceName = item.values["Variants"]

				if (!variantListReferenceName) {
					setVariantsError("No variants field found. Make sure this component has a 'Variants' nested content list.")
					setVariantsLoading(false)
					return
				}

				const options = new mgmtApi.Options()
				options.token = managementToken
				const apiClient = new mgmtApi.ApiClient(options)

				const guid = instance.guid || ""
				const listParams = new ListParams()
				listParams.fields = "variant"

				const contentList = await apiClient.contentMethods.getContentList(
					variantListReferenceName,
					guid,
					locale,
					listParams
				)

				if (!contentList || contentList?.totalCount === 0) {
					setCmsVariants([])
					setVariantsLoading(false)
					return
				}

				const variants: string[] = []
				contentList.items?.forEach(variantItem => {
					let v = variantItem["Variant"] || variantItem["variant"]
					if (!v && variantItem.length > 0) {
						v = variantItem[0]["Variant"] || variantItem[0]["variant"]
					}
					if (v) {
						variants.push(v)
					}
				})

				setCmsVariants(variants)
			} catch (error) {
				setVariantsError("Failed to load variants from Agility CMS.")
			} finally {
				setVariantsLoading(false)
			}
		}

		fetchCmsVariants()
		checkExistingFeatureFlag()
	}, [instance, contentItem, locale])

	// Select template and move to configure step
	const selectTemplate = useCallback((template: ExperimentTemplate) => {
		setSelectedTemplate(template)
		setMetrics([...template.metrics])
		setExperimentDescription(template.description)
		setStep('configure')
	}, [])

	// Add a new metric
	const addMetric = useCallback(() => {
		const newMetric: ExperimentMetric = {
			id: generateMetricId(),
			name: newMetricName || `Metric ${metrics.length + 1}`,
			metric_type: newMetricType,
			event_name: newMetricEvent,
			funnel_steps: newMetricType === 'funnel' ? newFunnelSteps : undefined
		}
		setMetrics([...metrics, newMetric])
		setShowAddMetric(false)
		setNewMetricName('')
		setNewMetricEvent('ab_test_cta_click')
		setNewMetricType('mean')
		setNewFunnelSteps(['$pageview', 'ab_test_cta_click'])
	}, [metrics, newMetricName, newMetricEvent, newMetricType, newFunnelSteps])

	// Remove a metric
	const removeMetric = useCallback((id: string) => {
		setMetrics(metrics.filter(m => m.id !== id))
	}, [metrics])

	// Add funnel step
	const addFunnelStep = useCallback(() => {
		setNewFunnelSteps([...newFunnelSteps, '$pageview'])
	}, [newFunnelSteps])

	// Update funnel step
	const updateFunnelStep = useCallback((index: number, value: string) => {
		const updated = [...newFunnelSteps]
		updated[index] = value
		setNewFunnelSteps(updated)
	}, [newFunnelSteps])

	// Remove funnel step
	const removeFunnelStep = useCallback((index: number) => {
		if (newFunnelSteps.length > 2) {
			setNewFunnelSteps(newFunnelSteps.filter((_, i) => i !== index))
		}
	}, [newFunnelSteps])

	// Check for existing feature flag in PostHog
	const checkExistingFeatureFlag = useCallback(async () => {
		if (!postHogAPIKey || !postHogProjectId) return

		try {
			const response = await fetch(
				`https://app.posthog.com/api/projects/${postHogProjectId}/feature_flags/?search=${experimentKey}`,
				{
					headers: {
						'Authorization': `Bearer ${postHogAPIKey}`,
						'Content-Type': 'application/json',
					},
				}
			)

			if (response.ok) {
				const data = await response.json()
				const matchingFlag = data.results?.find((flag: any) => flag.key === experimentKey)
				if (matchingFlag && matchingFlag.filters?.multivariate?.variants) {
					const variants = matchingFlag.filters.multivariate.variants.map((v: any) => v.key)
					setExistingVariants(variants)
					setShowSyncOption(true)
				}
			}
		} catch {
			// Silently fail - feature flag check is optional
		}
	}, [postHogAPIKey, postHogProjectId, experimentKey])

	// Create the experiment
	const createExperiment = async () => {
		setErrorMsg(null)
		setSuccessMsg(null)
		setIsLoading(true)

		try {
			// managementToken is passed as a prop from the sidebar
			const item = contentItem as IAgilityContentItem | null

			if (!item || item.contentID < 1) {
				setErrorMsg("Please save this content item and create at least 1 variant before creating an experiment")
				setIsLoading(false)
				return
			}

			if (!instance || !locale) {
				setErrorMsg("The Agility instance details are not available. Please refresh your browser and try again.")
				setIsLoading(false)
				return
			}

			const variantListReferenceName = item.values["Variants"]

			if (!variantListReferenceName) {
				setErrorMsg("No variants found. Please create at least one variant before creating an experiment.")
				setIsLoading(false)
				return
			}

			// Fetch variants from Agility CMS
			let variants: string[] = []
			let options = new mgmtApi.Options()
			options.token = managementToken
			let apiClient = new mgmtApi.ApiClient(options)

			let guid = instance.guid || ""
			const listParams = new ListParams()
			listParams.fields = "variant"

			const contentList = await apiClient.contentMethods.getContentList(
				variantListReferenceName,
				guid,
				locale,
				listParams
			)

			if (!contentList || contentList?.totalCount === 0) {
				setErrorMsg("No content items found in the Variants container. Please create at least one variant.")
				setIsLoading(false)
				return
			}

			contentList.items?.forEach(variantItem => {
				let v = variantItem["Variant"] || variantItem["variant"]
				if (!v && variantItem.length > 0) {
					v = variantItem[0]["Variant"] || variantItem[0]["variant"]
				}
				if (v) {
					variants.push(v)
				}
			})

			// Create feature flag variants
			const allVariants = ["control", ...variants]
			const totalVariants = allVariants.length
			const effectiveRollout = targeting.rollout_percentage || 100
			const basePercentage = Math.floor(effectiveRollout / totalVariants)
			const remainder = effectiveRollout - (basePercentage * totalVariants)

			const featureFlagVariants = allVariants.map((variant, index) => ({
				key: variant,
				rollout_percentage: basePercentage + (index < remainder ? 1 : 0)
			}))

			// Ensure we have at least one metric
			const finalMetrics = metrics.length > 0 ? metrics : [{
				id: 'default_cta',
				name: 'CTA Clicks',
				metric_type: 'mean' as const,
				event_name: 'ab_test_cta_click',
				math: 'total' as const
			}]

			// Convert metrics to PostHog format
			const postHogMetrics = finalMetrics.map(convertMetricToPostHogFormat)

			// Build the experiment payload
			const experimentPayload: any = {
				name: experimentName,
				description: experimentDescription || `A/B test experiment for feature flag key: ${experimentKey}`,
				feature_flag_key: experimentKey,
				start_date: new Date().toISOString(),
				type: experimentType,
				exposure_criteria: {
					filterTestAccounts: targeting.filter_test_accounts
				},
				metrics: postHogMetrics,
				parameters: {
					feature_flag_variants: featureFlagVariants,
					recommended_running_time: 0,
					recommended_sample_size: 0,
					minimum_detectable_effect: selectedTemplate?.minimum_detectable_effect || 30
				}
			}

			// Create the experiment in PostHog
			const response = await fetch(`https://app.posthog.com/api/projects/${postHogProjectId}/experiments/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${postHogAPIKey}`
				},
				body: JSON.stringify(experimentPayload)
			})

			if (!response.ok) {
				const errorData = await response.json().catch(() => null)
				console.error('PostHog API Error:', response.status, errorData)

				if (response.status === 401) {
					setErrorMsg("Invalid PostHog API key. Please check your API key and try again.")
				} else if (response.status === 403) {
					setErrorMsg("Access denied. Make sure your API key has the 'experiment:write' scope.")
				} else if (response.status === 404) {
					setErrorMsg("PostHog project not found. Please check your project ID and try again.")
				} else if (response.status === 400) {
					setErrorMsg(`Bad request: ${errorData?.detail || 'Please check your experiment configuration.'}`)
				} else {
					setErrorMsg(`Failed to create experiment in PostHog. Status: ${response.status}`)
				}
				setIsLoading(false)
				return
			}

			const createdExperiment = await response.json()
			setSuccessMsg(`Experiment "${createdExperiment.name}" created successfully!`)

			setTimeout(() => {
				if (onCreated) {
					onCreated(createdExperiment)
				}
			}, 1500)

		} catch (error) {
			setErrorMsg("An error occurred while creating the experiment. Please try again.")
			console.error("Error creating experiment:", error)
		} finally {
			setIsLoading(false)
		}
	}

	// Render template selection step
	const renderTemplateStep = () => {
		// Show loading state
		if (variantsLoading) {
			return (
				<div className="p-6">
					<div className="text-center">
						<div className="w-14 h-14 bg-blue-100 mx-auto flex items-center justify-center rounded-full mb-4">
							<svg className="animate-spin h-7 w-7 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
								<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						</div>
						<h2 className="text-lg font-semibold text-gray-900">Loading Variants</h2>
						<p className="text-sm text-gray-500 mt-1">Checking for variants in Agility CMS...</p>
					</div>
				</div>
			)
		}

		// Show error state
		if (variantsError) {
			return (
				<div className="p-6">
					<div className="text-center">
						<div className="w-14 h-14 bg-red-100 mx-auto flex items-center justify-center rounded-full mb-4">
							<svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
						</div>
						<h2 className="text-lg font-semibold text-gray-900">Cannot Create Experiment</h2>
						<p className="text-sm text-red-600 mt-2">{variantsError}</p>
					</div>
				</div>
			)
		}

		// Show "no variants" message
		if (cmsVariants.length === 0) {
			return (
				<div className="p-6">
					<div className="text-center">
						<div className="w-14 h-14 bg-yellow-100 mx-auto flex items-center justify-center rounded-full mb-4">
							<svg className="w-7 h-7 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
						</div>
						<h2 className="text-lg font-semibold text-gray-900">No Variants Found</h2>
						<p className="text-sm text-gray-600 mt-2 max-w-sm mx-auto">
							You need to create at least one variant before setting up an A/B test experiment.
						</p>
						<div className="mt-6 p-4 bg-gray-50 rounded-lg text-left max-w-sm mx-auto">
							<h3 className="text-sm font-medium text-gray-800 mb-2">How to add variants:</h3>
							<ol className="text-xs text-gray-600 space-y-2 list-decimal list-inside">
								<li>Go to the <strong>Variants</strong> tab on this component</li>
								<li>Click <strong>Add Item</strong> to create a new variant</li>
								<li>Set the <strong>Variant</strong> field (e.g., "variant_a" or "Engagement")</li>
								<li>Fill in the variant content (heading, description, etc.)</li>
								<li>Save the content item</li>
								<li>Return here to create the experiment</li>
							</ol>
						</div>
					</div>
				</div>
			)
		}

		// Show template selection (normal state)
		return (
			<div className="p-6">
				<div className="text-center mb-6">
					<div className="w-14 h-14 bg-blue-100 mx-auto flex items-center justify-center rounded-full mb-3">
						<img
							src="https://posthog.com/brand/posthog-logo-stacked.svg"
							alt="PostHog Logo"
							className="w-9 h-9"
						/>
					</div>
					<h2 className="text-xl font-semibold text-gray-900">Create A/B Test</h2>
					<p className="text-sm text-gray-500 mt-1">
						Feature flag: <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">{experimentKey}</code>
					</p>
					<div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
						<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
						</svg>
						{cmsVariants.length} variant{cmsVariants.length !== 1 ? 's' : ''} found: {cmsVariants.join(', ')}
					</div>
				</div>

				<div className="mb-4">
					<h3 className="text-sm font-medium text-gray-700 mb-3">Choose Experiment Type</h3>
					<div className="grid grid-cols-2 gap-3">
						{EXPERIMENT_TEMPLATES.map((template) => (
							<button
								key={template.id}
								onClick={() => selectTemplate(template)}
								className={clsx(
									"p-4 rounded-lg border-2 text-left transition-all hover:shadow-md",
									"hover:border-blue-400 hover:bg-blue-50",
									"focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
								)}
							>
								<div className="flex items-center gap-3 mb-2">
									<div className="text-blue-600">
										{TemplateIcons[template.icon]}
									</div>
									<span className="font-medium text-gray-900">{template.name}</span>
								</div>
								<p className="text-xs text-gray-500">{template.description}</p>
								{template.metrics.length > 0 && (
									<div className="mt-3 flex flex-wrap gap-1">
										{template.metrics.map((m) => (
											<span key={m.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
												{m.name}
											</span>
										))}
									</div>
								)}
							</button>
						))}
					</div>
				</div>
			</div>
		)
	}

	// Render configure step
	const renderConfigureStep = () => (
		<div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
			{/* Back button */}
			<button
				onClick={() => setStep('template')}
				className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
			>
				<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
				</svg>
				Back to templates
			</button>

			<div className="space-y-5">
				{/* Experiment Name */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">Experiment Name</label>
					<input
						type="text"
						value={experimentName}
						onChange={(e) => setExperimentName(e.target.value)}
						className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						placeholder="Enter experiment name"
					/>
				</div>

				{/* Description */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
					<textarea
						value={experimentDescription}
						onChange={(e) => setExperimentDescription(e.target.value)}
						rows={2}
						className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						placeholder="What are you testing?"
					/>
				</div>

				{/* Experiment Type */}
				<div>
					<div className="flex items-center gap-2 mb-2">
						<label className="block text-sm font-medium text-gray-700">Experiment Type</label>
						<div className="group relative">
							<svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10">
								Choose based on what you're testing. Product experiments track identified users across sessions. Web experiments focus on page-level metrics.
							</div>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<button
							onClick={() => setExperimentType('product')}
							className={clsx(
								"flex flex-col items-start p-3 rounded-lg border-2 transition-colors text-left",
								experimentType === 'product'
									? "bg-blue-50 border-blue-500"
									: "border-gray-200 hover:bg-gray-50"
							)}
						>
							<div className="flex items-center gap-2 mb-1">
								<svg className={clsx("w-4 h-4", experimentType === 'product' ? "text-blue-600" : "text-gray-500")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
								</svg>
								<span className={clsx("font-medium", experimentType === 'product' ? "text-blue-700" : "text-gray-700")}>Product</span>
								<span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Recommended</span>
							</div>
							<p className="text-xs text-gray-500">For in-app features, CTAs, and content. Tracks users across sessions.</p>
						</button>
						<button
							onClick={() => setExperimentType('web')}
							className={clsx(
								"flex flex-col items-start p-3 rounded-lg border-2 transition-colors text-left",
								experimentType === 'web'
									? "bg-blue-50 border-blue-500"
									: "border-gray-200 hover:bg-gray-50"
							)}
						>
							<div className="flex items-center gap-2 mb-1">
								<svg className={clsx("w-4 h-4", experimentType === 'web' ? "text-blue-600" : "text-gray-500")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
								</svg>
								<span className={clsx("font-medium", experimentType === 'web' ? "text-blue-700" : "text-gray-700")}>Web</span>
							</div>
							<p className="text-xs text-gray-500">For landing pages and marketing. Session-based visitor tracking.</p>
						</button>
					</div>
				</div>

				{/* Metrics Section */}
				<div>
					<div className="flex items-center justify-between mb-2">
						<label className="block text-sm font-medium text-gray-700">Metrics</label>
						<button
							onClick={() => setShowAddMetric(true)}
							className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
						>
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
							</svg>
							Add metric
						</button>
					</div>

					{/* Metrics list */}
					<div className="space-y-2">
						{metrics.map((metric) => (
							<div key={metric.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
								<div>
									<span className="text-sm font-medium text-gray-800">{metric.name}</span>
									<div className="flex items-center gap-2 mt-1">
										<span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">{metric.metric_type}</span>
										<span className="text-xs text-gray-500 font-mono">{metric.event_name}</span>
									</div>
									{metric.funnel_steps && (
										<div className="flex items-center gap-1 mt-2">
											{metric.funnel_steps.map((step, i) => (
												<span key={i} className="flex items-center">
													<span className="text-xs text-gray-600 bg-white px-2 py-0.5 rounded border">{step}</span>
													{i < metric.funnel_steps!.length - 1 && (
														<svg className="w-4 h-4 mx-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
														</svg>
													)}
												</span>
											))}
										</div>
									)}
								</div>
								<button
									onClick={() => removeMetric(metric.id)}
									className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
								>
									<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						))}

						{metrics.length === 0 && !showAddMetric && (
							<div className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
								No metrics configured. Default CTA click metric will be used.
							</div>
						)}
					</div>

					{/* Add metric form */}
					{showAddMetric && (
						<div className="mt-3 p-4 border-2 border-dashed border-gray-200 rounded-lg bg-white space-y-4">
							<div>
								<label className="block text-xs font-medium text-gray-600 mb-1">Metric Name</label>
								<input
									type="text"
									value={newMetricName}
									onChange={(e) => setNewMetricName(e.target.value)}
									className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									placeholder="e.g., CTA Clicks"
								/>
							</div>

							<div>
								<label className="block text-xs font-medium text-gray-600 mb-2">Metric Type</label>
								<div className="flex gap-2">
									<button
										onClick={() => setNewMetricType('mean')}
										className={clsx(
											"flex-1 px-3 py-2 text-sm rounded-lg border-2 transition-colors",
											newMetricType === 'mean'
												? "bg-blue-50 border-blue-500 text-blue-700"
												: "border-gray-200 text-gray-600 hover:bg-gray-50"
										)}
									>
										Mean (Count)
									</button>
									<button
										onClick={() => setNewMetricType('funnel')}
										className={clsx(
											"flex-1 px-3 py-2 text-sm rounded-lg border-2 transition-colors",
											newMetricType === 'funnel'
												? "bg-blue-50 border-blue-500 text-blue-700"
												: "border-gray-200 text-gray-600 hover:bg-gray-50"
										)}
									>
										Funnel
									</button>
								</div>
							</div>

							{newMetricType === 'mean' ? (
								<div>
									<label className="block text-xs font-medium text-gray-600 mb-1">Event</label>
									<select
										value={newMetricEvent}
										onChange={(e) => setNewMetricEvent(e.target.value)}
										className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									>
										{COMMON_EVENTS.map((event) => (
											<option key={event.value} value={event.value}>{event.label}</option>
										))}
									</select>
								</div>
							) : (
								<div>
									<label className="block text-xs font-medium text-gray-600 mb-2">Funnel Steps</label>
									<div className="space-y-2">
										{newFunnelSteps.map((step, index) => (
											<div key={index} className="flex items-center gap-2">
												<span className="text-sm text-gray-400 w-6">{index + 1}.</span>
												<select
													value={step}
													onChange={(e) => updateFunnelStep(index, e.target.value)}
													className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
												>
													{COMMON_EVENTS.map((event) => (
														<option key={event.value} value={event.value}>{event.label}</option>
													))}
												</select>
												{newFunnelSteps.length > 2 && (
													<button
														onClick={() => removeFunnelStep(index)}
														className="p-2 text-gray-400 hover:text-red-500"
													>
														<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
														</svg>
													</button>
												)}
											</div>
										))}
									</div>
									<button
										onClick={addFunnelStep}
										className="mt-2 text-sm text-blue-600 hover:text-blue-800"
									>
										+ Add step
									</button>
								</div>
							)}

							<div className="flex gap-2 pt-2">
								<button
									onClick={() => setShowAddMetric(false)}
									className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
								>
									Cancel
								</button>
								<button
									onClick={addMetric}
									className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
								>
									Add Metric
								</button>
							</div>
						</div>
					)}
				</div>

				{/* Targeting Section */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">Targeting</label>
					<div className="space-y-4 p-4 bg-gray-50 rounded-lg">
						<label className="flex items-center gap-3">
							<input
								type="checkbox"
								checked={targeting.filter_test_accounts}
								onChange={(e) => setTargeting({ ...targeting, filter_test_accounts: e.target.checked })}
								className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
							<span className="text-sm text-gray-700">Filter test accounts</span>
						</label>

						<div>
							<label className="block text-sm text-gray-600 mb-2">Traffic Allocation: <span className="font-semibold">{targeting.rollout_percentage}%</span></label>
							<input
								type="range"
								min="10"
								max="100"
								step="10"
								value={targeting.rollout_percentage}
								onChange={(e) => setTargeting({ ...targeting, rollout_percentage: parseInt(e.target.value) })}
								className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
							/>
							<div className="flex justify-between text-xs text-gray-400 mt-1">
								<span>10%</span>
								<span>50%</span>
								<span>100%</span>
							</div>
						</div>
					</div>
				</div>

				{/* Sync existing variants notice */}
				{showSyncOption && existingVariants.length > 0 && (
					<div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
						<div className="flex items-start gap-3">
							<svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
							<div>
								<p className="text-sm text-yellow-800 font-medium">Existing feature flag detected</p>
								<p className="text-xs text-yellow-700 mt-1">
									Found variants: {existingVariants.join(', ')}
								</p>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	)

	// Render review step
	const renderReviewStep = () => (
		<div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
			{/* Back button */}
			<button
				onClick={() => setStep('configure')}
				className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
			>
				<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
				</svg>
				Back to configure
			</button>

			<div className="text-center mb-6">
				<h3 className="text-lg font-semibold text-gray-900">Review Experiment</h3>
				<p className="text-sm text-gray-500 mt-1">Confirm your settings before creating</p>
			</div>

			{/* Summary */}
			<div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-6">
				<div className="flex justify-between">
					<span className="text-sm text-gray-500">Name</span>
					<span className="text-sm text-gray-900 font-medium">{experimentName}</span>
				</div>
				<div className="flex justify-between">
					<span className="text-sm text-gray-500">Feature Flag</span>
					<code className="text-sm text-gray-900 font-mono bg-gray-200 px-2 py-0.5 rounded">{experimentKey}</code>
				</div>
				<div className="flex justify-between">
					<span className="text-sm text-gray-500">Type</span>
					<span className="text-sm text-gray-900 capitalize">{experimentType}</span>
				</div>
				<div className="flex justify-between">
					<span className="text-sm text-gray-500">Traffic</span>
					<span className="text-sm text-gray-900">{targeting.rollout_percentage}%</span>
				</div>
				<div className="flex justify-between">
					<span className="text-sm text-gray-500">Filter Test Accounts</span>
					<span className="text-sm text-gray-900">{targeting.filter_test_accounts ? 'Yes' : 'No'}</span>
				</div>
			</div>

			{/* Variants summary */}
			<div className="mb-6">
				<h4 className="text-sm font-medium text-gray-700 mb-2">Variants ({cmsVariants.length + 1})</h4>
				<div className="grid grid-cols-2 gap-2">
					{/* Control variant */}
					<div className="p-3 bg-gray-100 rounded-lg flex items-center gap-3">
						<div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
							<svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
							</svg>
						</div>
						<div>
							<span className="text-sm font-medium text-gray-800">control</span>
							<span className="text-xs text-gray-500 ml-2">(baseline)</span>
						</div>
					</div>
					{/* CMS variants */}
					{cmsVariants.map((variant, index) => (
						<div key={variant} className="p-3 bg-purple-50 rounded-lg flex items-center gap-3">
							<div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
								<span className="text-sm font-bold text-purple-600">{String.fromCharCode(65 + index)}</span>
							</div>
							<div>
								<span className="text-sm font-medium text-purple-900">{variant}</span>
							</div>
						</div>
					))}
				</div>
				<p className="text-xs text-gray-500 mt-2">
					Traffic will be split evenly: ~{Math.round((targeting.rollout_percentage || 100) / (cmsVariants.length + 1))}% per variant
				</p>
			</div>

			{/* Metrics summary */}
			<div className="mb-6">
				<h4 className="text-sm font-medium text-gray-700 mb-2">Metrics ({metrics.length || 1})</h4>
				<div className="space-y-2">
					{(metrics.length > 0 ? metrics : [{
						id: 'default',
						name: 'CTA Clicks (default)',
						metric_type: 'mean',
						event_name: 'ab_test_cta_click'
					}]).map((metric) => (
						<div key={metric.id} className="p-3 bg-blue-50 rounded-lg flex items-center gap-3">
							<div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
								<svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
								</svg>
							</div>
							<div>
								<span className="text-sm font-medium text-blue-900">{metric.name}</span>
								<span className="text-xs text-blue-600 ml-2">({metric.metric_type})</span>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Error/Success messages */}
			{errorMsg && (
				<div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
					<div className="flex items-start gap-3">
						<svg className="h-5 w-5 text-red-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
							<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
						</svg>
						<p className="text-sm text-red-700">{errorMsg}</p>
					</div>
				</div>
			)}

			{successMsg && (
				<div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
					<div className="flex items-start gap-3">
						<svg className="h-5 w-5 text-green-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
							<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
						</svg>
						<p className="text-sm text-green-700">{successMsg}</p>
					</div>
				</div>
			)}
		</div>
	)

	// Footer with action buttons
	const renderFooter = () => (
		<div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-between">
			<button
				onClick={onCancel}
				className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
			>
				Cancel
			</button>

			{step === 'configure' && (
				<button
					onClick={() => setStep('review')}
					disabled={metrics.length === 0 && selectedTemplate?.id === 'custom'}
					className={clsx(
						"px-6 py-2 text-sm font-medium rounded-lg transition-colors",
						"bg-blue-600 text-white hover:bg-blue-700",
						"focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
						(metrics.length === 0 && selectedTemplate?.id === 'custom') && "opacity-50 cursor-not-allowed"
					)}
				>
					Review & Create
				</button>
			)}

			{step === 'review' && !successMsg && (
				<button
					onClick={createExperiment}
					disabled={isLoading}
					className={clsx(
						"flex items-center gap-2 px-6 py-2 text-sm font-medium rounded-lg transition-colors",
						"focus:outline-none focus:ring-2 focus:ring-offset-2",
						isLoading
							? "bg-gray-200 text-gray-400 cursor-not-allowed"
							: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
					)}
				>
					{isLoading ? (
						<>
							<svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
								<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Creating...
						</>
					) : (
						<>
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
							</svg>
							Create Experiment
						</>
					)}
				</button>
			)}
		</div>
	)

	return (
		<div className="flex flex-col h-full">
			{/* Step indicator */}
			<div className="flex items-center justify-center gap-3 py-4 border-b border-gray-200">
				{[
					{ key: 'template', label: 'Template' },
					{ key: 'configure', label: 'Configure' },
					{ key: 'review', label: 'Review' }
				].map((s, i) => (
					<div key={s.key} className="flex items-center">
						<div className="flex items-center gap-2">
							<div
								className={clsx(
									"w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold",
									step === s.key
										? "bg-blue-600 text-white"
										: ['template', 'configure', 'review'].indexOf(step) > i
											? "bg-blue-100 text-blue-600"
											: "bg-gray-200 text-gray-500"
								)}
							>
								{i + 1}
							</div>
							<span className={clsx(
								"text-sm hidden sm:inline",
								step === s.key ? "text-blue-600 font-medium" : "text-gray-500"
							)}>
								{s.label}
							</span>
						</div>
						{i < 2 && (
							<div className={clsx(
								"w-12 h-0.5 mx-3",
								['template', 'configure', 'review'].indexOf(step) > i ? "bg-blue-300" : "bg-gray-200"
							)} />
						)}
					</div>
				))}
			</div>

			{/* Step content */}
			<div className="flex-1 overflow-hidden">
				{step === 'template' && renderTemplateStep()}
				{step === 'configure' && renderConfigureStep()}
				{step === 'review' && renderReviewStep()}
			</div>

			{/* Footer */}
			{step !== 'template' && renderFooter()}
		</div>
	)
}
