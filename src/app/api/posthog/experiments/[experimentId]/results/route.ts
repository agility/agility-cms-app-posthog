/**
 * PostHog Experiment Results API Route
 *
 * This server-side route fetches experiment results from PostHog's Query API.
 * It's necessary because PostHog's experiment results are fetched via the
 * ExperimentQuery kind through POST /api/projects/{id}/query/, which requires
 * server-to-server communication to avoid CORS issues.
 *
 * The route:
 * 1. Fetches the experiment details to get configured metrics
 * 2. Queries results for each metric using ExperimentQuery
 * 3. Transforms the response into a format the frontend expects
 */

import { NextRequest, NextResponse } from 'next/server';

// PostHog experiment metric configuration
interface ExperimentMetric {
	kind: string;
	name: string;
	uuid: string;
	series: Array<{ kind: string; event: string }>;
	metric_type: string;
}

// PostHog experiment structure
interface Experiment {
	id: number;
	metrics: ExperimentMetric[];
	parameters?: {
		feature_flag_variants?: Array<{ key: string; rollout_percentage: number }>;
	};
}

// Result structure from PostHog's ExperimentQuery
interface MetricResult {
	metric: ExperimentMetric;
	result: {
		baseline: VariantData;
		variant_results: VariantData[];
		probability?: Record<string, number> | null;
		significant?: boolean | null;
		credible_intervals?: Record<string, [number, number]>;
	};
}

// Variant data from PostHog's ExperimentQuery response
interface VariantData {
	key: string;
	number_of_samples: number;
	step_counts?: number[];
	success_count?: number;
	failure_count?: number;
	chance_to_win?: number | null;
	// For mean metrics
	sum?: number;
	sum_squares?: number;
}

/**
 * GET /api/posthog/experiments/[experimentId]/results
 *
 * Required headers:
 * - x-posthog-api-key: PostHog Personal API key
 * - x-posthog-project-id: PostHog project ID
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ experimentId: string }> }
) {
	const { experimentId } = await params;

	// Extract credentials from headers
	const apiKey = request.headers.get('x-posthog-api-key');
	const projectId = request.headers.get('x-posthog-project-id');

	if (!apiKey || !projectId) {
		return NextResponse.json(
			{ error: 'Missing required headers: x-posthog-api-key and x-posthog-project-id' },
			{ status: 400 }
		);
	}

	try {
		// Step 1: Fetch the experiment to get its configured metrics
		const experimentResponse = await fetch(
			`https://us.posthog.com/api/projects/${projectId}/experiments/${experimentId}/`,
			{
				headers: {
					'Authorization': `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
			}
		);

		if (!experimentResponse.ok) {
			return NextResponse.json(
				{ error: `Failed to fetch experiment: ${experimentResponse.status}` },
				{ status: experimentResponse.status }
			);
		}

		const experiment: Experiment = await experimentResponse.json();

		// Experiments without metrics can't have results
		if (!experiment.metrics || experiment.metrics.length === 0) {
			return NextResponse.json({ noResults: true, reason: 'No metrics configured' });
		}

		// Step 2: Query results for each metric using PostHog's ExperimentQuery
		const metricResults = await Promise.all(
			experiment.metrics.map(async (metric) => {
				const queryBody = {
					query: {
						kind: 'ExperimentQuery',
						experiment_id: parseInt(experimentId),
						metric: metric
					},
					refresh: 'force_blocking'
				};

				const queryResponse = await fetch(
					`https://us.posthog.com/api/projects/${projectId}/query/`,
					{
						method: 'POST',
						headers: {
							'Authorization': `Bearer ${apiKey}`,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify(queryBody)
					}
				);

				if (!queryResponse.ok) {
					return null;
				}

				const result = await queryResponse.json();
				return { metric, result };
			})
		);

		const validResults = metricResults.filter((r): r is NonNullable<typeof r> => r !== null);

		if (validResults.length === 0) {
			return NextResponse.json({ noResults: true, reason: 'No valid metric results' });
		}

		// Step 3: Transform results into the format expected by the frontend
		const transformedResults = transformResults(validResults);

		return NextResponse.json(transformedResults);
	} catch (error) {
		return NextResponse.json(
			{ error: 'Failed to fetch experiment results' },
			{ status: 500 }
		);
	}
}

/**
 * Transform PostHog's ExperimentQuery response into the format expected by ExperimentResults component
 *
 * PostHog's response structure:
 * - baseline: control variant data
 * - variant_results: array of other variant data
 * - Each variant has: key, number_of_samples, step_counts, chance_to_win
 *
 * Transformed structure:
 * - variants: array of all variants with exposure counts
 * - probability: map of variant key to win probability
 * - significant: whether results are statistically significant
 * - primary_metric_results: metric-specific conversion data
 */
