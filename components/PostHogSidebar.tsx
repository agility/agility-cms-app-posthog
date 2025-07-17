"use client"

import { useEffect, useState } from 'react';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';

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
					setError(`No experiment found with feature flag key: ${experimentKey}`);
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
		return (
			<div>
				<h1 className="text-xl font-bold mb-4">PostHog Experiment</h1>
				<div className="flex items-center gap-2">
					<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
					<span>Loading experiment details...</span>
				</div>
			</div>
		);
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

			<TabGroup>
				<TabList className="border-b border-gray-200 mb-4 ">
					<Tab className="data-hover:bg-red-200 data-selected:bg-indigo-500 data-[selected]:text-indigo-600 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap w-1/2 text-center">
						Experiment
					</Tab>
					<Tab className="data-selected:border-indigo-500 data-[selected]:text-indigo-600 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap w-1/2 text-center">
						Results
					</Tab>
				</TabList>
				<TabPanels>
					<TabPanel>
						<div className="bg-white border border-gray-200 rounded-lg p-2 sm:p-4 space-y-4">
							<div className="flex items-start justify-between flex-col sm:flex-row gap-2">
								<div className="flex-1">
									<h2 className="text-lg font-semibold text-gray-900">{experiment.name}</h2>
									<p className="text-sm text-gray-600 mt-1">{experiment.description || 'No description provided'}</p>
								</div>
								<span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(experiment)} shrink-0`}>
									{getStatusText(experiment)}
								</span>
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

							{experiment.feature_flag && (
								<div className="border-t border-gray-200 pt-4">
									<h3 className="text-sm font-medium text-gray-700 mb-2">Feature Flag Details</h3>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
										<div>
											<label className="text-xs font-medium text-gray-600">Flag Name</label>
											<p className="text-sm text-gray-900 break-words">{experiment.feature_flag.name}</p>
										</div>
										<div>
											<label className="text-xs font-medium text-gray-600">Flag Status</label>
											<p className="text-sm text-gray-900">
												<span className={`px-2 py-1 text-xs font-medium rounded-full ${experiment.feature_flag.active
													? 'bg-green-100 text-green-800'
													: 'bg-red-100 text-red-800'
													}`}>
													{experiment.feature_flag.active ? 'Active' : 'Inactive'}
												</span>
											</p>
										</div>
									</div>
								</div>
							)}

							{experiment.conclusion_comment && (
								<div className="border-t border-gray-200 pt-4">
									<label className="text-sm font-medium text-gray-700">Conclusion Comment</label>
									<p className="text-sm text-gray-900 mt-1 break-words">{experiment.conclusion_comment}</p>
								</div>
							)}
						</div>
					</TabPanel>
					<TabPanel>
						<div className="bg-white border border-gray-200 rounded-lg p-2 sm:p-4">
							<div className="text-center py-4 sm:py-8">
								<h3 className="text-lg font-medium text-gray-900 mb-2">Experiment Results</h3>
								<p className="text-sm text-gray-600 mb-4 break-words">
									Results and analytics for experiment "{experiment?.name || experimentKey}"
								</p>
								<div className="bg-gray-50 rounded-lg p-3 sm:p-6">
									<p className="text-sm text-gray-500">
										Results functionality coming soon. This will display experiment performance metrics,
										variant performance, statistical significance, and other key results data from PostHog.
									</p>
								</div>
							</div>
						</div>
					</TabPanel>
				</TabPanels>
			</TabGroup>
		</div>
	);
}