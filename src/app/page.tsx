

export default function Page() {

	return (
		<main className="m-10 ">
			<h1 className="text-3xl font-bold">PostHog app for Agility</h1>
			<p>This app provides PostHog capabilities to Agility.</p>
			<p>
				See the app definition file{" "}
				<a className="text-blue-500 hover:text-blue-600" href="/.well-known/agility-app.json">
					here
				</a>
				.
			</p>
		</main>
	)
}