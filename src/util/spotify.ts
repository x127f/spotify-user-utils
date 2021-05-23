import SpotifyWebApi from "spotify-web-api-node";

const spotify = new SpotifyWebApi({
	clientId: "08fd6454a22949ffadc8fe002459003b",
	redirectUri: "http://localhost:3000/authenticate",
});
export default spotify;

spotify.createAuthorizeURL = function (scopes?: ReadonlyArray<string>, state?: string, showDialog?: boolean): string {
	if (!scopes) scopes = ["user-read-private", "user-read-email"];

	return `https://accounts.spotify.com/authorize?client_id=${this.getClientId()}&show_dialog=false&response_type=token&redirect_uri=${this.getRedirectURI()}&scope=${encodeURIComponent(
		scopes.join(" ")
	)}&state=${state}`;
};

// @ts-ignore
window.test = spotify;

export function useAuth() {
	const expires_in = localStorage.getItem("expires_in");
	var access_token = localStorage.getItem("access_token");

	if (Date.now() < Number(expires_in) && access_token) {
		spotify.setAccessToken(access_token);
	} else {
		access_token = null;
	}

	return access_token;
}
