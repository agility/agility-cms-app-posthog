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
			<div className="border-t border-gray-200 pt-2 mt-2">
				<div className="flex items-center gap-2 text-gray-500 text-xs">
					<div className="animate-spin h-3 w-3 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
					Loading results...
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="border-t border-gray-200 pt-2 mt-2">
				<div className="bg-yellow-50 rounded p-2">
					<p className="text-yellow-800 text-xs">{error}</p>
				</div>
			</div>
		);
	}

	if (!results) {
		return (
			<div className="border-t border-gray-200 pt-2 mt-2">
				<p className="text-gray-400 text-xs">No results yet</p>
			</div>
		);
	}

	// Extract variants from results
	const variants = results.variants || [];
	const probability = results.probability || {};
	const significant = results.significant;
	const credibleIntervals = results.credible_intervals || {};
	const primaryMetrics = results.primary_metric_results || [];

	// Calculate total exposures
	const totalExposures = variants.reduce((sum, v) => sum + (v.absolute_exposure || v.count || 0), 0);

	// Find the winning variant (highest probability)
	const winningVariant = Object.entries(probability).reduce(
		(best, [key, prob]) => (prob > best.prob ? { key, prob } : best),
		{ key: '', prob: 0 }
	);

	return (
		<div className="border-t border-gray-200 pt-2 mt-2 space-y-2">
			{/* Significance Banner - compact */}
			{significant !== undefined && (
				<div className={`rounded p-2 ${significant ? 'bg-green-50' : 'bg-gray-50'}`}>
					<div className="flex items-center gap-1.5">
						{significant ? (
							<span className="text-green-700 font-medium text-xs">✓ Significant</span>
						) : (
							<span className="text-gray-500 text-xs">Collecting data...</span>
						)}
					</div>
					{significant && winningVariant.key && (
						<p className="text-xs text-green-700 mt-0.5">
							<span className="font-semibold capitalize">{winningVariant.key.replace(/_/g, ' ')}</span>: {(winningVariant.prob * 100).toFixed(0)}% win prob
						</p>
					)}
				</div>
			)}

			{/* Total Exposures - inline */}
			{totalExposures > 0 && (
				<div className="flex justify-between items-center text-xs">
					<span className="text-gray-500">Total Exposures</span>
					<span className="font-semibold text-gray-900">{totalExposures.toLocaleString()}</span>
				</div>
			)}

			{/* Variant Results - compact */}
			{variants.length > 0 && (
				<div className="space-y-1.5">
					{variants.map((variant) => {
						const variantProb = probability[variant.key] || 0;
						const exposures = variant.absolute_exposure || variant.count || 0;
						const exposurePercent = totalExposures > 0 ? (exposures / totalExposures) * 100 : 0;
						const isWinning = variant.key === winningVariant.key && significant;

						return (
							<div
								key={variant.key}
								className={`rounded p-1.5 ${isWinning ? 'bg-green-50' : 'bg-gray-50'}`}
							>
								<div className="flex justify-between items-center text-xs">
									<span className={`font-medium capitalize ${isWinning ? 'text-green-800' : 'text-gray-800'}`}>
										{variant.key.replace(/_/g, ' ')}
										{isWinning && <span className="ml-1 text-green-600">★</span>}
									</span>
									<span className="text-gray-500">
										{exposures.toLocaleString()} ({exposurePercent.toFixed(0)}%)
									</span>
								</div>
								{variantProb > 0 && (
									<div className="flex items-center gap-1 mt-1">
										<div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
											<div
												className={`h-full rounded-full ${isWinning ? 'bg-green-500' : 'bg-indigo-400'}`}
												style={{ width: `${variantProb * 100}%` }}
											/>
										</div>
										<span className="text-[10px] text-gray-500 w-8 text-right">{(variantProb * 100).toFixed(0)}%</span>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* Primary Metrics - compact */}
			{primaryMetrics.length > 0 && (
				<div className="space-y-1">
					<div className="text-[10px] text-gray-400 uppercase">Metrics</div>
					{primaryMetrics.map((metric, idx) => (
						<div key={idx} className="bg-gray-50 rounded p-1.5">
							<div className="font-medium text-gray-800 text-xs mb-1">
								{metric.action?.name || `Metric ${idx + 1}`}
							</div>
							{metric.variants && (
								<div className="space-y-0.5">
									{metric.variants.map((v) => {
										const conversionRate = v.exposure && v.success_count !== undefined
											? (v.success_count / v.exposure) * 100
											: null;
										return (
											<div key={v.key} className="flex justify-between text-[11px]">
												<span className="text-gray-500 capitalize">{v.key.replace(/_/g, ' ')}</span>
												<span className="font-medium text-gray-700">
													{conversionRate !== null ? `${conversionRate.toFixed(1)}%` : v.count?.toLocaleString() || '-'}
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

			{/* Empty state */}
			{variants.length === 0 && primaryMetrics.length === 0 && totalExposures === 0 && (
				<p className="text-xs text-gray-400 text-center py-2">Waiting for data...</p>
			)}
		</div>
	);
};
