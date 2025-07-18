interface CreateExperimentProps {
	experimentKey: string;
	postHogProjectId: string;
}

export const CreateExperiment = ({ experimentKey, postHogProjectId }: CreateExperimentProps) => {
	const handleCreateExperiment = () => {
		// Open PostHog experiments page in a new tab
		const url = `https://app.posthog.com/project/${postHogProjectId}/experiments`;
		window.open(url, '_blank', 'noopener,noreferrer');
	};

	return (
		<div className="max-w-2xl">
			<div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
				<div className="text-center space-y-4">
					<div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
						<img src="https://posthog.com/brand/posthog-logo-stacked.svg" alt="PostHog Logo" className="w-10 h-10" />
					</div>
					<div>
						<h3 className="text-lg font-medium text-gray-900">No Experiment Found</h3>
						<p className="text-sm text-gray-600 mt-1">
							No experiment found with feature flag key: <span className="font-mono bg-gray-100 px-1 rounded">{experimentKey}</span>
						</p>
					</div>
					<div className="space-y-3">
						<p className="text-sm text-gray-500">
							Create a new experiment in PostHog with this feature flag key to get started.
						</p>
						<button
							onClick={handleCreateExperiment}
							className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
						>
							<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
							</svg>
							Create Experiment in PostHog
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
