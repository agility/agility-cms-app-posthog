"use client"

import React, { useState, useEffect } from 'react';
import { IAgilityContentItem } from '../types/IAgilityContentItem';
import { PostHogLoader } from './PostHogLoader';
import { CreateExperiment } from './CreateExperiment';
import { ExperimentResults, ExperimentResultsData } from './ExperimentResults';

interface PostHogSidebarProps {
	experimentKey: string;
	postHogProjectId: string | null;
	postHogAPIKey: string | null;
}

export interface Experiment {
	id: number;
	name: string;
	description: string;
	start_date: string | null;
	end_date: string | null;
	feature_flag_key: string;
	archived: boolean;
	deleted: boolean;
	type: string;
	conclusion: string | null;
	conclusion_comment: string | null;
	created_at: string;
	updated_at: string;
	feature_flag?: {
		id: number;
		name: string;
		key: string;
		active: boolean;
	};
}

export const PostHogSidebar = ({ experimentKey, postHogAPIKey, postHogProjectId }: PostHogSidebarProps) => {
	const [experiment, setExperiment] = useState<Experiment | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Results state
	const [results, setResults] = useState<ExperimentResultsData | null>(null);
	const [resultsLoading, setResultsLoading] = useState(false);
	const [resultsError, setResultsError] = useState<string | null>(null);

	// Fetch experiment results
	const fetchResults = async (experimentId: number) => {
		if (!postHogAPIKey || !postHogProjectId) return;

		setResultsLoading(true);
		setResultsError(null);

		try {
			const response = await fetch(
				`https://app.posthog.com/api/projects/${postHogProjectId}/experiments/${experimentId}/results/`,
				{
					headers: {
						'Authorization': `Bearer ${postHogAPIKey}`,
						'Content-Type': 'application/json',
					},
				}
			);

			if (!response.ok) {
				if (response.status === 404) {
					// No results yet - this is normal for new experiments
					setResults(null);
					return;
				}
				throw new Error(`Failed to fetch results: ${response.status}`);
			}

			const data = await response.json();
			console.log('Experiment Results:', data);
			setResults(data);
		} catch (err) {
			console.error('Error fetching results:', err);
			setResultsError(err instanceof Error ? err.message : 'Failed to load results');
		} finally {
			setResultsLoading(false);
		}
	};

	useEffect(() => {
		const fetchExperiment = async () => {
			if (!postHogAPIKey || !postHogProjectId || !experimentKey) {
				setError('Missing required configuration: API key, project ID, or experiment key');
				return;
			}

			setLoading(true);
			setError(null);

			try {
				const response = await fetch(`https://app.posthog.com/api/projects/${postHogProjectId}/experiments/`, {
					headers: {
						'Authorization': `Bearer ${postHogAPIKey}`,
						'Content-Type': 'application/json',
					},
				});

				if (!response.ok) {
					throw new Error(`Failed to fetch experiments: ${response.status} ${response.statusText}`);
				}

				const data = await response.json();

				// Find the experiment that matches the experimentKey (feature_flag_key)
				const matchingExperiment = data.results?.find((exp: Experiment) =>
					exp.feature_flag_key === experimentKey
				);

				//get the full experiemnt by id
				if (matchingExperiment && matchingExperiment.id) {
					const fullExperimentResponse = await fetch(`https://app.posthog.com/api/projects/${postHogProjectId}/experiments/${matchingExperiment.id}/`, {
						headers: {
							'Authorization': `Bearer ${postHogAPIKey}`,
							'Content-Type': 'application/json',
						},
					});

					if (!fullExperimentResponse.ok) {
						throw new Error(`Failed to fetch experiment details: ${fullExperimentResponse.status} ${fullExperimentResponse.statusText}`);
					}

					const fullExperimentData = await fullExperimentResponse.json();

					console.log('Full Experiment Data:', fullExperimentData);
					setExperiment(fullExperimentData);

					// Fetch results for this experiment
					fetchResults(fullExperimentData.id);

				} else {
					// Don't set error here - we'll show the CreateExperiment component instead
					setExperiment(null);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : 'An unexpected error occurred');
			} finally {
				setLoading(false);
			}
		};

		fetchExperiment();
	}, [experimentKey, postHogAPIKey, postHogProjectId]);

	if (loading) {
		return <PostHogLoader title="Loading Experiment" message="Fetching details from PostHog..." />;
	}

	if (error) {
		return (
			<div>
				<h1 className="text-xl font-bold mb-4">PostHog Experiment</h1>
				<div className="bg-red-50 border border-red-200 rounded-md p-3">
					<p className="text-red-800 text-sm">{error}</p>
				</div>
			</div>
		);
	}

	if (!experiment) {
		// Show CreateExperiment component if no experiment found and we have the required props
		if (postHogProjectId && !error) {
			return <CreateExperiment
				experimentKey={experimentKey}
				postHogProjectId={postHogProjectId}
				postHogAPIKey={postHogAPIKey}
				onCreated={(experiment) => setExperiment(experiment)}
			/>;
		}

		return (
			<div>
				<h1 className="text-xl font-bold mb-4">PostHog Experiment</h1>
				<p className="text-gray-500">No experiment data available.</p>
			</div>
		);
	}

	const formatDate = (dateString: string | null) => {
		if (!dateString) return 'Not set';
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	};

	const getStatusColor = (experiment: Experiment) => {
		if (experiment.deleted) return 'bg-gray-100 text-gray-800';
		if (experiment.archived) return 'bg-yellow-100 text-yellow-800';
		if (experiment.conclusion) return 'bg-green-100 text-green-800';
		return 'bg-blue-100 text-blue-800';
	};

	const getStatusText = (experiment: Experiment) => {
		if (experiment.deleted) return 'Deleted';
		if (experiment.archived) return 'Archived';
		if (experiment.conclusion) return `Concluded (${experiment.conclusion})`;
		return 'Active';
	};

	return (
		<div className="space-y-2">
			{/* Header - compact */}
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-sm font-semibold text-gray-900 truncate">{experiment.name}</h2>
				<span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full shrink-0 ${getStatusColor(experiment)}`}>
					{getStatusText(experiment)}
				</span>
			</div>

			{experiment.description && (
				<p className="text-xs text-gray-500 line-clamp-2">{experiment.description}</p>
			)}

			{/* Key info - compact inline layout */}
			<div className="bg-gray-50 rounded p-2 space-y-1 text-xs">
				<div className="flex justify-between">
					<span className="text-gray-500">Flag</span>
					<code className="text-gray-800 font-mono truncate ml-2 max-w-[60%] text-right">{experiment.feature_flag_key}</code>
				</div>
				<div className="flex justify-between">
					<span className="text-gray-500">Type</span>
					<span className="text-gray-800 capitalize">{experiment.type}</span>
				</div>
				<div className="flex justify-between">
					<span className="text-gray-500">Started</span>
					<span className="text-gray-800">{formatDate(experiment.start_date)}</span>
				</div>
				{experiment.end_date && (
					<div className="flex justify-between">
						<span className="text-gray-500">Ended</span>
						<span className="text-gray-800">{formatDate(experiment.end_date)}</span>
					</div>
				)}
			</div>

			{/* PostHog link */}
			{postHogProjectId && (
				<a
					href={`https://app.posthog.com/project/${postHogProjectId}/experiments/${experiment.id}`}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center text-xs text-indigo-600 hover:text-indigo-800"
				>
					View in PostHog →
				</a>
			)}

			{experiment.conclusion_comment && (
				<div className="bg-green-50 rounded p-2">
					<p className="text-xs text-green-800">{experiment.conclusion_comment}</p>
				</div>
			)}

			{/* Experiment Results Section */}
			<ExperimentResults
				results={results}
				loading={resultsLoading}
				error={resultsError}
				experimentName={experiment.name}
			/>
		</div>
	);
}