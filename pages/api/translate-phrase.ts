// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next"
import { v2 } from "@google-cloud/translate"

interface ICloudCredentials{
	projectId: string
	private_key: string
	client_email: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<string>) {
	const lang = `${req.query.lang}` || ""

	const { Translate } = v2

	const { projectId, private_key, client_email, str } = req.body

	const clean_private_key = private_key.replace(/\\n/g, "\n")

	const translator = new Translate({
		projectId,
		credentials: {
			private_key: clean_private_key,
			client_email
		}
	})

	const [translation] = await translator.translate(str, lang);

	res.status(200).json(translation)
}

