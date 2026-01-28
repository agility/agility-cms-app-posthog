"use client"

import { useAgilityAppSDK, contentItemMethods } from "@agility/app-sdk"
import { useEffect, useMemo, useState } from "react"
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import clsx from 'clsx'

import { PostHogSidebar } from "@/components/PostHogSidebar"
import { ContentAnalytics } from "@/components/ContentAnalytics"
import Loader from "@/components/Loader"

import { IAgilityContentItem } from "@/types/IAgilityContentItem"

const Page = () => {

	const { appInstallContext, contentItem, initializing } = useAgilityAppSDK()
	const item = contentItem as IAgilityContentItem | null

	const [experimentKey, setExperimentKey] = useState<string | null>(item?.values?.ExperimentKey || null)
	const [selectedTab, setSelectedTab] = useState(0)

	const postHogAPIKey = useMemo(() => {
		return appInstallContext?.configuration?.POSTHOG_API_KEY || null
	}, [appInstallContext?.configuration?.POSTHOG_API_KEY])

	const postHogProjectId = useMemo(() => {
		return appInstallContext?.configuration?.POSTHOG_PROJECT_ID || null
	}, [appInstallContext?.configuration?.POSTHOG_PROJECT_ID])

	// Get the content ID from the current item
	const contentID = item?.contentID

	useEffect(() => {
		console.log("appInstallContext", appInstallContext)
		console.log("postHogAPIKey ", postHogAPIKey, "postHogProjectId", postHogProjectId)

		const currentExperimentKey = item?.values?.ExperimentKey
		setExperimentKey(currentExperimentKey || null)

		contentItemMethods.addFieldListener({
			fieldName: "ExperimentKey",
			onChange: (value) => {
				console.log("ExperimentKey changed: ", !!value)
				setExperimentKey(value || null)
			}
		});

		return () => {
			contentItemMethods.removeFieldListener({ fieldName: "ExperimentKey" })
		}

	}, [postHogAPIKey, postHogProjectId, item?.values?.ExperimentKey])

	const hasExperiment = !!experimentKey
	const hasConfig = !!postHogAPIKey && !!postHogProjectId

	if (initializing) {
		return (
			<html>
				<head><title>Content Item Sidebar</title></head>
				<body className="p-4">
					<Loader />
				</body>
			</html>
		)
	}

	if (!hasConfig) {
		return (
			<html>
				<head><title>Content Item Sidebar</title></head>
				<body className="p-4">
					<div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
						<div className="flex items-start gap-3">
							<svg className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
							<div>
								<p className="text-yellow-800 font-medium">PostHog not configured</p>
								<p className="text-yellow-700 text-sm mt-1">
									Please configure your PostHog API Key and Project ID in the app settings.
								</p>
							</div>
						</div>
					</div>
				</body>
			</html>
		)
	}

	return (
		<html>
			<head><title>Content Item Sidebar</title></head>
			<body className="p-4">
				<TabGroup selectedIndex={selectedTab} onChange={setSelectedTab}>
					<TabList className="flex space-x-1 rounded-lg bg-gray-100 p-1 mb-4">
						<Tab className={({ selected }) => clsx(
							'w-full rounded-md py-2 text-sm font-medium leading-5 transition-all',
							'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-indigo-400 ring-white/60',
							selected
								? 'bg-white shadow text-indigo-700'
								: 'text-gray-600 hover:bg-white/50 hover:text-gray-800'
						)}>
							<span className="flex items-center justify-center gap-1.5">
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
								</svg>
								Analytics
							</span>
						</Tab>
						<Tab className={({ selected }) => clsx(
							'w-full rounded-md py-2 text-sm font-medium leading-5 transition-all',
							'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-indigo-400 ring-white/60',
							selected
								? 'bg-white shadow text-indigo-700'
								: 'text-gray-600 hover:bg-white/50 hover:text-gray-800',
							!hasExperiment && 'opacity-60'
						)}>
							<span className="flex items-center justify-center gap-1.5">
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
								</svg>
								A/B Testing
								{hasExperiment && (
									<span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
										Active
									</span>
								)}
							</span>
						</Tab>
					</TabList>

					<TabPanels>
						<TabPanel className="focus:outline-none">
							<ContentAnalytics
								contentID={contentID}
								postHogAPIKey={postHogAPIKey}
								postHogProjectId={postHogProjectId}
							/>
						</TabPanel>
						<TabPanel className="focus:outline-none">
							{hasExperiment ? (
								<PostHogSidebar
									experimentKey={experimentKey}
									postHogAPIKey={postHogAPIKey}
									postHogProjectId={postHogProjectId}
								/>
							) : (
								<div className="text-center py-8">
									<svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
									</svg>
									<p className="text-gray-600 font-medium">No A/B test configured</p>
									<p className="text-gray-400 text-sm mt-2">
										Add an <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">ExperimentKey</code> field to this content model to enable A/B testing.
									</p>
								</div>
							)}
						</TabPanel>
					</TabPanels>
				</TabGroup>
			</body>
		</html>
	)
}

export default Page
