"use client"

import { useAgilityAppSDK, pageMethods } from "@agility/app-sdk"
import { useEffect, useMemo, useState } from "react"

import { PageAnalytics } from "@/components/PageAnalytics"
import Loader from "@/components/Loader"

const Page = () => {
	const { appInstallContext, pageItem, initializing } = useAgilityAppSDK()

	const [pageID, setPageID] = useState<number | null>(null)
	const [pageName, setPageName] = useState<string | null>(null)

	const postHogAPIKey = useMemo(() => {
		return appInstallContext?.configuration?.POSTHOG_API_KEY || null
	}, [appInstallContext?.configuration?.POSTHOG_API_KEY])

	const postHogProjectId = useMemo(() => {
		return appInstallContext?.configuration?.POSTHOG_PROJECT_ID || null
	}, [appInstallContext?.configuration?.POSTHOG_PROJECT_ID])

	useEffect(() => {
		const fetchPageData = async () => {
			try {
				// Get the full page item data
				const fullPageItem = await pageMethods.getPageItem()

				if (fullPageItem) {
					// Use CurrentItemID as the page identifier for analytics
					setPageID(fullPageItem.CurrentItemID || null)
					setPageName(fullPageItem.PageName || fullPageItem.Title || null)
				}
			} catch (err) {
				console.error("Error fetching page item:", err)
				// Fallback to pageItem from context if available
				if (pageItem) {
					setPageID(pageItem.CurrentItemID || null)
					setPageName(pageItem.PageName || pageItem.Title || null)
				}
			}
		}

		if (!initializing) {
			fetchPageData()
		}
	}, [initializing, pageItem])

	const hasConfig = !!postHogAPIKey && !!postHogProjectId

	if (initializing) {
		return <Loader />
	}

	if (!hasConfig) {
		return (
			<div className="bg-yellow-50 border border-yellow-200 rounded p-2">
				<p className="text-yellow-800 text-xs font-medium">PostHog not configured</p>
				<p className="text-yellow-700 text-[10px] mt-0.5">Configure API Key and Project ID in app settings.</p>
			</div>
		)
	}

	return (
		<PageAnalytics
			pageID={pageID}
			pageName={pageName}
			postHogAPIKey={postHogAPIKey}
			postHogProjectId={postHogProjectId}
		/>
	)
}

export default Page
