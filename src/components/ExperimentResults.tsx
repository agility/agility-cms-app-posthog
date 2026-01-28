"use client"

import React from 'react';

export interface VariantResult {
	key: string;
	count: number; // exposure count
	absolute_exposure: number;
	failure_count?: number;
	success_count?: number;
}

export interface MetricResult {
	action?: {
		name: string;
		id?: string | number;
	};
	count?: number;
	insight?: string;
	result?: {
		[variantKey: string]: {
			count: number;
			exposure: number;
			credible_interval?: [number, number];
			absolute_exposure?: number;
		};
	};
	variants?: Array<{
		key: string;
		count?: number;
		exposure?: number;
		absolute_exposure?: number;
		failure_count?: number;
		success_count?: number;
	}>;
}

export interface ExperimentResultsData {
	insight?: any[];
	filters?: any;
	probability?: { [variantKey: string]: number };
	significant?: boolean;
	expected_loss?: number;
	credible_intervals?: {
		[variantKey: string]: [number, number];
	};
	variants?: VariantResult[];
	primary_metric_results?: MetricResult[];
	secondary_metric_results?: MetricResult[];
	stats_version?: number;
	exposure_counts?: {
		[variantKey: string]: number;
	};
}

interface ExperimentResultsProps {
	results: ExperimentResultsData | null;
	loading: boolean;
	error: string | null;
	experimentName?: string;
}

