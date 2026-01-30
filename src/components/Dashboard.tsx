"use client"

import React, { useState, useEffect } from 'react';
import { DashboardSkeleton } from './DashboardSkeleton';
import { runHogQLQuery, type PostHogConfig } from '../lib/posthog';

interface DashboardProps {
	postHogAPIKey: string;
	postHogProjectId: string;
}

interface DashboardStats {
	totalPageViews: number;
	uniqueVisitors: number;
	avgScrollDepth: number;
	avgTimeOnPage: number;
	pageViewsTrend: Array<{ date: string; views: number }>;
	topPages: Array<{ path: string; views: number; pageID?: number }>;
	scrollDistribution: Array<{ depth: number; count: number; percent: number }>;
	timeDistribution: Array<{ seconds: number; count: number; percent: number }>;
	localeDistribution: Array<{ locale: string; count: number; percent: number }>;
	topReferrers: Array<{ referrer: string; count: number }>;
}

export function Dashboard({ postHogAPIKey, postHogProjectId }: DashboardProps) {
	const [stats, setStats] = useState<DashboardStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [dateRange, setDateRange] = useState(30); // days

	useEffect(() => {
		const fetchStats = async () => {
			setLoading(true);
			setError(null);

			const config: PostHogConfig = {
				apiKey: postHogAPIKey,
				projectId: postHogProjectId
			};

			try {
				const [
					totalViewsResult,
					uniqueVisitorsResult,
					avgScrollResult,
					trendResult,
					topPagesResult,
					scrollDistResult,
					timeDistResult,
					localeDistResult,
					referrersResult
				] = await Promise.all([
					// Total page views
					runHogQLQuery(config, `
						SELECT count() as views
						FROM events
						WHERE event = '$pageview'
							AND timestamp > now() - INTERVAL ${dateRange} DAY
					`).catch(() => ({ results: [[0]] })),

					// Unique visitors
					runHogQLQuery(config, `
						SELECT count(DISTINCT distinct_id) as visitors
						FROM events
						WHERE event = '$pageview'
							AND timestamp > now() - INTERVAL ${dateRange} DAY
					`).catch(() => ({ results: [[0]] })),

					// Average scroll depth
					runHogQLQuery(config, `
						SELECT avg(JSONExtractInt(properties, 'depth')) as avgDepth
						FROM events
						WHERE event = 'scroll_milestone'
							AND timestamp > now() - INTERVAL ${dateRange} DAY
					`).catch(() => ({ results: [[0]] })),

					// Page views trend (daily)
					runHogQLQuery(config, `
						SELECT
							toDate(timestamp) as date,
							count() as views
						FROM events
						WHERE event = '$pageview'
							AND timestamp > now() - INTERVAL ${dateRange} DAY
						GROUP BY date
						ORDER BY date
					`).catch(() => ({ results: [] })),

					// Top pages
					runHogQLQuery(config, `
						SELECT
							JSONExtractString(properties, '$pathname') as path,
							count() as views,
							JSONExtractInt(properties, 'pageID') as pageID
						FROM events
						WHERE event = '$pageview'
							AND timestamp > now() - INTERVAL ${dateRange} DAY
						GROUP BY path, pageID
						ORDER BY views DESC
						LIMIT 10
					`).catch(() => ({ results: [] })),

					// Scroll distribution
					runHogQLQuery(config, `
						SELECT
							JSONExtractInt(properties, 'depth') as depth,
							count() as count
						FROM events
						WHERE event = 'scroll_milestone'
							AND timestamp > now() - INTERVAL ${dateRange} DAY
						GROUP BY depth
						ORDER BY depth
					`).catch(() => ({ results: [] })),

					// Time distribution
					runHogQLQuery(config, `
						SELECT
							JSONExtractInt(properties, 'seconds') as seconds,
							count() as count
						FROM events
						WHERE event = 'time_milestone'
							AND timestamp > now() - INTERVAL ${dateRange} DAY
						GROUP BY seconds
						ORDER BY seconds
					`).catch(() => ({ results: [] })),

					// Locale distribution
					runHogQLQuery(config, `
						SELECT
							JSONExtractString(properties, 'locale') as locale,
							count() as count
						FROM events
						WHERE event = '$pageview'
							AND JSONExtractString(properties, 'locale') != ''
							AND timestamp > now() - INTERVAL ${dateRange} DAY
						GROUP BY locale
						ORDER BY count DESC
						LIMIT 5
					`).catch(() => ({ results: [] })),

					// Top referrers
					runHogQLQuery(config, `
						SELECT
							JSONExtractString(properties, '$referrer') as referrer,
							count() as count
						FROM events
						WHERE event = '$pageview'
							AND JSONExtractString(properties, '$referrer') != ''
							AND timestamp > now() - INTERVAL ${dateRange} DAY
						GROUP BY referrer
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

				// Calculate avg time from milestones
				let avgTimeOnPage = 0;
				if (timeDistRaw.length > 0 && totalTimeEvents > 0) {
					const weightedSum = timeDistRaw.reduce((sum, row) => sum + (row[0] * row[1]), 0);
					avgTimeOnPage = Math.round(weightedSum / totalTimeEvents);
				}

				// Process locale distribution
				const localeDistRaw: any[][] = localeDistResult.results || [];
				const totalLocaleEvents = localeDistRaw.reduce((sum, row) => sum + (row[1] || 0), 0);
				const localeDistribution = localeDistRaw.map((row) => ({
					locale: (row[0] as string) || 'Unknown',
					count: row[1] as number,
					percent: totalLocaleEvents > 0 ? Math.round((row[1] / totalLocaleEvents) * 100) : 0
				}));

				// Process trend data
				const trendRaw: any[][] = trendResult.results || [];
				const pageViewsTrend = trendRaw.map((row) => ({
					date: row[0] as string,
					views: row[1] as number
				}));

				// Process top pages
				const topPagesRaw: any[][] = topPagesResult.results || [];
				const topPages = topPagesRaw.map((row) => ({
					path: (row[0] as string) || '/',
					views: row[1] as number,
					pageID: row[2] as number
				}));

				// Process referrers
				const referrersRaw: any[][] = referrersResult.results || [];
				const topReferrers = referrersRaw.map((row) => ({
					referrer: (row[0] as string) || 'Direct',
					count: row[1] as number
				}));

				setStats({
					totalPageViews: totalViewsResult.results?.[0]?.[0] || 0,
					uniqueVisitors: uniqueVisitorsResult.results?.[0]?.[0] || 0,
					avgScrollDepth: Math.round(avgScrollResult.results?.[0]?.[0] || 0),
					avgTimeOnPage,
					pageViewsTrend,
					topPages,
					scrollDistribution,
					timeDistribution,
					localeDistribution,
					topReferrers
				});
			} catch (err) {
				console.error('Error fetching dashboard stats:', err);
				setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
			} finally {
				setLoading(false);
			}
		};

		fetchStats();
	}, [postHogAPIKey, postHogProjectId, dateRange]);

	if (loading) {
		return <DashboardSkeleton />;
	}

	if (error) {
		return (
			<div className="bg-red-50 border border-red-200 rounded-md p-4">
				<p className="text-red-800 text-sm font-medium">Error loading dashboard</p>
				<p className="text-red-600 text-sm mt-1">{error}</p>
			</div>
		);
	}

	if (!stats) {
		return (
			<div className="text-center py-8 text-gray-500">
				<p>No analytics data available yet.</p>
				<a
					href="https://agilitycms.com/docs/apps/posthog"
					target="_blank"
					rel="noopener noreferrer"
					className="inline-block mt-3 text-sm text-indigo-600 hover:text-indigo-800"
				>
					Learn how to send analytics →
				</a>
			</div>
		);
	}

	const maxTrendViews = Math.max(...stats.pageViewsTrend.map(d => d.views), 1);
	const maxPageViews = Math.max(...stats.topPages.map(p => p.views), 1);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">PostHog Analytics</h1>
					<p className="text-gray-500 text-sm mt-1">Site-wide performance metrics</p>
				</div>
				<div className="flex items-center gap-2">
					<label className="text-sm text-gray-600">Date Range:</label>
					<select
						value={dateRange}
						onChange={(e) => setDateRange(Number(e.target.value))}
						className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
					>
						<option value={7}>Last 7 days</option>
						<option value={14}>Last 14 days</option>
						<option value={30}>Last 30 days</option>
						<option value={60}>Last 60 days</option>
						<option value={90}>Last 90 days</option>
					</select>
				</div>
			</div>

			{/* Summary Stats */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<StatCard
					label="Total Page Views"
					value={stats.totalPageViews.toLocaleString()}
					icon={
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
						</svg>
					}
				/>
				<StatCard
					label="Unique Visitors"
					value={stats.uniqueVisitors.toLocaleString()}
					icon={
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
						</svg>
					}
				/>
				<StatCard
					label="Avg Scroll Depth"
					value={`${stats.avgScrollDepth}%`}
					icon={
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
						</svg>
					}
				/>
				<StatCard
					label="Avg Time on Page"
					value={formatSeconds(stats.avgTimeOnPage)}
					icon={
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					}
				/>
			</div>

			{/* Page Views Trend */}
			{stats.pageViewsTrend.length > 0 && (
				<div className="bg-white border border-gray-200 rounded-lg p-4">
					<h2 className="text-lg font-semibold text-gray-900 mb-4">Page Views Over Time</h2>
					<div className="h-48 flex items-end gap-1">
						{stats.pageViewsTrend.map((day, idx) => (
							<div key={idx} className="flex-1 flex flex-col items-center group">
								<div className="relative w-full">
									<div
										className="w-full bg-indigo-500 rounded-t transition-all hover:bg-indigo-600"
										style={{ height: `${(day.views / maxTrendViews) * 160}px`, minHeight: '4px' }}
									/>
									<div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
										{day.views.toLocaleString()} views
										<br />
										{formatDate(day.date)}
									</div>
								</div>
							</div>
						))}
					</div>
					<div className="flex justify-between text-xs text-gray-400 mt-2">
						<span>{stats.pageViewsTrend[0]?.date ? formatDate(stats.pageViewsTrend[0].date) : ''}</span>
						<span>{stats.pageViewsTrend[stats.pageViewsTrend.length - 1]?.date ? formatDate(stats.pageViewsTrend[stats.pageViewsTrend.length - 1].date) : ''}</span>
					</div>
				</div>
			)}

			{/* Two Column Layout */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Top Pages */}
				{stats.topPages.length > 0 && (
					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<h2 className="text-lg font-semibold text-gray-900 mb-4">Top Pages</h2>
						<div className="space-y-3">
							{stats.topPages.map((page, idx) => (
								<div key={idx} className="relative">
									<div className="flex items-center justify-between mb-1">
										<span className="text-sm text-gray-700 truncate flex-1 mr-2" title={page.path}>
											{page.path || '/'}
										</span>
										<span className="text-sm font-medium text-gray-900 shrink-0">
											{page.views.toLocaleString()}
										</span>
									</div>
									<div className="h-2 bg-gray-100 rounded-full overflow-hidden">
										<div
											className="h-full bg-indigo-500 rounded-full"
											style={{ width: `${(page.views / maxPageViews) * 100}%` }}
										/>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Engagement Metrics */}
				<div className="bg-white border border-gray-200 rounded-lg p-4">
					<h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement</h2>

					{/* Scroll Distribution */}
					{stats.scrollDistribution.length > 0 && (
						<div className="mb-4">
							<h3 className="text-sm font-medium text-gray-700 mb-2">Scroll Depth</h3>
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
							<h3 className="text-sm font-medium text-gray-700 mb-2">Time on Page</h3>
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
				</div>
			</div>

			{/* Bottom Row */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Top Referrers */}
				{stats.topReferrers.length > 0 && (
					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<h2 className="text-lg font-semibold text-gray-900 mb-4">Top Referrers</h2>
						<div className="space-y-2">
							{stats.topReferrers.map((item, idx) => (
								<div key={idx} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2">
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

				{/* Locale Distribution */}
				{stats.localeDistribution.length > 0 && (
					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<h2 className="text-lg font-semibold text-gray-900 mb-4">Locales</h2>
						<div className="space-y-2">
							{stats.localeDistribution.map((item, idx) => (
								<div key={idx} className="flex items-center justify-between text-sm">
									<div className="flex items-center gap-2">
										<span className="text-gray-900 font-medium uppercase">{item.locale}</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-gray-500">{item.percent}%</span>
										<span className="text-gray-900 font-medium">{item.count.toLocaleString()}</span>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>

			{/* View in PostHog Link */}
			<div className="flex justify-center">
				<a
					href={`https://app.posthog.com/project/${postHogProjectId}/insights`}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center px-4 py-2 text-sm font-medium bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors"
				>
					View Full Analytics in PostHog
					<svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
					</svg>
				</a>
			</div>
		</div>
	);
}

// Helper Components

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
	return (
		<div className="bg-white border border-gray-200 rounded-lg p-4">
			<div className="flex items-center gap-2 text-gray-400 mb-2">
				{icon}
				<span className="text-sm text-gray-600">{label}</span>
			</div>
			<div className="text-3xl font-bold text-gray-900">{value}</div>
		</div>
	);
}

function ProgressBar({ label, value, count }: { label: string; value: number; count: number }) {
	return (
		<div className="flex items-center gap-3 text-sm">
			<span className="w-12 text-gray-500 text-right">{label}</span>
			<div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
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

function formatDate(dateStr: string): string {
	try {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	} catch {
		return dateStr;
	}
}

function formatReferrer(referrer: string): string {
	if (!referrer) return 'Direct';
	try {
		const url = new URL(referrer);
		return url.hostname.replace('www.', '');
	} catch {
		return referrer.slice(0, 40);
	}
}
