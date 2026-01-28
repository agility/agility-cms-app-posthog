"use client"

import React, { useState, useEffect } from 'react';
import { PostHogLoader } from './PostHogLoader';
import {
	runHogQLQuery,
	type PostHogConfig
} from '../lib/posthog';

interface ContentAnalyticsProps {
	contentID?: number;
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
	postHogAPIKey,
	postHogProjectId
}: ContentAnalyticsProps) {
	const [stats, setStats] = useState<ContentStats | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
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
					// Query 1: Count impressions
					runHogQLQuery(config, `
						SELECT count() as impressions
						FROM events
						WHERE event = '$pageview'
							AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString(${contentID}))
							AND timestamp > now() - INTERVAL 30 DAY
					`).catch(() => ({ results: [[0]] })),

					// Query 2: Pages this content appears on
					runHogQLQuery(config, `
						SELECT
							JSONExtractInt(properties, 'pageID') as pageID,
							count() as views
						FROM events
						WHERE event = '$pageview'
							AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString(${contentID}))
							AND JSONExtractInt(properties, 'pageID') > 0
							AND timestamp > now() - INTERVAL 30 DAY
						GROUP BY pageID
						ORDER BY views DESC
						LIMIT 5
					`).catch(() => ({ results: [] })),

					// Query 3: Average scroll depth
					runHogQLQuery(config, `
						SELECT avg(JSONExtractInt(properties, 'depth')) as avgDepth
						FROM events
						WHERE event = 'scroll_milestone'
							AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString(${contentID}))
							AND timestamp > now() - INTERVAL 30 DAY
					`).catch(() => ({ results: [[0]] })),

					// Query 4: CTA clicks
					runHogQLQuery(config, `
						SELECT count() as clicks
						FROM events
						WHERE event = 'outbound_link_clicked'
							AND JSONExtractInt(properties, 'contentID') = ${contentID}
							AND timestamp > now() - INTERVAL 30 DAY
					`).catch(() => ({ results: [[0]] })),

					// Query 5: Scroll depth distribution
					runHogQLQuery(config, `
						SELECT
							JSONExtractInt(properties, 'depth') as depth,
							count() as count
						FROM events
						WHERE event = 'scroll_milestone'
							AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString(${contentID}))
							AND timestamp > now() - INTERVAL 30 DAY
						GROUP BY depth
						ORDER BY depth
					`).catch(() => ({ results: [] })),

					// Query 6: Time distribution
					runHogQLQuery(config, `
						SELECT
							JSONExtractInt(properties, 'seconds') as seconds,
							count() as count
						FROM events
						WHERE event = 'time_milestone'
							AND has(JSONExtractArrayRaw(properties, 'contentIDs'), toString(${contentID}))
							AND timestamp > now() - INTERVAL 30 DAY
						GROUP BY seconds
						ORDER BY seconds
					`).catch(() => ({ results: [] }))
				]);

				// Process scroll distribution
				const scrollDistRaw: any[][] = scrollDistResult.results || [];
				const totalScrollEvents = scrollDistRaw.reduce((sum, row) => sum + (row[1] || 0), 0);
				const scrollDistribution = scrollDistRaw.map((row) => ({
					depth: row[0] as number,
					count: row[1] as number,
					percent: totalScrollEvents > 0 ? Math.round((row[1] / totalScrollEvents) * 100) : 0
				}));

				// Process time distribution
				const timeDistRaw: any[][] = timeDistResult.results || [];
				const totalTimeEvents = timeDistRaw.reduce((sum, row) => sum + (row[1] || 0), 0);
				const timeDistribution = timeDistRaw.map((row) => ({
					seconds: row[0] as number,
					count: row[1] as number,
					percent: totalTimeEvents > 0 ? Math.round((row[1] / totalTimeEvents) * 100) : 0
				}));

				const pagesRaw: any[][] = pagesResult.results || [];
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
	}, [contentID, postHogAPIKey, postHogProjectId]);

	if (!contentID || contentID <= 0) {
		return (
			<div className="text-center py-8 text-gray-500">
				<svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				<p className="font-medium">Save this content item first</p>
				<p className="text-sm mt-1">Analytics will be available after saving.</p>
			</div>
		);
	}

	if (loading) {
		return <PostHogLoader title="Loading Analytics" message="Fetching data from PostHog..." />;
	}

	if (error) {
		return (
			<div className="bg-red-50 border border-red-200 rounded-md p-3">
				<p className="text-red-800 text-sm font-medium">Error loading analytics</p>
				<p className="text-red-600 text-sm mt-1">{error}</p>
			</div>
		);
	}

	if (!stats) {
		return (
			<div className="text-center py-8 text-gray-500">
				<p>No analytics data available yet.</p>
			</div>
		);
	}

	const hasData = stats.impressions > 0 || stats.ctaClicks > 0 || stats.pages.length > 0;

	return (
		<div className="space-y-4">
			<div className="text-gray-500 uppercase text-xs font-semibold">
				Content Analytics (Last 30 Days)
			</div>

			{!hasData ? (
				<div className="text-center py-6 bg-gray-50 rounded-lg">
					<svg className="mx-auto h-10 w-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
					</svg>
					<p className="text-gray-600 text-sm font-medium">No data yet</p>
					<p className="text-gray-400 text-xs mt-1">
						Analytics will appear once this content receives traffic.
					</p>
				</div>
			) : (
				<>
					{/* Stats Grid */}
					<div className="grid grid-cols-2 gap-3">
						<StatCard
							value={stats.impressions.toLocaleString()}
							label="Impressions"
							icon={
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
								</svg>
							}
						/>
						<StatCard
							value={stats.uniquePages.toString()}
							label="Pages Using"
							icon={
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
								</svg>
							}
						/>
						<StatCard
							value={`${stats.avgScrollDepth}%`}
							label="Avg Scroll"
							icon={
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
								</svg>
							}
						/>
						<StatCard
							value={stats.ctaClicks.toLocaleString()}
							label="CTA Clicks"
							icon={
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
								</svg>
							}
						/>
					</div>

					{/* Scroll Distribution */}
					{stats.scrollDistribution.length > 0 && (
						<div>
							<div className="text-sm font-medium text-gray-700 mb-2">Scroll Depth</div>
							<div className="space-y-2">
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

					{/* Time Distribution */}
					{stats.timeDistribution.length > 0 && (
						<div>
							<div className="text-sm font-medium text-gray-700 mb-2">Time on Page</div>
							<div className="space-y-2">
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

					{/* Pages List */}
					{stats.pages.length > 0 && (
						<div>
							<div className="text-sm font-medium text-gray-700 mb-2">
								Top Pages Using This Content
							</div>
							<div className="space-y-2">
								{stats.pages.map((page) => (
									<div
										key={page.pageID}
										className="flex justify-between items-center text-sm bg-gray-50 rounded px-3 py-2"
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
				</>
			)}

			{/* View in PostHog Link */}
			{postHogProjectId && (
				<a
					href={`https://app.posthog.com/project/${postHogProjectId}/events?properties=[{"key":"contentIDs","value":"${contentID}","operator":"icontains","type":"event"}]`}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center justify-center w-full px-3 py-2 text-sm font-medium bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors"
				>
					View in PostHog
					<svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
					</svg>
				</a>
			)}
		</div>
	);
}

// Helper Components

function StatCard({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
	return (
		<div className="bg-gray-50 rounded-lg p-3">
			<div className="flex items-center gap-2 text-gray-400 mb-1">
				{icon}
			</div>
			<div className="text-2xl font-bold text-gray-900">{value}</div>
			<div className="text-xs text-gray-500">{label}</div>
		</div>
	);
}

function ProgressBar({ label, value, count }: { label: string; value: number; count: number }) {
	return (
		<div className="flex items-center gap-3 text-sm">
			<span className="w-12 text-gray-500 text-right">{label}</span>
			<div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
				<div
					className="h-full bg-indigo-500 rounded-full transition-all duration-300"
					style={{ width: `${Math.min(value, 100)}%` }}
				/>
			</div>
			<span className="w-16 text-gray-600 text-right">{count.toLocaleString()}</span>
		</div>
	);
}

function formatSeconds(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}
