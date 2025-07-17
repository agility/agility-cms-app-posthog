import { useAgilityAppSDK, contentItemMethods } from "@agility/app-sdk"
import { useEffect, useState } from "react"
import { Checkbox, Button } from "@agility/plenum-ui"
import "@agility/plenum-ui/lib/tailwind.css"
import axios from "axios"
import LanguageIcon from "@/components/LanguageIcon"
import Loader from "@/components/Loader"


interface IListItemProps {
	text: string
	isChecked: boolean
	isDisabled: boolean
	onToggle: () => void
}

function isNumeric(str: string) {
	// Check if the value is a number with or without decimals, or formatted with commas
	const regex = /^-?\d+(,\d{3})*(\.\d+)?$/
	return regex.test(str)
}

function isEmptyOrSpaces(str: string) {
	// Check if the string is empty or contains only spaces
	return str === null || str.match(/^ *$/) !== null
}

function ListItem({ text, isChecked, onToggle, isDisabled }: IListItemProps) {

	return (
		<li
			className={`flex ${!isDisabled && "cursor-pointer"} items-center justify-between py-2 pl-4 ${isDisabled && "bg-gray-100"}`}
			onClick={isDisabled ? () => {} : onToggle}
		>
			<Checkbox
				isChecked={isChecked}
				isDisabled={isDisabled}
				label={""}
				// @ts-ignore TODO: fix this
				className="items-center"
			/>
			<span className="flex-1 text-gray-700">{text}</span>

		</li>
	)
}

interface IListProps {
	items: IContentField[]
	setItems: (items: IContentField[]) => void
}

function List({ items, setItems }: IListProps) {
	const handleToggle = (index: any) => {
		items[index].isChecked = !items[index].isChecked
		setItems([...items])
	}
	return (
		<div className="flex flex-col my-6" style={{ height: "100%", overflowY: "auto" }}>
			<ul className=" divide-y divide-gray-200 rounded-md border">
				{items.map((item: IContentField, index: number) => (
					<ListItem
						key={index}
						text={item.label}
						isChecked={item.isChecked}
						onToggle={() => handleToggle(index)}
						isDisabled={item.isDisabled}
					/>
				))}
			</ul>
		</div>
	)
}

interface IContentField {
	field: string
	value: string
	lang: string
	isChecked: boolean
	isDisabled: boolean
	label: string
}

export default function ContentItemSidebar() {
	const { appInstallContext, contentItem, contentModel, locale } = useAgilityAppSDK()

	const [selectedLang, setSelectedLang] = useState<string>("en")
	const [contentFields, setContentFields] = useState<IContentField[]>([])
	const [isLoading, setIsLoading] = useState<boolean>(false)

	const [gc_email, setGc_email] = useState<string>("")
	const [gc_privateKey, setGc_privateKey] = useState<string>("")
	const [gc_projectId, setGc_projectId] = useState<string>("")

	useEffect(() => {
		if (!appInstallContext?.configuration) return

		const { GC_PROJECT_ID, GC_EMAIL, GC_PRIVATE_KEY } = appInstallContext.configuration

		if (!GC_PROJECT_ID || !GC_EMAIL || !GC_PRIVATE_KEY) return

		const defaultLang = locale?.split("-")[0] ?? "en"
		setGc_email(GC_EMAIL)
		setGc_privateKey(GC_PRIVATE_KEY)
		setGc_projectId(GC_PROJECT_ID)
		setSelectedLang(defaultLang)
	}, [appInstallContext, contentItem, locale])

	useEffect(() => {
		const validFields = ["Text", "LongText", "HTML", "Custom"]

		const mappedFields: IContentField[] = []

		async function mapContentItemFields() {
			const mappedModel: any = {}
			setIsLoading(true)
			//@ts-ignore
			for (const item of contentModel?.fields) {
				const { name, ...rest } = item
				mappedModel[name] = rest
			}

			const shortLocale = locale?.split("-")[0] ?? "en"
			// @ts-ignore
			for (const [key, value] of Object.entries(contentItem?.values ?? {})) {
				if (mappedModel[key] === null || mappedModel[key] === undefined) continue

				const { fieldType } = mappedModel[key]

				if (!validFields.includes(fieldType)) continue

				const fieldVal = String(value)
				const field: IContentField = {
					field: key,
					label: mappedModel[key].label,
					value: fieldVal,
					lang: "EN-US",
					isChecked: false,
					isDisabled: false
				}

				if (isEmptyOrSpaces(fieldVal) || isNumeric(fieldVal)) {
					field.lang = "N/A"
					//field.isDisabled = true
				}
				mappedFields.push(field)
			}
			setIsLoading(false)
			setContentFields(mappedFields)
		}

		if (!gc_email || !gc_privateKey || !gc_projectId) return

		mapContentItemFields()
	}, [contentItem, gc_email, gc_privateKey, gc_projectId, contentModel, locale])


	const handleTranslate = async () => {

		//get the updated field values from the content item
		const contentItem = await contentItemMethods.getContentItem()
		if (! contentItem) return

		const getNewFields = contentFields.map(async (field) => {
			//if (field.lang === "N/A") return field

			if (field.isChecked && !field.isDisabled) {
				const fieldValue = contentItem?.values[field.field]
				const translated = await getTranslatedValue(fieldValue)
				field.lang = selectedLang.toUpperCase()
				field.isChecked = false
				field.value = translated
				contentItemMethods.setFieldValue({ name: field.field, value: translated })

			}
			return field
		})

		const newFields = await Promise.all(getNewFields)
		setContentFields([...newFields])
	}

	const getTranslatedValue = async (value: string) => {
		const payload = {
			projectId: gc_projectId,
			private_key: gc_privateKey,
			client_email: gc_email,
			str: value
		}
		const translatedValue = await axios.post(`/api/translate-phrase?lang=${selectedLang}`, payload)
		return translatedValue.data
	}

	return (
		<div className="flex h-full w-full flex-col p-1">
			{isLoading ? (
				<Loader />
			) : (
				<>
					<div>{`Select fields you'd like to translate into your current locale (${locale}).`}</div>
					<List items={contentFields} setItems={setContentFields} />
					<Button
						iconObj={<LanguageIcon></LanguageIcon>}
						label="Translate Fields"
						onClick={handleTranslate}
						isDisabled={contentFields.filter((_) => _.isChecked).length === 0}
					/>
				</>
			)}
		</div>
	)
}
