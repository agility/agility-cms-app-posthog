import Head from "next/head"
import '@agility/plenum-ui/lib/tailwind.css';

export default function Home() {
	return (
		<>
			<Head>
				<title>Google Translate for Agility</title>
				<meta name="description" content="An example app showing the capabilities of the Agility App SDK v2" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="icon" href="/favicon.ico" />
			</Head>
			<main className="m-10">
				<h1 className="text-3xl font-bold">Google Translate for Agility</h1>
				<p>This app provides Google Translate capabilities to Agility.</p>
				<p>
					See the app definition file{" "}
					<a className="text-blue-500 hover:text-blue-600" href="/.well-known/agility-app.json">
						here
					</a>
					.
				</p>
			</main>
		</>
	)
}
