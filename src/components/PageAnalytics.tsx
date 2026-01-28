"use client"

import React, { useState, useEffect } from 'react';
import { PostHogLoader } from './PostHogLoader';
import { runHogQLQuery, type PostHogConfig } from '../lib/posthog';

interface PageAnalyticsProps {
	pageID: number | null;
	pageName: string | null;
	postHogAPIKey: string | null;
	postHogProjectId: string | null;
}

interface PageStats {
	pageViews: number;
	uniqueVisitors: number;
	avgScrollDepth: number;
	avgTimeOnPage: number;
	bounceRate: number;
	scrollDistribution: Array<{ depth: number; count: number; percent: number }>;
	timeDistribution: Array<{ seconds: number; count: number; percent: number }>;
	topReferrers: Array<{ referrer: string; count: number }>;
	topUtmSources: Array<{ source: string; count: number }>;
}

export function PageAnalytics({
	pageID,
	pageName,
	postHogAPIKey,
	postHogProjectId
}: PageAnalyticsProps) {
	const [stats, setStats] = useState<PageStats | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!pageID || !postHogAPIKey || !postHogProjectId) {
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
				// Run all queries in parallel
				const [
					pageViewsResult,
					uniqueVisitorsResult,
					scrollResult,
					scrollDistResult,
					timeDistResult,
					referrersResult,
					utmSourcesResult
				] = await Promise.all([
					// Query 1: Total page views
					runHogQLQuery(config, `
						SELECT count() as pageViews
						FROM events
						WHERE event = '$pageview'
							AND JSONExtractInt(properties, 'pageID') = ${pageID}
							AND timestamp > now() - INTERVAL 30 DAY
					`).catch(() => ({ results: [[0]] })),

					// Query 2: Unique visitors
					runHogQLQuery(config, `
						SELECT count(DISTINCT distinct_id) as uniqueVisitors
						FROM events
						WHERE event = '$pageview'
							AND JSONExtractInt(properties, 'pageID') = ${pageID}
							AND timestamp > now() - INTERVAL 30 DAY
					`).catch(() => ({ results: [[0]] })),

					// Query 3: Average scroll depth
					runHogQLQuery(config, `
						SELECT avg(JSONExtractInt(properties, 'depth')) as avgDepth
						FROM events
						WHERE event = 'scroll_milestone'
							AND JSONExtractInt(properties, 'pageID') = ${pageID}
							AND timestamp > now() - INTERVAL 30 DAY
					`).catch(() => ({ results: [[0]] })),

					// Query 4: Scroll depth distribution
					runHogQLQuery(config, `
						SELECT
							JSONExtractInt(properties, 'depth') as depth,
							count() as count
						FROM events
						WHERE event = 'scroll_milestone'
							AND JSONExtractInt(properties, 'pageID') = ${pageID}
							AND timestamp > now() - INTERVAL 30 DAY
						GROUP BY depth
						ORDER BY depth
					`).catch(() => ({ results: [] })),

					// Query 5: Time distribution
					runHogQLQuery(config, `
						SELECT
							JSONExtractInt(properties, 'seconds') as seconds,
							count() as count
						FROM events
						WHERE event = 'time_milestone'
							AND JSONExtractInt(properties, 'pageID') = ${pageID}
							AND timestamp > now() - INTERVAL 30 DAY
						GROUP BY seconds
						ORDER BY seconds
					`).catch(() => ({ results: [] })),

					// Query 6: Top referrers
					runHogQLQuery(config, `
						SELECT
							JSONExtractString(properties, '$referrer') as referrer,
							count() as count
						FROM events
						WHERE event = '$pageview'
							AND JSONExtractInt(properties, 'pageID') = ${pageID}
							AND JSONExtractString(properties, '$referrer') != ''
							AND timestamp > now() - INTERVAL 30 DAY
						GROUP BY referrer
						ORDER BY count DESC
						LIMIT 5
					`).catch(() => ({ results: [] })),

					// Query 7: Top UTM sources
					runHogQLQuery(config, `
						SELECT
							JSONExtractString(properties, 'utm_source') as source,
							count() as count
						FROM events
						WHERE event = '$pageview'
							AND JSONExtractInt(properties, 'pageID') = ${pageID}
							AND JSONExtractString(properties, 'utm_source') != ''
							AND timestamp > now() - INTERVAL 30 DAY
						GROUP BY source
						ORDER BY count DESC
						LIMIT 5
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

				// Process referrers
				const referrersRaw: any[][] = referrersResult.results || [];
				const topReferrers = referrersRaw.map((row) => ({
					referrer: (row[0] as string) || 'Direct',
					count: row[1] as number
				}));

				// Process UTM sources
				const utmSourcesRaw: any[][] = utmSourcesResult.results || [];
				const topUtmSources = utmSourcesRaw.map((row) => ({
					source: row[0] as string,
					count: row[1] as number
				}));

				// Calculate average time on page from time milestones
				let avgTimeOnPage = 0;
				if (timeDistRaw.length > 0) {
					const weightedSum = timeDistRaw.reduce((sum, row) => sum + (row[0] * row[1]), 0);
					avgTimeOnPage = Math.round(weightedSum / totalTimeEvents);
				}

				setStats({
					pageViews: pageViewsResult.results?.[0]?.[0] || 0,
					uniqueVisitors: uniqueVisitorsResult.results?.[0]?.[0] || 0,
					avgScrollDepth: Math.round(scrollResult.results?.[0]?.[0] || 0),
					avgTimeOnPage,
					bounceRate: 0, // Would need session data to calculate
					scrollDistribution,
					timeDistribution,
					topReferrers,
					topUtmSources
				});
			} catch (err) {
				console.error('Error fetching page analytics:', err);
				setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
			} finally {
				setLoading(false);
			}
		};

		fetchStats();
	}, [pageID, postHogAPIKey, postHogProjectId]);

	if (!pageID) {
		return (
			<div className="text-center py-8 text-gray-500">
				<svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				<p className="font-medium">No page selected</p>
				<p className="text-sm mt-1">Select a page to view analytics.</p>
			</div>
		);
	}

	if (loading) {
		return <PostHogLoader title="Loading Page Analytics" message="Fetching data from PostHog..." />;
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

	const hasData = stats.pageViews > 0;

	return (
		<div className="space-y-4">
			{/* Header */}
			<div>
				<div className="text-gray-500 uppercase text-xs font-semibold">Page Analytics</div>
				{pageName && (
					<div className="text-lg font-medium text-gray-900 mt-1">{pageName}</div>
				)}
				<div className="text-xs text-gray-400 mt-0.5">Last 30 Days</div>
			</div>

			{!hasData ? (
				<div className="text-center py-6 bg-gray-50 rounded-lg">
					<svg className="mx-auto h-10 w-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
					</svg>
					<p className="text-gray-600 text-sm font-medium">No data yet</p>
					<p className="text-gray-400 text-xs mt-1">
						Analytics will appear once this page receives traffic.
					</p>
				</div>
			) : (
				<>
					{/* Stats Grid */}
					<div className="grid grid-cols-2 gap-3">
						<StatCard
							value={stats.pageViews.toLocaleString()}
							label="Page Views"
							icon={
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
								</svg>
							}
						/>
						<StatCard
							value={stats.uniqueVisitors.toLocaleString()}
							label="Unique Visitors"
							icon={
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
								</svg>
							}
						/>
						<StatCard
							value={`${stats.avgScrollDepth}%`}
							label="Avg Scroll Depth"
							icon={
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
								</svg>
							}
						/>
						<StatCard
							value={formatSeconds(stats.avgTimeOnPage)}
							label="Avg Time on Page"
							icon={
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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

					{/* Top Referrers */}
					{stats.topReferrers.length > 0 && (
						<div>
							<div className="text-sm font-medium text-gray-700 mb-2">Top Referrers</div>
							<div className="space-y-2">
								{stats.topReferrers.map((item, idx) => (
									<div
										key={idx}
										className="flex justify-between items-center text-sm bg-gray-50 rounded px-3 py-2"
									>
										<span className="text-gray-600 truncate flex-1 mr-2" title={item.referrer}>
											{formatReferrer(item.referrer)}
										</span>
										<span className="text-gray-900 font-medium shrink-0">
											{item.count.toLocaleString()}
										</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* UTM Sources */}
					{stats.topUtmSources.length > 0 && (
						<div>
							<div className="text-sm font-medium text-gray-700 mb-2">UTM Sources</div>
							<div className="space-y-2">
								{stats.topUtmSources.map((item, idx) => (
									<div
										key={idx}
										className="flex justify-between items-center text-sm bg-gray-50 rounded px-3 py-2"
									>
										<span className="text-gray-600 truncate flex-1 mr-2">
											{item.source}
										</span>
										<span className="text-gray-900 font-medium shrink-0">
											{item.count.toLocaleString()}
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
					href={`https://app.posthog.com/project/${postHogProjectId}/events?properties=[{"key":"pageID","value":"${pageID}","operator":"exact","type":"event"}]`}
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
	if (seconds === 0) return '0s';
	if (seconds < 60) return `${seconds}s`;
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function formatReferrer(referrer: string): string {
	if (!referrer) return 'Direct';
	try {
		const url = new URL(referrer);
		return url.hostname.replace('www.', '');
	} catch {
		return referrer.slice(0, 30);
	}
}
