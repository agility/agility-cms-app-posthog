"use client"

import React, { useState, useEffect } from 'react';
import { IAgilityContentItem } from '../types/IAgilityContentItem';
import { PostHogLoader } from './PostHogLoader';
import { CreateExperiment } from './CreateExperiment';

interface PostHogSidebarProps {
	experimentKey: string;
	postHogProjectId: string | null;
	postHogAPIKey: string | null;
}

interface Experiment {
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

				if (matchingExperiment) {
					setExperiment(matchingExperiment);
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
			return <CreateExperiment experimentKey={experimentKey} postHogProjectId={postHogProjectId} />;
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
		<div className="max-w-2xl">

			<div className="flex items-start justify-between flex-col sm:flex-row gap-2">
				<div className="flex-1">
					<h2 className="text-lg font-semibold text-gray-900">{experiment.name}</h2>
					<p className="text-sm text-gray-600 mt-1">{experiment.description || 'No description provided'}</p>
				</div>
				<div className="flex flex-col gap-2 shrink-0">
					<span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(experiment)}`}>
						{getStatusText(experiment)}
					</span>
					{postHogProjectId && (
						<a
							href={`https://app.posthog.com/project/${postHogProjectId}/experiments/${experiment.id}`}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors"
						>
							View in PostHog ↗
						</a>
					)}
				</div>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div>
					<label className="text-sm font-medium text-gray-700">Experiment ID</label>
					<p className="text-sm text-gray-900">{experiment.id}</p>
				</div>

				<div>
					<label className="text-sm font-medium text-gray-700">Feature Flag Key</label>
					<p className="text-xs sm:text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded break-all">
						{experiment.feature_flag_key}
					</p>
				</div>

				<div>
					<label className="text-sm font-medium text-gray-700">Type</label>
					<p className="text-sm text-gray-900 capitalize">{experiment.type}</p>
				</div>

				<div>
					<label className="text-sm font-medium text-gray-700">Start Date</label>
					<p className="text-sm text-gray-900">{formatDate(experiment.start_date)}</p>
				</div>

				<div>
					<label className="text-sm font-medium text-gray-700">End Date</label>
					<p className="text-sm text-gray-900">{formatDate(experiment.end_date)}</p>
				</div>

				<div>
					<label className="text-sm font-medium text-gray-700">Created</label>
					<p className="text-sm text-gray-900">{formatDate(experiment.created_at)}</p>
				</div>
			</div>

			{experiment.conclusion_comment && (
				<div className="border-t border-gray-200 pt-4">
					<label className="text-sm font-medium text-gray-700">Conclusion Comment</label>
					<p className="text-sm text-gray-900 mt-1 break-words">{experiment.conclusion_comment}</p>
				</div>
			)}
		</div>

	);
}