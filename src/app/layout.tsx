
import "@/styles/output.css"


export default function Layout({ children }: { children: any }) {
	return (
		<html>
			<head>
				<title>PostHog app for Agility</title>
				<meta name="description" content="An example app showing the capabilities of the Agility App SDK v2" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="icon" href="/favicon.ico" />
			</head>
			<body>
				{children}

			</body>
		</html>


	)
}