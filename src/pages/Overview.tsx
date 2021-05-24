import { useEffect, useState } from "react";
import { getAllUserPlaylists } from "../util/spotify";
import "./Overview.scss";
import Playlist from "../components/Playlist";
import "missing-native-js-functions";

export default function OverviewPage() {
	const [playlists, setPlaylist] = useState<SpotifyApi.PlaylistObjectSimplified[]>([]);
	const [selectedPlaylist, selectPlaylist] = useState<string | null>(null);

	useEffect(() => {
		console.log("fetch playlists");
		getAllUserPlaylists().then((x) => setPlaylist(x.items));
		return;
	}, []);

	console.log(playlists);

	return (
		<div className="page overview">
			<h1>Overview</h1>

			<div className="playlists">
				{playlists.length === 0 && "Loading ... or you don't have any playlists"}
				{playlists.map((x) => (
					<div onClick={selectPlaylist.bind(null, x.id)} key={x.id} className="entry">
						<img src={x.images.first()?.url}></img>
						{x.name}
					</div>
				))}
			</div>

			{selectedPlaylist && <Playlist id={selectedPlaylist} playlists={playlists}></Playlist>}
		</div>
	);
}
