export default async function getLastFmArtistTopTags(artist: string, artistId: string, apiKey: string, delay: number = 0) {
	const emptyResult = {id: artistId, tags: []};
	if (!artist || !apiKey) return emptyResult;
	// console.log('Last.FM request');
	await timeout(delay);

	const promise = await fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.gettoptags&artist=${artist}&api_key=${apiKey}&format=json`);
	if (promise.ok) {
		const data = await promise.json();
		return buildLastFmData(artist, data);
	} else {
		console.log('Last.fm request for "'+artist+'" error: '+promise.statusText);
		return emptyResult;
	}

	function timeout(delay: number) {
		return delay > 0 ? new Promise(resolve => setTimeout(resolve, delay)) : null;
	}

	function buildLastFmData(artist: string, lfmData: any) {
		const {error} = lfmData;
		let topTags = lfmData?.toptags?.tag;

		if (error || !topTags) {
			console.log('Last.fm data for "'+artist+'" error: '+lfmData?.message);
			return emptyResult;
		}

		let result = topTags
			.filter((x: any) => x.count > 9);
		if (!result.length)	result = topTags.slice(0, 3);
		result = result
			.map((x: any) => x.name.toLowerCase())
			.filter((x: any) => !x.startsWith('no ') && !x.startsWith('not '));

		return {id: artistId, tags: result};
	}
}