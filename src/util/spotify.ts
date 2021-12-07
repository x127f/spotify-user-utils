import SpotifyWebApi from "spotify-web-api-node";

const spotify = new SpotifyWebApi({
	clientId: "570657b1b2564136a6bdc06e90fbe78d",
	redirectUri:
		process.env.NODE_ENV === "development"
			? "http://localhost:3000/authenticate"
			: "https://grabberskitter-6r95f1.stormkit.dev/authenticate",
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
