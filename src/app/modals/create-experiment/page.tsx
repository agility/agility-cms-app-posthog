"use client"

import { useAgilityAppSDK, closeModal } from "@agility/app-sdk"
import { CreateExperimentModal } from "@/components/CreateExperimentModal"
import { Experiment } from "@/components/PostHogSidebar"

export interface CreateExperimentModalProps {
	experimentKey: string
	postHogProjectId: string
	postHogAPIKey: string
	// Content item context passed from sidebar
	contentItem: any
	instance: any
	locale: string
	// Management token passed from sidebar (SDK may not work in modal iframe)
	managementToken: string
}

export default function CreateExperimentPage() {
	const { initializing, modalProps } = useAgilityAppSDK()

	if (initializing) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
			</div>
		)
	}

	const props = modalProps as CreateExperimentModalProps | undefined

	if (!props) {
		return (
			<div className="p-4 text-center text-red-600">
				Missing required modal props
			</div>
		)
	}

	const handleCreated = (experiment: Experiment) => {
		closeModal(experiment)
	}

	const handleCancel = () => {
		closeModal(null)
	}

	return (
		<div className="h-full flex flex-col bg-white">
			<CreateExperimentModal
				experimentKey={props.experimentKey}
				postHogProjectId={props.postHogProjectId}
				postHogAPIKey={props.postHogAPIKey}
				contentItem={props.contentItem}
				instance={props.instance}
				locale={props.locale}
				managementToken={props.managementToken}
				onCreated={handleCreated}
				onCancel={handleCancel}
			/>
		</div>
	)
}
