"use client"

import { useAgilityAppSDK, setHeight } from "@agility/app-sdk"
import { useMemo, useEffect } from "react"

import { Dashboard } from "@/components/Dashboard"
import Loader from "@/components/Loader"

const Page = () => {
	const { appInstallContext, initializing } = useAgilityAppSDK()

	useEffect(() => {
		setHeight({ height: 1000 })
	}, [])

	const postHogAPIKey = useMemo(() => {
		return appInstallContext?.configuration?.POSTHOG_API_KEY || null
	}, [appInstallContext?.configuration?.POSTHOG_API_KEY])

	const postHogProjectId = useMemo(() => {
		return appInstallContext?.configuration?.POSTHOG_PROJECT_ID || null
	}, [appInstallContext?.configuration?.POSTHOG_PROJECT_ID])

	const hasConfig = !!postHogAPIKey && !!postHogProjectId

	if (initializing) {
		return <Loader />
	}

	if (!hasConfig) {
		return (
			<div className="bg-yellow-50 border border-yellow-200 rounded p-3">
				<p className="text-yellow-800 text-sm font-medium">PostHog not configured</p>
				<p className="text-yellow-700 text-xs mt-1">Configure API Key and Project ID in app settings.</p>
			</div>
		)
	}

	return (
		<Dashboard
			postHogAPIKey={postHogAPIKey}
			postHogProjectId={postHogProjectId}
		/>
	)
}

export default Page
