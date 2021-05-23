import "./Playlist.scss";

function App() {
	return (
		<div className="playlist">
			<div className="info">
				<div className="art">
					<img
						src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/7022/whenDarkOut.jpg"
						alt="When It's Dark Out"
					/>
				</div>

				<div className="meta">
					<div className="year">2021</div>

					<div className="name">Title</div>

					<div className="actions">
						<button className="button-light save">Save</button>
					</div>
				</div>
			</div>

			<div className="tracks">
				<div className="heading">
					<div className="number">#</div>

					<div className="title">Song</div>

					<div className="length">Length</div>
				</div>

				<div className="track">
					<div className="number">1</div>

					<div className="title">Intro</div>

					<div className="length">1:11</div>
				</div>
			</div>
		</div>
	);
}

export default App;
