// @ts-nocheck
import {useEffect, useReducer, useState} from "react";
import spotify from "../util/spotify";
import "./Playlist.scss";
import "missing-native-js-functions";
import {Popup} from "./Popup";
import getLastFmArtistTopTags from "../util/lastfm"

export function millisToMinutesAndSeconds(millis: number) {
	var minutes = Math.floor(millis / 60000);
	var seconds = Math.floor((millis % 60000) / 1000);
	return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
}

export function timeout(delay: number) {
	return delay > 0 ? new Promise(resolve => setTimeout(resolve, delay)) : null;
}

export default function Playlist({
	                                 id,
	                                 idRef,
	                                 playlists
                                 }: {
	id: string;
	idRef: React.MutableRefObject<string>;
	playlists: SpotifyApi.PlaylistObjectSimplified[];
}) {
	const [playlist, setPlaylist] = useState<SpotifyApi.SinglePlaylistResponse | null>(null);
	const artists = new Map<string, SpotifyApi.ArtistObjectFull>();
	const [artistsState, setArtistsState] = useState(artists);
	const [popup, openPopup] = useState(false);
	const [popupRemove, openPopupRemove] = useState(false);
	const [count, setCount] = useState(0);
	const [minimumSizePlaylist, setMinimumSizePlaylist] = useState(1);
	const [genres, setGenres] = useState<string[]>([]);
	const [excludedGenres, setExcludedGenres] = useState<string[]>([]);
	const [onlyTopGenre, setOnlyTopGenre] = useState(false);
	const [noDuplicates, setNoDuplicates] = useState(true);
	const [progress, setProgress] = useState(false);
	const [previewUrl, setPreviewUrl] = useState(null);
	const [user, setUser] = useState(null);
	const [country, setCountry] = useState('');
	const [deleteList, setDeleteList] = useState<trackInfo[]>([]);
	const [, forceUpdate] = useReducer(x => x + 1, 0);

	//LastFM
	const REQUEST_DELAY = 25;
	var reqCounter = 0;
	const [reqCounterCopy, setReqCounterCopy] = useState(0);
	const [reqCompleted, setReqCompleted] = useState(0);

	interface trackInfo {
		index: number,
		original: string
	}

	async function handleTracks(items: SpotifyApi.PlaylistTrackObject[]) {
		// items = items.filter((x) => !!x.track.id); // filter local songs

		var artistIds = items
			.map((x) => x.track.artists.map((y) => y.id))
			.flat()
			.unique()
			// @ts-ignore
			.filter((x) => x && !artists.has(x.id));

		while (artistIds.length) {
			if (id !== idRef.current) break; //abort
			const batch = artistIds.slice(0, 50);
			artistIds = artistIds.slice(50);

			const {body} = await spotify.getArtists(batch);
			for (const x of body.artists) {
				if (x && x.id) {
					artists.set(x.id, x);
					if (x.genres?.length === 0) {
						getLastFmArtistTopTags(x.name, x.id, process.env.REACT_APP_LASTFM_KEY, REQUEST_DELAY * reqCounter++)
							.then(data => {
								artists.get(data.id).genres = data.tags;
								setArtistsState(artists);
								setReqCompleted(x => x + 1);
								forceUpdate();
							})
						setReqCounterCopy(reqCounter);
					}
				}
			}
		}

		for await (let x of items) {
			x.track.genres = x.track.artists
				.map((y) => artists.get(y.id)?.genres || [])
				.flat()
				.unique();
		}
		return items;
	}

	async function refreshPlaylist(inCountry: string = '') {
		if (!inCountry) inCountry = country;
		if (!inCountry) return;

		setPlaylist(null);
		setPreviewUrl(null);
		reqCounter = 0;
		setReqCounterCopy(0);
		setReqCompleted(0);
		spotify.getPlaylist(id, {market: inCountry}).then(async ({body: state}) => {
			state.tracks.items = await handleTracks(state.tracks.items);
			setPlaylist(state);
			handleTracks(state.tracks.items);

			while (state.tracks.next) {
				if (id !== idRef.current) return; //abort
				// console.log("fetch tracks", state.tracks);

				const {body: tracks} = await spotify.getPlaylistTracks(id, {
					market: inCountry,
					offset: state.tracks.offset + state.tracks.limit
				});

				state.tracks = {...tracks, items: state.tracks.items.concat(await handleTracks(tracks.items))};

				setPlaylist({...state});
			}
		});
	}

	useEffect(() => {
		// console.log("fetch playlist");
		spotify.getMe().then(async ({body: state}) => {
			setUser(state);
			setCountry(state.country);
			refreshPlaylist(state.country);
		});
		// eslint-disable-next-line
	}, [id]);

	async function convert(doCount = false) {
		if (!playlist) return;
		// spotify
		const noGenre = 'undefined';
		const splitRE = /(?: *[,;/] *)+/;
		let allTracks = [...playlist.tracks.items];

		let genres0 = allTracks
			.map((x) => x.track.genres || [])
			.flat()
			.unique();

		let textArea = document.getElementById("textareaId");
		let keywords = textArea.value.split("\n")
			.filter(word => word !== '')
			.unique();

		if (keywords.length) {
			genres0 = genres0.map((x) => {
				for (let line of keywords) {
					const words = line.split(splitRE)
						.filter(w => w !== '')
						.unique();
					for (let word of words)
						if (x.search(word) !== -1) return line;
				}
				return x;
			});
		}
		genres0.push(noGenre);
		const genres = genres0.unique();

		const listGenrePlaylists = [];

		var i = 0;
		const percentage = 100 / count;


		for (const genre of genres) {
			var songs = allTracks
				.filter((x) => {
					let curGenres = [...x.track.genres];
					if (curGenres.length) {
						if (onlyTopGenre) curGenres.length = 1;
						for (let iter of curGenres) {
							const words = genre.split(splitRE)
								.filter(w => w !== '')
								.unique();
							for (let word of words)
								if (iter.search(word) !== -1) return true;
						}
					} else if (genre === noGenre) return true;
					return false;
				});

			if (songs.length < minimumSizePlaylist) continue;
			if (excludedGenres.includes(genre)) {
				listGenrePlaylists.push(genre);
				continue;
			}
			i++;
			listGenrePlaylists.push(genre + ' - ' + songs.length);
			if (noDuplicates) {
				let filterDups = [];
				for (let i = 0; i < allTracks.length; i++) {
					const iter = allTracks[i];
					if (!songs.includes(iter))
						filterDups.push(iter);
				}
				allTracks = filterDups;
			}

			if (doCount) continue;

			var list = playlists.find((x) => x.name.toLowerCase() === genre.toLowerCase());
			if (!list) {
				list = (await spotify.createPlaylist(genre, {public: false, description: `${genre} autogenerated`}))
					.body;
				playlists.push(list);
			}

			const songPercentage = percentage / (songs.length || 1);
			var j = 1;

			while (songs.length) {
				const batch = songs.slice(0, 100).map((x) => x.track.uri);
				songs = songs.slice(100);
				j += songs.length;

				await spotify.addTracksToPlaylist(list.id, batch);
				setProgress(percentage * i * songPercentage * j);
			}

			setProgress(percentage * i);
		}
		setCount(i);
		setGenres(listGenrePlaylists);
	}

	enum ERemovalMode {
		Dedup,
		Unavailable
	}

	async function removeTracks(curPlaylist: SpotifyApi.SinglePlaylistResponse, mode: ERemovalMode) {
		if (!curPlaylist) return;

		let trackList: trackInfo[] = [];
		const tracks = curPlaylist.tracks.items;
		for (let i = 0; i < tracks.length; i++) {
			if (tracks[i].track.type === 'track') {
				trackList.push({
					track: tracks[i].track,
					index: i,
					original: ''
				});
			}
		}
		let str = '';
		switch (+mode) {
			case ERemovalMode.Dedup:
				str = ' duplicated ';
				//search for duplicates and leave only them
				const trackUri = trackList.map((x) => x.track.uri);
				for (let i = 0; i < trackList.length; i++) {
					const indexOfTrack = trackUri.indexOf(trackList[i].track.uri);
					if (indexOfTrack !== i) {
						const orig = trackList[indexOfTrack];
						trackList[i].original = '#' + (orig.index + 1);
					}
				}
				trackList = trackList.filter((x) => !!x.original);
				break;
			case ERemovalMode.Unavailable:
				str = ' unavailable ';
				//search for unavailables songs and leave only them
				trackList = trackList.filter((x) => x.track.is_playable === false);
				break;
			default:
				return;
		}

		if (trackList.length) {
			setDeleteList(trackList);
			openPopupRemove(true);
		} else {
			alert('No' + str + 'tracks!');
		}
	}

	async function ConfirmRemoval() {
		let trackList = [...deleteList]
			.map((x) => x.index)
			.sort((x, y) => y - x);
		const list = (await spotify.getPlaylist(playlist.id)).body;
		while (trackList.length) {
			const batch = trackList.slice(0, 100);
			trackList = trackList.slice(100);
			await spotify.removeTracksFromPlaylistByPosition(list.id, batch, list.snapshot_id);
			batch.forEach((x) => playlist.tracks.items.splice(x, 1));
		}
		setDeleteList([]);
		openPopupRemove(false);
		refreshPlaylist();
	}

	function toggleGenre(genre) {
		var list = [...excludedGenres];

		if (list.includes(genre)) list = list.filter((x) => x !== genre);
		else list.push(genre);

		setExcludedGenres(list);
	}

	/********************************************************************************************/

	if (!playlist || id !== idRef.current) return <div>Loading playlist ...</div>;

	return (
		<div className="playlist">
			{playlist.tracks.items.length + reqCompleted < playlist.tracks.total + reqCounterCopy && (
				<progress value={playlist.tracks.items.length + reqCompleted}
				          max={playlist.tracks.total + reqCounterCopy}/>
			)}

			<Popup open={popup} setOpen={openPopup}>
				<h1 style={{fontSize: "3rem"}}>Separate into genres</h1>
				{count ? (
					<p className="yellow">Warning this will generate {count} new genre playlists</p>
				) : (
					<p>
						Sorry but your playlist is too small,
						<br/>
						change the minimum size of genre playlist
					</p>
				)}

				<ul className="genres">
					{genres.map((x) => (
						<li
							onClick={toggleGenre.bind(null, x)}
							style={{textDecoration: excludedGenres.includes(x) ? "line-through" : ""}}
						>
							{x}
						</li>
					))}
				</ul>

				<div>
					<button className="button" style={{fontSize: "0.6rem"}} onClick={() => convert(true)}>
						Recalculate
					</button>
				</div>

				<label>
					<textarea id="textareaId"
					          rows="5" cols="33">
					</textarea>
					<br/>Combine genres by keywords
				</label>

				<label>
					<input
						type="number"
						min="1"
						value={minimumSizePlaylist}
						onChange={(e) => setMinimumSizePlaylist(Number(e.target.value))}
					/>
					<br/>
					Minimum size of genre playlist
				</label>

				<label>
					<input type="checkbox" checked={onlyTopGenre} onChange={(e) => setOnlyTopGenre(e.target.checked)}/>
					Only filter by main genre of artist
				</label>

				<label>
					<input type="checkbox" checked={noDuplicates} onChange={(e) => setNoDuplicates(e.target.checked)}/>
					Do not duplicate songs
				</label>

				<div>
					<button className="button dark" onClick={() => convert(false)}>
						Separate
					</button>
				</div>

				<div>{progress >= 100 ? "DONE" : progress && <progress max={100} value={progress}/>}</div>
			</Popup>

			<Popup open={popupRemove} setOpen={openPopupRemove}>
				<h1 style={{fontSize: "2rem"}}>Delete List</h1>
				<div>
					<button className="button dark" style={{padding: "0.5rem"}} onClick={() => ConfirmRemoval()}>
						Remove
					</button>
					<button className="button" style={{padding: "0.5rem", marginLeft: "20px"}}
					        onClick={() => {
						        setDeleteList([]);
						        openPopupRemove(false)
					        }}>
						Cancel
					</button>
				</div>

				<table className="tracks" width={deleteList.length && deleteList[0].original ? "70%" : "60%"}>
					<thead className="heading">
					<tr>
						<th className="number">#</th>
						<th className="title">Song</th>
						<th className="length">Length</th>
						{deleteList.length && deleteList[0].original ? <th className="title">Original</th> : null}
					</tr>
					</thead>
					<tbody>
					{deleteList.map((x, i) => (
						<tr
							className="track"
							key={x.index.toString() + i.toString()}
						>
							<td className="number">{x.index + 1}</td>
							<td className="title">{playlist.tracks.items[x.index].track.name}</td>
							<td className="length">{millisToMinutesAndSeconds(playlist.tracks.items[x.index].track.duration_ms)}</td>
							{deleteList[0].original
								? <td className="number">
									{x.original && (i === 0 || x.original !== deleteList[i - 1].original) ? x.original : null}
								</td>
								: null
							}
						</tr>
					))}
					</tbody>
				</table>
			</Popup>

			<div className="info">
				<div className="art">
					<img src={playlist.images.first()?.url} alt="Playlist cover"/>
				</div>

				<div className="meta">
					<div className="author">{playlist.owner.display_name}</div>

					<div className="name">{playlist.name}</div>

					<div className="actions">
						<button onClick={() => refreshPlaylist()} className="button light save">
							Refresh
						</button>
						<button onClick={() => openPopup(true) || convert(true)} className="button light save">
							Separate into genres
						</button>
						<button
							style={(playlist.owner.id === user.id || playlist.collaborative) ? {} : {display: 'none'}}
							onClick={() => removeTracks(playlist, ERemovalMode.Dedup)}
							className="button light save">
							Remove duplicates
						</button>
						<button
							style={(playlist.owner.id === user.id || playlist.collaborative) ? {} : {display: 'none'}}
							onClick={() => removeTracks(playlist, ERemovalMode.Unavailable)}
							className="button light save">
							Remove unavailable
						</button>
					</div>
				</div>
			</div>

			{previewUrl && <audio src={previewUrl} controls autoPlay loop/>}

			<table className="tracks">
				<thead className="heading">
				<tr>
					<td className="number">#</td>

					<td className="title">Song</td>
					<td className="genre">Genre</td>

					<td className="length">Length</td>
				</tr>
				</thead>

				<tbody>
				{playlist.tracks.items.map((x, i) => (
					<tr
						className="track"
						key={x.track.id + i.toString()}
					>
						<td className="number">{i + 1}</td>

						<td className="title" onClick={setPreviewUrl.bind(null, x.track.preview_url)}>
							{x.track.name}
						</td>
						<td className="genre">
							{
								(x.track.genres.length
										? x.track.genres
										: x.track.artists
											.map((y) => artistsState.get(y.id)?.genres || [])
											.flat()
											.unique()
								)
									.map((z, j) => (
										<p key={x.track.id + i.toString() + z + j.toString()}>{z}</p>
									))
							}
						</td>

						<td className="length">{millisToMinutesAndSeconds(x.track.duration_ms)}</td>
						<td><a href={x.track.uri} style={{fontSize: "80%", textDecoration: "none"}}>PLAY ON SPOTIFY</a>
						</td>
					</tr>
				))}
				</tbody>
			</table>
		</div>
	);
}
