import SpotifyWebApi from "spotify-web-api-node";

const spotify = new SpotifyWebApi({
	clientId: process.env.REACT_APP_CLIEND_ID,
	redirectUri:
		process.env.NODE_ENV === "development"
			? "http://localhost:3000/authenticate"
			: process.env.REACT_APP_AUTHENTICATE_URL,
});
export default spotify;

spotify.createAuthorizeURL = function (scopes?: ReadonlyArray<string>, state?: string, showDialog?: boolean): string {
	if (!scopes) scopes = [];

	return `https://accounts.spotify.com/authorize?client_id=${this.getClientId()}&show_dialog=false&response_type=token&redirect_uri=${this.getRedirectURI()}&scope=${encodeURIComponent(
		scopes.join(" ")
	)}&state=${state}`;
};

export async function getAllUserPlaylists() {
	var playlists: SpotifyApi.ListOfUsersPlaylistsResponse;

	do {
		const response = await spotify.getUserPlaylists({
			limit: 50,
			// @ts-ignore
			offset: playlists?.offset + playlists?.limit || 0,
		});
		// @ts-ignore
		playlists = { ...response.body, items: (playlists?.items || []).concat(response.body.items) };
	} while (playlists.next);

	return playlists;
}

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
