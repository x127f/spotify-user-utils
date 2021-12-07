// @ts-nocheck
import {useEffect, useState} from "react";
import spotify from "../util/spotify";
import "./Playlist.scss";
import "missing-native-js-functions";
import {Popup} from "./Popup";

function millisToMinutesAndSeconds(millis: number) {
	var minutes = Math.floor(millis / 60000);
	var seconds = Math.floor((millis % 60000) / 1000);
	return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
}

export default function Playlist({
	                                 id,
	                                 playlists: pl,
                                 }: {
	id: string;
	playlists: SpotifyApi.PlaylistObjectSimplified[];
}) {
	const [playlist, setPlaylist] = useState<SpotifyApi.SinglePlaylistResponse | null>(null);
	const artists = new Map<string, SpotifyApi.ArtistObjectFull>();
	const [popup, openPopup] = useState(false);
	const [count, setCount] = useState(0);
	const [minimumSizePlaylist, setMinimumSizePlaylist] = useState(30);
	const [genres, setGenres] = useState<string[]>([]);
	const [excludedGenres, setExcludedGenres] = useState<string[]>([]);
	const [onlyTopGenre, setOnlyTopGenre] = useState(false);
	const [noDuplicates, setNoDuplicates] = useState(true);
	const [progress, setProgress] = useState(false);
	// const [clearPlaylists, setClearPlaylists] = useState(false);
	const [previewUrl, setPreviewUrl] = useState(null);
	const [user, setUser] = useState(null);
	const [country, setCountry] = useState('');

	const playlists = [...pl];

	// eslint-disable-next-line
	async function handleTracks(items: SpotifyApi.PlaylistTrackObject[]) {
		// items = items.filter((x) => !!x.track.id); // filter local songs

		var artistIds = items
			.map((x) => x.track.artists.map((y) => y.id))
			.flat()
			.unique()
			// @ts-ignore
			.filter((x) => x && !artists.has(x.id));

		while (artistIds.length) {
			const batch = artistIds.slice(0, 50);
			artistIds = artistIds.slice(50);

			const {body} = await spotify.getArtists(batch);
			body.artists.forEach((x) => { if (x && x.id) artists.set(x.id, x) });
		}

		items.forEach(
			(x) =>
				(x.track.genres = x.track.artists
					.map((y) => artists.get(y.id)?.genres || [])
					.flat()
					.unique())
		);
		return items;
	}

	function refreshPlaylist(inCountry: string = '') {
		if (!inCountry) inCountry = country;
		if (!inCountry) return;

		spotify.getPlaylist(id, {market: inCountry}).then(async ({body: state}) => {
			state.tracks.items = await handleTracks(state.tracks.items);
			setPlaylist(state);

			while (state.tracks.next) {
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

		let trackPos = [...curPlaylist.tracks.items];
		let str = '';
		switch (+mode) {
			case ERemovalMode.Dedup:
				str = ' duplicated ';
				//search for duplicates...
				trackPos = trackPos
					.map((x) => x.track.uri)
					.map((x, i, a) => a.indexOf(x) !== i ? i : -1);

				break;
			case ERemovalMode.Unavailable:
				str = ' unavailable ';
				//search for unavailables songs...
				trackPos = trackPos
					.map((x, i) =>
						(x.track.type === 'track' && x.track.is_playable === false) ? i : -1);
				break;
			default:
				return;
		}
		//...and leave only them
		trackPos = trackPos.filter((x) => x >= 0);

		//get track names
		let trackNames = [];
		for (let i = 0; i < trackPos.length; ++i) {
			const track = curPlaylist.tracks.items[trackPos[i]].track;
			trackNames.push((trackPos[i] + 1) + '-' + track.name);
		}

		//sorting in descending order
		trackPos = trackPos.sort((x, y) => y - x);

		//removing
		if (trackPos.length) {
			const allow = window.confirm(`Delete ${trackPos.length} ${str} tracks?\n${trackNames.toString()}`);
			if (allow) {
				while (trackPos.length) {
					const list = (await spotify.getPlaylist(curPlaylist.id)).body;
					const batch = trackPos.slice(0, 100);
					trackPos = trackPos.slice(100);
					await spotify.removeTracksFromPlaylistByPosition(list.id, batch, list.snapshot_id);
					batch.forEach((x) => curPlaylist.tracks.items.splice(x));
				}
				// curPlaylist.tracks.total = curPlaylist.tracks.items.length;
				refreshPlaylist();
			}
		} else {
			alert('No' + str + 'tracks!');
		}
		//TODO: Better UI
	}

	if (!playlist) return <div>Loading playlist ...</div>;

	function toggleGenre(genre) {
		var list = [...excludedGenres];

		if (list.includes(genre)) list = list.filter((x) => x !== genre);
		else list.push(genre);

		setExcludedGenres(list);
	}

	// console.log({ previewUrl });

	return (
		<div className="playlist">
			{playlist.tracks.items.length !== playlist.tracks.total && (
				<progress max={playlist.tracks.total} value={playlist.tracks.items.length}/>
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
					Only filter by main genre of song
				</label>

				<label>
					<input type="checkbox" checked={noDuplicates} onChange={(e) => setNoDuplicates(e.target.checked)}/>
					Do not duplicate songs
				</label>

				{/* <label>
					<input
						type="checkbox"
						value={clearPlaylists}
						onChange={(e) => setclearPlaylists(e.target.checked)}
					/>
					Clear genre playlists
				</label> */}

				<div>
					<button className="button" style={{fontSize: "0.6rem"}} onClick={() => convert(true)}>
						Recalculate
					</button>
				</div>

				<div>
					<button className="button dark" onClick={() => convert(false)}>
						Separate
					</button>
				</div>

				<div>{progress >= 100 ? "DONE" : progress && <progress max={100} value={progress}/>}</div>
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
						onClick={setPreviewUrl.bind(null, x.track.preview_url)}
						className="track"
						key={x.track.id + i.toString() + playlist.id}
					>
						<td className="number">{i + 1}</td>

						<td className="title">{x.track.name}</td>
						<td className="genre">
							{x.track.genres.map((x) => (
								<p>{x}</p>
							))}
						</td>

						<td className="length">{millisToMinutesAndSeconds(x.track.duration_ms)}</td>
					</tr>
				))}
				</tbody>
			</table>
		</div>
	);
}
