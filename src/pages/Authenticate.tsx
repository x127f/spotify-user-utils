import { Link, Redirect } from "react-router-dom";
import spotify from "../util/spotify";
import "./Authenticate.scss";

export default function AuthenticatePage() {
	if (window.location.hash) {
		var { access_token, token_type, expires_in } = Object.fromEntries(
			new URLSearchParams(window.location.hash.slice(1)).entries()
		);
		if (!access_token) return <Redirect to="/"></Redirect>;

		spotify.setAccessToken(access_token);
		localStorage.setItem("access_token", access_token);
		localStorage.setItem("expires_in", `${Date.now() + 1000 * Number(expires_in)}`);

		setTimeout(() => {
			window.location.reload();
		}, 1000 * Number(expires_in));

		return <Redirect to="/overview"></Redirect>;
	} else {
		var { error, state } = Object.fromEntries(new URLSearchParams(window.location.search).entries());

		return (
			<div className="page authenticate">
				<h1>Authenticate</h1>

				<div className="error">
					<p className="red">Error: {error}</p>
					<Link to="/" className="button large red">
						Retry
					</Link>
				</div>
			</div>
		);
	}
}