function transformResults(metricResults: MetricResult[]) {
	// Collect all variant data (baseline + other variants)
	const allVariants: Array<{
		key: string;
		count: number;
		absolute_exposure: number;
		success_count?: number;
		failure_count?: number;
	}> = [];

	// Use the primary (first) metric result for variant exposure data
	const primaryResult = metricResults[0]?.result;

	if (primaryResult) {
		// Add baseline (control) variant
		if (primaryResult.baseline) {
			// For mean metrics, use 'sum' field; for funnel metrics, use 'step_counts[0]'
			const baselineCount = primaryResult.baseline.step_counts?.[0]
				?? primaryResult.baseline.sum
				?? primaryResult.baseline.success_count
				?? 0;
			allVariants.push({
				key: primaryResult.baseline.key,
				count: primaryResult.baseline.number_of_samples || 0,
				absolute_exposure: primaryResult.baseline.number_of_samples || 0,
				success_count: baselineCount,
				failure_count: primaryResult.baseline.failure_count
			});
		}

		// Add other variants from variant_results array
		if (primaryResult.variant_results) {
			for (const variant of primaryResult.variant_results) {
				// For mean metrics, use 'sum' field; for funnel metrics, use 'step_counts[0]'
				const variantCount = variant.step_counts?.[0]
					?? variant.sum
					?? variant.success_count
					?? 0;
				allVariants.push({
					key: variant.key,
					count: variant.number_of_samples || 0,
					absolute_exposure: variant.number_of_samples || 0,
					success_count: variantCount,
					failure_count: variant.failure_count
				});
			}
		}
	}

	// Extract win probabilities from each variant's chance_to_win field
	const probability: Record<string, number> = {};
	if (primaryResult?.baseline?.chance_to_win != null) {
		probability[primaryResult.baseline.key] = primaryResult.baseline.chance_to_win;
	}
	if (primaryResult?.variant_results) {
		for (const variant of primaryResult.variant_results) {
			if (variant.chance_to_win != null) {
				probability[variant.key] = variant.chance_to_win;
			}
		}
	}

	// Build metric-specific results with conversion rates
	const primary_metric_results = metricResults.map(({ metric, result }) => ({
		action: { name: metric.name, id: metric.uuid },
		variants: [
			// Baseline variant
			...(result.baseline ? [{
				key: result.baseline.key,
				// For mean metrics, use 'sum' field; for funnel metrics, use 'step_counts[0]'
				count: result.baseline.step_counts?.[0] ?? result.baseline.sum ?? 0,
				exposure: result.baseline.number_of_samples || 0,
				absolute_exposure: result.baseline.number_of_samples || 0,
				success_count: result.baseline.step_counts?.[0] ?? result.baseline.sum ?? result.baseline.success_count,
				failure_count: result.baseline.failure_count
			}] : []),
			// Other variants
			...(result.variant_results || []).map(v => ({
				key: v.key,
				// For mean metrics, use 'sum' field; for funnel metrics, use 'step_counts[0]'
				count: v.step_counts?.[0] ?? v.sum ?? 0,
				exposure: v.number_of_samples || 0,
				absolute_exposure: v.number_of_samples || 0,
				success_count: v.step_counts?.[0] ?? v.sum ?? v.success_count,
				failure_count: v.failure_count
			}))
		]
	}));

	return {
		variants: allVariants,
		probability,
		significant: primaryResult?.significant ?? false,
		credible_intervals: primaryResult?.credible_intervals || {},
		primary_metric_results
	};
}
