import {useEffect, useState} from "react";
import spotify, {getAllUserPlaylists} from "../util/spotify";
import "./Overview.scss";
import Playlist from "../components/Playlist";
import "missing-native-js-functions";

export default function OverviewPage() {
	const [playlists, setPlaylist] = useState<SpotifyApi.PlaylistObjectSimplified[]>([]);
	const [selectedPlaylist, selectPlaylist] = useState<string | null>(null);
	const [dedupPlaylists, setDedup] = useState<SpotifyApi.PlaylistObjectSimplified[]>([]);
	const [user, setUser] = useState<string>('');
	const [country, setCountry] = useState('');
	const [dedupMax, setDedupMax] = useState(0);
	const [dedupProgress, setDedupProgress] = useState(0);
	

	useEffect(() => {
		//console.log("fetch playlists");
		spotify.getMe().then(async ({body: state}) => {
			setUser(state.id);
		});
		spotify.getMe().then(async ({body: state}) => {
			setCountry(state.country);
		});
		getAllUserPlaylists().then((x) => setPlaylist(x.items));
		return;
	}, []);

	var dedupArray: any[] = dedupPlaylists;

	enum ERemovalMode {
		Dedup,
		Unavailable
	}

	async function removeTracks(mode: ERemovalMode) {
		interface trackInfo {
			track: any,
			index: number,
			playlist: SpotifyApi.SinglePlaylistResponse
		}

		if (!!dedupMax) return;
		setDedupProgress(0);
		setDedupMax(0);

		let plstsResponse = [];
		let max = 0;
		let progress = 0;
		for (const plIt of dedupPlaylists) {
			const {body: plResponse} = (await spotify.getPlaylist(plIt.id, {market: country}));
			plstsResponse.push(plResponse);
			max += plResponse.tracks.total;
			progress += plResponse.tracks.limit;
		}
		setDedupMax(max);
		setDedupProgress(progress);

		let trackList: trackInfo[] = [];
		for (const plIt of plstsResponse) {
			do {
				plIt.tracks.offset += plIt.tracks.limit;
				const {body: tracksResponse} = await spotify.getPlaylistTracks(plIt.id, {
					market: country,
					offset: plIt.tracks.offset
				});
				plIt.tracks.items = plIt.tracks.items.concat(tracksResponse.items);
				progress += Math.min(plIt.tracks.total - plIt.tracks.offset, plIt.tracks.limit);
				setDedupProgress(progress);
			} while (plIt.tracks.offset + plIt.tracks.limit < plIt.tracks.total);

			for (let i = 0; i < plIt.tracks.items.length; i++) {
				if (plIt.tracks.items[i].track.type === 'track') {
					trackList.push({
						track: plIt.tracks.items[i].track || null,
						index: i,
						playlist: plIt
					});
				}
			}
		}

		let str = '';
		switch (+mode) {
			case ERemovalMode.Dedup:
				str = 'duplicated';
				//search for duplicates and leave only them
				const tracksUri = trackList.map((x) => x.track.uri);
				for (let i = 0; i < trackList.length; i++) {
					if (tracksUri.indexOf(trackList[i].track.uri) === i) {
						trackList[i].index = -1;
					}
				}
				trackList = trackList.filter((x) => x.index >= 0);
				break;
			case ERemovalMode.Unavailable:
				str = 'unavailable';
				//search for unavailables songs and leave only them
				trackList = trackList.filter((x) => x.track.is_playable === false);
				break;
			default:
				setDedupMax(0);
				return;
		}

		//get track names
		let trackNames = [];
		let lastPlaylist = null;
		for (const trackIt of trackList) {
			if (lastPlaylist !== trackIt.playlist) {
				trackNames.push(
					(lastPlaylist ? '\n' : '')
					+ '"' + trackIt.playlist.name + '"');
				lastPlaylist = trackIt.playlist;
			}
			trackNames.push((trackIt.index + 1) + '-' + trackIt.track.name);
		}

		setDedupProgress(max);
		await spotify.getMe(); //just timeout for rendering

		if (trackList.length) {
			const allow = window.confirm(`Delete ${trackList.length} ${str} tracks?\n${trackNames.toString()}`);
			if (allow) {
				while (trackList.length) {
					let curPlaylist = trackList[0].playlist;
					let curTrackList = trackList
						.filter((x) => x.playlist === curPlaylist)
						.sort((x, y) => y.index - x.index);
					const list = (await spotify.getPlaylist(curPlaylist.id)).body;
					while (curTrackList.length) {
						const batch = curTrackList.slice(0, 100).map((x) => x.index);
						curTrackList = curTrackList.slice(100);
						await spotify.removeTracksFromPlaylistByPosition(list.id, batch, list.snapshot_id);
						batch.forEach((x) => curPlaylist.tracks.items.splice(x));
					}
					trackList = trackList.filter((x) => x.playlist !== curPlaylist);
				}
			}
		} else {
			alert('No ' + str + ' tracks!');
		}
		setDedupMax(0);
	}

	function cleanDedupList() {
		setDedupMax(0);
		dedupArray = [];
		setDedup(dedupArray);
	}

	const entryMouseDownHandler = function (e: any) {
		e.dataTransfer.setData("playlist", e.target.getAttribute("data-playlist"));
	}

	const dragOverHandler = function (e: React.FormEvent<HTMLDivElement>) {
		e.preventDefault();
	}

	const dropHandler = function (e: any) {
		let playlistId = e.dataTransfer.getData("playlist");
		let playlist = playlists.find((x) => x.id === playlistId);
		if (playlist && !dedupArray.includes(playlist) && (playlist.owner.id === user || playlist.collaborative)) {
			dedupArray.push(playlist);
			const newPlaylists = [...dedupArray];
			setDedup(newPlaylists);
		}
	}

	return (
		<div className="page overview">
			<h2 className="centeredText">Overview</h2>

			<div className="playlists">
				{playlists.length === 0 && "Loading ... or you don't have any playlists"}
				{playlists.map((x) => (
					<div onClick={()=>selectPlaylist(x.id)} onDragStart={entryMouseDownHandler}
					     draggable="true"
					     data-playlist={x.id}
					     key={x.id} className="entry">
						<img src={x.images.first()?.url} data-playlist={x.id} alt={''}/>
						{x.name}
					</div>
				))}
			</div>

			{!!dedupMax && (<progress max={dedupMax} value={dedupProgress}/>)}
			<div className="playlistsDedup" onDragOver={dragOverHandler} onDrop={dropHandler}>
				{dedupPlaylists.map((x) => (
					<div onClick={()=>selectPlaylist(x.id)}
					     data-playlist={x.id}
					     key={x.id} className="entryDedup">
						<img src={x.images.first()?.url} data-playlist={x.id} alt={''}/>
						{x.name}
					</div>
				))}
				<h2 className="dedupText">Drag&Drop playlists here for removing unavailable or duplicates tracks
					<br/>(tracks are saved in the playlist earlier in the list)</h2>
			</div>

			<div className="actions">
				<button style={dedupPlaylists.length ? {} : {display: 'none'}}
				        onClick={() => removeTracks(ERemovalMode.Dedup)} className="button light save">
					Remove duplicates
				</button>
				<button style={dedupPlaylists.length ? {} : {display: 'none'}}
				        onClick={() => removeTracks(ERemovalMode.Unavailable)} className="button light save">
					Remove unavailable tracks
				</button>
				<button style={dedupPlaylists.length ? {} : {display: 'none'}}
				        onClick={() => cleanDedupList()} className="button light save">
					Clean list
				</button>
			</div>

			<br/>
			{selectedPlaylist && <Playlist id={selectedPlaylist} playlists={playlists}/>}
		</div>
	);
}
