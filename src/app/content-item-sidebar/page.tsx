"use client"

/**
 * Content Item Sidebar Page
 *
 * This component renders as a sidebar panel within the Agility CMS content item editor.
 * It provides two tabs:
 * 1. Analytics - Shows content-level analytics from PostHog (views, scroll depth, time on page)
 * 2. A/B Test - Shows experiment results if the content item has an ExperimentKey field
 *
 * The sidebar is designed for narrow iframe panels with compact styling.
 */

import { useAgilityAppSDK, contentItemMethods } from "@agility/app-sdk"
import { useEffect, useMemo, useState } from "react"
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import clsx from 'clsx'

import { PostHogSidebar } from "@/components/PostHogSidebar"
import { ContentAnalytics } from "@/components/ContentAnalytics"
import Loader from "@/components/Loader"

import { IAgilityContentItem } from "@/types/IAgilityContentItem"

const Page = () => {
	// Get SDK context including the current content item and app configuration
	const { appInstallContext, contentItem, locale, initializing } = useAgilityAppSDK()
	const item = contentItem as IAgilityContentItem | null

	// Track the experiment key from the content item's ExperimentKey field
	const [experimentKey, setExperimentKey] = useState<string | null>(item?.values?.ExperimentKey || null)
	const [selectedTab, setSelectedTab] = useState(0)

	// Extract PostHog configuration from app install settings
	const postHogAPIKey = useMemo(() => {
		return appInstallContext?.configuration?.POSTHOG_API_KEY || null
	}, [appInstallContext?.configuration?.POSTHOG_API_KEY])

	const postHogProjectId = useMemo(() => {
		return appInstallContext?.configuration?.POSTHOG_PROJECT_ID || null
	}, [appInstallContext?.configuration?.POSTHOG_PROJECT_ID])

	// Get the content ID for analytics queries
	const contentID = item?.contentID

	// Listen for changes to the ExperimentKey field in real-time
	// This allows the sidebar to update when the user modifies the field
	useEffect(() => {
		const currentExperimentKey = item?.values?.ExperimentKey
		setExperimentKey(currentExperimentKey || null)

		// Register a field listener to detect changes to ExperimentKey
		contentItemMethods.addFieldListener({
			fieldName: "ExperimentKey",
			onChange: (value) => {
				setExperimentKey(value || null)
			}
		});

		// Cleanup listener on unmount
		return () => {
			contentItemMethods.removeFieldListener({ fieldName: "ExperimentKey" })
		}

	}, [postHogAPIKey, postHogProjectId, item?.values?.ExperimentKey])

	const hasExperiment = !!experimentKey
	const hasConfig = !!postHogAPIKey && !!postHogProjectId

	// Show loader while SDK is initializing
	if (initializing) {
		return <Loader />
	}

	// Show configuration warning if PostHog credentials are missing
	if (!hasConfig) {
		return (
			<div className="bg-yellow-50 border border-yellow-200 rounded p-2">
				<p className="text-yellow-800 text-xs font-medium">PostHog not configured</p>
				<p className="text-yellow-700 text-[10px] mt-0.5">Configure API Key and Project ID in app settings.</p>
			</div>
		)
	}

	return (
		<div>
			{/* Tab navigation - Analytics and A/B Test tabs */}
			<TabGroup selectedIndex={selectedTab} onChange={setSelectedTab}>
				<TabList className="flex space-x-0.5 rounded-md bg-gray-100 p-0.5 mb-3">
					<Tab className={({ selected }) => clsx(
						'flex-1 rounded px-2 py-1.5 text-xs font-medium transition-all',
						'focus:outline-none',
						selected
							? 'bg-white shadow-sm text-indigo-700'
							: 'text-gray-600 hover:text-gray-800'
					)}>
						Analytics
					</Tab>
					<Tab className={({ selected }) => clsx(
						'flex-1 rounded px-2 py-1.5 text-xs font-medium transition-all',
						'focus:outline-none',
						selected
							? 'bg-white shadow-sm text-indigo-700'
							: 'text-gray-600 hover:text-gray-800',
						!hasExperiment && 'opacity-50'
					)}>
						<span className="flex items-center justify-center gap-1">
							A/B Test
							{/* Green dot indicator when an experiment is configured */}
							{hasExperiment && (
								<span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
							)}
						</span>
					</Tab>
				</TabList>

				<TabPanels>
					{/* Analytics Tab - Shows content performance metrics */}
					<TabPanel className="focus:outline-none">
						<ContentAnalytics
							contentID={contentID}
							locale={locale}
							postHogAPIKey={postHogAPIKey}
							postHogProjectId={postHogProjectId}
						/>
					</TabPanel>

					{/* A/B Test Tab - Shows experiment results or setup instructions */}
					<TabPanel className="focus:outline-none">
						{hasExperiment ? (
							<PostHogSidebar
								experimentKey={experimentKey}
								postHogAPIKey={postHogAPIKey}
								postHogProjectId={postHogProjectId}
							/>
						) : (
							<div className="text-center py-4">
								<p className="text-gray-500 text-xs font-medium">No A/B test configured</p>
								<p className="text-gray-400 text-[10px] mt-1">
									Add <code className="bg-gray-100 px-0.5 rounded">ExperimentKey</code> field to enable
								</p>
							</div>
						)}
					</TabPanel>
				</TabPanels>
			</TabGroup>
		</div>
	)
}

export default Page
