// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next"
import { v2 } from "@google-cloud/translate"

export default async function handler(req: NextApiRequest, res: NextApiResponse<string>) {
	const { Translate } = v2

	const { projectId, private_key, client_email, str } = req.body

	const clean_private_key = private_key.replace(/\\n/g, "\n"	)

	const translator = new Translate({
		projectId,
		credentials: {
			private_key: clean_private_key,
			client_email
		}
	})

	console.log("translator: ", str)
  const [detections] = await translator.detect(str);

  console.log("Detections: ", detections)

	res.status(200).json(detections.language)
}

