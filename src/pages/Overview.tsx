import {useEffect, useReducer, useRef, useState} from 'react';
import spotify, {getAllUserPlaylists} from '../util/spotify';
import './Overview.scss';
import Playlist from '../components/Playlist';
import {millisToMinutesAndSeconds} from '../components/Playlist';
import {Popup} from "../components/Popup";
import 'missing-native-js-functions';

export default function OverviewPage() {
	const [playlists, setPlaylist] = useState<SpotifyApi.PlaylistObjectSimplified[]>([]);
	const [selectedPlaylist, selectPlaylist] = useState<string | null>(null);
	const [dedupPlaylists, setDedup] = useState<SpotifyApi.PlaylistObjectSimplified[]>([]);
	const [user, setUser] = useState<string>('');
	const [country, setCountry] = useState('');
	const [dedupMax, setDedupMax] = useState(0);
	const [dedupProgress, setDedupProgress] = useState(0);
	const [popup, openPopup] = useState(false);
	const [selectedElnt, setSelectedElnt] = useState<HTMLDivElement | undefined>(undefined);
	const [deleteList, setDeleteList] = useState<trackInfo[]>([]);
	const [, forceUpdate] = useReducer(x => x + 1, 0);

	var enterTarget: EventTarget | null = null;

	const canSelectRef = useRef(true);
	const playlistRef = useRef('');

	interface trackInfo {
		track: any,
		index: number,
		playlist: SpotifyApi.SinglePlaylistResponse,
		original: string
	}


	useEffect(() => {
		//console.log('fetch playlists');
		spotify.getMe().then(async ({body: state}) => {
			setUser(state.id);
		});
		spotify.getMe().then(async ({body: state}) => {
			setCountry(state.country);
		});
		getAllUserPlaylists().then((x) => setPlaylist(x.items));

	}, []);


	enum ERemovalMode {
		Dedup,
		Unavailable
	}

	async function removeTracks(mode: ERemovalMode) {
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
						track: plIt.tracks.items[i].track,
						index: i,
						playlist: plIt,
						original: ''
					});
				}
			}
		}

		let str = '';
		switch (+mode) {
			case ERemovalMode.Dedup:
				str = 'duplicated';
				//search for duplicates and leave only them
				const trackUri = trackList.map((x) => x.track.uri);
				for (let i = 0; i < trackList.length; i++) {
					const indexOfTrack = trackUri.indexOf(trackList[i].track.uri);
					if (indexOfTrack !== i) {
						const orig = trackList[indexOfTrack];
						trackList[i].original = orig.playlist.name + ' #' + (orig.index + 1);
					}
				}
				trackList = trackList.filter((x) => !!x.original);
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
		trackList = trackList.filter((x) => x.playlist.owner.id === user || x.playlist.collaborative);

		setDedupProgress(max);
		forceUpdate();

		if (trackList.length) {
			setDeleteList(trackList);
			openPopup(true);
		} else {
			alert('No ' + str + ' tracks!');
		}
		setDedupMax(0);
	}

	async function ConfirmRemoval() {
		let trackList = [...deleteList];
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
				batch.forEach((x) => curPlaylist.tracks.items.splice(x, 1));
			}
			trackList = trackList.filter((x) => x.playlist !== curPlaylist);
		}
		setDeleteList([]);
		openPopup(false);
	}

	function cleanDedupList() {
		setDedupMax(0);
		setDedup([]);
	}

	function selectPlaylistHelper(id: string) {
		// if (canSelectRef.current) {
			selectPlaylist(id);
			playlistRef.current = id;
			canSelectRef.current = false;
		// }
	}

	/*Drag & Drop*/

	const entryDragStartHandler = function (e: any) {
		setSelectedElnt(e.target);
	}

	const dropHandler = function (e: any) {
		e.preventDefault();
		setSelectedElnt(undefined);
		enterTarget = null;
	}

	const dragEnterHandler = function (e: any) {
		e.preventDefault();
		if (e.target.className === 'playlistsDedup' && enterTarget === null) dragEntry('');
		enterTarget = e.target;
	}

	const dragLeaveHandler = function (e: any) {
		if (enterTarget === e.target && selectedElnt) {
			const tempArray = dedupPlaylists.filter((x) => x.id !== selectedElnt.dataset.playlist);
			setDedup(tempArray);
			enterTarget = null;
		}
	}

	function dragEntry(hoveredPl: string) {
		if (!selectedElnt || selectedElnt.dataset.playlist === hoveredPl) return;

		const selectedPl = playlists.find((x) => x.id === selectedElnt.dataset.playlist);
		if (selectedPl /*&& (selectedPl.owner.id === user || selectedPl.collaborative)*/) {
			let elntHoveredIndex = dedupPlaylists.length;
			if (hoveredPl) {
				elntHoveredIndex = dedupPlaylists.findIndex((x) => x.id === hoveredPl);
				if (elntHoveredIndex < 0) elntHoveredIndex = dedupPlaylists.length;
			}

			let tempDedupPlaylists = [...dedupPlaylists];
			const elntOldIndex = dedupPlaylists.indexOf(selectedPl);
			tempDedupPlaylists.splice(elntHoveredIndex, 0, (elntOldIndex > -1)
				? tempDedupPlaylists.splice(elntOldIndex, 1)[0]
				: selectedPl);

			setDedup(tempDedupPlaylists);
		}

	}

	/********************************************************************************************/

	return (
		<div className="page overview">
			<img width="7%" src="https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_White.png"
			     alt=""/>
			{/*<h2 className="centeredText">Overview</h2>*/}

			<Popup open={popup} setOpen={openPopup}>
				<h1 style={{fontSize: "2rem"}}>Delete List</h1>
				<div>
					<button className="button dark" style={{padding: "0.5rem"}} onClick={() => ConfirmRemoval()}>
						Remove
					</button>
					<button className="button" style={{padding: "0.5rem", marginLeft: "20px"}}
					        onClick={() => {
						        setDeleteList([]);
						        openPopup(false)
					        }}>
						Cancel
					</button>
				</div>

				<table className="tracks" width={deleteList.length && deleteList[0].original ? "70%" : "60%"}>
					<thead className="heading">
					<tr>
						<th className="playlistName">Playlist</th>
						<th className="number">#</th>
						<th className="title">Song</th>
						<th className="length">Length</th>
						{deleteList.length && deleteList[0].original ? <th className="original">Original</th> : null}
					</tr>
					</thead>
					<tbody>
					{deleteList.map((x, i) => (
						<tr
							className="track"
							key={x.playlist.id + x.track.id + x.index}
						>
							<td className="playlistName">{i === 0 || x.playlist !== deleteList[i - 1].playlist ? x.playlist.name : null}</td>
							<td className="number">{x.index + 1}</td>
							<td className="title">{x.track.name}</td>
							<td className="length">{millisToMinutesAndSeconds(x.track.duration_ms)}</td>
							{deleteList[0].original
								? <td className="original">
									{x.original && (i === 0 || x.original !== deleteList[i - 1].original) ? x.original : null}
								</td>
								: null
							}
						</tr>
					))}
					</tbody>
				</table>
			</Popup>

			<div className="playlists">
				{playlists.length === 0 && "Loading ... or you don't have any playlists"}
				{playlists.map((x) => (
					<div onDragStart={entryDragStartHandler}
					     draggable="true"
					     data-playlist={x.id}
					     key={x.id} className="entry">
						<a href={x.uri} style={{fontSize: "75%", textDecoration: "none"}}>PLAY ON SPOTIFY</a>
						<div onClick={() => selectPlaylistHelper(x.id)}>
							<img src={x.images.first()?.url} data-playlist={x.id} alt={""}/>
							{x.name}
						</div>
					</div>
				))}
			</div>

			{!!dedupMax && (<progress max={dedupMax} value={dedupProgress}/>)}
			<div className="playlistsDedup"
			     onDragOver={(e) => e.preventDefault()}
			     onDragEnter={dragEnterHandler}
			     onDragLeave={dragLeaveHandler}
			     onDrop={dropHandler}>
				{dedupPlaylists.map((x) => (
					<div onClick={() => selectPlaylistHelper(x.id)}
					     onDragStart={entryDragStartHandler}
					     onDragEnter={() => dragEntry(x.id)}
					     draggable="true"
					     data-playlist={x.id}
					     key={x.id} className="entryDedup">
						<img src={x.images.first()?.url} data-playlist={x.id} alt={""}/>
						{x.name}
					</div>
				))}
				<h2 className="dedupText">
					{dedupPlaylists.length < 10 &&
						<div>Drag&Drop playlists here for removing unavailable or duplicate tracks</div>}
					{dedupPlaylists.length < 5 && <div>(tracks remain in the playlist earlier in the list)</div>}
				</h2>
			</div>

			<div className="actions" style={dedupPlaylists.length ? {} : {display: "none"}}>
				<button onClick={() => removeTracks(ERemovalMode.Dedup)} className="button light save">
					Remove duplicates
				</button>
				<button onClick={() => removeTracks(ERemovalMode.Unavailable)} className="button light save">
					Remove unavailable tracks
				</button>
				<button onClick={() => cleanDedupList()} className="button light save">
					Clean list
				</button>
			</div>

			<br/>
			{selectedPlaylist && <Playlist id={selectedPlaylist} idRef={playlistRef} playlists={playlists}/>}
		</div>
	);
}
