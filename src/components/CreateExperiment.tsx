import { getManagementAPIToken, useAgilityAppSDK } from "@agility/app-sdk"
import clsx from "clsx"
import { IAgilityContentItem } from "@/types/IAgilityContentItem"
import { useState } from "react"
import * as mgmtApi from "@agility/management-sdk";
import { ListParams } from "@agility/management-sdk/dist/models/listParams";
import { Experiment } from "./PostHogSidebar";

interface CreateExperimentProps {
	experimentKey: string
	postHogProjectId: string
	postHogAPIKey?: string | null
	onCreated?: (experiment: Experiment) => void
}

export const CreateExperiment = ({ experimentKey, postHogProjectId, postHogAPIKey, onCreated }: CreateExperimentProps) => {

	const { appInstallContext, instance, contentItem, contentModel, locale, initializing } = useAgilityAppSDK()

	const [errorMsg, setErrorMsg] = useState<string | null>(null)
	const [successMsg, setSuccessMsg] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState<boolean>(false)

	const createExperiment = async () => {
		setErrorMsg(null)
		setSuccessMsg(null)
		setIsLoading(true)

		try {
			const managementToken = await getManagementAPIToken()

			const item = contentItem as IAgilityContentItem | null

			if (!item || item.contentID < 1) {
				setErrorMsg("Please save this content item and create at least 1 variant before creating an experiment");
				return
			}

			if (!instance || !locale) {
				setErrorMsg("The Agility instance details are not available.  Please refresh your browser and try again.");
				return
			}
			const variantListReferenceName = item.values["Variants"]

			if (!variantListReferenceName) {
				setErrorMsg("No variants found. Please create at least one variant before creating an experiment. Note: We are checking for a nested list in the 'Variants` field.");
				return
			}

			let variants: string[] = []
			//access the list of varants

			let options = new mgmtApi.Options();
			options.token = managementToken
			//Initialize the APIClient Class
			let apiClient = new mgmtApi.ApiClient(options);

			let guid = instance.guid || ""
			const listParams = new ListParams()
			listParams.fields = "variant"


			const contentList = await apiClient.contentMethods.getContentList(
				variantListReferenceName,    // Container reference name
				guid,      // Instance GUID
				locale,     // Locale
				listParams
			);

			if (!contentList || contentList?.totalCount === 0) {
				setErrorMsg("No content items found in the Variants container. Please create at least one variant.");
				return;
			}

			console.log('Total items:', contentList.totalCount);
			contentList.items?.forEach(variantItem => {

				let v = variantItem["Variant"] || variantItem["variant"];
				if (!v && variantItem.length > 0) {
					v = variantItem[0]["Variant"] || variantItem[0]["variant"];
				}
				if (v) {
					variants.push(v);
				}
			});

			console.log("Variants found: ", variants);

			// Create feature flag variants for PostHog experiment
			// Always include a "control" variant plus the variants from Agility CMS
			const allVariants = ["control", ...variants];
			const totalVariants = allVariants.length;
			const basePercentage = Math.floor(100 / totalVariants);
			const remainder = 100 - (basePercentage * totalVariants);

			const featureFlagVariants = allVariants.map((variant, index) => ({
				key: variant,
				// Distribute the remainder among the first few variants to ensure total is 100%
				rollout_percentage: basePercentage + (index < remainder ? 1 : 0)
			}));

			console.log("Feature flag variants:", featureFlagVariants);

			// Create the experiment in PostHog using the experimentKey, postHogProjectId, postHogAPIKey, and variants
			const response = await fetch(`https://app.posthog.com/api/projects/${postHogProjectId}/experiments/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${postHogAPIKey}`
				},
				body: JSON.stringify({
					name: `Experiment: ${experimentKey}`,
					description: `A/B test experiment created from Agility CMS for feature flag key: ${experimentKey}`,
					feature_flag_key: experimentKey,
					// Set start date to now and end date to 30 days from now as reasonable defaults
					start_date: new Date().toISOString(),
					// end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
					type: 'product',
					exposure_criteria: {
						filterTestAccounts: true
					},
					metrics: [
						{
							//TODO: this is linked ONLY to a metric
							// called "ab_test_cta_click" which needs to be sent via the PostHog API
							// this should be more dynamic or configurable potentially...
							kind: "ExperimentMetric",
							metric_type: "mean",
							name: "CTA Clicks",
							source: {
								kind: "EventsNode",
								event: "ab_test_cta_click",
								name: "ab_test_cta_click",
								math: "total"
							}
						}
					],

					parameters: {
						feature_flag_variants: featureFlagVariants,
						recommended_running_time: 0,
						recommended_sample_size: 0,
						minimum_detectable_effect: 30
					}
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => null);
				console.error('PostHog API Error:', response.status, errorData);

				if (response.status === 401) {
					setErrorMsg("Invalid PostHog API key. Please check your API key and try again.");
				} else if (response.status === 403) {
					setErrorMsg("Access denied. Make sure your API key has the 'experiment:write' scope.");
				} else if (response.status === 404) {
					setErrorMsg("PostHog project not found. Please check your project ID and try again.");
				} else if (response.status === 400) {
					setErrorMsg(`Bad request: ${errorData?.detail || 'Please check your experiment configuration.'}`);
				} else {
					setErrorMsg(`Failed to create experiment in PostHog. Status: ${response.status}`);
				}
				return;
			}

			const createdExperiment = await response.json();
			setSuccessMsg(`Experiment "${createdExperiment.name}" created successfully in PostHog! You can now configure your feature flag variants.`);

			setTimeout(() => {
				if (onCreated) {
					onCreated(createdExperiment);
				}
			}, 1000);

		} catch (error) {
			setErrorMsg("An error occurred while creating the experiment. Please try again.");
			console.error("Error creating experiment:", error);
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<div className="max-w-2xl">
			<div className="space-y-4 text-center">
				<div className="w-16 h-16 bg-gray-100 mx-auto flex items-center justify-center rounded-full">
					<img
						src="https://posthog.com/brand/posthog-logo-stacked.svg"
						alt="PostHog Logo"
						className="w-10 h-10"
					/>
				</div>
				<div>
					<h3 className="text-lg font-medium text-gray-900">No Experiment Found</h3>
					<p className="text-sm text-gray-600 mt-1">
						No experiment found with feature flag key:{" "}
						<span className="font-mono bg-gray-100 px-1 rounded">{experimentKey}</span>
					</p>
				</div>
			</div>
			<div className="space-y-3 mt-3">
				{/* Error Message Panel */}
				{errorMsg && (
					<div className="bg-red-50 border border-red-200 rounded-md p-4">
						<div className="flex">
							<div className="flex-shrink-0">
								<svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
									<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
								</svg>
							</div>
							<div className="ml-3">
								<p className="text-sm text-red-700 mt-1">{errorMsg}</p>
							</div>
							<div className="ml-auto p-2">
								<div className="-mx-1.5 -my-1.5">
									<button
										type="button"
										onClick={() => setErrorMsg(null)}
										className="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
									>
										<span className="sr-only">Dismiss</span>
										<svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
											<path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
										</svg>
									</button>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Success Message Panel */}
				{successMsg && (
					<div className="bg-green-50 border border-green-200 rounded-md p-4">
						<div className="flex">
							<div className="flex-shrink-0">
								<svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
									<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
								</svg>
							</div>
							<div className="ml-3">
								<p className="text-sm font-medium text-green-800">Success</p>
								<p className="text-sm text-green-700 mt-1">{successMsg}</p>
							</div>
							<div className="ml-auto pl-3">
								<div className="-mx-1.5 -my-1.5">
									<button
										type="button"
										onClick={() => setSuccessMsg(null)}
										className="inline-flex bg-green-50 rounded-md p-1.5 text-green-500 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-green-50 focus:ring-green-600"
									>
										<span className="sr-only">Dismiss</span>
										<svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
											<path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
										</svg>
									</button>
								</div>
							</div>
						</div>
					</div>
				)}

				<div className="space-y-3">
					<p className="text-sm text-gray-500">
						Create a new experiment in PostHog with this feature flag key to get started.
					</p>
					{!successMsg && (
						<div className="mt-3 p-1 flex justify-center">
							<button
								onClick={createExperiment}
								disabled={isLoading}
								className={clsx(
									"flex px-4 py-2 w-full  text-sm font-medium rounded-md justify-center items-center border border-transparent transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none",
									isLoading
										? "text-gray-400 bg-gray-200 cursor-not-allowed"
										: "text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 cursor-pointer"
								)}
							>
								{isLoading ? (
									<>
										<svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
											<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
											<path className="opacity-75" fill="currentColor" d="m15.84 10.2c-.1-.1-.25-.15-.4-.15s-.29.05-.39.15l-1.83 1.83-1.83-1.83c-.1-.1-.24-.15-.39-.15s-.29.05-.4.15c-.21.21-.21.56 0 .78l2.23 2.23c.21.21.56.21.78 0l2.23-2.23c.21-.22.21-.57 0-.78z"></path>
										</svg>
										Creating...
									</>
								) : (
									<>
										<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
										</svg>
										Create Experiment
									</>
								)}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