export const ExperimentResults = ({ results, loading, error, experimentName }: ExperimentResultsProps) => {
	if (loading) {
		return (
			<div className="border-t border-gray-200 pt-4 mt-4">
				<div className="text-sm font-medium text-gray-700 mb-3">Experiment Results</div>
				<div className="flex items-center gap-2 text-gray-500 text-sm">
					<div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
					Loading results...
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="border-t border-gray-200 pt-4 mt-4">
				<div className="text-sm font-medium text-gray-700 mb-3">Experiment Results</div>
				<div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
					<p className="text-yellow-800 text-sm">{error}</p>
				</div>
			</div>
		);
	}

	if (!results) {
		return (
			<div className="border-t border-gray-200 pt-4 mt-4">
				<div className="text-sm font-medium text-gray-700 mb-3">Experiment Results</div>
				<div className="text-gray-500 text-sm">No results data available yet.</div>
			</div>
		);
	}

	// Extract variants from results
	const variants = results.variants || [];
	const probability = results.probability || {};
	const significant = results.significant;
	const credibleIntervals = results.credible_intervals || {};
	const exposureCounts = results.exposure_counts || {};
	const primaryMetrics = results.primary_metric_results || [];

	// Calculate total exposures
	const totalExposures = variants.reduce((sum, v) => sum + (v.absolute_exposure || v.count || 0), 0);

	// Find the winning variant (highest probability)
	const winningVariant = Object.entries(probability).reduce(
		(best, [key, prob]) => (prob > best.prob ? { key, prob } : best),
		{ key: '', prob: 0 }
	);

	return (
		<div className="border-t border-gray-200 pt-4 mt-4">
			<div className="text-sm font-medium text-gray-700 mb-3">Experiment Results</div>

			{/* Significance Banner */}
			{significant !== undefined && (
				<div className={`rounded-md p-3 mb-4 ${significant ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
					<div className="flex items-center gap-2">
						{significant ? (
							<>
								<svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span className="text-green-800 font-medium text-sm">Statistically Significant</span>
							</>
						) : (
							<>
								<svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span className="text-gray-600 font-medium text-sm">Not yet significant - collecting data</span>
							</>
						)}
					</div>
					{significant && winningVariant.key && (
						<p className="text-sm text-green-700 mt-1">
							<span className="font-semibold capitalize">{winningVariant.key.replace(/_/g, ' ')}</span> is winning with{' '}
							<span className="font-semibold">{(winningVariant.prob * 100).toFixed(1)}%</span> probability
						</p>
					)}
				</div>
			)}

			{/* Total Exposures */}
			{totalExposures > 0 && (
				<div className="mb-4">
					<div className="text-xs text-gray-500 uppercase mb-1">Total Exposures</div>
					<div className="text-2xl font-bold text-gray-900">{totalExposures.toLocaleString()}</div>
				</div>
			)}

			{/* Variant Results */}
			{variants.length > 0 && (
				<div className="space-y-3 mb-4">
					<div className="text-xs text-gray-500 uppercase">Variants Performance</div>
					{variants.map((variant) => {
						const variantProb = probability[variant.key] || 0;
						const exposures = variant.absolute_exposure || variant.count || 0;
						const exposurePercent = totalExposures > 0 ? (exposures / totalExposures) * 100 : 0;
						const isWinning = variant.key === winningVariant.key && significant;
						const interval = credibleIntervals[variant.key];

						return (
							<div
								key={variant.key}
								className={`rounded-lg p-3 ${isWinning ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}
							>
								<div className="flex justify-between items-start mb-2">
									<div className="flex items-center gap-2">
										<span className={`font-medium capitalize ${isWinning ? 'text-green-800' : 'text-gray-900'}`}>
											{variant.key.replace(/_/g, ' ')}
										</span>
										{isWinning && (
											<span className="px-1.5 py-0.5 text-xs bg-green-200 text-green-800 rounded">Winner</span>
										)}
									</div>
									{variantProb > 0 && (
										<span className={`text-sm font-semibold ${isWinning ? 'text-green-700' : 'text-gray-600'}`}>
											{(variantProb * 100).toFixed(1)}% prob
										</span>
									)}
								</div>

								<div className="grid grid-cols-2 gap-2 text-sm">
									<div>
										<span className="text-gray-500">Exposures:</span>{' '}
										<span className="font-medium">{exposures.toLocaleString()}</span>
										<span className="text-gray-400 text-xs ml-1">({exposurePercent.toFixed(1)}%)</span>
									</div>
									{variant.success_count !== undefined && (
										<div>
											<span className="text-gray-500">Conversions:</span>{' '}
											<span className="font-medium">{variant.success_count.toLocaleString()}</span>
										</div>
									)}
								</div>

								{interval && (
									<div className="mt-2 text-xs text-gray-500">
										95% CI: [{(interval[0] * 100).toFixed(2)}%, {(interval[1] * 100).toFixed(2)}%]
									</div>
								)}

								{/* Progress bar showing exposure distribution */}
								<div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
									<div
										className={`h-full rounded-full ${isWinning ? 'bg-green-500' : 'bg-indigo-500'}`}
										style={{ width: `${exposurePercent}%` }}
									/>
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* Primary Metrics */}
			{primaryMetrics.length > 0 && (
				<div className="space-y-3">
					<div className="text-xs text-gray-500 uppercase">Primary Metrics</div>
					{primaryMetrics.map((metric, idx) => (
						<div key={idx} className="bg-gray-50 rounded-lg p-3">
							<div className="font-medium text-gray-900 text-sm mb-2">
								{metric.action?.name || `Metric ${idx + 1}`}
							</div>
							{metric.variants && (
								<div className="space-y-1">
									{metric.variants.map((v) => {
										const conversionRate = v.exposure && v.success_count !== undefined
											? (v.success_count / v.exposure) * 100
											: null;
										return (
											<div key={v.key} className="flex justify-between text-sm">
												<span className="text-gray-600 capitalize">{v.key.replace(/_/g, ' ')}</span>
												<span className="font-medium">
													{conversionRate !== null
														? `${conversionRate.toFixed(2)}% conv.`
														: v.count?.toLocaleString() || '-'
													}
												</span>
											</div>
										);
									})}
								</div>
							)}
						</div>
					))}
				</div>
			)}

			{/* Empty state for no data */}
			{variants.length === 0 && primaryMetrics.length === 0 && totalExposures === 0 && (
				<div className="text-center py-4 text-gray-500 text-sm">
					<p>Waiting for experiment data...</p>
					<p className="text-xs mt-1">Results will appear once users are exposed to the experiment.</p>
				</div>
			)}
		</div>
	);
};
