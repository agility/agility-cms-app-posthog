"use client"

/**
 * ContentAnalytics Component
 *
 * Displays analytics for a specific content item from PostHog.
 * Queries are filtered by contentID and optionally by locale.
 *
 * Metrics displayed:
 * - Views: Total pageviews where this content appeared
 * - Pages: Number of unique pages featuring this content
 * - Scroll: Average scroll depth on pages with this content
 * - Clicks: Outbound link clicks from this content
 * - Scroll Distribution: Breakdown of how far users scroll
 * - Time Distribution: Breakdown of time spent on page
 * - Top Pages: Pages where this content gets the most views
 *
 * All data is filtered to the last 30 days.
 */

import React, { useState, useEffect } from 'react';
import { PostHogLoader } from './PostHogLoader';
import {
	runHogQLQuery,
	type PostHogConfig
} from '../lib/posthog';

interface ContentAnalyticsProps {
	contentID?: number;
	locale?: string | null;
	postHogAPIKey: string | null;
	postHogProjectId: string | null;
}

interface ContentStats {
	impressions: number;
	uniquePages: number;
	avgScrollDepth: number;
	ctaClicks: number;
	pages: Array<{ pageID: number; views: number }>;
	scrollDistribution: Array<{ depth: number; count: number; percent: number }>;
	timeDistribution: Array<{ seconds: number; count: number; percent: number }>;
}

