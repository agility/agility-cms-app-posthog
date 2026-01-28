/**
 * Shared PostHog API utilities
 */

export interface HogQLQueryResult {
	results: any[][];
	columns: string[];
	types: string[];
	hasMore?: boolean;
}

export interface PostHogConfig {
	apiKey: string;
	projectId: string;
}

/**
 * Run a HogQL query against the PostHog API
 */
export async function runHogQLQuery(
	config: PostHogConfig,
	query: string
): Promise<HogQLQueryResult> {
	const response = await fetch(
		`https://app.posthog.com/api/projects/${config.projectId}/query/`,
		{
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${config.apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				query: {
					kind: 'HogQLQuery',
					query: query.trim()
				}
			})
		}
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`PostHog API error (${response.status}): ${errorText}`);
	}

	return response.json();
}

/**
 * Get pageviews for a specific content ID
 */
export async function getContentImpressions(
	config: PostHogConfig,
	contentID: number,
	days: number = 30
): Promise<number> {
	const result = await runHogQLQuery(config, `
		SELECT count() as impressions
		FROM events
		WHERE event = '$pageview'
			AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString(${contentID}))
			AND timestamp > now() - INTERVAL ${days} DAY
	`);

	return result.results?.[0]?.[0] || 0;
}

/**
 * Get pages where a content item appears
 */
export async function getContentPages(
	config: PostHogConfig,
	contentID: number,
	days: number = 30,
	limit: number = 5
): Promise<Array<{ pageID: number; views: number }>> {
	const result = await runHogQLQuery(config, `
		SELECT
			JSONExtractInt(properties, 'pageID') as pageID,
			count() as views
		FROM events
		WHERE event = '$pageview'
			AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString(${contentID}))
			AND JSONExtractInt(properties, 'pageID') > 0
			AND timestamp > now() - INTERVAL ${days} DAY
		GROUP BY pageID
		ORDER BY views DESC
		LIMIT ${limit}
	`);

	return result.results?.map((row: any[]) => ({
		pageID: row[0],
		views: row[1]
	})) || [];
}

/**
 * Get average scroll depth for content
 */
export async function getContentScrollDepth(
	config: PostHogConfig,
	contentID: number,
	days: number = 30
): Promise<number> {
	const result = await runHogQLQuery(config, `
		SELECT avg(JSONExtractInt(properties, 'depth')) as avgDepth
		FROM events
		WHERE event = 'scroll_milestone'
			AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString(${contentID}))
			AND timestamp > now() - INTERVAL ${days} DAY
	`);

	return Math.round(result.results?.[0]?.[0] || 0);
}

/**
 * Get CTA clicks for content
 */
export async function getContentCTAClicks(
	config: PostHogConfig,
	contentID: number,
	days: number = 30
): Promise<number> {
	const result = await runHogQLQuery(config, `
		SELECT count() as clicks
		FROM events
		WHERE event = 'outbound_link_clicked'
			AND JSONExtractInt(properties, 'contentID') = ${contentID}
			AND timestamp > now() - INTERVAL ${days} DAY
	`);

	return result.results?.[0]?.[0] || 0;
}

/**
 * Get experiment exposures for content
 */
export async function getExperimentExposures(
	config: PostHogConfig,
	contentID: number,
	experimentKey: string,
	days: number = 30
): Promise<Array<{ variant: string; count: number }>> {
	const result = await runHogQLQuery(config, `
		SELECT
			JSONExtractString(properties, 'variant') as variant,
			count() as exposures
		FROM events
		WHERE event = 'experiment_exposure'
			AND JSONExtractInt(properties, 'contentID') = ${contentID}
			AND JSONExtractString(properties, 'experimentKey') = '${experimentKey}'
			AND timestamp > now() - INTERVAL ${days} DAY
		GROUP BY variant
		ORDER BY exposures DESC
	`);

	return result.results?.map((row: any[]) => ({
		variant: row[0],
		count: row[1]
	})) || [];
}

/**
 * Get time on page distribution for content
 */
export async function getContentTimeDistribution(
	config: PostHogConfig,
	contentID: number,
	days: number = 30
): Promise<Array<{ seconds: number; count: number }>> {
	const result = await runHogQLQuery(config, `
		SELECT
			JSONExtractInt(properties, 'seconds') as seconds,
			count() as count
		FROM events
		WHERE event = 'time_milestone'
			AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString(${contentID}))
			AND timestamp > now() - INTERVAL ${days} DAY
		GROUP BY seconds
		ORDER BY seconds
	`);

	return result.results?.map((row: any[]) => ({
		seconds: row[0],
		count: row[1]
	})) || [];
}

/**
 * Get scroll depth distribution for content
 */
export async function getContentScrollDistribution(
	config: PostHogConfig,
	contentID: number,
	days: number = 30
): Promise<Array<{ depth: number; count: number }>> {
	const result = await runHogQLQuery(config, `
		SELECT
			JSONExtractInt(properties, 'depth') as depth,
			count() as count
		FROM events
		WHERE event = 'scroll_milestone'
			AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString(${contentID}))
			AND timestamp > now() - INTERVAL ${days} DAY
		GROUP BY depth
		ORDER BY depth
	`);

	return result.results?.map((row: any[]) => ({
		depth: row[0],
		count: row[1]
	})) || [];
}
