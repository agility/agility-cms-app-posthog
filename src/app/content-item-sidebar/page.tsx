"use client"

import { useAgilityAppSDK, contentItemMethods } from "@agility/app-sdk"
import { useEffect, useMemo, useState } from "react"
import { Checkbox, Button } from "@agility/plenum-ui"

import { PostHogSidebar } from "@/components/PostHogSidebar"
import Loader from "@/components/Loader"

import { IAgilityContentItem } from "@/types/IAgilityContentItem"

const Page = () => {

	const { appInstallContext, contentItem, contentModel, locale, initializing } = useAgilityAppSDK()
	const item = contentItem as IAgilityContentItem | null

	const [experimentKey, setExperimentKey] = useState<string | null>(item?.values?.ExperimentKey || null)
	const postHogAPIKey = useMemo(() => {
		return appInstallContext?.configuration?.POSTHOG_API_KEY || null
	}, [appInstallContext?.configuration?.POSTHOG_API_KEY])


	const postHogProjectId = useMemo(() => {
		return appInstallContext?.configuration?.POSTHOG_PROJECT_ID || null
	}, [appInstallContext?.configuration?.POSTHOG_PROJECT_ID])

	useEffect(() => {
		console.log("appInstallContext", appInstallContext)

		console.log("postHogAPIKey ", postHogAPIKey, "postHogProjectId", postHogProjectId)

		const currentExperimentKey = item?.values?.ExperimentKey
		setExperimentKey(currentExperimentKey)

		contentItemMethods.addFieldListener({
			fieldName: "ExperimentKey",
			onChange: (value) => {
				//when the ExperimentKey field changes, update the state
				console.log("ExperimentKey changed: ", !!value)
				setExperimentKey(value)
			}
		});

		() => {
			contentItemMethods.removeFieldListener({ fieldName: "ExperimentKey" })
		}

	}, [postHogAPIKey, postHogProjectId, item?.values?.ExperimentKey])




	return (<html>
		<head>
			<title>Content Item Sidebar</title>
		</head>
		<body>
			{initializing ? <Loader /> : experimentKey && postHogProjectId && postHogAPIKey ? (
				<PostHogSidebar {...{ experimentKey, postHogAPIKey, postHogProjectId }} />
			) : <div>This content item does not have an Experiment Key.</div>}
		</body>
	</html>)
}

export default Page