export function ContentAnalytics({
	contentID,
	locale,
	postHogAPIKey,
	postHogProjectId
}: ContentAnalyticsProps) {
	const [stats, setStats] = useState<ContentStats | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Skip fetching if required parameters are missing
		if (!contentID || !postHogAPIKey || !postHogProjectId) {
			return;
		}

		const fetchStats = async () => {
			setLoading(true);
			setError(null);

			const config: PostHogConfig = {
				apiKey: postHogAPIKey,
				projectId: postHogProjectId
			};

			// Build locale filter clause if locale is provided
			// This filters events to only those matching the current content locale
			const localeFilter = locale ? `AND JSONExtractString(properties, 'locale') = '${locale}'` : '';

			// Query 1: Count total pageview impressions for this content
			// Uses has() to check if contentID exists in the contentIDs array property
			const impressionsQuery = `
				SELECT count() as impressions
				FROM events
				WHERE event = '$pageview'
					AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString(${contentID}))
					${localeFilter}
					AND timestamp > now() - INTERVAL 30 DAY
			`;

			// Query 2: Get top pages where this content appears
			// Groups by pageID and orders by view count
			const pagesQuery = `
				SELECT
					JSONExtractInt(properties, 'pageID') as pageID,
					count() as views
				FROM events
				WHERE event = '$pageview'
					AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString(${contentID}))
					AND JSONExtractInt(properties, 'pageID') > 0
					${localeFilter}
					AND timestamp > now() - INTERVAL 30 DAY
				GROUP BY pageID
				ORDER BY views DESC
				LIMIT 5
			`;

			// Query 3: Calculate average scroll depth from scroll_milestone events
			const scrollQuery = `
				SELECT avg(JSONExtractInt(properties, 'depth')) as avgDepth
				FROM events
				WHERE event = 'scroll_milestone'
					AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString(${contentID}))
					${localeFilter}
					AND timestamp > now() - INTERVAL 30 DAY
			`;

			// Query 4: Count outbound link clicks from this content
			const ctaQuery = `
				SELECT count() as clicks
				FROM events
				WHERE event = 'outbound_link_clicked'
					AND JSONExtractInt(properties, 'contentID') = ${contentID}
					${localeFilter}
					AND timestamp > now() - INTERVAL 30 DAY
			`;

			// Query 5: Get scroll depth distribution for visualization
			const scrollDistQuery = `
				SELECT
					JSONExtractInt(properties, 'depth') as depth,
					count() as count
				FROM events
				WHERE event = 'scroll_milestone'
					AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString(${contentID}))
					${localeFilter}
					AND timestamp > now() - INTERVAL 30 DAY
				GROUP BY depth
				ORDER BY depth
			`;

			// Query 6: Get time on page distribution for visualization
			const timeDistQuery = `
				SELECT
					JSONExtractInt(properties, 'seconds') as seconds,
					count() as count
				FROM events
				WHERE event = 'time_milestone'
					AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString(${contentID}))
					${localeFilter}
					AND timestamp > now() - INTERVAL 30 DAY
				GROUP BY seconds
				ORDER BY seconds
			`;

			try {
				// Run all queries in parallel for better performance
				const [
					impressionsResult,
					pagesResult,
					scrollResult,
					ctaResult,
					scrollDistResult,
					timeDistResult
				] = await Promise.all([
					runHogQLQuery(config, impressionsQuery).catch(() => ({ results: [[0]] })),
					runHogQLQuery(config, pagesQuery).catch(() => ({ results: [] })),
					runHogQLQuery(config, scrollQuery).catch(() => ({ results: [[0]] })),
					runHogQLQuery(config, ctaQuery).catch(() => ({ results: [[0]] })),
					runHogQLQuery(config, scrollDistQuery).catch(() => ({ results: [] })),
					runHogQLQuery(config, timeDistQuery).catch(() => ({ results: [] }))
				]);

				// Process scroll distribution - calculate percentages for each depth
				const scrollDistRaw: any[][] = scrollDistResult.results || [];
				const totalScrollEvents = scrollDistRaw.reduce((sum, row) => sum + (row[1] || 0), 0);
				const scrollDistribution = scrollDistRaw.map((row) => ({
					depth: row[0] as number,
					count: row[1] as number,
					percent: totalScrollEvents > 0 ? Math.round((row[1] / totalScrollEvents) * 100) : 0
				}));

				// Process time distribution - calculate percentages for each time bucket
				const timeDistRaw: any[][] = timeDistResult.results || [];
				const totalTimeEvents = timeDistRaw.reduce((sum, row) => sum + (row[1] || 0), 0);
				const timeDistribution = timeDistRaw.map((row) => ({
					seconds: row[0] as number,
					count: row[1] as number,
					percent: totalTimeEvents > 0 ? Math.round((row[1] / totalTimeEvents) * 100) : 0
				}));

				// Process pages data
				const pagesRaw: any[][] = pagesResult.results || [];

				// Set the consolidated stats object
				setStats({
					impressions: impressionsResult.results?.[0]?.[0] || 0,
					uniquePages: pagesRaw.length,
					avgScrollDepth: Math.round(scrollResult.results?.[0]?.[0] || 0),
					ctaClicks: ctaResult.results?.[0]?.[0] || 0,
					pages: pagesRaw.map((row) => ({
						pageID: row[0] as number,
						views: row[1] as number
					})),
					scrollDistribution,
					timeDistribution
				});
			} catch (err) {
				console.error('Error fetching content analytics:', err);
				setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
			} finally {
				setLoading(false);
			}
		};

		fetchStats();
	}, [contentID, locale, postHogAPIKey, postHogProjectId]);

	// Show prompt to save content if no contentID
	if (!contentID || contentID <= 0) {
		return (
			<div className="text-center py-4 text-gray-500">
				<p className="text-xs font-medium">Save content first</p>
				<p className="text-[10px] mt-0.5">Analytics available after saving.</p>
			</div>
		);
	}

	// Show loading spinner while fetching data
	if (loading) {
		return (
			<div className="flex items-center gap-2 text-gray-500 text-xs py-4">
				<div className="animate-spin h-3 w-3 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
				Loading...
			</div>
		);
	}

	// Show error message if query failed
	if (error) {
		return (
			<div className="bg-red-50 rounded p-2">
				<p className="text-red-800 text-xs">{error}</p>
			</div>
		);
	}

	// Show empty state if no stats available
	if (!stats) {
		return (
			<p className="text-center py-4 text-gray-400 text-xs">No data available</p>
		);
	}

	// Check if there's any meaningful data to display
	const hasData = stats.impressions > 0 || stats.ctaClicks > 0 || stats.pages.length > 0;

	return (
		<div className="space-y-2">
			<div className="text-[10px] text-gray-400 uppercase">Last 30 Days</div>

			{!hasData ? (
				// Empty state when no traffic data exists
				<div className="text-center py-3 bg-gray-50 rounded">
					<p className="text-gray-500 text-xs">No data yet</p>
					<p className="text-gray-400 text-[10px] mt-0.5">Waiting for traffic</p>
				</div>
			) : (
				<>
					{/* Stats Grid - 2x2 layout showing key metrics */}
					<div className="grid grid-cols-2 gap-1.5">
						<StatCard value={stats.impressions.toLocaleString()} label="Views" />
						<StatCard value={stats.uniquePages.toString()} label="Pages" />
						<StatCard value={`${stats.avgScrollDepth}%`} label="Scroll" />
						<StatCard value={stats.ctaClicks.toLocaleString()} label="Clicks" />
					</div>

					{/* Scroll Depth Distribution - shows how far users scroll */}
					{stats.scrollDistribution.length > 0 && (
						<div>
							<div className="text-[10px] text-gray-400 uppercase mb-1">Scroll Depth</div>
							<div className="space-y-1">
								{stats.scrollDistribution.map((item) => (
									<ProgressBar
										key={item.depth}
										label={`${item.depth}%`}
										value={item.percent}
										count={item.count}
									/>
								))}
							</div>
						</div>
					)}

					{/* Time on Page Distribution - shows how long users stay */}
					{stats.timeDistribution.length > 0 && (
						<div>
							<div className="text-[10px] text-gray-400 uppercase mb-1">Time on Page</div>
							<div className="space-y-1">
								{stats.timeDistribution.map((item) => (
									<ProgressBar
										key={item.seconds}
										label={formatSeconds(item.seconds)}
										value={item.percent}
										count={item.count}
									/>
								))}
							</div>
						</div>
					)}

					{/* Top Pages List - pages where this content gets most views */}
					{stats.pages.length > 0 && (
						<div>
							<div className="text-[10px] text-gray-400 uppercase mb-1">Top Pages</div>
							<div className="space-y-0.5">
								{stats.pages.map((page) => (
									<div
										key={page.pageID}
										className="flex justify-between items-center text-xs bg-gray-50 rounded px-2 py-1"
									>
										<span className="text-gray-500">#{page.pageID}</span>
										<span className="text-gray-700 font-medium">{page.views.toLocaleString()}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</>
			)}

			{/* Deep link to view events in PostHog dashboard */}
			{postHogProjectId && (
				<a
					href={`https://app.posthog.com/project/${postHogProjectId}/events?properties=[{"key":"contentIDs","value":"${contentID}","operator":"icontains","type":"event"}]`}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center text-xs text-indigo-600 hover:text-indigo-800"
				>
					View in PostHog →
				</a>
			)}
		</div>
	);
}

// ============================================================================
// Helper Components - Compact styling for narrow sidebar panels
// ============================================================================

/**
 * StatCard - Displays a single metric with value and label
 */
function StatCard({ value, label }: { value: string; label: string }) {
	return (
		<div className="bg-gray-50 rounded p-2 text-center">
			<div className="text-base font-bold text-gray-900">{value}</div>
			<div className="text-[10px] text-gray-500">{label}</div>
		</div>
	);
}

/**
 * ProgressBar - Displays a horizontal bar with label, fill percentage, and count
 */
function ProgressBar({ label, value, count }: { label: string; value: number; count: number }) {
	return (
		<div className="flex items-center gap-2 text-xs">
			<span className="w-8 text-gray-500 text-right">{label}</span>
			<div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
				<div
					className="h-full bg-indigo-500 rounded-full"
					style={{ width: `${Math.min(value, 100)}%` }}
				/>
			</div>
			<span className="w-8 text-gray-500 text-right">{count}</span>
		</div>
	);
}

/**
 * Formats seconds into a human-readable time string
 * Examples: 30 -> "30s", 90 -> "1m 30s", 120 -> "2m"
 */
function formatSeconds(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}
