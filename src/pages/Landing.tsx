import { Redirect } from "react-router";
import spotify, { useAuth } from "../util/spotify";
import "./Landing.scss";

export default function LandingPage() {
	const access_token = useAuth();
	console.log({ access_token });
	if (access_token) return <Redirect to="/overview"></Redirect>;

	return (
		<div className="page landing">
			<h1 className="h1">Spotify user utilities</h1>
			<a
				className="button dark large"
				href={spotify.createAuthorizeURL(
					["playlist-read-private", "playlist-modify-public", "playlist-modify-private"],
					""
				)}
			>
				Login with Spotify
			</a>
		</div>
	);
}
